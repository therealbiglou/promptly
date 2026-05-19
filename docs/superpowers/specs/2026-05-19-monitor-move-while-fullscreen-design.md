# Move Presenter Between Monitors While Fullscreen

**Date:** 2026-05-19
**Status:** Approved, ready for implementation
**Scope:** `electron-main.js` only

## Problem

In v1.0.177, picking a different monitor from the operator dropdown only takes effect on the *next* fullscreen entry. If the presenter is already fullscreen on Monitor 1 and the user picks Monitor 2 from the dropdown, nothing happens until they manually toggle fullscreen off and back on.

## Goal

Selecting a different monitor while the presenter is already fullscreen moves the fullscreen presenter to that monitor immediately, without requiring the user to toggle fullscreen off and on.

## Non-goals

- No change to behavior when presenter is not fullscreen — the dropdown selection just updates the saved target and waits for the next fullscreen entry, as today.
- No attempt to eliminate the brief sub-second flicker. Windows real-fullscreen can't be moved across displays without exiting fullscreen first; the standard pattern is exit → move → re-enter. The flicker is acceptable.
- No persistence change. The saved `presenterTargetDisplayId` mechanics are unchanged.

## Design

### Move-while-fullscreen flow

When `set-presenter-display` IPC fires and the presenter is currently fullscreen with the target display still connected:

1. Compute `nextWindowBounds` — the size/position the window should have after the user later exits fullscreen. Width and height come from `presenterBeforeFullscreenBounds` (or fall back to `presenterWindowBounds`). The window is centered horizontally and vertically in the target display's `workArea`, clamped so it doesn't extend past the work area.
2. Set `suppressFullscreenNotification = true`.
3. `presenterWindow.setFullScreen(false)`.
4. After 50 ms: `presenterWindow.setBounds(nextWindowBounds)` and update `presenterBeforeFullscreenBounds = nextWindowBounds` so the next leave-fullscreen restores to the right place on the new monitor.
5. After another 50 ms: `presenterWindow.setFullScreen(true)`.
6. After another 50 ms: `suppressFullscreenNotification = false`.

### Suppressing fullscreen notifications during the dance

The `enter-full-screen` and `leave-full-screen` event handlers in `electron-main.js` send `presenter-fullscreen-changed` IPC events to both the presenter window and the main window. During the dance the renderer's `presenterFullscreen` state would briefly toggle to `false` and back to `true`, causing the Full Screen button to flash and possibly confusing future state.

Gate the notification sends inside both handlers with `if (!suppressFullscreenNotification)`. The bounds-restoration logic in `leave-full-screen` should also be skipped while suppressed (we set bounds explicitly in step 4, and we don't want the handler's fallback to `presenterWindowBounds` to clobber our explicit `setBounds`).

### Skip condition

If any of these are true, skip the dance and just persist the new id (current behavior):

- Presenter window doesn't exist or is destroyed.
- Presenter is not fullscreen.
- Target id is `null` (Auto / current monitor).
- Target display id is not found in `screen.getAllDisplays()`.

### Files touched

- `electron-main.js` only.

## Testing

Manual:

1. Open presenter on Monitor 1, click Full Screen → fullscreens on Monitor 1.
2. From the dropdown, pick Monitor 2 → window flickers briefly, then is fullscreen on Monitor 2. The Full Screen button stays in its "Full Screen ✓" state throughout (no flash).
3. Click Full Screen again to exit → window restores to a windowed-sized presenter centered on Monitor 2.
4. From dropdown pick Monitor 3 (while not fullscreen) → no movement; just persists. Next fullscreen toggle lands on Monitor 3.
5. Pick a display, then unplug that monitor, then pick a still-connected monitor while fullscreen → moves to that monitor.
6. With only one display: dropdown is hidden (existing behavior), so this code path is unreachable.

## Open questions

None.
