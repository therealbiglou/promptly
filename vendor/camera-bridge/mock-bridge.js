#!/usr/bin/env node
// mock-bridge.js — a fake camera bridge for developing/testing the Promptly side
// without the Panasonic DC SDK or real hardware. It speaks the exact same
// line-delimited JSON stdio protocol the real C++ bridge will speak, so swapping
// in the real bridge later changes nothing above it.
//
// Protocol (see docs/superpowers/specs/2026-06-10-camera-control-design.md):
//   Electron -> bridge (stdin):  {"cmd":"connect"|"disconnect"|"record-start"|"record-stop"|"status"}
//   bridge -> Electron (stdout): {"event":"ready"}
//                                {"event":"connected","model":"DC-S5M2"}
//                                {"event":"disconnected"}
//                                {"event":"recording","value":true|false}
//                                {"event":"error","message":"..."}

'use strict';

const readline = require('readline');

const MODEL = 'DC-S5M2';

let connected = false;
let recording = false;

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function handle(cmd) {
  switch (cmd) {
    case 'connect':
      if (!connected) {
        connected = true;
        emit({ event: 'connected', model: MODEL });
      } else {
        emit({ event: 'connected', model: MODEL });
      }
      break;

    case 'disconnect':
      if (connected) {
        connected = false;
        if (recording) { recording = false; emit({ event: 'recording', value: false }); }
        emit({ event: 'disconnected' });
      }
      break;

    case 'record-start':
      if (!connected) { emit({ event: 'error', message: 'No camera connected' }); break; }
      if (!recording) { recording = true; emit({ event: 'recording', value: true }); }
      break;

    case 'record-stop':
      if (!connected) { emit({ event: 'error', message: 'No camera connected' }); break; }
      if (recording) { recording = false; emit({ event: 'recording', value: false }); }
      break;

    case 'status':
      emit(connected ? { event: 'connected', model: MODEL } : { event: 'disconnected' });
      emit({ event: 'recording', value: recording });
      break;

    default:
      emit({ event: 'error', message: 'Unknown command: ' + cmd });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try { msg = JSON.parse(trimmed); } catch { emit({ event: 'error', message: 'Bad JSON: ' + trimmed }); return; }
  if (msg && typeof msg.cmd === 'string') handle(msg.cmd);
});

// Announce readiness once stdin is wired up.
emit({ event: 'ready' });
