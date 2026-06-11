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

#include <windows.h>
#include <string>
#include <iostream>
#include <cstdio>
#include <cctype>

#include "LMX_func_api.h"

static bool        g_connected = false;
static bool        g_recording = false;
static std::string g_model     = "camera";

// stdout is the control channel: one JSON object per line, flushed immediately.
static void emitRaw(const std::string& json) {
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

static void doDisconnect() {
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
}

static bool has(const std::string& line, const char* token) {
    return line.find(token) != std::string::npos;
}

int main() {
    LMX_func_api_Init();
    emitEvent("ready");

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        // The manager controls the exact wire format ({"cmd":"..."}); match the
        // command token. Check record-start/stop before the shorter substrings.
        if      (has(line, "\"record-start\"")) doRecordStart();
        else if (has(line, "\"record-stop\""))  doRecordStop();
        else if (has(line, "\"connect\""))      doConnect();
        else if (has(line, "\"disconnect\""))   doDisconnect();
        else if (has(line, "\"status\""))       doStatus();
        else emitError("Unknown command");
    }

    doDisconnect();
    LMX_func_api_Close_Device(nullptr);
    return 0;
}
