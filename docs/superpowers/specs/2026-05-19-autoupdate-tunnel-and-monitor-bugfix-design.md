# GitHub Auto-Update, Cloudflare Tunnel Remote, and Monitor-Switch Bugfix

**Date:** 2026-05-19
**Status:** Approved, ready for implementation
**Scope:** `electron-main.js`, `electron-preload.js`, `src/App.js`, `package.json`, new vendored binary

## Problems

1. **Monitor switch while fullscreen still doesn't work.** v1.0.178 added the move-while-fullscreen dance, but the entry gate uses `presenterWindow.isFullScreen()` — the same flaky Windows API I called out in v1.0.177. When it lies, the dance silently no-ops.
2. **No in-app auto-update.** The README claims auto-updates are wired but `electron-updater` is not a dependency and no code uses it. Users have to manually download new installers.
3. **Remote control requires same Wi-Fi.** The Express server binds to the LAN IP only. A phone on a separate network (e.g., guest Wi-Fi, cellular) can't reach the LAN URL.

## Goals

- Selecting a monitor while fullscreen reliably triggers the move dance.
- The app checks GitHub Releases at launch and every 4 hours; when a newer release is found, prompts the user to download/install via an in-app toast.
- The remote-control server is reachable from a phone on a different network via a Cloudflare quick-tunnel URL. The QR code defaults to that URL.

## Non-goals

- No persistent "skip this version" preference — dismissing the toast is in-session only.
- No reserved/stable cloudflared subdomain (requires a Cloudflare account; the trycloudflare.com URL changes per session).
- No release-channel separation (beta vs stable).
- No auto-installing updates without user consent — `autoDownload = false`.

## Design

### A. Fullscreen-state flag (bug fix)

Add a module-level `presenterIsFullscreen` boolean in `electron-main.js`. Single source of truth that the rest of the code reads instead of calling `presenterWindow.isFullScreen()`:

- `enter-full-screen` event handler: set to `true` (always, even when notification suppressed).
- `leave-full-screen` event handler: set to `false` (always).
- The `set-presenter-display` IPC handler uses this flag instead of `isFullScreen()`.
- The `toggle-presenter-fullscreen` IPC handler also uses this flag for the fallback path (when no `desiredState` arg).
- The move-while-fullscreen dance's `setFullScreen(false)` / `setFullScreen(true)` calls go through the event handlers, which keep the flag in sync, so no manual updates needed inside the dance.

### B. electron-updater wiring

**package.json:**
- Add `electron-updater` to `dependencies` (via `npm install --save`).
- Add to top-level `build`:
  ```json
  "publish": [{"provider": "github", "owner": "therealbiglou", "repo": "promptly"}]
  ```
- The repo currently is private. Auto-update only works against a public repo with this configuration (anonymous read of release assets and `latest.yml`). Making it public is a user prerequisite for the feature to actually function in production; the code ships either way.

**electron-main.js:**
- `const { autoUpdater } = require('electron-updater');`
- `setupAutoUpdater()` runs once on `whenReady()`, only in production (`!isDev`).
- Config: `autoDownload = false`, `autoInstallOnAppQuit = true`.
- Subscribes to `update-available`, `download-progress`, `update-downloaded`, `error`. The first three are forwarded to the main window via IPC events; `error` is logged silently to avoid noise on a still-private repo.
- Initial check 3s after launch, then every 4 hours via `setInterval`.
- Two new IPC handlers: `update-download` (calls `autoUpdater.downloadUpdate()`), `update-quit-and-install` (calls `autoUpdater.quitAndInstall()`).

**electron-preload.js:**
- `onUpdateAvailable(cb)`, `onUpdateProgress(cb)`, `onUpdateDownloaded(cb)` — event subscriptions returning unsubscribe functions.
- `downloadUpdate()`, `quitAndInstallUpdate()` — send the IPC events.

**src/App.js:**
- State: `updateInfo` (null or `{version, releaseNotes}`), `updateProgress` (null or 0–100), `updateDownloaded` (bool), `updateDismissed` (bool, session-only).
- Effect subscribes to all three preload events on mount, unsubs on unmount.
- Toast rendered at the bottom-right (`fixed bottom-4 right-4 z-50`) when `updateInfo && !updateDismissed`. Three states:
  1. **Available** — "Promptly X is available" + Download / Skip buttons. Download calls `downloadUpdate()`, sets `updateProgress = 0`.
  2. **Downloading** — progress bar driven by `updateProgress`.
  3. **Ready** — "Promptly X ready, restart to apply" + Restart now / Later buttons. Restart calls `quitAndInstallUpdate()`.

### C. Cloudflare Tunnel

**Binary distribution:**
- Vendored at `vendor/cloudflared/cloudflared.exe` (~51 MB, Windows AMD64 from the official Cloudflare GitHub releases). Apache 2.0 license; redistribution allowed.
- `.gitignore`'d. A `scripts/fetch-cloudflared.js` runs as `npm prebuild` and downloads it on demand if missing, so the repo stays clean but reproducible builds get the binary automatically.
- electron-builder picks it up via:
  ```json
  "extraResources": [{"from": "vendor/cloudflared", "to": "cloudflared"}]
  ```
  At runtime in production, it lives at `process.resourcesPath/cloudflared/cloudflared.exe`. In dev, `__dirname/vendor/cloudflared/cloudflared.exe`.

**Spawn behavior (electron-main.js):**
- `startRemoteServer()` continues to start Express on `0.0.0.0:3001` and immediately notifies the renderer via `remote-server-started` with `{ localUrl, tunnelUrl: null }`.
- After Express is listening, `startCloudflaredTunnel(port)` spawns the binary:
  ```
  cloudflared.exe tunnel --url http://localhost:3001 --no-autoupdate
  ```
- stdout and stderr are scanned for the URL pattern `https://[a-z0-9-]+\.trycloudflare\.com`. Cloudflared usually logs the URL via stderr within 3–5 seconds. When found, the renderer is notified via a separate event `remote-server-tunnel-ready` with `{ tunnelUrl }`.
- If the binary is missing or fails to spawn, the renderer gets `{ tunnelUrl: null }` and falls back to LAN-only UI; no error popup.
- `stopRemoteServer()` calls `stopCloudflaredTunnel()` first (kills the subprocess), then closes Express.
- `app.on('before-quit')` also kills the subprocess, in case the user quits with remote still running.

**Preload:**
- `onRemoteTunnelReady(cb)` event subscription. Existing `onRemoteServerStarted` is reused; the payload changes from `{url}` to `{localUrl, tunnelUrl}` (the renderer accepts both via fallback).

**Renderer Remote panel (src/App.js):**
- New state `remoteTunnelUrl`. Set from `remote-server-started` payload and updated by `remote-server-tunnel-ready`.
- Active-server UI shows BOTH URLs labeled "Internet (cross-network)" and "Local network (same Wi-Fi)". Tunnel URL shows "Waiting for Cloudflare tunnel…" until ready.
- QR code generated for `remoteTunnelUrl || remoteServerUrl` — tunnel takes priority when available. A small caption under the QR clarifies which URL it points to.

### Files touched

- `electron-main.js` — fullscreen flag, autoUpdater wiring, cloudflared subprocess management, dual-URL payload, before-quit cleanup.
- `electron-preload.js` — autoUpdater event subscriptions + send methods, tunnel-ready event.
- `src/App.js` — update toast, dual-URL display, QR code source preference.
- `package.json` — `electron-updater` dep, `prebuild` script, `extraResources`, `publish`.
- `.gitignore` — exclude vendored cloudflared.exe.
- `scripts/fetch-cloudflared.js` — new file.
- `vendor/cloudflared/cloudflared.exe` — gitignored; fetched by prebuild.

## Testing

Manual:

1. **Bug fix** — Open presenter, click Full Screen → fullscreen on Monitor 1. Pick Monitor 2 from dropdown → window flickers briefly and ends up fullscreen on Monitor 2. (Used to silently no-op.)
2. **Auto-update** — Once repo is public, launch the previous version, wait ~3s after launch → toast appears at bottom-right. Click Download → progress bar. Click Restart now → app quits, installer runs, new version launches. (Before repo is public, the toast won't appear and the autoUpdater logs a quiet 404 to console.)
3. **Cloudflare tunnel** — Start Remote Server. Within ~5s the "Internet" URL populates with `https://*.trycloudflare.com`. QR caption switches from "QR points to local URL" to "QR points to the internet URL". From a phone on a different network (cellular hotspot), open the URL → mobile remote loads and Play/Pause works.
4. **Tunnel failure** — Block outbound traffic to *.cloudflare.com (or rename the binary), start the server → LAN URL works, internet box says "Waiting…" then stops trying. QR falls back to LAN URL.
5. **Quit with remote running** — Start remote, then close Promptly → cloudflared subprocess is killed (verify via Task Manager).

## Open questions

None.
