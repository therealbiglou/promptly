// promptly-input-bridge — Windows Raw Input helper. Watches system-wide mouse
// input, identifies the SOURCE DEVICE of each left-click, and (after a "bind")
// reports only the bound device's clicks. Speaks the same line-delimited JSON
// stdio protocol as mock-input-bridge.js so it drops in behind InputBridgeManager.
//
//   Electron -> helper:  {"cmd":"set-device","id":"<deviceName>"} | {"cmd":"bind"} | {"cmd":"clear"}
//   helper -> Electron:  {"event":"ready"}
//                        {"event":"bound","id":"<deviceName>"}   // bind captured a device
//                        {"event":"trigger"}                     // bound device left-clicked
//
// Device identity comes from RAWINPUTHEADER.hDevice -> RIDI_DEVICENAME (a stable
// per-device path), which the renderer round-trips back via set-device.

#include <windows.h>
#include <string>
#include <vector>
#include <iostream>
#include <cstdio>
#include <thread>
#include <mutex>

#pragma comment(lib, "User32.lib")

static std::mutex   g_state;          // guards the two fields below
static std::wstring g_boundDevice;    // device name to filter on (empty = none)
static bool         g_bindMode = false;

static std::mutex g_emitMutex;        // serializes stdout (main + stdin thread)
static HWND       g_hwnd = nullptr;

static void emitRaw(const std::string& json) {
    std::lock_guard<std::mutex> lk(g_emitMutex);
    std::fputs(json.c_str(), stdout);
    std::fputc('\n', stdout);
    std::fflush(stdout);
}

static std::string jsonEscape(const std::string& s) {
    std::string out;
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default: if (static_cast<unsigned char>(c) >= 0x20) out += c;
        }
    }
    return out;
}

static void emitEvent(const char* ev) { emitRaw(std::string("{\"event\":\"") + ev + "\"}"); }
static void emitBound(const std::string& id) { emitRaw("{\"event\":\"bound\",\"id\":\"" + jsonEscape(id) + "\"}"); }

static std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
    if (n <= 0) return L"";
    std::wstring w(static_cast<size_t>(n - 1), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, &w[0], n);
    return w;
}

static std::string wideToUtf8(const std::wstring& w) {
    if (w.empty()) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (n <= 0) return "";
    std::string s(static_cast<size_t>(n - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, &s[0], n, nullptr, nullptr);
    return s;
}

static std::wstring getDeviceName(HANDLE hDevice) {
    if (!hDevice) return L"";
    UINT size = 0;
    if (GetRawInputDeviceInfoW(hDevice, RIDI_DEVICENAME, nullptr, &size) != 0 || size == 0) return L"";
    std::wstring name(size, L'\0');
    UINT got = GetRawInputDeviceInfoW(hDevice, RIDI_DEVICENAME, &name[0], &size);
    if (got == static_cast<UINT>(-1)) return L"";
    name.resize(wcslen(name.c_str()));
    return name;
}

static std::string extractJsonString(const std::string& line, const char* key) {
    std::string needle = std::string("\"") + key + "\"";
    size_t p = line.find(needle);
    if (p == std::string::npos) return "";
    p = line.find(':', p + needle.size());
    if (p == std::string::npos) return "";
    ++p;
    while (p < line.size() && (line[p] == ' ' || line[p] == '\t')) ++p;
    if (p >= line.size() || line[p] != '"') return "";
    ++p;
    std::string out;
    while (p < line.size() && line[p] != '"') {
        if (line[p] == '\\' && p + 1 < line.size()) ++p;
        out += line[p++];
    }
    return out;
}

static void onLeftButtonDown(const std::wstring& deviceName) {
    std::lock_guard<std::mutex> lk(g_state);
    if (g_bindMode) {
        g_bindMode = false;
        g_boundDevice = deviceName;
        emitBound(wideToUtf8(deviceName));
    } else if (!g_boundDevice.empty() && deviceName == g_boundDevice) {
        emitEvent("trigger");
    }
}

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    if (msg == WM_INPUT) {
        UINT size = 0;
        GetRawInputData((HRAWINPUT)lParam, RID_INPUT, nullptr, &size, sizeof(RAWINPUTHEADER));
        if (size > 0) {
            std::vector<BYTE> buf(size);
            if (GetRawInputData((HRAWINPUT)lParam, RID_INPUT, buf.data(), &size, sizeof(RAWINPUTHEADER)) == size) {
                RAWINPUT* ri = reinterpret_cast<RAWINPUT*>(buf.data());
                if (ri->header.dwType == RIM_TYPEMOUSE &&
                    (ri->data.mouse.usButtonFlags & RI_MOUSE_LEFT_BUTTON_DOWN)) {
                    onLeftButtonDown(getDeviceName(ri->header.hDevice));
                }
            }
        }
        return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

static void stdinLoop() {
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        const std::string cmd = extractJsonString(line, "cmd");
        if (cmd == "set-device") {
            std::lock_guard<std::mutex> lk(g_state);
            g_boundDevice = utf8ToWide(extractJsonString(line, "id"));
        } else if (cmd == "bind") {
            std::lock_guard<std::mutex> lk(g_state);
            g_bindMode = true;
        } else if (cmd == "clear") {
            std::lock_guard<std::mutex> lk(g_state);
            g_boundDevice.clear();
            g_bindMode = false;
        }
    }
    // Parent closed stdin (Electron exited) — shut down.
    ExitProcess(0);
}

int main() {
    const wchar_t* cls = L"PromptlyInputBridgeWnd";
    WNDCLASSW wc = {};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.lpszClassName = cls;
    RegisterClassW(&wc);

    // Hidden (never shown) top-level window — receives background raw input.
    g_hwnd = CreateWindowExW(0, cls, L"", WS_OVERLAPPED, 0, 0, 0, 0,
                             nullptr, nullptr, wc.hInstance, nullptr);
    if (!g_hwnd) { emitRaw("{\"event\":\"error\",\"message\":\"window creation failed\"}"); return 1; }

    RAWINPUTDEVICE rid = {};
    rid.usUsagePage = 0x01; // Generic Desktop
    rid.usUsage = 0x02;     // Mouse
    rid.dwFlags = RIDEV_INPUTSINK; // receive even when not foreground
    rid.hwndTarget = g_hwnd;
    if (!RegisterRawInputDevices(&rid, 1, sizeof(rid))) {
        emitRaw("{\"event\":\"error\",\"message\":\"RegisterRawInputDevices failed\"}");
        return 1;
    }

    emitEvent("ready");
    std::thread(stdinLoop).detach();

    MSG m;
    while (GetMessage(&m, nullptr, 0, 0) > 0) {
        TranslateMessage(&m);
        DispatchMessage(&m);
    }
    return 0;
}
