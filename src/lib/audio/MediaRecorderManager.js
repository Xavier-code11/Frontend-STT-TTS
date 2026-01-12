// MediaRecorderManager: wraps navigator.mediaDevices.getUserMedia and MediaRecorder,
// emits dataavailable chunks, logs sizes/types, and supports configurable mime.

export class MediaRecorderManager {
  constructor({ preferredMime, onChunk, onStart, onStop, onError, onLog } = {}) {
    this.preferredMime = preferredMime;
    this.onChunk = onChunk || (() => {});
    this.onStart = onStart || (() => {});
    this.onStop = onStop || (() => {});
    this.onError = onError || ((e) => console.error(e));
    this.onLog = onLog || ((msg) => console.log(msg));
    this.stream = null;
    this.recorder = null;
    this.mimeUsed = null;
    this.chunks = [];
  }

  async init() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        this.preferredMime,
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ].filter(Boolean);
      let chosen = null;
      for (const t of supportedTypes) {
        if (t && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) { chosen = t; break; }
      }
      chosen = chosen || undefined; // Let browser decide
      this.mimeUsed = chosen || 'audio/webm';
      this.recorder = new MediaRecorder(this.stream, chosen ? { mimeType: chosen } : undefined);
      this.recorder.addEventListener('dataavailable', (e) => {
        const blob = e.data;
        const size = blob?.size || 0;
        const type = blob?.type || 'unknown';
        this.onLog(`chunk: size=${size} bytes; blob.type=${type}`);
        if (size > 0) {
          // accumulate for HTTP/non-stream use
          this.chunks.push(blob);
          this.onChunk(blob);
        }
      });
      this.recorder.addEventListener('start', () => {
        this.onLog(`recorder start; mime=${this.mimeUsed}`);
        // reset chunks at start
        this.chunks = [];
        this.onStart({ mime: this.mimeUsed });
      });
      this.recorder.addEventListener('stop', () => {
        this.onLog('recorder stop');
        this.onStop();
      });
      this.recorder.addEventListener('error', (e) => {
        const detail = e?.error?.message || e?.message || 'unknown';
        this.onLog(`recorder error: ${detail}`);
        this.onError(e);
      });
    } catch (e) {
      const msg = e?.message || String(e);
      this.onLog(`init error: ${msg}`);
      this.onError(e);
    }
  }

  start(timesliceMs = 300) {
    if (!this.recorder) throw new Error('Recorder not initialized');
    if (this.recorder.state === 'recording') return;
    this.recorder.start(timesliceMs);
  }

  stop() {
    if (!this.recorder) return;
    if (this.recorder.state !== 'inactive') this.recorder.stop();
  }

  destroy() {
    try {
      this.stop();
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
      this.recorder = null;
    } catch {}
  }

  // Returns a combined Blob of all recorded chunks with best-effort type
  getCombinedBlob(typeOverride) {
    const type = typeOverride || (this.chunks.length > 0 ? (this.chunks[this.chunks.length - 1].type || 'application/octet-stream') : 'application/octet-stream');
    return new Blob(this.chunks, { type });
  }
}

export default MediaRecorderManager;
