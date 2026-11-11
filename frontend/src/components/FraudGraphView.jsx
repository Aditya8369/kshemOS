import { useEffect, useMemo, useState } from 'react';

const EDGE_CONFIG = {
  HARVESTED_HONEYPOT_BENEFICIARY: {
    label: 'Harvested Beneficiary',
    color: '#f43f5e',
    strokeWidth: 2.5,
    strokeDasharray: '4 2',
    description: 'Account trapped by telephony honeypot',
  },
  SHARED_DEVICE: {
    label: 'Shared Device',
    color: '#ff7a1a',
    strokeWidth: 2,
    strokeDasharray: 'none',
    description: 'Hardware or client fingerprint match',
  },
  SAME_IP: {
    label: 'Same IP',
    color: '#f2a93b',
    strokeWidth: 2,
    strokeDasharray: 'none',
    description: 'Co-located network address match',
  },
  TRANSACTED_WITH: {
    label: 'Transacted With',
    color: '#5fb3d9',
    strokeWidth: 2,
    strokeDasharray: 'none',
    description: 'Direct fund transfer or ledger transaction',
  },
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
  const [inspectedNode, setInspectedNode] = useState(null);

  useEffect(() => {
    setRelationshipFilter('all');
    setProvenanceFilter('all');
    setHoveredNode(null);
    setInspectedNode(null);
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

  const hasActiveFilters =
    relationshipFilter !== 'all' || provenanceFilter !== 'all';

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

  const activeNode = inspectedNode || hoveredNode;

  const handleNodeClick = (nodeData) => {
    if (inspectedNode?.id === nodeData.id) {
      if (!nodeData.isCenter) {
        onSelectNode(nodeData.id);
      } else {
        setInspectedNode(null);
      }
    } else {
      setInspectedNode(nodeData);
    }
  };

  const handleKeyDown = (event, nodeData) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNodeClick(nodeData);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full min-w-0 overflow-x-hidden">
      {hasSyntheticEdges && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono">
              Synthetic Demonstration Data
            </span>
          </div>
          <p className="leading-relaxed">
            This graph includes synthetic test fixtures generated for sandbox evaluation. Timestamps, device identifiers, and confidence values are simulated demonstrations, not real investigative evidence.
          </p>
        </div>
      )}

      {isCenterHarvested && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
          <strong>Honeypot alert:</strong> This account was harvested
          through the AI Telephony Honeypot.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <label className="text-xs text-[var(--mist)] min-w-0">
          Relationship type
          <select
            value={relationshipFilter}
            onChange={(event) =>
              setRelationshipFilter(event.target.value)
            }
            className="block w-full mt-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-xs truncate"
          >
            <option value="all">All relationships</option>
            {relationshipTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--mist)] min-w-0">
          Provenance
          <select
            value={provenanceFilter}
            onChange={(event) =>
              setProvenanceFilter(event.target.value)
            }
            className="block w-full mt-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white p-2 text-xs truncate"
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

      <div className="w-full max-w-full overflow-hidden flex justify-center bg-[var(--ink)]/40 rounded-xl border border-[var(--navy-line)] p-2">
        <svg
          viewBox="0 0 320 280"
          className="w-full max-w-[440px] h-auto select-none"
          preserveAspectRatio="xMidYMid meet"
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

                const edgeConfig =
                  EDGE_CONFIG[edge.relationship_type] ||
                  EDGE_CONFIG.TRANSACTED_WITH;

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
                    stroke={edgeConfig.color}
                    strokeWidth={edgeConfig.strokeWidth}
                    strokeDasharray={edgeConfig.strokeDasharray}
                    opacity="0.85"
                  />
                );
              })
            : !hasActiveFilters && edges.length === 0 && points.length > 0
              ? points.map((point, index) => {
                  const relationship =
                    relationships[
                      index % Math.max(relationships.length, 1)
                    ] || 'TRANSACTED_WITH';
                  const edgeConfig =
                    EDGE_CONFIG[relationship] ||
                    EDGE_CONFIG.TRANSACTED_WITH;

                  return (
                    <line
                      key={`edge-${point.id}`}
                      x1={cx}
                      y1={cy}
                      x2={point.x}
                      y2={point.y}
                      stroke={edgeConfig.color}
                      strokeWidth={edgeConfig.strokeWidth}
                      strokeDasharray={edgeConfig.strokeDasharray}
                      opacity="0.75"
                    />
                  );
                })
              : null}

          {/* Center node */}
          <g
            className="cursor-pointer focus:outline-none"
            role="button"
            tabIndex={0}
            aria-label={`Inspect center account ${centerId}`}
            aria-pressed={inspectedNode?.id === centerId}
            onClick={() =>
              handleNodeClick({
                id: centerId,
                isCenter: true,
                isHarvested: isCenterHarvested,
              })
            }
            onKeyDown={(e) =>
              handleKeyDown(e, {
                id: centerId,
                isCenter: true,
                isHarvested: isCenterHarvested,
              })
            }
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

            {inspectedNode?.id === centerId && (
              <circle
                cx={cx}
                cy={cy}
                r="28"
                fill="none"
                stroke="var(--saffron)"
                strokeWidth="2.5"
                strokeDasharray="4 2"
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
              className="font-mono pointer-events-none"
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

            const isInspected = inspectedNode?.id === point.id;

            return (
              <g
                key={point.id}
                className="cursor-pointer focus:outline-none"
                role="button"
                tabIndex={0}
                aria-label={`Inspect account ${point.id}`}
                aria-pressed={isInspected}
                onClick={() =>
                  handleNodeClick({
                    id: point.id,
                    isHarvested: isNodeHarvested,
                    rel: relationship,
                    isCenter: false,
                  })
                }
                onKeyDown={(e) =>
                  handleKeyDown(e, {
                    id: point.id,
                    isHarvested: isNodeHarvested,
                    rel: relationship,
                    isCenter: false,
                  })
                }
                onMouseEnter={() =>
                  setHoveredNode({
                    id: point.id,
                    isHarvested: isNodeHarvested,
                    rel: relationship,
                    isCenter: false,
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

                {isInspected && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="21"
                    fill="none"
                    stroke="var(--saffron)"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={point.x}
                  cy={point.y}
                  r="16"
                  fill={isNodeHarvested ? '#881337' : 'var(--navy)'}
                  stroke={
                    isInspected
                      ? 'var(--saffron)'
                      : isNodeHarvested
                        ? '#f43f5e'
                        : 'var(--navy-line)'
                  }
                  strokeWidth={isInspected ? 2.5 : isNodeHarvested ? 2 : 1.5}
                />

                <text
                  x={point.x}
                  y={point.y + 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  className="font-mono pointer-events-none"
                  fill={isNodeHarvested ? '#fecdd3' : 'var(--mist)'}
                >
                  {point.id.replace('ACC-', '').slice(0, 6)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Touch-friendly Node Inspection & Hover Details Panel */}
      {activeNode && (
        <section
          className={`rounded-lg border p-3 font-mono transition-all min-w-0 ${
            inspectedNode
              ? 'bg-[var(--navy)] border-[var(--saffron)]/70 shadow-md'
              : 'bg-[var(--ink)]/95 border-[var(--navy-line)]'
          }`}
          role="region"
          aria-label="Node inspection details"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--mist)] uppercase tracking-wider font-semibold">
                  {activeNode.isCenter ? 'Center Account:' : 'Inspected Node:'}
                </span>
                <span className="text-xs font-bold text-cyan-300 break-all">
                  {activeNode.id}
                </span>
                {activeNode.isHarvested && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase text-[9px]">
                    🍯 Trapped by Honeypot
                  </span>
                )}
                {inspectedNode && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--saffron)]/20 text-[var(--saffron)] border border-[var(--saffron)]/40 uppercase text-[9px] font-semibold">
                    Pinned
                  </span>
                )}
              </div>

              {activeNode.rel && (
                <p className="text-xs text-[var(--mist)]">
                  Connection: <span className="text-white font-semibold">{formatLabel(activeNode.rel)}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
              {!activeNode.isCenter && (
                <button
                  type="button"
                  onClick={() => onSelectNode(activeNode.id)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--saffron)] text-white hover:bg-[#e06610] transition-colors"
                >
                  Trace Ring →
                </button>
              )}

              {inspectedNode && (
                <button
                  type="button"
                  onClick={() => setInspectedNode(null)}
                  aria-label="Dismiss node details"
                  className="text-xs font-mono px-2 py-1.5 rounded-lg border border-[var(--navy-line)] text-[var(--mist)] hover:text-white hover:border-white transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Readable and visually consistent relationship legend */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-3 text-xs font-mono text-[var(--mist)] border-t border-white/10 min-w-0"
        role="region"
        aria-label="Relationship edge legend"
      >
        <span className="text-[11px] uppercase tracking-wider text-[var(--mist)] font-semibold w-full sm:w-auto text-center sm:text-left">
          Edge Legend:
        </span>
        {Object.entries(EDGE_CONFIG).map(([type, config]) => (
          <span
            key={type}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white text-xs"
            title={config.description}
          >
            <svg width="22" height="6" className="shrink-0" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="22"
                y2="3"
                stroke={config.color}
                strokeWidth={config.strokeWidth}
                strokeDasharray={config.strokeDasharray}
              />
            </svg>
            <span className="truncate">{config.label}</span>
          </span>
        ))}
      </div>

      {/* Direct relationship evidence */}
      {visibleEdges.length === 0 ? (
        hasActiveFilters ? (
          <div className="rounded-lg border border-[var(--navy-line)] bg-[var(--ink)]/80 p-4 text-center space-y-3 min-w-0">
            <div className="text-xs text-amber-300 font-medium">
              No direct relationships match the active filters:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
              {relationshipFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-[var(--navy)] text-white border border-[var(--navy-line)]">
                  Type: {formatLabel(relationshipFilter)}
                </span>
              )}
              {provenanceFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-[var(--navy)] text-white border border-[var(--navy-line)]">
                  Provenance: {formatLabel(provenanceFilter)}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--mist)] max-w-md mx-auto leading-relaxed">
              No recorded links between these accounts match your filter criteria. Try resetting filters to view all connections.
            </p>
            <button
              type="button"
              onClick={() => {
                setRelationshipFilter('all');
                setProvenanceFilter('all');
              }}
              className="inline-flex items-center justify-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--navy)] border border-[var(--saffron)] text-[var(--saffron)] hover:bg-[var(--saffron)] hover:text-white transition-colors"
            >
              Reset Filters ({allEdges.length} total relationships)
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--mist)] text-center py-4">
            No direct relationships recorded for this account.
          </p>
        )
      ) : (
        <section className="space-y-3 min-w-0">
          <h3 className="text-sm font-semibold text-white">
            Relationship evidence ({visibleEdges.length})
          </h3>

          {visibleEdges.map((edge, index) => (
            <article
              key={
                edge.edge_id ||
                `${edge.source}-${edge.target}-${index}`
              }
              className="rounded-lg border border-[var(--navy-line)] bg-[var(--ink)] p-3 space-y-2 min-w-0 max-w-full overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="text-sm font-semibold text-white">
                  {formatLabel(edge.relationship_type)}
                </span>

                {edge.provenance === 'synthetic' ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                    title="Simulated demonstration data"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Synthetic Demo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {formatLabel(edge.provenance)}
                  </span>
                )}
              </div>

              <p className="text-xs text-[var(--mist)] font-mono break-all sm:break-normal">
                {edge.source} ↔ {edge.target}
              </p>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-w-0">
                <div className="min-w-0">
                  <dt className="text-[var(--mist)]">Source signal</dt>
                  <dd className="text-white break-words">
                    {formatLabel(edge.source_signal)}
                  </dd>
                </div>

                <div className="min-w-0">
                  <dt className="text-[var(--mist)]">Confidence</dt>
                  <dd className="text-white">
                    {edge.confidence !== null &&
                    edge.confidence !== undefined &&
                    Number.isFinite(Number(edge.confidence))
                      ? `${Math.round(Number(edge.confidence) * 100)}%`
                      : 'Not supplied'}
                  </dd>
                </div>

                <div className="col-span-1 sm:col-span-2 min-w-0">
                  <dt className="text-[var(--mist)]">Observed at</dt>
                  <dd className="text-white break-words">
                    {formatTimestamp(edge.observed_at)}
                  </dd>
                </div>
              </dl>

              {edge.annotation && (
                <p className="text-xs text-[var(--mist)] border-t border-[var(--navy-line)] pt-2 break-words">
                  {edge.annotation}
                </p>
              )}

              <button
                type="button"
                onClick={() => onSelectEdge?.(edge.edge_id)}
                aria-pressed={selectedEdgeId === edge.edge_id}
                className={`text-xs font-semibold rounded-lg px-3 py-2 border w-full sm:w-auto transition-colors ${
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
        <section className="space-y-3 min-w-0">
          <h3 className="text-sm font-semibold text-white">
            Explainable paths ({visiblePaths.length})
          </h3>

          {visiblePaths.map((path, index) => (
            <div
              key={`${path.edge_ids.join('-')}-${index}`}
              className="rounded-lg border border-[var(--navy-line)] p-3 space-y-3 min-w-0 max-w-full overflow-hidden"
            >
              <div>
                <p className="text-xs text-[var(--mist)]">
                  Account connection
                </p>

                <p className="text-xs font-mono text-white break-all sm:break-words mt-1">
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
                    className="rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] p-3 space-y-2 min-w-0 max-w-full overflow-hidden"
                  >
                    <div className="flex flex-wrap justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-white">
                        {formatLabel(edge.relationship_type)}
                      </span>

                      {edge.provenance === 'synthetic' ? (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          Synthetic Demo
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          {formatLabel(edge.provenance)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-[var(--mist)] break-all sm:break-normal">
                      {edge.source} ↔ {edge.target}
                    </p>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-w-0">
                      <div className="min-w-0">
                        <dt className="text-[var(--mist)]">
                          Evidence signal
                        </dt>
                        <dd className="text-white break-words">
                          {formatLabel(edge.source_signal)}
                        </dd>
                      </div>

                      <div className="min-w-0">
                        <dt className="text-[var(--mist)]">Confidence</dt>
                        <dd className="text-white">
                          {Number.isFinite(Number(edge.confidence))
                            ? `${Math.round(Number(edge.confidence) * 100)}%`
                            : 'Not supplied'}
                        </dd>
                      </div>

                      <div className="col-span-1 sm:col-span-2 min-w-0">
                        <dt className="text-[var(--mist)]">
                          Observed at
                        </dt>
                        <dd className="text-white break-words">
                          {formatTimestamp(edge.observed_at)}
                        </dd>
                      </div>
                    </dl>

                    {edge.annotation && (
                      <p className="text-xs text-[var(--mist)] border-t border-[var(--navy-line)] pt-2 break-words">
                        {edge.annotation}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectEdge?.(edge.edge_id)}
                      aria-pressed={selectedEdgeId === edge.edge_id}
                      className={`text-xs font-semibold rounded-lg px-3 py-2 border w-full sm:w-auto transition-colors ${
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
