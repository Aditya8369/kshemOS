import { useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { analyzeJobOffer } from '../cyberFeatures/jobScamRadar';

export default function JobScamRadarView() {
  const [company, setCompany] = useState('QuickHire');
  const [salary, setSalary] = useState('₹5000/day');
  const [message, setMessage] = useState('Pay a registration fee today to start work and receive your salary quickly.');
  const [result, setResult] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">JobScam Radar</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">Fake job offer detector</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Check recruitment messages for upfront fees, unrealistic salaries, and aggressive pressure tactics.</p>
      </div>
      <CyberFeatureCard eyebrow="Career opportunity check" title="Assess a job offer" description="This flags suspicious fee requests and urgency language used in fake job scams.">
        <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Company" />
        <input value={salary} onChange={(e) => setSalary(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Salary" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-28 w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" />
        <button onClick={() => setResult(analyzeJobOffer({ company, salary, message }))} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Analyze offer</button>
        {result && <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm"><div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div><p className="font-semibold">{result.recommendation}</p><ul className="mt-3 space-y-1">{result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}</ul></div>}
      </CyberFeatureCard>
    </div>
  );
}
