import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Siren,
  Sliders,
  Users,
  Zap,
} from 'lucide-react';
import {
  evaluateLocationPing,
  getAlerts,
  getBoundaries,
  getRules,
  getUnits,
  GEOFENCE_CHANGED_EVENT,
  resetGeofenceEngine,
} from '../../geofenceEngine';
import TacticalMapView from './TacticalMapView';
import GeofenceAlertsPanel from './GeofenceAlertsPanel';
import GeofenceRulesManager from './GeofenceRulesManager';

export default function GeofenceCommandCenterView() {
  const [boundaries, setBoundaries] = useState(() => getBoundaries());
  const [rules, setRules] = useState(() => getRules());
  const [alerts, setAlerts] = useState(() => getAlerts());
  const [units, setUnits] = useState(() => getUnits());
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [bottomTab, setBottomTab] = useState('rules');
  const [simulationStatus, setSimulationStatus] = useState(null);

  function refresh() {
    setBoundaries(getBoundaries());
    setRules(getRules());
    setAlerts(getAlerts());
    setUnits(getUnits());
  }

  useEffect(() => {
    refresh();
    window.addEventListener(GEOFENCE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(GEOFENCE_CHANGED_EVENT, refresh);
    };
  }, []);

  // Quick Simulation Triggers
  function simulateEntryFinancial() {
    // Financial Corridor polygon centroid ~ 28.6300, 77.2180
    const res = evaluateLocationPing({
      entityId: 'UNIT-101',
      team: 'TEAM-ALPHA',
      lat: 28.6300,
      lng: 77.2180,
      timestamp: Date.now(),
    });
    setSimulationStatus('Unit 101 moved inside Financial Corridor. Entry alert evaluated.');
    refresh();
  }

  function simulateDwellFinancial() {
    // Same position, but timestamp 45s in future to simulate prolonged dwell
    const res = evaluateLocationPing({
      entityId: 'UNIT-101',
      team: 'TEAM-ALPHA',
      lat: 28.6300,
      lng: 77.2180,
      timestamp: Date.now() + 45000,
    });
    setSimulationStatus('Unit 101 dwelled in Financial Corridor >30s. Dwell alert evaluated.');
    refresh();
  }

  function simulateRestrictedBreach() {
    // Diplomatic Enclave polygon ~ 28.6000, 77.1900
    const res = evaluateLocationPing({
      entityId: 'UNIT-103',
      team: 'TEAM-BRAVO',
      lat: 28.6000,
      lng: 77.1900,
      timestamp: Date.now(),
    });
    setSimulationStatus('Unit 103 entered Diplomatic Enclave. Critical rule alert evaluated.');
    refresh();
  }

  function simulateExitCyberHub() {
    // Move Cyber unit 102 from 28.5350 out to 28.4800 (outside Cyber Hub)
    const res = evaluateLocationPing({
      entityId: 'UNIT-102',
      team: 'CYBER-PATROL',
      lat: 28.4800,
      lng: 77.2250,
      timestamp: Date.now(),
    });
    setSimulationStatus('Unit 102 exited Cyber Hub perimeter. Exit alert evaluated.');
    refresh();
  }

  function handleReset() {
    resetGeofenceEngine();
    setSimulationStatus('Simulation environment reset to initial tactical coordinates.');
    refresh();
  }

  const unackedAlerts = alerts.filter((a) => !a.acknowledged);
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header & Simulation Controls */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] flex items-center gap-1.5 mb-1">
              <Compass size={14} />
              <span>Tactical Spatial Operations</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-white">
              Geofencing & Map Alerts Command Console
            </h2>
            <p className="text-xs text-[var(--mist)] mt-0.5">
              Real-time coordinate tracking, operational boundaries, entry/exit/dwell triggers, and team rules
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/40 border border-emerald-500/50 text-emerald-400">
              <Radio size={13} className="animate-pulse" />
              <span>Spatial Telemetry Online</span>
            </span>
          </div>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl">
            <div className="text-xs text-[var(--mist)] uppercase font-mono">Boundaries Active</div>
            <div className="text-2xl font-bold font-display text-white mt-0.5">{boundaries.length}</div>
            <div className="text-[10px] text-[var(--mist)]">Circles & Polygons</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl">
            <div className="text-xs text-[var(--mist)] uppercase font-mono">Units on Radar</div>
            <div className="text-2xl font-bold font-display text-white mt-0.5">{units.length}</div>
            <div className="text-[10px] text-cyan-400">Live GPS Telemetry</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl">
            <div className="text-xs text-[var(--mist)] uppercase font-mono">Unread Alerts</div>
            <div className={`text-2xl font-bold font-display mt-0.5 ${unackedAlerts.length > 0 ? 'text-amber-400' : 'text-white'}`}>
              {unackedAlerts.length}
            </div>
            <div className="text-[10px] text-[var(--mist)]">{alerts.length} total events logged</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl">
            <div className="text-xs text-[var(--mist)] uppercase font-mono">Critical Breaches</div>
            <div className={`text-2xl font-bold font-display mt-0.5 ${criticalCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {criticalCount}
            </div>
            <div className="text-[10px] text-[var(--mist)]">High-risk & Restricted</div>
          </div>
        </div>

        {/* Live Simulation Control Bar */}
        <div className="p-3 bg-[var(--ink)]/90 border border-[var(--navy-line)] rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] flex items-center gap-1">
              <Play size={12} />
              <span>Tactical Movement Simulator:</span>
            </span>
            {simulationStatus && (
              <span className="text-[11px] text-white/80 font-mono bg-white/5 px-2.5 py-0.5 rounded-full">
                {simulationStatus}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={simulateEntryFinancial}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--navy)] border border-amber-500/40 text-amber-300 hover:bg-amber-950/40 transition-colors"
            >
              ⚡ Enter Financial Corridor
            </button>
            <button
              onClick={simulateDwellFinancial}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--navy)] border border-purple-500/40 text-purple-300 hover:bg-purple-950/40 transition-colors"
            >
              ⏱️ Trigger Dwell Alert (&gt;30s)
            </button>
            <button
              onClick={simulateRestrictedBreach}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--navy)] border border-rose-500/40 text-rose-300 hover:bg-rose-950/40 transition-colors"
            >
              🚨 Breach Diplomatic Enclave
            </button>
            <button
              onClick={simulateExitCyberHub}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--navy)] border border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 transition-colors"
            >
              🚀 Cyber Unit Perimeter Exit
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--navy-line)] text-[var(--mist)] hover:text-white transition-colors flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tactical Operational View: Map (Left) + Alerts Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-3">
          <TacticalMapView
            boundaries={boundaries}
            units={units}
            alerts={alerts}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
          />
        </div>

        <div className="lg:col-span-4">
          <GeofenceAlertsPanel
            alerts={alerts}
            onSelectEntity={setSelectedEntity}
            onRefresh={refresh}
          />
        </div>
      </div>

      {/* Bottom Configuration Area */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setBottomTab('rules')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              bottomTab === 'rules'
                ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold'
                : 'bg-[var(--navy)] border-[var(--navy-line)] text-[var(--mist)] hover:text-white'
            }`}
          >
            Configurable Geofence Rules ({rules.length})
          </button>
          <button
            onClick={() => setBottomTab('boundaries')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              bottomTab === 'boundaries'
                ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold'
                : 'bg-[var(--navy)] border-[var(--navy-line)] text-[var(--mist)] hover:text-white'
            }`}
          >
            Operational Boundaries ({boundaries.length})
          </button>
        </div>

        {bottomTab === 'rules' ? (
          <GeofenceRulesManager
            rules={rules}
            boundaries={boundaries}
            onRefresh={refresh}
          />
        ) : (
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="font-display font-semibold text-white text-base">
              Active Geofence Boundaries
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {boundaries.map((b) => (
                <div key={b.id} className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{b.name}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-white/20" style={{ color: b.color }}>
                      {b.category}
                    </span>
                  </div>
                  <div className="text-[var(--mist)]">ID: {b.id} · Type: {b.type}</div>
                  <div className="text-[var(--mist)]">
                    {b.type === 'circle'
                      ? `Center: ${b.center?.lat}°N, ${b.center?.lng}°E · Radius: ${b.radiusMeters}m`
                      : `Polygon: ${b.coordinates?.length || 0} vertices`}
                  </div>
                  <div className="text-white/80">
                    Teams: {b.assignedTeams?.join(', ') || 'All teams'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

