import { useState } from 'react';
import FraudGraphView from './FraudGraphView';
import IncidentDashboardView from './IncidentDashboardView';
import JurisdictionConfigView from './jurisdiction/JurisdictionConfigView';
import EvidenceVaultView from './evidence/EvidenceVaultView';
import EvidenceGroundedCopilotView from './officer/EvidenceGroundedCopilotView';
import { lookupFraudRing, getCaseSummary } from '../api';
import ResponseTeamMatrix from './ResponseTeamMatrix';

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

      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs text-[var(--mist)]">
        <span>Try:</span>
        {SAMPLE_ACCOUNTS.map((acc) => (
          <button
            key={acc}
            onClick={() => run(acc)}
            className="font-mono text-white/80 hover:text-white bg-[var(--ink)] px-2 py-0.5 rounded border border-[var(--navy-line)]"
          >
            {acc}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--alert)]">{error}</p>}
      {ring && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <Stat label="Mule probability" value={`${(ring.mule_probability * 100).toFixed(0)}%`} />
            <Stat label="Ring ID" value={ring.ring_id ? `#${ring.ring_id}` : 'None'} />
            <Stat label="Flagged" value={ring.is_flagged ? 'Yes' : 'No'} />
            <Stat label="Connected" value={ring.connected_accounts.length} />
          </div>

          <div>
            <div className="text-xs font-mono uppercase text-[var(--mist)] mb-1">Connected accounts</div>
            <div className="flex flex-wrap gap-1.5">
              {ring.connected_accounts.map((a) => (
                <button
                  key={a}
                  onClick={() => run(a)}
                  className="font-mono text-xs text-white bg-[var(--ink)] px-2.5 py-1 rounded-full border border-[var(--navy-line)] hover:border-[var(--saffron)]"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {ring.shared_signals && ring.shared_signals.length > 0 && (
            <div>
              <div className="text-xs font-mono uppercase text-[var(--mist)] mb-1">Shared signals</div>
              <ul className="text-xs text-[var(--mist)] list-disc list-inside space-y-0.5">
                {ring.shared_signals.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <FraudGraphView focusedAccount={accountId} />
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
    <Panel eyebrow="Officer Copilot (Legacy Summary)" title="Generate a case summary">
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
  { key: 'copilot', label: 'Officer Copilot (Grounded)' },
  { key: 'evidence', label: 'Evidence Vault' },
  { key: 'tools', label: 'Investigation tools' },
];

export default function OfficerCommandCenter() {
  const [tab, setTab] = useState('incidents');

  return (
    <div className="min-h-full bg-[var(--ink)] px-4 py-8">
      <div className={`${tab === 'incidents' || tab === 'jurisdiction' || tab === 'evidence' || tab === 'copilot' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto space-y-6`}>
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
              : tab === 'copilot'
              ? 'Evidence-grounded investigative next steps with 4-tier separation, source citations, and human approval guardrails.'
              : tab === 'evidence'
              ? 'Immutable chain of custody, Section 65B forensic bundles, and legal hold verification.'
              : 'Fraud-ring tracing and AI-drafted case summaries from a single account or report ID.'}
          </p>
        </div>
        <div
          role="tablist"
          className="inline-flex flex-wrap gap-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-full p-1 text-sm"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-[var(--saffron)] text-white'
                  : 'text-[var(--mist)] hover:text-white'
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
        ) : tab === 'copilot' ? (
          <EvidenceGroundedCopilotView />
        ) : tab === 'evidence' ? (
          <EvidenceVaultView />
        ) : (
          <div className="space-y-6">
            <EvidenceGroundedCopilotView />
            <GraphPanel />
            <CaseSummaryPanel />
          </div>
        )}
      </div>
    </div>
  );
}
