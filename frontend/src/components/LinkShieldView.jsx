import { useMemo, useState } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { inspectURL } from '../cyberFeatures/linkShield';

export default function LinkShieldView() {
  const [url, setUrl] = useState('https://secure-google-login.xyz/account/verify');
  const [result, setResult] = useState(null);

  const analysis = useMemo(() => inspectURL(url), [url]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">LinkShield</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">Fake website and URL inspector</h1>
        <p className="max-w-2xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">Check suspicious links for typosquatting, HTTPS issues, and brand impersonation patterns before you click.</p>
      </div>
      <CyberFeatureCard eyebrow="Open-link check" title="Inspect a suspicious URL" description="This doesn’t fetch the site itself; it checks the URL structure and known phishing indicators.">
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-sm" />
        <button onClick={() => setResult(analysis)} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">Inspect URL</button>
        {result && (
          <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm">
            <div className="mb-2 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">{result.risk_band} risk</div>
            <p className="font-semibold">{result.recommendation}</p>
            <ul className="mt-3 space-y-1">{result.signals.map((signal) => <li key={signal.type}>• {signal.detail}</li>)}</ul>
          </div>
        )}
      </CyberFeatureCard>
    </div>
  );
}
