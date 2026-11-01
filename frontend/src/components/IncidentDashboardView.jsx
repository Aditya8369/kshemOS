import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleCheck,
  Clock,
  Gauge,
  Inbox,
  Minus,
  Plus,
  Radio,
  Siren,
  TrendingUp,
  TriangleAlert,
  UserX,
  WifiOff,
  X,
} from 'lucide-react';
import {
  INCIDENTS_CHANGED_EVENT,
  fetchIncidentFeed,
  getCaseSummary,
  lookupFraudRing,
  setRegionStaffing,
  updateIncident,
} from '../api';
import {
  CASE_CAPACITY_PER_OFFICER,
  RESPONSE_TARGET_MINUTES,
  SEVERITIES,
  SEVERITY_WEIGHT,
  STATUSES,
  escalationReasons,
  filterIncidents,
  formatDuration,
  getDashboardSnapshot,
} from '../incidentDashboard';

// Single-hue ordinal ramp, validated for monotone lightness and >= 3:1 contrast on --navy.
const SEVERITY_COLOR = { low: '#bf5546', medium: '#da6d5d', high: '#f68675', critical: '#ffa390' };

const COVERAGE_STYLE = {
  overloaded: { label: 'Over capacity', color: 'var(--alert)', Icon: TriangleAlert },
  stretched: { label: 'Stretched', color: 'var(--caution)', Icon: Gauge },
  covered: { label: 'Covered', color: 'var(--safe)', Icon: CircleCheck },
};

const STATUS_LABEL = {
  new: 'New',
  triaged: 'Triaged',
  in_progress: 'In progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
};

// How often to re-fetch the feed. Changes in other tabs of this browser arrive instantly.
const POLL_MS = 5 * 1000;
const MINUTE = 60 * 1000;

function minutesSince(t, now) {
  return Math.max(0, Math.floor((now - t) / MINUTE));
}

function formatClock(t) {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPercent(ratio) {
  return Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : 'No cover';
}

function Panel({ eyebrow, title, action, children }) {
  return (
    <section className="min-w-0 bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-1">{eyebrow}</div>
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SeverityBadge({ severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-white/90">
      <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLOR[severity] }} />
      {severity}
    </span>
  );
}

function CoverageBadge({ status }) {
  const { label, color, Icon } = COVERAGE_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

function StatTile({ label, value, hint, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-[var(--navy)] border rounded-2xl px-4 py-3 transition-colors ${
        active ? 'border-[var(--saffron)]' : 'border-[var(--navy-line)]'
      } ${onClick ? 'hover:border-[var(--saffron)] cursor-pointer' : ''}`}
    >
      <div className="font-display text-3xl font-semibold text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--mist)]">{label}</div>
      {hint && <div className="text-[11px] text-[var(--mist)]/70 mt-1">{hint}</div>}
    </Tag>
  );
}

function SeverityRegionTable({ breakdown, filters, onSelect }) {
  const regions = Object.keys(breakdown.rows);
  const cellClass = (selected) =>
    `w-full rounded-md py-1.5 font-mono text-sm transition-colors ${
      selected ? 'bg-[var(--saffron)] text-white' : 'hover:bg-[var(--ink)] text-white/90'
    }`;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-separate border-spacing-1 min-w-[420px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--mist)]">
            <th className="text-left font-normal px-1">Region</th>
            {SEVERITIES.map((s) => (
              <th key={s} className="font-normal">
                <SeverityBadge severity={s} />
              </th>
            ))}
            <th className="font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((region) => {
            const row = breakdown.rows[region];
            return (
              <tr key={region}>
                <th scope="row" className="text-left font-normal text-white/90 px-1 whitespace-nowrap">
                  {region}
                </th>
                {SEVERITIES.map((severity) => (
                  <td key={severity} className="text-center">
                    {row[severity] > 0 ? (
                      <button
                        className={cellClass(filters.region === region && filters.severity === severity)}
                        onClick={() => onSelect({ region, severity })}
                        aria-label={`${row[severity]} ${severity} incidents in ${region}`}
                      >
                        {row[severity]}
                      </button>
                    ) : (
                      <span className="font-mono text-sm text-[var(--mist)]/40">·</span>
                    )}
                  </td>
                ))}
                <td className="text-center">
                  <button
                    className={cellClass(filters.region === region && !filters.severity)}
                    onClick={() => onSelect({ region, severity: null })}
                    aria-label={`All ${row.total} active incidents in ${region}`}
                  >
                    <span className="font-semibold">{row.total}</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-[var(--mist)]">
            <th scope="row" className="text-left font-normal px-1 pt-1 border-t border-[var(--navy-line)]">
              All regions
            </th>
            {SEVERITIES.map((s) => (
              <td key={s} className="text-center font-mono pt-1 border-t border-[var(--navy-line)]">
                {breakdown.totals[s]}
              </td>
            ))}
            <td className="text-center font-mono font-semibold text-white pt-1 border-t border-[var(--navy-line)]">
              {breakdown.totals.total}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EscalationList({ escalations, now, selectedId, onSelect }) {
  if (escalations.length === 0) {
    return <p className="text-sm text-[var(--mist)]">No incidents are escalating right now.</p>;
  }
  return (
    <ul className="space-y-2">
      {escalations.map(({ incident, reasons }) => (
        <li key={incident.id}>
          <button
            onClick={() => onSelect(incident.id)}
            className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
              selectedId === incident.id
                ? 'border-[var(--saffron)] bg-[var(--ink)]'
                : 'border-[var(--navy-line)] hover:border-[var(--saffron)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <SeverityBadge severity={incident.severity} />
              <span className="text-[11px] font-mono text-[var(--mist)]">
                {incident.region} · {formatDuration(minutesSince(incident.opened_at, now))} open
              </span>
            </div>
            <div className="text-sm text-white mt-1">{incident.title}</div>
            <ul className="mt-1 space-y-0.5">
              {reasons.map((r) => (
                <li key={r} className="text-xs text-[var(--caution)] flex items-center gap-1">
                  <TriangleAlert size={12} aria-hidden="true" />
                  {r}
                </li>
              ))}
            </ul>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LoadSparkline({ points, now }) {
  const [hover, setHover] = useState(null);
  const width = 160;
  const height = 44;
  const pad = 4;
  const finite = points.map((p) => (Number.isFinite(p.load_ratio) ? p.load_ratio : 2));
  const yMax = Math.max(1.25, ...finite);
  const x = (i) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v) => height - pad - (v / yMax) * (height - pad * 2);
  const path = finite.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const shown = hover ?? points.length - 1;
  const point = points[shown];
  const hoursAgo = Math.round((now - point.t) / (60 * MINUTE));

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  }

  function handleKey(e) {
    if (e.key === 'ArrowLeft') setHover(Math.max(0, shown - 1));
    if (e.key === 'ArrowRight') setHover(Math.min(points.length - 1, shown + 1));
  }

  return (
    <div className="w-full sm:w-44">
      <div className="text-[11px] font-mono text-[var(--mist)] h-4 whitespace-nowrap">
        {hoursAgo === 0 ? 'Now' : `${hoursAgo}h ago`} · {formatPercent(point.load_ratio)} · {point.active_count} open
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-11 outline-none focus-visible:ring-1 focus-visible:ring-[var(--saffron)] rounded"
        tabIndex={0}
        role="img"
        aria-label={`Load over the last 12 hours, from ${formatPercent(points[0].load_ratio)} to ${formatPercent(
          points.at(-1).load_ratio
        )} of capacity. Use arrow keys to step through hours.`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={handleKey}
        onBlur={() => setHover(null)}
      >
        <line x1={pad} x2={width - pad} y1={y(1)} y2={y(1)} stroke="var(--mist)" strokeOpacity="0.35" strokeWidth="1" />
        <text x={pad} y={y(1) - 2} fontSize="8" fill="var(--mist)" fillOpacity="0.7">
          capacity
        </text>
        <path d={path} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2" strokeLinejoin="round" />
        {hover != null && (
          <line x1={x(shown)} x2={x(shown)} y1={pad} y2={height - pad} stroke="var(--mist)" strokeOpacity="0.5" strokeWidth="1" />
        )}
        <circle cx={x(shown)} cy={y(finite[shown])} r="3.5" fill="white" stroke="var(--navy)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function LoadBar({ ratio, color }) {
  // The track spans 0–150% of capacity; the tick marks 100%.
  const scale = 1.5;
  const width = Number.isFinite(ratio) ? Math.min(ratio, scale) / scale : 1;
  return (
    <div className="relative h-2 rounded-full bg-[var(--ink)]">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width * 100}%`, background: color }} />
      <div className="absolute -top-1 -bottom-1 w-px bg-[var(--mist)]/60" style={{ left: `${(1 / scale) * 100}%` }} />
    </div>
  );
}

function StaffingStepper({ region, value, onChange }) {
  const button =
    'rounded-full p-0.5 border border-[var(--navy-line)] text-[var(--mist)] hover:text-white hover:border-[var(--saffron)] disabled:opacity-30';
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        className={button}
        onClick={() => onChange(region, value - 1)}
        disabled={value <= 0}
        aria-label={`One fewer officer on duty in ${region}`}
      >
        <Minus size={12} />
      </button>
      <span className="font-mono text-white">{value}</span>
      <button className={button} onClick={() => onChange(region, value + 1)} aria-label={`One more officer on duty in ${region}`}>
        <Plus size={12} />
      </button>
      <span>on duty</span>
    </span>
  );
}

function CoverageTable({ coverage, demand, loadTrend, now, filters, onSelectRegion, onStaffingChange }) {
  return (
    <div className="divide-y divide-[var(--navy-line)]">
      {coverage.map((c) => {
        const d = demand.find((x) => x.region === c.region);
        const trend = loadTrend.find((x) => x.region === c.region);
        const style = COVERAGE_STYLE[c.status];
        return (
          <div
            key={c.region}
            className={`py-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] items-center ${
              filters.region === c.region ? 'bg-[var(--ink)]/60 -mx-2 px-2 rounded-xl' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <button
                  onClick={() => onSelectRegion(c.region)}
                  className="font-semibold text-white hover:text-[var(--saffron)] text-left"
                >
                  {c.region}
                </button>
                <CoverageBadge status={c.status} />
              </div>
              <LoadBar ratio={c.load_ratio} color={style.color} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--mist)]">
                <span>
                  <span className="text-white font-mono">{formatPercent(c.load_ratio)}</span> load ({c.weighted_load}/
                  {c.capacity} pts)
                </span>
                <StaffingStepper region={c.region} value={c.officers_on_duty} onChange={onStaffingChange} />
                <span className={c.unassigned_count ? 'text-white' : ''}>
                  <UserX size={12} className="inline -mt-0.5 mr-0.5" aria-hidden="true" />
                  {c.unassigned_count} unassigned
                </span>
                <span className={d.rising ? 'text-[var(--caution)] font-semibold' : ''}>
                  {d.rising && <TrendingUp size={12} className="inline -mt-0.5 mr-0.5" aria-hidden="true" />}
                  {d.recent} new in 6h vs {d.previous} before{d.rising ? ' — rising' : ''}
                </span>
              </div>
            </div>
            <LoadSparkline points={trend.points} now={now} />
          </div>
        );
      })}
    </div>
  );
}

function FilterChips({ filters, onClear, onToggle }) {
  const chips = [];
  if (filters.region) chips.push({ key: 'region', label: filters.region });
  if (filters.severity) chips.push({ key: 'severity', label: `${filters.severity} severity` });
  if (filters.escalatingOnly) chips.push({ key: 'escalatingOnly', label: 'Escalating only' });
  if (filters.unassignedOnly) chips.push({ key: 'unassignedOnly', label: 'Unassigned only' });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {chips.length === 0 && <span className="text-xs text-[var(--mist)]">Showing all active incidents.</span>}
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onToggle(chip.key)}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-[var(--saffron)] text-white capitalize"
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <X size={12} aria-hidden="true" />
        </button>
      ))}
      {chips.length > 0 && (
        <button onClick={onClear} className="text-xs text-[var(--mist)] underline hover:text-white">
          Clear all
        </button>
      )}
    </div>
  );
}

function IncidentList({ incidents, now, selectedId, onSelect }) {
  if (incidents.length === 0) {
    return <p className="text-sm text-[var(--mist)] py-6 text-center">No active incidents match these filters.</p>;
  }
  return (
    <ul className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
      {incidents.map((incident) => (
        <li key={incident.id}>
          <button
            onClick={() => onSelect(incident.id)}
            aria-current={selectedId === incident.id}
            className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
              selectedId === incident.id
                ? 'border-[var(--saffron)] bg-[var(--ink)]'
                : 'border-[var(--navy-line)] hover:border-[var(--saffron)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <SeverityBadge severity={incident.severity} />
              <span className="text-[11px] font-mono text-[var(--mist)]">{incident.id}</span>
            </div>
            <div className="text-sm text-white mt-0.5">{incident.title}</div>
            <div className="text-[11px] text-[var(--mist)] mt-0.5">
              {incident.region} · {STATUS_LABEL[incident.status]} · {incident.assigned_to || 'Unassigned'} ·{' '}
              {formatDuration(minutesSince(incident.opened_at, now))} open
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

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

function IncidentDetail({ incident, now, onClose, onUpdate }) {
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

const NO_FILTERS = { region: null, severity: null, escalatingOnly: false, unassignedOnly: false };

function useIncidentFeed() {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setFeed(await fetchIncidentFeed());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    window.addEventListener('storage', refresh);
    window.addEventListener(INCIDENTS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(INCIDENTS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { feed, error, now, refresh };
}

function FeedStatus({ source, now, error }) {
  const live = source === 'backend';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mist)]">
      <span className="inline-flex items-center gap-1">
        <Clock size={12} aria-hidden="true" />
        Updated {formatClock(now)} · refreshes every {POLL_MS / 1000}s
      </span>
      {error ? (
        <span className="text-[var(--alert)]">Could not refresh: {error}</span>
      ) : (
        <span
          className={`inline-flex items-center gap-1 font-mono uppercase tracking-wide border rounded-full px-2 py-0.5 ${
            live ? 'border-[var(--safe)] text-[var(--safe)]' : 'border-[var(--caution)] text-[var(--caution)]'
          }`}
          title={
            live
              ? 'Incidents come from the KshemOS backend and are shared with every officer.'
              : 'The backend is not reachable. Incidents are stored in this browser and shared only across its tabs.'
          }
        >
          {live ? <Radio size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}
          {live ? 'Live · shared feed' : 'Offline · this browser only'}
        </span>
      )}
    </div>
  );
}

export default function IncidentDashboardView() {
  const { feed, error, now, refresh } = useIncidentFeed();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const casesRef = useRef(null);

  const incidents = useMemo(() => feed?.incidents ?? [], [feed]);
  const staffing = useMemo(() => feed?.staffing ?? [], [feed]);
  const snapshot = useMemo(() => getDashboardSnapshot(incidents, staffing, now), [incidents, staffing, now]);
  const visible = useMemo(() => filterIncidents(incidents, filters, now), [incidents, filters, now]);
  const selected = incidents.find((i) => i.id === selectedId) || null;
  const { headline } = snapshot;

  if (!feed) {
    return (
      <p className="text-sm text-[var(--mist)] py-10 text-center">
        {error ? `Could not load incidents: ${error}` : 'Connecting to the incident feed…'}
      </p>
    );
  }

  async function handleUpdate(id, changes) {
    await updateIncident(id, changes, feed.source);
    await refresh();
  }

  async function handleStaffing(region, officersOnDuty) {
    setActionError(null);
    try {
      await setRegionStaffing(region, Math.max(0, officersOnDuty), feed.source);
      await refresh();
    } catch (e) {
      setActionError(e.message);
    }
  }

  function drillDown(next) {
    setFilters({ ...NO_FILTERS, ...next });
    setSelectedId(null);
    casesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openCase(id) {
    setSelectedId(id);
    casesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleFilter(key) {
    setFilters((f) => ({ ...f, [key]: typeof f[key] === 'boolean' ? !f[key] : null }));
  }

  return (
    <div className="space-y-5">
      <FeedStatus source={feed.source} now={now} error={error} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile
          label="Active incidents"
          value={headline.active}
          hint={`${headline.officers_on_duty} officers on duty`}
          onClick={() => drillDown({})}
        />
        <StatTile
          label="Critical"
          value={headline.critical}
          onClick={() => drillDown({ severity: 'critical' })}
          active={filters.severity === 'critical' && !filters.region}
        />
        <StatTile
          label="Escalating"
          value={headline.escalating}
          onClick={() => drillDown({ escalatingOnly: true })}
          active={filters.escalatingOnly}
        />
        <StatTile
          label="Unassigned"
          value={headline.unassigned}
          onClick={() => drillDown({ unassignedOnly: true })}
          active={filters.unassignedOnly}
        />
        <StatTile
          label="Regions over capacity"
          value={`${headline.regions_over_capacity}/${staffing.length}`}
          hint={`${CASE_CAPACITY_PER_OFFICER} pts per officer`}
        />
      </div>

      {incidents.length === 0 ? (
        <Panel eyebrow="Operational picture" title="No incidents reported yet">
          <div className="flex items-start gap-3 text-sm text-[var(--mist)]">
            <Inbox size={20} className="shrink-0 text-[var(--saffron)]" aria-hidden="true" />
            <p>
              Reports filed through the Citizen Portal (Verify → File a report) appear here within{' '}
              {POLL_MS / 1000} seconds, grouped by severity and region. Set how many officers are on duty in each
              region below so coverage is measured against real staffing.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel eyebrow="Operational picture" title="Active incidents by severity and region">
            <SeverityRegionTable breakdown={snapshot.breakdown} filters={filters} onSelect={drillDown} />
            <p className="text-xs text-[var(--mist)] mt-3">Select a count to open those cases below.</p>
          </Panel>
          <Panel eyebrow="Needs attention" title={`Escalating incidents (${snapshot.escalations.length})`}>
            <EscalationList escalations={snapshot.escalations} now={now} selectedId={selectedId} onSelect={openCase} />
          </Panel>
        </div>
      )}

      <Panel eyebrow="Staffing pressure" title="Coverage and workload by region">
        <p className="text-xs text-[var(--mist)] mb-2">
          Load = severity-weighted open cases (critical {SEVERITY_WEIGHT.critical}, high {SEVERITY_WEIGHT.high}, medium{' '}
          {SEVERITY_WEIGHT.medium}, low {SEVERITY_WEIGHT.low}) ÷ officers on duty × {CASE_CAPACITY_PER_OFFICER}. Trend
          lines show the last 12 hours at current staffing.
        </p>
        {actionError && <p className="text-sm text-[var(--alert)] mb-2">{actionError}</p>}
        <CoverageTable
          coverage={snapshot.coverage}
          demand={snapshot.demand}
          loadTrend={snapshot.loadTrend}
          now={now}
          filters={filters}
          onSelectRegion={(region) => drillDown({ region })}
          onStaffingChange={handleStaffing}
        />
      </Panel>

      {incidents.length > 0 && (
        <div ref={casesRef} className="scroll-mt-20">
          <Panel eyebrow="Drill-down" title={`Active cases (${visible.length})`}>
            <FilterChips filters={filters} onClear={() => setFilters(NO_FILTERS)} onToggle={toggleFilter} />
            <div className={`grid gap-5 ${selected ? 'lg:grid-cols-2' : ''}`}>
              <IncidentList incidents={visible} now={now} selectedId={selectedId} onSelect={setSelectedId} />
              {selected && (
                <div className="lg:border-l lg:border-[var(--navy-line)] lg:pl-5">
                  <IncidentDetail
                    key={selected.id}
                    incident={selected}
                    now={now}
                    onClose={() => setSelectedId(null)}
                    onUpdate={handleUpdate}
                  />
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
