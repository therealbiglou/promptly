// Standalone node test for CameraManager (no jest — CRA's test runner only scans
// src/, and this is a main-process module). Run: node vendor/camera-bridge/camera-control.test.js
'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const { CameraManager } = require('../../camera-control');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok - ' + name); }
  catch (err) { console.error('  FAIL - ' + name + '\n    ' + err.message); process.exitCode = 1; }
}

// A fake child process: stdout/stderr are emitters, stdin captures written lines.
function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child._written = [];
  child.stdin = { write: (s) => { child._written.push(s); return true; } };
  child.kill = () => { child.killed = true; };
  // helper to push a protocol line from the "bridge"
  child.emitLine = (obj) => child.stdout.emit('data', JSON.stringify(obj) + '\n');
  return child;
}

function makeManager(extra) {
  const statuses = [];
  const errors = [];
  let lastChild = null;
  const mgr = new CameraManager(Object.assign({
    spawn: () => { lastChild = makeFakeChild(); return lastChild; },
    command: 'node',
    args: [],
    onStatus: (s) => statuses.push(s),
    onError: (m) => errors.push(m),
    backoff: [5, 5, 5],
  }, extra));
  return {
    mgr,
    statuses,
    errors,
    child: () => lastChild,
    written: () => lastChild._written.map((s) => JSON.parse(s.trim())),
  };
}

console.log('CameraManager tests:');

test('ready -> available true and auto-connect command sent', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  assert.strictEqual(h.mgr.getStatus().available, true);
  assert.deepStrictEqual(h.written(), [{ cmd: 'connect' }]);
});

test('connected event sets connected + model', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'connected', model: 'DC-S5M2' });
  const s = h.mgr.getStatus();
  assert.strictEqual(s.connected, true);
  assert.strictEqual(s.model, 'DC-S5M2');
});

test('toggleRecord sends record-start then record-stop tracking confirmed state', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'connected', model: 'DC-S5M2' });

  h.mgr.toggleRecord(); // not recording -> start
  assert.deepStrictEqual(h.written().slice(-1)[0], { cmd: 'record-start' });
  h.child().emitLine({ event: 'recording', value: true });
  assert.strictEqual(h.mgr.getStatus().recording, true);

  h.mgr.toggleRecord(); // recording -> stop
  assert.deepStrictEqual(h.written().slice(-1)[0], { cmd: 'record-stop' });
  h.child().emitLine({ event: 'recording', value: false });
  assert.strictEqual(h.mgr.getStatus().recording, false);
});

test('JSON split across stdout chunks is buffered and parsed', () => {
  const h = makeManager();
  h.mgr.start();
  const line = JSON.stringify({ event: 'connected', model: 'DC-S5M2' }) + '\n';
  h.child().emitLine({ event: 'ready' });
  h.child().stdout.emit('data', line.slice(0, 10));
  h.child().stdout.emit('data', line.slice(10));
  assert.strictEqual(h.mgr.getStatus().connected, true);
});

test('disconnected resets connected/model/recording', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'connected', model: 'DC-S5M2' });
  h.child().emitLine({ event: 'recording', value: true });
  h.child().emitLine({ event: 'disconnected' });
  const s = h.mgr.getStatus();
  assert.strictEqual(s.connected, false);
  assert.strictEqual(s.model, null);
  assert.strictEqual(s.recording, false);
});

test('error event surfaces via onError without changing record state', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'connected', model: 'DC-S5M2' });
  h.child().emitLine({ event: 'error', message: 'No camera connected' });
  assert.strictEqual(h.mgr.getStatus().recording, false);
  assert.deepStrictEqual(h.errors.slice(-1)[0], 'No camera connected');
});

test('bridge exit marks unavailable (sync part)', () => {
  const h = makeManager();
  h.mgr.start();
  const first = h.child();
  first.emitLine({ event: 'ready' });
  assert.strictEqual(h.mgr.getStatus().available, true);
  first.emit('exit', 1);
  assert.strictEqual(h.mgr.getStatus().available, false);

  // Async respawn check, self-reported (test() does not await).
  setTimeout(() => {
    try {
      assert.notStrictEqual(h.child(), first, 'expected a new child after respawn');
      h.child().emitLine({ event: 'ready' });
      assert.strictEqual(h.mgr.getStatus().available, true);
      h.mgr.stop();
      passed++;
      console.log('  ok - bridge respawns after exit (async)');
    } catch (err) {
      process.exitCode = 1;
      console.error('  FAIL - bridge respawns after exit (async)\n    ' + err.message);
    }
  }, 20);
});

test('reconnect poll retries connect while available but disconnected', () => {
  const h = makeManager({ reconnectIntervalMs: 15 });
  h.mgr.start();
  h.child().emitLine({ event: 'ready' }); // available=true, auto-connect sends connect #1
  // Stay disconnected (no 'connected' event). The poll should retry connect.
  setTimeout(() => {
    try {
      const connects = h.written().filter((m) => m.cmd === 'connect');
      assert.ok(connects.length >= 2, 'expected >=2 connect attempts (auto + poll), got ' + connects.length);
      // Once connected, the poll must stop retrying.
      h.child().emitLine({ event: 'connected', model: 'DC-S5M2' });
      const countAtConnect = h.written().filter((m) => m.cmd === 'connect').length;
      setTimeout(() => {
        try {
          const after = h.written().filter((m) => m.cmd === 'connect').length;
          assert.strictEqual(after, countAtConnect, 'poll must stop once connected');
          h.mgr.stop();
          passed++;
          console.log('  ok - reconnect poll retries then stops on connect (async)');
        } catch (err) { process.exitCode = 1; console.error('  FAIL - reconnect poll stop\n    ' + err.message); }
      }, 40);
    } catch (err) { process.exitCode = 1; console.error('  FAIL - reconnect poll retry\n    ' + err.message); h.mgr.stop(); }
  }, 40);
});

// Allow the async respawn test to settle before the final report.
setTimeout(() => {
  console.log(passed + ' assertions passed.');
  if (process.exitCode) console.error('TESTS FAILED');
  else console.log('ALL TESTS PASSED');
}, 100);
