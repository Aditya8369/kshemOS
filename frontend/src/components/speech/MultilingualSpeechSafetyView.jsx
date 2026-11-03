import { useState, useEffect, useRef } from 'react';
import {
  fetchAsrProviders,
  fetchAsrSamples,
  transcribeSpeechApi,
  correctTurnApi,
  analyzeMultilingualScamApi,
  ASR_PROVIDERS,
  REGIONAL_LANGUAGES,
  MULTILINGUAL_SAMPLES,
} from '../../api';

export default function MultilingualSpeechSafetyView() {
  // Provider & Language Configuration
  const [providers, setProviders] = useState(ASR_PROVIDERS);
  const [selectedProvider, setSelectedProvider] = useState('bhashini');
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.70);
  const [enableCodeSwitching, setEnableCodeSwitching] = useState(true);

  // Input & Speaker Turn
  const [inputMode, setInputMode] = useState('simulation'); // 'mic' | 'simulation' | 'fallback'
  const [activeSpeaker, setActiveSpeaker] = useState('caller'); // 'caller' | 'citizen'
  const [selectedSampleId, setSelectedSampleId] = useState(MULTILINGUAL_SAMPLES[0].id);
  const [fallbackText, setFallbackText] = useState('');

  // Speech Turns & Active Session
  const [turns, setTurns] = useState([]);
  const [activeTurn, setActiveTurn] = useState(null);
  const [activeTab, setActiveTab] = useState('reviewed'); // 'reviewed' | 'raw_forensics'

  // Correction Popover State
  const [editingWord, setEditingWord] = useState(null); // { turnId, wordIndex, originalWord, currentWord, alternatives }
  const [customCorrectionInput, setCustomCorrectionInput] = useState('');

  // Scam Analysis Result
  const [scamAnalysis, setScamAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Web Speech API
  const [isMicListening, setIsMicListening] = useState(false);
  const [micInterim, setMicInterim] = useState('');
  const recognitionRef = useRef(null);

  // Load providers and samples on mount
  useEffect(() => {
    async function loadData() {
      const p = await fetchAsrProviders();
      if (p?.length) setProviders(p);
      const s = await fetchAsrSamples();
      if (s?.length && !turns.length) {
        // Pre-load default sample
        handleTranscribeSample(s[0].id);
      }
    }
    loadData();
  }, []);

  // Web Speech recognition setup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Transcribe via Sample
  async function handleTranscribeSample(sampleId) {
    const res = await transcribeSpeechApi({
      provider: selectedProvider,
      sampleId: sampleId || selectedSampleId,
      targetLanguage: selectedLanguage,
      speaker: activeSpeaker,
      enableCodeSwitching,
      confidenceThreshold,
    });

    if (res) {
      setTurns(prev => [res, ...prev.filter(t => t.turn_id !== res.turn_id)]);
      setActiveTurn(res);
      // Auto run scam analysis on new turn
      triggerScamAnalysis(res);
    }
  }

  // Transcribe via Text-Entry Fallback
  async function handleTranscribeFallback() {
    if (!fallbackText.trim()) return;
    const res = await transcribeSpeechApi({
      provider: selectedProvider,
      textInput: fallbackText.trim(),
      targetLanguage: selectedLanguage,
      speaker: activeSpeaker,
      enableCodeSwitching,
      confidenceThreshold,
    });

    if (res) {
      setTurns(prev => [res, ...prev]);
      setActiveTurn(res);
      setFallbackText('');
      triggerScamAnalysis(res);
    }
  }

  // Web Speech API Start
  function handleToggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in this browser. Please use the Call Simulation or Text-Entry Fallback.');
      return;
    }

    if (isMicListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsMicListening(false);
      return;
    }

    try {
      const langConfig = REGIONAL_LANGUAGES.find(l => l.code === selectedLanguage);
      const locale = langConfig?.locale || 'hi-IN';

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = locale;

      recognition.onstart = () => setIsMicListening(true);
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setMicInterim('');
            // Transcribe speech chunk
            transcribeSpeechApi({
              provider: 'browser_speech',
              textInput: t,
              targetLanguage: selectedLanguage,
              speaker: activeSpeaker,
              confidenceThreshold,
            }).then(newTurn => {
              if (newTurn) {
                setTurns(prev => [newTurn, ...prev]);
                setActiveTurn(newTurn);
                triggerScamAnalysis(newTurn);
              }
            });
          } else {
            interim += t;
          }
        }
        setMicInterim(interim);
      };

      recognition.onerror = () => setIsMicListening(false);
      recognition.onend = () => setIsMicListening(false);

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Microphone error:', err);
      setIsMicListening(false);
    }
  }

  // Trigger Multilingual Scam Analysis
  async function triggerScamAnalysis(turnToAnalyze) {
    if (!turnToAnalyze) return;
    setAnalyzing(true);
    try {
      const res = await analyzeMultilingualScamApi(
        turnToAnalyze.corrected_text,
        turnToAnalyze.original_text,
        turnToAnalyze.detected_language,
        turnToAnalyze.speaker === 'caller' ? 'Suspected Authority' : null,
        turnToAnalyze.turn_id
      );
      setScamAnalysis(res);
    } catch (e) {
      console.error('Scam analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  }

  // Open correction popover for a word
  function openCorrectionPopover(turnId, wordIndex, wordObj) {
    setEditingWord({
      turnId,
      wordIndex,
      originalWord: wordObj.word,
      currentWord: wordObj.word,
      confidence: wordObj.confidence,
      alternatives: wordObj.alternatives || [],
    });
    setCustomCorrectionInput(wordObj.word);
  }

  // Apply word correction
  async function handleApplyCorrection(correctedValue) {
    if (!editingWord || !correctedValue.trim()) return;

    const correction = {
      word_index: editingWord.wordIndex,
      original_word: editingWord.originalWord,
      corrected_word: correctedValue.trim(),
      corrected_by: 'citizen',
      timestamp: Date.now(),
    };

    const updatedTurn = await correctTurnApi(editingWord.turnId, [correction]);
    if (updatedTurn) {
      setTurns(prev => prev.map(t => (t.turn_id === updatedTurn.turn_id ? updatedTurn : t)));
      if (activeTurn?.turn_id === updatedTurn.turn_id) {
        setActiveTurn(updatedTurn);
      }
      // Re-run scam analysis with the user-corrected text
      triggerScamAnalysis(updatedTurn);
    }
    setEditingWord(null);
  }

  // Active language info
  const activeLangObj = REGIONAL_LANGUAGES.find(l => l.code === selectedLanguage) || REGIONAL_LANGUAGES[0];
  const activeProviderObj = providers.find(p => p.id === selectedProvider) || providers[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] font-bold mb-1">
            Regional Speech Intelligence • Bhashini & Indic ASR Adapter
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
            Multilingual Speech Recognition & Confidence Handling
          </h1>
          <p className="text-sm text-[var(--ink-text)]/70 mt-1 max-w-2xl">
            Transcribe regional Indian languages and conversational code-switching (Hinglish/Tanglish), mark low-confidence words for citizen correction, and evaluate scam threats while preserving immutable raw ASR forensics.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
            Hinglish Code-Switching
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            Confidence-Aware Tokenizer
          </span>
          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
            Dual Forensic Record
          </span>
        </div>
      </div>

      {/* Main Control Console Card */}
      <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. ASR Provider Selector */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[var(--ink-text)]/60 mb-1">
              ASR Provider Adapter
            </label>
            <select
              value={selectedProvider}
              onChange={e => setSelectedProvider(e.target.value)}
              className="w-full rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--saffron)]"
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.isLocal ? '(Local)' : '(Cloud API)'}</option>
              ))}
            </select>
            <div className="text-[10px] text-[var(--ink-text)]/50 mt-1 truncate">
              {activeProviderObj.description}
            </div>
          </div>

          {/* 2. Target Regional Language */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[var(--ink-text)]/60 mb-1">
              Primary Regional Language
            </label>
            <select
              value={selectedLanguage}
              onChange={e => setSelectedLanguage(e.target.value)}
              className="w-full rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--saffron)]"
            >
              {REGIONAL_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label} ({lang.script})</option>
              ))}
            </select>
            <div className="text-[10px] text-[var(--ink-text)]/50 mt-1">
              Locale: {activeLangObj.locale} • Script: {activeLangObj.script}
            </div>
          </div>

          {/* 3. Confidence Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-mono font-bold uppercase text-[var(--ink-text)]/60">
                Confidence Threshold
              </label>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                {Math.round(confidenceThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.90"
              step="0.05"
              value={confidenceThreshold}
              onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-full accent-[var(--saffron)] cursor-pointer"
            />
            <div className="text-[10px] text-[var(--ink-text)]/50 mt-1">
              Tokens below {Math.round(confidenceThreshold * 100)}% marked for citizen verification
            </div>
          </div>

          {/* 4. Speaker Turn & Code-Switching Toggle */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[var(--ink-text)]/60 mb-1">
                Speaker Turn Diarization
              </label>
              <div className="flex rounded-xl bg-[var(--paper)] p-1 border border-[var(--paper-line)] text-xs">
                <button
                  onClick={() => setActiveSpeaker('caller')}
                  className={`flex-1 py-1 rounded-lg font-semibold transition ${
                    activeSpeaker === 'caller' ? 'bg-red-600 text-white shadow-xs' : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)]'
                  }`}
                >
                  Caller (Suspect)
                </button>
                <button
                  onClick={() => setActiveSpeaker('citizen')}
                  className={`flex-1 py-1 rounded-lg font-semibold transition ${
                    activeSpeaker === 'citizen' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)]'
                  }`}
                >
                  Citizen (Self)
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs text-[var(--ink)] select-none">
              <input
                type="checkbox"
                checked={enableCodeSwitching}
                onChange={e => setEnableCodeSwitching(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[var(--ink)] focus:ring-[var(--saffron)]"
              />
              <span className="font-medium">Track Hinglish / Code-Switching</span>
            </label>
          </div>
        </div>

        {/* Input Switcher Bar (Simulation, Live Mic, Fallback Text Entry) */}
        <div className="mt-5 pt-4 border-t border-[var(--paper-line)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-text)]/60 font-bold">
              Speech Input Mode:
            </span>
            <div className="flex rounded-xl bg-[var(--paper)] p-1 border border-[var(--paper-line)] text-xs">
              <button
                onClick={() => setInputMode('simulation')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  inputMode === 'simulation' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/70'
                }`}
              >
                Regional Scenarios
              </button>
              <button
                onClick={() => setInputMode('mic')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  inputMode === 'mic' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/70'
                }`}
              >
                Microphone Stream
              </button>
              <button
                onClick={() => setInputMode('fallback')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  inputMode === 'fallback' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/70'
                }`}
              >
                Text-Entry Fallback
              </button>
            </div>
          </div>

          {/* Mode-specific actions */}
          {inputMode === 'simulation' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedSampleId}
                onChange={e => {
                  setSelectedSampleId(e.target.value);
                  handleTranscribeSample(e.target.value);
                }}
                className="rounded-xl border border-[var(--paper-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] focus:outline-none"
              >
                {MULTILINGUAL_SAMPLES.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                onClick={() => handleTranscribeSample(selectedSampleId)}
                className="px-4 py-1.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink)]/90 shadow-sm"
              >
                Transcribe Scenario
              </button>
            </div>
          )}

          {inputMode === 'mic' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMic}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
                  isMicListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white"></span>
                {isMicListening ? 'Stop Recording' : 'Start Mic Stream'}
              </button>
              {micInterim && (
                <span className="text-xs italic text-[var(--ink-text)]/70 max-w-xs truncate">
                  "{micInterim}"
                </span>
              )}
            </div>
          )}

          {inputMode === 'fallback' && (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="Type or paste regional caller dialogue..."
                value={fallbackText}
                onChange={e => setFallbackText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTranscribeFallback()}
                className="flex-1 rounded-xl border border-[var(--paper-line)] px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--saffron)]"
              />
              <button
                onClick={handleTranscribeFallback}
                disabled={!fallbackText.trim()}
                className="px-4 py-1.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold disabled:opacity-40"
              >
                Submit Turn
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Working Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Confidence-Aware Interactive Transcript Terminal (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm flex flex-col h-[580px]">
            {/* Tab Header: Reviewed vs Raw ASR Forensics */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--paper-line)]">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-[var(--ink)]">
                  Transcript Inspector
                </span>
                {activeTurn?.is_citizen_corrected && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Citizen Verified ✓
                  </span>
                )}
              </div>

              <div className="flex rounded-lg bg-[var(--paper)] p-0.5 border border-[var(--paper-line)] text-xs">
                <button
                  onClick={() => setActiveTab('reviewed')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeTab === 'reviewed' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/60'
                  }`}
                >
                  Interactive Words
                </button>
                <button
                  onClick={() => setActiveTab('raw_forensics')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeTab === 'raw_forensics' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/60'
                  }`}
                >
                  Raw ASR Ledger
                </button>
              </div>
            </div>

            {/* Language & Code-Switching Metadata Bar */}
            {activeTurn && (
              <div className="py-2.5 px-3 my-2 rounded-xl bg-[var(--paper)] border border-[var(--paper-line)] flex flex-wrap items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ink-text)]/50">Provider:</span>
                  <span className="font-bold text-[var(--ink)]">{activeTurn.provider}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-[var(--ink-text)]/50">Primary Lang:</span>
                  <span className="font-bold text-[var(--saffron)]">{activeTurn.detected_language?.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ink-text)]/50">Avg Confidence:</span>
                  <span className="font-bold text-emerald-700">{Math.round(activeTurn.average_confidence * 100)}%</span>
                  {activeTurn.code_switch_segments?.length > 1 && (
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-bold">
                      {activeTurn.code_switch_segments.length} Code-Switched Segments
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tab 1: Interactive Word Chips with Low-Confidence Highlighting */}
            {activeTab === 'reviewed' && (
              <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                {!activeTurn ? (
                  <div className="h-full flex items-center justify-center text-center text-sm text-[var(--ink-text)]/50">
                    Select a scenario or start speech stream above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Speaker Header */}
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                        activeTurn.speaker === 'caller' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {activeTurn.speaker === 'caller' ? 'Suspected Caller' : 'Citizen Response'}
                      </span>
                      <span className="text-[var(--ink-text)]/50">
                        {new Date(activeTurn.timestamp_ms).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Word Tokens Grid */}
                    <div className="flex flex-wrap gap-1.5 p-4 rounded-xl bg-[var(--paper)] border border-[var(--paper-line)] text-sm leading-loose">
                      {activeTurn.words?.map((w, idx) => {
                        const isLow = w.is_low_confidence;
                        return (
                          <button
                            key={idx}
                            onClick={() => openCorrectionPopover(activeTurn.turn_id, idx, w)}
                            className={`group relative inline-flex items-center px-2 py-1 rounded-lg font-sans text-xs transition border cursor-pointer ${
                              isLow
                                ? 'bg-amber-100/80 border-amber-300 text-amber-900 hover:bg-amber-200'
                                : 'bg-white border-gray-200 text-gray-900 hover:border-gray-400'
                            }`}
                          >
                            <span>{w.word}</span>
                            {isLow && (
                              <span className="ml-1 text-[10px] font-mono text-amber-700 font-bold">
                                {Math.round(w.confidence * 100)}% ⚠️
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Hint Banner for Corrections */}
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                      <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <strong>Low-confidence tokens marked in amber.</strong> Click any word to review acoustic alternatives or type your verified citizen correction. Your edit will update the scam assessment while leaving the original ASR ledger intact.
                      </div>
                    </div>

                    {/* Applied Corrections List */}
                    {activeTurn.corrections?.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
                        <div className="font-bold text-emerald-900 mb-1 font-mono uppercase tracking-wider text-[10px]">
                          Citizen Audit Trail ({activeTurn.corrections.length} Applied):
                        </div>
                        <div className="space-y-1">
                          {activeTurn.corrections.map((c, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2 text-emerald-800 font-mono text-[11px]">
                              <span>Word #{c.word_index}:</span>
                              <span className="line-through text-red-600">"{c.original_word}"</span>
                              <span>→</span>
                              <span className="font-bold text-emerald-900">"{c.corrected_word}"</span>
                              <span className="text-[10px] text-gray-500 font-sans">(corrected by citizen)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Raw Forensics Ledger (Court-Admissible Dual Record) */}
            {activeTab === 'raw_forensics' && (
              <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 font-mono text-xs">
                {!activeTurn ? (
                  <div className="h-full flex items-center justify-center text-[var(--ink-text)]/50">
                    No active turn.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-gray-900 text-gray-100 space-y-2">
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        Immutable Raw ASR Stream (Never Overwritten):
                      </div>
                      <p className="font-sans text-sm text-amber-300 leading-relaxed">
                        "{activeTurn.original_text}"
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-gray-900 text-gray-100 space-y-2">
                      <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
                        Downstream Analyzed Text (Citizen Verified):
                      </div>
                      <p className="font-sans text-sm text-emerald-300 leading-relaxed">
                        "{activeTurn.corrected_text}"
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[11px] space-y-1">
                      <div><strong className="text-[var(--ink)]">Turn ID:</strong> {activeTurn.turn_id}</div>
                      <div><strong className="text-[var(--ink)]">Speaker Diarization:</strong> {activeTurn.speaker}</div>
                      <div><strong className="text-[var(--ink)]">Detected Script:</strong> {activeLangObj.script}</div>
                      <div><strong className="text-[var(--ink)]">Citizen Edited:</strong> {activeTurn.is_citizen_corrected ? 'YES (Verified)' : 'NO (Raw Output)'}</div>
                      <div><strong className="text-[var(--ink)]">ASR Model:</strong> {activeTurn.provider}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Scam Threat Radar & Citizen Correction Deck (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Word Correction Popover Card */}
          {editingWord && (
            <div className="bg-white border-2 border-amber-400 rounded-2xl p-5 shadow-lg animate-fade-in">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <h3 className="font-display font-bold text-sm text-[var(--ink)]">
                    Citizen Word Verification
                  </h3>
                </div>
                <button
                  onClick={() => setEditingWord(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[11px] text-[var(--ink-text)]/60 font-mono mb-0.5">
                    Original ASR Token (Word #{editingWord.wordIndex}):
                  </div>
                  <div className="text-sm font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex items-center justify-between">
                    <span>"{editingWord.originalWord}"</span>
                    <span className="text-[10px] font-mono text-amber-700">
                      Confidence: {Math.round(editingWord.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Suggested Alternatives */}
                {editingWord.alternatives?.length > 0 && (
                  <div>
                    <div className="text-[11px] text-[var(--ink-text)]/60 font-mono mb-1">
                      Acoustic Alternative Candidates:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {editingWord.alternatives.map((alt, altIdx) => (
                        <button
                          key={altIdx}
                          onClick={() => handleApplyCorrection(alt)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold font-mono text-xs transition cursor-pointer"
                        >
                          + Use "{alt}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Edit Input */}
                <div>
                  <div className="text-[11px] text-[var(--ink-text)]/60 font-mono mb-1">
                    Or Type Corrected Word:
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customCorrectionInput}
                      onChange={e => setCustomCorrectionInput(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--paper-line)] px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[var(--saffron)]"
                    />
                    <button
                      onClick={() => handleApplyCorrection(customCorrectionInput)}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink)]/90"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multilingual Scam Analysis Card */}
          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--paper-line)]">
              <h3 className="font-display font-bold text-base text-[var(--ink)]">
                Multilingual Scam Threat Engine
              </h3>
              {scamAnalysis && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono ${
                  scamAnalysis.risk_band === 'critical' ? 'bg-red-600 text-white animate-pulse' :
                  scamAnalysis.risk_band === 'high' ? 'bg-orange-600 text-white' :
                  scamAnalysis.risk_band === 'medium' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {scamAnalysis.risk_band} ({scamAnalysis.risk_score}%)
                </span>
              )}
            </div>

            {analyzing && (
              <div className="py-6 text-center text-xs text-[var(--ink-text)]/60 animate-pulse font-mono">
                Evaluating Indic extortion language & authority claims...
              </div>
            )}

            {!analyzing && !scamAnalysis && (
              <div className="py-6 text-center text-xs text-[var(--ink-text)]/50">
                Awaiting speech turn transcription to compute scam score.
              </div>
            )}

            {!analyzing && scamAnalysis && (
              <div className="space-y-4">
                {/* Score & Code-Switch Radar */}
                <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--paper)] border border-[var(--paper-line)]">
                  <div className="w-16 h-16 rounded-full border-4 border-gray-100 flex flex-col items-center justify-center bg-white shadow-xs shrink-0">
                    <span className="font-display text-xl font-extrabold text-[var(--ink)]">
                      {scamAnalysis.risk_score}%
                    </span>
                    <span className="text-[9px] font-mono text-[var(--ink-text)]/50">RISK</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-[var(--ink)]">
                      {scamAnalysis.risk_score >= 75 ? 'Critical Digital Arrest Risk' :
                       scamAnalysis.risk_score >= 50 ? 'High Impersonation Risk' :
                       scamAnalysis.risk_score >= 25 ? 'Moderate Suspicion' : 'Low Threat'}
                    </div>
                    <div className="text-[11px] text-[var(--ink-text)]/70 mt-0.5">
                      Code-Switch Density: {Math.round(scamAnalysis.code_switch_ratio * 100)}% English/Indic blend
                    </div>
                    {scamAnalysis.was_corrected && (
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        ✓ Evaluated on citizen-verified text
                      </div>
                    )}
                  </div>
                </div>

                {/* Matched Pattern Badges */}
                {scamAnalysis.matched_patterns?.length > 0 && (
                  <div>
                    <div className="text-xs font-mono font-bold uppercase text-[var(--ink-text)]/60 mb-1.5">
                      Detected Regional Threat Patterns:
                    </div>
                    <div className="space-y-1.5">
                      {scamAnalysis.matched_patterns.map((pat, pIdx) => (
                        <div key={pIdx} className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 font-medium">
                          {pat}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendation Banner */}
                <div className="p-3.5 rounded-xl bg-[var(--paper)] border border-[var(--paper-line)] text-xs text-[var(--ink)] leading-relaxed">
                  <div className="font-bold text-xs mb-1 font-mono uppercase text-[var(--saffron)]">
                    Actionable Safety Directive:
                  </div>
                  {scamAnalysis.recommendation}
                </div>

                {/* 1930 Emergency Helpline Quick Action */}
                <div className="pt-2 border-t border-[var(--paper-line)] flex items-center justify-between text-xs">
                  <span className="text-[var(--ink-text)]/70 font-medium">
                    National Cyber Crime Helpline:
                  </span>
                  <a
                    href="tel:1930"
                    className="font-mono font-bold text-sm text-[var(--saffron)] hover:underline"
                  >
                    📞 Dial 1930
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

