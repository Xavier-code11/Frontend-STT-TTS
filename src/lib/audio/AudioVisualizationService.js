// AudioVisualizationService: derives audio level from an HTMLAudioElement using WebAudio.
// Tries audioEl.captureStream() + createMediaStreamSource (widely supported in Chromium-based browsers).
// Falls back to 'playing' boolean if capture is unavailable.

export class AudioVisualizationService {
  constructor({ audioEl, smoothingTimeConstant = 0.8, fftSize = 2048, onLog = () => {} } = {}) {
    this.audioEl = audioEl;
    this.onLog = onLog;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.enabled = false;
    this.fallbackMode = false;
    this.rafId = null;
    this.onLevel = null; // function(level: 0..1)
    this.smoothingTimeConstant = smoothingTimeConstant;
    this.fftSize = fftSize;
  }

  async init() {
    try {
      if (!this.audioEl) {
        this.onLog('Visualizer init skipped: no audio element');
        this.enabled = false;
        return;
      }
      // Prefer captureStream to avoid audio routing changes
      const stream = this.audioEl.captureStream ? this.audioEl.captureStream() : (this.audioEl.mozCaptureStream ? this.audioEl.mozCaptureStream() : null);
      if (!stream) {
        this.onLog('Visualizer fallback: captureStream not supported');
        this.fallbackMode = true;
        this.enabled = true;
        return;
      }

      // Some environments return a MediaStream without audio tracks for <audio>. Guard that case.
      const audioTracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
      if (!audioTracks || audioTracks.length === 0) {
        this.onLog('Visualizer fallback: stream has no audio tracks');
        this.fallbackMode = true;
        this.enabled = true;
        return;
      }

      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.source.connect(this.analyser);
      this.enabled = true;
    } catch (e) {
      this.onLog(`Visualizer init error: ${e?.message || e}`);
      this.fallbackMode = true;
      this.enabled = true;
    }
  }

  start(onLevelCb) {
    this.onLevel = onLevelCb;
    if (!this.enabled) return;
    const loop = () => {
      if (!this.enabled) return;
      if (this.fallbackMode) {
        const level = (!this.audioEl.paused && !this.audioEl.ended) ? 0.5 : 0.0; // simple heartbeat
        this.onLevel && this.onLevel(level);
      } else if (this.analyser && this.dataArray) {
        this.analyser.getByteTimeDomainData(this.dataArray);
        // Compute simple peak-to-peak amplitude as level [0..1]
        let min = 255, max = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          const v = this.dataArray[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const amplitude = (max - min) / 255; // approx
        const level = Math.min(1, Math.max(0, amplitude * 2));
        this.onLevel && this.onLevel(level);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.enabled = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy() {
    try {
      this.stop();
      if (this.audioCtx) {
        this.audioCtx.close();
      }
    } catch {}
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
  }
}

export default AudioVisualizationService;
