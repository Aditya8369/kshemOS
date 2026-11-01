import { useEffect, useState } from 'react';
import { Siren, X } from 'lucide-react';
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

function IncidentActions({ incident, onUpdate }) {
  const [assignee, setAssignee] = useState(incident.assigned_to || '');
  const [account, setAccount] = useState(incident.linked_account || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(changes) {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(incident.id, changes);
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
      <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)]">Officer actions</div>
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

export default function IncidentDetail({ incident, now, onClose, onUpdate }) {
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

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <SeverityBadge severity={incident.severity} />
          <h3 className="font-display text-lg font-semibold text-white mt-1">{incident.title}</h3>
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
