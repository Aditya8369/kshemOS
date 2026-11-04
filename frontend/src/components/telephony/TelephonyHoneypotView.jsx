import { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  PhoneForwarded,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Clock,
  UserCheck,
  Cpu,
  Activity,
  Send,
  AlertTriangle,
  Lock,
  RefreshCw,
  Zap,
  ExternalLink,
  Volume2,
  Sliders,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  fetchHoneypotPersonasApi,
  fetchHoneypotSessionsApi,
  processCallTurnApi,
  freezeMuleAccountApi,
  HONEYPOT_CHANGED_EVENT,
} from '../../api.js';
import FraudGraphView from '../FraudGraphView.jsx';

export default function TelephonyHoneypotView() {
  const [personas, setPersonas] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('HP-CALL-8841');
  const [scammerUtterance, setScammerUtterance] = useState('');
  const [processingTurn, setProcessingTurn] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedGraphAccountId, setSelectedGraphAccountId] = useState('ACC-919876543210');

  async function loadData() {
    try {
      const p = await fetchHoneypotPersonasApi();
      setPersonas(p);
      const s = await fetchHoneypotSessionsApi();
      setSessions(s);
      if (s.length > 0 && !selectedSessionId) {
        setSelectedSessionId(s[0].session_id);
      }
    } catch (err) {
      console.error('Failed to load honeypot data:', err);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener(HONEYPOT_CHANGED_EVENT, loadData);
    return () => {
      window.removeEventListener(HONEYPOT_CHANGED_EVENT, loadData);
    };
  }, []);

  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.session_id === selectedSessionId) || sessions[0];
  }, [sessions, selectedSessionId]);

  // Formatted timer for call duration
  const callDurationFormatted = useMemo(() => {
    if (!selectedSession) return '00:00';
    const s = selectedSession.call_duration_seconds || 0;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }, [selectedSession]);

  async function handleSendTurn(customText = null) {
    const textToSend = customText || scammerUtterance;
    if (!textToSend.trim() || !selectedSession) return;
    setProcessingTurn(true);
    try {
      const updated = await processCallTurnApi(selectedSession.session_id, textToSend);
      setScammerUtterance('');
      setNotification({
        type: 'success',
        text: `Scammer turn processed. Persona ${updated.persona.name} replied and prolonged call (+140s).`,
      });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message || 'Failed to process turn' });
    } finally {
      setProcessingTurn(false);
    }
  }

  async function handleFreezeMule(credentialId) {
    if (!selectedSession) return;
    try {
      await freezeMuleAccountApi(selectedSession.session_id, credentialId);
      setNotification({
        type: 'success',
        text: `Section 102 CrPC statutory freeze order generated. Beneficiary account frozen.`,
      });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message || 'Freeze action failed' });
    }
  }

  // Pre-configured simulation phrases for the operator
  const quickScammerPhrases = [
    'Transfer the fee to HDFC account 309100201948 IFSC HDFC0001245 beneficiary Rohan Das right now!',
    'Pay via UPI handle court.holding.cell@paytm immediately or face arrest!',
    'Open https://delhi-police-verify.in/case-892 to review the warrant copy and deposit verification funds!',
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-white font-sans animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-md ${
            notification.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === 'error' ? '🚨' : '✓'}</span>
            <span className="font-medium">{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] flex items-center gap-1.5 mb-1">
              <Radio size={14} className="animate-pulse text-cyan-400" />
              <span>Autonomous Deflection & Signal Intelligence</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              AI Telephony Honeypot & Call-Pattern Triangulation
            </h1>
            <p className="text-xs text-[var(--mist)] mt-0.5 max-w-3xl">
              Safely prolongs active scam calls using realistic virtual citizen personas, extracts mule bank accounts,
              fingerprints acoustic call-center artifacts, and pipes evidence directly into the Fraud Graph Engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/40 border border-emerald-500/50 text-emerald-400">
              <ShieldCheck size={13} />
              <span>Honeypot Bridge Online</span>
            </span>
          </div>
        </div>

        {/* Operational Metrics Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Active Honeypot Sessions</div>
            <div className="text-2xl font-bold font-display text-cyan-300 mt-0.5">{sessions.length}</div>
            <div className="text-[10px] text-emerald-400">Live Scammer Deflection</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Scammer Time Prolonged</div>
            <div className="text-2xl font-bold font-display text-amber-300 mt-0.5">32m 38s</div>
            <div className="text-[10px] text-[var(--mist)]">Avg 15.4m per honeypot</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Harvested Mule Accounts</div>
            <div className="text-2xl font-bold font-display text-red-400 mt-0.5">
              {sessions.reduce((acc, s) => acc + (s.harvested_credentials?.length || 0), 0)}
            </div>
            <div className="text-[10px] text-[var(--mist)]">Piped to Fraud Graph</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Syndicate Triangulations</div>
            <div className="text-2xl font-bold font-display text-purple-300 mt-0.5">94.2%</div>
            <div className="text-[10px] text-purple-300">Mewat & Poipet Clusters</div>
          </div>
        </div>

        {/* Personas Showcase Bar */}
        <div className="pt-2 border-t border-[var(--navy-line)]">
          <div className="text-[11px] font-mono text-[var(--mist)] mb-2 flex items-center gap-1.5">
            <UserCheck size={12} className="text-[var(--saffron)]" />
            <span>Autonomous Deflection Personas:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {personas.map((p) => (
              <div key={p.id} className="p-3 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="text-[10px] text-[var(--saffron)]">{p.age} yrs</span>
                </div>
                <div className="text-[11px] text-[var(--mist)] line-clamp-1">{p.profile}</div>
                <div className="text-[10px] text-emerald-300/90 font-mono">
                  🎯 Targets: {p.primary_target_extraction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Two-Column Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Call Console & Live Transcript (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Session Card */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--navy-line)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--saffron)]">
                    {selectedSession?.session_id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                    ● {selectedSession?.call_status}
                  </span>
                  <span className="text-xs font-mono text-white/60">
                    Forwarded by {selectedSession?.forwarded_by_citizen_id}
                  </span>
                </div>
                <div className="font-display text-base font-bold text-white mt-1">
                  Caller: <span className="font-mono text-cyan-300">{selectedSession?.caller_phone}</span> (
                  {selectedSession?.caller_claims_to_be})
                </div>
              </div>

              {/* Call Prolongation Timer */}
              <div className="bg-[var(--ink)] border border-[var(--navy-line)] px-3 py-1.5 rounded-xl font-mono text-right">
                <div className="text-[10px] text-[var(--mist)] uppercase flex items-center gap-1 justify-end">
                  <Clock size={11} className="text-amber-400" />
                  <span>Prolongation Duration</span>
                </div>
                <div className="text-lg font-bold text-amber-300">{callDurationFormatted}</div>
              </div>
            </div>

            {/* Persona Active Banner */}
            <div className="p-3 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--saffron)]/20 border border-[var(--saffron)] text-[var(--saffron)] flex items-center justify-center font-bold text-xs">
                  👴
                </div>
                <div>
                  <div className="font-bold text-white">{selectedSession?.persona.name}</div>
                  <div className="text-[10px] text-[var(--mist)]">{selectedSession?.persona.prolongation_tactic}</div>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 rounded">
                Active AI Voice Engine
              </span>
            </div>

            {/* Live Conversation Transcript Feed */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedSession?.transcript_turns?.map((turn, idx) => {
                const isScammer = turn.speaker === 'SCAMMER';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isScammer ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono mb-1">
                      <span className={isScammer ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {isScammer ? '🚨 SCAM CALLER' : `🛡️ ${selectedSession.persona.name}`}
                      </span>
                      <span className="text-white/40">{new Date(turn.timestamp).toLocaleTimeString()}</span>
                      {turn.harvested_credential_id && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                          ★ Mule Harvested
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        isScammer
                          ? 'bg-red-950/40 border border-red-500/30 text-red-100 rounded-tl-sm'
                          : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-100 rounded-tr-sm'
                      }`}
                    >
                      {turn.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Turn Simulator Form */}
            <div className="pt-3 border-t border-[var(--navy-line)] space-y-2">
              <div className="text-[11px] font-mono text-[var(--mist)] flex justify-between">
                <span>Simulate Scammer Dialogue Turn:</span>
                <span className="text-[10px] text-[var(--saffron)]">Autonomous Persona Will Respond</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={scammerUtterance}
                  onChange={(e) => setScammerUtterance(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendTurn()}
                  placeholder="Enter scammer response (e.g. Transfer ₹1,50,000 to State Bank account...)"
                  className="flex-1 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--saffron)] font-mono"
                />
                <button
                  onClick={() => handleSendTurn()}
                  disabled={processingTurn || !scammerUtterance.trim()}
                  className="px-4 py-2 bg-[var(--saffron)] hover:brightness-110 text-[var(--ink)] font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 font-mono uppercase tracking-wider disabled:opacity-40"
                >
                  <Send size={13} />
                  <span>{processingTurn ? 'Processing…' : 'Send Turn'}</span>
                </button>
              </div>

              {/* Quick Prompt Injection Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickScammerPhrases.map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendTurn(phrase)}
                    disabled={processingTurn}
                    className="text-[10px] font-mono text-left px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 truncate max-w-full"
                  >
                    ⚡ {phrase.slice(0, 75)}…
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Triangulation, Mule Accounts & Fraud Graph (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Acoustic & Script Pattern Triangulation Card */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="font-display font-semibold text-white text-base flex items-center gap-2">
                <Activity size={16} className="text-purple-400" />
                <span>Acoustic & Script Triangulation</span>
              </h3>
              <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-950/40 border border-purple-500/40 px-2 py-0.5 rounded">
                {selectedSession?.script_triangulation?.confidence_score * 100}% Confidence
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl space-y-1">
                <div className="text-[10px] text-[var(--mist)] uppercase">Triangulated Syndicate</div>
                <div className="font-bold text-white text-sm">
                  {selectedSession?.script_triangulation?.matched_syndicate_name}
                </div>
                <div className="text-[11px] text-[var(--saffron)]">
                  ID: {selectedSession?.script_triangulation?.matched_syndicate_id} · Similarity:{' '}
                  {selectedSession?.script_triangulation?.script_similarity_pct}%
                </div>
                <div className="text-[10px] text-white/70">
                  Origin: {selectedSession?.script_triangulation?.geographic_origin}
                </div>
              </div>

              {/* Acoustic Analysis Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl">
                  <div className="text-[10px] text-[var(--mist)] flex items-center gap-1">
                    <Volume2 size={11} className="text-amber-400" />
                    <span>Call-Center Cross-Talk</span>
                  </div>
                  <div className="text-base font-bold text-amber-300 mt-0.5">
                    {Math.round(selectedSession?.acoustic_fingerprint?.ambient_cross_talk_score * 100)}%
                  </div>
                  <div className="text-[9px] text-[var(--mist)]">Multi-speaker chatter</div>
                </div>

                <div className="p-2.5 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl">
                  <div className="text-[10px] text-[var(--mist)] flex items-center gap-1">
                    <Radio size={11} className="text-cyan-400" />
                    <span>VoIP Codec Jitter</span>
                  </div>
                  <div className="text-base font-bold text-cyan-300 mt-0.5">
                    {selectedSession?.acoustic_fingerprint?.voip_codec_jitter_ms} ms
                  </div>
                  <div className="text-[9px] text-[var(--mist)]">Packet latency match</div>
                </div>
              </div>

              <div className="p-2.5 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl text-[10px] text-white/80">
                <span className="text-[var(--mist)]">PBX Dialer Signature:</span>{' '}
                <span className="text-white font-bold">{selectedSession?.acoustic_fingerprint?.ivr_signature_match}</span>
              </div>
            </div>
          </div>

          {/* Harvested Mule Accounts Table & Immediate Freeze Action */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="font-display font-semibold text-white text-base flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-400" />
                <span>Harvested Mule Accounts ({selectedSession?.harvested_credentials?.length || 0})</span>
              </h3>
              <span className="text-[10px] font-mono text-emerald-400">Piped to Fraud Graph</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedSession?.harvested_credentials?.map((mule) => (
                <div
                  key={mule.credential_id}
                  onClick={() => setSelectedGraphAccountId(mule.value)}
                  className={`p-3 rounded-xl border font-mono text-xs cursor-pointer transition ${
                    selectedGraphAccountId === mule.value
                      ? 'bg-[var(--ink)] border-[var(--saffron)]'
                      : 'bg-[var(--ink)]/60 border-[var(--navy-line)] hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-white text-xs">{mule.value}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        mule.freeze_status === 'frozen'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                      }`}
                    >
                      {mule.freeze_status}
                    </span>
                  </div>

                  <div className="text-[10px] text-[var(--mist)] space-y-0.5">
                    <div>Provider: {mule.bank_or_provider} {mule.ifsc_code ? `· IFSC: ${mule.ifsc_code}` : ''}</div>
                    <div>Beneficiary: <span className="text-white">{mule.beneficiary_name || 'Anonymous Mule'}</span></div>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-[10px]">
                    <span className="text-[var(--saffron)] font-bold">Warrant: {mule.freeze_warrant_id}</span>
                    {mule.freeze_status !== 'frozen' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFreezeMule(mule.credential_id);
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[9px] transition uppercase tracking-wider"
                      >
                        Freeze (Sec 102 CrPC)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Embedded Interactive Fraud Graph */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="font-display font-semibold text-white text-base flex items-center gap-2">
                <Cpu size={16} className="text-[var(--saffron)]" />
                <span>Fraud Graph Engine Topology</span>
              </h3>
              <span className="text-[10px] font-mono text-[var(--mist)]">Live Mule Cluster</span>
            </div>

            <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2">
              <FraudGraphView
                centerId={selectedGraphAccountId || 'ACC-919876543210'}
                neighbors={['ACC-1002', 'ACC-1003', 'ACC-1006', 'ACC-1009']}
                relationships={['HARVESTED_HONEYPOT_BENEFICIARY', 'SHARED_DEVICE', 'SAME_IP', 'TRANSACTED_WITH']}
                flagged={true}
                harvestedAccounts={['ACC-919876543210', 'ACC-309100201948']}
                onSelectNode={(id) => setSelectedGraphAccountId(id)}
              />
            </div>
            <div className="text-[10px] font-mono text-[var(--mist)] text-center">
              Active node: <span className="text-white font-bold">{selectedGraphAccountId}</span> · Mule Probability:{' '}
              <span className="text-red-400 font-bold">98% (High Confidence)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
