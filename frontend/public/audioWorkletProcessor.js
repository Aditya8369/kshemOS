/**
 * AudioWorkletProcessor for Live Audio Ingestion in KshemOS.
 *
 * Runs on the dedicated Web Audio rendering thread without blocking the UI thread.
 * Captures microphone audio, downsamples from native AudioContext sample rate (44.1k/48k)
 * to standard 16 kHz mono, converts float32 to 16-bit signed PCM binary chunks,
 * and posts them via transferable ArrayBuffers to the main thread for WebSocket streaming.
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkDurationMs = 150; // Emit chunks every ~150ms (~2400 samples)
    this.chunkSize16k = Math.round((this.targetSampleRate * this.chunkDurationMs) / 1000);
    this.pcmBuffer = new Int16Array(this.chunkSize16k);
    this.pcmBufferIndex = 0;
    this.resampleOffset = 0.0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const currentSampleRate = typeof sampleRate !== 'undefined' ? sampleRate : 48000;
    const ratio = currentSampleRate / this.targetSampleRate;

    let inIdx = this.resampleOffset;
    while (inIdx < channelData.length) {
      const idxFloor = Math.floor(inIdx);
      const idxCeil = Math.min(channelData.length - 1, idxFloor + 1);
      const frac = inIdx - idxFloor;

      const sample = channelData[idxFloor] * (1 - frac) + channelData[idxCeil] * frac;

      const clamped = Math.max(-1.0, Math.min(1.0, sample));
      const pcm16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);

      this.pcmBuffer[this.pcmBufferIndex++] = pcm16;

      if (this.pcmBufferIndex >= this.chunkSize16k) {
        const outputBuffer = new Int16Array(this.pcmBuffer);
        this.port.postMessage(
          {
            type: 'pcm_chunk',
            buffer: outputBuffer.buffer,
            sampleRate: this.targetSampleRate,
            samplesCount: this.chunkSize16k,
          },
          [outputBuffer.buffer]
        );
        this.pcmBufferIndex = 0;
      }

      inIdx += ratio;
    }

    this.resampleOffset = inIdx - channelData.length;
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
