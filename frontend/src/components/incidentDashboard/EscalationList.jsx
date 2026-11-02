import { TriangleAlert } from 'lucide-react';
import { formatDuration } from '../../incidentDashboard';
import { minutesSince } from './display';
import { SeverityBadge } from './ui';

export default function EscalationList({ escalations, now, selectedId, onSelect }) {
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
