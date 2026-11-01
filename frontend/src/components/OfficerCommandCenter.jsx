import { useState } from 'react';
import FraudGraphView from './FraudGraphView';
import IncidentDashboardView from './IncidentDashboardView';
import JurisdictionConfigView from './jurisdiction/JurisdictionConfigView';
import { lookupFraudRing, getCaseSummary } from '../api';

const SAMPLE_ACCOUNTS = ['ACC-1002', 'ACC-1004', 'ACC-1009', 'ACC-1005'];

function Panel({ eyebrow, title, children }) {
  return (
    <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6">
      <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-1">{eyebrow}</div>
      <h2 className="font-display text-xl font-semibold mb-4 text-white">{title}</h2>
      {children}
    </div>
  );
}

function GraphPanel() {
  const [accountId, setAccountId] = useState('ACC-1002');
  const [ring, setRing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run(id) {
    const target = id || accountId;
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await lookupFraudRing(target);
      setRing(res);
      setAccountId(target);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel eyebrow="Fraud Graph Agent" title="Trace an account's fraud ring">
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm font-mono"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="ACC-1002"
        />
        <button
          onClick={() => run()}
          disabled={loading}
          className="bg-[var(--saffron)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? '…' : 'Trace'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {SAMPLE_ACCOUNTS.map((a) => (
          <button
            key={a}
            onClick={() => run(a)}
            className="text-xs font-mono px-2 py-1 rounded-full border border-[var(--navy-line)] text-[var(--mist)] hover:border-[var(--saffron)] hover:text-white"
          >
            {a}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-[var(--alert)] mb-2">{error}</p>}

      <FraudGraphView
        centerId={ring?.account_id}
        neighbors={ring?.connected_accounts || []}
        relationships={ring?.shared_signals || []}
        flagged={ring?.is_flagged}
      />

      {ring && (
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <Stat label="Mule probability" value={`${Math.round(ring.mule_probability * 100)}%`} />
          <Stat label="Ring ID" value={ring.ring_id || '—'} />
          <Stat label="Flagged" value={ring.is_flagged ? 'Yes' : 'No'} />
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[var(--ink)] rounded-xl py-3">
      <div className="font-mono text-lg text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--mist)]">{label}</div>
    </div>
  );
}

function CaseSummaryPanel() {
  const [reportId, setReportId] = useState('RPT-0001');
  const [accountId, setAccountId] = useState('ACC-1002');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    if (!reportId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCaseSummary(reportId, accountId || undefined);
      setSummary(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel eyebrow="Officer Copilot" title="Generate a case summary">
      <p className="text-sm text-[var(--mist)] mb-3">
        Look up a report submitted via the Citizen Portal (e.g. <code className="font-mono">RPT-0001</code>) —
        the copilot pulls in linked fraud-graph data automatically.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm font-mono flex-1"
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
          placeholder="RPT-0001"
        />
        <input
          className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm font-mono flex-1"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="Linked account (optional)"
        />
        <button
          onClick={run}
          disabled={loading}
          className="bg-[var(--saffron)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? '…' : 'Summarize'}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--alert)]">{error}</p>}
      {summary && (
        <div className="text-sm text-[var(--mist)] space-y-2">
          <div className="inline-block font-display text-xs uppercase font-semibold px-3 py-1 rounded-full border border-[var(--saffron)] text-[var(--saffron)]">
            Priority: {summary.priority}
          </div>
          <p className="whitespace-pre-line text-white/90">{summary.summary}</p>
          <ul className="list-disc list-inside">
            {summary.suggested_next_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const TABS = [
  { key: 'incidents', label: 'Incident dashboard' },
  { key: 'jurisdiction', label: 'Jurisdiction & Zones' },
  { key: 'tools', label: 'Investigation tools' },
];

export default function OfficerCommandCenter() {
  const [tab, setTab] = useState('incidents');

  return (
    <div className="min-h-full bg-[var(--ink)] px-4 py-8">
      <div className={`${tab === 'incidents' || tab === 'jurisdiction' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto space-y-6`}>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--saffron)] mb-2">
            Officer Command Center
          </p>
          <h1 className="font-display text-3xl font-semibold text-white leading-tight">
            One console, every signal.
          </h1>
          <p className="text-[var(--mist)] mt-1">
            {tab === 'incidents'
              ? 'Where incidents are piling up, what is escalating, and which desks are stretched.'
              : tab === 'jurisdiction'
              ? 'Operational zone boundaries, service areas, automated dispatch routing, and multi-officer change review.'
              : 'Fraud-ring tracing and AI-drafted case summaries from a single account or report ID.'}
          </p>
        </div>
        <div role="tablist" className="inline-flex gap-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-full p-1 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full font-semibold transition-colors ${
                tab === t.key ? 'bg-[var(--saffron)] text-white' : 'text-[var(--mist)] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'incidents' ? (
          <IncidentDashboardView />
        ) : tab === 'jurisdiction' ? (
          <JurisdictionConfigView />
        ) : (
          <>
            <GraphPanel />
            <CaseSummaryPanel />
          </>
        )}
      </div>
    </div>
  );
}
