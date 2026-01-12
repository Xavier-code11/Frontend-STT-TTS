// WavConverter: convert Blob (webm/ogg/etc.) to WAV using WebAudio.
// Note: Conversion introduces latency; prefer HTTP mode for ElevenLabs strict WAV.

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

function encodeWAV(floatBuffer, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // Convert float [-1,1] to 16-bit PCM
  const length = floatBuffer.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < floatBuffer.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, floatBuffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export async function convertBlobToWav(blob) {
  const ab = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuf = await audioCtx.decodeAudioData(ab);
  // Mixdown to mono if needed
  const channelData = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(0) : audioBuf.getChannelData(0);
  const wavBlob = encodeWAV(channelData, audioBuf.sampleRate);
  try { audioCtx.close(); } catch {}
  return wavBlob;
}

export default { convertBlobToWav };
