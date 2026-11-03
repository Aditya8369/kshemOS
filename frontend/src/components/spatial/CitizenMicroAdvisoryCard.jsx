import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Compass,
  Radio,
  PhoneCall,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import {
  fetchCitizenMicroAdvisoryApi,
  CITIZEN_LOCATION_PRESETS,
} from '../../api.js';

export default function CitizenMicroAdvisoryCard() {
  const [selectedLocation, setSelectedLocation] = useState(CITIZEN_LOCATION_PRESETS[0]);
  const [advisory, setAdvisory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetchCitizenMicroAdvisoryApi(selectedLocation.lat, selectedLocation.lng);
        if (mounted) setAdvisory(res);
      } catch (err) {
        console.error('Failed to load micro-advisory:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedLocation]);

  const threatColor =
    advisory?.threat_level === 'critical'
      ? 'text-red-500 bg-red-500/10 border-red-500/30'
      : advisory?.threat_level === 'high'
      ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
      : advisory?.threat_level === 'moderate'
      ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
      : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';

  return (
    <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--paper-line)] pb-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-1 flex items-center gap-1.5">
            <Radio size={13} className="animate-pulse text-red-500" />
            Predictive Spatial Intelligence &middot; Micro-Advisory
          </div>
          <h2 className="font-display text-xl font-semibold text-[var(--ink)]">
            Neighborhood Threat Radar
          </h2>
          <p className="text-xs text-[var(--ink-text)]/70 mt-0.5">
            Real-time proximity threat scoring based on active digital arrest and fraud clusters around your geolocation.
          </p>
        </div>

        {/* Location Selector */}
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-[var(--saffron)] shrink-0" />
          <select
            value={selectedLocation.id}
            onChange={(e) => {
              const loc = CITIZEN_LOCATION_PRESETS.find((p) => p.id === e.target.value);
              if (loc) setSelectedLocation(loc);
            }}
            className="text-xs rounded-lg border border-[var(--paper-line)] px-3 py-1.5 bg-gray-50 font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
          >
            {CITIZEN_LOCATION_PRESETS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                📍 {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-[var(--ink-text)]/60 font-mono">
          Scanning neighborhood fraud clusters and ATM telemetry…
        </div>
      ) : advisory ? (
        <div className="space-y-4">
          {/* Main Threat Assessment Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              advisory.threat_level === 'critical'
                ? 'bg-red-50 border-red-200'
                : advisory.threat_level === 'high'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {advisory.threat_level === 'critical' ? (
                <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={24} />
              ) : advisory.threat_level === 'high' ? (
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
              ) : (
                <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={24} />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${threatColor}`}>
                    {advisory.threat_level.toUpperCase()} THREAT LEVEL
                  </span>
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {advisory.nearest_cluster_name || 'Normal Perimeter'}
                  </span>
                </div>
                <div className="text-xs text-[var(--ink-text)]/80 mt-1">
                  Proximity: <span className="font-mono font-bold text-[var(--ink)]">{Math.round(advisory.proximity_meters)} meters</span> from active extortion cluster
                  {advisory.migration_trend === 'expanding' && (
                    <span className="ml-2 font-mono text-[11px] text-red-600 font-semibold bg-red-100 px-1.5 py-0.2 rounded">
                      &uarr; Expanding
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Risk Gauge Pill */}
            <div className="flex items-center gap-3 shrink-0 bg-white/80 p-2.5 rounded-xl border border-[var(--paper-line)]">
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase text-[var(--ink-text)]/60">Localized Risk</div>
                <div className="text-xl font-bold font-mono text-[var(--ink)]">
                  {advisory.localized_risk_score}
                  <span className="text-xs text-[var(--ink-text)]/50">/100</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center font-mono font-bold text-xs" style={{
                borderColor: advisory.localized_risk_score > 70 ? '#ef4444' : advisory.localized_risk_score > 40 ? '#f59e0b' : '#10b981',
                color: advisory.localized_risk_score > 70 ? '#ef4444' : advisory.localized_risk_score > 40 ? '#f59e0b' : '#10b981'
              }}>
                {advisory.localized_risk_score}%
              </div>
            </div>
          </div>

          {/* Localized Safety Guidance Checklist */}
          <div className="bg-gray-50 border border-[var(--paper-line)] rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase font-mono text-[var(--ink)] flex items-center gap-1.5">
              <Compass size={14} className="text-[var(--saffron)]" />
              Dynamic Spatial Safety Checklist for This Location
            </h4>
            <ul className="space-y-1.5 text-xs text-[var(--ink-text)]/85">
              {advisory.safety_guidance?.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Safe Precinct Helpline Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--paper)] border border-[var(--paper-line)] text-xs">
            <div className="flex items-center gap-2">
              <Navigation size={15} className="text-[var(--saffron)] shrink-0" />
              <div>
                <span className="text-[var(--ink-text)]/70">Nearest Verified Police Station:</span>
                <span className="font-semibold text-[var(--ink)] ml-1">{advisory.nearest_safe_precinct}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="tel:1930"
                className="inline-flex items-center gap-1 font-mono font-bold px-3 py-1 rounded bg-[var(--saffron)] text-black hover:bg-[var(--saffron)]/90 transition-colors"
              >
                <PhoneCall size={12} />
                Call 1930 Cyber Helpline
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
