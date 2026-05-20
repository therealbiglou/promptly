# Promptly Logi Plugin

A Logi Plugin Service plugin that lets the Logitech MX Creative Console
(Keypad + Dial Pad) control Promptly: playback, navigation, modes, and a
shuttle-style speed control that crosses zero into reverse.

## Requirements

- **Windows** (the Logi Actions SDK's JS path is Windows-only as of v0.1.1).
- **Logi Options+** installed.
- **Node.js 22 or later** on your PATH.
- **Promptly v1.0.189 or later** — the WebSocket endpoint the plugin talks to
  was added in that release.

## First-time setup

From this folder:

```cmd
npm install
npm run build
npm run link
```

`npm run link` symlinks `dist/` into Logi Plugin Service's plugins folder and
registers the plugin. Within ~2 seconds Logi Options+ should pick it up and
expose 13 new "Promptly" actions in the action picker.

Open Logi Options+ → MX Creative Console profile → pick or create a
"Promptly" profile → drag actions onto buttons, the dial, and the roller.

## Actions

**Buttons** (CommandAction)
- Play / Pause
- Reset to Start
- Next Chapter
- Previous Chapter
- Open Presenter Window
- Toggle Fullscreen
- Toggle Manual Scroll
- Toggle Mouse Spotlight
- Toggle Delayed Start
- Cycle Timer Display (full → speed only → hidden)

**Dial / roller** (AdjustmentAction)
- Speed (Shuttle) — ±0.1x per detent, crosses zero into reverse. Press the
  dial to reset to 1.5x.
- Jog (Manual Scroll) — scrolls the script by 40 px per detent.

## How it works

The plugin opens a WebSocket to `ws://127.0.0.1:3001/plugin` on Promptly's
remote control server. Each action sends a JSON command frame. Promptly does
not need to have its remote server visibly "started" in the UI — the WebSocket
is hosted by the same Express server and is always listening once Promptly is
open. (If Promptly isn't running, the plugin reconnects every 1–10 s.)

If port 3001 is in use by something else, Promptly currently can't relocate;
the plugin hardcodes the same default.

## Updating

```cmd
git pull
npm install        # only if dependencies changed
npm run build
```

`npm run link` only needs to run once. Logi Plugin Service reloads the plugin
on rebuild.

## Uninstalling

```cmd
npm run unlink
```

## Limitations

The Logi Actions SDK v0.1.1 doesn't yet expose any API for pushing dynamic
images or text to LCD buttons. Each action ships with a static icon and label;
the buttons can't show live script names or chapter titles. We'll revisit when
the SDK grows that capability.
