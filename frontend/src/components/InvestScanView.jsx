import { useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { analyzeInvestment } from '../cyberFeatures/investScan';

export default function InvestScanView() {
  const [platform, setPlatform] = useState('WealthBoost');
  const [promisedReturn, setPromisedReturn] = useState('₹2000/day');
  const [message, setMessage] = useState('Guaranteed returns with zero risk. Limited slots today.');
  const [result, setResult] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">InvestScan</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">Investment and Ponzi scheme detector</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Look for unrealistic returns, guaranteed profits, and urgency that suggest a Ponzi or crypto scam.</p>
      </div>
      <CyberFeatureCard eyebrow="Investment pitch check" title="Assess an investment offer" description="This screens for unrealistic profits, guaranteed returns, and pressure tactics.">
        <input value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Platform" />
        <input value={promisedReturn} onChange={(e) => setPromisedReturn(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Promised return" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-28 w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" />
        <button onClick={() => setResult(analyzeInvestment({ platform, promisedReturn, message }))} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Analyze investment</button>
        {result && <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm"><div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div><p className="font-semibold">{result.recommendation}</p><ul className="mt-3 space-y-1">{result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}</ul></div>}
      </CyberFeatureCard>
    </div>
  );
}
