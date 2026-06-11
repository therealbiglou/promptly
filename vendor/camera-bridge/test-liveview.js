// Integration test for the live-view frame pipeline: mock bridge streams the
// test-card JPEG through CameraManager to a TCP frame server (as Node does).
// Run: node vendor/camera-bridge/test-liveview.js
'use strict';

const path = require('path');
const assert = require('assert');
const net = require('net');
const { spawn } = require('child_process');
const { CameraManager } = require('../../camera-control');

const bridgePath = path.join(__dirname, 'mock-bridge.js');
const FRAME_PORT = 3999;

let frames = 0;
let firstLen = 0;

const frameServer = net.createServer((socket) => {
  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);
      if (buf.length < 4 + len) break;
      frames++;
      if (!firstLen) firstLen = len;
      buf = buf.subarray(4 + len);
    }
  });
  socket.on('error', () => {});
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => frameServer.listen(FRAME_PORT, '127.0.0.1', r));

  const mgr = new CameraManager({ spawn, command: process.execPath, args: [bridgePath], onStatus: () => {}, log: () => {} });
  mgr.start();
  await wait(150);
  assert.strictEqual(mgr.getStatus().connected, true, 'camera should auto-connect');

  mgr.liveviewStart(FRAME_PORT);
  await wait(400);
  assert.strictEqual(mgr.getStatus().liveview, true, 'liveview should be active');
  assert.ok(frames >= 3, 'should receive multiple frames, got ' + frames);
  assert.ok(firstLen > 1000, 'frame should be a real JPEG, got ' + firstLen + ' bytes');

  mgr.liveviewStop();
  await wait(150);
  assert.strictEqual(mgr.getStatus().liveview, false, 'liveview should stop');
  const afterStop = frames;
  await wait(200);
  assert.strictEqual(frames, afterStop, 'no frames should arrive after stop');

  mgr.stop();
  frameServer.close();
  console.log('LIVEVIEW INTEGRATION PASSED (' + frames + ' frames, ' + firstLen + ' bytes each)');
  process.exit(0);
})().catch((e) => { console.error('LIVEVIEW TEST FAILED:', e.message); try { frameServer.close(); } catch (_) {} process.exit(1); });
