import { useState } from 'react';
import FraudGraphView from './FraudGraphView';
import IncidentDashboardView from './IncidentDashboardView';
import JurisdictionConfigView from './jurisdiction/JurisdictionConfigView';
import EvidenceGroundedCopilotView from './officer/EvidenceGroundedCopilotView';
import EvidenceVaultView from './EvidenceVaultView';
import DpdpRedactionView from './DpdpRedactionView';
import Section63AffidavitCompilerView from './evidence/Section63AffidavitCompilerView';
import CliSpoofDetectorView from './CliSpoofDetectorView';
import SyndicateTriageView from './SyndicateTriageView';
import MuleFreezeDispatchView from './MuleFreezeDispatchView';
import TakedownNoticeGeneratorView from './TakedownNoticeGeneratorView';

import {
  lookupFraudRing,
  getCaseSummary,
  submitFraudGraphReview,
  getFraudGraphReviewHistory,
  reverseFraudGraphReview,
  verifyFraudGraphReviewIntegrity,
  exportFraudGraphReviews,
} from '../api';
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

  // Analyst review state
  const [analystToken, setAnalystToken] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reviewHistory, setReviewHistory] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');

  async function run(id) {
    const target = id || accountId;

    if (!target.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await lookupFraudRing(target);

      setRing(res);
      setAccountId(target);

      // A new graph lookup resets the previously selected relationship.
      setSelectedEdgeId('');
      setReviewHistory(null);
      setIntegrity(null);
      setReviewError('');
      setReviewStatus('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function selectEdge(edgeId) {
    setSelectedEdgeId(edgeId);
    setReviewHistory(null);
    setIntegrity(null);
    setReviewError('');
    setReviewStatus('');
    setReviewReason('');
    setReversalReason('');
  }

  async function refreshReviewData(
    edgeId = selectedEdgeId,
    token = analystToken
  ) {
    const history = await getFraudGraphReviewHistory(edgeId, token);
    const audit = await verifyFraudGraphReviewIntegrity(edgeId, token);

    setReviewHistory(history);
    setIntegrity(audit);
  }

  async function loadReviewHistory() {
    if (!selectedEdgeId || !analystToken.trim()) {
      setReviewError('Select a relationship and enter your analyst token.');
      return;
    }

    setReviewLoading(true);
    setReviewError('');
    setReviewStatus('');

    try {
      await refreshReviewData();
      setReviewStatus('Review history loaded successfully.');
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setReviewLoading(false);
    }
  }

  async function submitDecision(decision) {
    if (!selectedEdgeId || !analystToken.trim()) {
      setReviewError('Select a relationship and authenticate first.');
      return;
    }

    if (!reviewReason.trim()) {
      setReviewError('A reason is mandatory for every review decision.');
      return;
    }

    setReviewLoading(true);
    setReviewError('');
    setReviewStatus('');

    try {
      const event = await submitFraudGraphReview(
        selectedEdgeId,
        {
          decision,
          reason: reviewReason.trim(),
        },
        analystToken
      );

      setReviewReason('');

      await refreshReviewData();

      setReviewStatus(
        `${decision.toUpperCase()} recorded successfully. Event: ${event.event_id}`
      );
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setReviewLoading(false);
    }
  }

  async function reverseDecision(eventId) {
    if (!reversalReason.trim()) {
      setReviewError('Enter a reason before reversing a decision.');
      return;
    }

    setReviewLoading(true);
    setReviewError('');
    setReviewStatus('');

    try {
      const event = await reverseFraudGraphReview(
        selectedEdgeId,
        eventId,
        reversalReason.trim(),
        analystToken
      );

      setReversalReason('');

      await refreshReviewData();

      setReviewStatus(
        `Reversal recorded successfully. Event: ${event.event_id}`
      );
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setReviewLoading(false);
    }
  }

  async function downloadEvaluation() {
    if (!analystToken.trim()) {
      setReviewError('Enter your analyst token before exporting.');
      return;
    }

    setReviewLoading(true);
    setReviewError('');
    setReviewStatus('');

    try {
      const result = await exportFraudGraphReviews(analystToken);

      const blob = new Blob(
        [JSON.stringify(result, null, 2)],
        { type: 'application/json' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'fraud-graph-review-evaluation.json';

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setReviewStatus(
        `Evaluation export generated with ${result.total} reviewed relationships.`
      );
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setReviewLoading(false);
    }
  }

  const reversedEventIds = new Set(
    (reviewHistory?.events || [])
      .filter((event) => event.event_type === 'reversal')
      .map((event) => event.reverses_event_id)
  );

  return (
    <Panel
      eyebrow="Fraud Graph Agent"
      title="Trace an account's fraud ring"
    >
      <div className="flex gap-2 mb-3">
        <input
          aria-label="Account ID to trace fraud ring"
          className="flex-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="ACC-1002"
        />

        <button
          onClick={() => run()}
          disabled={loading}
          aria-label={loading ? 'Tracing account fraud ring...' : 'Trace account fraud ring'}
          className="bg-[var(--saffron)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white"
        >
          {loading ? 'Loading...' : 'Trace'}
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

      {error && (
        <p className="text-sm text-[var(--alert)] mb-2">
          {error}
        </p>
      )}

      <FraudGraphView
        centerId={ring?.account_id}
        edges={ring?.edges || []}
        paths={ring?.paths || []}
        flagged={ring?.is_flagged}
        selectedEdgeId={selectedEdgeId}
        onSelectEdge={selectEdge}
        harvestedByHoneypot={ring?.harvested_by_honeypot || false}
        onSelectNode={run}
      />

      {ring && (
  <div className="space-y-4 mt-4">
    {/* Account statistics */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
      <Stat
        label="Mule probability"
        value={`${(ring.mule_probability * 100).toFixed(0)}%`}
      />

      <Stat
        label="Ring ID"
        value={ring.ring_id || '—'}
      />

      <Stat
        label="Flagged"
        value={ring.is_flagged ? 'Yes' : 'No'}
      />

      <Stat
        label="Connected"
        value={ring.connected_accounts.length}
      />
    </div>

    {/* Connected accounts */}
    <div>
      <div className="text-xs font-mono uppercase text-[var(--mist)] mb-1">
        Connected accounts
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ring.connected_accounts.map((account) => (
          <button
            key={account}
            onClick={() => run(account)}
            className="font-mono text-xs text-white bg-[var(--ink)] px-2.5 py-1 rounded-full border border-[var(--navy-line)] hover:border-[var(--saffron)]"
          >
            {account}
          </button>
        ))}
      </div>
    </div>

    {/* Shared signals */}
    {ring.shared_signals?.length > 0 && (
      <div>
        <div className="text-xs font-mono uppercase text-[var(--mist)] mb-1">
          Shared signals
        </div>

        <ul className="text-xs text-[var(--mist)] list-disc list-inside space-y-0.5">
          {ring.shared_signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}

      {/* Analyst review panel */}
      <section className="mt-6 border-t border-[var(--navy-line)] pt-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Analyst relationship review
          </h3>

          <p className="text-xs text-[var(--mist)] mt-1">
            Select a graph relationship to review its evidence and record
            an auditable decision.
          </p>
        </div>

        <div>
          <label className="block text-xs text-[var(--mist)] mb-1">
            Analyst access token
          </label>

          <input
            id="analyst-token"
            aria-label="Analyst access token"
            type="password"
            autoComplete="off"
            value={analystToken}
            onChange={(e) => setAnalystToken(e.target.value)}
            placeholder="Enter server-configured analyst token"
            className="w-full rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
          />

          <p className="text-[10px] text-[var(--mist)] mt-1">
            Held in component memory only. Never stored in browser storage.
          </p>
        </div>

        <div className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] p-3">
          <p className="text-xs text-[var(--mist)]">
            Selected relationship
          </p>

          <p className="text-sm text-white font-mono mt-1">
            {selectedEdgeId || 'No relationship selected'}
          </p>

          <button
            type="button"
            onClick={loadReviewHistory}
            disabled={
              !selectedEdgeId ||
              !analystToken.trim() ||
              reviewLoading
            }
            className="mt-3 text-xs rounded-lg px-3 py-2 border border-[var(--navy-line)] text-white disabled:opacity-40"
          >
            {reviewLoading ? 'Loading...' : 'Load review history'}
          </button>
        </div>

        <div>
          <label className="block text-xs text-[var(--mist)] mb-1">
            Review reason (mandatory)
          </label>

          <textarea
            rows={3}
            maxLength={2000}
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder="Explain the evidence supporting your decision..."
            className="w-full rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-3 text-sm"
          />

          <div className="flex flex-wrap gap-2 mt-3">
            {['confirm', 'dispute', 'reject'].map((decision) => (
              <button
                key={decision}
                type="button"
                onClick={() => submitDecision(decision)}
                disabled={
                  !selectedEdgeId ||
                  !analystToken.trim() ||
                  !reviewReason.trim() ||
                  reviewLoading
                }
                className="rounded-full px-4 py-2 text-xs font-semibold border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] disabled:opacity-40"
              >
                {decision.charAt(0).toUpperCase() + decision.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {reviewError && (
          <p role="alert" className="text-sm text-[var(--alert)]">
            {reviewError}
          </p>
        )}

        {reviewStatus && (
          <p role="status" className="text-sm text-emerald-400">
            {reviewStatus}
          </p>
        )}

        {integrity && (
          <div className="rounded-lg border border-[var(--navy-line)] p-3">
            <p className="text-xs text-[var(--mist)]">
              Review audit integrity
            </p>

            <p className="text-sm text-white mt-1">
              {integrity.verified
                ? 'Hash chain verified'
                : 'Integrity verification failed'}
            </p>

            <p className="text-xs text-[var(--mist)] mt-1">
              Events checked: {integrity.event_count}
            </p>

            {!integrity.verified && integrity.broken_event_id && (
              <p className="text-xs text-[var(--alert)] mt-1">
                Problem detected at {integrity.broken_event_id}
              </p>
            )}
          </div>
        )}

        {reviewHistory && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-white">
                Review history
              </h4>

              <p className="text-xs text-[var(--mist)] mt-1">
                Current decision:{' '}
                {reviewHistory.current_decision?.toUpperCase() || 'None'}
              </p>
            </div>

            {reviewHistory.events.length === 0 ? (
              <p className="text-xs text-[var(--mist)]">
                No review events have been recorded for this relationship.
              </p>
            ) : (
              reviewHistory.events
                .slice()
                .reverse()
                .map((event) => {
                  const canReverse =
                    event.event_type === 'decision' &&
                    !reversedEventIds.has(event.event_id);

                  return (
                    <article
                      key={event.event_id}
                      className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] p-3 space-y-2"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-sm font-semibold text-white">
                          {event.event_type === 'reversal'
                            ? 'REVERSAL'
                            : event.decision?.toUpperCase()}
                        </span>

                        <span className="text-xs text-[var(--mist)]">
                          {event.event_id}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--mist)]">
                        Analyst: {event.analyst_id}
                      </p>

                      <p className="text-xs text-[var(--mist)]">
                        {new Date(event.created_at).toLocaleString()}
                      </p>

                      <p className="text-sm text-white break-words">
                        {event.reason}
                      </p>

                      {event.event_type === 'reversal' && (
                        <p className="text-xs text-amber-300">
                          Reverses event: {event.reverses_event_id}
                        </p>
                      )}

                      {canReverse && (
                        <button
                          type="button"
                          onClick={() => reverseDecision(event.event_id)}
                          disabled={
                            !analystToken.trim() || reviewLoading
                          }
                          className="text-xs rounded-lg px-3 py-2 border border-[var(--navy-line)] text-white hover:border-[var(--alert)] disabled:opacity-40"
                        >
                          Reverse this decision
                        </button>
                      )}
                    </article>
                  );
                })
            )}

            {reviewHistory.events.some(
              (event) =>
                event.event_type === 'decision' &&
                !reversedEventIds.has(event.event_id)
            ) && (
              <div>
                <label className="block text-xs text-[var(--mist)] mb-1">
                  Reversal reason (mandatory)
                </label>

                <textarea
                  rows={2}
                  maxLength={2000}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why the previous decision needs reversal..."
                  className="w-full rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-3 text-sm"
                />
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={downloadEvaluation}
          disabled={!analystToken.trim() || reviewLoading}
          className="w-full rounded-lg border border-[var(--navy-line)] px-4 py-3 text-sm text-white hover:border-[var(--saffron)] disabled:opacity-40"
        >
          Export reviewed evaluation data (JSON)
        </button>

        <p className="text-[10px] text-[var(--mist)]">
          Exported records are for offline evaluation. They do not
          automatically update or retrain the fraud model.
        </p>
      </section>
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
          aria-label="Report ID to summarize"
          className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm font-mono flex-1 focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
          placeholder="RPT-0001"
        />
        <input
          aria-label="Linked account ID (optional)"
          className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm font-mono flex-1 focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="Linked account (optional)"
        />
        <button
          onClick={run}
          disabled={loading}
          aria-label={loading ? 'Generating case summary...' : 'Generate case summary'}
          className="bg-[var(--saffron)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white"
        >
          {loading ? 'Summarizing...' : 'Summarize'}
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
  { key: 'takedown', label: 'Domain Abuse Takedown' },
  { key: 'freeze', label: 'UPI Mule Freeze (1930)' },
  { key: 'jurisdiction', label: 'Jurisdiction & Zones' },
  { key: 'copilot', label: 'Officer Copilot (Grounded)' },
  { key: 'cli-spoof', label: 'CLI Spoof & Telecom Triage' },
  { key: 'evidence', label: 'Evidence Vault' },
  { key: 'dpdp', label: 'DPDP Redaction & Masking' },
  { key: 'affidavit', label: 'Section 63 BSA Compiler' },
  { key: 'syndicate', label: 'Syndicate & APK Triage' },
  { key: 'hotline', label: 'Voice Safety Hotline' },
  { key: 'tools', label: 'Investigation tools' },
];

export default function OfficerCommandCenter() {
  const [tab, setTab] = useState('incidents');

  return (
    <div className="min-h-full bg-[var(--ink)] w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 w-full text-white">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)] mb-2">
            Officer Command Center
          </p>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            One console, every signal.
          </h1>
          <p className="text-sm text-[var(--mist)] mt-1 max-w-2xl leading-relaxed">
            {tab === 'incidents'
  ? 'Where incidents are piling up, what is escalating, and which desks are stretched.'
  : tab === 'takedown'
  ? 'Automated WHOIS/DNS query, certified CERT-In takedown notice generation, and domain offline watchdog monitoring.'
  : tab === 'freeze'
  ? 'Automated Section 102 CrPC provisional debit freeze dispatch to bank nodal desks and CFCFRMS priority stop protocol.'
  : tab === 'jurisdiction'
  ? 'Operational zone boundaries, service areas, automated dispatch routing, and multi-officer change review.'
  : tab === 'copilot'
  ? 'Evidence-grounded investigative next steps with 4-tier separation, source citations, and human approval guardrails.'
  : tab === 'cli-spoof'
  ? 'Calling Line Identification (CLI) spoof detection, TRAI circle cross-referencing, and rogue GSM SIM Box ingress triage.'
  : tab === 'evidence'
  ? 'Immutable chain of custody, Section 65B forensic bundles, and legal hold verification.'
  : tab === 'affidavit'
  ? 'Sealed court-ready Section 63 BSA / 65B IEA certificates with Stratum 1 NTP records and dual-officer legal declarations.'
  : tab === 'syndicate'
  ? 'Extract WhatsApp/Telegram syndicate recruitment groups, admin numbers, crypto wallets, and APK sandbox triage.'
  : tab === 'hotline'
  ? 'Automated Interactive Voice Response (IVR) state machine and deflection gateway in 8 Indic languages with 1930 SMS dispatch.'
  : 'Fraud-ring tracing and AI-drafted case summaries from a single account or report ID.'}
          </p>
        </div>
        <div className="overflow-x-auto max-w-full pb-1 scrollbar-none">
          <div
            role="tablist"
            aria-label="Officer Workspace Sections"
            className="inline-flex min-w-max gap-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-full p-1 text-sm"
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-full font-semibold transition-colors min-h-[40px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white ${
                  tab === t.key
                    ? 'bg-[var(--saffron)] text-white'
                    : 'text-[var(--mist)] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'incidents' ? (
  <IncidentDashboardView />
) : tab === 'takedown' ? (
  <TakedownNoticeGeneratorView />
) : tab === 'freeze' ? (
  <MuleFreezeDispatchView />
) : tab === 'jurisdiction' ? (
  <JurisdictionConfigView />
) : tab === 'copilot' ? (
  <EvidenceGroundedCopilotView />
) : tab === 'cli-spoof' ? (
  <CliSpoofDetectorView />
) : tab === 'evidence' ? (
  <EvidenceVaultView />
) : tab === 'dpdp' ? (
  <DpdpRedactionView />
) : tab === 'affidavit' ? (
  <Section63AffidavitCompilerView />
) : tab === 'syndicate' ? (
  <SyndicateTriageView />
) : tab === 'hotline' ? (
  <VoiceSafetyHotlineView />
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
