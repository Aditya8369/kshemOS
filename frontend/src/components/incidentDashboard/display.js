import { CircleCheck, Gauge, TriangleAlert } from 'lucide-react';

// Single-hue ordinal ramp, validated for monotone lightness and >= 3:1 contrast on --navy.
export const SEVERITY_COLOR = { low: '#bf5546', medium: '#da6d5d', high: '#f68675', critical: '#ffa390' };

export const COVERAGE_STYLE = {
  overloaded: {
    label: 'Over capacity',
    description: 'Workload exceeds 100% of available officer capacity.',
    color: 'var(--alert)',
    Icon: TriangleAlert,
  },

  stretched: {
    label: 'Stretched',
    description: 'Workload is between 80% and 100% of available officer capacity.',
    color: 'var(--caution)',
    Icon: Gauge,
  },

  covered: {
    label: 'Covered',
    description: 'Workload is below 80% of available officer capacity.',
    color: 'var(--safe)',
    Icon: CircleCheck,
  },
};

export const STATUS_LABEL = {
  new: 'New',
  triaged: 'Triaged',
  in_progress: 'In progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
};

export const MINUTE = 60 * 1000;

export function minutesSince(t, now) {
  return Math.max(0, Math.floor((now - t) / MINUTE));
}

export function formatClock(t) {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatPercent(ratio) {
  return Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : 'No cover';
}
