
import { useEffect, useState } from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Siren,
  X,
  Zap,
} from 'lucide-react';

import { getCaseSummary, lookupFraudRing } from '../../api';

import {
  RESPONSE_TARGET_MINUTES,
  SEVERITIES,
  SEVERITY_WEIGHT,
  STATUSES,
  escalationReasons,
  formatDuration,
} from '../../incidentDashboard';

import { STATUS_LABEL, minutesSince, formatClock } from './display';
import { SeverityBadge } from './ui';

// Reusable row for displaying read-only incident information.
function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-3 py-2 border-b border-[var(--navy-line)] text-sm last:border-b-0">
      <span className="text-[var(--mist)] min-w-0 break-words">
        {label}
      </span>

      <span className="text-white text-left sm:text-right min-w-0 break-words [overflow-wrap:anywhere]">
        {children}
      </span>
    </div>
  );
}

// Field responder quick actions.
function FieldResponderBar({ incident, onUpdate }) {
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleQuickStatus(status) {
    if (saving || incident.status === status) return;

    setSaving(true);

    try {
      await onUpdate(incident.id, { status }, incident);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();

    if (!noteText.trim() || saving) return;

    setSaving(true);

    try {
      await onUpdate(
        incident.id,
        { notes: noteText.trim() },
        incident
      );

      setNoteText('');
    } finally {
      setSaving(false);
    }
  }

  const QUICK_ACTIONS = [
    { status: 'triaged', label: 'En Route', icon: '⚡' },
    { status: 'in_progress', label: 'On Scene', icon: '🚀' },
    { status: 'escalated', label: 'Escalate to HQ', icon: '🚨' },
    { status: 'resolved', label: 'Resolve Case', icon: '✅' },
  ];

  return (
    <div className="mt-4 p-3.5 bg-[var(--ink)]/90 border border-[var(--navy-line)] rounded-2xl space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] flex items-center gap-1.5">
          <Zap size={13} />
          <span>Field Responder Quick Mode</span>
        </div>

        <span className="text-[10px] text-[var(--mist)] font-mono">
          Mobile One-Tap
        </span>
      </div>

      {/* Quick Action Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_ACTIONS.map(({ status, label, icon }) => {
          const isCurrent = incident.status === status;

          return (
            <button
              key={status}
              onClick={() => handleQuickStatus(status)}
              disabled={saving || isCurrent}
              className={`min-w-0 py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center flex flex-wrap items-center justify-center gap-1 ${
                isCurrent
                  ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold cursor-default'
                  : 'border-[var(--navy-line)] text-white hover:border-[var(--saffron)] hover:bg-[var(--navy)] disabled:opacity-40'
              }`}
            >
              <span>{icon}</span>
              <span className="break-words">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Field Note Input */}
      <form
        onSubmit={handleAddNote}
        className="flex flex-col sm:flex-row gap-2 pt-1"
      >
        <input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add on-site field note (offline cached)…"
          className="w-full min-w-0 flex-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[var(--mist)]/70 focus:outline-none focus:border-[var(--saffron)]"
        />

        <button
          type="submit"
          disabled={saving || !noteText.trim()}
          className="w-full sm:w-auto px-3 py-2 bg-[var(--saffron)] text-[var(--ink)] font-semibold text-xs rounded-xl hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-1"
        >
          <Send size={11} />
          <span>Log</span>
        </button>
      </form>
    </div>
  );
}

// Editable incident controls.
function IncidentActions({ incident, onUpdate }) {
  const [assignee, setAssignee] = useState(incident.assigned_to || '');
  const [account, setAccount] = useState(incident.linked_account || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(changes) {
    setSaving(true);
    setError(null);

    try {
      await onUpdate(incident.id, changes, incident);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const field =
    'w-full min-w-0 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm focus:outline-none focus:border-[var(--saffron)]';

  const secondaryButton =
    'w-full sm:w-auto rounded-full px-4 py-2 text-xs font-semibold border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] disabled:opacity-40';

  return (
    <div className="space-y-3 min-w-0">
      <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)]">
        Desk Actions
      </div>

      {/* Status and Severity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-[var(--mist)] space-y-1">
          <span>Status</span>

          <select
            className={field}
            value={incident.status}
            disabled={saving}
            onChange={(e) => save({ status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--mist)] space-y-1">
          <span>Severity</span>

          <select
            className={`${field} capitalize`}
            value={incident.severity}
            disabled={saving}
            onChange={(e) => save({ severity: e.target.value })}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Officer Assignment */}
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ assigned_to: assignee });
        }}
      >
        <input
          className={`${field} flex-1 font-mono`}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Officer code, e.g. OFF-W1"
          aria-label="Assign to officer"
        />

        <button
          type="submit"
          disabled={saving}
          className={secondaryButton}
        >
          {incident.assigned_to && !assignee.trim() ? 'Unassign' : 'Assign'}
        </button>
      </form>

      {/* Linked Account */}
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ linked_account: account });
        }}
      >
        <input
          className={`${field} flex-1 font-mono`}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="Linked account, e.g. ACC-1002"
          aria-label="Linked account"
        />

        <button
          type="submit"
          disabled={saving}
          className={secondaryButton}
        >
          Link
        </button>
      </form>

      {error && (
        <p className="text-sm text-[var(--alert)] break-words" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Main incident detail component.
export default function IncidentDetail({
  incident,
  now,
  onClose,
  onUpdate,
  onOpenConflict,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ring, setRing] = useState(null);

  // Look up fraud ring information when an account is linked.
  useEffect(() => {
    let cancelled = false;

    setRing(null);

    if (incident.linked_account) {
      lookupFraudRing(incident.linked_account).then(
        (r) => !cancelled && setRing(r)
      );
    }

    return () => {
      cancelled = true;
    };
  }, [incident.linked_account]);

  // Generate AI-assisted case summary.
  async function summarize() {
    setLoading(true);
    setError(null);

    try {
      setSummary(
        await getCaseSummary(incident.id, incident.linked_account)
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const reasons = escalationReasons(incident, now);
  const target = RESPONSE_TARGET_MINUTES[incident.severity];

  const responseText = incident.first_response_at
    ? `${formatDuration(
        minutesSince(incident.opened_at, incident.first_response_at)
      )} after opening`
    : `Awaiting (${formatDuration(
        minutesSince(incident.opened_at, now)
      )} so far)`;

  const syncStatus = incident._syncStatus || 'synced';

  return (
    <div className="min-w-0 w-full space-y-3">

      {/* Incident Header and Sync Badge */}
      <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <SeverityBadge severity={incident.severity} />

            {/* Offline Sync State Badge */}
            {syncStatus === 'synced' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/50 px-2 py-1 rounded-full">
                <CheckCircle2 size={11} />
                <span>Synced to HQ</span>
              </span>
            ) : syncStatus === 'conflict' ? (
              <button
                onClick={() => onOpenConflict?.(incident)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-300 bg-rose-950/60 border border-rose-500 px-2.5 py-1 rounded-full hover:bg-rose-900/80 cursor-pointer"
              >
                <AlertTriangle
                  size={11}
                  className="text-rose-400 animate-pulse"
                />
                <span>Conflict (Resolve Now)</span>
              </button>
            ) : syncStatus === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-500/40 px-2 py-1 rounded-full">
                <AlertTriangle size={11} />
                <span>Push Failed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/50 px-2 py-1 rounded-full">
                <Clock size={11} />
                <span>Saved Locally · Pending Sync</span>
              </span>
            )}
          </div>

          <h3 className="font-display text-lg font-semibold text-white break-words [overflow-wrap:anywhere]">
            {incident.title}
          </h3>

          <div className="text-xs font-mono text-[var(--mist)] break-all mt-1">
            {incident.id}
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-2 text-[var(--mist)] hover:text-white hover:bg-[var(--ink)]"
          aria-label="Close case detail and return to the list"
        >
          <X size={16} />
        </button>
      </div>

      {/* Conflict Warning */}
      {syncStatus === 'conflict' && (
        <div className="rounded-xl border border-rose-500/70 bg-rose-950/30 p-3 my-3 text-xs space-y-2">
          <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
            <AlertTriangle size={14} />
            <span>HQ Version Conflict</span>
          </div>

          <p className="text-[var(--mist)]">
            Command Center modified this case while your field unit was offline.
            Resolve to update HQ safely.
          </p>

          <button
            onClick={() => onOpenConflict?.(incident)}
            className="px-3 py-2 bg-rose-500 text-white font-semibold rounded-lg hover:bg-rose-600 transition-colors"
          >
            Review & Resolve Conflict
          </button>
        </div>
      )}

      {/* Escalation Reasons */}
      {reasons.length > 0 && (
        <div className="rounded-xl border border-[var(--caution)]/50 bg-[var(--caution)]/10 px-3 py-3 my-3">
          {reasons.map((r) => (
            <div
              key={r}
              className="text-xs text-[var(--caution)] flex items-start gap-2 py-1"
            >
              <Siren size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span className="break-words">{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Field Responder Quick Actions */}
      <FieldResponderBar incident={incident} onUpdate={onUpdate} />

      {/* Read-only Incident Information */}
      <div className="mt-4 space-y-3">

        {/* Incident Overview */}
        <section className="min-w-0 rounded-xl border border-[var(--navy-line)] bg-[var(--navy)]/50 p-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-2">
            Incident Overview
          </h4>

          <DetailRow label="Region">{incident.region}</DetailRow>

          <DetailRow label="Category">
            {incident.category.replace('_', ' ')}
          </DetailRow>

          {incident.report_id && (
            <DetailRow label="Citizen report">
              {incident.report_id}
            </DetailRow>
          )}
        </section>

        {/* Response and Assignment */}
        <section className="min-w-0 rounded-xl border border-[var(--navy-line)] bg-[var(--navy)]/50 p-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-2">
            Response & Assignment
          </h4>

          <DetailRow label="Status">
            {STATUS_LABEL[incident.status]}
          </DetailRow>

          <DetailRow label="Assigned to">
            {incident.assigned_to || 'Unassigned'}
          </DetailRow>

          <DetailRow label="Opened">
            {formatClock(incident.opened_at)} (
            {formatDuration(minutesSince(incident.opened_at, now))} ago)
          </DetailRow>

          <DetailRow label="First response">
            {responseText}
          </DetailRow>
        </section>

        {/* Severity and Workload */}
        <section className="min-w-0 rounded-xl border border-[var(--navy-line)] bg-[var(--navy)]/50 p-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-2">
            Severity & Workload
          </h4>

          <DetailRow label="Response target">
            {formatDuration(target)}
          </DetailRow>

          {incident.previous_severity && (
            <DetailRow label="Raised from">
              {incident.previous_severity}
            </DetailRow>
          )}

          <DetailRow label="Workload weight">
            {SEVERITY_WEIGHT[incident.severity]} pts
          </DetailRow>
        </section>
      </div>

      {/* Incident Description */}
      {incident.description && (
        <section className="min-w-0 mt-4">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-2">
            Reported
          </h4>

          <p className="text-sm text-white/90 whitespace-pre-line break-words [overflow-wrap:anywhere] leading-relaxed">
            {incident.description}
          </p>
        </section>
      )}

      {/* Field Notes Log */}
      {incident.notes && incident.notes.length > 0 && (
        <section className="min-w-0 mt-4 p-3 bg-[var(--ink)]/60 border border-[var(--navy-line)] rounded-xl space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)]">
            Field Activity Log
          </h4>

          <div className="space-y-2 text-xs">
            {incident.notes.map((note, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-white/90 min-w-0"
              >
                <span className="text-[var(--mist)] select-none shrink-0">
                  #{idx + 1}
                </span>

                <span className="italic min-w-0 break-words [overflow-wrap:anywhere]">
                  "{note}"
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Editable Case Controls */}
      <section className="mt-5 min-w-0 rounded-xl border border-[var(--saffron)]/30 bg-[var(--ink)]/50 p-3">
        <div className="mb-3">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)]">
            Editable Case Controls
          </h4>

          <p className="text-xs text-[var(--mist)] mt-1">
            Changes made here will update the incident record.
          </p>
        </div>

        <IncidentActions incident={incident} onUpdate={onUpdate} />
      </section>

      {/* Linked Account and Fraud Ring */}
      <section className="min-w-0 mt-4 rounded-xl border border-[var(--navy-line)] bg-[var(--navy)]/50 p-3">
        <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-2">
          Linked Account
        </h4>

        {incident.linked_account ? (
          ring ? (
            <div className="text-sm text-[var(--mist)] space-y-2 min-w-0">
              <div className="break-words [overflow-wrap:anywhere]">
                <span className="font-mono text-white">
                  {ring.account_id}
                </span>
                {' · '}ring{' '}
                <span className="font-mono text-white">
                  {ring.ring_id}
                </span>
                {' · '}mule probability{' '}
                <span className="font-mono text-white">
                  {Math.round(ring.mule_probability * 100)}%
                </span>
              </div>

              <div className="text-xs break-words [overflow-wrap:anywhere]">
                Connected: {ring.connected_accounts.join(', ') || 'none'}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--mist)]">
              Loading fraud-graph data…
            </p>
          )
        ) : (
          <p className="text-sm text-[var(--mist)]">
            No account linked to this incident yet.
          </p>
        )}
      </section>

      {/* Case Summary */}
      <section className="mt-4 min-w-0">
        <button
          onClick={summarize}
          disabled={loading || !incident.linked_account}
          className="w-full sm:w-auto bg-[var(--saffron)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
        >
          {loading ? 'Generating…' : 'Generate case summary'}
        </button>

        {!incident.linked_account && (
          <p className="text-xs text-[var(--mist)] mt-2">
            Case summaries need a linked account to trace.
          </p>
        )}

        {error && (
          <p className="text-sm text-[var(--alert)] mt-2 break-words" role="alert">
            {error}
          </p>
        )}

        {summary && (
          <div className="text-sm text-[var(--mist)] space-y-3 mt-3 min-w-0">
            <div className="inline-block font-display text-xs uppercase font-semibold px-3 py-1 rounded-full border border-[var(--saffron)] text-[var(--saffron)]">
              Priority: {summary.priority}
            </div>

            <p className="whitespace-pre-line break-words text-white/90 leading-relaxed">
              {summary.summary}
            </p>

            <ul className="list-disc list-inside space-y-1 break-words">
              {summary.suggested_next_steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
