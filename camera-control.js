// camera-control.js — supervises the camera bridge subprocess and exposes a
// small command/state surface to the Electron main process.
//
// The bridge (mock now, C++ + DC SDK later) speaks line-delimited JSON over
// stdio. This manager:
//   - spawns and watchdog-respawns the bridge (backoff), like cloudflared
//   - parses bridge events into authoritative state {available, connected, model, recording}
//   - forwards commands (connect / record-start / record-stop / status) to the bridge
//   - calls onStatus(state) whenever state changes, and onError(message) on failures
//
// `spawn` is injected so the protocol/state logic is unit-testable without Electron.

'use strict';

const DEFAULT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

class CameraManager {
  constructor(opts = {}) {
    this._spawn = opts.spawn;                       // required: child_process.spawn (or a fake)
    this._command = opts.command;                   // e.g. 'node' or path to bridge .exe
    this._args = opts.args || [];
    this._onStatus = opts.onStatus || (() => {});
    this._onError = opts.onError || (() => {});
    this._log = opts.log || (() => {});
    this._autoConnect = opts.autoConnect !== false; // default: connect on ready
    this._backoff = opts.backoff || DEFAULT_BACKOFF_MS;

    this._child = null;
    this._stopped = false;
    this._buffer = '';
    this._backoffIndex = 0;
    this._respawnTimer = null;

    this._state = { available: false, connected: false, model: null, recording: false, liveview: false };
  }

  getStatus() {
    return Object.assign({}, this._state);
  }

  _setState(patch) {
    const next = Object.assign({}, this._state, patch);
    const changed = Object.keys(next).some((k) => next[k] !== this._state[k]);
    this._state = next;
    if (changed) this._onStatus(this.getStatus());
  }

  start() {
    this._stopped = false;
    this._spawnBridge();
  }

  stop() {
    this._stopped = true;
    if (this._respawnTimer) { clearTimeout(this._respawnTimer); this._respawnTimer = null; }
    if (this._child) {
      try { this._writeLine({ cmd: 'disconnect' }); } catch (_) {}
      try { this._child.kill(); } catch (_) {}
      this._child = null;
    }
    this._setState({ available: false, connected: false, model: null, recording: false });
  }

  _spawnBridge() {
    if (this._child || this._stopped) return;
    let child;
    try {
      child = this._spawn(this._command, this._args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      this._log('camera bridge spawn failed: ' + (err && err.message));
      this._onError('Camera bridge failed to start');
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
      child.stderr.on('data', (d) => this._log('[camera-bridge stderr] ' + d));
    }
    child.on('error', (err) => this._log('camera bridge process error: ' + (err && err.message)));
    child.on('exit', (code) => this._onExit(code));
  }

  _onExit(code) {
    this._log('camera bridge exited (code ' + code + ')');
    this._child = null;
    this._setState({ available: false, connected: false, model: null, recording: false });
    if (!this._stopped) this._scheduleRespawn();
  }

  _scheduleRespawn() {
    if (this._stopped || this._respawnTimer) return;
    const delay = this._backoff[Math.min(this._backoffIndex, this._backoff.length - 1)];
    this._backoffIndex++;
    this._respawnTimer = setTimeout(() => {
      this._respawnTimer = null;
      this._spawnBridge();
    }, delay);
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
    try { msg = JSON.parse(line); } catch (_) { this._log('camera bridge bad line: ' + line); return; }
    switch (msg.event) {
      case 'ready':
        this._backoffIndex = 0;
        this._setState({ available: true });
        if (this._autoConnect) this.connect();
        break;
      case 'connected':
        this._setState({ connected: true, model: msg.model || null });
        break;
      case 'disconnected':
        this._setState({ connected: false, model: null, recording: false });
        break;
      case 'recording':
        this._setState({ recording: !!msg.value });
        break;
      case 'liveview':
        this._setState({ liveview: !!msg.value });
        break;
      case 'error':
        this._log('camera bridge error: ' + msg.message);
        this._onError(msg.message || 'Camera error');
        break;
      default:
        this._log('camera bridge unknown event: ' + line);
    }
  }

  _writeLine(obj) {
    if (!this._child || !this._child.stdin) return false;
    try {
      this._child.stdin.write(JSON.stringify(obj) + '\n');
      return true;
    } catch (err) {
      this._log('camera bridge write failed: ' + (err && err.message));
      return false;
    }
  }

  sendCommand(cmd) { return this._writeLine({ cmd: cmd }); }
  connect() { return this.sendCommand('connect'); }
  disconnect() { return this.sendCommand('disconnect'); }
  recordStart() { return this.sendCommand('record-start'); }
  recordStop() { return this.sendCommand('record-stop'); }
  requestStatus() { return this.sendCommand('status'); }

  // Toggle based on last-confirmed recording state.
  toggleRecord() {
    return this._state.recording ? this.recordStop() : this.recordStart();
  }

  // Live view: the bridge streams JPEG frames to Node's frame TCP server on framePort.
  liveviewStart(framePort) { return this._writeLine({ cmd: 'liveview-start', framePort: framePort }); }
  liveviewStop() { return this._writeLine({ cmd: 'liveview-stop' }); }
  toggleLiveview(framePort) {
    return this._state.liveview ? this.liveviewStop() : this.liveviewStart(framePort);
  }

  get liveview() { return this._state.liveview; }
}

module.exports = { CameraManager, DEFAULT_BACKOFF_MS };
