# Remote Button (device-filtered input trigger) — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design), implementing mock-first
**Feature:** Let a specific input device's left-click (e.g. the non-customizable "cursor"
button on a Lenovo BLE presentation remote, which emits a plain left-click) trigger a
chosen Promptly command — without the regular mouse triggering it.

## Problem

The remote's 3rd button emits a standard **left-click** (plus air-mouse movement). DOM mouse
events carry no device identity, so the renderer can't tell the remote's click from the real
mouse's. Windows' **Raw Input API** (`WM_INPUT`) tags each event with the source device, so a
native helper CAN filter by device. The device id is per-physical-unit (BLE address / HID path),
so rather than hardcode an id we let each install **learn** its remote.

## Decisions (locked)

- **Mechanism:** native Raw Input helper (message-only window, `RegisterRawInputDevices` with
  `RIDEV_INPUTSINK` so it works unfocused) reports the source device of left-down events.
- **Binding:** a "Bind" flow captures the next left-click's device and stores it per-install —
  portable across machines/remotes, no hardware IDs to look up.
- **Mapping:** user picks the fired command from a dropdown (default Play/Pause).
- **Tradeoff accepted:** the click still also lands normally (no per-device suppression without
  a kernel driver). Operator keeps the cursor parked.

## Architecture

```
remote left-click ─Raw Input(WM_INPUT)→ promptly-input-bridge.exe ─stdio JSON→ electron-main
   (bound device)                                                                    │
                                                          'remote-input-trigger' IPC ▼
                                            renderer dispatches the configured command
                                            through the existing remote-command handler
```

Mirrors the camera bridge: a supervised child process speaking line-delimited JSON over stdio,
with a Node mock implementing the identical protocol for hardware-free testing.

## stdio protocol

```
Electron -> helper:  {"cmd":"set-device","id":"<devicePath>"}   // filter to this device
                     {"cmd":"bind"}                              // capture next click's device
                     {"cmd":"clear"}                             // stop watching
helper -> Electron:  {"event":"ready"}
                     {"event":"bound","id":"<devicePath>"}       // bind captured a device (now active)
                     {"event":"trigger"}                         // bound device left-clicked
```

The helper owns the filter: in normal mode it emits `trigger` only for the bound device; in bind
mode the next left-down (any device) becomes the bound device and is reported via `bound`.

## Components

1. **`vendor/input-bridge/input-bridge.cpp`** (Phase 3) — Win32 Raw Input helper.
   **`mock-input-bridge.js`** (Phase 1) — Node mock: emits `ready`; on `bind` emits a fake
   `bound` id; on a test hook emits `trigger`; honors `set-device`/`clear`.
2. **`input-control.js`** — `InputBridgeManager`: spawn + watchdog (reuse the camera manager's
   shape), parse events, expose `setDevice(id) / bind() / clear()`, callbacks `onBound(id)` /
   `onTrigger()` / `onStatus`.
3. **`electron-main.js`** — spawn/supervise; IPC: `remote-input-bind`, `remote-input-set-device`,
   `remote-input-clear`; forward `remote-input-bound`(id) and `remote-input-trigger` to the renderer.
4. **`electron-preload.js`** — `window.electron.remoteInput.{ bind, setDevice, clear, onBound, onTrigger, onStatus }`.
5. **`src/App.js`** — Settings → Remote Button: Bind button (+ "bound / not bound" status), a
   command dropdown, persisted as `remoteButtonDeviceId` + `remoteButtonCommand` in appSettings.
   On load, push the saved device id to the helper. On `trigger`, dispatch `remoteButtonCommand`
   through the existing remote-command switch. On `bound`, save the device id.

## Command options (dropdown)

`play-pause` (default) · `next-chapter` · `prev-chapter` · `reset` · `speed-up` · `speed-down` ·
`camera-liveview-toggle` · `camera-record-toggle`. Values reuse existing remote-command names so
the trigger routes through the existing handler — no new command plumbing.

## Persistence & portability

`remoteButtonDeviceId` + `remoteButtonCommand` live in renderer `appSettings` (localStorage),
per-install. The device id is captured by Bind, so each machine learns its own remote — works
across all installs regardless of the remote's BLE address / HID path.

## Error handling

- Helper missing / fails to start → Remote Button UI shows "unavailable"; rest of app unaffected
  (same model as the camera bridge's startup-failure surfacing).
- Not yet bound → triggers never fire; UI shows "Not bound — click Bind and press your remote."
- Bound device unplugged → triggers simply stop; rebinding re-learns it.

## Testing

- Mock helper exercises the full Promptly path (bind → bound → save; trigger → command) with no
  hardware. Manager unit-tested with an injected fake spawn (like camera-control.test.js).
- Real helper verified on hardware: Bind the remote, confirm only its click triggers, real mouse ignored.

## Build order (mock-first)

1. Protocol + mock helper + `InputBridgeManager` + IPC + preload (+ unit test).
2. Settings UI: Bind flow + command dropdown + persistence; trigger → command dispatch.
3. Native C++ Raw Input helper implementing the identical protocol; swap in.

## Out of scope (YAGNI)

- Suppressing the normal left-click (needs a kernel filter driver).
- Multiple bound devices / multiple remote buttons (one trigger → one command for now).
- Mapping the two already-customizable buttons (those emit keystrokes → use existing shortcuts).
