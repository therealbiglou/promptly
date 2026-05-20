// Builds the Logi Plugin Service plugin into logi-plugin/dist/ so
// electron-builder can bundle it. Runs as part of Promptly's npm prebuild.
// Skipped if dist/ already exists and is newer than the plugin source.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PLUGIN_DIR = path.join(__dirname, '..', 'logi-plugin');
const DIST = path.join(PLUGIN_DIR, 'dist');
const ENTRY = path.join(PLUGIN_DIR, 'index.ts');

function youngestMtime(rootDir, extensions) {
  let mtime = 0;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (!extensions || extensions.some(ext => p.endsWith(ext))) {
        try { mtime = Math.max(mtime, fs.statSync(p).mtimeMs); } catch {}
      }
    }
  };
  walk(rootDir);
  return mtime;
}

function isBuildFresh() {
  const indexMjs = path.join(DIST, 'index.mjs');
  const manifest = path.join(DIST, 'metadata', 'LoupedeckPackage.yaml');
  if (!fs.existsSync(indexMjs) || !fs.existsSync(manifest)) return false;
  const distMtime = fs.statSync(indexMjs).mtimeMs;
  const srcMtime = youngestMtime(PLUGIN_DIR, ['.ts', '.json', '.yaml', '.svg']);
  return distMtime >= srcMtime;
}

function run(cmd, args, label) {
  console.log(`[build-logi-plugin] ${label}: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: PLUGIN_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    console.error(`[build-logi-plugin] ${label} failed (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(ENTRY)) {
  console.log('[build-logi-plugin] logi-plugin/ missing; skipping');
  process.exit(0);
}

if (isBuildFresh()) {
  console.log('[build-logi-plugin] dist/ is up to date; skipping rebuild');
  process.exit(0);
}

const nodeModules = path.join(PLUGIN_DIR, 'node_modules');
if (!fs.existsSync(nodeModules)) {
  run('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], 'install');
}

run('npm', ['run', 'build'], 'build');
console.log('[build-logi-plugin] done');
