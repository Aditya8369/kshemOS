import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  ShieldAlert,
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

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-[var(--navy-line)] text-sm">
      <span className="text-[var(--mist)]">{label}</span>
      <span className="text-white text-right">{children}</span>
    </div>
  );
}

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
      await onUpdate(incident.id, { notes: noteText.trim() }, incident);
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
    <div className="mt-4 p-3.5 bg-[var(--ink)]/90 border border-[var(--navy-line)] rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] flex items-center gap-1.5">
          <Zap size={13} />
          <span>Field Responder Quick Mode</span>
        </div>
        <span className="text-[10px] text-[var(--mist)] font-mono">Mobile One-Tap</span>
      </div>

      {/* Quick Action Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {QUICK_ACTIONS.map(({ status, label, icon }) => {
          const isCurrent = incident.status === status;
          return (
            <button
              key={status}
              onClick={() => handleQuickStatus(status)}
              disabled={saving || isCurrent}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center flex items-center justify-center gap-1 ${
                isCurrent
                  ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold cursor-default'
                  : 'border-[var(--navy-line)] text-white hover:border-[var(--saffron)] hover:bg-[var(--navy)] disabled:opacity-40'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Field Note Input */}
      <form onSubmit={handleAddNote} className="flex gap-2 pt-1">
        <input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add on-site field note (offline cached)…"
          className="flex-1 bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-[var(--mist)]/70 focus:outline-none focus:border-[var(--saffron)]"
        />
        <button
          type="submit"
          disabled={saving || !noteText.trim()}
          className="px-3 py-1.5 bg-[var(--saffron)] text-[var(--ink)] font-semibold text-xs rounded-xl hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-1"
        >
          <Send size={11} />
          <span>Log</span>
        </button>
      </form>
    </div>
  );
}

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

  const field = 'rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-sm';
  const secondaryButton =
    'rounded-full px-3 py-2 text-xs font-semibold border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] disabled:opacity-40';

  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)]">Desk actions</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[var(--mist)] space-y-1">
          <span>Status</span>
          <select
            className={`${field} w-full`}
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
            className={`${field} w-full capitalize`}
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
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ assigned_to: assignee });
        }}
      >
        <input
          className={`${field} flex-1 min-w-0 font-mono`}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Officer code, e.g. OFF-W1"
          aria-label="Assign to officer"
        />
        <button type="submit" disabled={saving} className={secondaryButton}>
          {incident.assigned_to && !assignee.trim() ? 'Unassign' : 'Assign'}
        </button>
      </form>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ linked_account: account });
        }}
      >
        <input
          className={`${field} flex-1 min-w-0 font-mono`}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="Linked account, e.g. ACC-1002"
          aria-label="Linked account"
        />
        <button type="submit" disabled={saving} className={secondaryButton}>
          Link
        </button>
      </form>
      {error && <p className="text-sm text-[var(--alert)]">{error}</p>}
    </div>
  );
}

export default function IncidentDetail({ incident, now, onClose, onUpdate, onOpenConflict }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ring, setRing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRing(null);
    if (incident.linked_account) {
      lookupFraudRing(incident.linked_account).then((r) => !cancelled && setRing(r));
    }
    return () => {
      cancelled = true;
    };
  }, [incident.linked_account]);

  async function summarize() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getCaseSummary(incident.id, incident.linked_account));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const reasons = escalationReasons(incident, now);
  const target = RESPONSE_TARGET_MINUTES[incident.severity];
  const responseText = incident.first_response_at
    ? `${formatDuration(minutesSince(incident.opened_at, incident.first_response_at))} after opening`
    : `Awaiting (${formatDuration(minutesSince(incident.opened_at, now))} so far)`;

  const syncStatus = incident._syncStatus || 'synced';

  return (
    <div>
      {/* Header and Sync Badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <SeverityBadge severity={incident.severity} />

            {/* Offline Sync State Badge */}
            {syncStatus === 'synced' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} />
                <span>Synced to HQ</span>
              </span>
            ) : syncStatus === 'conflict' ? (
              <button
                onClick={() => onOpenConflict?.(incident)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-300 bg-rose-950/60 border border-rose-500 px-2.5 py-0.5 rounded-full hover:bg-rose-900/80 cursor-pointer"
              >
                <AlertTriangle size={11} className="text-rose-400 animate-pulse" />
                <span>Conflict (Resolve Now)</span>
              </button>
            ) : syncStatus === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-500/40 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} />
                <span>Push Failed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/50 px-2 py-0.5 rounded-full">
                <Clock size={11} />
                <span>Saved Locally · Pending Sync</span>
              </span>
            )}
          </div>

          <h3 className="font-display text-lg font-semibold text-white">{incident.title}</h3>
          <div className="text-xs font-mono text-[var(--mist)]">{incident.id}</div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-[var(--mist)] hover:text-white hover:bg-[var(--ink)]"
          aria-label="Close case detail and return to the list"
        >
          <X size={16} />
        </button>
      </div>

      {/* Conflict Warning Box */}
      {syncStatus === 'conflict' && (
        <div className="rounded-xl border border-rose-500/70 bg-rose-950/30 p-3 my-3 text-xs space-y-2">
          <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
            <AlertTriangle size={14} />
            <span>HQ Version Conflict</span>
          </div>
          <p className="text-[var(--mist)]">
            Command Center modified this case while your field unit was offline. Resolve to update HQ safely.
          </p>
          <button
            onClick={() => onOpenConflict?.(incident)}
            className="px-3 py-1 bg-rose-500 text-white font-semibold rounded-lg hover:bg-rose-600 transition-colors"
          >
            Review & Resolve Conflict
          </button>
        </div>
      )}

      {/* Escalation Reasons */}
      {reasons.length > 0 && (
        <div className="rounded-xl border border-[var(--caution)]/50 bg-[var(--caution)]/10 px-3 py-2 my-3">
          {reasons.map((r) => (
            <div key={r} className="text-xs text-[var(--caution)] flex items-center gap-1">
              <Siren size={12} aria-hidden="true" />
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Field Responder Quick Bar */}
      <FieldResponderBar incident={incident} onUpdate={onUpdate} />

      <DetailRow label="Region">{incident.region}</DetailRow>
      <DetailRow label="Status">{STATUS_LABEL[incident.status]}</DetailRow>
      <DetailRow label="Assigned to">{incident.assigned_to || 'Unassigned'}</DetailRow>
      <DetailRow label="Category">{incident.category.replace('_', ' ')}</DetailRow>
      <DetailRow label="Opened">
        {formatClock(incident.opened_at)} ({formatDuration(minutesSince(incident.opened_at, now))} ago)
      </DetailRow>
      <DetailRow label="First response">{responseText}</DetailRow>
      <DetailRow label="Response target">{formatDuration(target)}</DetailRow>
      {incident.previous_severity && <DetailRow label="Raised from">{incident.previous_severity}</DetailRow>}
      <DetailRow label="Workload weight">{SEVERITY_WEIGHT[incident.severity]} pts</DetailRow>
      {incident.report_id && <DetailRow label="Citizen report">{incident.report_id}</DetailRow>}

      {incident.description && (
        <div className="mt-4">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-1">Reported</div>
          <p className="text-sm text-white/90 whitespace-pre-line">{incident.description}</p>
        </div>
      )}

      {/* Field Notes Log */}
      {incident.notes && incident.notes.length > 0 && (
        <div className="mt-4 p-3 bg-[var(--ink)]/60 border border-[var(--navy-line)] rounded-xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)]">Field Activity Log</div>
          <div className="space-y-1.5 text-xs">
            {incident.notes.map((note, idx) => (
              <div key={idx} className="flex gap-2 text-white/90">
                <span className="text-[var(--mist)] select-none">#{idx + 1}</span>
                <span className="italic">"{note}"</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <IncidentActions incident={incident} onUpdate={onUpdate} />

      <div className="mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-2">Linked account</div>
        {incident.linked_account ? (
          ring ? (
            <div className="text-sm text-[var(--mist)] space-y-1">
              <div>
                <span className="font-mono text-white">{ring.account_id}</span> · ring{' '}
                <span className="font-mono text-white">{ring.ring_id}</span> · mule probability{' '}
                <span className="font-mono text-white">{Math.round(ring.mule_probability * 100)}%</span>
              </div>
              <div className="text-xs">Connected: {ring.connected_accounts.join(', ') || 'none'}</div>
            </div>
          ) : (
            <p className="text-sm text-[var(--mist)]">Loading fraud-graph data…</p>
          )
        ) : (
          <p className="text-sm text-[var(--mist)]">No account linked to this incident yet.</p>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={summarize}
          disabled={loading || !incident.linked_account}
          className="bg-[var(--saffron)] text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? '…' : 'Generate case summary'}
        </button>
        {!incident.linked_account && (
          <p className="text-xs text-[var(--mist)] mt-1">Case summaries need a linked account to trace.</p>
        )}
        {error && <p className="text-sm text-[var(--alert)] mt-2">{error}</p>}
        {summary && (
          <div className="text-sm text-[var(--mist)] space-y-2 mt-3">
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
      </div>
    </div>
  );
}
