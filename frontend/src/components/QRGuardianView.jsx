import { useMemo, useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { scanQRCode } from '../cyberFeatures/qrGuardian';

export default function QRGuardianView() {
  const [input, setInput] = useState('pay@upi\nAmount: ₹5000\nMerchant: QuickRewards\nURL: https://tinyurl.com/abc123');
  const [result, setResult] = useState(null);

  const analysis = useMemo(() => {
    if (!input) return null;
    return scanQRCode(input);
  }, [input]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">QR Guardian</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">QR payment fraud detection</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Paste QR payload text or a suspected payment note and we’ll flag urgency, merchant impersonation, and risky links.</p>
      </div>
      <CyberFeatureCard eyebrow="Rule-driven scan" title="Inspect a QR payment request" description="This uses lightweight heuristics to identify suspicious UPI ids, merchant names, and payment-triggering phrases.">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} className="min-h-32 w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm font-mono" />
        <button onClick={() => setResult(analysis)} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Run scan</button>
        {result && (
          <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm">
            <div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div>
            <p className="font-semibold">{result.recommendation}</p>
            <ul className="mt-3 space-y-1">
              {result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}
            </ul>
          </div>
        )}
      </CyberFeatureCard>
    </div>
  );
}
