import { useState } from 'react';
import { Minus, Plus, TrendingUp, UserX } from 'lucide-react';
import { COVERAGE_STYLE, MINUTE, formatPercent } from './display';
import { CoverageBadge } from './ui';

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

export default function CoverageTable({ coverage, demand, loadTrend, now, filters, onSelectRegion, onStaffingChange }) {
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
