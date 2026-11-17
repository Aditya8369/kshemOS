import { useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { analyzeSMS } from '../cyberFeatures/smsAnalyzer';

export default function SMSAnalyzerView() {
  const [sender, setSender] = useState('ALERT');
  const [message, setMessage] = useState('Your account will be blocked. Click now to verify and avoid a fine.');
  const [result, setResult] = useState(null);
  const riskBandLabel = result ? `${result.risk_band.charAt(0).toUpperCase()}${result.risk_band.slice(1)} risk` : '';

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">SMS Analyzer</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">Message scam detection</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Review SMS content for links, urgency, payment requests, and legal threats.</p>
      </div>
      <CyberFeatureCard eyebrow="Message check" title="Analyze a suspicious SMS" description="This screens for classic scam wording and pressure tactics.">
        <input value={sender} onChange={(e) => setSender(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Sender" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-28 w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" />
        <button onClick={() => setResult(analyzeSMS(sender, message))} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Analyze SMS</button>
        {result && (
          <section
            className="space-y-5 rounded-2xl border-2 border-[var(--paper-line)] bg-[var(--paper)] p-4 sm:p-6"
            aria-labelledby="sms-analysis-result"
            aria-live="polite"
          >
            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-[var(--saffron)]">Check result</div>
              <h4 id="sms-analysis-result" className="font-display text-xl font-semibold text-[var(--ink)]">How this message looks</h4>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-xl border border-[var(--paper-line)] bg-white p-4">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--ink-text)]/65">Risk band</div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-2xl font-bold text-[var(--ink)]">{riskBandLabel}</span>
                  <span className="text-sm font-semibold text-[var(--ink-text)]">Score {result.risk_score}/100</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-text)]/75">
                  The score is an indicator based on message patterns, not proof that a person or number is fraudulent.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--paper-line)] bg-white p-4">
                <h5 className="font-display text-base font-semibold text-[var(--ink)]">Key signals</h5>
                {result.signals.length > 0 ? (
                  <ul className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--ink-text)]">
                    {result.signals.map((signal) => (
                      <li key={signal.type} className="flex gap-2 break-words">
                        <span className="shrink-0 font-bold text-[var(--ink)]" aria-hidden="true">•</span>
                        <span>{signal.detail}</span>
                        <span className="sr-only">({signal.severity} severity)</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink-text)]/75">No specific scam signals were detected in this message.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border-l-4 border-[var(--saffron)] bg-white p-4">
              <h5 className="font-display text-base font-semibold text-[var(--ink)]">Recommended next action</h5>
              <p className="mt-2 break-words text-sm font-semibold leading-relaxed text-[var(--ink)]">{result.recommendation}</p>
            </div>
          </section>
        )}
      </CyberFeatureCard>
    </div>
  );
}
