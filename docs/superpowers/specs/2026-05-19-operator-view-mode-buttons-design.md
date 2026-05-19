# Operator View — Mode Buttons, Stacked Alerts, and Visual Polish

**Date:** 2026-05-19
**Status:** Approved, ready for implementation
**Scope:** `src/App.js` only

## Problem

Several gaps in the operator-side UX around the two cursor-based modes (Manual Scroll and Mouse Spotlight) and the operator preview:

1. Both modes can be toggled via keyboard (J / S) even when the presenter window is closed, where they have no useful effect, with no feedback to the user.
2. When both modes are active simultaneously, only the Manual Scroll indicator pill renders — the Spotlight pill is suppressed by a hard `!manualScrollMode` guard.
3. The two modes have no on-screen affordance. They're keyboard-only.
4. Mouse Spotlight shows a red circle on the presenter, but nothing on the operator's local preview — operators have no visual confirmation of where they're pointing.
5. The operator preview's chrome and the preview itself are both painted with `bgColor` (default `#000000`), so when the user has a black presenter background the boundary between the preview and the panel around it is invisible.
6. The operator preview toolbar uses a non-wrapping flex row. On narrow operator panels, buttons overflow off-screen.

## Goals

- A user who activates Manual Scroll or Mouse Spotlight without the presenter open is told why it didn't take effect.
- When both modes are active, both indicators are visible at the top of the operator preview.
- Both modes are discoverable as toolbar buttons (not just keyboard shortcuts).
- The operator sees the same red spotlight circle the presenter sees, in the correct on-screen position for the scaled preview.
- The preview's edges are visible against the panel chrome.
- The toolbar wraps to a second row when too narrow rather than overflowing.

## Non-goals

- No changes to keyboard shortcut bindings (J and S remain default).
- No changes to spotlight color, size, or behavior on the presenter side.
- No changes to `electron-main.js`, `electron-preload.js`, `electron-presenter.html`.
- No new IPC channels.
- No changes to user-configurable `bgColor` — only the operator panel chrome is hardcoded to a dark gray.

## Design

### 1. Shared toggle helpers

Extract two helpers near the existing toggle logic (currently inline in the keyboard handler around `src/App.js:1992-2007`):

```js
const toggleManualScroll = () => {
  if (!presenterWindow || presenterWindow.closed) {
    showPresenterRequiredToast();
    return;
  }
  setManualScrollMode(prev => {
    if (!prev) setIsPlaying(false);
    return !prev;
  });
};

const toggleSpotlight = () => {
  if (!presenterWindow || presenterWindow.closed) {
    showPresenterRequiredToast();
    return;
  }
  setSpotlightMode(prev => {
    const newMode = !prev;
    if (!newMode && window.electron?.updatePresenterSpotlight) {
      window.electron.updatePresenterSpotlight(null);
    }
    return newMode;
  });
};
```

Both the J/S keyboard handlers and the new toolbar buttons call these helpers. Single code path, single guard.

### 2. "Presenter required" toast

- New state: `presenterRequiredToast` (boolean) and a ref for the dismiss timeout.
- `showPresenterRequiredToast()`:
  - Clears any existing timeout.
  - Sets `presenterRequiredToast` to `true`.
  - Schedules a 3-second timeout to set it back to `false`.
- Cleared in the existing cleanup `useEffect` when the component unmounts.
- Rendered inside the operator preview area (alongside the existing mode pills) as a yellow/amber pill with a warning icon: **"⚠ Open the presenter window to use this mode"**.

### 3. Stacked mode indicator pills

Current (`src/App.js:3878-3888`):
- Manual scroll pill renders when `manualScrollMode`.
- Spotlight pill renders when `spotlightMode && !manualScrollMode`. ← the bug.

Fix:
- Drop the `!manualScrollMode` guard from the spotlight pill.
- Wrap both pills (and the new toast) in a vertically-stacked `flex flex-col items-center gap-1` container at `absolute top-2 left-1/2 -translate-x-1/2 z-20`.
- Stack order, top to bottom: presenter-required toast (if active), manual scroll pill, spotlight pill.

### 4. Toolbar buttons

Toolbar location: `src/App.js:4910` (`<div className="p-3 border-b border-gray-700 flex items-center gap-2">`).

Add `flex-wrap` to that container so it wraps cleanly:

```
className="p-3 border-b border-gray-700 flex flex-wrap items-center gap-2"
```

Replace the empty spacer `<div className="flex-1"></div>` with `ml-auto` on the "Open Presenter Window" button so right-alignment still works on a single line but wraps cleanly when narrow.

Insert two new buttons just after the chapter-list block (around `src/App.js:5001`), before the right-aligned Open Presenter button:

**Manual scroll button:**
- Icon: `ArrowUpDown` (16px) from lucide-react.
- Tooltip: when presenter is open, `"Manual scroll mode (J)"` (or `"Exit manual scroll mode (J)"` when on); when closed, `"Manual scroll mode — requires presenter window"`.
- Active state class: yellow filled (`bg-yellow-500 hover:bg-yellow-600 ring-2 ring-yellow-300 text-black`). Inactive: `bg-gray-700 hover:bg-gray-600`.

**Spotlight button:**
- Icon: `Crosshair` (16px) from lucide-react.
- Tooltip: when presenter is open, `"Mouse spotlight (S)"` (or `"Exit mouse spotlight (S)"` when on); when closed, `"Mouse spotlight — requires presenter window"`.
- Active state class: red filled (`bg-red-500 hover:bg-red-600 ring-2 ring-red-300 text-white`). Inactive: `bg-gray-700 hover:bg-gray-600`.

Both buttons are always enabled (clicking when presenter is closed triggers the toast — same as the keyboard shortcut path).

### 5. Operator-side red circle

Inside `renderOperatorPreview()` (around `src/App.js:3864-3925`):

- Add a `useRef` for the circle DOM node (declared outside `renderOperatorPreview` at component-top level, since `renderOperatorPreview` re-runs on each render and we want a stable ref).
- In `handleSpotlightMove`:
  - Continue computing `actualX`/`actualY` and dispatching to the presenter (unchanged).
  - Additionally, update the operator-side circle's `style.left` / `style.top` to the raw `x` / `y` inside the wrapper (no scale conversion needed — these coords are already in the scaled-preview's local space).
  - Toggle `display: 'block'` if previously hidden.
- In `handleSpotlightLeave`: hide the operator circle by setting `display: 'none'`.
- Render: a positioned `<div ref={operatorSpotlightRef}>` inside the preview wrapper (the same div that has the mousemove handler), at the same DOM layer as the existing wrapper's overlays. Initial state: `display: none`.

Circle dimensions on operator side:
- Diameter: `80 * previewScale` px so it visually matches what the presenter sees (the presenter's 80px diameter is in presenter-coordinate space; the operator preview is scaled by `previewScale`).
- Color: `rgba(239, 68, 68, 0.5)` (matches presenter).
- `border-radius: 50%`, `pointer-events: none`, `transform: translate(-50%, -50%)`, absolute-positioned, `z-index: 30` (above content, below mode pills).

The circle is only rendered when `spotlightMode` is true (mounted/unmounted with the mode).

### 6. Dark gray chrome

Replace `bgColor` with a hardcoded `bg-gray-700` (Tailwind `#374151`) in two places that paint the operator panel chrome:

- `src/App.js:5038`: change `<div className="flex-1 relative overflow-hidden" style={{ backgroundColor: bgColor }}>` → `<div className="flex-1 relative overflow-hidden bg-gray-700">`. Drop the inline style.
- `src/App.js:3866-3871` (the outer flex centering wrapper in `renderOperatorPreview`): change `backgroundColor: bgColor` in the inline style to `bg-gray-700` as a className. Keep the `cursor` inline style.

The inner scaled-preview wrapper at `src/App.js:3902-3912` keeps `backgroundColor: bgColor` — that one represents the actual presenter window content and should track the user's chosen background.

The "Presenter window not open" placeholder branch at `src/App.js:3817-3824` is unaffected (it doesn't paint a background and inherits from the new gray chrome — fine).

## Testing

This is a UI-only change with no test boundaries that map naturally to unit tests. Verify manually:

1. Open the app with presenter closed.
   - Press `J` → toast appears, fades after ~3s, manualScrollMode stays off.
   - Press `S` → same.
   - Click new ArrowUpDown button → same toast, state unchanged.
   - Click new Crosshair button → same toast, state unchanged.
2. Open presenter, press `J` → yellow "SCROLL MODE (J to exit)" pill appears, button shows yellow active state.
3. Without exiting scroll mode, press `S` → red "SPOTLIGHT MODE (S to exit)" pill appears stacked below the yellow one. Both buttons are active-colored.
4. Move mouse over preview while spotlight is on → red circle follows the cursor on the operator preview AND the presenter's red circle moves in sync.
5. Move mouse off the preview → both circles disappear.
6. Resize the operator panel narrower until toolbar would overflow → buttons wrap to a second row.
7. With a black `bgColor`, confirm the preview's top/bottom edges are visible against the gray chrome.

## Open questions

None.
