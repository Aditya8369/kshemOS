import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Layers,
  Radio,
  Users,
  Zap,
} from 'lucide-react';
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
import RegionalThreatMeshView from './RegionalThreatMeshView';
import TakedownNoticeGeneratorView from './TakedownNoticeGeneratorView';
import FieldSeizureCompanionView from './evidence/FieldSeizureCompanionView';
import VoiceDeepfakeDetectorView from './VoiceDeepfakeDetectorView';

import {
  lookupFraudRing,
  getCaseSummary,
  submitFraudGraphReview,
  getFraudGraphReviewHistory,
  reverseFraudGraphReview,
  verifyFraudGraphReviewIntegrity,
  exportFraudGraphReviews,
} from '../api';

/**
 * Standardized panel component conforming to layoutStyles.js tokens.
 * Fulfills Criterion 3: Standardise section headings, spacing, and panel styles.
 */
function Panel({ eyebrow, title, badge, children }) {
  return (
    <div className={CARD_SURFACES.officerPanel}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[var(--navy-line)] pb-3">
        <div>
          <div className={HEADER_TYPOGRAPHY.eyebrowOfficer}>{eyebrow}</div>
          <h2 className={HEADER_TYPOGRAPHY.titleOfficer}>{title}</h2>
        </div>
        {badge && (
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded bg-[var(--ink)] border border-[var(--navy-line)] text-[var(--saffron)] font-semibold tracking-wider">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl py-3 px-2 text-center shadow-xs">
      <div className="font-mono text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wide text-[var(--mist)] mt-0.5">{label}</div>
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
      badge="Multi-Hop Forensic Traversal"
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
          className="bg-[var(--saffron)] text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40 min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white transition-opacity shadow-sm"
        >
          {loading ? 'Loading...' : 'Trace Ring'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs text-[var(--mist)]">
        <span>Try sample mules:</span>
        {SAMPLE_ACCOUNTS.map((acc) => (
          <button
            key={acc}
            onClick={() => run(acc)}
            className="font-mono text-white/90 hover:text-white bg-[var(--ink)] px-2.5 py-1 rounded-lg border border-[var(--navy-line)] hover:border-[var(--saffron)] transition-colors"
          >
            {acc}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-[var(--alert)] mb-3 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg">
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
        <div className="space-y-4 mt-5 pt-4 border-t border-[var(--navy-line)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
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

          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-1.5">
              Connected accounts
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ring.connected_accounts.map((account) => (
                <button
                  key={account}
                  onClick={() => run(account)}
                  className="font-mono text-xs text-white bg-[var(--ink)] px-2.5 py-1 rounded-full border border-[var(--navy-line)] hover:border-[var(--saffron)] transition-colors"
                >
                  {account}
                </button>
              ))}
            </div>
          </div>

          {ring.shared_signals?.length > 0 && (
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-1.5">
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
          <h3 className="text-base font-semibold text-white">
            Analyst relationship review
          </h3>
          <p className="text-xs text-[var(--mist)] mt-1">
            Select a graph relationship to review its evidence and record an auditable decision.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--mist)] mb-1.5">
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
            className="w-full rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
          />
          <p className="text-[10px] text-[var(--mist)] mt-1">
            Held in component memory only. Never stored in browser storage.
          </p>
        </div>

        <div className="rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] p-3.5 space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--mist)]">
            Selected relationship
          </p>
          <p className="text-sm text-white font-mono">
            {selectedEdgeId || 'No relationship selected (click an edge on the graph above)'}
          </p>
          <button
            type="button"
            onClick={loadReviewHistory}
            disabled={!selectedEdgeId || !analystToken.trim() || reviewLoading}
            className="text-xs rounded-lg px-3 py-2 border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] disabled:opacity-40 transition-colors"
          >
            {reviewLoading ? 'Loading…' : 'Load review history'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--mist)] mb-1.5">
            Review reason (mandatory)
          </label>
          <textarea
            rows={3}
            maxLength={2000}
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder="Explain the evidence supporting your decision..."
            className="w-full rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
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
                className="rounded-full px-4 py-2 text-xs font-semibold border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] disabled:opacity-40 transition-colors min-h-[36px]"
              >
                {decision.charAt(0).toUpperCase() + decision.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {reviewError && (
          <p role="alert" className="text-sm text-[var(--alert)] bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg">
            {reviewError}
          </p>
        )}

        {reviewStatus && (
          <p role="status" className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg">
            {reviewStatus}
          </p>
        )}

        {integrity && (
          <div className="rounded-xl border border-[var(--navy-line)] bg-[var(--ink)] p-3.5 space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--mist)]">
              Review audit integrity
            </p>
            <p className="text-sm font-semibold text-white">
              {integrity.verified
                ? 'Hash chain verified'
                : 'Integrity verification failed'}
            </p>
            <p className="text-xs text-[var(--mist)]">
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
              <p className="text-xs text-[var(--mist)] mt-0.5">
                Current decision: {reviewHistory.current_decision?.toUpperCase() || 'None'}
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
                        <span className="text-xs font-mono text-[var(--mist)]">
                          {event.event_id}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--mist)]">
                        Analyst: {event.analyst_id} · {new Date(event.created_at).toLocaleString()}
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
                          disabled={!analystToken.trim() || reviewLoading}
                          className="text-xs rounded-lg px-3 py-2 border border-[var(--navy-line)] text-white hover:border-[var(--alert)] disabled:opacity-40 transition-colors"
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
                <label className="block text-xs font-medium text-[var(--mist)] mb-1">
                  Reversal reason (mandatory)
                </label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why the previous decision needs reversal..."
                  className="w-full rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                />
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={downloadEvaluation}
          disabled={!analystToken.trim() || reviewLoading}
          className="w-full rounded-xl border border-[var(--navy-line)] px-4 py-3 text-sm font-semibold text-white hover:border-[var(--saffron)] disabled:opacity-40 transition-colors"
        >
          Export reviewed evaluation data (JSON)
        </button>

        <p className="text-[10px] text-[var(--mist)]">
          Exported records are for offline evaluation. They do not automatically update or retrain the fraud model.
        </p>
      </section>
    </Panel>
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
    <Panel
      eyebrow="Officer Copilot"
      title="Generate a case summary"
      badge="Citizen Report Ingestion"
    >
      <p className="text-sm text-[var(--mist)] mb-3">
        Look up a report submitted via the Citizen Portal (e.g. <code className="font-mono text-white">RPT-0001</code>) —
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
          className="bg-[var(--saffron)] text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40 min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white transition-opacity shadow-sm"
        >
          {loading ? 'Summarizing...' : 'Summarize'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--alert)] mb-3 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg">
          {error}
        </p>
      )}

      {summary && (
        <div className="text-sm text-[var(--mist)] space-y-3 pt-3 border-t border-[var(--navy-line)]">
          <div className="inline-block font-display text-xs uppercase font-semibold px-3 py-1 rounded-full border border-[var(--saffron)] text-[var(--saffron)] bg-amber-500/10">
            Priority: {summary.priority}
          </div>
          <p className="whitespace-pre-line text-white/90 leading-relaxed">{summary.summary}</p>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-1">
              Suggested investigative next steps:
            </div>
            <ul className="list-disc list-inside space-y-1 text-white/80">
              {summary.suggested_next_steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  );
}

const TABS = [
  { key: 'incidents', label: 'Incident dashboard' },
  { key: 'threat-mesh', label: 'Regional Threat Mesh' },
  { key: 'takedown', label: 'Domain Abuse Takedown' },
  { key: 'field-seizure', label: 'Field Device Seizure' },
  { key: 'voice-deepfake', label: 'Voice Deepfake Detector' },
  { key: 'freeze', label: 'UPI Mule Freeze (1930)' },
  { key: 'jurisdiction', label: 'Jurisdiction & Zones' },
  { key: 'copilot', label: 'Officer Copilot (Grounded)' },
  { key: 'cli-spoof', label: 'CLI Spoof & Telecom Triage' },
  { key: 'evidence', label: 'Evidence Vault' },
  { key: 'dpdp', label: 'DPDP Redaction & Masking' },
  { key: 'affidavit', label: 'Section 63 BSA Compiler' },
  { key: 'syndicate', label: 'Syndicate & APK Triage' },
  { key: 'stage-inspector', label: 'Video Call Stage Inspector' },
  { key: 'tools', label: 'Investigation tools' },
];

export default function OfficerCommandCenter() {
  const [tab, setTab] = useState('incidents');
  const [activeSection, setActiveSection] = useState('all');

  // Live telemetry for high-priority operational ticker
  const { feed, now } = useIncidentFeed();
  const incidents = useMemo(() => feed?.incidents ?? [], [feed]);
  const staffing = useMemo(() => feed?.staffing ?? [], [feed]);
  const snapshot = useMemo(
    () => getDashboardSnapshot(incidents, staffing, now),
    [incidents, staffing, now]
  );
  const headline = snapshot?.headline || {
    active: 0,
    critical: 0,
    escalating: 0,
    unassigned: 0,
    officers_on_duty: 0,
    regions_over_capacity: 0,
  };

  // Filter tabs by active section
  const visibleTabs = useMemo(() => {
    return getVisibleTabs(activeSection);
  }, [activeSection]);

  const currentTabMeta = useMemo(() => {
    return getTabMeta(tab);
  }, [tab]);

  function handleSelectSection(secId) {
    setActiveSection(secId);
    const sec = WORKSPACE_SECTIONS.find((s) => s.id === secId);
    if (sec && sec.tabs && !sec.tabs.includes(tab)) {
      setTab(sec.tabs[0]);
    }
  }

  function handleSelectTab(tabKey) {
    setTab(tabKey);
    const tabMeta = TABS.find((t) => t.key === tabKey);
    if (tabMeta && activeSection !== 'all' && tabMeta.sectionId !== activeSection) {
      setActiveSection('all');
    }
  }

  return (
    <div className="min-h-full bg-[var(--ink)] w-full overflow-x-hidden">
      <div className={CONTAINER_VARIANTS.officer}>
        
        {/* Command Center Title & Context Header */}
        <div className="border-b border-[var(--navy-line)] pb-5">
          <p className={HEADER_TYPOGRAPHY.eyebrowOfficer}>
            Officer Command Center
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <h1 className={HEADER_TYPOGRAPHY.titleOfficer}>
              One console, every signal.
            </h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                HQ Synced Feed
              </span>
            </div>
          </div>
          <p className={HEADER_TYPOGRAPHY.descriptionOfficer + ' mt-1'}>
            {tab === 'incidents'
  ? 'Where incidents are piling up, what is escalating, and which desks are stretched.'
  : tab === 'threat-mesh'
  ? 'Privacy-preserving spatial clustering, automated localized micro-advisory drafts, and commander sign-off.'
  : tab === 'takedown'
  ? 'Automated WHOIS/DNS query, certified CERT-In takedown notice generation, and domain offline watchdog monitoring.'
  : tab === 'field-seizure'
  ? 'Offline-first PWA for field officers: SHA-256 genesis hardware receipts, Faraday seal tracking, and central vault sync.'
  : tab === 'voice-deepfake'
  ? 'Acoustic micro-tremor analysis (jitter/shimmer), neural vocoder phase smearing, and explainable deepfake confidence scoring.'
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
  : tab === 'stage-inspector'
  ? 'Computer vision inspection of suspicious video call stages, virtual chroma fringing, perspective logo warps, and uniform insignia.'
  : 'Fraud-ring tracing and AI-drafted case summaries from a single account or report ID.'}
          </p>
        </div>

        {/* =========================================================================
            SECTION I: Operational Summary & Time-Sensitive Alert Ticker
            ========================================================================= */}
        <section
          role="region"
          aria-label="Operational Summary and Time-Sensitive Alerts"
          className="rounded-2xl border border-[var(--navy-line)] bg-gradient-to-r from-[var(--navy)] via-[#0d213b] to-[var(--ink)] p-4 sm:p-5 shadow-lg space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Time-Sensitive Badges */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Critical Priority 1 Badge */}
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 shadow-xs">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold">
                    Priority 1 · Immediate Action
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {headline.critical} Critical Case{headline.critical === 1 ? '' : 's'} Active
                  </div>
                </div>
              </div>

              {/* Escalating Incidents Badge */}
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 shadow-xs">
                <AlertTriangle size={16} className="text-[var(--caution)] shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                    Escalation SLA Alert
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {headline.escalating} Case{headline.escalating === 1 ? '' : 's'} Escalating
                  </div>
                </div>
              </div>

              {/* Workload / Staffing Capacity Status */}
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs text-[var(--mist)]">
                <Users size={15} className="text-[var(--saffron)] shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-white font-semibold">{headline.officers_on_duty}</span> Officers on Duty ·{' '}
                  <span className="text-white font-semibold">{headline.active}</span> Open Intake Cases
                </div>
              </div>
            </div>

            {/* Fast-Action High-Priority Shortcut Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectTab('freeze')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  tab === 'freeze'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30'
                }`}
                aria-label="Jump to 1930 Mule Freeze Rapid Response Desk"
              >
                <Zap size={13} aria-hidden="true" />
                1930 Fast-Freeze Desk
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('incidents')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  tab === 'incidents'
                    ? 'bg-[var(--saffron)] text-black shadow-sm'
                    : 'bg-[var(--ink)] text-[var(--cream)] border border-[var(--navy-line)] hover:text-white hover:border-[var(--saffron)]'
                }`}
                aria-label="View live incident operations feed"
              >
                <Radio size={13} aria-hidden="true" />
                Active Incident Feed
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION II: Functional Grouping & Section Category Filter
            ========================================================================= */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter command workspaces by functional section">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mr-1 flex items-center gap-1">
                <Layers size={13} className="text-[var(--saffron)]" aria-hidden="true" />
                Sections:
              </span>
              {WORKSPACE_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => handleSelectSection(sec.id)}
                  aria-pressed={activeSection === sec.id}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                    activeSection === sec.id
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[var(--navy)] text-[var(--mist)] border border-[var(--navy-line)] hover:text-white hover:border-[var(--saffron)]'
                  }`}
                >
                  {sec.shortLabel} ({sec.count})
                </button>
              ))}
            </div>

            <div className="text-xs font-mono text-[var(--mist)]">
              Showing {visibleTabs.length} of {TABS.length} workspaces
            </div>
          </div>

          {/* Standardized Tablist Navigation */}
          <div className="overflow-x-auto max-w-full pb-1 scrollbar-none">
            <div
              role="tablist"
              aria-label="Officer Workspace Sections"
              className="inline-flex min-w-max gap-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-full p-1 text-sm"
            >
              {visibleTabs.map((t) => {
                const isSelected = tab === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleSelectTab(t.key)}
                    className={`px-3.5 py-2 rounded-full font-semibold transition-colors min-h-[40px] inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-white cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--saffron)] text-white shadow-sm'
                        : 'text-[var(--mist)] hover:text-white'
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.badge && (
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-black/30 text-white'
                            : t.urgent
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-white/10 text-white/90'
                        }`}
                      >
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION III: Active Module Context Header
            ========================================================================= */}
        <div className="rounded-xl border border-[var(--navy-line)] bg-[var(--navy)]/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--saffron)] font-bold">
                {currentTabMeta.sectionName}
              </span>
              <span className="text-[10px] font-mono text-[var(--mist)]">/</span>
              <span className="text-[11px] font-mono text-white/90">
                {currentTabMeta.tag}
              </span>
            </div>
            <p className="text-xs text-[var(--mist)] mt-1 max-w-3xl leading-relaxed">
              {currentTabMeta.description}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-xs font-mono text-[var(--mist)]">
            <span className="px-2 py-1 rounded bg-[var(--ink)] border border-[var(--navy-line)]">
              TAB: {currentTabMeta.key.toUpperCase()}
            </span>
          </div>
        </div>

        {/* =========================================================================
            SECTION IV: Module Views
            ========================================================================= */}
        {tab === 'incidents' ? (
  <IncidentDashboardView />
) : tab === 'threat-mesh' ? (
  <RegionalThreatMeshView />
) : tab === 'takedown' ? (
  <TakedownNoticeGeneratorView />
) : tab === 'field-seizure' ? (
  <FieldSeizureCompanionView />
) : tab === 'voice-deepfake' ? (
  <VoiceDeepfakeDetectorView />
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
) : tab === 'stage-inspector' ? (
  <StageUniformInspectorView />
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