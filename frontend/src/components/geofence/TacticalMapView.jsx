import { useState } from 'react';
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
} from 'lucide-react';

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
  selectedEntity = null,
  onSelectEntity = () => {},
}) {
  const [layers, setLayers] = useState({
    boundaries: true,
    units: true,
    incidents: true,
    alerts: true,
    grid: true,
  });
  const [zoom, setZoom] = useState(1);
  const [hoveredItem, setHoveredItem] = useState(null);

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
        <div className="flex items-center gap-1 pointer-events-auto bg-[var(--navy)]/90 backdrop-blur border border-[var(--navy-line)] p-1 rounded-full text-xs">
          <button
            onClick={() => toggleLayer('boundaries')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              layers.boundaries ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Geofences ({boundaries.length})
          </button>
          <button
            onClick={() => toggleLayer('units')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              layers.units ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Units ({units.length})
          </button>
          <button
            onClick={() => toggleLayer('alerts')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              layers.alerts ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Alert Beacons ({activeAlerts.length})
          </button>
          <button
            onClick={() => toggleLayer('grid')}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
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

      {/* Hover Info Card */}
      {hoveredItem && (
        <div className="absolute bottom-3 left-3 z-20 bg-[var(--navy)]/95 border border-[var(--navy-line)] p-3 rounded-xl shadow-2xl max-w-xs text-xs pointer-events-none animate-fade-in text-white">
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
        </div>
      )}
    </div>
  );
}

