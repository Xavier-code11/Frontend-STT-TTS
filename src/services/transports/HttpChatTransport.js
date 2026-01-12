import Env from '../../config/env';

export class HttpChatTransport {
  constructor({ sessionId = Env.SESSION_ID, language = Env.LANGUAGE, onLog = () => {}, onError = () => {} } = {}) {
    this.sessionId = sessionId;
    this.language = language;
    this.onLog = onLog;
    this.onError = onError;
    this.audioEl = null;
  }

  attachAudioElement(audioElement) {
    this.audioEl = audioElement;
  }

  // Send one captured audio blob to streaming endpoint; fallback to non-stream if requested
  async sendBlob(blob, { stream = true } = {}) {
    const base = new URL(Env.BACKEND_HTTP_URL);
    const path = stream ? '/api/v1/tts/stt-chat-tts-stream' : '/api/v1/tts/stt-chat-tts';
    base.pathname = path;

    const form = new FormData();
    // Prefer field name 'audio', fallback to 'file'
    form.append('audio', blob, 'audio');
    form.append('session_id', this.sessionId);
    form.append('language', this.language);

    this.onLog(`HTTP POST ${base.toString()} with blob.type=${blob?.type}`);

    try {
      const res = await fetch(base.toString(), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        this.onLog(`HTTP error ${res.status}: ${text}`);
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.startsWith('audio/')) {
        // Direct audio response
        const outBlob = await res.blob();
        const url = URL.createObjectURL(outBlob);
        this.audioEl.src = url;
        await this.audioEl.play().catch(() => {});
        return;
      }

      // Try stream reading (e.g., JSON frames or base64 segments). If not streaming, just parse JSON.
      const reader = res.body?.getReader ? res.body.getReader() : null;
      if (reader) {
        let chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          // Attempt to detect JSON messages
          const txt = new TextDecoder().decode(value);
          try {
            const msg = JSON.parse(txt);
            if (msg.event === 'audio_start') {
              this.onLog(`http stream: audio_start media_type=${msg.media_type}`);
              chunks = [];
            } else if (msg.event === 'audio_chunk_base64') {
              // If backend provides base64
              const bin = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              chunks.push(bin);
            } else if (msg.event === 'audio_end') {
              const outBlob = new Blob(chunks, { type: msg.media_type || 'audio/mpeg' });
              const url = URL.createObjectURL(outBlob);
              this.audioEl.src = url;
              await this.audioEl.play().catch(() => {});
            } else if (msg.event === 'error') {
              const detail = msg.detail || 'unknown';
              this.onLog(`http stream error: ${detail}`);
              if (detail === 'empty_audio') this.onError(new Error('No audio chunks were sent (empty_audio)'));
            }
          } catch {
            // If not JSON, assume raw audio bytes streaming (rare); buffer and play at end
            chunks.push(value);
          }
        }
        if (chunks.length > 0) {
          const outBlob = new Blob(chunks, { type: 'audio/mpeg' });
          const url = URL.createObjectURL(outBlob);
          this.audioEl.src = url;
          await this.audioEl.play().catch(() => {});
        }
        return;
      }

      // Fallback: parse JSON body for a single response
      const data = await res.json().catch(() => null);
      if (data && data.audio_base64 && data.media_type) {
        const bin = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
        const outBlob = new Blob([bin], { type: data.media_type });
        const url = URL.createObjectURL(outBlob);
        this.audioEl.src = url;
        await this.audioEl.play().catch(() => {});
      }
    } catch (e) {
      const msg = e?.message || String(e);
      this.onLog(`HTTP transport error: ${msg}`);
      this.onError(e);
    }
  }
}

export default HttpChatTransport;
