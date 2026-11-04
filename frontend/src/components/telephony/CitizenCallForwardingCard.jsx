import { useState } from 'react';
import { PhoneForwarded, ShieldCheck, UserCheck, PhoneCall, Radio, CheckCircle2, Clock } from 'lucide-react';
import { forwardCallApi, HONEYPOT_PERSONAS } from '../../api.js';

export default function CitizenCallForwardingCard() {
  const [callerPhone, setCallerPhone] = useState('+91-98765-43210');
  const [callerClaims, setCallerClaims] = useState('CBI Cyber Cell Inspector');
  const [selectedPersonaId, setSelectedPersonaId] = useState('PERSONA-SHASTRI-68');
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(135);

  async function handleForward() {
    setLoading(true);
    try {
      const session = await forwardCallApi({
        caller_phone: callerPhone,
        caller_claims_to_be: callerClaims,
        preferred_persona_id: selectedPersonaId,
        initial_transcript: `This is ${callerClaims}. You are under digital arrest for contraband seized at Mumbai Airport. Transfer verification fee immediately.`,
      });
      setActiveSession(session);
    } catch (err) {
      console.error('Call forwarding failed:', err);
    } finally {
      setLoading(false);
    }
  }

  const selectedPersona = HONEYPOT_PERSONAS.find((p) => p.id === selectedPersonaId) || HONEYPOT_PERSONAS[0];

  return (
    <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-6 shadow-sm space-y-4">
      {/* Eyebrow and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--paper-line)] pb-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] flex items-center gap-1.5 mb-1 font-bold">
            <PhoneForwarded size={14} className="text-red-500 animate-pulse" />
            <span>Citizen Safe Protection · Call-Forwarding Mode</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--ink)]">
            Active Scam Call? Hand Off to KshemOS AI Honeypot
          </h2>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          AI Safe Bridge Online
        </span>
      </div>

      <p className="text-xs text-[var(--ink-text)]/80 leading-relaxed">
        If you are on an active suspicious call with someone claiming to be police, customs, or court officers, you do
        not need to argue or give away personal details. Transfer the call to our virtual citizen personas in 1 tap.
        The AI will safely waste the scammer's time, extract their mule bank accounts, and preserve court evidence while
        you disconnect.
      </p>

      {!activeSession ? (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                Scammer Calling Number:
              </label>
              <input
                type="text"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="+91-98765-43210"
                className="w-full rounded-xl border border-[var(--paper-line)] p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                Caller Claims to Be:
              </label>
              <input
                type="text"
                value={callerClaims}
                onChange={(e) => setCallerClaims(e.target.value)}
                placeholder="CBI Officer / Mumbai Customs"
                className="w-full rounded-xl border border-[var(--paper-line)] p-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--ink-text)]/60 mb-1">
              Select Autonomous Deflection Persona:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {HONEYPOT_PERSONAS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPersonaId(p.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                    selectedPersonaId === p.id
                      ? 'border-[var(--saffron)] bg-[var(--saffron)]/10 ring-1 ring-[var(--saffron)]'
                      : 'border-[var(--paper-line)] hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="font-bold text-[var(--ink)]">{p.name} ({p.age})</div>
                  <div className="text-[10px] text-[var(--ink-text)]/70 line-clamp-1">{p.profile}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleForward}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[var(--ink)] text-white hover:bg-[var(--navy)] text-xs font-semibold font-mono uppercase tracking-wider flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition"
          >
            <PhoneForwarded size={14} className="text-[var(--saffron)]" />
            <span>{loading ? 'Routing to Honeypot Bridge…' : 'One-Tap Handoff: Transfer Call to AI Agent'}</span>
          </button>
        </div>
      ) : (
        /* Active Deflection Session Tracking Card */
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-50/50 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-800 flex items-center gap-1.5 uppercase">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Call Successfully Transferred to KshemOS Honeypot!</span>
            </span>
            <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded">
              Ref: {activeSession.session_id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-emerald-950">
            <div className="p-2 rounded bg-white border border-emerald-200">
              <div className="text-[10px] text-gray-500">Deflection Persona</div>
              <div className="font-bold">{activeSession.persona?.name}</div>
            </div>
            <div className="p-2 rounded bg-white border border-emerald-200">
              <div className="text-[10px] text-gray-500">Scammer Delayed By</div>
              <div className="font-bold text-amber-700">{Math.floor(timerSeconds / 60)}m {timerSeconds % 60}s</div>
            </div>
            <div className="p-2 rounded bg-white border border-emerald-200">
              <div className="text-[10px] text-gray-500">Protection Status</div>
              <div className="font-bold text-emerald-600">Safe To Hang Up ✓</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs text-slate-700 space-y-1">
            <div className="font-bold text-[var(--ink)]">AI Interaction Summary:</div>
            <p className="text-[11px] leading-relaxed">
              "{activeSession.transcript_turns?.[1]?.text || 'Engaging caller and coaxing mule accounts...'}"
            </p>
          </div>

          <div className="flex justify-between items-center pt-1 text-xs">
            <span className="text-gray-500 font-mono text-[11px]">An official incident FIR has been drafted on your behalf.</span>
            <button
              onClick={() => setActiveSession(null)}
              className="text-xs font-semibold text-emerald-800 hover:underline font-mono"
            >
              Transfer Another Call &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
