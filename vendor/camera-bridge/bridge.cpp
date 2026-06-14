// promptly-camera-bridge — links the Panasonic "Lumix Remote Control Library"
// (Lmxptpif.dll) and speaks the SAME line-delimited JSON stdio protocol as
// mock-bridge.js, so it drops in behind CameraManager with no changes above it.
//
// Commands (stdin):  {"cmd":"connect"|"disconnect"|"record-start"|"record-stop"|"status"}
// Events  (stdout):  {"event":"ready"}
//                    {"event":"connected","model":"DC-S5M2"}
//                    {"event":"disconnected"}
//                    {"event":"recording","value":true|false}
//                    {"event":"error","message":"..."}
//
// Call sequence mirrors the SDK's ActionParameters01 sample:
//   Init -> Get_PnPDeviceInfo -> Select_PnPDevice -> Open_Session(0x00010001)
//   -> MoveRec_Ctrl_Start / MoveRec_Ctrl_Stop(0) -> Close_Session -> Close_Device

#include <winsock2.h>   // must precede windows.h
#include <ws2tcpip.h>
#include <windows.h>
#include <string>
#include <iostream>
#include <cstdio>
#include <cctype>
#include <cstdlib>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <new>

#include "LMX_func_api.h"

#pragma comment(lib, "ws2_32.lib")

static bool        g_connected = false;
static bool        g_recording = false;
static std::string g_model     = "camera";

// Live view: a worker thread pulls JPEG frames from the SDK and streams them to
// Node over a localhost TCP socket. One mutex serializes ALL SDK calls so the
// frame loop and command handlers can't corrupt the PTP session.
static std::mutex        g_sdkMutex;
static std::mutex        g_emitMutex;   // serializes stdout writes (main + live-view thread)
static std::atomic<bool> g_liveviewRunning{ false };
static std::thread       g_liveviewThread;
static SOCKET            g_frameSocket = INVALID_SOCKET;

// stdout is the control channel: one JSON object per line, flushed immediately.
// Guarded so the live-view worker thread and the main thread never interleave.
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
            default:
                if (static_cast<unsigned char>(c) >= 0x20) out += c;
        }
    }
    return out;
}

static void emitEvent(const char* ev)              { emitRaw(std::string("{\"event\":\"") + ev + "\"}"); }
static void emitConnected(const std::string& model){ emitRaw("{\"event\":\"connected\",\"model\":\"" + jsonEscape(model) + "\"}"); }
static void emitRecording(bool v)                  { emitRaw(std::string("{\"event\":\"recording\",\"value\":") + (v ? "true" : "false") + "}"); }
static void emitLiveview(bool v)                    { emitRaw(std::string("{\"event\":\"liveview\",\"value\":") + (v ? "true" : "false") + "}"); }
static void emitError(const std::string& msg)      { emitRaw("{\"event\":\"error\",\"message\":\"" + jsonEscape(msg) + "\"}"); }

static std::string wideToUtf8(const WCHAR* w) {
    if (!w) return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
    if (len <= 0) return "";
    std::string out(static_cast<size_t>(len - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, w, -1, &out[0], len, nullptr, nullptr);
    return out;
}

// Enumerate USB cameras and open a tether session with the first one found.
static void doConnect() {
    if (g_connected) { emitConnected(g_model); return; }

    std::lock_guard<std::mutex> lk(g_sdkMutex);

    // The device-info struct is large (~0.5 MB); keep it off the stack.
    static LMX_CONNECT_DEVICE_INFO devInfo;
    UINT32 retError = 0;

    UINT8 ret = LMX_func_api_Get_PnPDeviceInfo(&devInfo, &retError);
    if (ret != LMX_BOOL_TRUE || devInfo.find_PnpDevice_Count == 0) {
        emitError("No camera detected over USB (set camera to PC(Tether) mode)");
        return;
    }

    // Prefer a Panasonic/Lumix device; don't blindly grab a phone or other MTP
    // device that may also be enumerated.
    UINT32 index = 0;
    bool found = false;
    for (UINT32 i = 0; i < devInfo.find_PnpDevice_Count; ++i) {
        std::string tag = wideToUtf8(devInfo.find_PnpDevice_Info[i].dev_MakerName) + " " +
                          wideToUtf8(devInfo.find_PnpDevice_Info[i].dev_ModelName);
        for (char& c : tag) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
        if (tag.find("PANASONIC") != std::string::npos ||
            tag.find("LUMIX")     != std::string::npos ||
            tag.find("DC-")       != std::string::npos) {
            index = i; found = true; break;
        }
    }
    if (!found) {
        std::string first = wideToUtf8(devInfo.find_PnpDevice_Info[0].dev_ModelName);
        emitError("No Lumix camera among " + std::to_string(devInfo.find_PnpDevice_Count) +
                  " USB device(s); first is '" + first + "'");
        return;
    }

    std::string model = wideToUtf8(devInfo.find_PnpDevice_Info[index].dev_ModelName);
    if (model.empty()) model = "camera";

    ret = LMX_func_api_Select_PnPDevice(index, &devInfo, &retError);
    if (ret != LMX_BOOL_TRUE) {
        emitError("Failed to select camera (err " + std::to_string(retError) + ")");
        return;
    }

    UINT32 deviceConnectVer = 0;
    ret = LMX_func_api_Open_Session(0x00010001, &deviceConnectVer, &retError);
    if (ret != LMX_BOOL_TRUE) {
        emitError("Failed to open camera session (err " + std::to_string(retError) + ")");
        return;
    }

    g_connected = true;
    g_recording = false;
    g_model     = model;
    emitConnected(model);
}

// ---- Live view: stream JPEG frames to Node over localhost TCP ----

static bool sendAll(SOCKET s, const char* buf, int len) {
    int sent = 0;
    while (sent < len) {
        int n = send(s, buf + sent, len - sent, 0);
        if (n <= 0) return false;
        sent += n;
    }
    return true;
}

static bool sendFrame(const UINT8* data, UINT32 size) {
    unsigned char hdr[4] = {
        (unsigned char)((size >> 24) & 0xFF), (unsigned char)((size >> 16) & 0xFF),
        (unsigned char)((size >> 8) & 0xFF),  (unsigned char)(size & 0xFF)
    };
    if (!sendAll(g_frameSocket, (const char*)hdr, 4)) return false;
    return sendAll(g_frameSocket, (const char*)data, (int)size);
}

static SOCKET connectFrameSocket(int port) {
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) return INVALID_SOCKET;
    sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons((u_short)port);
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
    if (connect(s, (sockaddr*)&addr, sizeof(addr)) != 0) { closesocket(s); return INVALID_SOCKET; }
    return s;
}

// Worker thread: pull JPEG frames from the SDK and stream them until stopped.
static void liveviewLoop() {
    LMX_STRUCT_LIVEVIEW_INFO_HISTGRAM hist;
    LMX_STRUCT_LIVEVIEW_INFO_POSTURE  post;
    LMX_STRUCT_LIVEVIEW_INFO_LEVEL    lvl;
    UINT8* jpeg = new (std::nothrow) UINT8[LMX_DEF_LIVEVIEW_STREAMDATA_SIZE_MAX];
    if (!jpeg) { g_liveviewRunning = false; return; }

    while (g_liveviewRunning.load()) {
        UINT32 jpegSize = 0, retError = 0;
        UINT32 histSize = sizeof(hist), postSize = sizeof(post), lvlSize = sizeof(lvl);
        UINT8 ret;
        {
            std::lock_guard<std::mutex> lk(g_sdkMutex);
            ret = LMX_func_api_Get_LiveView_data(&hist, &histSize, &post, &postSize,
                                                 &lvl, &lvlSize, jpeg, &jpegSize, &retError);
        }
        if (ret == LMX_BOOL_FALSE) {
            // BUSY = frame not ready yet; otherwise brief pause and retry.
            std::this_thread::sleep_for(std::chrono::milliseconds(
                retError == LMX_DEF_ERR_COM_DATA_BUSY ? 5 : 15));
            continue;
        }
        if (jpegSize > 0 && !sendFrame(jpeg, jpegSize)) {
            // Node closed the frame socket. Stop and tell the manager live view
            // ended so its state doesn't stay stuck "on" with a frozen frame.
            g_liveviewRunning = false;
            emitLiveview(false);
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(33)); // ~30 fps cap
    }
    delete[] jpeg;
}

static void doLiveviewStart(int framePort) {
    if (g_liveviewRunning.load()) { emitLiveview(true); return; }
    // Reap a worker that self-exited (e.g. Node closed the socket) so the
    // std::thread object is safe to reassign — assigning onto a joinable thread
    // calls std::terminate.
    if (g_liveviewThread.joinable()) g_liveviewThread.join();
    if (g_frameSocket != INVALID_SOCKET) { closesocket(g_frameSocket); g_frameSocket = INVALID_SOCKET; }
    if (!g_connected)   { emitError("No camera connected"); return; }
    if (framePort <= 0) { emitError("Invalid live-view frame port"); return; }

    g_frameSocket = connectFrameSocket(framePort);
    if (g_frameSocket == INVALID_SOCKET) { emitError("Live-view frame connection failed"); return; }

    UINT32 retError = 0;
    UINT8 ret;
    { std::lock_guard<std::mutex> lk(g_sdkMutex); ret = LMX_func_api_Ctrl_LiveView_Start(&retError); }
    if (ret != LMX_BOOL_TRUE) {
        closesocket(g_frameSocket); g_frameSocket = INVALID_SOCKET;
        emitError("Live-view start failed (err " + std::to_string(retError) + ")");
        return;
    }

    g_liveviewRunning = true;
    g_liveviewThread = std::thread(liveviewLoop);
    emitLiveview(true);
}

static void doLiveviewStop() {
    g_liveviewRunning = false;
    if (g_liveviewThread.joinable()) g_liveviewThread.join();
    { std::lock_guard<std::mutex> lk(g_sdkMutex); UINT32 e = 0; LMX_func_api_Ctrl_LiveView_Stop(&e); }
    if (g_frameSocket != INVALID_SOCKET) { closesocket(g_frameSocket); g_frameSocket = INVALID_SOCKET; }
    emitLiveview(false);
}

static void doDisconnect() {
    if (g_liveviewRunning.load() || g_liveviewThread.joinable()) doLiveviewStop();
    std::lock_guard<std::mutex> lk(g_sdkMutex);
    UINT32 retError = 0;
    if (g_recording) { LMX_func_api_MoveRec_Ctrl_Stop(0, &retError); g_recording = false; }
    if (g_connected) {
        LMX_func_api_Close_Session(&retError);
        LMX_func_api_Close_Device(&retError);
        g_connected = false;
        emitEvent("disconnected");
    }
}

static void doRecordStart() {
    if (!g_connected) { emitError("No camera connected"); return; }
    if (g_recording)  { emitRecording(true); return; }
    std::lock_guard<std::mutex> lk(g_sdkMutex);
    UINT32 retError = 0;
    if (LMX_func_api_MoveRec_Ctrl_Start(&retError) != LMX_BOOL_TRUE) {
        emitError("Record start failed (err " + std::to_string(retError) + ")");
        return;
    }
    g_recording = true;
    emitRecording(true);
}

static void doRecordStop() {
    if (!g_connected) { emitError("No camera connected"); return; }
    if (!g_recording) { emitRecording(false); return; }
    std::lock_guard<std::mutex> lk(g_sdkMutex);
    UINT32 retError = 0;
    if (LMX_func_api_MoveRec_Ctrl_Stop(0, &retError) != LMX_BOOL_TRUE) {
        emitError("Record stop failed (err " + std::to_string(retError) + ")");
        return;
    }
    g_recording = false;
    emitRecording(false);
}

static void doStatus() {
    if (g_connected) emitConnected(g_model); else emitEvent("disconnected");
    emitRecording(g_recording);
    emitLiveview(g_liveviewRunning.load());
}

// Liveness probe: re-enumerate WPD; if our camera is no longer present it was
// turned off / unplugged. Debounced (two consecutive misses) to ride out a
// transient enumeration hiccup. Independent of session state / camera model.
static int g_pingMisses = 0;
static void doPing() {
    if (!g_connected) { g_pingMisses = 0; return; }

    bool enumerated = false, present = false;
    {
        std::lock_guard<std::mutex> lk(g_sdkMutex);
        static LMX_CONNECT_DEVICE_INFO devInfo;
        UINT32 e = 0;
        if (LMX_func_api_Get_PnPDeviceInfo(&devInfo, &e) == LMX_BOOL_TRUE) {
            enumerated = true;
            for (UINT32 i = 0; i < devInfo.find_PnpDevice_Count; ++i) {
                std::string tag = wideToUtf8(devInfo.find_PnpDevice_Info[i].dev_MakerName) + " " +
                                  wideToUtf8(devInfo.find_PnpDevice_Info[i].dev_ModelName);
                for (char& c : tag) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
                if (tag.find("PANASONIC") != std::string::npos ||
                    tag.find("LUMIX") != std::string::npos ||
                    tag.find("DC-") != std::string::npos) { present = true; break; }
            }
        }
    }
    // Only treat a SUCCESSFUL enumeration that no longer lists the camera as a miss.
    // A failed enumeration is inconclusive — don't disconnect a working camera over it.
    if (!enumerated) return;
    if (present) { g_pingMisses = 0; return; }
    if (++g_pingMisses < 2) return;
    g_pingMisses = 0;

    // Camera gone — tear down. Stop live view OUTSIDE the SDK mutex (it joins the
    // worker thread, which itself takes the mutex) to avoid deadlock.
    if (g_liveviewRunning.load() || g_liveviewThread.joinable()) doLiveviewStop();
    {
        std::lock_guard<std::mutex> lk(g_sdkMutex);
        UINT32 e = 0;
        LMX_func_api_Close_Session(&e);
        LMX_func_api_Close_Device(&e);
    }
    g_connected = false;
    g_recording = false;
    emitEvent("disconnected");
}

// Extract the string value of `key` from a flat JSON object line. Robust dispatch
// (vs substring matching) so future commands / string params can't mis-trigger.
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

static int parseFramePort(const std::string& line) {
    size_t p = line.find("\"framePort\"");
    if (p == std::string::npos) return 0;
    p = line.find(':', p);
    if (p == std::string::npos) return 0;
    return std::atoi(line.c_str() + p + 1);
}

int main() {
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);

    LMX_func_api_Init();
    emitEvent("ready");

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        // Dispatch on the exact "cmd" value (robust to string params / new commands).
        const std::string cmd = extractJsonString(line, "cmd");
        if      (cmd == "liveview-start") doLiveviewStart(parseFramePort(line));
        else if (cmd == "liveview-stop")  doLiveviewStop();
        else if (cmd == "record-start")   doRecordStart();
        else if (cmd == "record-stop")    doRecordStop();
        else if (cmd == "connect")        doConnect();
        else if (cmd == "disconnect")     doDisconnect();
        else if (cmd == "status")         doStatus();
        else if (cmd == "ping")           doPing();
        else emitError("Unknown command: " + cmd);
    }

    doDisconnect();
    { std::lock_guard<std::mutex> lk(g_sdkMutex); LMX_func_api_Close_Device(nullptr); }
    WSACleanup();
    return 0;
}
