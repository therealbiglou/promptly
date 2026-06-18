// input-control.js — supervises the Raw Input helper subprocess and exposes a
// small surface to the Electron main process. Mirrors camera-control.js: the
// helper (mock now, C++ Raw Input later) speaks line-delimited JSON over stdio.
//
//   commands: set-device{id} / bind / clear
//   events:   ready / bound{id} / trigger / error
//
// `spawn` is injected so the protocol/state logic is unit-testable without Electron.

'use strict';

const DEFAULT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

class InputBridgeManager {
  constructor(opts = {}) {
    this._spawn = opts.spawn;
    this._command = opts.command;
    this._args = opts.args || [];
    this._onStatus = opts.onStatus || (() => {});   // ({available}) on availability change
    this._onBound = opts.onBound || (() => {});      // (deviceId) when a bind completes
    this._onTrigger = opts.onTrigger || (() => {});  // () when the bound device clicks
    this._onError = opts.onError || (() => {});
    this._log = opts.log || (() => {});
    this._backoff = opts.backoff || DEFAULT_BACKOFF_MS;

    this._child = null;
    this._stopped = false;
    this._buffer = '';
    this._backoffIndex = 0;
    this._respawnTimer = null;
    this._deviceId = opts.deviceId || null; // re-applied to the helper after each (re)spawn
    this._available = false;
  }

  isAvailable() { return this._available; }
  getDeviceId() { return this._deviceId; }

  start() { this._stopped = false; this._spawnBridge(); }

  stop() {
    this._stopped = true;
    if (this._respawnTimer) { clearTimeout(this._respawnTimer); this._respawnTimer = null; }
    if (this._child) { try { this._child.kill(); } catch (_) {} this._child = null; }
    this._setAvailable(false);
  }

  _setAvailable(v) {
    if (v === this._available) return;
    this._available = v;
    this._onStatus({ available: v });
  }

  _spawnBridge() {
    if (this._child || this._stopped) return;
    let child;
    try {
      child = this._spawn(this._command, this._args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      this._log('input bridge spawn failed: ' + (err && err.message));
      this._scheduleRespawn();
      return;
    }
    this._child = child;
    this._buffer = '';
    if (child.stdout) {
      if (child.stdout.setEncoding) child.stdout.setEncoding('utf8');
      child.stdout.on('data', (d) => this._onData(d));
    }
    if (child.stderr) {
      if (child.stderr.setEncoding) child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => this._log('[input-bridge stderr] ' + d));
    }
    child.on('error', (err) => this._log('input bridge process error: ' + (err && err.message)));
    child.on('exit', (code) => this._onExit(code));
  }

  _onExit(code) {
    this._log('input bridge exited (code ' + code + ')');
    this._child = null;
    this._setAvailable(false);
    if (!this._stopped) this._scheduleRespawn();
  }

  _scheduleRespawn() {
    if (this._stopped || this._respawnTimer) return;
    const delay = this._backoff[Math.min(this._backoffIndex, this._backoff.length - 1)];
    this._backoffIndex++;
    this._respawnTimer = setTimeout(() => { this._respawnTimer = null; this._spawnBridge(); }, delay);
  }

  _onData(chunk) {
    this._buffer += chunk;
    let idx;
    while ((idx = this._buffer.indexOf('\n')) >= 0) {
      const line = this._buffer.slice(0, idx).trim();
      this._buffer = this._buffer.slice(idx + 1);
      if (line) this._handleLine(line);
    }
  }

  _handleLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch (_) { this._log('input bridge bad line: ' + line); return; }
    switch (msg.event) {
      case 'ready':
        this._backoffIndex = 0;
        this._setAvailable(true);
        if (this._deviceId) this.setDevice(this._deviceId); // restore the filter after (re)spawn
        break;
      case 'bound':
        this._deviceId = msg.id || null;
        this._onBound(this._deviceId);
        break;
      case 'trigger':
        this._onTrigger();
        break;
      case 'error':
        this._log('input bridge error: ' + msg.message);
        this._onError(msg.message || 'Input bridge error');
        break;
      default:
        this._log('input bridge unknown event: ' + line);
    }
  }

  _writeLine(obj) {
    if (!this._child || !this._child.stdin) return false;
    try { this._child.stdin.write(JSON.stringify(obj) + '\n'); return true; }
    catch (err) { this._log('input bridge write failed: ' + (err && err.message)); return false; }
  }

  setDevice(id) { this._deviceId = id || null; return this._writeLine({ cmd: 'set-device', id: this._deviceId }); }
  bind() { return this._writeLine({ cmd: 'bind' }); }
  clear() { this._deviceId = null; return this._writeLine({ cmd: 'clear' }); }
}

module.exports = { InputBridgeManager, DEFAULT_BACKOFF_MS };
