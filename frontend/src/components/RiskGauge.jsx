import { useEffect, useRef, useState } from 'react';

const BANDS = {
  low: { color: 'var(--safe)', label: 'Low risk' },
  medium: { color: 'var(--caution)', label: 'Medium risk' },
  high: { color: 'var(--alert)', label: 'High risk' },
  critical: { color: 'var(--alert)', label: 'Critical risk' },
};

// Arc gauge from -120deg to +120deg (240deg sweep), score 0-100.
function scoreToAngle(score) {
  return -120 + (score / 100) * 240;
}

export default function RiskGauge({ score = 0, band = 'low' }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      displayRef.current = score;
      setDisplay(score);
      return;
    }

    let raf;
    const start = performance.now();
    const from = displayRef.current;
    const duration = 700;

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);

      const nextDisplay = Math.round(from + (score - from) * eased);
      displayRef.current = nextDisplay;
      setDisplay(nextDisplay);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [score, prefersReducedMotion]);

  const angle = scoreToAngle(display);
  const meta = BANDS[band] || BANDS.low;
  const radius = 80;
  const cx = 100;
  const cy = 100;

  // Precompute the background track arc path (240deg sweep).
  const trackStart = polar(cx, cy, radius, -120);
  const trackEnd = polar(cx, cy, radius, 120);
  const needleTip = polar(cx, cy, radius - 14, angle);

  return (
    <div
      className="flex flex-col items-center"
      role="group"
      aria-label={`Risk score: ${score} out of 100. Risk level: ${meta.label}.`}
    >
      <svg
        viewBox="0 0 200 130"
        className="w-full max-w-[260px]"
        aria-hidden="true"
      >
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="var(--paper-line)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${display > 75 ? 1 : 0} 1 ${polar(cx, cy, radius, angle).x} ${polar(cx, cy, radius, angle).y}`}
          fill="none"
          stroke={meta.color}
          strokeWidth="14"
          strokeLinecap="round"
          style={{ transition: 'stroke 300ms ease' }}
        />
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="var(--ink)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="var(--ink)" />
        <text
          x="100"
          y="95"
          textAnchor="middle"
          className="font-mono"
          fontSize="34"
          fontWeight="600"
          fill="var(--ink)"
        >
          {display}
        </text>
        <text x="100" y="115" textAnchor="middle" fontSize="10" fill="var(--ink-text)" opacity="0.6">
          RISK SCORE / 100
        </text>
      </svg>
      <div
        className="font-display font-semibold text-sm uppercase tracking-wide mt-1 px-3 py-1 rounded-full"
        style={{ color: meta.color, border: `1px solid ${meta.color}` }}
      >
        {meta.label}
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--ink)]">
        Risk score: {score} out of 100
      </p>
    </div>
  );
}

function polar(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
