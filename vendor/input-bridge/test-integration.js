// Integration test: drive the REAL mock helper through InputBridgeManager using
// the real child_process.spawn. Verifies the bind -> bound -> trigger flow and
// that only the bound device's clicks trigger.
// Run: node vendor/input-bridge/test-integration.js
'use strict';

const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const { InputBridgeManager } = require('../../input-control');

const mockPath = path.join(__dirname, 'mock-input-bridge.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let boundId = null;
const gestures = [];

const mgr = new InputBridgeManager({
  spawn,
  command: process.execPath,
  args: [mockPath],
  onBound: (id) => { boundId = id; },
  onGesture: (g) => { gestures.push(g); },
  longMs: 40, doubleMs: 30, // small windows for a fast test
  log: () => {},
});

(async () => {
  mgr.start();
  await wait(120);
  assert.strictEqual(mgr.isAvailable(), true, 'helper should be available after ready');

  mgr.bind();
  await wait(400); // mock auto-"presses" ~300ms after bind
  assert.strictEqual(boundId, 'MOCK-REMOTE', 'bind should report the captured device');
  assert.strictEqual(mgr.getDeviceId(), 'MOCK-REMOTE', 'manager should store the bound device');

  // A single click from the bound device yields a 'single' gesture...
  mgr._writeLine({ cmd: '__click', device: 'MOCK-REMOTE' });
  await wait(60);
  assert.deepStrictEqual(gestures, ['single'], 'bound device click should yield single');

  // ...and a click from another device yields nothing.
  mgr._writeLine({ cmd: '__click', device: 'SOME-OTHER-MOUSE' });
  await wait(60);
  assert.deepStrictEqual(gestures, ['single'], 'a different device must NOT fire a gesture');

  mgr.stop();
  await wait(40);
  console.log('INPUT INTEGRATION PASSED (bind -> ' + boundId + ', device-filtered single gesture works)');
  process.exit(0);
})().catch((e) => { console.error('INPUT INTEGRATION FAILED:', e.message); mgr.stop(); process.exit(1); });
