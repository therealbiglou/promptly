// Standalone node test for InputBridgeManager (no jest).
// Run: node vendor/input-bridge/input-control.test.js
'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const { InputBridgeManager } = require('../../input-control');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok - ' + name); }
  catch (err) { console.error('  FAIL - ' + name + '\n    ' + err.message); process.exitCode = 1; }
}

function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child._written = [];
  child.stdin = { write: (s) => { child._written.push(s); return true; } };
  child.kill = () => { child.killed = true; };
  child.emitLine = (obj) => child.stdout.emit('data', JSON.stringify(obj) + '\n');
  return child;
}

function makeManager(extra) {
  const status = [], bound = [], gestures = [];
  let lastChild = null;
  const mgr = new InputBridgeManager(Object.assign({
    spawn: () => { lastChild = makeFakeChild(); return lastChild; },
    command: 'node', args: [],
    onStatus: (s) => status.push(s),
    onBound: (id) => bound.push(id),
    onGesture: (g) => gestures.push(g),
    backoff: [5, 5, 5],
    longMs: 40, doubleMs: 30,
  }, extra));
  return { mgr, status, bound, gestures, child: () => lastChild, written: () => lastChild._written.map((s) => JSON.parse(s.trim())) };
}

console.log('InputBridgeManager tests:');

test('ready -> available true', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  assert.strictEqual(h.mgr.isAvailable(), true);
  assert.deepStrictEqual(h.status.slice(-1)[0], { available: true });
});

test('ready re-applies a previously set device filter (survives respawn)', () => {
  const h = makeManager({ deviceId: 'DEV-1' });
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  assert.deepStrictEqual(h.written().slice(-1)[0], { cmd: 'set-device', id: 'DEV-1' });
});

test('bound event reports id and updates the stored device', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'bound', id: 'DEV-XYZ' });
  assert.deepStrictEqual(h.bound.slice(-1)[0], 'DEV-XYZ');
  assert.strictEqual(h.mgr.getDeviceId(), 'DEV-XYZ');
});

// --- async gesture tests (self-reported; longMs=40, doubleMs=30) ---
(() => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'down' });
  h.child().emitLine({ event: 'up' });
  setTimeout(() => {
    try { assert.deepStrictEqual(h.gestures, ['single']); passed++; console.log('  ok - single tap -> single'); }
    catch (e) { process.exitCode = 1; console.error('  FAIL - single tap\n    ' + e.message); }
  }, 70);
})();

(() => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'down' }); h.child().emitLine({ event: 'up' });
  h.child().emitLine({ event: 'down' }); h.child().emitLine({ event: 'up' }); // 2nd tap within window
  setTimeout(() => {
    try { assert.deepStrictEqual(h.gestures, ['double']); passed++; console.log('  ok - quick two taps -> double'); }
    catch (e) { process.exitCode = 1; console.error('  FAIL - double tap\n    ' + e.message); }
  }, 70);
})();

(() => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.child().emitLine({ event: 'down' }); // hold (no up yet)
  setTimeout(() => {
    h.child().emitLine({ event: 'up' });
    try { assert.deepStrictEqual(h.gestures, ['long']); passed++; console.log('  ok - held -> long'); }
    catch (e) { process.exitCode = 1; console.error('  FAIL - long press\n    ' + e.message); }
  }, 70); // > longMs (40)
})();

test('bind / setDevice / clear write the right commands', () => {
  const h = makeManager();
  h.mgr.start();
  h.child().emitLine({ event: 'ready' });
  h.mgr.bind();
  assert.deepStrictEqual(h.written().slice(-1)[0], { cmd: 'bind' });
  h.mgr.setDevice('DEV-2');
  assert.deepStrictEqual(h.written().slice(-1)[0], { cmd: 'set-device', id: 'DEV-2' });
  h.mgr.clear();
  assert.deepStrictEqual(h.written().slice(-1)[0], { cmd: 'clear' });
  assert.strictEqual(h.mgr.getDeviceId(), null);
});

test('exit marks unavailable then respawns (async)', () => {
  const h = makeManager();
  h.mgr.start();
  const first = h.child();
  first.emitLine({ event: 'ready' });
  first.emit('exit', 1);
  assert.strictEqual(h.mgr.isAvailable(), false);
  setTimeout(() => {
    try {
      assert.notStrictEqual(h.child(), first, 'expected a new child after respawn');
      h.child().emitLine({ event: 'ready' });
      assert.strictEqual(h.mgr.isAvailable(), true);
      h.mgr.stop();
      passed++;
      console.log('  ok - exit -> respawn (async)');
    } catch (err) { process.exitCode = 1; console.error('  FAIL - exit -> respawn (async)\n    ' + err.message); }
  }, 20);
});

setTimeout(() => {
  console.log(passed + ' assertions passed.');
  if (process.exitCode) console.error('TESTS FAILED'); else console.log('ALL TESTS PASSED');
}, 150);
