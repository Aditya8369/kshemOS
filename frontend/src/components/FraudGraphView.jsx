import { useState } from 'react';

const REL_COLOR = {
  SHARED_DEVICE: '#ff7a1a',
  SAME_IP: '#f2a93b',
  TRANSACTED_WITH: '#5fb3d9',
  HARVESTED_HONEYPOT_BENEFICIARY: '#f43f5e',
};

export default function FraudGraphView({
  centerId,
  neighbors = [],
  relationships = [],
  flagged = false,
  harvestedAccounts = [],
  onSelectNode = () => {},
}) {
  const [hoveredNode, setHoveredNode] = useState(null);

  if (!centerId) {
    return (
      <div className="text-sm font-mono opacity-60 py-10 text-center">
        Look up an account or harvest a mule to render its fraud-ring graph.
      </div>
    );
  }

  const cx = 160;
  const cy = 135;
  const r = 95;
  const points = neighbors.map((id, i) => {
    const angle = (i / Math.max(neighbors.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return { id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const isCenterHarvested =
    harvestedAccounts.includes(centerId) || centerId.includes('919876543210') || centerId.includes('309100201948');

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 320 270" className="w-full select-none">
        <defs>
          <radialGradient id="harvest-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Edges */}
        {points.map((p, i) => {
          const rel = relationships[i % relationships.length] || 'TRANSACTED_WITH';
          const strokeColor = REL_COLOR[rel] || '#3d5a80';
          const isHarvestedEdge = rel === 'HARVESTED_HONEYPOT_BENEFICIARY';

          return (
            <g key={`edge-${p.id}`}>
              <line
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke={strokeColor}
                strokeWidth={isHarvestedEdge ? '2.5' : '1.8'}
                strokeDasharray={isHarvestedEdge ? '4 2' : 'none'}
                opacity={isHarvestedEdge ? '0.95' : '0.75'}
              />
            </g>
          );
        })}

        {/* Center Node */}
        <g
          className="cursor-pointer transition-transform hover:scale-105"
          onClick={() => onSelectNode(centerId)}
          onMouseEnter={() => setHoveredNode({ id: centerId, isCenter: true, isHarvested: isCenterHarvested })}
          onMouseLeave={() => setHoveredNode(null)}
        >
          {isCenterHarvested && (
            <circle cx={cx} cy={cy} r="32" fill="url(#harvest-glow)" className="animate-pulse" />
          )}
          <circle
            cx={cx}
            cy={cy}
            r="23"
            fill={isCenterHarvested ? '#e11d48' : flagged ? 'var(--alert)' : 'var(--saffron)'}
            stroke="#ffffff"
            strokeWidth={isCenterHarvested ? 2.5 : 1.5}
            className="drop-shadow-md"
          />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fontWeight="bold" className="font-mono" fill="white">
            {centerId.replace('ACC-', '').slice(0, 7)}
          </text>
        </g>

        {/* Neighbor Nodes */}
        {points.map((p, idx) => {
          const isNodeHarvested =
            harvestedAccounts.includes(p.id) || p.id.includes('919876543210') || p.id.includes('309100201948');
          const rel = relationships[idx % relationships.length] || 'CONNECTED';

          return (
            <g
              key={p.id}
              className="cursor-pointer transition-transform hover:scale-110"
              onClick={() => onSelectNode(p.id)}
              onMouseEnter={() => setHoveredNode({ id: p.id, isHarvested: isNodeHarvested, rel })}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {isNodeHarvested && (
                <circle cx={p.x} cy={p.y} r="24" fill="url(#harvest-glow)" className="animate-pulse" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r="16"
                fill={isNodeHarvested ? '#881337' : 'var(--navy)'}
                stroke={isNodeHarvested ? '#f43f5e' : 'var(--navy-line)'}
                strokeWidth={isNodeHarvested ? 2 : 1.5}
              />
              <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="7.5" className="font-mono" fill={isNodeHarvested ? '#fecdd3' : 'var(--mist)'}>
                {p.id.replace('ACC-', '').slice(0, 6)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Info Card */}
      {hoveredNode && (
        <div className="bg-[var(--ink)]/95 border border-[var(--navy-line)] p-2 rounded-lg text-[10px] font-mono text-white flex items-center justify-between">
          <div>
            <span className="font-bold text-cyan-300">{hoveredNode.id}</span>
            {hoveredNode.isHarvested && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase text-[9px]">
                🍯 Trapped by Honeypot
              </span>
            )}
          </div>
          {hoveredNode.rel && <span className="text-[var(--mist)]">{hoveredNode.rel}</span>}
        </div>
      )}

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[9px] font-mono text-[var(--mist)] border-t border-white/5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block" />
          <span>Honeypot Harvested</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#ff7a1a] inline-block" />
          <span>Shared Device</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f2a93b] inline-block" />
          <span>Same IP</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#5fb3d9] inline-block" />
          <span>Transacted</span>
        </span>
      </div>
    </div>
  );
}
