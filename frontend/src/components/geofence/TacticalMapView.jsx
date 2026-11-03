import { useState, useEffect } from 'react';
import {
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Radio,
  RotateCcw,
  Shield,
  Siren,
  Users,
  Zap,
  TrendingUp,
  Building2,
  Target,
} from 'lucide-react';
import { fetchThreatHeatmapDataApi, SPATIAL_CHANGED_EVENT } from '../../api.js';

// Bounding box for metropolitan tactical operational area
const MAP_BOUNDS = {
  minLat: 28.51,
  maxLat: 28.69,
  minLng: 77.08,
  maxLng: 77.32,
};

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 600;

function project(lat, lng) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * VIEW_WIDTH;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * VIEW_HEIGHT;
  return { x: Math.max(10, Math.min(VIEW_WIDTH - 10, x)), y: Math.max(10, Math.min(VIEW_HEIGHT - 10, y)) };
}

function projectRadius(radiusMeters, lat) {
  // Approximate conversion: 1 deg lat ~ 111,000m
  const scale = (VIEW_HEIGHT / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) / 111000;
  return Math.max(25, radiusMeters * scale);
}

const CATEGORY_COLORS = {
  high_risk: '#ef4444',
  restricted: '#dc2626',
  critical_infra: '#8b5cf6',
  transit_checkpoint: '#f59e0b',
  patrol_zone: '#3b82f6',
  operational_sector: '#06b6d4',
};

export default function TacticalMapView({
  boundaries = [],
  units = [],
  alerts = [],
  incidents = [],
  spatialData = null,
  selectedEntity = null,
  onSelectEntity = () => {},
}) {
  const [layers, setLayers] = useState({
    boundaries: true,
    units: true,
    alerts: true,
    heatmap: true,
    vectors: true,
    pois: true,
    patrols: true,
    grid: true,
  });
  const [zoom, setZoom] = useState(1);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [internalSpatialData, setInternalSpatialData] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadSpatial() {
      try {
        const res = await fetchThreatHeatmapDataApi();
        if (mounted) setInternalSpatialData(res);
      } catch (e) {
        console.error('Failed to load spatial data for tactical map:', e);
      }
    }

    if (!spatialData) {
      loadSpatial();
      window.addEventListener(SPATIAL_CHANGED_EVENT, loadSpatial);
    }

    return () => {
      mounted = false;
      if (!spatialData) {
        window.removeEventListener(SPATIAL_CHANGED_EVENT, loadSpatial);
      }
    };
  }, [spatialData]);

  const activeSpatial = spatialData || internalSpatialData || {
    clusters: [],
    migration_vectors: [],
    patrol_recommendations: [],
    financial_pois: [],
  };

  const clusters = activeSpatial.clusters || [];
  const vectors = activeSpatial.migration_vectors || [];
  const pois = activeSpatial.financial_pois || [];
  const patrolRecs = activeSpatial.patrol_recommendations || [];

  function toggleLayer(layer) {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  // Active unacknowledged alerts for radar animation
  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="relative bg-[var(--ink)] border border-[var(--navy-line)] rounded-2xl overflow-hidden shadow-xl select-none">
      {/* Top Map HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-[var(--navy)]/90 backdrop-blur border border-[var(--navy-line)] px-3 py-1.5 rounded-full text-xs font-mono text-white">
          <Crosshair size={13} className="text-[var(--saffron)]" />
          <span>HQ SECTOR RADAR · 28.6139°N 77.2090°E</span>
          <span className="text-[var(--mist)]">|</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <Radio size={12} className="animate-pulse" />
            LIVE TELEMETRY
          </span>
        </div>

        {/* Map Layer Controls */}
        <div className="flex items-center gap-1 pointer-events-auto bg-[var(--navy)]/90 backdrop-blur border border-[var(--navy-line)] p-1 rounded-full text-xs overflow-x-auto max-w-full">
          <button
            onClick={() => toggleLayer('boundaries')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.boundaries ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Geofences ({boundaries.length})
          </button>
          <button
            onClick={() => toggleLayer('heatmap')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.heatmap ? 'bg-red-500 text-white font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            🔥 Heatmap ({clusters.length})
          </button>
          <button
            onClick={() => toggleLayer('vectors')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.vectors ? 'bg-cyan-500 text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            ↗ Vectors ({vectors.length})
          </button>
          <button
            onClick={() => toggleLayer('pois')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.pois ? 'bg-amber-500 text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            🏧 ATMs ({pois.length})
          </button>
          <button
            onClick={() => toggleLayer('patrols')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.patrols ? 'bg-emerald-500 text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            🎯 Patrols ({patrolRecs.length})
          </button>
          <button
            onClick={() => toggleLayer('units')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.units ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Units ({units.length})
          </button>
          <button
            onClick={() => toggleLayer('alerts')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.alerts ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Alerts ({activeAlerts.length})
          </button>
          <button
            onClick={() => toggleLayer('grid')}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
              layers.grid ? 'bg-white/10 text-white' : 'text-[var(--mist)]'
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* SVG Tactical Map Surface */}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full h-auto max-h-[580px] bg-gradient-to-b from-[#0a1120] via-[#0d1628] to-[#080d1a]"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
      >
        <defs>
          {/* Radar alert animation pattern */}
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>

          {/* Grid pattern */}
          <pattern id="tactical-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <circle cx="0" cy="0" r="1.5" fill="rgba(255,255,255,0.15)" />
          </pattern>

          {/* Threat Heatmap Radial Gradients */}
          <radialGradient id="heat-critical" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.65" />
            <stop offset="45%" stopColor="#ef4444" stopOpacity="0.25" />
            <stop offset="85%" stopColor="#dc2626" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat-high" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="85%" stopColor="#ea580c" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat-moderate" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#eab308" stopOpacity="0.18" />
            <stop offset="85%" stopColor="#ca8a04" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>

          {/* Migration Vector Arrow Markers */}
          <marker
            id="arrow-cyan"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#06b6d4" />
          </marker>
          <marker
            id="arrow-purple"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#c084fc" />
          </marker>
          <marker
            id="arrow-emerald"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
          </marker>
        </defs>

        {/* Tactical Grid Background */}
        {layers.grid && (
          <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#tactical-grid)" />
        )}

        {/* Sector Guideline Crossbars */}
        <line x1={0} y1={VIEW_HEIGHT / 2} x2={VIEW_WIDTH} y2={VIEW_HEIGHT / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
        <line x1={VIEW_WIDTH / 2} y1={0} x2={VIEW_WIDTH / 2} y2={VIEW_HEIGHT} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />

        {/* Geofence Boundaries Layer */}
        {layers.boundaries &&
          boundaries.map((boundary) => {
            const color = boundary.color || CATEGORY_COLORS[boundary.category] || '#3b82f6';
            const isSelected = selectedEntity?.id === boundary.id;

            if (boundary.type === 'circle' && boundary.center) {
              const { x, y } = project(boundary.center.lat, boundary.center.lng);
              const r = projectRadius(boundary.radiusMeters || boundary.radius_meters || 1500, boundary.center.lat);

              return (
                <g
                  key={boundary.id}
                  className="cursor-pointer transition-all"
                  onClick={() => onSelectEntity({ type: 'boundary', data: boundary })}
                  onMouseEnter={() => setHoveredItem({ type: 'boundary', data: boundary })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Outer glow ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={color}
                    fillOpacity={isSelected ? 0.28 : 0.12}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 1.8}
                    strokeDasharray={boundary.category === 'restricted' ? '6 4' : 'none'}
                  />
                  {/* Center Anchor Point */}
                  <circle cx={x} cy={y} r="3.5" fill={color} />
                  {/* Label */}
                  <text
                    x={x}
                    y={y - r - 6}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="monospace"
                    className="drop-shadow-md select-none"
                  >
                    {boundary.name}
                  </text>
                  <text
                    x={x}
                    y={y - r + 8}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.6)"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {boundary.id} · r={(boundary.radiusMeters || 2000) / 1000}km
                  </text>
                </g>
              );
            } else if (boundary.type === 'polygon' && boundary.coordinates?.length >= 3) {
              const pointsStr = boundary.coordinates
                .map((coord) => {
                  const { x, y } = project(coord.lat, coord.lng);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');

              const centerCoord = boundary.center || boundary.coordinates[0];
              const { x: cx, y: cy } = project(centerCoord.lat, centerCoord.lng);

              return (
                <g
                  key={boundary.id}
                  className="cursor-pointer transition-all"
                  onClick={() => onSelectEntity({ type: 'boundary', data: boundary })}
                  onMouseEnter={() => setHoveredItem({ type: 'boundary', data: boundary })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <polygon
                    points={pointsStr}
                    fill={color}
                    fillOpacity={isSelected ? 0.3 : 0.15}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeDasharray={boundary.category === 'high_risk' ? '8 4' : 'none'}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="monospace"
                    className="drop-shadow-md select-none"
                  >
                    {boundary.name}
                  </text>
                  <text
                    x={cx}
                    y={cy + 13}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.65)"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    [{boundary.category.replace('_', ' ').toUpperCase()}]
                  </text>
                </g>
              );
            }
            return null;
          })}

        {/* Real-Time DBSCAN Threat Heatmap Clusters Layer */}
        {layers.heatmap &&
          clusters.map((cluster) => {
            const { x, y } = project(cluster.center_lat, cluster.center_lng);
            const r = projectRadius(cluster.radius_meters || 1600, cluster.center_lat);
            const gradientId =
              cluster.threat_level === 'critical'
                ? 'url(#heat-critical)'
                : cluster.threat_level === 'high'
                ? 'url(#heat-high)'
                : 'url(#heat-moderate)';
            const strokeColor =
              cluster.threat_level === 'critical'
                ? '#ef4444'
                : cluster.threat_level === 'high'
                ? '#f97316'
                : '#eab308';
            const isSelected = selectedEntity?.id === cluster.cluster_id;

            return (
              <g
                key={`heat-${cluster.cluster_id}`}
                className="cursor-pointer transition-all"
                onClick={() => onSelectEntity({ type: 'cluster', data: cluster })}
                onMouseEnter={() => setHoveredItem({ type: 'cluster', data: cluster })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Density Heat Glow Field */}
                <circle cx={x} cy={y} r={r * 1.25} fill={gradientId} />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={strokeColor}
                  fillOpacity={isSelected ? 0.35 : 0.15}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray="4 3"
                />
                {/* Cluster Hotspot Core */}
                <circle cx={x} cy={y} r="5" fill={strokeColor} className="animate-pulse" />
                <circle cx={x} cy={y} r="12" fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.6" />

                {/* Heatmap Cluster Badge */}
                <rect
                  x={x - 65}
                  y={y - r - 22}
                  width="130"
                  height="18"
                  rx="9"
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
                <text
                  x={x}
                  y={y - r - 10}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  🔥 {cluster.cluster_id} · {cluster.incident_count} INCS · {cluster.financial_pois_count} ATMS
                </text>
              </g>
            );
          })}

        {/* Velocity & Migration Vectors Layer */}
        {layers.vectors &&
          vectors.map((vec) => {
            const cluster = clusters.find((c) => c.cluster_id === vec.cluster_id);
            if (!cluster) return null;

            const { x: cx, y: cy } = project(cluster.center_lat, cluster.center_lng);
            const headingRad = ((vec.heading_degrees || 0) * Math.PI) / 180.0;
            const length = Math.min(105, Math.max(55, (vec.velocity_km_per_day || 3.0) * 14));

            const x2 = cx + length * Math.sin(headingRad);
            const y2 = cy - length * Math.cos(headingRad);

            const vectorColor =
              vec.trend === 'migrating'
                ? '#06b6d4'
                : vec.trend === 'expanding'
                ? '#c084fc'
                : '#10b981';
            const markerId =
              vec.trend === 'migrating'
                ? 'url(#arrow-cyan)'
                : vec.trend === 'expanding'
                ? 'url(#arrow-purple)'
                : 'url(#arrow-emerald)';

            const midX = (cx + x2) / 2;
            const midY = (cy + y2) / 2;

            return (
              <g
                key={`vector-${vec.cluster_id}`}
                className="cursor-pointer"
                onClick={() => onSelectEntity({ type: 'vector', data: vec })}
                onMouseEnter={() => setHoveredItem({ type: 'vector', data: vec })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Dynamic Vector Trajectory Arrow */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke={vectorColor}
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                  markerEnd={markerId}
                />
                {/* Trajectory Velocity Pill */}
                <rect
                  x={midX - 42}
                  y={midY - 10}
                  width="84"
                  height="16"
                  rx="8"
                  fill="rgba(10, 17, 32, 0.92)"
                  stroke={vectorColor}
                  strokeWidth="1"
                />
                <text
                  x={midX}
                  y={midY + 1}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ↗ {vec.heading_cardinal} · {vec.velocity_km_per_day} km/d
                </text>
              </g>
            );
          })}

        {/* Vulnerable ATMs and Financial POIs Layer */}
        {layers.pois &&
          pois.map((poi) => {
            const { x, y } = project(poi.lat, poi.lng);
            const isHighVuln = poi.vulnerability_score >= 0.8;
            const color = isHighVuln ? '#f59e0b' : '#38bdf8';
            const isSelected = selectedEntity?.id === poi.id;

            return (
              <g
                key={`poi-${poi.id}`}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => onSelectEntity({ type: 'poi', data: poi })}
                onMouseEnter={() => setHoveredItem({ type: 'poi', data: poi })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <rect
                  x={x - 8}
                  y={y - 8}
                  width="16"
                  height="16"
                  rx="3"
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {poi.poi_type === 'atm' ? '🏧' : '🏛️'}
                </text>
                <text
                  x={x}
                  y={y + 16}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="7"
                  fontFamily="monospace"
                  className="select-none"
                >
                  {poi.name.split(' ')[0]}
                </text>
              </g>
            );
          })}

        {/* Smart Patrol Dispatch Intercept Waypoints Layer */}
        {layers.patrols &&
          patrolRecs.map((rec) => {
            const { x, y } = project(rec.lat, rec.lng);
            const isSelected = selectedEntity?.id === rec.recommendation_id;

            return (
              <g
                key={`patrol-${rec.recommendation_id}`}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={() => onSelectEntity({ type: 'patrol', data: rec })}
                onMouseEnter={() => setHoveredItem({ type: 'patrol', data: rec })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Target Crosshair Reticle */}
                <circle cx={x} cy={y} r="14" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx={x} cy={y} r="8" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="1.5" />
                <circle cx={x} cy={y} r="2.5" fill="#34d399" />
                <line x1={x - 17} y1={y} x2={x - 10} y2={y} stroke="#10b981" strokeWidth="1.5" />
                <line x1={x + 10} y1={y} x2={x + 17} y2={y} stroke="#10b981" strokeWidth="1.5" />
                <line x1={x} y1={y - 17} x2={x} y2={y - 10} stroke="#10b981" strokeWidth="1.5" />
                <line x1={x} y1={y + 10} x2={x} y2={y + 17} stroke="#10b981" strokeWidth="1.5" />

                {/* Waypoint Label */}
                <rect
                  x={x - 38}
                  y={y + 17}
                  width="76"
                  height="14"
                  rx="4"
                  fill="rgba(6, 78, 59, 0.9)"
                  stroke="#34d399"
                  strokeWidth="0.8"
                />
                <text
                  x={x}
                  y={y + 27}
                  textAnchor="middle"
                  fill="#ecfdf5"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  🎯 {rec.suggested_unit_code} INTERCEPT
                </text>
              </g>
            );
          })}

        {/* Alert Radar Beacons Layer */}
        {layers.alerts &&
          activeAlerts.map((alert) => {
            const { x, y } = project(alert.lat, alert.lng);
            return (
              <g key={`alert-beacon-${alert.id}`} className="pointer-events-none">
                <circle cx={x} cy={y} r="28" fill="url(#radar-glow)" className="animate-ping" opacity="0.75" />
                <circle cx={x} cy={y} r="18" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.9" />
                <circle cx={x} cy={y} r="4" fill="#ef4444" />
                <text
                  x={x}
                  y={y - 24}
                  textAnchor="middle"
                  fill="#fca5a5"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                  className="animate-pulse"
                >
                  ⚠️ {alert.eventType.toUpperCase()} ALERT
                </text>
              </g>
            );
          })}

        {/* Tracked Units Layer */}
        {layers.units &&
          units.map((unit) => {
            const { x, y } = project(unit.lat, unit.lng);
            const isSelected = selectedEntity?.id === unit.id;
            const teamColor =
              unit.team === 'TEAM-ALPHA'
                ? '#38bdf8'
                : unit.team === 'CYBER-PATROL'
                ? '#c084fc'
                : unit.team === 'VIP-ESCORT'
                ? '#f43f5e'
                : '#34d399';

            return (
              <g
                key={unit.id}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={() => onSelectEntity({ type: 'unit', data: unit })}
                onMouseEnter={() => setHoveredItem({ type: 'unit', data: unit })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Unit Pulse Halo */}
                <circle cx={x} cy={y} r={isSelected ? 16 : 11} fill={teamColor} fillOpacity="0.25" />

                {/* Unit Icon Pin */}
                <circle
                  cx={x}
                  cy={y}
                  r="7.5"
                  fill={teamColor}
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  className="drop-shadow-lg"
                />

                {/* Heading Arrow */}
                <line
                  x1={x}
                  y1={y}
                  x2={x + 14 * Math.sin(((unit.heading || 0) * Math.PI) / 180)}
                  y2={y - 14 * Math.cos(((unit.heading || 0) * Math.PI) / 180)}
                  stroke={teamColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Unit Label Tag */}
                <rect
                  x={x - 28}
                  y={y + 10}
                  width="56"
                  height="16"
                  rx="4"
                  fill="rgba(10, 17, 32, 0.85)"
                  stroke={isSelected ? 'var(--saffron)' : 'rgba(255,255,255,0.2)'}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={y + 21}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {unit.id}
                </text>
              </g>
            );
          })}
      </svg>

      {/* Floating Map Controls */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5 bg-[var(--navy)]/90 backdrop-blur border border-[var(--navy-line)] p-1 rounded-xl">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          className="p-1.5 rounded-lg text-[var(--mist)] hover:text-white hover:bg-white/10"
          title="Zoom in"
        >
          <Maximize2 size={15} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
          className="p-1.5 rounded-lg text-[var(--mist)] hover:text-white hover:bg-white/10"
          title="Zoom out"
        >
          <Minimize2 size={15} />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1.5 rounded-lg text-[var(--mist)] hover:text-white hover:bg-white/10"
          title="Reset View"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Rich Hover Info Card */}
      {hoveredItem && (
        <div className="absolute bottom-3 left-3 z-20 bg-[var(--navy)]/95 border border-[var(--navy-line)] p-3 rounded-xl shadow-2xl max-w-sm text-xs pointer-events-none animate-fade-in text-white">
          {hoveredItem.type === 'boundary' && (
            <div className="space-y-1 font-mono">
              <div className="font-bold text-sm text-[var(--saffron)]">{hoveredItem.data.name}</div>
              <div className="text-[11px] text-[var(--mist)]">ID: {hoveredItem.data.id}</div>
              <div className="text-[11px]">Type: {hoveredItem.data.type} · Category: {hoveredItem.data.category}</div>
              <div className="text-[11px]">Assigned: {hoveredItem.data.assignedTeams?.join(', ') || 'All teams'}</div>
            </div>
          )}
          {hoveredItem.type === 'unit' && (
            <div className="space-y-1 font-mono">
              <div className="font-bold text-sm text-cyan-300">{hoveredItem.data.name}</div>
              <div className="text-[11px] text-[var(--mist)]">ID: {hoveredItem.data.id} · Team: {hoveredItem.data.team}</div>
              <div className="text-[11px]">Pos: {hoveredItem.data.lat.toFixed(4)}°N, {hoveredItem.data.lng.toFixed(4)}°E</div>
              <div className="text-[11px]">Speed: {hoveredItem.data.speedKm} km/h · Heading: {hoveredItem.data.heading}°</div>
            </div>
          )}
          {hoveredItem.type === 'cluster' && (
            <div className="space-y-1 font-mono">
              <div className="font-bold text-sm text-red-400">🔥 {hoveredItem.data.name}</div>
              <div className="text-[11px] text-[var(--mist)]">
                ID: {hoveredItem.data.cluster_id} · Region: {hoveredItem.data.region}
              </div>
              <div className="text-[11px]">
                Threat Level:{' '}
                <span className="uppercase font-bold text-red-400">{hoveredItem.data.threat_level}</span>
              </div>
              <div className="text-[11px]">
                Density: {hoveredItem.data.incident_count} reports · {hoveredItem.data.financial_pois_count} vulnerable ATMs
              </div>
              <div className="text-[11px]">
                Radius: {(hoveredItem.data.radius_meters / 1000).toFixed(1)} km · Severity Score: {hoveredItem.data.severity_score}
              </div>
            </div>
          )}
          {hoveredItem.type === 'vector' && (
            <div className="space-y-1 font-mono">
              <div className="font-bold text-sm text-cyan-300">↗ Velocity Vector: {hoveredItem.data.cluster_id}</div>
              <div className="text-[11px] text-[var(--mist)]">
                Trend: <span className="uppercase font-bold text-white">{hoveredItem.data.trend}</span>
              </div>
              <div className="text-[11px]">
                Velocity: {hoveredItem.data.velocity_km_per_day} km/day · Heading: {hoveredItem.data.heading_degrees}° ({hoveredItem.data.heading_cardinal})
              </div>
              <div className="text-[11px]">
                Target Sector: {hoveredItem.data.target_region} ({hoveredItem.data.target_service_area_id})
              </div>
              <div className="text-[11px] text-amber-200 mt-1">{hoveredItem.data.risk_narrative}</div>
            </div>
          )}
          {hoveredItem.type === 'poi' && (
            <div className="space-y-1 font-mono">
              <div className="font-bold text-sm text-amber-300">
                {hoveredItem.data.poi_type === 'atm' ? '🏧' : '🏛️'} {hoveredItem.data.name}
              </div>
              <div className="text-[11px] text-[var(--mist)]">
                ID: {hoveredItem.data.id} · Type: {hoveredItem.data.poi_type}
              </div>
              <div className="text-[11px]">
                Bank: {hoveredItem.data.bank_name} · Region: {hoveredItem.data.region}
              </div>
              <div className="text-[11px]">
                Vulnerability Score:{' '}
                <span className="font-bold text-amber-400">
                  {(hoveredItem.data.vulnerability_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
          {hoveredItem.type === 'patrol' && (
            <div className="space-y-1 font-mono">
              <div className="font-bold text-sm text-emerald-300">🎯 Smart Intercept Checkpoint</div>
              <div className="text-[11px] text-[var(--mist)]">
                ID: {hoveredItem.data.recommendation_id} · Unit: {hoveredItem.data.suggested_unit_code} ({hoveredItem.data.assigned_team_code})
              </div>
              <div className="text-[11px]">
                Priority:{' '}
                <span className="uppercase font-bold text-amber-400">
                  {hoveredItem.data.suggested_priority.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px]">Target: {hoveredItem.data.target_infrastructure}</div>
              {hoveredItem.data.action_checklist?.[0] && (
                <div className="text-[10px] text-emerald-200 mt-1 bg-emerald-950/40 p-1.5 rounded border border-emerald-500/20">
                  Directive: {hoveredItem.data.action_checklist[0]}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
