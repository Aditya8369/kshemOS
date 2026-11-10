import { useState, useEffect, useRef } from 'react';
import {
  SUPPORTED_INDIC_LANGUAGES,
  INDIC_HOTLINE_CATALOG,
  playDtmfTone,
  speakText,
  stopSpeaking,
  startLocalVoiceHotlineCall,
  processLocalVoiceHotlineInput,
  listLocalVoiceHotlineSessions,
  getLocalDispatchedSms,
  startVoiceHotlineCallApi,
  submitVoiceHotlineInputApi,
  listVoiceHotlineSessionsApi,
  getVoiceHotlineStatsApi,
} from '../api.js';

export default function VoiceSafetyHotlineView() {
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'sms' | 'triage' | 'telemetry'

  // Call session state
  const [session, setSession] = useState(null);
  const [promptData, setPromptData] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [callerPhone, setCallerPhone] = useState('+91 98765 43210');
  const [telecomCircle, setTelecomCircle] = useState('Delhi');
  const [backendEngine, setBackendEngine] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const [dispatchedSmsList, setDispatchedSmsList] = useState([]);
  const [hotlineStats, setHotlineStats] = useState(null);

  const timerRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    refreshHistory();
    return () => {
      stopSpeaking();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [backendEngine]);

  // Duration timer
  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling]);

  async function refreshHistory() {
    try {
      if (backendEngine) {
        const [sess, stats] = await Promise.all([
          listVoiceHotlineSessionsApi(),
          getVoiceHotlineStatsApi(),
        ]);
        setSessionsList(sess);
        setHotlineStats(stats);
        return;
      }
    } catch {
      // Fallback to local store
    }
    setSessionsList(listLocalVoiceHotlineSessions());
    setDispatchedSmsList(getLocalDispatchedSms());
  }

  // Start Call
  async function handleStartCall() {
    stopSpeaking();
    setIsCalling(true);
    setCallDuration(0);

    const payload = {
      caller_phone: callerPhone,
      initial_language: selectedLanguage,
      telecom_circle: telecomCircle,
      is_forwarded_call: false,
    };

    let promptRes = null;
    try {
      if (backendEngine) {
        promptRes = await startVoiceHotlineCallApi(payload);
      }
    } catch {
      // Fallback
    }

    if (!promptRes) {
      promptRes = startLocalVoiceHotlineCall(payload);
    }

    setPromptData(promptRes);
    setSession({
      session_id: promptRes.session_id,
      language: promptRes.selected_language,
      current_step: promptRes.current_step,
    });

    if (!isMuted && promptRes.audio_text) {
      speakText(promptRes.audio_text, promptRes.audio_locale);
    }
    refreshHistory();
  }

  // End Call
  function handleEndCall() {
    stopSpeaking();
    setIsCalling(false);
    setSession(null);
    setPromptData(null);
  }

  // Handle Keypad Press (DTMF)
  async function handleKeyPress(digit) {
    playDtmfTone(digit, 140);
    if (!isCalling || !session) return;

    stopSpeaking();
    const payload = {
      session_id: session.session_id,
      dtmf_digit: digit,
    };

    let nextPrompt = null;
    try {
      if (backendEngine) {
        nextPrompt = await submitVoiceHotlineInputApi(payload);
      }
    } catch {
      // Fallback
    }

    if (!nextPrompt) {
      nextPrompt = processLocalVoiceHotlineInput(payload);
    }

    setPromptData(nextPrompt);
    setSelectedLanguage(nextPrompt.selected_language);
    setSession((prev) => ({
      ...prev,
      language: nextPrompt.selected_language,
      current_step: nextPrompt.current_step,
    }));

    if (!isMuted && nextPrompt.audio_text) {
      speakText(nextPrompt.audio_text, nextPrompt.audio_locale);
    }
    refreshHistory();
  }

  // Quick Language Pill Switch
  function handleQuickLanguageSelect(langCode, dtmfKey) {
    setSelectedLanguage(langCode);
    if (isCalling && session && session.current_step === 'WELCOME_LANG_SELECT') {
      handleKeyPress(dtmfKey);
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return (
    <div className="w-full space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--navy)] via-[var(--ink)] to-[#0c1a2e] text-white p-6 sm:p-8 rounded-3xl border border-[var(--navy-line)] shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
              OPEN-SOURCE IVR // 8 INDIC LANGUAGES SUPPORTED
            </span>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/10 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isCalling ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`}></span>
              <span>{isCalling ? 'Call Active (IVR Connected)' : 'Hotline Ready (Toll-Free 1930)'}</span>
              <button
                type="button"
                onClick={() => setBackendEngine(!backendEngine)}
                className="ml-2 text-[10px] uppercase font-bold text-[var(--saffron)] underline hover:text-white"
              >
                {backendEngine ? 'API Engine' : 'Client Store'}
              </button>
            </div>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Multilingual Automated Voice Safety Hotline
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-300 max-w-4xl leading-relaxed">
            Automated Interactive Voice Response (IVR) state machine and voice deflection gateway supporting 8 Indic languages
            (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, English). Citizens can dial or forward suspicious calls
            to receive simple step-by-step guidance, calm authoritative reassurance, automated 1930 SMS dispatch, and anonymous regional triage logging.
          </p>

          {/* Supported Languages Badges */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/10">
            {SUPPORTED_INDIC_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleQuickLanguageSelect(lang.code, lang.dtmf_key)}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-all border ${
                  selectedLanguage === lang.code
                    ? 'bg-[var(--saffron)] text-white border-[var(--saffron)] shadow'
                    : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20'
                }`}
              >
                <span className="font-bold mr-1">{lang.native_name}</span>
                <span className="opacity-70">({lang.name} • {lang.dtmf_key})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--paper-line)] pb-3">
        {[
          { id: 'simulator', label: '1. Voice Hotline & Keypad', icon: '📞' },
          { id: 'sms', label: '2. Dispatched SMS Summaries', icon: '💬' },
          { id: 'triage', label: '3. Regional Triage Sync', icon: '🚨' },
          { id: 'telemetry', label: '4. Hotline Telemetry', icon: '📊' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              refreshHistory();
            }}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[var(--navy)] text-white shadow-md'
                : 'bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-line)]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: SIMULATOR & KEYPAD */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Virtual Phone / Keypad Frame */}
          <div className="lg:col-span-5 bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--saffron)] font-bold">
                  HOTLINE TERMINAL
                </span>
                <h3 className="font-display text-base font-bold text-[var(--ink)]">
                  Citizen Voice Deflection
                </h3>
              </div>
              <div className="text-right">
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                  isCalling ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-gray-100 text-gray-600'
                }`}>
                  {isCalling ? `LIVE: ${formatTime(callDuration)}` : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            {/* Simulated Caller Meta Input (when not calling) */}
            {!isCalling ? (
              <div className="p-4 bg-[var(--paper)] rounded-2xl space-y-3 text-xs font-mono">
                <div>
                  <label className="block text-gray-600 font-bold mb-1">Incoming Caller / ANI:</label>
                  <input
                    type="text"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[var(--paper-line)] bg-white text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-bold mb-1">Telecom Circle (Regional Desk):</label>
                  <select
                    value={telecomCircle}
                    onChange={(e) => setTelecomCircle(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[var(--paper-line)] bg-white text-[var(--ink)]"
                  >
                    <option value="Delhi">Delhi / NCR</option>
                    <option value="Mumbai">Mumbai (BKC)</option>
                    <option value="Maharashtra">Maharashtra / Pune</option>
                    <option value="Karnataka">Karnataka / Bengaluru</option>
                    <option value="Tamil Nadu">Tamil Nadu / Chennai</option>
                    <option value="Telangana">Telangana / Hyderabad</option>
                    <option value="West Bengal">West Bengal / Kolkata</option>
                    <option value="Gujarat">Gujarat / Ahmedabad</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-sm shadow"
                >
                  <span>📞 Dial Voice Safety Hotline</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Audio Waveform & Spoken Prompt Subtitle */}
                <div className="p-4 bg-gray-900 rounded-2xl text-white space-y-3 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      Audio Synthesis: {promptData?.audio_locale || 'en-IN'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-[var(--saffron)] hover:underline"
                    >
                      {isMuted ? '🔇 Unmute TTS' : '🔊 Mute TTS'}
                    </button>
                  </div>

                  {/* Audio Wave Bars */}
                  <div className="flex items-center justify-center gap-1 h-8 py-1">
                    {[16, 24, 12, 32, 28, 14, 26, 30, 20, 32, 18, 24].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 bg-[var(--saffron)] rounded-full animate-pulse"
                        style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }}
                      ></span>
                    ))}
                  </div>

                  {/* Spoken Prompt Subtitle */}
                  <div className="text-xs font-mono text-gray-200 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/10 min-h-[60px]">
                    {promptData?.audio_text || 'Connecting to KshemOS IVR Gateway...'}
                  </div>
                </div>

                {/* Hang Up Action */}
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-xs"
                >
                  <span>🛑 Disconnect / End Call</span>
                </button>
              </div>
            )}

            {/* DTMF Dialpad */}
            <div>
              <div className="text-[11px] font-mono text-gray-500 mb-2 uppercase tracking-wider text-center">
                Interactive DTMF Keypad
              </div>
              <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                {[
                  { key: '1', sub: 'Yes / EN' },
                  { key: '2', sub: 'No / HI' },
                  { key: '3', sub: 'TA' },
                  { key: '4', sub: 'TE' },
                  { key: '5', sub: 'KN' },
                  { key: '6', sub: 'BN' },
                  { key: '7', sub: 'MR' },
                  { key: '8', sub: 'GU' },
                  { key: '9', sub: 'WXYZ' },
                  { key: '*', sub: 'Clear' },
                  { key: '0', sub: '+' },
                  { key: '#', sub: 'End' },
                ].map((btn) => (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => handleKeyPress(btn.key)}
                    className="p-3.5 rounded-2xl bg-[var(--paper)] hover:bg-[var(--paper-line)] active:scale-95 transition-all flex flex-col items-center justify-center border border-[var(--paper-line)] group shadow-2xs"
                  >
                    <span className="font-display text-xl font-bold text-[var(--ink)] group-hover:text-[var(--saffron)]">
                      {btn.key}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 tracking-tight">
                      {btn.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* State Machine Flow & Triage Explanation */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step Breadcrumbs */}
            <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-5">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                IVR STATE MACHINE PIPELINE
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Step-by-Step Spoken Guidance Flow
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  promptData?.current_step === 'WELCOME_LANG_SELECT'
                    ? 'border-[var(--saffron)] bg-amber-50 shadow-sm'
                    : 'border-[var(--paper-line)] bg-[var(--paper)] text-gray-500'
                }`}>
                  <div className="font-bold text-[var(--ink)]">1. Language</div>
                  <div className="text-[10px] text-gray-600 mt-1">Press 1–8 for native dialect</div>
                  <div className="mt-2 text-[10px] font-bold text-[var(--navy)]">
                    Active: {selectedLanguage.toUpperCase()}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border transition-all ${
                  promptData?.current_step === 'PROMPT_AUTHORITY'
                    ? 'border-[var(--saffron)] bg-amber-50 shadow-sm'
                    : 'border-[var(--paper-line)] bg-[var(--paper)] text-gray-500'
                }`}>
                  <div className="font-bold text-[var(--ink)]">2. Authority Check</div>
                  <div className="text-[10px] text-gray-600 mt-1">Customs/Police claim?</div>
                  <div className="mt-2 text-[10px] font-bold">
                    {promptData?.claimed_authority === true ? '🚨 Claimed' : promptData?.claimed_authority === false ? 'No' : 'Pending'}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border transition-all ${
                  promptData?.current_step === 'PROMPT_EXTORTION'
                    ? 'border-[var(--saffron)] bg-amber-50 shadow-sm'
                    : 'border-[var(--paper-line)] bg-[var(--paper)] text-gray-500'
                }`}>
                  <div className="font-bold text-[var(--ink)]">3. Extortion Check</div>
                  <div className="text-[10px] text-gray-600 mt-1">Money to avoid arrest?</div>
                  <div className="mt-2 text-[10px] font-bold">
                    {promptData?.demanded_money === true ? '🚨 Demanded' : promptData?.demanded_money === false ? 'No' : 'Pending'}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border transition-all ${
                  promptData?.current_step === 'COMPLETED'
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-[var(--paper-line)] bg-[var(--paper)] text-gray-500'
                }`}>
                  <div className="font-bold text-emerald-800">4. Reassurance & SMS</div>
                  <div className="text-[10px] text-emerald-700 mt-1">Dispatched to citizen</div>
                  <div className="mt-2 text-[10px] font-bold text-emerald-700">
                    {promptData?.sms_dispatched ? '✓ Dispatched' : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Active Step Guidance Details */}
              {promptData ? (
                <div className="p-5 rounded-2xl bg-[var(--paper)] border border-[var(--paper-line)] space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[var(--navy)]">
                      Current Step: {promptData.current_step}
                    </span>
                    <span className="text-gray-500">
                      Nearest Desk: {promptData.nearest_cyber_desk}
                    </span>
                  </div>

                  <p className="text-sm text-[var(--ink)] leading-relaxed">
                    <strong>Spoken Audio Prompt:</strong> {promptData.audio_text}
                  </p>

                  {promptData.allowed_dtmf_keys.length > 0 && (
                    <div className="text-xs font-mono text-gray-600 flex items-center gap-2">
                      <span>Awaiting Keypad Entry:</span>
                      {promptData.allowed_dtmf_keys.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleKeyPress(k)}
                          className="px-2.5 py-0.5 rounded bg-white border border-[var(--paper-line)] hover:bg-[var(--saffron)] hover:text-white font-bold"
                        >
                          Press {k}
                        </button>
                      ))}
                    </div>
                  )}

                  {promptData.is_completed && (
                    <div className="p-4 bg-emerald-100/70 border border-emerald-300 rounded-xl space-y-2 text-xs font-mono text-emerald-950">
                      <div className="font-bold text-sm flex items-center gap-1.5">
                        <span>🛡️ Calm Reassurance Delivered:</span>
                      </div>
                      <p className="italic">"{promptData.audio_text}"</p>
                      <div className="pt-2 border-t border-emerald-200 flex flex-wrap gap-4 text-[11px]">
                        <span>✓ Automated SMS Dispatched</span>
                        <span>✓ Incident Registered: <strong>{promptData.triage_incident_id}</strong></span>
                        <span>✓ Helpline: <strong>1930</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs font-mono text-gray-500 border-2 border-dashed border-[var(--paper-line)] rounded-2xl">
                  Click <strong>Dial Voice Safety Hotline</strong> to test the spoken deflection state machine.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DISPATCHED SMS SUMMARIES */}
      {activeTab === 'sms' && (
        <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                CITIZEN OUTREACH // POST-CALL PROTOCOL
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Automated SMS Summaries with Official Helplines
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Immediately upon completing the automated triage, the system transmits an SMS with the official 1930 helpline,
                reporting portal, and circle-specific cyber police desk so victims have permanent written guidance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispatchedSmsList.length > 0 ? (
              dispatchedSmsList.map((sms, i) => (
                <div key={i} className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-sky-900 font-bold">
                    <span>SMS to: {sms.recipient_phone}</span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(sms.dispatched_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-100 text-gray-800 leading-relaxed">
                    {sms.sms_text}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-sky-800 pt-1">
                    <span>Session: {sms.session_id}</span>
                    <span className="text-emerald-700 font-bold">✓ Carrier Dispatched</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 p-12 text-center text-xs font-mono text-gray-500 border-2 border-dashed border-[var(--paper-line)] rounded-2xl">
                No SMS dispatches yet. Complete a hotline call to trigger automatic carrier dispatch.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REGIONAL TRIAGE FEED SYNC */}
      {activeTab === 'triage' && (
        <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                INCIDENT DASHBOARD FEED
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Anonymous Regional Triage Feed Logging
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Each hotline deflection registers an anonymous entry into the regional triage feed, allowing officers to monitor
                telecom spikes and coordinate with bank nodal officers without compromising caller privacy.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-[var(--paper-line)]">
                <tr>
                  <th className="py-3 px-4">Session ID</th>
                  <th className="py-3 px-4">Caller (Masked)</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Authority Claim</th>
                  <th className="py-3 px-4">Extortion Demanded</th>
                  <th className="py-3 px-4">Triage Incident ID</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--paper-line)]">
                {sessionsList.map((s) => (
                  <tr key={s.session_id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-bold text-[var(--ink)]">{s.session_id}</td>
                    <td className="py-3 px-4">{s.caller_phone_masked}</td>
                    <td className="py-3 px-4 uppercase font-bold text-[var(--navy)]">{s.language}</td>
                    <td className="py-3 px-4">
                      {s.claimed_authority ? (
                        <span className="text-red-700 font-bold">Yes (Customs/Police)</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {s.demanded_money ? (
                        <span className="text-red-700 font-bold">Yes (Money/Arrest)</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">{s.triage_incident_id || 'Pending'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.call_status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.call_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: HOTLINE TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                OPERATIONAL METRICS
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Hotline Call Volume & Language Deflection Telemetry
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-2xl bg-gray-50 border border-[var(--paper-line)]">
              <div className="text-gray-500">TOTAL CALLS</div>
              <div className="text-2xl font-bold text-[var(--ink)] mt-1">
                {hotlineStats?.total_calls || sessionsList.length}
              </div>
              <div className="text-[10px] text-emerald-600 mt-1">100% Deflection</div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-[var(--paper-line)]">
              <div className="text-gray-500">AUTHORITY CLAIMS</div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {hotlineStats?.authorities_flagged || sessionsList.filter((s) => s.claimed_authority).length}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Police / Customs</div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-[var(--paper-line)]">
              <div className="text-gray-500">SMS DISPATCHED</div>
              <div className="text-2xl font-bold text-sky-600 mt-1">
                {hotlineStats?.sms_dispatched_count || sessionsList.filter((s) => s.sms_dispatched).length}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">1930 & Nearest Desk</div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-[var(--paper-line)]">
              <div className="text-gray-500">LANGUAGES ACTIVE</div>
              <div className="text-2xl font-bold text-[var(--saffron)] mt-1">8</div>
              <div className="text-[10px] text-gray-500 mt-1">Indic Dialects</div>
            </div>
          </div>

          {/* Languages Distribution */}
          <div className="p-5 rounded-2xl bg-[var(--paper)] border border-[var(--paper-line)] space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink)]">
              Language Adoption Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              {SUPPORTED_INDIC_LANGUAGES.map((lang) => {
                const count = sessionsList.filter((s) => s.language === lang.code).length;
                return (
                  <div key={lang.code} className="p-3 bg-white rounded-xl border border-[var(--paper-line)] flex items-center justify-between">
                    <div>
                      <div className="font-bold">{lang.native_name}</div>
                      <div className="text-[10px] text-gray-500">{lang.name}</div>
                    </div>
                    <span className="text-sm font-bold text-[var(--navy)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

