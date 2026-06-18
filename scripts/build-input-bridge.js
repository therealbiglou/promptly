// Build the native Raw Input helper during `npm run prebuild`.
// No-op on non-Windows; build.bat no-ops without the C++ toolchain — so this
// never blocks a build.
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('[input-bridge] non-Windows platform — skipping native helper build.');
  process.exit(0);
}

const bat = path.join(__dirname, '..', 'vendor', 'input-bridge', 'build.bat');
spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', bat], { stdio: 'inherit' });
process.exit(0);
