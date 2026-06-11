# Camera Control (Panasonic Lumix S5 II) — Design Spec

**Date:** 2026-06-10
**Status:** Approved (design), implementing mock-first
**Feature:** Trigger video record start/stop on a USB-tethered Panasonic Lumix DC-S5M2 from Promptly.

## Goal

Let a Promptly operator start and stop recording on a USB-connected Lumix S5 II from
within the app, so teleprompter operation and camera recording are driven from one place.

## Decisions (locked)

- **Control channel:** Panasonic LUMIX Tether SDK (DC SDK) over **USB tether** (`[PC(Tether)]`
  camera mode). The SDK explicitly lists `DC-S5M2/S5M2X` and documents "Video recording
  start / stop". USB tether disables the camera's own Wi-Fi/Bluetooth — this does NOT affect
  Promptly's mobile remote (which runs over the PC's network).
- **Trigger model:** a manual REC toggle, plus an optional "Link recording to playback"
  setting. Manual toggle must also be reachable from the mobile remote.
- **Surfaces:** main control window, mobile web remote, and the Logi plugin / keyboard.
- **Architecture:** standalone native **bridge executable** speaking line-delimited JSON over
  stdio, spawned + supervised by Electron — mirroring the existing `cloudflared` subprocess
  pattern (`vendor/` → `extraResources` → stdio).

## Why a bridge process (not a Node native addon)

- Decoupled from Electron's native ABI — survives Electron upgrades without rebuilds.
- Crash isolation: a camera-SDK fault cannot take down Promptly; a watchdog respawns the bridge.
- Reuses infrastructure Promptly already has (cloudflared supervision, `extraResources` packaging).
- The DC SDK is a C++ class API, so a C++ host is the natural fit and the SDK samples are C++.

## Components

1. **Camera bridge** (`vendor/camera-bridge/`)
   - **Phase 1 (now):** `mock-bridge.js` — a Node.js mock implementing the full stdio protocol
     with a fake camera, so the entire Promptly side is testable today with no SDK and no
     hardware and no C++ toolchain.
   - **Phase 3 (after SDK arrives):** `promptly-camera-bridge.exe` — C++ host linking the DC SDK,
     implementing the *identical* stdio protocol. Swapping mock → real changes nothing above it.

2. **Camera manager** — `camera-control.js`, required by `electron-main.js`.
   - Spawns + supervises the bridge (respawn-with-backoff watchdog, like cloudflared).
   - Translates Electron IPC ↔ stdio JSON.
   - Holds authoritative state `{ available, connected, model, recording }`.
   - `spawn` is injected so the protocol/state logic is unit-testable without Electron.

3. **Preload** — `window.electron.camera.{ connect, recordStart, recordStop, toggle, getStatus, onStatus }`.

4. **React UI** (`src/App.js`)
   - REC toggle in the control bar (idle: `○ REC`; recording: red `● REC`).
   - Camera settings section: enable, "Link recording to playback" toggle, and live status
     (`Unavailable` / `Disconnected` / `Connected: DC-S5M2` / `● Recording`).

5. **Mobile remote** (served HTML in `electron-main.js`)
   - REC button; `camera-record-toggle` via the existing `/command` POST; recording state in `/state`.

6. **Logi plugin / WebSocket**
   - `camera-record-toggle` added to the command path; `isRecording` added to `latestPluginState`.

## stdio Protocol (line-delimited JSON)

**Electron → bridge (commands):**
```
{"cmd":"connect"}
{"cmd":"record-start"}
{"cmd":"record-stop"}
{"cmd":"status"}
{"cmd":"disconnect"}
```

**Bridge → Electron (events):**
```
{"event":"ready"}                         // bridge started, SDK loaded
{"event":"connected","model":"DC-S5M2"}   // camera attached over USB
{"event":"disconnected"}                  // camera gone / unplugged
{"event":"recording","value":true}        // confirmed record state (true/false)
{"event":"error","message":"..."}         // command failed; state unchanged
```

State is only advanced by **confirmed** events from the bridge — the UI never shows `● REC`
unless the bridge reported `recording:true`.

## Data flow (one toggle)

`any surface → remote-command / IPC → camera manager → stdio "record-start" → bridge → SDK → camera`.
Bridge replies `recording{true}` → manager updates state → fans out to **all** surfaces (main UI,
mobile `/state`, Logi `state`) so they stay in sync — same fan-out used by `plugin-state-push`.

## Link-to-playback

When enabled, the existing play/pause path also fires record-start/stop; script reset/finish
forces record-stop. Off by default. The manual REC button always works regardless of this setting.

## Error handling (truthful state)

- No bridge / SDK absent → status `Unavailable`, controls disabled, **rest of app unaffected**.
- Camera off / USB unplugged → `Disconnected`, REC disabled.
- Record command fails → error toast; state stays truthful (no fake `● REC`).
- Bridge process crash → watchdog respawns with backoff.

## Packaging & licensing

- Bridge + SDK DLL live in `vendor/camera-bridge/`, shipped via `extraResources` (like cloudflared).
- **Open question for user:** does the DC SDK license permit redistributing the runtime DLL inside
  an end-user installer? If yes → bundle it. If no → DLL is gitignored and dropped in locally;
  installer ships without it and the feature reports `Unavailable` until present.

## Testing

- Bridge protocol/state machine: unit-tested via the camera manager with an injected fake `spawn`.
- Mock bridge: lets the full chain (IPC → manager → UI/mobile/Logi) be exercised without hardware.
- Manual verification with the real S5 II once the SDK + `.exe` are in place.

## Build order (SDK never blocks us)

1. **Phase 1:** Node mock bridge + stdio protocol + camera manager + IPC + preload (+ unit tests).
2. **Phase 2:** Promptly integration against the mock — REC button, settings, mobile remote, Logi.
3. **Phase 3:** C++ real bridge implementing the identical protocol; swap in once SDK + camera arrive.

## Out of scope (YAGNI)

- Multiple simultaneous cameras.
- Stills capture, focus/zoom/exposure control, live-view passthrough.
- Wi-Fi / `cam.cgi` channel (USB-only for now).
