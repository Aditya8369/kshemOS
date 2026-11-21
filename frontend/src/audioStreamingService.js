/**
 * Real-Time Audio Streaming Service for KshemOS Voice Deepfake Detector.
 *
 * Connects to the backend WebSocket at /api/voice-deepfake/stream:
 * - Initializes Web Audio API AudioWorkletNode with audioWorkletProcessor
 * - Captures live microphone audio at 16 kHz mono PCM
 * - Transmits binary PCM chunks to the backend
 * - Receives real-time spectral & acoustic telemetry
 * - Provides simulated PCM streams for ElevenLabs deepfakes and natural voice
 */

export class VoiceDeepfakeStreamClient {
  constructor(options = {}) {
    this.options = options;
    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.simulationInterval = null;
    this.listeners = new Set();
  }

  getWebSocketUrl() {
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      const clean = apiBase.replace(/^http/, 'ws').replace(/\/+$/, '');
      return `${clean}/api/voice-deepfake/stream`;
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/api/voice-deepfake/stream`;
    }
    return 'ws://localhost:8000/api/voice-deepfake/stream';
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = this.getWebSocketUrl();
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.isConnected = true;
          this.notify({ type: 'status', status: 'connected', wsUrl });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.notify(data);
          } catch (e) {
            console.error('Failed to parse telemetry JSON:', e);
          }
        };

        this.ws.onerror = (err) => {
          this.notify({ type: 'error', error: 'WebSocket connection error' });
          reject(err);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.isStreaming = false;
          this.notify({ type: 'status', status: 'disconnected' });
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async startMicrophoneStream() {
    await this.connect();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Web Audio mediaDevices.getUserMedia not supported on this browser.');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // AudioWorklet module code as inline Blob URL for 100% reliable loading across environments
    const workletCode = `
      class AudioCaptureProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.targetSampleRate = 16000;
          this.chunkSize16k = 2400; // ~150ms
          this.pcmBuffer = new Int16Array(this.chunkSize16k);
          this.pcmIndex = 0;
          this.resampleOffset = 0.0;
        }
        process(inputs) {
          const input = inputs[0];
          if (!input || !input[0] || input[0].length === 0) return true;
          const channel = input[0];
          const curSampleRate = typeof sampleRate !== 'undefined' ? sampleRate : 48000;
          const ratio = curSampleRate / this.targetSampleRate;
          let inIdx = this.resampleOffset;
          while (inIdx < channel.length) {
            const idxFloor = Math.floor(inIdx);
            const idxCeil = Math.min(channel.length - 1, idxFloor + 1);
            const frac = inIdx - idxFloor;
            const sample = channel[idxFloor] * (1 - frac) + channel[idxCeil] * frac;
            const clamped = Math.max(-1.0, Math.min(1.0, sample));
            this.pcmBuffer[this.pcmIndex++] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
            if (this.pcmIndex >= this.chunkSize16k) {
              const out = new Int16Array(this.pcmBuffer);
              this.port.postMessage({ buffer: out.buffer }, [out.buffer]);
              this.pcmIndex = 0;
            }
            inIdx += ratio;
          }
          this.resampleOffset = inIdx - channel.length;
          return true;
        }
      }
      registerProcessor('audio-capture-processor', AudioCaptureProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);

    try {
      await this.audioContext.audioWorklet.addModule(workletUrl);
    } catch {
      // Fallback to static URL
      await this.audioContext.audioWorklet.addModule('/audioWorkletProcessor.js');
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

    this.workletNode.port.onmessage = (event) => {
      if (event.data && event.data.buffer && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(event.data.buffer);
      }
    };

    sourceNode.connect(this.workletNode);
    // Connect to silent gain node so worklet processor stays active
    const muteGain = this.audioContext.createGain();
    muteGain.gain.value = 0.0;
    this.workletNode.connect(muteGain);
    muteGain.connect(this.audioContext.destination);

    this.isStreaming = true;
    this.notify({ type: 'streaming_started', source: 'microphone' });
  }

  async startSimulatedStream(mode = 'synthetic') {
    await this.connect();
    this.stopStreaming();

    this.isStreaming = true;
    this.notify({ type: 'streaming_started', source: `simulation_${mode}` });

    // Generate 150ms 16kHz PCM chunks (~2400 samples)
    const samplesPerChunk = 2400;
    let phase = 0.0;
    const baseFreq = mode === 'synthetic' ? 220.0 : 180.0; // Synthetic clone vs natural voice

    this.simulationInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.stopStreaming();
        return;
      }

      const pcm16 = new Int16Array(samplesPerChunk);
      for (let i = 0; i < samplesPerChunk; i++) {
        let f = baseFreq;
        if (mode === 'natural') {
          // Natural biological voice: Organic pitch micro-jitter (0.8%) & breath fluctuations
          f += Math.sin(phase * 0.03) * 6.0 + (Math.random() - 0.5) * 2.5;
        } else {
          // Synthetic voice: Rigid robotic flatline with vocoder 8kHz cutoff harmonics
          f += (Math.random() - 0.5) * 0.15; // Jitter < 0.1%
        }

        const sample = Math.sin(phase) * 0.65 + Math.sin(phase * 2.0) * 0.25;
        pcm16[i] = Math.round(sample * 30000);
        phase += (2 * Math.PI * f) / 16000;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
      }

      this.ws.send(pcm16.buffer);
    }, 150);
  }

  stopStreaming() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isStreaming = false;
    this.notify({ type: 'streaming_stopped' });
  }

  disconnect() {
    this.stopStreaming();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(data) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('Audio streaming listener error:', e);
      }
    });
  }
}

export const defaultAudioStreamingClient = new VoiceDeepfakeStreamClient();
