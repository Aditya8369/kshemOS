import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Play,
  Square,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  FileAudio,
  Upload,
  RefreshCw,
  PhoneCall,
  Activity,
  Waves,
  Zap,
  Info,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Pause,
  Flame,
} from 'lucide-react';

import {
  analyzeVoiceRecordingApi,
  listVoiceDeepfakeInspectionsApi,
  fetchVoiceDeepfakeStatsApi,
} from '../api';

import {
  TACTICAL_CITIZEN_GUIDANCE,
  TACTICAL_CHECKLIST,
  VOICE_DEEPFAKE_PRESETS,
} from '../voiceDeepfakeStore';

import { defaultAudioStreamingClient } from '../audioStreamingService';

export default function VoiceDeepfakeDetectorView() {
  // Mode State: Real-Time WebSocket Streaming vs Pre-Recorded File Inspector
  const [activeMode, setActiveMode] = useState('stream'); // 'stream' | 'static'

  // Real-Time Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamSource, setStreamSource] = useState(null); // 'microphone' | 'simulation_synthetic' | 'simulation_natural'
  const [streamStatus, setStreamStatus] = useState('disconnected');
  const [streamError, setStreamError] = useState(null);
  const [streamTelemetry, setStreamTelemetry] = useState({
    synthetic_prob: 0.05,
    jitter_pct: 0.82,
    shimmer_pct: 2.30,
    hnr_db: 18.4,
    spectral_flux: 0.08,
    jitter_anomaly: false,
    shimmer_anomaly: false,
    hnr_anomaly: false,
    vocoder_footprint_score: 0.06,
    risk_band: 'LOW_PROBABILITY_NATURAL',
    buffer_duration_sec: 0.0,
    tactical_guidance: TACTICAL_CITIZEN_GUIDANCE,
    amplitudes: [],
  });
  const [rollingAmplitudes, setRollingAmplitudes] = useState([]);
  const canvasRef = useRef(null);

  // Subscribe to WebSocket Streaming Service
  useEffect(() => {
    const unsubscribe = defaultAudioStreamingClient.subscribe((msg) => {
      if (msg.type === 'telemetry') {
        setStreamTelemetry(msg);
        if (Array.isArray(msg.amplitudes) && msg.amplitudes.length > 0) {
          setRollingAmplitudes(msg.amplitudes);
        }
      } else if (msg.type === 'status') {
        setStreamStatus(msg.status);
      } else if (msg.type === 'streaming_started') {
        setIsStreaming(true);
        setStreamSource(msg.source);
        setStreamError(null);
      } else if (msg.type === 'streaming_stopped') {
        setIsStreaming(false);
        setStreamSource(null);
      } else if (msg.type === 'error') {
        setStreamError(msg.error);
      }
    });

    return () => {
      unsubscribe();
      defaultAudioStreamingClient.stopStreaming();
    };
  }, []);

  // Rolling Canvas Waveform Visualizer with color-coded synthetic anomaly spans
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Canvas background
    ctx.fillStyle = '#060B14';
    ctx.fillRect(0, 0, width, height);

    // 0.5s to 3.0s time grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let s = 1; s <= 6; s++) {
      const x = (width / 6) * s;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '10px monospace';
      ctx.fillText(`${(s * 0.5).toFixed(1)}s`, x - 26, height - 6);
    }

    // Midline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    const amps = rollingAmplitudes;
    if (amps.length === 0) {
      // Idle line
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      return;
    }

    const isHighSynthetic = streamTelemetry.synthetic_prob >= 0.70 || streamTelemetry.jitter_anomaly;
    const isSuspicious = streamTelemetry.synthetic_prob >= 0.40;

    let strokeColor = '#10B981'; // Natural Green
    let glowColor = 'rgba(16, 185, 129, 0.4)';
    let fillColor = 'rgba(16, 185, 129, 0.15)';

    if (isHighSynthetic) {
      strokeColor = '#EF4444'; // Red Anomaly
      glowColor = 'rgba(239, 68, 68, 0.6)';
      fillColor = 'rgba(239, 68, 68, 0.25)';
    } else if (isSuspicious) {
      strokeColor = '#F59E0B'; // Amber
      glowColor = 'rgba(245, 158, 11, 0.5)';
      fillColor = 'rgba(245, 158, 11, 0.18)';
    }

    // Highlight synthetic anomaly span zone
    if (isHighSynthetic) {
      const anomalyStart = width * 0.25;
      const anomalyWidth = width * 0.65;
      const anomalyGrad = ctx.createLinearGradient(anomalyStart, 0, anomalyStart + anomalyWidth, 0);
      anomalyGrad.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
      anomalyGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.22)');
      anomalyGrad.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
      ctx.fillStyle = anomalyGrad;
      ctx.fillRect(anomalyStart, 0, anomalyWidth, height);

      // Warning label on the anomaly span
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('⚡ SYNTHETIC ANOMALY SPAN: PITCH FREEZE & VOCODER PHASE RINGING', anomalyStart + 15, 20);

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.strokeRect(anomalyStart, 0, anomalyWidth, height);
    }

    // Draw symmetrical waveform curve
    ctx.beginPath();
    const stepX = width / Math.max(1, amps.length - 1);

    ctx.moveTo(0, midY);
    for (let i = 0; i < amps.length; i++) {
      const x = i * stepX;
      const val = amps[i] || 0.04;
      const y = midY - val * (midY - 18);
      ctx.lineTo(x, y);
    }

    for (let i = amps.length - 1; i >= 0; i--) {
      const x = i * stepX;
      const val = amps[i] || 0.04;
      const y = midY + val * (midY - 18);
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isHighSynthetic ? 12 : 6;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw live scanning playhead line
    const headX = (amps.length - 1) * stepX;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX, 0);
    ctx.lineTo(headX, height);
    ctx.stroke();
  }, [rollingAmplitudes, streamTelemetry]);

  // Streaming Control Actions
  async function handleToggleMicStream() {
    try {
      setStreamError(null);
      if (isStreaming && streamSource === 'microphone') {
        defaultAudioStreamingClient.stopStreaming();
      } else {
        await defaultAudioStreamingClient.startMicrophoneStream();
      }
    } catch (err) {
      setStreamError(`Microphone access error: ${err.message}. Try the simulated stream buttons below.`);
    }
  }

  function handleStartSimulation(mode = 'synthetic') {
    setStreamError(null);
    defaultAudioStreamingClient.startSimulatedStream(mode);
  }

  function handleStopStream() {
    defaultAudioStreamingClient.stopStreaming();
  }

  // Pre-recorded Input state
  const [selectedPresetId, setSelectedPresetId] = useState('preset-elevenlabs-kidnapping');
  const [audioFileName, setAudioFileName] = useState(VOICE_DEEPFAKE_PRESETS[0].fileName);
  const [claimedIdentity, setClaimedIdentity] = useState(VOICE_DEEPFAKE_PRESETS[0].claimedIdentity);
  const [scamContext, setScamContext] = useState(VOICE_DEEPFAKE_PRESETS[0].scamContext);
  const [durationSeconds, setDurationSeconds] = useState(VOICE_DEEPFAKE_PRESETS[0].durationSeconds);
  const [audioPayload, setAudioPayload] = useState(VOICE_DEEPFAKE_PRESETS[0].samplePayload);
  const [saveToVault, setSaveToVault] = useState(true);

  // Analysis result & UI state
  const [analyzing, setAnalyzing] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [selectedSpanIndex, setSelectedSpanIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // History & stats
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    total_evaluated: 0,
    high_synthetic_detected: 0,
    suspicious_detected: 0,
    natural_confirmed: 0,
    vault_evidence_preserved: 0,
  });

  const fileInputRef = useRef(null);

  // Load initial stats & history
  useEffect(() => {
    loadHistoryAndStats();
    // Run initial analysis for the default preset
    handleAnalyze();
  }, []);

  async function loadHistoryAndStats() {
    try {
      const [histData, statsData] = await Promise.all([
        listVoiceDeepfakeInspectionsApi(),
        fetchVoiceDeepfakeStatsApi(),
      ]);
      if (Array.isArray(histData)) {
        setHistory(histData);
      }
      if (statsData) {
        setStats(statsData);
      }
    } catch (err) {
      console.warn('Failed to load deepfake history/stats:', err);
    }
  }

  function handleSelectPreset(preset) {
    setSelectedPresetId(preset.id);
    setAudioFileName(preset.fileName);
    setClaimedIdentity(preset.claimedIdentity);
    setScamContext(preset.scamContext);
    setDurationSeconds(preset.durationSeconds);
    setAudioPayload(preset.samplePayload);
    setSelectedSpanIndex(null);
    setIsPlaying(false);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedPresetId('');
    setAudioFileName(file.name);
    setSelectedSpanIndex(null);
    setIsPlaying(false);

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target.result;
      setAudioPayload(result);
      // Rough estimation of duration
      const estDuration = Math.max(3.0, Math.min(30.0, Math.round(file.size / 32000)));
      setDurationSeconds(estDuration);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setSelectedSpanIndex(null);
    setIsPlaying(false);
    try {
      const payload = {
        audio_data: audioPayload || 'synthetic_elevenlabs_sample',
        file_name: audioFileName || 'recording.wav',
        duration_seconds: parseFloat(durationSeconds) || 6.5,
        caller_claimed_identity: claimedIdentity || 'Unspecified caller',
        scam_context: scamContext || 'Digital Arrest Verification',
        save_to_evidence_vault: saveToVault,
      };

      const result = await analyzeVoiceRecordingApi(payload);
      setInspectionResult(result);
      await loadHistoryAndStats();
    } catch (err) {
      console.error('Deepfake analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleCopyHash(hash) {
    if (!hash) return;
    navigator.clipboard?.writeText?.(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  function togglePlayback() {
    setIsPlaying(!isPlaying);
  }

  // Waveform bars generator
  const waveformBars = Array.from({ length: 48 }, (_, i) => {
    const progress = i / 48;
    const duration = inspectionResult?.duration_seconds || durationSeconds || 6.0;
    const currentMs = progress * duration * 1000;

    // Check if this point falls into any anomaly span
    const matchingSpan = inspectionResult?.anomaly_spans?.find(
      (s) => currentMs >= s.start_ms && currentMs <= s.end_ms
    );

    // Natural vs synthetic amplitude pattern
    const isSynthetic = inspectionResult?.risk_band === 'HIGH_PROBABILITY_SYNTHETIC';
    let baseHeight = Math.sin(i * 0.45) * 35 + 50;
    if (isSynthetic && matchingSpan?.anomaly_type === 'PITCH_FREEZE_FLATLINING') {
      baseHeight = 65; // Unnaturally flat
    } else {
      baseHeight = Math.max(20, Math.min(95, baseHeight + (i % 5) * 6));
    }

    return {
      index: i,
      height: baseHeight,
      span: matchingSpan,
    };
  });

  const isHighRisk = inspectionResult?.risk_band === 'HIGH_PROBABILITY_SYNTHETIC';
  const isSuspicious = inspectionResult?.risk_band === 'SUSPICIOUS';
  const isNatural = inspectionResult?.risk_band === 'LOW_PROBABILITY_NATURAL';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
                <Waves className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Voice Deepfake & Synthetic Audio Impersonation Detector
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Acoustic Forensics
                  </span>
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  Acoustic micro-tremor analysis (jitter/shimmer), neural vocoder phase smearing detection,
                  and immediate reverse verification directives for digital arrest extortion.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-400">Total Analyzed:</span>
              <span className="font-bold text-white">{stats.total_evaluated}</span>
            </div>
            <div className="bg-red-950/50 border border-red-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="text-red-300">Synthetic Clones:</span>
              <span className="font-bold text-red-200">{stats.high_synthetic_detected}</span>
            </div>
            <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300">Natural Confirmed:</span>
              <span className="font-bold text-emerald-200">{stats.natural_confirmed}</span>
            </div>
            <div className="bg-blue-950/50 border border-blue-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300">Vault Sealed:</span>
              <span className="font-bold text-blue-200">{stats.vault_evidence_preserved}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('stream')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMode === 'stream'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Radio className={`w-4 h-4 ${isStreaming ? 'animate-pulse text-red-400' : ''}`} />
            Real-Time WebSocket Stream (Live 16kHz Waveform)
            {isStreaming && (
              <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('static')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMode === 'static'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <FileAudio className="w-4 h-4" />
            Pre-Recorded Audio File Inspector (.wav, .mp3, .m4a)
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
          WS Route: <span className="text-indigo-400">/api/voice-deepfake/stream</span>
        </div>
      </div>

      {/* MODE 1: REAL-TIME WEBSOCKET STREAMING WITH ROLLING WAVEFORM */}
      {activeMode === 'stream' && (
        <div className="space-y-6">
          {/* Stream Controls & Telemetry Status Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-indigo-500" />
                  Live Audio Stream Controller (16 kHz Mono PCM)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Web Audio Worklet processes mic or simulated audio in a rolling 3-second sliding window buffer.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                    isStreaming
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : streamStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isStreaming
                        ? 'bg-red-500 animate-ping'
                        : streamStatus === 'connected'
                        ? 'bg-emerald-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  {isStreaming
                    ? `LIVE STREAMING (${streamSource?.toUpperCase()})`
                    : streamStatus === 'connected'
                    ? 'CONNECTED / READY'
                    : 'STANDBY'}
                </span>

                <span className="text-xs font-mono text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  Buffer: {streamTelemetry.buffer_duration_sec}s / 3.0s
                </span>
              </div>
            </div>

            {/* Stream Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleToggleMicStream}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                  isStreaming && streamSource === 'microphone'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                }`}
              >
                <Mic className="w-4 h-4" />
                {isStreaming && streamSource === 'microphone'
                  ? 'Stop Microphone'
                  : 'Capture Live Microphone'}
              </button>

              <button
                type="button"
                onClick={() => handleStartSimulation('synthetic')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  isStreaming && streamSource === 'simulation_synthetic'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                }`}
              >
                <Flame className="w-4 h-4 text-red-400" />
                Simulate ElevenLabs Clone Stream
              </button>

              <button
                type="button"
                onClick={() => handleStartSimulation('natural')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  isStreaming && streamSource === 'simulation_natural'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Simulate Natural Human Voice Stream
              </button>

              {isStreaming && (
                <button
                  type="button"
                  onClick={handleStopStream}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Stream
                </button>
              )}
            </div>

            {streamError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{streamError}</span>
              </div>
            )}
          </div>

          {/* Interactive Rolling Canvas Waveform Visualizer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Real-Time Rolling Waveform & Synthetic Anomaly Visualizer
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Natural
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Suspicious
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Synthetic Anomaly
                </span>
              </div>
            </div>

            {/* Live Canvas Element */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-52 bg-[#060B14] block"
              />

              {/* Dynamic HUD Overlay */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono text-white flex items-center gap-3">
                <div>
                  <span className="text-slate-400">Score: </span>
                  <strong
                    className={
                      streamTelemetry.synthetic_prob >= 0.70
                        ? 'text-red-400'
                        : streamTelemetry.synthetic_prob >= 0.40
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {Math.round(streamTelemetry.synthetic_prob * 100)}%
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Flux: </span>
                  <span className="text-cyan-300 font-bold">{streamTelemetry.spectral_flux}</span>
                </div>
                <div>
                  <span className="text-slate-400">Jitter: </span>
                  <span
                    className={
                      streamTelemetry.jitter_anomaly ? 'text-red-400 font-bold' : 'text-slate-200'
                    }
                  >
                    {streamTelemetry.jitter_pct}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Spectral Telemetry HUD Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Synthetic Probability Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                streamTelemetry.synthetic_prob >= 0.70
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700'
                  : streamTelemetry.synthetic_prob >= 0.40
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
              }`}
            >
              <div className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">
                Synthetic Probability
              </div>
              <div
                className={`text-3xl font-extrabold mt-1 ${
                  streamTelemetry.synthetic_prob >= 0.70
                    ? 'text-red-600 dark:text-red-400'
                    : streamTelemetry.synthetic_prob >= 0.40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {Math.round(streamTelemetry.synthetic_prob * 100)}%
              </div>
              <div className="text-[10px] font-bold mt-1 uppercase">
                {streamTelemetry.risk_band.replace(/_/g, ' ')}
              </div>
            </div>

            {/* Pitch Jitter Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">
                Pitch Jitter (F0 Micro-tremor)
              </div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  streamTelemetry.jitter_anomaly
                    ? 'text-red-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {streamTelemetry.jitter_pct}%
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {streamTelemetry.jitter_anomaly ? (
                  <span className="text-red-400 font-bold">⚠ ROBOTIC PITCH FREEZE (&lt;0.25%)</span>
                ) : (
                  'Normal Human Range (0.5% - 1.5%)'
                )}
              </div>
            </div>

            {/* Amplitude Shimmer Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">
                Amplitude Shimmer
              </div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  streamTelemetry.shimmer_anomaly
                    ? 'text-amber-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {streamTelemetry.shimmer_pct}%
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {streamTelemetry.shimmer_anomaly ? (
                  <span className="text-amber-400 font-bold">⚠ STATIC LEVEL (&lt;1.0%)</span>
                ) : (
                  'Normal Human Range (1.5% - 3.8%)'
                )}
              </div>
            </div>

            {/* Harmonics-to-Noise Ratio & Spectral Flux */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">
                HNR & Spectral Flux
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {streamTelemetry.hnr_db} <span className="text-sm font-normal text-slate-400">dB</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Spectral Flux: <strong className="text-cyan-400 font-mono">{streamTelemetry.spectral_flux}</strong>
              </div>
            </div>
          </div>

          {/* Tactical Citizen Guidance Banner for Streaming */}
          <div className="bg-gradient-to-br from-amber-500/10 via-red-500/10 to-amber-500/5 dark:from-amber-950/40 dark:via-red-950/30 dark:to-slate-900 border-2 border-amber-500/50 rounded-xl p-5 shadow-md space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-lg shadow-md shrink-0">
                <PhoneCall className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Immediate Tactical Citizen Guidance
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  &ldquo;{streamTelemetry.tactical_guidance || TACTICAL_CITIZEN_GUIDANCE}&rdquo;
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  If the caller claims an urgent kidnapping, hospital emergency, or police arrest warrant, disconnect immediately and perform a reverse call directly to the known number.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {TACTICAL_CHECKLIST.slice(0, 4).map((step, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/80 border border-amber-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 flex items-start gap-2"
                >
                  <span className="font-bold text-amber-600 dark:text-amber-400">{idx + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: PRE-RECORDED FILE INSPECTOR */}
      {activeMode === 'static' && (
        <div className="space-y-6">
      {/* Preset Quick Selectors */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            Rapid Forensic Audio Presets (.wav, .mp3, .m4a)
          </label>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Click to load real-world digital-arrest scenarios
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {VOICE_DEEPFAKE_PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-3.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {p.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      p.expectedRisk === 'HIGH_PROBABILITY_SYNTHETIC'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {p.expectedRisk === 'HIGH_PROBABILITY_SYNTHETIC' ? 'Deepfake' : 'Natural'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                  {p.subtitle}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-700/60 pt-2 mt-1">
                  <span>Claimed: {p.claimedIdentity}</span>
                  <span>{p.durationSeconds}s</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Configuration & File Ingestion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-indigo-500" />
            Audio Recording Parameters
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Audio File or Voicemail Upload (.wav, .mp3, .m4a)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="audio/*,.wav,.mp3,.m4a"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-indigo-400 dark:border-indigo-600 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Audio Snippet
              </button>
            </div>
            {audioFileName && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
                Selected: {audioFileName} ({durationSeconds}s)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Caller Claimed Identity
            </label>
            <input
              type="text"
              value={claimedIdentity}
              onChange={(e) => setClaimedIdentity(e.target.value)}
              placeholder="e.g. Grandson (Aarav), CBI Director, Delhi Police"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Investigation / Extortion Context
            </label>
            <input
              type="text"
              value={scamContext}
              onChange={(e) => setScamContext(e.target.value)}
              placeholder="e.g. Virtual Kidnapping / Video Arrest Demand"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={saveToVault}
                onChange={(e) => setSaveToVault(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Seal audio in Evidence Vault (BNS § 318 Legal Hold)</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Measuring Acoustic Spectra...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Inspect Acoustic Harmonics
              </>
            )}
          </button>
        </div>

        {/* Interactive Waveform Visualizer & Anomaly Spans */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                Interactive Acoustic Waveform & Anomaly Timeline
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {isPlaying ? <Square className="w-3.5 h-3.5 text-red-500 fill-current" /> : <Play className="w-3.5 h-3.5 text-indigo-500 fill-current" />}
                  {isPlaying ? 'Stop' : 'Play Snippet'}
                </button>
              </div>
            </div>

            {/* Simulated Interactive Waveform Canvas */}
            <div className="relative bg-slate-950 rounded-xl p-5 border border-slate-800 overflow-hidden">
              <div className="flex items-end justify-between h-32 gap-1 px-1">
                {waveformBars.map((bar) => {
                  let barColor = 'bg-slate-700 hover:bg-slate-500';
                  if (bar.span) {
                    if (bar.span.anomaly_type === 'PITCH_FREEZE_FLATLINING') {
                      barColor = 'bg-red-500 hover:bg-red-400';
                    } else if (bar.span.anomaly_type === 'VOCODER_HIGH_FREQ_SMEARING') {
                      barColor = 'bg-amber-500 hover:bg-amber-400';
                    } else if (bar.span.anomaly_type === 'ABSENCE_OF_PHYSIOLOGICAL_RESPIRATION') {
                      barColor = 'bg-orange-500 hover:bg-orange-400';
                    } else if (bar.span.anomaly_type === 'TRANSPUSED_CONV_CHECKERBOARD') {
                      barColor = 'bg-purple-500 hover:bg-purple-400';
                    } else if (bar.span.anomaly_type.includes('NATURAL') || bar.span.anomaly_type.includes('BIOLOGICAL')) {
                      barColor = 'bg-emerald-500 hover:bg-emerald-400';
                    }
                  }

                  return (
                    <div
                      key={bar.index}
                      title={bar.span ? `${bar.span.anomaly_type} (${bar.span.explanation})` : 'Acoustic Frame'}
                      onClick={() => {
                        if (bar.span) {
                          const idx = inspectionResult?.anomaly_spans?.findIndex(
                            (s) => s.anomaly_type === bar.span.anomaly_type
                          );
                          if (idx !== -1) setSelectedSpanIndex(idx);
                        }
                      }}
                      className={`flex-1 transition-all rounded-t-sm cursor-pointer ${barColor}`}
                      style={{ height: `${bar.height}%` }}
                    />
                  );
                })}
              </div>

              {/* Timecode markers */}
              <div className="flex justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2 mt-2">
                <span>0.00s</span>
                <span>{((inspectionResult?.duration_seconds || durationSeconds || 6.0) / 2).toFixed(2)}s</span>
                <span>{(inspectionResult?.duration_seconds || durationSeconds || 6.0).toFixed(2)}s</span>
              </div>
            </div>
          </div>

          {/* Anomaly Spans Legend & Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              Detected Acoustic Anomaly Spans ({inspectionResult?.anomaly_spans?.length || 0})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {inspectionResult?.anomaly_spans?.map((span, idx) => {
                const isSelected = selectedSpanIndex === idx;
                const isSevere = span.severity === 'critical' || span.severity === 'high';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSpanIndex(idx)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:border-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold text-[11px] truncate">
                        {(span.start_ms / 1000).toFixed(1)}s - {(span.end_ms / 1000).toFixed(1)}s
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          isSevere
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {span.severity}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                      {span.anomaly_type.replace(/_/g, ' ')}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedSpanIndex !== null && inspectionResult?.anomaly_spans?.[selectedSpanIndex] && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Forensic Finding: </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {inspectionResult.anomaly_spans[selectedSpanIndex].explanation}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Probability Verdict & Mandatory Tactical Citizen Directive */}
      {inspectionResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Probability Gauge & Verdict Card */}
          <div
            className={`lg:col-span-1 rounded-xl p-6 border shadow-sm flex flex-col justify-between ${
              isHighRisk
                ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                : isSuspicious
                ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Synthetic Voice Assessment
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isHighRisk
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : isSuspicious
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  {isHighRisk ? 'High Probability Synthetic' : isSuspicious ? 'Suspicious' : 'Natural Voice'}
                </span>
              </div>

              {/* Score Display */}
              <div className="my-4 text-center">
                <div
                  className={`text-5xl font-extrabold tracking-tight ${
                    isHighRisk
                      ? 'text-red-600 dark:text-red-400'
                      : isSuspicious
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {Math.round(inspectionResult.synthetic_probability_score * 100)}%
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Synthetic Impersonation Confidence Score
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800/80 pt-3">
                {inspectionResult.verdict_summary}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div>Inspection ID: <span className="font-mono">{inspectionResult.inspection_id}</span></div>
              <div>Duration: <span className="font-mono">{inspectionResult.duration_seconds}s</span></div>
            </div>
          </div>

          {/* Mandatory High-Visibility Tactical Citizen Guidance Banner */}
          <div className="lg:col-span-2 bg-gradient-to-br from-amber-500/10 via-red-500/10 to-amber-500/5 dark:from-amber-950/30 dark:via-red-950/30 dark:to-slate-900 border-2 border-amber-500/40 dark:border-amber-600/50 rounded-xl p-6 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-500 text-white rounded-lg shadow-md shrink-0">
                  <PhoneCall className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Emergency Citizen Tactical Protocol
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {TACTICAL_CITIZEN_GUIDANCE}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Synthetic voice technology clones natural pitch in seconds using public social media reels.
                    Always independently verify emergency claims before taking financial action.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {TACTICAL_CHECKLIST.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white/70 dark:bg-slate-800/80 border border-amber-200/60 dark:border-slate-700/60 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      {idx + 1}.
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium">
                National Cyber Crime Helpline: <strong className="text-red-600 dark:text-red-400">1930</strong> (Free 24/7)
              </span>
              <span>Portal: <strong>cybercrime.gov.in (I4C)</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Spectral Metrics Breakdown & Evidence Vault Preservation */}
      {inspectionResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spectral Metrics Breakdown */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Waves className="w-4 h-4 text-indigo-500" />
              Forensic Acoustic Spectral Metrics
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Pitch Jitter (F0 Perturbation)
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {inspectionResult.spectral_metrics.jitter_pct}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Normal Human: 0.5% - 1.2%
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Amplitude Shimmer
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {inspectionResult.spectral_metrics.shimmer_pct}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Normal Human: 1.5% - 3.8%
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Harmonics-to-Noise (HNR)
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {inspectionResult.spectral_metrics.hnr_db} dB
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Normal Voiced: 14 - 24 dB
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Spectral Rolloff Cutoff
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {Math.round(inspectionResult.spectral_metrics.spectral_rolloff_hz)} Hz
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Microphone Reverb: &gt; 18 kHz
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Neural Vocoder Footprint
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {Math.round(inspectionResult.spectral_metrics.vocoder_footprint_score * 100)}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Transposed Conv Grid Match
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Pitch Rigidity Index
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {Math.round(inspectionResult.spectral_metrics.pitch_stability_index * 100)}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Unnatural F0 Flatline Indicator
                </div>
              </div>
            </div>
          </div>

          {/* Evidence Vault Card */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                Evidence Vault Custodial Receipt
              </h3>

              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Status: </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Sealed in Evidence Vault
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Statutory Hold: </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    BNS § 318 (5-Year Preservation)
                  </span>
                </div>
                {inspectionResult.vaulted_evidence_id && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Evidence ID: </span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {inspectionResult.vaulted_evidence_id}
                    </span>
                  </div>
                )}
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>SHA-256 Fingerprint:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(inspectionResult.file_sha256)}
                      className="text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">{copiedHash ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all bg-slate-100 dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                    {inspectionResult.file_sha256}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              Cryptographically timestamped and bound to KshemOS tamper-evident ledger.
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Recent Inspections Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          Recent Voice Forensic Inspections History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Inspection ID</th>
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Claimed Identity</th>
                <th className="py-2.5 px-3">Risk Assessment</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Evidence Vault</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((item) => (
                <tr key={item.inspection_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-white">
                    {item.inspection_id}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">
                    {item.file_name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {item.caller_claimed_identity || 'Unspecified'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.risk_band === 'HIGH_PROBABILITY_SYNTHETIC'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : item.risk_band === 'SUSPICIOUS'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {item.risk_band === 'HIGH_PROBABILITY_SYNTHETIC'
                        ? 'High Synthetic'
                        : item.risk_band === 'SUSPICIOUS'
                        ? 'Suspicious'
                        : 'Natural'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    {Math.round(item.synthetic_probability_score * 100)}%
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                    {item.vaulted_evidence_id || 'Sealed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

