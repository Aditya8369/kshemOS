import { useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { analyzeIdentity } from '../cyberFeatures/idShield';

export default function IDShieldView() {
  const [idNumber, setIdNumber] = useState('1234 5678 9012');
  const [issuer, setIssuer] = useState('UIDAI');
  const [message, setMessage] = useState('Share your Aadhaar details immediately to avoid suspension.');
  const [result, setResult] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">IDShield</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">Aadhaar, PAN, and identity theft monitor</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Evaluate messages that request Aadhaar, PAN, or other identity numbers and ask for OTP or verification.</p>
      </div>
      <CyberFeatureCard eyebrow="Identity request check" title="Assess a document request" description="This flags suspicious requests for Aadhaar or PAN and pressure to share an OTP.">
        <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="ID number" />
        <input value={issuer} onChange={(e) => setIssuer(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Issuer" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-28 w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" />
        <button onClick={() => setResult(analyzeIdentity({ idNumber, issuer, message }))} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Analyze identity request</button>
        {result && <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm"><div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div><p className="font-semibold">{result.recommendation}</p><ul className="mt-3 space-y-1">{result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}</ul></div>}
      </CyberFeatureCard>
    </div>
  );
}
