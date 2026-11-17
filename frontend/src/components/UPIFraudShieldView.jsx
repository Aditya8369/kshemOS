import { useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { analyzeTransaction } from '../cyberFeatures/upiFraudShield';

export default function UPIFraudShieldView() {
  const [upiId, setUpiId] = useState('random123@paytm');
  const [amount, setAmount] = useState('50000');
  const [reason, setReason] = useState('refund');
  const [result, setResult] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">UPI Fraud Shield</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">UPI transaction risk checker</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Check whether a UPI payment request or transaction looks unusual, especially for odd amounts, app handles, or suspicious reasons.</p>
      </div>
      <CyberFeatureCard eyebrow="Transaction review" title="Evaluate a UPI payment" description="This flags suspicious UPI handles, large amounts, and high-risk reasons.">
        <input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="UPI ID" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Amount" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" placeholder="Reason" />
        <button onClick={() => setResult(analyzeTransaction(upiId, amount, reason, new Date().toISOString(), []))} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Check transaction</button>
        {result && <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm"><div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div><p className="font-semibold">{result.recommendation}</p><ul className="mt-3 space-y-1">{result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}</ul></div>}
      </CyberFeatureCard>
    </div>
  );
}
