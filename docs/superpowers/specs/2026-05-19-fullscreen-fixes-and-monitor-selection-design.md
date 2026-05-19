# Fullscreen Fixes and Monitor Selection

**Date:** 2026-05-19
**Status:** Approved, ready for implementation
**Scope:** `src/App.js`, `electron-main.js`, `electron-preload.js`

## Problem

Four issues with the presenter window's fullscreen handling and operator-view feedback:

1. **Toast doesn't render when presenter is closed.** The "presenter window required" toast added in v1.0.176 lives inside `renderOperatorPreview()`, which short-circuits to a placeholder when no presenter window is open. The toast can never show in the scenario it was designed for.
2. **Full Screen toolbar button gets stuck on.** Clicking "Full Screen" enters fullscreen, but clicking again often doesn't exit. The `toggle-presenter-fullscreen` IPC handler reads `presenterWindow.isFullScreen()` to decide direction; on Windows this value can disagree with the visible state, which leaves the toggle stuck.
3. **Manual "Exit Fullscreen" doesn't restore pre-fullscreen window size.** The `enter-full-screen` event handler in `electron-main.js` saves `presenterWindow.getBounds()` into `presenterBeforeFullscreenBounds` — but the event fires *after* fullscreen has applied, so the captured bounds are the fullscreen bounds. When leave-full-screen runs, it "restores" the window to fullscreen-size.
4. **No way to choose which monitor the presenter fullscreens to.** Multi-monitor setups always fullscreen on whichever monitor the presenter window currently sits on.

## Goals

- The "open the presenter first" toast appears regardless of presenter state.
- Clicking the Full Screen button always toggles fullscreen direction reliably.
- Exiting fullscreen — via the toolbar, via F11, or via the presenter window's own Exit Fullscreen button — restores the window to its pre-fullscreen size and position.
- The operator can pick which monitor the presenter fullscreens to from a dropdown in the operator toolbar. Choice persists across sessions.
- If the chosen monitor is no longer connected, fullscreen happens on the current monitor without error.

## Non-goals

- No change to which monitor the presenter window *initially opens* on. Only the fullscreen target.
- No per-monitor saved window bounds. A single set of bounds remains.
- No "open on multiple monitors" or window-spanning support.
- No change to the presenter window's own Exit Fullscreen button beyond its bounds-restoration behavior (it already calls `exit-presenter-fullscreen` IPC, which is correct).

## Design

### A. Toast renders in both presenter-open and presenter-closed states

Move the toast pill out of `renderOperatorPreview()` and into the parent container that wraps the preview at `src/App.js:5097` (`<div className="flex-1 relative overflow-hidden bg-gray-700">`).

- The SCROLL MODE and SPOTLIGHT MODE pills stay inside `renderOperatorPreview()` — those modes can only activate when the presenter window is open (guards in `toggleManualScroll` / `toggleSpotlight`), so their pills only ever need to render in the open-presenter branch.
- The toast container becomes its own absolute-positioned div at the top of the parent wrapper, so it floats over both the placeholder "Presenter window not open" view and the live preview view.

### B. Authoritative fullscreen toggle from renderer

Renderer is the source of truth for fullscreen state (`presenterFullscreen` React state, updated by the `presenter-fullscreen-changed` IPC event). Pass the desired state down with the toggle call rather than asking the main process to compute direction.

**`electron-preload.js`:**

```js
togglePresenterFullscreen: (desiredState) => {
  ipcRenderer.send('toggle-presenter-fullscreen', desiredState);
},
```

The argument is optional for backward-compat; if undefined, main falls back to the existing behavior.

**`electron-main.js`** — `toggle-presenter-fullscreen` IPC:

```js
ipcMain.on('toggle-presenter-fullscreen', (event, desiredState) => {
  if (!presenterWindow || presenterWindow.isDestroyed()) return;

  const target = (typeof desiredState === 'boolean')
    ? desiredState
    : !presenterWindow.isFullScreen();

  if (target) {
    presenterBeforeFullscreenBounds = presenterWindow.getBounds();
    moveToTargetDisplayIfNeeded();          // new — see section D
  }
  presenterWindow.setFullScreen(target);
  // notification handled by enter/leave-full-screen event handlers
});
```

**`src/App.js`** — the Full Screen toolbar button onClick passes `!presenterFullscreen`:

```js
onClick={() => window.electron?.togglePresenterFullscreen(!presenterFullscreen)}
```

### C. Correct pre-fullscreen bounds capture

- **Remove** the `presenterBeforeFullscreenBounds = presenterWindow.getBounds()` line inside the `enter-full-screen` event handler in `electron-main.js`. That capture is the source of bug 3.
- Bounds are captured in two correct places:
  - The toggle-fullscreen IPC handler (before calling `setFullScreen(true)`).
  - The existing resize/move debounced `saveBounds()` continuously updates `presenterWindowBounds` whenever the window is not fullscreen.
- The `leave-full-screen` handler restores in this priority order:
  1. `presenterBeforeFullscreenBounds` if set (toolbar entry path).
  2. `presenterWindowBounds` if set (F11/system-shortcut path, falls back to last-known non-fullscreen bounds).
- After restore, clear `presenterBeforeFullscreenBounds`.

### D. Monitor selection

#### Main process (`electron-main.js`)

- Add module-level `let presenterTargetDisplayId = null`.
- Extend `loadWindowBounds()` / `saveWindowBounds()` to also persist `presenterTargetDisplayId` in the same `window-state.json` (key `presenterTargetDisplayId`).
- New helper `moveToTargetDisplayIfNeeded()`:
  - If `presenterTargetDisplayId == null` → no-op.
  - Otherwise look up the display via `screen.getAllDisplays().find(d => d.id === presenterTargetDisplayId)`.
  - If not found → no-op (fall back to current monitor per design choice).
  - If found → `presenterWindow.setBounds(display.workArea)` so it's on the target display before fullscreen.
- New IPC `get-displays` (synchronous-style via `ipcMain.handle`):
  - Returns `screen.getAllDisplays().map(d => ({ id: d.id, label: d.label, bounds: d.bounds, workArea: d.workArea, size: d.size, scaleFactor: d.scaleFactor, primary: d.id === screen.getPrimaryDisplay().id }))`.
- New IPC `set-presenter-display` (`ipcMain.on`):
  - Receives an id (number) or `null` for "auto / current monitor".
  - Sets `presenterTargetDisplayId` and persists to `window-state.json`.
- Subscribe to `screen` events `display-added`, `display-removed`, `display-metrics-changed`. On each, send `displays-changed` to `mainWindow`.

#### Preload (`electron-preload.js`)

```js
getDisplays: () => ipcRenderer.invoke('get-displays'),
setPresenterDisplay: (id) => ipcRenderer.send('set-presenter-display', id),
onDisplaysChanged: (cb) => {
  const sub = () => cb();
  ipcRenderer.on('displays-changed', sub);
  return () => ipcRenderer.removeListener('displays-changed', sub);
},
getPresenterDisplay: () => ipcRenderer.invoke('get-presenter-display'),
```

Also expose `getPresenterDisplay()` so the renderer can hydrate the chosen value on mount from the persisted state.

In `electron-main.js`:

```js
ipcMain.handle('get-presenter-display', () => presenterTargetDisplayId);
```

#### Renderer (`src/App.js`)

State near other presenter-related state:

```js
const [displays, setDisplays] = useState([]);
const [presenterDisplayId, setPresenterDisplayId] = useState(null); // null = "current monitor"
const [showDisplayDropdown, setShowDisplayDropdown] = useState(false);
```

Effect (on mount):

```js
useEffect(() => {
  if (!window.electron?.getDisplays) return;
  const refresh = async () => {
    const [list, current] = await Promise.all([
      window.electron.getDisplays(),
      window.electron.getPresenterDisplay()
    ]);
    setDisplays(list);
    setPresenterDisplayId(current);
  };
  refresh();
  const unsubscribe = window.electron.onDisplaysChanged(refresh);
  return unsubscribe;
}, []);
```

Dropdown UI inserted **between** the "Open Presenter Window" button and the Full Screen button in the operator toolbar (`src/App.js` around line 5077-5108):

- Renders only when `displays.length > 1`.
- Trigger button shows the currently-selected display's label, or "Auto (current)" if none selected.
- Click toggles `showDisplayDropdown`.
- Popup is positioned absolutely below the button (same pattern as the existing Chapters dropdown).
- Each option calls `setPresenterDisplay(id)` (or `null` for Auto), updates local state, and closes the popup.
- Label format: `Monitor {1-based-index} ({width}×{height})` plus `" — Primary"` for the primary display. If `display.label` is non-empty (rare on Windows), prepend it: `"DISPLAY1 — Monitor 1 (1920×1080)"`.

Special "Auto" entry at the top: `"Auto (current monitor)"`. Selected when `presenterDisplayId === null`.

#### Click-outside handling

Reuse the existing pattern: extend the existing `handleClickOutside` `useEffect` (`src/App.js:1929`) to also close `showDisplayDropdown` when clicking outside.

### Files touched

- `electron-main.js` — IPC handlers, `moveToTargetDisplayIfNeeded`, persistence, screen event subscriptions, enter/leave-full-screen fix.
- `electron-preload.js` — new exposed methods.
- `src/App.js` — toast lifting, fullscreen onClick, displays state/effect, dropdown UI, click-outside handling.

### Out of scope

- Detecting and recovering from monitor reassignment (where IDs change between reboots). With "fall back to current" behavior, a stale id is benign — user re-picks once.
- Smooth fade between displays when fullscreening to a different monitor — the move-then-fullscreen sequence will flash on the originating monitor briefly. Acceptable.

## Testing

Manual checks (since this is UI + Electron-window behavior, no unit-test surface):

1. With presenter closed, click the new ↕ or Crosshair toolbar button → toast appears at top of the dark-gray operator panel.
2. Open presenter, click Full Screen → window goes fullscreen, button shows ✓.
3. Click Full Screen again → window exits fullscreen, restored to pre-fullscreen size/position. Button no longer shows ✓.
4. Open presenter, press F11 in the presenter → fullscreen on. Press F11 again → exits to pre-F11 size.
5. Click the Exit Fullscreen button rendered inside the presenter window → exits to pre-fullscreen size.
6. With multiple monitors connected: dropdown appears next to Full Screen. Select Monitor 2 → click Full Screen → presenter goes fullscreen on Monitor 2. Click Full Screen again → exits to original (Monitor 1) bounds.
7. Disconnect Monitor 2 while it's the selected target → click Full Screen → fullscreens on current monitor without error. Dropdown shows the missing one removed.

## Open questions

None.
