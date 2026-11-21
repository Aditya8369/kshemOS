
import { useEffect, useState } from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Radio,
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
import { explainActionOutcome } from '../../syncStatusMeta';

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
  const [feedback, setFeedback] = useState(null);

  async function handleQuickStatus(status) {
    if (saving || incident.status === status) return;

    setSaving(true);
    setFeedback(null);

    try {
      const res = await onUpdate(incident.id, { status }, incident);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const outcome = explainActionOutcome({
        actionName: `Status set to ${STATUS_LABEL[status] || status}`,
        syncStatus: res?._syncStatus || incident._syncStatus,
        isOnline,
        version: res?.version || incident.version,
      });
      setFeedback(outcome);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();

    if (!noteText.trim() || saving) return;

    setSaving(true);
    setFeedback(null);

    try {
      const res = await onUpdate(
        incident.id,
        { notes: noteText.trim() },
        incident
      );

      setNoteText('');
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const outcome = explainActionOutcome({
        actionName: 'Field note added',
        syncStatus: res?._syncStatus || incident._syncStatus,
        isOnline,
        version: res?.version || incident.version,
      });
      setFeedback(outcome);
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
  const [feedback, setFeedback] = useState(null);

  async function save(changes) {
    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await onUpdate(incident.id, changes, incident);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const outcome = explainActionOutcome({
        actionName: 'Incident details updated',
        syncStatus: res?._syncStatus || incident._syncStatus,
        isOnline,
        version: res?.version || incident.version,
      });
      setFeedback(outcome);
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

      {feedback && (
        <div
          role="status"
          className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
            feedback.confirmedByServer
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : feedback.conflict
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[10px] opacity-75 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

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
  onOpenOutbox,
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
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/50 px-2.5 py-1 rounded-full"
                title="Confirmed by Headquarters server"
                aria-label="HQ Confirmed: Synchronized with headquarters"
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                <span className="uppercase text-[9px] opacity-75" aria-hidden="true">[HQ]</span>
                <span>Synced to HQ</span>
              </span>
            ) : syncStatus === 'conflict' ? (
              <button
                type="button"
                onClick={() => onOpenConflict?.(incident)}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-rose-300 bg-rose-950/60 border border-rose-500 px-2.5 py-1 rounded-full hover:bg-rose-900/80 cursor-pointer"
                title="Headquarters record was modified while offline. Click to review."
                aria-label="Sync Conflict: Headquarters version differs from local field update. Review now."
              >
                <AlertTriangle
                  size={12}
                  className="text-rose-400 animate-pulse"
                  aria-hidden="true"
                />
                <span className="uppercase text-[9px]" aria-hidden="true">[CONFLICT]</span>
                <span>Conflict (Resolve Now)</span>
              </button>
            ) : syncStatus === 'failed' ? (
              <button
                type="button"
                onClick={onOpenOutbox}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-rose-300 bg-rose-950/40 border border-rose-500/40 px-2.5 py-1 rounded-full hover:bg-rose-900/40 cursor-pointer"
                title="Transmission failed. Click to open Outbox."
                aria-label="Push Failed: Click to open Outbox and retry transmission."
              >
                <AlertTriangle size={12} aria-hidden="true" />
                <span className="uppercase text-[9px]" aria-hidden="true">[FAILED]</span>
                <span>Push Failed (Retry)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenOutbox}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-500/50 px-2.5 py-1 rounded-full hover:bg-amber-900/40 cursor-pointer"
                title="Saved locally on this device only — has NOT reached Headquarters yet."
                aria-label="Saved locally on this device only; pending sync to headquarters. Click to open Outbox."
              >
                <Clock size={12} aria-hidden="true" />
                <span className="uppercase text-[9px] opacity-75" aria-hidden="true">[LOCAL]</span>
                <span>Saved Locally · Pending Sync</span>
              </button>
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

      {/* Pending Sync Notice */}
      {syncStatus === 'pending' && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/60 bg-amber-950/30 p-3.5 my-3 text-xs space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <Clock size={15} aria-hidden="true" />
              <span>Saved Locally On Device — Pending Sync</span>
            </div>
            <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-bold uppercase">
              Not at HQ
            </span>
          </div>

          <p className="text-[var(--mist)] leading-relaxed">
            Your recent updates to this case are encrypted and saved in this device's local outbox. They have <strong>not</strong> reached Headquarters or Command Center yet.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenOutbox}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/60 font-semibold rounded-lg transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Inbox size={13} aria-hidden="true" />
              <span>Review in Outbox</span>
            </button>
          </div>
        </div>
      )}

      {/* Conflict Warning */}
      {syncStatus === 'conflict' && (
        <div className="rounded-xl border border-rose-500/70 bg-rose-950/30 p-3 my-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>HQ Version Conflict</span>
            </div>
            <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40 font-bold uppercase">
              Action Required
            </span>
          </div>

          <p className="text-[var(--mist)]">
            Command Center modified this case while your field unit was offline.
            Local updates have <strong>not</strong> been merged into HQ. Resolve to update HQ safely.
          </p>

          <button
            type="button"
            onClick={() => onOpenConflict?.(incident)}
            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg transition-colors text-xs cursor-pointer shadow-sm"
          >
            Review &amp; Resolve Conflict
          </button>
        </div>
      )}

      {/* Server Confirmed Note */}
      {syncStatus === 'synced' && (
        <div className="rounded-lg bg-emerald-950/20 border border-emerald-800/40 px-3 py-1.5 text-[11px] text-emerald-400/90 flex items-center gap-1.5 font-mono">
          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Confirmed by Headquarters server · Version v{incident.version || 1} acknowledged</span>
        </div>
      )}

      {/* Repeat Syndicate Speaker Forensic Alert */}
      {incident.voiceprint_match?.is_repeat_speaker && (
        <div
          role="region"
          aria-label="Repeat syndicate speaker biometric alert"
          className="rounded-xl border border-purple-500/70 bg-purple-950/40 p-3.5 my-3 text-xs space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-purple-300 font-semibold">
              <Radio size={15} className="text-purple-400 animate-pulse" aria-hidden="true" />
              <span className="text-sm font-bold tracking-wide">Repeat Syndicate Speaker Detected</span>
            </div>
            <span className="text-[10px] font-mono bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/50 font-bold uppercase">
              {Math.round((incident.voiceprint_match.match_confidence || 0.85) * 100)}% Biometric Match
            </span>
          </div>

          <p className="text-purple-200/90 leading-relaxed">
            {incident.voiceprint_match.alert_summary || (
              <>
                Acoustic voiceprint analysis matched serial operator{' '}
                <strong className="text-white">{incident.voiceprint_match.speaker_alias}</strong>{' '}
                at {Math.round((incident.voiceprint_match.match_confidence || 0.85) * 100)}% cosine similarity.
              </>
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2 rounded-lg bg-[var(--ink)]/80 border border-purple-500/30">
              <span className="text-[var(--mist)] block text-[10px] uppercase font-sans">Voice Cluster ID:</span>
              <span className="text-purple-300 font-semibold">{incident.voiceprint_match.cluster_id || 'VOICE_CLUSTER'}</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--ink)]/80 border border-purple-500/30">
              <span className="text-[var(--mist)] block text-[10px] uppercase font-sans">Linked Past Cases:</span>
              <span className="text-purple-300 font-semibold">
                {incident.voiceprint_match.linked_cases && incident.voiceprint_match.linked_cases.length > 0
                  ? incident.voiceprint_match.linked_cases.join(', ')
                  : incident.voiceprint_match.past_cases?.map((c) => c.case_id || c).join(', ') || 'None'}
              </span>
            </div>
            {incident.voiceprint_match.linked_phones && incident.voiceprint_match.linked_phones.length > 0 && (
              <div className="p-2 rounded-lg bg-[var(--ink)]/80 border border-purple-500/30">
                <span className="text-[var(--mist)] block text-[10px] uppercase font-sans">Caller Phone Lines:</span>
                <span className="text-purple-300">{incident.voiceprint_match.linked_phones.join(', ')}</span>
              </div>
            )}
            {incident.voiceprint_match.linked_accounts && incident.voiceprint_match.linked_accounts.length > 0 && (
              <div className="p-2 rounded-lg bg-[var(--ink)]/80 border border-purple-500/30">
                <span className="text-[var(--mist)] block text-[10px] uppercase font-sans">Mule Disbursal Accounts:</span>
                <span className="text-purple-300">{incident.voiceprint_match.linked_accounts.join(', ')}</span>
              </div>
            )}
            {incident.voiceprint_match.linked_locations && incident.voiceprint_match.linked_locations.length > 0 && (
              <div className="p-2 rounded-lg bg-[var(--ink)]/80 border border-purple-500/30 sm:col-span-2">
                <span className="text-[var(--mist)] block text-[10px] uppercase font-sans">Geographic Hotspots:</span>
                <span className="text-purple-300">{incident.voiceprint_match.linked_locations.join(' · ')}</span>
              </div>
            )}
          </div>
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
