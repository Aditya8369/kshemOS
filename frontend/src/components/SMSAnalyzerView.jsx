import { useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { analyzeSMS } from '../cyberFeatures/smsAnalyzer';

export default function SMSAnalyzerView() {
  const [sender, setSender] = useState('ALERT');
  const [message, setMessage] = useState('Your account will be blocked. Click now to verify and avoid a fine.');
  const [result, setResult] = useState(null);

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
        {result && <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm"><div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div><p className="font-semibold">{result.recommendation}</p><ul className="mt-3 space-y-1">{result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}</ul></div>}
      </CyberFeatureCard>
    </div>
  );
}
