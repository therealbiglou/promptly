// Integration test: drive the REAL mock bridge through CameraManager using the
// real child_process.spawn. Verifies the end-to-end stdio protocol.
// Run: node vendor/camera-bridge/test-integration.js
'use strict';

const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const { CameraManager } = require('../../camera-control');

const bridgePath = path.join(__dirname, 'mock-bridge.js');

const mgr = new CameraManager({
  spawn,
  command: process.execPath,        // the node binary running this test
  args: [bridgePath],
  onStatus: (s) => console.log('  status ->', JSON.stringify(s)),
  onError: (m) => console.log('  error ->', m),
  log: () => {},
});

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  mgr.start();
  await wait(150); // ready + auto-connect round-trip

  let s = mgr.getStatus();
  assert.strictEqual(s.available, true, 'bridge should be available');
  assert.strictEqual(s.connected, true, 'camera should auto-connect');
  assert.strictEqual(s.model, 'DC-S5M2', 'model should be reported');

  mgr.toggleRecord();               // start
  await wait(80);
  assert.strictEqual(mgr.getStatus().recording, true, 'should be recording after start');

  mgr.toggleRecord();               // stop
  await wait(80);
  assert.strictEqual(mgr.getStatus().recording, false, 'should stop recording');

  // Error path: disconnect, then a record command must report an error, not fake state.
  mgr.disconnect();
  await wait(80);
  assert.strictEqual(mgr.getStatus().connected, false, 'should be disconnected');
  mgr.recordStart();
  await wait(80);
  assert.strictEqual(mgr.getStatus().recording, false, 'must not record while disconnected');

  mgr.stop();
  await wait(50);
  console.log('INTEGRATION TEST PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('INTEGRATION TEST FAILED:', err.message);
  mgr.stop();
  process.exit(1);
});
