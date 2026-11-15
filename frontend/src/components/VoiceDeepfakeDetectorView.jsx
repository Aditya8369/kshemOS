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

export default function VoiceDeepfakeDetectorView() {
  // Input state
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

