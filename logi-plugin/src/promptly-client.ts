import { WebSocket } from 'ws';

const URL = 'ws://127.0.0.1:3001/plugin';
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

type PromptlyState = {
  isPlaying: boolean;
  speed: number;
  chapterIndex: number;
  totalChapters: number;
  isCountingDown: boolean;
  hasReachedEnd: boolean;
};

/**
 * Maintains a single WebSocket connection to Promptly's remote server.
 * Auto-reconnects with backoff. Provides send() for action handlers and
 * caches the latest state pushed by the server.
 */
export class PromptlyClient {
  private ws: WebSocket | null = null;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private state: PromptlyState = {
    isPlaying: false,
    speed: 1.5,
    chapterIndex: 0,
    totalChapters: 0,
    isCountingDown: false,
    hasReachedEnd: false
  };

  start(): void {
    this.connect();
  }

  private connect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws = new WebSocket(URL);
    } catch (err) {
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[promptly-client] connected');
      this.backoff = MIN_BACKOFF_MS;
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg && msg.type === 'state') {
          this.state = { ...this.state, ...msg };
        }
      } catch {
        // ignore malformed
      }
    });

    this.ws.on('close', () => {
      this.ws = null;
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      // close handler will fire afterwards; nothing to do here.
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
      this.connect();
    }, this.backoff);
  }

  /** Send a command to Promptly. No-op if not connected. */
  send(name: string, value?: number | string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload: { type: string; name: string; value?: number | string } = { type: 'command', name };
    if (value !== undefined) payload.value = value;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  getState(): PromptlyState {
    return this.state;
  }
}
