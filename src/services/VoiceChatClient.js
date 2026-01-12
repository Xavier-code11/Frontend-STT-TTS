import Env from '../config/env';
import { MediaRecorderManager } from '../lib/audio/MediaRecorderManager';
import { WebSocketChatTransport } from './transports/WebSocketChatTransport';
import { HttpChatTransport } from './transports/HttpChatTransport';

export class VoiceChatClient {
  constructor({ mode = 'ws', sessionId = Env.SESSION_ID, language = Env.LANGUAGE, audioMime = Env.AUDIO_MIME, onLog = () => {}, onError = () => {}, onCrisis = () => {} } = {}) {
    this.mode = mode; // 'ws' or 'http'
    this.sessionId = sessionId;
    this.language = language;
    this.audioMime = audioMime;
    this.onLog = onLog;
    this.onError = onError;
    this.onCrisis = onCrisis;

    this.transport = null;
    this.recorder = null;

    // Audio element for playback
    this.audioEl = null;
  }

  attachAudioElement(audioElement) {
    this.audioEl = audioElement;
  }

  async init() {
    // Initialize recorder
    this.recorder = new MediaRecorderManager({
      preferredMime: this.audioMime,
      onChunk: (blob) => this._handleChunk(blob),
      onStart: () => this._handleStart(),
      onStop: () => this._handleStop(),
      onError: (e) => this.onError(e),
      onLog: (msg) => this.onLog(msg),
    });
    await this.recorder.init();

    // Initialize transport
    if (this.mode === 'ws') {
      this.transport = new WebSocketChatTransport({ sessionId: this.sessionId, language: this.language, onLog: this.onLog, onError: this.onError, onCrisis: this.onCrisis });
      this.transport.attachAudioElement(this.audioEl);
      this.transport.connect();
    } else {
      this.transport = new HttpChatTransport({ sessionId: this.sessionId, language: this.language, onLog: this.onLog, onError: this.onError });
      this.transport.attachAudioElement(this.audioEl);
    }
  }

  startRecording() {
    if (!this.recorder) throw new Error('Client not initialized');
    this.recorder.start();
  }

  stopRecording() {
    if (!this.recorder) return;
    this.recorder.stop();
  }

  async _handleStart() {
    this.onLog(`client start; mode=${this.mode}; start at ${new Date().toISOString()}`);
    // For WS: ensure socket is connected and send a fresh start on reused connection
    if (this.mode === 'ws' && this.transport) {
      try { this.transport.connect(); } catch {}
      try { this.transport.sendStart(); } catch {}
    }
  }

  async _handleStop() {
    this.onLog(`client stop at ${new Date().toISOString()}`);
    // For WebSocket mode, after recorder fully stops we now send ONE combined blob
    // so the server receives a complete, well-formed file for ffmpeg, then send stop.
    if (this.mode === 'ws' && this.transport) {
      const blob = this.recorder?.getCombinedBlob();
      if (!blob || blob.size === 0) {
        this.onLog('WS: no audio captured to send');
        this.transport.stop();
        return;
      }

      // If backend strictly prefers WAV, still recommend HTTP mode; WS sends native container.
      if (this.audioMime === 'audio/wav' && blob.type !== 'audio/wav') {
        this.onLog('WS warning: backend requires WAV; prefer HTTP mode for correct conversion.');
      }

      this.onLog(`WS sending combined blob; size=${blob.size}; type=${blob.type}`);
      await this.transport.sendAudioBlob(blob);
      // Only send stop after all bytes are flushed to the socket
      this.transport.stop();
    }
  }

  async _handleChunk(blob) {
    // If desired audio mime is not met, we still send the actual type; backend should handle.
    if (!blob || blob.size === 0) return;
    if (this.mode === 'ws') {
      // In WS mode we now only log per-chunk capture; actual send happens
      // once at stop using the combined blob, to avoid fragmented/corrupted
      // files on the server side.
      this.onLog(`WS chunk captured: size=${blob.size}; type=${blob.type}`);
    } else {
      // For HTTP, we aggregate in MediaRecorderManager.chunks and will combine on send.
    }
  }

  async sendHttp({ stream = true } = {}) {
    if (this.mode !== 'http') throw new Error('Not in HTTP mode');
    if (!this.transport) throw new Error('Transport not ready');
    const blob = this.recorder?.getCombinedBlob();
    if (!blob || blob.size === 0) { this.onError(new Error('No audio captured to send')); return; }
    // Convert to WAV if required
    let toSend = blob;
    if (this.audioMime === 'audio/wav' && blob.type !== 'audio/wav') {
      try {
        const { convertBlobToWav } = await import('../lib/audio/WavConverter');
        toSend = await convertBlobToWav(blob);
        this.onLog(`converted HTTP payload to WAV; size=${toSend.size}`);
      } catch (e) {
        this.onLog(`WAV conversion failed; sending original blob. ${e?.message || e}`);
      }
    }
    await this.transport.sendBlob(toSend, { stream });
  }

  destroy() {
    try {
      if (this.recorder) this.recorder.destroy();
      if (this.transport && this.transport.disconnect) this.transport.disconnect();
    } catch {}
  }
}

export default VoiceChatClient;
