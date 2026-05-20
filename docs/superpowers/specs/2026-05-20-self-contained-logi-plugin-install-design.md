# Self-contained Logi Plugin Install

**Date:** 2026-05-20
**Status:** Approved, ready for implementation
**Scope:** Build pipeline + `electron-main.js` runtime install routine + Remote panel status UI

## Problem

v1.0.189 ships the Logi plugin as source under `logi-plugin/`. Users who install via the Promptly EXE have to clone the repo and run npm to use the plugin. The user wants this to be self-contained: install the EXE, plugin works.

A side bug discovered during research: the plugin's `tsup.config.ts` doesn't copy `package/` (manifest + icons) into `dist/`. Even the dev `npm run link` workflow we shipped may not fully load — Logi Plugin Service needs the manifest alongside the JS.

## Goals

- A single Promptly EXE install gives the user a working Logi plugin without touching source or terminal, provided Logi Options+ is installed.
- Promptly auto-update brings plugin updates along with it — version mismatch on next launch triggers a reinstall.
- The dev workflow (`cd logi-plugin && npm run build && npm run link`) still works for iteration.

## Non-goals

- Marketplace submission.
- Linux/Mac (SDK JS path remains Windows-only).
- Detecting Logi Options+ installs that happen mid-Promptly-session (one-time check at launch; user can hit Reinstall).
- Surfacing per-action setup help in the operator UI.

## Design

### Fix the plugin's build

`logi-plugin/tsup.config.ts`: switch to the official toolkit pattern using `postBuildProcessing` from `@logitech/plugin-toolkit`. This copies `package/metadata/` and `package/actionicons/` into `dist/` after the JS bundle, so `dist/` becomes a self-sufficient plugin directory.

### Build the plugin as part of Promptly's installer build

Promptly's `scripts.prebuild` currently runs `node scripts/fetch-cloudflared.js`. Extend it to also build the plugin: `node scripts/build-logi-plugin.js`. That helper runs `npm install --no-audit --no-fund --prefer-offline` and `npm run build` inside `logi-plugin/`. Skip if `logi-plugin/dist` already exists AND the source mtimes are older (cheap check; otherwise always run). Build adds ~10-15 s on first run, ~3 s on incremental.

### Bundle the built plugin in the installer

`package.json` `build.extraResources`:

```json
"extraResources": [
  { "from": "vendor/cloudflared", "to": "cloudflared" },
  { "from": "logi-plugin/dist", "to": "logi-plugin" }
]
```

After install, the bundled plugin lives at `<install-dir>/resources/logi-plugin/`. In dev (`isDev`), use `path.join(__dirname, 'logi-plugin', 'dist')` instead.

### Auto-install at launch

New module `electron-main.js` function `ensureLogiPluginInstalled()`. Runs once shortly after main window loads (after the existing 3s autoUpdater delay; reuse the same `setTimeout`, but a separate scheduled call so neither blocks the other).

Steps:

1. **Service-present check.** If `%LOCALAPPDATA%\Logi\LogiPluginService\` doesn't exist, treat as "Options+ not installed". Set status `not-detected`. Return.
2. **Read bundled manifest.** Parse `<bundle-path>/package/metadata/LoupedeckPackage.yaml` for the plugin `name` and `version`.
3. **Compute target.** `path.join(localAppData, 'Logi', 'LogiPluginService', 'plugins', <name>)`. The name in our manifest is `Promptly`, so target = `…\plugins\Promptly\`.
4. **Dev-junction guard.** `fs.lstat(target)`. If it's a symlink/junction AND its real path resolves inside the user's `logi-plugin/dist` (or starts with a path that contains `logi-plugin`), assume an active dev `npm run link` and skip with status `dev-linked`. Lets devs iterate without the production install clobbering them.
5. **Version check.** If target exists and its manifest's `version` equals our bundled `version`, status = `installed`, done. (Same-version reinstall is idempotent but wasteful.)
6. **Remove + copy.** `fs.rm(target, { recursive: true, force: true })` then `fs.cp(bundlePath, target, { recursive: true })`. Catch errors and surface as status `error`.
7. **Reload deeplink.** Spawn `cmd /c start "" "loupedeck://plugin/<name>/reload"` to tell a running Logi Plugin Service to reload without a restart. If Logi Plugin Service isn't running, the deeplink is a no-op (the service will pick up the plugin on its next start).
8. **Surface status** via IPC `logi-plugin-status` to the renderer.

### Renderer status UI

Inside the Remote panel (between the Cloudflare tunnel block and the QR source picker), a small "Logi Plugin" section:

- `not-detected`: gray text "Logi Options+ not detected" + a non-functional hint to install it.
- `dev-linked`: yellow text "Linked from source (dev mode)" — confirms the install routine respected the user's `npm run link`.
- `installed`: green dot + "Installed (v1.0.0)" + a small "Reinstall" button that re-runs the routine.
- `error`: red text with the error message + Reinstall.
- `installing`: spinner during the copy.

New state: `logiPluginStatus` object `{ status, version?, error? }`. New preload exposures: `onLogiPluginStatus`, `reinstallLogiPlugin`.

### IPC additions

- `logi-plugin-status` (main → renderer): emits the current status object.
- `logi-plugin-reinstall` (renderer → main): re-runs `ensureLogiPluginInstalled` with force=true (skips version-match early return, replaces a dev junction with the bundled copy on explicit user request).

### Out of scope

- A "remove plugin" button. User can uninstall Promptly or manually delete the plugin folder.
- Telling the user which Options+ profile to use.
- Multiple plugin versions side-by-side.
- Stopping the install routine if Logi Plugin Service is currently in the middle of a reload (rare; we just retry on next launch if it fails).

## Files touched

- `logi-plugin/tsup.config.ts` — switch to postBuildProcessing for correct dist/ layout.
- `logi-plugin/package.json` — confirm `@logitech/plugin-toolkit` is a dep (it is, as a devDep).
- `scripts/build-logi-plugin.js` — new build helper.
- `package.json` — `prebuild` runs the new helper too; `build.extraResources` adds the plugin.
- `.gitignore` — ensure `logi-plugin/dist/` stays ignored (already is via `dist/` rule).
- `electron-main.js` — `ensureLogiPluginInstalled()` + IPC + scheduled call.
- `electron-preload.js` — `onLogiPluginStatus`, `reinstallLogiPlugin`.
- `src/App.js` — Remote panel status section.

## Testing

Manual:

1. Build a fresh Promptly installer. Verify `resources/logi-plugin/index.mjs` and `resources/logi-plugin/package/metadata/LoupedeckPackage.yaml` are present in the install dir after running the EXE.
2. Uninstall any previous Promptly plugin from `%LOCALAPPDATA%\Logi\LogiPluginService\plugins\Promptly\`. Confirm gone.
3. Launch the new Promptly. After ~3 s, verify the folder reappears as a copy (not a junction). Manifest matches the bundled version.
4. Open Logi Options+. Confirm the Promptly actions are visible in the action picker and the icons render.
5. Open Promptly's Remote panel. Status should read "Installed (v1.0.x)".
6. With Logi Options+ uninstalled, launch Promptly. Status should read "Logi Options+ not detected".
7. From source: `cd logi-plugin && npm run link`. Launch Promptly. Status should read "Linked from source (dev mode)" and the dev junction must remain intact.
8. Hit "Reinstall" with the dev junction present. Verify it replaces the junction with the bundled copy and status flips to "Installed". (Dev re-runs `npm run link` to restore.)

## Open questions

None.
