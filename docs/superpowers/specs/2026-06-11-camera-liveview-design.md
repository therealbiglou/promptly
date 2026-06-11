# Camera Live View (framing check) — Design Spec

**Date:** 2026-06-11
**Status:** Approved (design), implementing mock-first
**Feature:** Toggle the presenter (teleprompter) window and operator preview to a live
camera feed of the tethered Lumix S5 II, so operator and talent can check framing before
recording/reading. Toggle exposed on operator panel, mobile remote, and Logi plugin.

## Goal

A "Live View" mode that swaps script → camera feed and back, fired from any control
surface, displayed on the presenter window and the operator preview.

## Decisions (locked)

- **Feed orientation:** match the teleprompter's existing horizontal/vertical flip, so the
  feed reads correctly through the same beam-splitter glass.
- **On Play:** starting playback auto-stops live view and shows the script (never read with
  the feed up). Live view is a pre-roll framing check.
- **Mobile remote:** toggle only — the phone fires the toggle but does NOT display the feed.
  (Feed shows on operator + presenter.)
- **Transport:** Node-served MJPEG over the existing Express server (see below).

## Why Node-served MJPEG

The feed is a continuous JPEG stream — too heavy for the JSON-over-stdio command channel.
Instead the bridge streams raw frames to Node over a localhost TCP socket, and Node re-serves
them as `multipart/x-mixed-replace` MJPEG on the Express server already running on port 3001.
Browsers/Electron render MJPEG natively in an `<img>` (zero decode code), and Express handles
the two concurrent viewers (operator + presenter) trivially — which is why serving stays in
Node rather than the C++ bridge.

```
bridge live-view thread ──length-prefixed JPEG──▶ localhost TCP (frame server)
   LMX_func_api_Get_LiveView_data                       │
                                                        ▼
                                   Node keeps latest frame ──▶ Express GET /liveview (MJPEG)
                                                        │
                          ┌─────────────────────────────┴───────────────┐
                          ▼                                              ▼
              <img> in electron-presenter.html              <img> in operator preview (App.js)
```

## Protocol additions (same stdio channel)

```
Electron -> bridge:  {"cmd":"liveview-start","framePort":N}
                     {"cmd":"liveview-stop"}
bridge   -> Electron: {"event":"liveview","value":true|false}
```

Status object gains `liveview: boolean`. Frame wire format (bridge → Node TCP): repeated
[UINT32 big-endian length][JPEG bytes].

## Components

1. **Bridge** (`vendor/camera-bridge/bridge.cpp`)
   - Live-view worker thread: on start → `LMX_func_api_Ctrl_LiveView_Start()`, then loop
     `Get_LiveView_data()` → stream each JPEG to Node's frame port; on stop → `Ctrl_LiveView_Stop()`.
   - **All SDK calls serialized under one `std::mutex`** so the frame loop and record/connect
     commands can't corrupt the PTP session.
   - **Mock** (`mock-bridge.js`): on start, connect to framePort and stream a static
     "MOCK CAMERA" test-card JPEG (~15 fps) so the entire display path is testable with no
     hardware. A `mock-frame.jpg` asset ships alongside.

2. **Node** (`electron-main.js`)
   - Localhost TCP frame server (e.g. 127.0.0.1:3002): accepts the bridge's frame stream,
     parses length-prefixed JPEGs, stores `latestLiveFrame`, pushes to MJPEG clients.
   - Express route `GET /liveview` → `multipart/x-mixed-replace; boundary=frame`.
   - `camera-liveview-toggle` routed through existing `camera-*` handling; on: ensure frame
     server up, send `liveview-start{framePort}`; off: send `liveview-stop`.
   - Fan `liveview` state to operator (`camera-status`), presenter (`presenter-liveview-update`),
     and mobile (`/state`) + Logi (`latestPluginState.liveview`).

3. **Preload**: `window.electron.camera.{liveviewStart, liveviewStop, liveviewToggle}` +
   `liveview` already arrives via `onStatus`. Presenter: `onPresenterLiveviewUpdate`.

4. **Presenter** (`electron-presenter.html`): full-window `<img id="liveview-img">` shown when
   active (script hidden), hidden otherwise. Apply the same flip transform the text uses.

5. **Operator** (`src/App.js`): preview area shows the feed `<img>` when `cameraStatus.liveview`
   (mirrors presenter); a **LIVE toggle button** next to REC; a `useEffect` that calls
   `liveviewStop()` when `isPlaying` becomes true.

6. **Mobile remote** (served HTML): a LIVE toggle button firing `camera-liveview-toggle`
   (driven by `/state` camera.liveview); no feed.

7. **Logi**: `camera-liveview-toggle` routed (done by `camera-*` prefix) + `liveview` in
   `latestPluginState`. Loupedeck button is a later follow-up (like REC).

## Error handling & edges

- Live view requires `connected`; toggle disabled otherwise.
- Play force-stops live view and shows the script.
- Bridge crash / unplug → feed stops, `liveview=false`, `<img>` hidden, truthful status.
- Feed is a compressed monitoring preview (framing/focus), not a program/recording source;
  recording remains full-quality on the camera card.
- Record and live view are independent toggles and may both be active (USB supports live view
  during movie rec).

## Testing

- Mock streams a test card → verify operator + presenter display, toggle, auto-stop-on-play,
  flip — all without hardware.
- Frame TCP + MJPEG endpoint testable with a tiny standalone client.
- Real S5 II: confirm live frames once `Ctrl_LiveView_Start` runs against hardware.

## Build order (mock-first)

1. Protocol + Node frame server + `/liveview` MJPEG + mock test-card streaming.
2. Operator + presenter feed display + LIVE toggle + auto-stop-on-play.
3. Mobile + Logi toggle.
4. Real bridge live-view thread (swap in behind the identical protocol).

## Out of scope (YAGNI)

- Feed on the mobile remote (toggle only).
- Live-view histogram/level/posture overlays, focus peaking, zebras.
- Recording the preview stream (it's a monitor only).
- Loupedeck plugin-package button (tracked separately, with the REC button).
