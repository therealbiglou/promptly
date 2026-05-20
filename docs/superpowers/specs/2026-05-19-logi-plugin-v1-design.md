# Logi MX Creative Console Plugin (v1)

**Date:** 2026-05-19
**Status:** Approved, ready for implementation
**Scope:** New `logi-plugin/` subfolder + WebSocket endpoint + reverse-scroll support in Promptly

## Goal

A sideloadable Logi Plugin Service plugin that lets the MX Creative Console (Keypad + Dial Pad) control Promptly: playback, navigation, modes, and shuttle-style speed control with reverse.

## Constraints from the Logi Actions SDK v0.1.1

These shape the scope:

- Only two action shapes: `CommandAction` (`onKeyDown()`) and `AdjustmentAction` (`execute({tick: ±1})`).
- No API to push dynamic images/text to LCD buttons. Static SVG icons only.
- No key-up event — no long-press or hold gestures.
- Plugin doesn't know which physical button/dial an action is bound to; the user maps actions to controls in Logi Options+.
- Plugin runs as a child Node.js process under Logi Plugin Service (Windows only for the JS path).
- Sideload via `logitoolkit link` (creates a symlink from the plugin's `dist/` to the service's plugins folder).

## Actions exposed

**Command actions (buttons):**
1. `play-pause` — Play/Pause
2. `reset` — Reset to start
3. `next-chapter` — Next chapter
4. `prev-chapter` — Previous chapter
5. `open-presenter` — Open Presenter Window
6. `toggle-fullscreen` — Toggle fullscreen on the presenter
7. `toggle-manual-scroll` — Toggle Manual Scroll mode
8. `toggle-spotlight` — Toggle Mouse Spotlight
9. `toggle-countdown` — Toggle Delayed Start on/off
10. `cycle-timer` — Cycle Timer Display (full → speed → hidden)

**Adjustment actions (dial/roller):**
11. `speed-shuttle` — each tick adjusts current speed by ±0.1. Press = reset (1.5x). Range −10 to +10. Negative speeds scroll backward (reverse).
12. `jog` — each tick scrolls the script by ±N pixels (default 40px/tick). Press = no-op (or could reset to crosshair-at-current-chapter; out of scope).

Each action gets a static SVG icon under `package/actionicons/`. Names use kebab-case in the package YAML; display names are human-readable.

## Promptly changes

### Reverse-scroll support

- `scrollSpeed` range changes from `[0.1, 10]` to `[−10, 10]`. Zero means paused (current behavior: speed 0 is invalid; we keep "paused" distinct from "speed 0", but the dial can drive speed through zero and the UI just shows the value).
- Animation loop: signed speed → signed position delta. Already a multiplication; no special-casing needed.
- Position clamp: `scrollPosition = Math.max(0, position)`. At position 0 with negative speed, position stays at 0; user can keep turning the dial but nothing scrolls further. We don't auto-pause at 0.
- `hasReachedEnd`: only fires when speed ≥ 0 and we've reached the bottom. Negative speed never triggers it.
- Speed display: render `2.5x` for positive, `−2.5x` (or `◀ 2.5x`) for negative. Match in operator panel, presenter timer, and remote.
- Settings sliders: change min to `-10`. The keyboard speed adjustment min/max change accordingly.
- `togglePlayPause` semantics unchanged. If speed is negative and user presses Play, scroll backward. If they want to switch direction, they adjust speed directly via the dial or shortcut.
- The countdown's `setIsPlaying(true)` on completion still triggers playback at current speed (which may be negative).

### New IPC commands accepted by the WebSocket

Same command vocabulary as the existing HTTP `/command` endpoint, with two additions:

- `speed-adjust` — `value` is a tick count (integer, may be negative). Each tick = `value * 0.1`. Clamped to `[-10, 10]`.
- `set-speed` — `value` is an absolute speed. Used by the dial press → reset path.
- `jog` — `value` is a pixel delta (integer, may be negative). Scrolls the script by `value` pixels directly. Clamps position to `[0, maxScroll]`. Doesn't require manual-scroll mode.

`open-presenter` and `toggle-fullscreen` already exist as IPC handlers but aren't wired into the remote-command router; we add them.

### WebSocket endpoint

- Mounted on the existing Express server. The Express HTTP server is upgraded with the `ws` library; ws path is `/plugin`.
- On connect, server pushes one `{ type: 'state', ... }` snapshot. Subsequently, broadcasts a `state` message whenever current chapter, speed, isPlaying, or countdown state changes.
- Client → server message format:
  ```json
  { "type": "command", "name": "play-pause" }
  { "type": "command", "name": "speed-adjust", "value": 1 }
  { "type": "command", "name": "jog", "value": -40 }
  { "type": "command", "name": "set-speed", "value": 1.5 }
  ```
- Server tolerates unknown command names (logs and ignores).
- Disconnect/reconnect handling is the plugin's responsibility.
- `ws` is already a transitive dependency of `@logitech/plugin-sdk`; add as a direct dep in Promptly too.

## Plugin source structure

```
logi-plugin/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── index.ts                        ← entry. Constructs PluginSDK, registers actions, connects.
├── src/
│   ├── promptly-client.ts          ← WebSocket client w/ reconnect + state cache
│   └── actions/
│       ├── play-pause.ts
│       ├── reset.ts
│       ├── next-chapter.ts
│       ├── prev-chapter.ts
│       ├── open-presenter.ts
│       ├── toggle-fullscreen.ts
│       ├── toggle-manual-scroll.ts
│       ├── toggle-spotlight.ts
│       ├── toggle-countdown.ts
│       ├── cycle-timer.ts
│       ├── speed-shuttle.ts        ← AdjustmentAction; uses promptly-client to send 'speed-adjust' and 'set-speed'
│       └── jog.ts                  ← AdjustmentAction; sends 'jog' with pixel deltas per tick
├── package/
│   ├── metadata/
│   │   ├── LoupedeckPackage.yaml   ← plugin manifest
│   │   └── Icon256x256.png         ← marketplace tile (placeholder OK for sideload)
│   └── actionicons/                ← one SVG per action (24x24 viewBox, simple line art)
└── README.md                       ← setup instructions
```

`logi-plugin/dist/` is gitignored; built by `tsup`. The whole `logi-plugin/` folder is excluded from electron-builder's `files` so it doesn't get bundled into the installer.

### Promptly client (plugin side)

- Tries `ws://127.0.0.1:3001/plugin` on startup.
- Auto-reconnects with backoff (1s → 2s → 4s → max 10s).
- Caches latest state from server (currently unused; future use when SDK gains LCD API).
- Exposes `send(commandName, value?)` to action handlers.

### speed-shuttle action

```ts
export class SpeedShuttle extends AdjustmentAction {
  name = 'speed-shuttle';
  displayName = 'Speed (Shuttle)';
  description = 'Adjust scroll speed. Crosses zero into reverse. Press to reset to 1.5x.';
  hasReset = true;

  constructor(private client: PromptlyClient) { super(); }

  execute({ tick }: { tick: number }) {
    this.client.send('speed-adjust', tick); // server applies tick * 0.1 to current speed
  }

  // SDK calls the reset command (named `<name>-reset`) when the dial is pressed
  // and the action is bound to a dial. We register a corresponding CommandAction.
}
```

Quirk: the SDK's `AdjustmentAction` has a `hasReset` flag but the actual reset trigger requires registering a paired command. We'll wire that up per the SDK's `resetCommandName` getter.

### jog action

Same shape as speed-shuttle, just sends `'jog'` with `tick * 40` as the pixel delta.

## Setup workflow

Documented in `logi-plugin/README.md`:

1. Install Logi Options+ (already installed).
2. `cd logi-plugin && npm install`
3. `npm run build && npm run link`
4. Open Logi Options+ → MX Creative Console profile → drag "Promptly" actions onto buttons/dial/roller.
5. Make sure Promptly is running; the plugin auto-connects.

## Out of scope

- Dynamic LCD content. Wait for SDK API.
- Marketplace submission. Sideload only.
- Long-press / double-tap / modifier-held gestures.
- Macros (action chains).
- Non-default Promptly port (hardcoded 3001).
- Linux/Mac support (SDK JS path is Windows only).
- Connection status indicator inside Promptly UI. Plugin connect/disconnect is silent.
- Per-tick configurable amount for `jog` (40px is hardcoded). Easy to change later.

## Files touched

- `electron-main.js` — ws upgrade on the existing Express server, broadcast loop, route plugin commands through existing IPC.
- `src/App.js` — signed scrollSpeed support, signed display, animation clamp, command routing for `speed-adjust`/`set-speed`/`jog`/`open-presenter`/`toggle-fullscreen`.
- `package.json` — add `ws` to dependencies. Update `build.files` to exclude `logi-plugin/`.
- `.gitignore` — exclude `logi-plugin/dist/`, `logi-plugin/node_modules/`.
- New: `logi-plugin/` directory and contents.

## Testing

Manual:

1. Build Promptly, launch it.
2. From `logi-plugin/`, `npm install && npm run build && npm run link`.
3. Open Logi Options+, confirm "Promptly" appears under plugins, with the 12 actions listed.
4. Assign Play/Pause, Next Chapter, Prev Chapter to three Keypad buttons. Assign Speed Shuttle to the dial. Assign Jog to the roller.
5. Open a Promptly script. Press Keypad buttons — verify expected behavior.
6. Turn the dial — verify speed adjusts. Spin past zero — verify scroll reverses. Press dial — verify speed resets to 1.5x.
7. Spin the roller — verify the script scrolls in pixel increments without entering manual scroll mode.
8. Stop Promptly, watch the plugin's stderr for reconnect attempts. Restart Promptly, verify plugin reconnects.

## Open questions

None.
