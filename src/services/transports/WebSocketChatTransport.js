import Env from '../../config/env';
import { AudioStreamPlayer } from '../../lib/audio/AudioStreamPlayer';

// WebSocketChatTransport enforces start -> binary -> stop protocol and handles server events.
export class WebSocketChatTransport {
  constructor({ sessionId = Env.SESSION_ID, language = Env.LANGUAGE, onLog = () => {}, onError = () => {}, onCrisis = () => {} } = {}) {
    this.sessionId = sessionId;
    this.language = language;
    this.onLog = onLog;
    this.onError = onError;
    this.onCrisis = onCrisis;
    this.ws = null;
    this.audioPlayer = new AudioStreamPlayer({ onLog: this.onLog });
    this.audioEl = null;
    this.started = false;
    // Auto-reconnect policy
    this.autoReconnect = true;
    this.reconnectDelayMs = 800;
    this.reconnectTimer = null;
    this.manuallyClosed = false;
  }

  attachAudioElement(audioElement) {
    this.audioEl = audioElement;
    this.audioPlayer.attach(this.audioEl);
  }

  connect() {
    // Reuse existing socket when possible; do not proactively close.
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) return;
      if (this.ws.readyState === WebSocket.CONNECTING) return;
      if (this.ws.readyState === WebSocket.CLOSING) {
        this.onLog('ws is CLOSING; will wait instead of reconnecting');
        return;
      }
      if (this.ws.readyState === WebSocket.CLOSED) {
        // drop reference and create new below
        this.ws = null;
      }
    }

    // Reset manual-close guard and pending timers for a fresh (or reused) connection attempt
    this.manuallyClosed = false;
    if (this.reconnectTimer) {
      try { clearTimeout(this.reconnectTimer); } catch {}
      this.reconnectTimer = null;
    }

    const url = new URL(Env.BACKEND_WS_URL);
    url.pathname = '/api/v1/rt/chat'; // enforce path

    this.ws = new WebSocket(url.toString());
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('open', () => {
      this.onLog(`ws open; readyState=${this.ws.readyState}`);
      // Send start only after connection is open
      const startMsg = { type: 'start', session_id: this.sessionId, language: this.language };
      this.ws.send(JSON.stringify(startMsg));
      this.onLog(`ws sent start at ${new Date().toISOString()}`);
      this.started = true;
    });

    this.ws.addEventListener('message', (evt) => {
      if (typeof evt.data === 'string') {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === 'audio_start') {
            const mediaType = msg.media_type || 'audio/mpeg';
            this.audioPlayer.reset();
            this.audioPlayer.attach(this.audioEl);
            // Default to reliable fallback; pass preferMSE=false. If low latency needed, set preferMSE=true.
            this.audioPlayer.start(mediaType, { preferMSE: false });
            this.onLog(`server event: audio_start media_type=${mediaType}`);
          } else if (msg.event === 'audio_end') {
            this.onLog('server event: audio_end');
            this.audioPlayer.end();
          } else if (msg.event === 'ready') {
            // Server indicates it is ready for next request. Keep socket open.
            this.onLog('server event: ready');
          } else if (msg.event === 'crisis') {
            const text = msg.text || 'Ada situasi darurat.';
            const subtype = msg.type || (msg.meta && msg.meta.subtype);
            const helpUrl = (msg.meta && (msg.meta.help_url || msg.meta.helpUrl)) || undefined;
            this.onLog(`server event: crisis subtype=${subtype || 'n/a'}`);
            try { this.onCrisis({ text, subtype, helpUrl, raw: msg }); } catch {}
          } else if (msg.event === 'error') {
            const detail = msg.detail || 'unknown error';
            this.onLog(`server error: ${detail}`);
            if (detail === 'empty_audio') {
              this.onError(new Error('No audio chunks were sent (empty_audio)'));
            }
          } else {
            this.onLog(`ws json: ${evt.data}`);
          }
        } catch (e) {
          this.onLog(`json parse error: ${e?.message || e}`);
        }
      } else if (evt.data instanceof ArrayBuffer) {
        // Binary audio frame
        this.onLog(`rx binary frame; size=${evt.data.byteLength}`);
        this.audioPlayer.pushBinary(new Uint8Array(evt.data));
      } else if (evt.data instanceof Blob) {
        // Some servers may send Blob; convert to ArrayBuffer
        const size = evt.data.size;
        this.onLog(`rx blob frame; size=${size}`);
        evt.data.arrayBuffer().then((ab) => this.audioPlayer.pushBinary(new Uint8Array(ab)));
      }
    });

    this.ws.addEventListener('close', () => {
      const state = this.ws ? this.ws.readyState : WebSocket.CLOSED;
      this.onLog(`ws close; readyState=${state}`);
      this.started = false;
      // Keep the socket available for subsequent requests: auto-reconnect if server closed it and user did not manually disconnect.
      if (this.autoReconnect && !this.manuallyClosed) {
        if (this.reconnectTimer) {
          try { clearTimeout(this.reconnectTimer); } catch {}
          this.reconnectTimer = null;
        }
        this.reconnectTimer = setTimeout(() => {
          this.onLog('ws reconnecting...');
          try { this.connect(); } catch (e) { this.onLog(`ws reconnect error: ${e?.message || e}`); }
        }, this.reconnectDelayMs);
      }
    });

    this.ws.addEventListener('error', (e) => {
      this.onLog(`ws error: ${e?.message || 'unknown'}`);
      this.onError(e);
    });
  }

  async sendAudioBlob(blob) {
    if (!this.ws) throw new Error('WebSocket not connected');
    if (this.ws.readyState !== WebSocket.OPEN) {
      this.onLog(`ws.readyState=${this.ws.readyState}; skipped send (socket not open)`);
      return;
    }
    try {
      const ab = blob instanceof Blob ? await blob.arrayBuffer() : (blob instanceof ArrayBuffer ? blob : (blob?.buffer || null));
      if (!ab) {
        this.onLog('sendAudioBlob: unsupported payload');
        return;
      }
      const total = ab.byteLength || 0;
      const chunkSize = 64 * 1024; // 64KB chunks to help server framing
      let offset = 0;
      while (offset < total) {
        const end = Math.min(offset + chunkSize, total);
        const slice = ab.slice ? ab.slice(offset, end) : ab;
        const len = end - offset;
        this.onLog(`ws sending bytes=${len} (offset=${offset})`);
        this.ws.send(slice);
        offset = end;
        // yield to event loop to avoid flooding
        await Promise.resolve();
      }
      this.onLog(`ws send complete; total bytes=${total}`);
    } catch (e) {
      this.onLog(`sendAudioBlob error: ${e?.message || e}`);
    }
  }

  stop() {
    if (!this.ws) return;
    try {
      if (this.started && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'stop' }));
        this.onLog(`ws sent stop at ${new Date().toISOString()}`);
      }
    } catch {}
  }

  disconnect() {
    // Mark as manual disconnect so auto-reconnect doesn't kick in
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      try { clearTimeout(this.reconnectTimer); } catch {}
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.audioPlayer.reset();
    this.started = false;
  }
}

export default WebSocketChatTransport;
