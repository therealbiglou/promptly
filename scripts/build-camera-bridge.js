// Build the native Lumix camera bridge during `npm run prebuild`.
// No-op on non-Windows, and build.bat itself exits 0 when the SDK or the C++
// toolchain is absent — so this never blocks a build on a machine without the
// Panasonic Lumix Remote Control SDK installed.
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('[camera-bridge] non-Windows platform — skipping native bridge build.');
  process.exit(0);
}

const bat = path.join(__dirname, '..', 'vendor', 'camera-bridge', 'build.bat');
spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', bat], { stdio: 'inherit' });

// The native bridge is optional; never fail the overall build because of it.
process.exit(0);
