#!/usr/bin/env node
// mock-input-bridge.js — fake Raw Input helper for developing/testing the Promptly
// side without the native helper or a real remote. Speaks the same line-delimited
// JSON stdio protocol the real C++ helper will speak.
//
//   Electron -> helper:  {"cmd":"set-device","id":"..."} | {"cmd":"bind"} | {"cmd":"clear"}
//                        {"cmd":"__click","device":"..."}   // TEST HOOK: simulate a left-click
//   helper -> Electron:  {"event":"ready"}
//                        {"event":"bound","id":"..."}        // bind captured a device (now active)
//                        {"event":"trigger"}                 // bound device left-clicked

'use strict';

const readline = require('readline');

let boundDevice = null;
let bindTimer = null;

function emit(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

function handle(msg) {
  switch (msg.cmd) {
    case 'set-device':
      boundDevice = msg.id || null;
      break;

    case 'bind':
      // Simulate the operator pressing their remote a moment later. (The real
      // helper instead captures the next physical left-click's source device.)
      if (bindTimer) clearTimeout(bindTimer);
      bindTimer = setTimeout(() => {
        bindTimer = null;
        boundDevice = 'MOCK-REMOTE';
        emit({ event: 'bound', id: boundDevice });
      }, 300);
      break;

    case 'clear':
      boundDevice = null;
      if (bindTimer) { clearTimeout(bindTimer); bindTimer = null; }
      break;

    case '__click':
      // Test hook: a left-click from msg.device only triggers if it's the bound one.
      if (msg.device && msg.device === boundDevice) emit({ event: 'trigger' });
      break;

    default:
      emit({ event: 'error', message: 'Unknown command: ' + msg.cmd });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try { msg = JSON.parse(trimmed); } catch { emit({ event: 'error', message: 'Bad JSON: ' + trimmed }); return; }
  if (msg && typeof msg.cmd === 'string') handle(msg);
});

emit({ event: 'ready' });
