import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Play,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
  Zap,
  TrendingUp,
  FileText,
  Clock,
  Radio,
  PhoneCall,
  Volume2,
  Lock,
} from 'lucide-react';
import {
  defaultCalibratedRiskStore,
  BENCHMARK_CORPUS,
  fetchRiskModelConfigApi,
  updateRiskModelConfigApi,
  rollbackRiskModelApi,
  runRiskModelBenchmarkApi,
  analyzeCalibratedRiskApi,
} from '../../api';

export default function CalibratedRiskModelView() {
  // Store & Config State
  const [activeTab, setActiveTab] = useState('evaluator'); // 'evaluator' | 'comparison' | 'benchmark' | 'governance'
  const [modelConfig, setModelConfig] = useState(defaultCalibratedRiskStore.getConfig());
  const [activeVersion, setActiveVersion] = useState(defaultCalibratedRiskStore.getState().activeModelVersion);

  // Evaluator Inputs
  const [transcript, setTranscript] = useState(
    'This is the CBI. A parcel with your Aadhaar number has been seized containing illegal narcotics and MDMA. You are under digital arrest. Stay on this video call, do not disconnect, stay in a quiet room, and transfer verification amount to the Supreme Court safe account immediately or a warrant will execute.'
  );
  const [callerClaimsToBe, setCallerClaimsToBe] = useState('CBI officer');
  const [channel, setChannel] = useState('whatsapp_video');
  const [timeOfDay, setTimeOfDay] = useState('night');
  const [versionOverride, setVersionOverride] = useState('');

  // Results State
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkFilter, setBenchmarkFilter] = useState('all');

  // Governance Form State
  const [thresholds, setThresholds] = useState(modelConfig.thresholds);
  const [fallbackEnabled, setFallbackEnabled] = useState(modelConfig.fallback_enabled);
  const [rollbackReason, setRollbackReason] = useState('Manual rollback from admin console');
  const [statusMessage, setStatusMessage] = useState(null);

  // Subscribe to store updates
  useEffect(() => {
    const unsub = defaultCalibratedRiskStore.subscribe((state) => {
      setActiveVersion(state.activeModelVersion);
      setModelConfig(defaultCalibratedRiskStore.getConfig());
      if (state.currentAnalysis) setAnalysisResult(state.currentAnalysis);
      if (state.benchmarkResult) setBenchmarkResult(state.benchmarkResult);
    });

    // Initial load
    async function init() {
      const cfg = await fetchRiskModelConfigApi();
      if (cfg) {
        setModelConfig(cfg);
        setActiveVersion(cfg.active_version);
        setThresholds(cfg.thresholds || thresholds);
        setFallbackEnabled(cfg.fallback_enabled ?? true);
      }
      handleEvaluate();
    }
    init();

    return () => unsub();
  }, []);

  const handleEvaluate = async (customTranscript, customCaller, customVersion) => {
    setIsEvaluating(true);
    setStatusMessage(null);
    try {
      const textToEval = customTranscript ?? transcript;
      const callerToEval = customCaller ?? callerClaimsToBe;
      const verToEval = customVersion ?? (versionOverride || activeVersion);

      const res = await analyzeCalibratedRiskApi({
        transcript: textToEval,
        callerClaimsToBe: callerToEval,
        modelVersion: verToEval,
        context: { channel, time_of_day: timeOfDay },
      });
      setAnalysisResult(res);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Evaluation failed: ${err.message}` });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRunBenchmark = async (ver = null) => {
    setIsRunningBenchmark(true);
    setStatusMessage(null);
    try {
      const res = await runRiskModelBenchmarkApi(ver || activeVersion);
      setBenchmarkResult(res);
      setStatusMessage({
        type: 'success',
        text: `Benchmark completed: ${(res.accuracy * 100).toFixed(1)}% accuracy across ${res.total_cases} cases (+${(res.improvement_over_baseline * 100).toFixed(1)}% vs v1 baseline).`,
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Benchmark failed: ${err.message}` });
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const handleSaveGovernance = async () => {
    try {
      const updated = await updateRiskModelConfigApi({
        active_version: activeVersion,
        thresholds,
        fallback_enabled: fallbackEnabled,
      });
      setModelConfig(updated);
      setStatusMessage({ type: 'success', text: 'Model governance configuration updated successfully.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Failed to update governance: ${err.message}` });
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Roll back risk model to v1.0-legacy-rules baseline?')) return;
    try {
      const rolled = await rollbackRiskModelApi('v1.0-legacy-rules', rollbackReason);
      setModelConfig(rolled);
      setActiveVersion('v1.0-legacy-rules');
      setStatusMessage({ type: 'warning', text: 'Model rolled back to v1.0-legacy-rules.' });
      handleEvaluate(transcript, callerClaimsToBe, 'v1.0-legacy-rules');
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Rollback failed: ${err.message}` });
    }
  };

  const loadPreset = (preset) => {
    setTranscript(preset.transcript);
    setCallerClaimsToBe(preset.caller_claims_to_be || '');
    if (preset.context?.channel) setChannel(preset.context.channel);
    if (preset.context?.time_of_day) setTimeOfDay(preset.context.time_of_day);
    handleEvaluate(preset.transcript, preset.caller_claims_to_be, versionOverride || activeVersion);
  };

  const getBandBadge = (band) => {
    switch (band) {
      case 'critical':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-900/80 text-red-200 border border-red-700 animate-pulse">CRITICAL</span>;
      case 'high':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-900/80 text-orange-200 border border-orange-700">HIGH</span>;
      case 'medium':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-900/80 text-amber-200 border border-amber-700">MEDIUM</span>;
      case 'low':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-900/80 text-emerald-200 border border-emerald-700">LOW</span>;
      case 'inconclusive':
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-600">INCONCLUSIVE</span>;
    }
  };

  const filteredCases = benchmarkResult?.cases?.filter((c) => {
    if (benchmarkFilter === 'all') return true;
    return c.category === benchmarkFilter || (benchmarkFilter === 'inconclusive' && c.ground_truth_label === 'inconclusive');
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  Calibrated Multi-Signal Risk Model
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {activeVersion}
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Versioned risk-model interface combining linguistic features, 4-pillar phrase patterns, archetype semantic similarity, and call context.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleRunBenchmark()}
              disabled={isRunningBenchmark}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isRunningBenchmark ? 'Benchmarking...' : 'Run Benchmark Suite'}
            </button>

            {activeVersion !== 'v1.0-legacy-rules' ? (
              <button
                onClick={handleRollback}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800 flex items-center gap-1.5 transition-colors"
                title="Immediately revert to v1.0 immutable legacy rules engine"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rollback to v1.0
              </button>
            ) : (
              <button
                onClick={() => {
                  updateRiskModelConfigApi({ active_version: 'v2.0-calibrated-ensemble' });
                  setActiveVersion('v2.0-calibrated-ensemble');
                  handleEvaluate(transcript, callerClaimsToBe, 'v2.0-calibrated-ensemble');
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800 flex items-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Deploy v2.0 Ensemble
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-800/80 pt-4 overflow-x-auto text-sm">
          {[
            { id: 'evaluator', label: 'Live Risk Evaluator', icon: Activity },
            { id: 'comparison', label: 'v2 vs v1 Baseline Comparison', icon: TrendingUp },
            { id: 'benchmark', label: 'Labeled Benchmark Corpus (20 Cases)', icon: CheckCircle2 },
            { id: 'governance', label: 'Governance & Thresholds', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center gap-2 border ${
            statusMessage.type === 'error'
              ? 'bg-red-950/60 border-red-800 text-red-300'
              : statusMessage.type === 'warning'
              ? 'bg-amber-950/60 border-amber-800 text-amber-300'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}
        >
          {statusMessage.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {statusMessage.text}
        </div>
      )}

      {/* TAB 1: LIVE RISK EVALUATOR */}
      {activeTab === 'evaluator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Form & Presets (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
              <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
                <span>Quick Scenario Presets</span>
                <span className="text-xs font-normal text-slate-500">Documented Corpus</span>
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {BENCHMARK_CORPUS.slice(0, 8).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    className="p-2 text-left rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all flex flex-col justify-between"
                  >
                    <span className="font-medium truncate">{preset.category.replace('_', ' ').toUpperCase()}</span>
                    <span className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
                      <span>{preset.id}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                        preset.ground_truth_band === 'critical' ? 'text-red-400' :
                        preset.ground_truth_band === 'high' ? 'text-orange-400' :
                        preset.ground_truth_band === 'low' ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {preset.ground_truth_band}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span>Call Transcript</span>
                  <span className="text-[11px] text-slate-500">
                    {transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : '0 words'}
                  </span>
                </label>
                <textarea
                  rows={5}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste or type call transcript text here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Caller Claims To Be</label>
                  <input
                    type="text"
                    value={callerClaimsToBe}
                    onChange={(e) => setCallerClaimsToBe(e.target.value)}
                    placeholder="e.g. CBI officer, Bank desk"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Evaluation Model</label>
                  <select
                    value={versionOverride}
                    onChange={(e) => setVersionOverride(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Default ({activeVersion})</option>
                    <option value="v2.0-calibrated-ensemble">v2.0-calibrated-ensemble</option>
                    <option value="v1.0-legacy-rules">v1.0-legacy-rules</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Channel Vector</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="whatsapp_video">WhatsApp Video Call (High Risk)</option>
                    <option value="voip_call">Unverified VoIP / Virtual Line</option>
                    <option value="pstn">Standard PSTN / Cellular Call</option>
                    <option value="internal">Internal / Colleague Line</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Call Timing</label>
                  <select
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="night">Night / Odd Hours (Coercion Multiplier)</option>
                    <option value="day">Standard Business Hours</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleEvaluate()}
                disabled={isEvaluating || !transcript.trim()}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow disabled:opacity-50"
              >
                <Activity className="w-4 h-4" />
                {isEvaluating ? 'Evaluating Multi-Signal Risk...' : 'Evaluate Calibrated Risk'}
              </button>
            </div>
          </div>

          {/* Right Column: Multi-Signal Assessment Display (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {analysisResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-5">
                {/* Score & Risk Band Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl border shadow-inner ${
                      analysisResult.risk_band === 'critical' ? 'bg-red-950/80 text-red-200 border-red-700' :
                      analysisResult.risk_band === 'high' ? 'bg-orange-950/80 text-orange-200 border-orange-700' :
                      analysisResult.risk_band === 'medium' ? 'bg-amber-950/80 text-amber-200 border-amber-700' :
                      analysisResult.risk_band === 'low' ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700' :
                      'bg-slate-800 text-slate-300 border-slate-600'
                    }`}>
                      {analysisResult.is_inconclusive ? '—' : analysisResult.risk_score}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">Risk Classification</span>
                        {getBandBadge(analysisResult.risk_band)}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>Model: <span className="font-mono text-slate-300">{analysisResult.model_version}</span></span>
                        <span>•</span>
                        <span>Confidence: <span className="font-semibold text-slate-200">{Math.round((analysisResult.confidence || 0.75) * 100)}%</span></span>
                      </div>
                    </div>
                  </div>

                  {analysisResult.baseline_comparison && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-right">
                      <div className="text-slate-400">Baseline v1.0 Delta</div>
                      <div className="text-sm font-bold flex items-center justify-end gap-1 font-mono">
                        {analysisResult.baseline_comparison.score_delta > 0 ? (
                          <span className="text-red-400">+{analysisResult.baseline_comparison.score_delta} pts</span>
                        ) : analysisResult.baseline_comparison.score_delta < 0 ? (
                          <span className="text-emerald-400">{analysisResult.baseline_comparison.score_delta} pts</span>
                        ) : (
                          <span className="text-slate-400">0 pts</span>
                        )}
                        <span className="text-[11px] font-normal text-slate-500">
                          (v1: {analysisResult.baseline_comparison.baseline_score})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inconclusive Warning Box */}
                {analysisResult.is_inconclusive && (
                  <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300 text-sm mb-1">Inconclusive Evidence Guardrail Triggered</div>
                      <p className="leading-relaxed">
                        {analysisResult.inconclusive_reason || 'Audio/transcript evidence is sparse or ambiguous.'}
                      </p>
                      <p className="mt-1.5 text-amber-400/90 text-[11px]">
                        The calibrated model deliberately refrains from forcing a low or medium classification, preventing accidental false alarms and citizen complacency.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4 Contributing Signals Meter Grid */}
                {analysisResult.contributing_signals && !analysisResult.is_inconclusive && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>4-Signal Feature Attribution Decomposition</span>
                      <span className="text-[11px] font-normal text-indigo-400">Logistic Calibrated Logit</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Signal 1: Phrase Patterns */}
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-red-400" />
                            Coercive Phrase Patterns
                          </span>
                          <span className="font-mono text-red-300">
                            {((analysisResult.contributing_signals.phrase_patterns || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (analysisResult.contributing_signals.phrase_patterns || 0) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          4-Pillar Synergy (Authority, Urgency, Secrecy, Asset Extraction)
                        </div>
                      </div>

                      {/* Signal 2: Semantic Similarity */}
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-orange-400" />
                            Semantic Archetype Match
                          </span>
                          <span className="font-mono text-orange-300">
                            {((analysisResult.contributing_signals.semantic_similarity || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (analysisResult.contributing_signals.semantic_similarity || 0) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Cosine similarity against digital arrest corpus scripts
                        </div>
                      </div>

                      {/* Signal 3: Linguistic Features */}
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                            Linguistic & Pacing Tension
                          </span>
                          <span className="font-mono text-indigo-300">
                            {((analysisResult.contributing_signals.transcript_features || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (analysisResult.contributing_signals.transcript_features || 0) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Evidence volume factor, imperative verb density, exclamation marks
                        </div>
                      </div>

                      {/* Signal 4: Call Context */}
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                            Call Channel & Context
                          </span>
                          <span className="font-mono text-emerald-300">
                            {((analysisResult.contributing_signals.call_context || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (analysisResult.contributing_signals.call_context || 0) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Video channel vulnerability, claimed law enforcement persona
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Matched Pattern Badges */}
                {analysisResult.matched_patterns?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Matched Coercive Syndicate Patterns
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.matched_patterns.map((p, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700/60 font-mono"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Safety Recommendation */}
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-200 space-y-1.5">
                  <div className="font-semibold text-indigo-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    Actionable Safety Recommendation
                  </div>
                  <p className="leading-relaxed">{analysisResult.recommendation}</p>
                </div>

                {/* Natural Language Explanation */}
                <div className="text-xs text-slate-400 italic bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  {analysisResult.explanation}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                Select a scenario preset or click Evaluate to run the calibrated multi-signal risk model.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BASELINE COMPARISON */}
      {activeTab === 'comparison' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Calibrated Ensemble vs v1.0 Legacy Rules Baseline
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Side-by-side comparison revealing how the calibrated multi-signal ensemble resolves false positives on benign institutional calls and escalates subtle multi-pillar extortion.
            </p>

            {analysisResult?.baseline_comparison ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-500 uppercase font-bold">Legacy Baseline (v1.0)</div>
                  <div className="text-2xl font-bold font-mono text-slate-300">
                    {analysisResult.baseline_comparison.baseline_score}/100
                  </div>
                  <div>{getBandBadge(analysisResult.baseline_comparison.baseline_band)}</div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Simple keyword count heuristics + basic Bag-of-Words similarity.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 space-y-2">
                  <div className="text-xs text-indigo-400 uppercase font-bold">Calibrated Ensemble (v2.0)</div>
                  <div className="text-2xl font-bold font-mono text-indigo-200">
                    {analysisResult.is_inconclusive ? '0 (Inconclusive)' : `${analysisResult.risk_score}/100`}
                  </div>
                  <div>{getBandBadge(analysisResult.risk_band)}</div>
                  <p className="text-[11px] text-indigo-300/80 mt-2">
                    Logistic calibration over 4 signals with 4-pillar synergy and inconclusive handling.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-500 uppercase font-bold">Score Delta & Divergence</div>
                  <div className={`text-2xl font-bold font-mono ${
                    analysisResult.baseline_comparison.score_delta > 0 ? 'text-red-400' :
                    analysisResult.baseline_comparison.score_delta < 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {analysisResult.baseline_comparison.score_delta > 0 ? `+${analysisResult.baseline_comparison.score_delta}` : analysisResult.baseline_comparison.score_delta} pts
                  </div>
                  <div className="text-xs font-semibold text-slate-300">Divergence Rationale</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {analysisResult.baseline_comparison.divergence_rationale}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 p-6 text-center">
                Run an evaluation first to inspect the live baseline divergence comparison.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BENCHMARK SUITE */}
      {activeTab === 'benchmark' && (
        <div className="space-y-5">
          {/* Benchmark Header & KPI Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Documented Labeled Benchmark Evaluation
                </h2>
                <p className="text-xs text-slate-400">
                  Benchmarked against 20 labeled test cases spanning digital arrest, customs contraband, KYC extortion, multilingual Hinglish/Tamil, benign calls, and inconclusive greetings.
                </p>
              </div>

              <button
                onClick={() => handleRunBenchmark()}
                disabled={isRunningBenchmark}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                {isRunningBenchmark ? 'Running Evaluation...' : 'Re-Run Benchmark Suite'}
              </button>
            </div>

            {benchmarkResult ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Model Accuracy</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {(benchmarkResult.accuracy * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {benchmarkResult.correct_predictions}/{benchmarkResult.total_cases} cases correct
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Legacy Baseline v1</div>
                  <div className="text-2xl font-bold font-mono text-slate-400">
                    {(benchmarkResult.baseline_accuracy_v1 * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Static keyword rules</div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Net Improvement</div>
                  <div className="text-2xl font-bold font-mono text-indigo-400">
                    +{(benchmarkResult.improvement_over_baseline * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-indigo-300/80 mt-0.5">Calibration gain</div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">Inconclusive Safeties</div>
                  <div className="text-2xl font-bold font-mono text-amber-400">
                    {benchmarkResult.inconclusive_count}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Sparse calls safe</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 p-4 text-center">
                Click 'Run Benchmark Suite' to test the model against all 20 ground-truth labeled scenarios.
              </div>
            )}
          </div>

          {/* Benchmark Cases Table */}
          {benchmarkResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Labeled Test Cases Execution Manifest
                </h3>
                <div className="flex items-center gap-1.5 text-xs">
                  {['all', 'digital_arrest', 'customs_extortion', 'bank_kyc', 'multilingual_scam', 'benign', 'inconclusive'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBenchmarkFilter(filter)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        benchmarkFilter === filter
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {filter.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Case ID</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Ground Truth</th>
                      <th className="py-2.5 px-3">Predicted Band</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {filteredCases.map((c) => {
                      const rawCase = BENCHMARK_CORPUS.find((b) => b.id === c.case_id);
                      return (
                        <tr key={c.case_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3">
                            {c.is_correct ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-200">{c.case_id}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans">{c.category}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-300">{c.ground_truth_label}</span>
                          </td>
                          <td className="py-2.5 px-3">{getBandBadge(c.predicted_band)}</td>
                          <td className="py-2.5 px-3 text-slate-200">{c.risk_score}</td>
                          <td className="py-2.5 px-3 text-slate-400">{((c.confidence || 0.8) * 100).toFixed(0)}%</td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => {
                                if (rawCase) {
                                  loadPreset(rawCase);
                                  setActiveTab('evaluator');
                                }
                              }}
                              className="text-indigo-400 hover:text-indigo-300 font-sans text-xs underline"
                            >
                              Load in Evaluator
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GOVERNANCE & THRESHOLDS */}
      {activeTab === 'governance' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Risk Model Governance & Decision Thresholds
            </h2>
            <p className="text-xs text-slate-400">
              Configure operational cutoff boundaries, adjust minimum word count thresholds for inconclusive verdicts, and manage audit logs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-semibold text-sm text-slate-200">Active Model Runtime</div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Active Model Engine</label>
                  <select
                    value={activeVersion}
                    onChange={(e) => setActiveVersion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                  >
                    <option value="v2.0-calibrated-ensemble">v2.0-calibrated-ensemble (Multi-Signal Calibrated)</option>
                    <option value="v1.0-legacy-rules">v1.0-legacy-rules (Immutable Baseline)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-300 font-medium">Automatic Fallback on Runtime Exception</span>
                  <input
                    type="checkbox"
                    checked={fallbackEnabled}
                    onChange={(e) => setFallbackEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-semibold text-sm text-slate-200">Risk Band Cutoff Scores</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-red-400">Critical Threshold (&ge; {thresholds.critical})</span>
                    <input
                      type="range"
                      min={50}
                      max={90}
                      value={thresholds.critical}
                      onChange={(e) => setThresholds({ ...thresholds, critical: Number(e.target.value) })}
                      className="w-36"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-orange-400">High Threshold (&ge; {thresholds.high})</span>
                    <input
                      type="range"
                      min={30}
                      max={75}
                      value={thresholds.high}
                      onChange={(e) => setThresholds({ ...thresholds, high: Number(e.target.value) })}
                      className="w-36"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">Medium Threshold (&ge; {thresholds.medium})</span>
                    <input
                      type="range"
                      min={15}
                      max={45}
                      value={thresholds.medium}
                      onChange={(e) => setThresholds({ ...thresholds, medium: Number(e.target.value) })}
                      className="w-36"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Inconclusive Min Word Tokens (&lt; {thresholds.inconclusive_min_words})</span>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={thresholds.inconclusive_min_words}
                      onChange={(e) => setThresholds({ ...thresholds, inconclusive_min_words: Number(e.target.value) })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={handleSaveGovernance}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Save Threshold Configuration
              </button>
            </div>
          </div>

          {/* Audit History Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Governance & Rollback Audit History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Target Version</th>
                    <th className="py-2 px-3">Operator Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {modelConfig.history?.map((h, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          h.action === 'rollback' ? 'bg-red-950 text-red-300 border border-red-800' :
                          h.action === 'deploy' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}>
                          {h.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200">{h.version}</td>
                      <td className="py-2 px-3 text-slate-400 font-sans">{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

