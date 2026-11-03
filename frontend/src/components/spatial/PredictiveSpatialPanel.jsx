import { useState, useEffect } from 'react';
import {
  Compass,
  TrendingUp,
  TrendingDown,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Radio,
  Layers,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { fetchThreatHeatmapDataApi } from '../../api.js';

export default function PredictiveSpatialPanel({ selectedRegion = null, onSelectWaypoint = () => {} }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clusters'); // clusters, vectors, patrols, pois

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetchThreatHeatmapDataApi();
        if (mounted) setData(res);
      } catch (err) {
        console.error('Failed to load spatial intelligence:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6 text-center text-xs text-[var(--mist)] font-mono">
        Scanning spatial clusters and migration vectors…
      </div>
    );
  }

  const clusters = selectedRegion
    ? data.clusters.filter((c) => c.region === selectedRegion)
    : data.clusters;
  const vectors = data.migration_vectors || [];
  const recs = selectedRegion
    ? data.patrol_recommendations.filter((r) => r.target_infrastructure.includes(selectedRegion))
    : data.patrol_recommendations;
  const pois = selectedRegion
    ? data.financial_pois.filter((p) => p.region === selectedRegion)
    : data.financial_pois;

  return (
    <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 text-white space-y-4">
      {/* HUD Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-red-400 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--saffron)]">
              Predictive Spatial Intelligence
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              DBSCAN Heatmap
            </span>
          </div>
          <h3 className="font-display text-lg font-bold mt-0.5">
            Real-Time Threat Clusters &amp; Velocity Vectors
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-[var(--ink)] p-1 rounded-xl border border-[var(--navy-line)] text-xs font-mono">
          <button
            onClick={() => setActiveTab('clusters')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'clusters' ? 'bg-[var(--saffron)] text-black font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Hotspots ({clusters.length})
          </button>
          <button
            onClick={() => setActiveTab('vectors')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'vectors' ? 'bg-[var(--saffron)] text-black font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Vectors ({vectors.length})
          </button>
          <button
            onClick={() => setActiveTab('patrols')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'patrols' ? 'bg-[var(--saffron)] text-black font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Patrol AI ({recs.length})
          </button>
          <button
            onClick={() => setActiveTab('pois')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'pois' ? 'bg-[var(--saffron)] text-black font-bold' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            ATMs ({pois.length})
          </button>
        </div>
      </div>

      {/* CLUSTERS TAB */}
      {activeTab === 'clusters' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {clusters.map((c) => (
            <div
              key={c.cluster_id}
              className={`p-3.5 rounded-xl border transition-all ${
                c.threat_level === 'critical'
                  ? 'bg-red-950/20 border-red-500/40 text-red-200'
                  : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-[var(--saffron)]">
                    {c.cluster_id} &middot; {c.region}
                  </span>
                  <h4 className="font-semibold text-white text-sm mt-0.5">{c.name}</h4>
                </div>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                    c.threat_level === 'critical'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {c.threat_level}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono my-2.5 pt-2 border-t border-white/10">
                <div>
                  <div className="text-[10px] text-[var(--mist)]">Incidents</div>
                  <div className="font-bold text-white">{c.incident_count} reports</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--mist)]">Radius</div>
                  <div className="font-bold text-white">{c.radius_meters}m</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--mist)]">Density</div>
                  <div className="font-bold text-white">{c.severity_density} pts</div>
                </div>
              </div>

              {c.nearby_atms?.length > 0 && (
                <div className="text-[11px] text-[var(--mist)] flex items-center gap-1.5 truncate">
                  <Building2 size={12} className="shrink-0 text-amber-400" />
                  <span className="truncate">Vulnerable ATMs: {c.nearby_atms.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VECTORS TAB */}
      {activeTab === 'vectors' && (
        <div className="space-y-3">
          {vectors.map((v) => (
            <div
              key={v.cluster_id}
              className="p-3.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[var(--saffron)]">{v.cluster_id}</span>
                  <span
                    className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                      v.trend === 'migrating'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : v.trend === 'expanding'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {v.trend === 'migrating' ? '↗ Migrating' : v.trend === 'expanding' ? '↑ Expanding' : '↓ Dissipating'}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-[var(--mist)] flex items-center gap-2">
                  <span>
                    Heading: <strong className="text-white">{v.heading_cardinal} ({v.heading_degrees}°)</strong>
                  </span>
                  <span>&middot;</span>
                  <span>
                    Velocity: <strong className="text-white">{v.velocity_km_per_day} km/day</strong>
                  </span>
                </div>
              </div>

              <p className="text-white/80">{v.risk_narrative}</p>

              <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-[var(--mist)] border-t border-white/5">
                <span>
                  Target Perimeter:{' '}
                  <strong className="text-indigo-300">{v.target_region} ({v.target_service_area_id})</strong>
                </span>
                <span>Growth Rate: <strong className={v.growth_rate_pct > 0 ? 'text-red-400' : 'text-emerald-400'}>{v.growth_rate_pct}%</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PATROLS TAB */}
      {activeTab === 'patrols' && (
        <div className="space-y-3">
          {recs.map((rec) => (
            <div
              key={rec.recommendation_id}
              className="p-3.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] hover:border-indigo-500/40 text-xs space-y-2.5 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className="text-[var(--saffron)]" />
                  <span className="font-mono font-bold text-white">{rec.recommendation_id}</span>
                  <span className="font-semibold text-white/90">{rec.waypoint_name}</span>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                    rec.suggested_priority === 'urgent_deterrence'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {rec.suggested_priority.replace('_', ' ')}
                </span>
              </div>

              <div className="text-[11px] text-[var(--mist)] font-mono">
                Intercept GPS: <span className="text-white">{rec.lat}°N, {rec.lng}°E</span> &middot; Assigned Team:{' '}
                <span className="text-indigo-300 font-bold">{rec.assigned_team_code}</span> (Unit {rec.suggested_unit_code})
              </div>

              <div className="bg-black/30 p-2.5 rounded-lg space-y-1">
                <div className="font-mono text-[10px] uppercase text-[var(--saffron)] font-bold">Tactical Deterrence Checklist:</div>
                <ul className="space-y-0.5 text-[11px] text-white/80">
                  {rec.action_checklist?.map((action, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => onSelectWaypoint(rec)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  Focus On Tactical Map <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POIS TAB */}
      {activeTab === 'pois' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {pois.map((poi) => (
            <div
              key={poi.id}
              className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{poi.name}</span>
                <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-800 text-amber-300">
                  {poi.poi_type.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] text-[var(--mist)]">
                Institution: <span className="text-white">{poi.bank_name}</span> &middot; Region: {poi.region}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                <span className="text-[var(--mist)]">GPS: {poi.lat}°N, {poi.lng}°E</span>
                <span className="text-red-400 font-bold">Risk: {Math.round(poi.vulnerability_score * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
