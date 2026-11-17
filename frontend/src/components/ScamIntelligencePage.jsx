
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

const evidenceCategoryStyles = {
  threat: 'bg-red-50 text-red-700 border-red-200',
  urgency: 'bg-orange-50 text-orange-700 border-orange-200',
  secrecy: 'bg-purple-50 text-purple-700 border-purple-200',
  payment: 'bg-amber-50 text-amber-700 border-amber-200',
  pattern: 'bg-blue-50 text-blue-700 border-blue-200',
};

function HighlightedSnippet({ snippet, keyword }) {
  if (!keyword || !snippet) {
    return <>{snippet || 'No snippet available.'}</>;
  }

  const index = snippet.toLowerCase().indexOf(keyword.toLowerCase());

  if (index === -1) {
    return <>{snippet}</>;
  }

  return (
    <>
      {snippet.slice(0, index)}
      <mark className="rounded bg-yellow-200 px-1 font-semibold text-[var(--ink)]">
        {snippet.slice(index, index + keyword.length)}
      </mark>
      {snippet.slice(index + keyword.length)}
    </>
  );
}

export default function ScamIntelligencePage({ setActiveView }) {
  const [transcript, setTranscript] = useState(
    'This is the customs department. Your parcel is held. Do not disconnect and pay the fine immediately.'
  );
  const [claim, setClaim] = useState('customs officer');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedEvidence, setExpandedEvidence] = useState(null);

  async function runAnalysis() {
    setError(null);
    setLoading(true);
    setExpandedEvidence(null);

    try {
      const res = await analyzeScamTranscript({
        transcript,
        callerClaimsToBe: claim,
      });
      setResult(res);
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const evidenceSpans = result?.evidence_spans || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--saffron)]">
              Scam intelligence
            </p>
            <h1 className="font-display text-3xl font-semibold mt-3">
              Analyze the intent behind suspicious calls and messages.
            </h1>
            <p className="mt-3 text-[var(--ink-text)]/70 max-w-3xl">
              This page uses transparent rule-based logic to classify scam scripts,
              detect the likely motive, and explain why the interaction is risky.
            </p>
          </div>

          <button
            onClick={() => setActiveView('rule-library')}
            className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--ink)]/15 transition duration-200 hover:-translate-y-0.5"
          >
            Open the rule library
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featureCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-[var(--paper-line)] bg-[var(--paper)] p-6 shadow-sm"
          >
            <h2 className="font-display text-lg font-semibold mb-3">
              {card.title}
            </h2>
            <p className="text-sm text-[var(--ink-text)]/80">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-6 shadow-sm">
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--saffron)] mb-3">
            Try it live
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full min-h-[180px] rounded-3xl border border-[var(--paper-line)] p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
          />

          <input
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            className="mt-4 w-full rounded-3xl border border-[var(--paper-line)] p-3 text-sm"
            placeholder="Caller claims to be (e.g. CBI officer)"
          />

          <button
            onClick={runAnalysis}
            disabled={loading || !transcript.trim()}
            className="mt-4 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? 'Analyzing…' : 'Run scam intelligence'}
          </button>

          {error && (
            <p className="mt-3 text-sm text-[var(--alert)]">{error}</p>
          )}
        </div>

        <div className="rounded-[2rem] border border-[var(--paper-line)] bg-[var(--paper)] p-6 shadow-sm">
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--ink-text)]/70 mb-3">
            Results
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  Risk band
                </div>
                <div className="mt-2 text-3xl font-display font-semibold text-[var(--ink)]">
                  {result.risk_band}
                </div>
                <div className="mt-2 text-sm text-[var(--ink-text)]/75">
                  Score: {result.risk_score}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  Detected scam type
                </div>
                <div className="mt-2 text-sm text-[var(--ink-text)]/80">
                  {result.scam_types?.join(', ') || 'No specific scam type detected'}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  Likely motive
                </div>
                <div className="mt-2 text-sm text-[var(--ink-text)]/80">
                  {result.motive || 'No clear motive signal found'}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  Why this is suspicious
                </div>
                <p className="mt-2 text-sm text-[var(--ink-text)]/80">
                  {result.recommendation}
                </p>
              </div>

              <div className="rounded-3xl bg-white p-4">
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">
                  Extracted entities (rule-based)
                </div>

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
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">
                  Score breakdown
                </div>

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
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">
                  Timeline of tactics
                </div>

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
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">
                  Extra rule signals (10+ rule checks)
                </div>

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

              {/* Improved evidence panel */}
              <div className="rounded-3xl bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ink)]">
                      Evidence analysis
                    </h3>
                    <p className="mt-1 text-xs text-[var(--ink-text)]/60">
                      Matched phrases found in the supplied transcript
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                    {evidenceSpans.length} signals
                  </span>
                </div>

                {evidenceSpans.length > 0 ? (
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {evidenceSpans.map((s, idx) => {
                      const isExpanded = expandedEvidence === idx;

                      return (
                        <button
                          key={`${s.category}-${s.keyword}-${idx}`}
                          type="button"
                          onClick={() =>
                            setExpandedEvidence(isExpanded ? null : idx)
                          }
                          aria-expanded={isExpanded}
                          className="w-full rounded-xl border border-[var(--paper-line)] bg-white p-3 text-left transition hover:border-[var(--saffron)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                evidenceCategoryStyles[s.category] ||
                                'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              {s.category || 'Other'}
                            </span>

                            <span className="text-xs font-semibold text-[var(--saffron)]">
                              {isExpanded ? 'Collapse −' : 'View evidence +'}
                            </span>
                          </div>

                          <div className="mt-2 break-words text-xs font-mono font-semibold text-[var(--ink-text)]">
                            Matched keyword: {s.keyword || 'Unknown'}
                          </div>

                          {isExpanded && (
                            <div className="mt-3 rounded-lg bg-[var(--paper)] p-3">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-text)]/60">
                                Transcript evidence
                              </p>

                              <p className="break-words text-sm leading-relaxed text-[var(--ink-text)]/85">
                                <HighlightedSnippet
                                  snippet={s.snippet}
                                  keyword={s.keyword}
                                />
                              </p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--paper-line)] bg-[var(--paper)] p-5 text-center">
                    <p className="text-sm font-semibold text-[var(--ink-text)]">
                      No evidence snippets found
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-text)]/60">
                      Try another transcript containing suspicious phrases or requests.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-text)]/75">
              Enter a suspicious script above and run the intelligence engine to view the type, motive, and risk factors.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
