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
const net = require('net');
const fs = require('fs');
const path = require('path');

const MODEL = 'DC-S5M2';

let connected = false;
let recording = false;

// Live view: stream a static test-card JPEG to Node's frame port at ~15 fps.
let liveviewActive = false;
let liveviewSocket = null;
let liveviewTimer = null;
let mockFrame = null;
try { mockFrame = fs.readFileSync(path.join(__dirname, 'mock-frame.jpg')); } catch (_) {}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function startLiveview(framePort) {
  if (liveviewActive) { emit({ event: 'liveview', value: true }); return; }
  if (!connected) { emit({ event: 'error', message: 'No camera connected' }); return; }
  if (!mockFrame) { emit({ event: 'error', message: 'Mock frame asset missing' }); return; }
  liveviewSocket = net.connect(framePort, '127.0.0.1', () => {
    liveviewActive = true;
    emit({ event: 'liveview', value: true });
    liveviewTimer = setInterval(() => {
      const header = Buffer.alloc(4);
      header.writeUInt32BE(mockFrame.length, 0);
      try { liveviewSocket.write(Buffer.concat([header, mockFrame])); } catch (_) {}
    }, 66);
  });
  liveviewSocket.on('error', () => stopLiveview());
  liveviewSocket.on('close', () => { if (liveviewActive) stopLiveview(); });
}

function stopLiveview() {
  if (liveviewTimer) { clearInterval(liveviewTimer); liveviewTimer = null; }
  if (liveviewSocket) { try { liveviewSocket.destroy(); } catch (_) {} liveviewSocket = null; }
  if (liveviewActive) { liveviewActive = false; emit({ event: 'liveview', value: false }); }
}

function handle(msg) {
  switch (msg.cmd) {
    case 'connect':
      connected = true;
      emit({ event: 'connected', model: MODEL });
      break;

    case 'disconnect':
      if (connected) {
        stopLiveview();
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

    case 'liveview-start':
      startLiveview(msg.framePort);
      break;

    case 'liveview-stop':
      stopLiveview();
      break;

    case 'status':
      emit(connected ? { event: 'connected', model: MODEL } : { event: 'disconnected' });
      emit({ event: 'recording', value: recording });
      emit({ event: 'liveview', value: liveviewActive });
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

// Announce readiness once stdin is wired up.
emit({ event: 'ready' });
