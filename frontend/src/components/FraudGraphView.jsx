import { useEffect, useMemo, useState } from 'react';

const REL_COLOR = {
  SHARED_DEVICE: '#ff7a1a',
  SAME_IP: '#f2a93b',
  TRANSACTED_WITH: '#5fb3d9',
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
  flagged,
  selectedEdgeId,
  onSelectEdge,
}) {
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const [provenanceFilter, setProvenanceFilter] = useState('all');

  useEffect(() => {
    setRelationshipFilter('all');
    setProvenanceFilter('all');
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
    () => [...new Set(allEdges.map((edge) => edge.relationship_type))].sort(),
    [allEdges]
  );

  const provenanceTypes = useMemo(
    () => [...new Set(allEdges.map((edge) => edge.provenance))].sort(),
    [allEdges]
  );

  const visibleEdges = edges.filter(matchesFilters);

  const visiblePaths = paths.filter((path) =>
    (path.edge_explanations || []).some(matchesFilters)
);

  if (!centerId) {
    return (
      <div className="text-sm font-mono opacity-60 py-10 text-center">
        Look up an account to render its fraud-ring graph.
      </div>
    );
  }

  const neighbors = [
    ...new Set(
      visibleEdges.map((edge) =>
        edge.source === centerId ? edge.target : edge.source
      )
    ),
  ];

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

  const pointById = new Map(points.map((point) => [point.id, point]));

  const hasSyntheticEdges = edges.some(
    (edge) => edge.provenance === 'synthetic'
  );

  return (
    <div className="space-y-4">
      {hasSyntheticEdges && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <strong>Demo data notice:</strong> Synthetic relationships are
          fabricated demonstration data. Their timestamps and confidence
          values are illustrative, not real investigative evidence.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-[var(--mist)]">
          Relationship type
          <select
            value={relationshipFilter}
            onChange={(event) => setRelationshipFilter(event.target.value)}
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
            onChange={(event) => setProvenanceFilter(event.target.value)}
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
        className="w-full"
        role="img"
        aria-label={`Fraud graph centered on account ${centerId}`}
      >
        {visibleEdges.map((edge, index) => {
          const neighborId =
            edge.source === centerId ? edge.target : edge.source;
          const point = pointById.get(neighborId);

          if (!point) return null;

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
              stroke={REL_COLOR[edge.relationship_type] || '#3d5a80'}
              strokeWidth="2"
              opacity="0.8"
            />
          );
        })}

        <circle
          cx={cx}
          cy={cy}
          r="22"
          fill={flagged ? 'var(--alert)' : 'var(--saffron)'}
        />

        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize="9"
          className="font-mono"
          fill="white"
        >
          {centerId.replace('ACC-', '')}
        </text>

        {points.map((point) => (
          <g key={point.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r="16"
              fill="var(--navy)"
              stroke="var(--navy-line)"
              strokeWidth="1.5"
            />
            <text
              x={point.x}
              y={point.y + 3}
              textAnchor="middle"
              fontSize="8"
              className="font-mono"
              fill="var(--mist)"
            >
              {point.id.replace('ACC-', '')}
            </text>
          </g>
        ))}
      </svg>

      {visibleEdges.length === 0 ? (
        <p className="text-sm text-[var(--mist)] text-center py-3">
          No relationships match the selected filters.
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
                    {Number.isFinite(Number(edge.confidence))
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
                  <dt className="text-[var(--mist)]">Evidence signal</dt>
                  <dd className="text-white break-words">
                    {formatLabel(edge.source_signal)}
                  </dd>
                </div>

                <div>
                  <dt className="text-[var(--mist)]">Confidence</dt>
                  <dd className="text-white">
                    {Number.isFinite(Number(edge.confidence))
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
        </div>
      </div>
    ))}
  </section>
)}
    </div>
  );
}
