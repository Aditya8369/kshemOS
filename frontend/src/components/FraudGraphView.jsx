
import { useEffect, useMemo, useState } from 'react';

const REL_COLOR = {
  SHARED_DEVICE: '#ff7a1a',
  SAME_IP: '#f2a93b',
  TRANSACTED_WITH: '#5fb3d9',
  HARVESTED_HONEYPOT_BENEFICIARY: '#f43f5e',
};

function formatTimestamp(value) {
  if (!value) return 'Not supplied';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Invalid timestamp'
    : date.toLocaleString();
}

function formatLabel(value) {
  return String(value || 'Unknown').replaceAll('_', ' ');
}

export default function FraudGraphView({
  centerId,
  edges = [],
  paths = [],
  flagged = false,
  selectedEdgeId,
  onSelectEdge,
  harvestedAccounts = [],
  harvestedByHoneypot = false,
  onSelectNode = () => {},
  neighbors: suppliedNeighbors = [],
  relationships = [],
}) {
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const [provenanceFilter, setProvenanceFilter] = useState('all');
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    setRelationshipFilter('all');
    setProvenanceFilter('all');
    setHoveredNode(null);
  }, [centerId]);

  const allEdges = useMemo(
    () => [
      ...edges,
      ...paths.flatMap((path) => path.edge_explanations || []),
    ],
    [edges, paths]
  );

  const matchesFilters = (edge) =>
    (relationshipFilter === 'all' ||
      edge.relationship_type === relationshipFilter) &&
    (provenanceFilter === 'all' ||
      edge.provenance === provenanceFilter);

  const relationshipTypes = useMemo(
    () => [
      ...new Set(
        allEdges.map((edge) => edge.relationship_type)
      ),
    ].sort(),
    [allEdges]
  );

  const provenanceTypes = useMemo(
    () => [
      ...new Set(allEdges.map((edge) => edge.provenance)),
    ].sort(),
    [allEdges]
  );

  const visibleEdges = edges.filter(matchesFilters);

  const visiblePaths = paths.filter((path) =>
    (path.edge_explanations || []).some(matchesFilters)
  );

  if (!centerId) {
    return (
      <div className="text-sm font-mono opacity-60 py-10 text-center">
        Look up an account or harvest a mule to render its fraud-ring graph.
      </div>
    );
  }

  const neighbors = edges.length > 0
    ? [
        ...new Set(
          edges.map((edge) =>
            edge.source === centerId
              ? edge.target
              : edge.source
          )
        ),
      ]
    : suppliedNeighbors;

  const cx = 160;
  const cy = 140;
  const radius = 100;

  const points = neighbors.map((id, index) => {
    const angle =
      (index / Math.max(neighbors.length, 1)) * 2 * Math.PI -
      Math.PI / 2;

    return {
      id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  const pointById = new Map(
    points.map((point) => [point.id, point])
  );

  const isCenterHarvested =
    harvestedByHoneypot ||
    harvestedAccounts.includes(centerId) ||
    centerId.includes('919876543210') ||
    centerId.includes('309100201948');

  const hasSyntheticEdges = allEdges.some(
    (edge) => edge.provenance === 'synthetic'
  );

  const getRelationshipForNode = (nodeId, index) => {
    const edge = edges.find(
      (item) =>
        item.source === nodeId || item.target === nodeId
    );

    return (
      edge?.relationship_type ||
      relationships[index % Math.max(relationships.length, 1)] ||
      'CONNECTED'
    );
  };

  return (
    <div className="space-y-4">
      {hasSyntheticEdges && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <strong>Demo data notice:</strong> Synthetic relationships are
          fabricated demonstration data. Their timestamps and confidence
          values are illustrative, not real investigative evidence.
        </div>
      )}

      {isCenterHarvested && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
          <strong>Honeypot alert:</strong> This account was harvested
          through the AI Telephony Honeypot.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-[var(--mist)]">
          Relationship type
          <select
            value={relationshipFilter}
            onChange={(event) =>
              setRelationshipFilter(event.target.value)
            }
            className="block w-full mt-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2"
          >
            <option value="all">All relationships</option>
            {relationshipTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--mist)]">
          Provenance
          <select
            value={provenanceFilter}
            onChange={(event) =>
              setProvenanceFilter(event.target.value)
            }
            className="block w-full mt-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2"
          >
            <option value="all">All provenance types</option>
            {provenanceTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <svg
        viewBox="0 0 320 280"
        className="w-full select-none"
        role="img"
        aria-label={`Fraud graph centered on account ${centerId}`}
      >
        <defs>
          <radialGradient id="harvest-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Relationship edges */}
        {visibleEdges.length > 0
          ? visibleEdges.map((edge, index) => {
              const neighborId =
                edge.source === centerId
                  ? edge.target
                  : edge.source;

              const point = pointById.get(neighborId);

              if (!point) return null;

              const isHarvestedEdge =
                edge.relationship_type ===
                'HARVESTED_HONEYPOT_BENEFICIARY';

              return (
                <line
                  key={
                    edge.edge_id ||
                    `${edge.source}-${edge.target}-${index}`
                  }
                  x1={cx}
                  y1={cy}
                  x2={point.x}
                  y2={point.y}
                  stroke={
                    REL_COLOR[edge.relationship_type] || '#3d5a80'
                  }
                  strokeWidth={isHarvestedEdge ? '2.5' : '2'}
                  strokeDasharray={isHarvestedEdge ? '4 2' : 'none'}
                  opacity="0.85"
                />
              );
            })
          : points.map((point, index) => {
              const relationship = relationships[
                index % Math.max(relationships.length, 1)
              ] || 'TRANSACTED_WITH';

              return (
                <line
                  key={`edge-${point.id}`}
                  x1={cx}
                  y1={cy}
                  x2={point.x}
                  y2={point.y}
                  stroke={REL_COLOR[relationship] || '#3d5a80'}
                  strokeWidth="1.8"
                  opacity="0.75"
                />
              );
            })}

        {/* Center node */}
        <g
          className="cursor-pointer"
          onClick={() => onSelectNode(centerId)}
          onMouseEnter={() =>
            setHoveredNode({
              id: centerId,
              isCenter: true,
              isHarvested: isCenterHarvested,
            })
          }
          onMouseLeave={() => setHoveredNode(null)}
        >
          {isCenterHarvested && (
            <circle
              cx={cx}
              cy={cy}
              r="34"
              fill="url(#harvest-glow)"
              className="animate-pulse"
            />
          )}

          <circle
            cx={cx}
            cy={cy}
            r="23"
            fill={
              isCenterHarvested
                ? '#e11d48'
                : flagged
                  ? 'var(--alert)'
                  : 'var(--saffron)'
            }
            stroke="#ffffff"
            strokeWidth={isCenterHarvested ? 2.5 : 1.5}
          />

          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize="8"
            fontWeight="bold"
            className="font-mono"
            fill="white"
          >
            {centerId.replace('ACC-', '').slice(0, 7)}
          </text>
        </g>

        {/* Neighbor nodes */}
        {points.map((point, index) => {
          const isNodeHarvested =
            harvestedAccounts.includes(point.id) ||
            point.id.includes('919876543210') ||
            point.id.includes('309100201948');

          const relationship = getRelationshipForNode(
            point.id,
            index
          );

          return (
            <g
              key={point.id}
              className="cursor-pointer"
              onClick={() => onSelectNode(point.id)}
              onMouseEnter={() =>
                setHoveredNode({
                  id: point.id,
                  isHarvested: isNodeHarvested,
                  rel: relationship,
                })
              }
              onMouseLeave={() => setHoveredNode(null)}
            >
              {isNodeHarvested && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="25"
                  fill="url(#harvest-glow)"
                  className="animate-pulse"
                />
              )}

              <circle
                cx={point.x}
                cy={point.y}
                r="16"
                fill={isNodeHarvested ? '#881337' : 'var(--navy)'}
                stroke={
                  isNodeHarvested ? '#f43f5e' : 'var(--navy-line)'
                }
                strokeWidth={isNodeHarvested ? 2 : 1.5}
              />

              <text
                x={point.x}
                y={point.y + 3}
                textAnchor="middle"
                fontSize="7.5"
                className="font-mono"
                fill={isNodeHarvested ? '#fecdd3' : 'var(--mist)'}
              >
                {point.id.replace('ACC-', '').slice(0, 6)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover information */}
      {hoveredNode && (
        <div className="bg-[var(--ink)]/95 border border-[var(--navy-line)] p-2 rounded-lg text-[10px] font-mono text-white flex items-center justify-between">
          <div>
            <span className="font-bold text-cyan-300">
              {hoveredNode.id}
            </span>

            {hoveredNode.isHarvested && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase text-[9px]">
                🍯 Trapped by Honeypot
              </span>
            )}
          </div>

          {hoveredNode.rel && (
            <span className="text-[var(--mist)]">
              {formatLabel(hoveredNode.rel)}
            </span>
          )}
        </div>
      )}

      {/* Honeypot and relationship legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[9px] font-mono text-[var(--mist)] border-t border-white/5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block" />
          Honeypot Harvested
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#ff7a1a] inline-block" />
          Shared Device
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f2a93b] inline-block" />
          Same IP
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#5fb3d9] inline-block" />
          Transacted
        </span>
      </div>

      {/* Direct relationship evidence */}
      {visibleEdges.length === 0 ? (
        <p className="text-sm text-[var(--mist)] text-center py-3">
          No direct relationships match the selected filters.
        </p>
      ) : (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Relationship evidence ({visibleEdges.length})
          </h3>

          {visibleEdges.map((edge, index) => (
            <article
              key={
                edge.edge_id ||
                `${edge.source}-${edge.target}-${index}`
              }
              className="rounded-lg border border-[var(--navy-line)] bg-[var(--ink)] p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                  {formatLabel(edge.relationship_type)}
                </span>

                <span className="text-xs uppercase tracking-wide text-amber-300">
                  {formatLabel(edge.provenance)}
                </span>
              </div>

              <p className="text-xs text-[var(--mist)] font-mono">
                {edge.source} ↔ {edge.target}
              </p>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[var(--mist)]">Source signal</dt>
                  <dd className="text-white break-words">
                    {formatLabel(edge.source_signal)}
                  </dd>
                </div>

                <div>
                  <dt className="text-[var(--mist)]">Confidence</dt>
                  <dd className="text-white">
                    {edge.confidence !== null &&
                    edge.confidence !== undefined &&
                    Number.isFinite(Number(edge.confidence))
                      ? `${Math.round(Number(edge.confidence) * 100)}%`
                      : 'Not supplied'}
                  </dd>
                </div>

                <div className="col-span-2">
                  <dt className="text-[var(--mist)]">Observed at</dt>
                  <dd className="text-white">
                    {formatTimestamp(edge.observed_at)}
                  </dd>
                </div>
              </dl>

              {edge.annotation && (
                <p className="text-xs text-[var(--mist)] border-t border-[var(--navy-line)] pt-2">
                  {edge.annotation}
                </p>
              )}

              <button
                type="button"
                onClick={() => onSelectEdge?.(edge.edge_id)}
                aria-pressed={selectedEdgeId === edge.edge_id}
                className={`text-xs font-semibold rounded-lg px-3 py-2 border transition-colors ${
                  selectedEdgeId === edge.edge_id
                    ? 'border-[var(--saffron)] text-[var(--saffron)]'
                    : 'border-[var(--navy-line)] text-[var(--mist)] hover:border-[var(--saffron)]'
                }`}
              >
                {selectedEdgeId === edge.edge_id
                  ? 'Selected for review'
                  : 'Select for review'}
              </button>
            </article>
          ))}
        </section>
      )}

      {/* Multi-hop explanations */}
      {visiblePaths.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Explainable paths ({visiblePaths.length})
          </h3>

          {visiblePaths.map((path, index) => (
            <div
              key={`${path.edge_ids.join('-')}-${index}`}
              className="rounded-lg border border-[var(--navy-line)] p-3 space-y-3"
            >
              <div>
                <p className="text-xs text-[var(--mist)]">
                  Account connection
                </p>

                <p className="text-xs font-mono text-white break-words mt-1">
                  {path.accounts.join(' ↔ ')}
                </p>

                <p className="text-xs text-[var(--mist)] mt-1">
                  {path.edge_ids.length} relationship(s) in this path
                </p>
              </div>

              <div className="space-y-2">
                {(path.edge_explanations || []).map((edge) => (
                  <article
                    key={edge.edge_id}
                    className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] p-3 space-y-2"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-xs font-semibold text-white">
                        {formatLabel(edge.relationship_type)}
                      </span>

                      <span className="text-xs text-amber-300">
                        {formatLabel(edge.provenance)}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-[var(--mist)]">
                      {edge.source} ↔ {edge.target}
                    </p>

                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-[var(--mist)]">
                          Evidence signal
                        </dt>
                        <dd className="text-white break-words">
                          {formatLabel(edge.source_signal)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[var(--mist)]">Confidence</dt>
                        <dd className="text-white">
                          {edge.confidence !== null &&
                          edge.confidence !== undefined &&
                          Number.isFinite(Number(edge.confidence))
                            ? `${Math.round(Number(edge.confidence) * 100)}%`
                            : 'Not supplied'}
                        </dd>
                      </div>

                      <div className="col-span-2">
                        <dt className="text-[var(--mist)]">
                          Observed at
                        </dt>
                        <dd className="text-white">
                          {formatTimestamp(edge.observed_at)}
                        </dd>
                      </div>
                    </dl>

                    {edge.annotation && (
                      <p className="text-xs text-[var(--mist)] border-t border-[var(--navy-line)] pt-2">
                        {edge.annotation}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectEdge?.(edge.edge_id)}
                      aria-pressed={selectedEdgeId === edge.edge_id}
                      className={`text-xs font-semibold rounded-lg px-3 py-2 border transition-colors ${
                        selectedEdgeId === edge.edge_id
                          ? 'border-[var(--saffron)] text-[var(--saffron)]'
                          : 'border-[var(--navy-line)] text-[var(--mist)] hover:border-[var(--saffron)]'
                      }`}
                    >
                      {selectedEdgeId === edge.edge_id
                        ? 'Selected for review'
                        : 'Select for review'}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
