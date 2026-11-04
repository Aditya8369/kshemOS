import { useState, useEffect, useRef } from 'react';
import {
  createLiveCallSession,
  ingestLiveCallChunk,
  pauseLiveCallSession,
  resumeLiveCallSession,
  stopLiveCallSession,
  purgeLiveCallSession,
  SAMPLE_CALL_SIMULATIONS,
  OFFICIAL_HELPLINES,
} from '../../api';

export default function LiveCallSafetyView() {
  // Consent State
  const [hasConsented, setHasConsented] = useState(false);
  const [consentCheckboxes, setConsentCheckboxes] = useState({
    micAccess: false,
    noAutoRecord: false,
    riskProcessing: false,
    passiveGuardian: false,
  });

  // Session State
  const [session, setSession] = useState(null);
  const [inputMode, setInputMode] = useState('mic'); // 'mic' | 'simulation' | 'custom'
  const [customChunkText, setCustomChunkText] = useState('');
  const [selectedSimId, setSelectedSimId] = useState(SAMPLE_CALL_SIMULATIONS[0].id);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [simPlaying, setSimPlaying] = useState(false);

  // Web Speech API
  const [isMicListening, setIsMicListening] = useState(false);
  const [micInterimText, setMicInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const simTimerRef = useRef(null);
  const transcriptEndRef = useRef(null);

  // UI state
  const [purgeNotice, setPurgeNotice] = useState(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const allConsentsChecked =
    consentCheckboxes.micAccess &&
    consentCheckboxes.noAutoRecord &&
    consentCheckboxes.riskProcessing &&
    consentCheckboxes.passiveGuardian;

  // Check Web Speech API availability on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setInputMode('simulation');
    }
  }, []);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.utterances, micInterimText]);

  // Clean up recognition & timers on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
      }
    };
  }, []);

  // Initialize Session after consent
  async function handleActivateSession(callerLabel = 'Incoming Call') {
    const consentPayload = {
      user_acknowledged: true,
      mic_permission_granted: true,
      data_processing_accepted: true,
      no_auto_record_acknowledged: true,
      timestamp: Date.now(),
    };

    try {
      const newSession = await createLiveCallSession(consentPayload, callerLabel);
      setSession(newSession);
      setHasConsented(true);
      setPurgeNotice(null);
      setSimStepIndex(0);

      // Start Web Speech if in mic mode
      if (inputMode === 'mic' && speechSupported) {
        startWebSpeech(newSession.session_id);
      }
    } catch (err) {
      console.error('Failed to create live call session:', err);
    }
  }

  // Web Speech API starter
  function startWebSpeech(sessionId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Standard Indian English accent tuning

      recognition.onstart = () => {
        setIsMicListening(true);
      };

      recognition.onresult = async (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setMicInterimText('');
            // Ingest finalized utterance
            const updated = await ingestLiveCallChunk(sessionId, transcript, 'caller');
            setSession(prev => updated ? { ...prev, ...updated } : prev);
          } else {
            interim += transcript;
          }
        }
        setMicInterimText(interim);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'not-allowed') {
          setIsMicListening(false);
        }
      };

      recognition.onend = () => {
        // Auto-restart if session is still active and not paused
        setIsMicListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsMicListening(true);
    } catch (err) {
      console.warn('Microphone activation notice:', err);
      setIsMicListening(false);
    }
  }

  // Ingest chunk from manual input or simulation
  async function handleIngestText(text, speaker = 'caller') {
    if (!session || !text.trim()) return;
    try {
      const updated = await ingestLiveCallChunk(session.session_id, text.trim(), speaker);
      if (updated) {
        setSession(prev => ({ ...prev, ...updated }));
      }
    } catch (err) {
      console.error('Failed to ingest text chunk:', err);
    }
  }

  // Simulation controls
  const activeSim = SAMPLE_CALL_SIMULATIONS.find(s => s.id === selectedSimId) || SAMPLE_CALL_SIMULATIONS[0];

  async function handleNextSimChunk() {
    if (!session || simStepIndex >= activeSim.chunks.length) return;
    const chunkText = activeSim.chunks[simStepIndex];
    await handleIngestText(chunkText, 'caller');
    setSimStepIndex(prev => prev + 1);
  }

  function handleToggleSimAutoPlay() {
    if (simPlaying) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      setSimPlaying(false);
    } else {
      setSimPlaying(true);
      simTimerRef.current = setInterval(async () => {
        setSimStepIndex(curr => {
          if (curr >= activeSim.chunks.length) {
            clearInterval(simTimerRef.current);
            setSimPlaying(false);
            return curr;
          }
          const chunk = activeSim.chunks[curr];
          handleIngestText(chunk, 'caller');
          return curr + 1;
        });
      }, 3500);
    }
  }

  // Pause session
  async function handlePause() {
    if (!session) return;
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsMicListening(false);
      if (simPlaying) {
        clearInterval(simTimerRef.current);
        setSimPlaying(false);
      }
      const updated = await pauseLiveCallSession(session.session_id);
      setSession(prev => ({ ...prev, status: 'paused', ...updated }));
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  }

  // Resume session
  async function handleResume() {
    if (!session) return;
    try {
      const updated = await resumeLiveCallSession(session.session_id);
      setSession(prev => ({ ...prev, status: 'active', ...updated }));
      if (inputMode === 'mic' && speechSupported) {
        startWebSpeech(session.session_id);
      }
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  }

  // Stop session
  async function handleStop() {
    if (!session) return;
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsMicListening(false);
      if (simPlaying) {
        clearInterval(simTimerRef.current);
        setSimPlaying(false);
      }
      const updated = await stopLiveCallSession(session.session_id);
      setSession(prev => ({ ...prev, status: 'stopped', ...updated }));
    } catch (err) {
      console.error('Failed to stop:', err);
    }
  }

  // Purge & Delete Session
  async function handlePurge() {
    if (!session) return;
    const sessionId = session.session_id;
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsMicListening(false);
      if (simPlaying) {
        clearInterval(simTimerRef.current);
        setSimPlaying(false);
      }
      await purgeLiveCallSession(sessionId);
      setSession(null);
      setHasConsented(false);
      setConsentCheckboxes({
        micAccess: false,
        noAutoRecord: false,
        riskProcessing: false,
        passiveGuardian: false,
      });
      setPurgeNotice(`Session ${sessionId} and all ephemeral transcripts permanently purged. Zero data retained.`);
    } catch (err) {
      console.error('Failed to purge session:', err);
    }
  }

  // Copy transcript to clipboard
  function handleCopyTranscript() {
    if (!session?.full_transcript) return;
    navigator.clipboard.writeText(
      `KSHEMOS LIVE CALL FORENSIC TRANSCRIPT\nSession ID: ${session.session_id}\nRisk Score: ${session.current_risk_score}%\nRisk Band: ${session.current_risk_band.toUpperCase()}\n\nTranscript:\n${session.full_transcript}`
    );
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2500);
  }

  // Helper color tags for categories
  function getCategoryColor(category) {
    switch (category) {
      case 'threat':
        return 'bg-red-500/10 text-red-700 border-red-300';
      case 'urgency':
        return 'bg-orange-500/10 text-orange-700 border-orange-300';
      case 'secrecy':
        return 'bg-purple-500/10 text-purple-700 border-purple-300';
      case 'payment':
        return 'bg-amber-500/10 text-amber-700 border-amber-300';
      case 'coercion':
        return 'bg-cyan-500/10 text-cyan-700 border-cyan-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  }

  // Render Risk Badge
  function renderRiskBadge(score, band) {
    if (band === 'critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-600 text-white animate-pulse shadow-md">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          Critical Digital Arrest Scam ({score}%)
        </span>
      );
    }
    if (band === 'high') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-600 text-white shadow-sm">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          High Risk Fraud Alert ({score}%)
        </span>
      );
    }
    if (band === 'medium') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          Moderate Suspicion ({score}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
        <span className="w-2 h-2 rounded-full bg-white"></span>
        Low Risk ({score}%)
      </span>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] font-bold mb-1">
            Opt-In Citizen Protection • Real-Time Voice Guardian
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--ink)]">
            Live Scam-Call Shield & Transcription
          </h1>
          <p className="text-sm text-[var(--ink-text)]/70 mt-1 max-w-2xl">
            Authorize a secure live audio stream or transcript during an active phone call to receive real-time suspicious phrase detection, scam probability alerts, and instant safety actions.
          </p>
        </div>

        {/* Ethical Guardrail Badges */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Zero Auto-Recording
          </span>
          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Client-Controlled Consent
          </span>
          <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Never Dials Scammers
          </span>
        </div>
      </div>

      {/* Purge Notification Banner */}
      {purgeNotice && (
        <div className="mb-6 p-4 rounded-xl bg-gray-900 text-white flex items-center justify-between text-sm shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{purgeNotice}</span>
          </div>
          <button onClick={() => setPurgeNotice(null)} className="text-gray-400 hover:text-white text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW STATE 1: CONSENT GATE MODAL / CARD */}
      {!hasConsented && (
        <div className="bg-white border-2 border-[var(--paper-line)] rounded-2xl p-6 sm:p-8 shadow-md">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--ink)]">
                Privacy, Recording & Data-Processing Consent Notice
              </h2>
              <p className="text-sm text-[var(--ink-text)]/75 mt-1">
                Before activating live call monitoring, please review and confirm the ethical permissions below. KshemOS places complete privacy and sovereignty in your hands.
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6 bg-[var(--paper)] p-5 rounded-xl border border-[var(--paper-line)]">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentCheckboxes.micAccess}
                onChange={e => setConsentCheckboxes(c => ({ ...c, micAccess: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--ink)] focus:ring-[var(--saffron)]"
              />
              <span className="text-sm text-[var(--ink)]">
                <strong>Real-Time Microphone Stream Authorization:</strong> I explicitly grant permission to capture live incoming speaker audio solely for speech-to-text transcription during this active call.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentCheckboxes.noAutoRecord}
                onChange={e => setConsentCheckboxes(c => ({ ...c, noAutoRecord: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--ink)] focus:ring-[var(--saffron)]"
              />
              <span className="text-sm text-[var(--ink)]">
                <strong>Zero Automatic Disk Recording:</strong> I acknowledge that audio data is processed ephemerally in volatile memory. No continuous MP3/WAV recording files are stored on server disks.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentCheckboxes.riskProcessing}
                onChange={e => setConsentCheckboxes(c => ({ ...c, riskProcessing: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--ink)] focus:ring-[var(--saffron)]"
              />
              <span className="text-sm text-[var(--ink)]">
                <strong>Scam Risk Scoring & Phrase Analysis:</strong> I consent to automated natural language scanning to identify extortion patterns (CBI/police impersonation, digital arrest, urgency, safe account transfers).
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentCheckboxes.passiveGuardian}
                onChange={e => setConsentCheckboxes(c => ({ ...c, passiveGuardian: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--ink)] focus:ring-[var(--saffron)]"
              />
              <span className="text-sm text-[var(--ink)]">
                <strong>Passive Guardian & Deletion Rights:</strong> I understand KshemOS will never dial out or communicate with the caller, and I have the unconditional right to pause, stop, or permanently purge this session at any time.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                disabled={!allConsentsChecked}
                onClick={() => handleActivateSession('Live Incoming Call')}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center gap-2 ${
                  allConsentsChecked
                    ? 'bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                I Understand & Grant Consent — Start Shield
              </button>

              <button
                onClick={() => {
                  setConsentCheckboxes({
                    micAccess: true,
                    noAutoRecord: true,
                    riskProcessing: true,
                    passiveGuardian: true,
                  });
                }}
                className="text-xs text-[var(--ink-text)]/60 hover:text-[var(--ink)] underline py-1"
              >
                Select all
              </button>
            </div>

            <div className="text-xs text-[var(--ink-text)]/50 font-mono">
              RFC-Compliant Opt-In Session Guard
            </div>
          </div>
        </div>
      )}

      {/* VIEW STATE 2: ACTIVE LIVE CALL DASHBOARD */}
      {hasConsented && session && (
        <div className="space-y-6">
          {/* Top Session Control Bar */}
          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                {session.status === 'active' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : session.status === 'paused' ? (
                  <span className="inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                ) : (
                  <span className="inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                    Session: {session.session_id}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md uppercase font-semibold ${
                    session.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                    session.status === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {session.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--ink-text)]/60">
                  {session.caller_label} • Started {new Date(session.started_at).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Action Buttons: Pause, Stop, Purge */}
            <div className="flex flex-wrap items-center gap-2">
              {session.status === 'active' && (
                <button
                  onClick={handlePause}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pause Listening
                </button>
              )}

              {session.status === 'paused' && (
                <button
                  onClick={handleResume}
                  className="px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume Listening
                </button>
              )}

              {session.status !== 'stopped' && (
                <button
                  onClick={handleStop}
                  className="px-3.5 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-100 transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Call
                </button>
              )}

              <button
                onClick={handleCopyTranscript}
                disabled={!session.full_transcript}
                className="px-3.5 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-100 transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                {copiedTranscript ? 'Copied!' : 'Copy Evidence'}
              </button>

              <button
                onClick={handlePurge}
                className="px-3.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete & Purge Session
              </button>
            </div>
          </div>

          {/* CRITICAL ACTIONABLE SAFETY ALERT HERO (If risk >= 50%) */}
          {session.current_risk_score >= 50 && (
            <div className="rounded-2xl p-6 bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg animate-pulse-slow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-white font-bold text-2xl">
                    🚨
                  </div>
                  <div>
                    <div className="inline-block px-3 py-0.5 rounded-full bg-white/20 text-xs font-mono font-bold tracking-wider uppercase mb-1">
                      Urgent Safety Directive
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold font-display">
                      Immediate Action Required: End This Call
                    </h2>
                    <p className="text-sm text-red-100 mt-1 max-w-2xl">
                      This call exhibits conclusive signatures of an impersonation / digital arrest cyber attack.
                    </p>
                  </div>
                </div>

                <a
                  href="tel:1930"
                  className="px-5 py-3 rounded-xl bg-white text-red-700 font-bold text-sm hover:bg-red-50 transition shadow-md shrink-0 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Dial 1930 Now
                </a>
              </div>

              {/* Action checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20 text-xs">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="font-bold text-sm mb-1">1. Disconnect Call</div>
                  <div>Genuine police and courts NEVER arrest people over Skype, WhatsApp, or phone.</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="font-bold text-sm mb-1">2. Zero Money Transfers</div>
                  <div>No "RBI safe accounts" exist. Moving money to verify innocence is 100% fraud.</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="font-bold text-sm mb-1">3. Verify Independently</div>
                  <div>Report immediately to 1930 or visit your local jurisdictional police station.</div>
                </div>
              </div>
            </div>
          )}

          {/* Main 2-Column Grid: Left (Live Transcript), Right (Live Intelligence & Risk HUD) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: Live Transcript Terminal (7 Cols) */}
            <div className="lg:col-span-7 bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm flex flex-col h-[640px]">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--paper-line)]">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isMicListening ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <h3 className="font-display font-bold text-base text-[var(--ink)]">
                    Live Incremental Transcript
                  </h3>
                </div>

                {/* Input Switcher */}
                <div className="flex items-center gap-1 bg-[var(--paper)] p-1 rounded-lg border border-[var(--paper-line)] text-xs">
                  <button
                    onClick={() => {
                      setInputMode('mic');
                      if (session.status === 'active' && speechSupported) startWebSpeech(session.session_id);
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      inputMode === 'mic' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
                    }`}
                  >
                    Microphone
                  </button>
                  <button
                    onClick={() => setInputMode('simulation')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      inputMode === 'simulation' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
                    }`}
                  >
                    Call Simulation
                  </button>
                  <button
                    onClick={() => setInputMode('custom')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      inputMode === 'custom' ? 'bg-[var(--ink)] text-white shadow-xs' : 'text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
                    }`}
                  >
                    Text Input
                  </button>
                </div>
              </div>

              {/* Transcript Scroll Area */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 font-sans pr-1">
                {session.utterances.length === 0 && !micInterimText && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--ink-text)]/50">
                    <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                    <div className="font-semibold text-sm text-[var(--ink)]">Awaiting speech audio...</div>
                    <p className="text-xs max-w-sm mt-1">
                      Speak into your microphone or trigger a simulation scenario below. Speech will be transcribed and evaluated in real time.
                    </p>
                  </div>
                )}

                {session.utterances.map((u, idx) => (
                  <div key={u.utterance_id || idx} className="rounded-xl p-3 bg-[var(--paper)] border border-[var(--paper-line)] text-sm">
                    <div className="flex items-center justify-between text-xs text-[var(--ink-text)]/50 mb-1 font-mono">
                      <span className="font-semibold text-[var(--saffron)]">{u.speaker === 'caller' ? 'Caller Speech' : 'Citizen'}</span>
                      <span>{new Date(u.timestamp_ms).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[var(--ink)] leading-relaxed">{u.text}</p>

                    {/* Detected Phrase Highlights in this chunk */}
                    {u.suspicious_phrases?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--paper-line)]/50 flex flex-wrap gap-1.5">
                        {u.suspicious_phrases.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md border font-medium ${getCategoryColor(p.category)}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            "{p.phrase}" ({p.category})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Interim Live Speech Bubble */}
                {micInterimText && (
                  <div className="rounded-xl p-3 bg-blue-50/60 border border-blue-200 text-sm animate-pulse">
                    <div className="text-xs text-blue-600 mb-1 font-mono font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                      Transcribing live incoming audio...
                    </div>
                    <p className="text-blue-900 italic">{micInterimText}</p>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Bottom Stream / Input Control Deck */}
              <div className="pt-3 border-t border-[var(--paper-line)]">
                {/* Mode 1: Microphone Deck */}
                {inputMode === 'mic' && (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-[var(--ink-text)]/70">
                      {isMicListening ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Microphone Active • Continuous Speech Recognition
                        </span>
                      ) : (
                        <span className="text-gray-500">
                          Microphone standby. Click to activate listener.
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (isMicListening) {
                          if (recognitionRef.current) recognitionRef.current.stop();
                          setIsMicListening(false);
                        } else {
                          startWebSpeech(session.session_id);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--ink)] text-white font-medium hover:bg-[var(--ink)]/90"
                    >
                      {isMicListening ? 'Mute Mic' : 'Start Mic Stream'}
                    </button>
                  </div>
                )}

                {/* Mode 2: Realistic Call Simulation Deck */}
                {inputMode === 'simulation' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={selectedSimId}
                        onChange={e => {
                          setSelectedSimId(e.target.value);
                          setSimStepIndex(0);
                        }}
                        className="rounded-lg border border-[var(--paper-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] focus:outline-none"
                      >
                        {SAMPLE_CALL_SIMULATIONS.map(s => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleNextSimChunk}
                          disabled={simStepIndex >= activeSim.chunks.length || session.status !== 'active'}
                          className="px-3 py-1 rounded-lg bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--ink)]/90 disabled:opacity-40"
                        >
                          Send Next Chunk ({simStepIndex}/{activeSim.chunks.length})
                        </button>
                        <button
                          onClick={handleToggleSimAutoPlay}
                          disabled={simStepIndex >= activeSim.chunks.length || session.status !== 'active'}
                          className="px-3 py-1 rounded-lg border border-[var(--paper-line)] text-xs font-semibold hover:bg-[var(--paper)] disabled:opacity-40"
                        >
                          {simPlaying ? 'Pause Auto-Play' : 'Auto-Play Call'}
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--ink-text)]/60 italic">
                      {activeSim.scenarioDescription}
                    </div>
                  </div>
                )}

                {/* Mode 3: Manual Text Input Deck */}
                {inputMode === 'custom' && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (customChunkText.trim()) {
                        handleIngestText(customChunkText);
                        setCustomChunkText('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Type or paste incoming caller speech chunk..."
                      value={customChunkText}
                      onChange={e => setCustomChunkText(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--paper-line)] px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--saffron)]"
                    />
                    <button
                      type="submit"
                      disabled={!customChunkText.trim() || session.status !== 'active'}
                      className="px-3 py-1.5 rounded-lg bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--ink)]/90 disabled:opacity-40"
                    >
                      Analyze
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* RIGHT: Real-Time Risk Intelligence & HUD (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Radial Risk Meter Card */}
              <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-base text-[var(--ink)]">
                    Scam Probability Radar
                  </h3>
                  {renderRiskBadge(session.current_risk_score, session.current_risk_band)}
                </div>

                <div className="flex items-center gap-6">
                  {/* Score Number Display */}
                  <div className="relative flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 border-gray-100 shadow-inner bg-[var(--paper)]">
                    <span className="font-display text-3xl font-extrabold text-[var(--ink)]">
                      {session.current_risk_score}%
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--ink-text)]/60">
                      Risk Index
                    </span>
                  </div>

                  {/* Tactical Pillar Progress Bars */}
                  <div className="flex-1 space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-0.5">
                        <span className="text-red-700 font-semibold">Threat / Arrest</span>
                        <span>{session.tactics_breakdown?.threat || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-all duration-300"
                          style={{ width: `${session.tactics_breakdown?.threat || 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-0.5">
                        <span className="text-amber-700 font-semibold">Safe Account / Money</span>
                        <span>{session.tactics_breakdown?.payment || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${session.tactics_breakdown?.payment || 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-0.5">
                        <span className="text-purple-700 font-semibold">Secrecy / Isolation</span>
                        <span>{session.tactics_breakdown?.secrecy || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 transition-all duration-300"
                          style={{ width: `${session.tactics_breakdown?.secrecy || 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-0.5">
                        <span className="text-orange-700 font-semibold">Urgency Pressure</span>
                        <span>{session.tactics_breakdown?.urgency || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 transition-all duration-300"
                          style={{ width: `${session.tactics_breakdown?.urgency || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable Safety Guidance Prompts */}
              <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm">
                <h3 className="font-display font-bold text-base text-[var(--ink)] mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Actionable Safety Prompts
                </h3>

                <div className="space-y-2">
                  {session.actionable_safety_prompts?.map((prompt, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[var(--paper)] border border-[var(--paper-line)] text-xs font-medium text-[var(--ink)] leading-relaxed">
                      {prompt}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Official Helplines Directory */}
              <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm">
                <h3 className="font-display font-bold text-sm text-[var(--ink)] mb-3 flex items-center justify-between">
                  <span>Official Verification Numbers</span>
                  <span className="text-[10px] font-mono uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Direct Directory
                  </span>
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {OFFICIAL_HELPLINES.map(h => (
                    <div key={h.number} className="p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-[var(--ink)] text-xs">{h.name}</div>
                        <div className="text-[10px] text-[var(--ink-text)]/60 line-clamp-1 mt-0.5">{h.description}</div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[var(--paper-line)] flex items-center justify-between">
                        <a
                          href={`tel:${h.number}`}
                          className="font-mono font-bold text-sm text-[var(--saffron)] hover:underline"
                        >
                          📞 {h.number}
                        </a>
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Visit
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
