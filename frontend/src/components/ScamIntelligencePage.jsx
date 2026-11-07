import { useState } from 'react';
import { analyzeScamTranscript } from '../api';

const featureCards = [
  {
    title: 'Scam type detection',
    description: 'Rule-based classification of the caller’s intent, from payment demand to authority impersonation.',
  },
  {
    title: 'Motive analysis',
    description: 'Detect whether the attacker is forcing payment, hiding from family, or claiming arrest/legal action.',
  },
  {
    title: 'Photo scam scoring',
    description: 'Identify suspicious screenshots or notice-style images using browser-based heuristics.',
  },
  {
    title: 'Rule library access',
    description: 'See 1,000+ generated scam patterns built from real rule-based signals.',
  },
];

export default function ScamIntelligencePage({ setActiveView }) {
  const [transcript, setTranscript] = useState('This is the customs department. Your parcel is held. Do not disconnect and pay the fine immediately.');
  const [claim, setClaim] = useState('customs officer');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runAnalysis() {
    setError(null);
    setLoading(true);
    try {
      const res = await analyzeScamTranscript({ transcript, callerClaimsToBe: claim });
      setResult(res);
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10 w-full">
      <div className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--saffron)] font-semibold">Scam intelligence</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-[var(--ink)]">Analyze the intent behind suspicious calls and messages.</h1>
            <p className="mt-2 text-[var(--ink-text)]/70 max-w-3xl text-sm sm:text-base leading-relaxed">
              This page uses transparent rule-based logic to classify scam scripts, detect the likely motive, and explain why the interaction is risky.
            </p>
          </div>
          <button
            onClick={() => setActiveView('rule-library')}
            className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--ink)]/15 transition duration-200 hover:-translate-y-0.5 min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--saffron)] shrink-0"
          >
            Open the rule library
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featureCards.map((card) => (
          <div key={card.title} className="rounded-3xl border border-[var(--paper-line)] bg-[var(--paper)] p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold mb-3 text-[var(--ink)]">{card.title}</h2>
            <p className="text-sm text-[var(--ink-text)]/80 leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-6 shadow-sm">
          <h2 className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--saffron)] mb-3 font-semibold">Try it live</h2>
          <textarea
            aria-label="Suspicious call or message transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full min-h-[180px] rounded-3xl border border-[var(--paper-line)] p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
          />
          <input
            aria-label="Caller claimed identity or organization"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            className="mt-4 w-full rounded-3xl border border-[var(--paper-line)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
            placeholder="Caller claims to be (e.g. CBI officer)"
          />
          <button
            onClick={runAnalysis}
            disabled={loading || !transcript.trim()}
            aria-label={loading ? 'Analyzing scam intelligence...' : 'Run scam intelligence'}
            className="mt-4 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
          >
            {loading ? 'Analyzing…' : 'Run scam intelligence'}
          </button>
          {error && <p className="mt-3 text-sm text-[var(--alert)]">{error}</p>}
        </div>

        <div className="rounded-[2rem] border border-[var(--paper-line)] bg-[var(--paper)] p-6 shadow-sm">
          <h2 className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--ink-text)]/70 mb-3 font-semibold">Intelligence Results</h2>
          {result ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">Risk band</div>
                <div className="mt-2 text-3xl font-display font-semibold text-[var(--ink)]">{result.risk_band}</div>
                <div className="mt-2 text-sm text-[var(--ink-text)]/75">Score: {result.risk_score}</div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">Detected scam type</div>
                <div className="mt-2 text-sm text-[var(--ink-text)]/80">{result.scam_types?.join(', ') || 'No specific scam type detected'}</div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">Likely motive</div>
                <div className="mt-2 text-sm text-[var(--ink-text)]/80">{result.motive || 'No clear motive signal found'}</div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">Why this is suspicious</div>
                <p className="mt-2 text-sm text-[var(--ink-text)]/80">{result.recommendation}</p>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">Extracted entities (rule-based)</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['OTP', result.entities?.otp],
                    ['Aadhaar', result.entities?.aadhaar],
                    ['UPI', result.entities?.upi],
                    ['Bank', result.entities?.bank],
                    ['Card', result.entities?.cards],
                    ['Amounts', result.entities?.amounts],
                    ['Org/Authority', result.entities?.orgs],
                    ['Dates', result.entities?.dates],
                  ].map(([label, arr]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-1 text-xs font-semibold"
                    >
                      {label}: {(arr && arr.length) ? arr.slice(0, 2).join(', ') : '—'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">Score breakdown</div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-[var(--ink-text)]/80">
                  <div>Threat: {result.evidence?.score_breakdown?.threat ?? 0}</div>
                  <div>Urgency: {result.evidence?.score_breakdown?.urgency ?? 0}</div>
                  <div>Secrecy: {result.evidence?.score_breakdown?.secrecy ?? 0}</div>
                  <div>Payment: {result.evidence?.score_breakdown?.payment ?? 0}</div>
                  <div>Phrases: {result.evidence?.score_breakdown?.phrases ?? 0}</div>
                  <div>Pattern strength: {result.evidence?.score_breakdown?.pattern_strength ?? 0}</div>
                  <div className="sm:col-span-2">
                    Bonuses: strong={result.evidence?.score_breakdown?.bonuses?.strong_signal_bonus ?? 0},
                    authority+payment={result.evidence?.score_breakdown?.bonuses?.authority_payment_bonus ?? 0},
                    urgency+secrecy={result.evidence?.score_breakdown?.bonuses?.urgency_secrecy_bonus ?? 0},
                    callerGov={result.evidence?.score_breakdown?.bonuses?.caller_government_bonus ?? 0}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">Timeline of tactics</div>
                <div className="flex flex-wrap gap-2">
                  {(result.timeline || []).map((e, idx) => (
                    <span
                      key={`${e.type}-${idx}`}
                      className="inline-flex items-center rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold text-[var(--saffron)]"
                    >
                      {e.type}: {e.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">Extra rule signals (10+ rule checks)</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Device/SIM compromise', result.plugin_signals?.deviceSignals],
                    ['Call monitoring', result.plugin_signals?.monitoringSignals],
                    ['Messaging/links', result.plugin_signals?.interactionSignals],
                    ['Identity/KYC pressure', result.plugin_signals?.identitySignals],
                    ['Parcel/delivery scam', result.plugin_signals?.deliverySignals],
                    ['Alt payment methods', result.plugin_signals?.paymentAltSignals],
                    ['Deadline/pressure', result.plugin_signals?.languagePressureSignals],
                    ['Evidence requests', result.plugin_signals?.evidenceRequests],
                    ['Legal phrasing', result.plugin_signals?.legalVibeSignals],
                  ].map(([label, obj]) => {
                    const keys = obj ? Object.keys(obj).filter((k) => obj[k]) : [];
                    return (
                      <span
                        key={label}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-1 text-xs font-semibold"
                      >
                        {label}: {keys.length ? keys.slice(0, 2).join(', ') : '—'}
                      </span>
                    );
                  })}
                </div>
              </div>


              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">Evidence spans (clickable snippets)</div>
                <div className="space-y-2">
                  {(result.evidence_spans || []).slice(0, 8).map((s, idx) => (
                    <div key={`${s.category}-${idx}`} className="rounded-xl border border-[var(--paper-line)] bg-white p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-text)]/50 mb-1">
                        {s.category}
                      </div>
                      <div className="text-xs font-mono text-[var(--ink-text)]/85">Keyword: {s.keyword}</div>
                      <div className="mt-2 text-sm text-[var(--ink-text)]/80">{s.snippet}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-text)]/75">Enter a suspicious script above and run the intelligence engine to view the type, motive, and risk factors.</p>
          )}
        </div>

      </div>
    </div>
  );
}
