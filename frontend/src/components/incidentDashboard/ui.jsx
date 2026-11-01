import { COVERAGE_STYLE, SEVERITY_COLOR } from './display';

export function Panel({ eyebrow, title, action, children }) {
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

export function SeverityBadge({ severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-white/90">
      <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLOR[severity] }} />
      {severity}
    </span>
  );
}

export function CoverageBadge({ status }) {
  const { label, color, Icon } = COVERAGE_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatTile({ label, value, hint, onClick, active }) {
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
