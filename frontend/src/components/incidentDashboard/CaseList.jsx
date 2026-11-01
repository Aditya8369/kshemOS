import { X } from 'lucide-react';
import { formatDuration } from '../../incidentDashboard';
import { STATUS_LABEL, minutesSince } from './display';
import { SeverityBadge } from './ui';

export function FilterChips({ filters, onClear, onToggle }) {
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

export function IncidentList({ incidents, now, selectedId, onSelect }) {
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
