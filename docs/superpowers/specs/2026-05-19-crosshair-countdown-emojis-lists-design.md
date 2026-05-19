# Crosshair Sizing, Delayed Start, Emoji Expansion, List Formatting

**Date:** 2026-05-19
**Status:** Approved, ready for implementation
**Scope:** `src/App.js`, `electron-preload.js`, `electron-main.js`, `electron-presenter.html`

## Goals

Five additions in one release so the user can also exercise the new in-app auto-updater:

1. Adjustable crosshair length and thickness in addition to existing color control.
2. Optional countdown before playback starts. Visible on both operator preview and presenter window. Default off.
3. Larger emoji set, especially presenter-cue glyphs (eyes, smiles, hands) and direction/status markers.
4. Click-outside actually closes the color and emoji pickers cleanly.
5. Bullet and numbered-list buttons in the rich-text toolbar.

## Non-goals

- No per-script countdown override.
- No spoken "go" or audio cue on countdown end.
- No custom emoji upload.
- No persistence of which emoji category was last open.
- No "smart" list features beyond what `execCommand('insertUnorderedList')` / `insertOrderedList` provide.
- No backward-compat handling for older script files that don't have the new fields — state defaults cover them.

## Design

### A. Crosshair length and thickness

State (`src/App.js`):

```js
const [crosshairLength, setCrosshairLength] = useState(32);     // px, current matches w-8/h-8
const [crosshairThickness, setCrosshairThickness] = useState(1); // px
```

UI: two range sliders inside the Settings panel directly below the existing Crosshair Color picker. Length 10–200 (step 1), Thickness 1–10 (step 1). Display the current value next to each.

Render changes:

- Operator preview (`src/App.js` around line 4063): replace the static `w-8 h-px` / `h-8 w-px` classes with inline `style={{ width: `${crosshairLength}px`, height: `${crosshairThickness}px` }}` for the horizontal bar and the mirror for the vertical.
- Fullscreen view (similar block — search for the other `crosshair` JSX): same change.
- Presenter window (`electron-presenter.html`): existing `#crosshair-h` / `#crosshair-v` divs already have JS that updates their color; extend to also update width/height. Source values from the IPC payload.

IPC payload extension: `updatePresenterContent()` already builds a data object; add `crosshairLength` and `crosshairThickness` to it. Presenter HTML reads them from `data.crosshairLength` / `data.crosshairThickness` and applies via inline style.

### B. Delayed start (countdown)

State:

```js
const [countdownDuration, setCountdownDuration] = useState(0); // seconds; 0 = off
const [countdownValue, setCountdownValue] = useState(null);    // null when not counting; current number otherwise
const countdownIntervalRef = useRef(null);
```

Settings panel: a numeric input under the existing Speed/Timer settings, label "Delayed start (seconds)", range 0–10, default 0.

Behavior:

- New helper `cancelCountdown()`: clears the interval, sets `countdownValue` to null, broadcasts null to the presenter.
- `togglePlayPause` modified: if currently counting → `cancelCountdown()` and treat as pause (the user wants to abort). Else if not playing AND `countdownDuration > 0` → start countdown instead of playing immediately. Else current behavior.
- Countdown start: `setCountdownValue(countdownDuration)`, broadcast initial value, then `setInterval` 1000ms. Each tick decrements. When the next value would be 0, we instead transition: clear interval, set `countdownValue` to null, broadcast null, then `setIsPlaying(true)`. Visible numbers are `N, N-1, ..., 1` then play.
- Reset Script handler: also calls `cancelCountdown()`.
- Effect cleanup on component unmount clears the interval.
- Effect that responds to presenter window closing: also cancels countdown.

IPC: new channel `presenter-countdown-update`. The renderer sends the current countdown number (or null) via `window.electron.updatePresenterCountdown(value)`. The presenter HTML renders a centered `#countdown-overlay` div that becomes visible when the value is non-null, hidden when null. Style: large number (~25% of presenter height via `vh`), semi-transparent white text, subtle text-shadow for legibility on any background.

Operator preview: same overlay rendered inside `renderOperatorPreview` when `countdownValue !== null`, scaled to the preview's height. Uses the existing scaled-preview wrapper so it sits above the script content but below any mode-pill stack.

### C. Expanded emoji set

Append (deduplicating against existing entries) to the `commonEmojis` array:

- **Eyes & faces (presenter cues)**: `👀` `👁️` `😄` `😁` `😀` `😍` `😘` `😉` `🙂` `🥰` `🤩` `🥺` `😱` `🤯` `🤐` `🤫` `🤣` `😂` `🤔`
- **Hands & gestures**: `✋` `🙌` `🙏` `🤲` `💪` `✊` `👊` `✌️` `🤝`
- **Status & cues**: `🚀` `💯` `🎉` `🌟` `📌`
- **Directional supplements**: `↩️` `↪️` `🔼` `🔽`

Final order in the array: keep the existing groupings; new additions appended at the end as a "Presenter cues" cluster.

### D. Click-outside picker fix

Current bug: `handleClickOutside` treats *any* element with class `.picker-button` as "inside" the picker. That means clicking a different picker's button doesn't close the currently-open picker — both end up open at once. Clicking the same picker's button to close it ALSO requires onMouseDown to fire and toggle state, which depends on event order.

Fix: drop the `picker-button` guard. The only "inside" check is the picker panels themselves (`.color-picker-panel`, `.emoji-picker-panel`, `.speed-picker-panel`).

After fix:
- Click on the picker's own trigger button while open: handleClickOutside closes it. The button's onMouseDown ALSO tries to toggle — since state is being batched to null by handleClickOutside, and the button toggle sees the pre-batch value (still chapter.id), the button computes `chapter.id === chapter.id ? null : chapter.id` = null too. Both converge on null. Closed correctly.
- Click on a different picker's trigger button: handleClickOutside closes everything; the other button's onMouseDown opens its own picker. End state: only the new one is open.
- Click anywhere else: handleClickOutside closes everything.

### E. Bullet and numbered lists

`src/App.js`:

- Add `ListOrdered` (and reuse already-imported `List`) to handle the toolbar buttons.
- Two new toolbar buttons after the Underline button (before the existing color/emoji divider). Each calls `applyFormatting(chapter.id, 'unorderedList' | 'orderedList')`.
- `applyFormatting` switch gets two new cases:
  ```js
  case 'unorderedList':
    document.execCommand('insertUnorderedList', false, null);
    break;
  case 'orderedList':
    document.execCommand('insertOrderedList', false, null);
    break;
  ```
- Active state tracking: extend wherever `queryCommandState` is checked (look for the existing Bold/Italic active-format detection) to also include `insertUnorderedList` and `insertOrderedList`.
- Editor CSS: in the ContentEditable's wrapper styles, ensure `ul { list-style: disc; padding-left: 1.5em; }` and `ol { list-style: decimal; padding-left: 1.5em; }` so bullets/numbers actually render. CRA's normalize/Tailwind preflight strips these by default.
- Presenter window: lists go through as `<ul>` / `<ol>` HTML, which the browser renders natively. Add the same CSS rules in `electron-presenter.html` and the operator preview's `PrompterContent` styles so the output looks consistent.

## Files touched

- `src/App.js` — state, settings UI, toolbar buttons, countdown overlay, picker fix, emoji additions, applyFormatting cases, queryCommandState polling, list CSS in PrompterContent.
- `electron-preload.js` — `updatePresenterCountdown(value)` + `onPresenterCountdownUpdate(cb)`.
- `electron-main.js` — IPC forwarder for `presenter-countdown-update`.
- `electron-presenter.html` — countdown overlay div + JS handler, crosshair size/thickness handling, list CSS.

## Testing

Manual:

1. **Crosshair sliders** — open Settings, drag Length to 100 → both operator preview and presenter show longer arms. Drag Thickness to 5 → arms are 5px thick. Reset to defaults via 32/1; matches v1.0.179 look.
2. **Countdown off (default)** — Settings shows 0; pressing Play starts immediately.
3. **Countdown on** — set to 3, press Play → operator and presenter both show "3", "2", "1", then play. Pressing Play mid-countdown cancels and stays paused.
4. **Countdown reset** — start countdown, press Home → countdown cancels, scroll resets to top.
5. **Emoji panel** — open emoji picker → new emojis appear at the end. Click any to insert.
6. **Click outside** — open color picker → click in the editor → closes. Open emoji picker → click another picker's button → first closes, second opens. Open picker → click the same button → closes.
7. **Lists** — bullet button toggles a `<ul>` in the editor; numbered button toggles an `<ol>`. Bullets visible. Numbers visible. Both render in operator preview and presenter window.
8. **In-app update** — install 1.0.179, then publish 1.0.180. Existing app should pop the update toast within ~3s of next launch.

## Open questions

None.
