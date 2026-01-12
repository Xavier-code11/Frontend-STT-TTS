// AudioStreamPlayer: handles streaming playback using MediaSource for audio/mpeg,
// falls back to buffering and playing once complete for unsupported types.

export class AudioStreamPlayer {
  constructor({ mime = 'audio/mpeg', onLog = () => {}, preferMSE = false } = {}) {
    this.mime = mime;
    this.onLog = onLog;
    this.preferMSE = preferMSE;
    this.audioEl = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.queue = [];
    this.initialized = false;
    this.ended = false;
    this.bufferedBlobParts = [];
    this.useMSE = false;
    this.fallbackActivated = false;
    this.firstChunkLogged = false;
  }

  attach(audioElement) {
    this.audioEl = audioElement;
  }

  start(mimeFromServer, { preferMSE } = {}) {
    const useMime = mimeFromServer || this.mime;
    this.mime = useMime;
    this.onLog(`audio_start; mime=${useMime}`);
    const wantMSE = typeof preferMSE === 'boolean' ? preferMSE : this.preferMSE;
    if (wantMSE && window.MediaSource && useMime === 'audio/mpeg') {
      this.mediaSource = new MediaSource();
      this.audioEl.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', () => {
        try {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
          this.initialized = true;
          this.useMSE = true;
          this.sourceBuffer.addEventListener('updateend', () => {
            if (this.queue.length > 0 && !this.sourceBuffer.updating) {
              const chunk = this.queue.shift();
              this.sourceBuffer.appendBuffer(chunk);
            } else if (this.ended && !this.sourceBuffer.updating) {
              this.mediaSource.endOfStream();
            }
          });
          this.audioEl.play().catch(() => {});
        } catch (e) {
          this.onLog(`MediaSource init error: ${e?.message || e}`);
          this.mediaSource = null;
          this.useMSE = false;
          // Fallback buffering
          this.bufferedBlobParts = [];
        }
      });
    } else {
      // Fallback buffering
      this.bufferedBlobParts = [];
      this.useMSE = false;
    }
  }

  pushBinary(arrayBufferOrUint8) {
    const byteLength = arrayBufferOrUint8 instanceof ArrayBuffer ? arrayBufferOrUint8.byteLength : (arrayBufferOrUint8?.byteLength || arrayBufferOrUint8?.length || 0);
    this.onLog(`rx binary: size=${byteLength}`);
    if (this.useMSE && this.mediaSource && this.sourceBuffer && !this.fallbackActivated) {
      const data = arrayBufferOrUint8 instanceof ArrayBuffer ? new Uint8Array(arrayBufferOrUint8) : arrayBufferOrUint8;
      if (this.sourceBuffer.updating || !this.initialized) {
        this.queue.push(data);
      } else {
        try {
          this.sourceBuffer.appendBuffer(data);
        } catch (e) {
          this.onLog(`appendBuffer error: ${e?.message || e}`);
          // Switch to fallback: start buffering all upcoming chunks including current data
          this.fallbackActivated = true;
          // Log first-chunk hex to help debug container issues
          if (!this.firstChunkLogged) {
            const hex = Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            this.onLog(`first-chunk-hex: ${hex}`);
            this.firstChunkLogged = true;
          }
          try {
            const buf = data.buffer ? data.buffer : data;
            this.bufferedBlobParts.push(buf);
          } catch {}
        }
      }
    } else {
      // Buffer until end and then play
      const buf = arrayBufferOrUint8 instanceof ArrayBuffer ? arrayBufferOrUint8 : arrayBufferOrUint8.buffer;
      this.bufferedBlobParts.push(buf);
    }
  }

  end() {
    this.onLog('audio_end');
    if (this.mediaSource && this.sourceBuffer) {
      this.ended = true;
      if (!this.sourceBuffer.updating) {
        try { this.mediaSource.endOfStream(); } catch {}
      }
    }
    // Always fallback play if we have buffered parts (either explicit fallback or after MSE failure)
    if (this.bufferedBlobParts.length > 0) {
      const blob = new Blob(this.bufferedBlobParts, { type: this.mime });
      const url = URL.createObjectURL(blob);
      this.audioEl.src = url;
      this.audioEl.play().catch(() => {});
      // Reset buffer
      this.bufferedBlobParts = [];
    }
  }

  reset() {
    try {
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.removeAttribute('src');
        this.audioEl.load();
      }
      if (this.mediaSource) {
        this.mediaSource = null;
      }
      this.sourceBuffer = null;
      this.queue = [];
      this.initialized = false;
      this.ended = false;
      this.bufferedBlobParts = [];
      this.useMSE = false;
      this.fallbackActivated = false;
      this.firstChunkLogged = false;
    } catch {}
  }
}

export default AudioStreamPlayer;
