import { useState, useEffect } from 'react';
import {
  Radio,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  RefreshCw,
  Lock,
  ExternalLink,
  MapPin,
  Check,
  Filter,
  Users,
  Compass,
  FileCheck,
  Sliders,
  Eye,
  Megaphone,
} from 'lucide-react';

import {
  fetchThreatClustersApi,
  fetchMicroAdvisoriesApi,
  commanderSignoffApi,
  queryPortalMeshBannerApi,
  fetchThreatMeshStatsApi,
} from '../api';

import {
  SERVICE_AREAS_REGISTRY,
  SCAM_DEFINITIONS,
  ingestReportLocally,
} from '../regionalThreatMeshStore';

export default function RegionalThreatMeshView() {
  // Data state
  const [clusters, setClusters] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [stats, setStats] = useState({
    total_active_clusters: 0,
    drafted_pending_signoff: 0,
    published_active_advisories: 0,
    covered_pincodes_count: 0,
    total_reports_aggregated: 0,
  });

  // Selected advisory & commander sign-off
  const [selectedAdvisoryId, setSelectedAdvisoryId] = useState(null);
  const [commanderBadge, setCommanderBadge] = useState('CMD-DELHI-NORTH');
  const [commanderName, setCommanderName] = useState('DCP Vikram Malhotra');
  const [signingOff, setSigningOff] = useState(false);

  // Portal banner boundary simulator
  const [simPincode, setSimPincode] = useState('110007');
  const [simBanner, setSimBanner] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // New report simulation
  const [simScamCategory, setSimScamCategory] = useState('electricity_bill_scam');
  const [simServiceArea, setSimServiceArea] = useState('SA-NORTH-01');
  const [simReportPincode, setSimReportPincode] = useState('110007');
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [clusterList, advList, statsData] = await Promise.all([
        fetchThreatClustersApi(),
        fetchMicroAdvisoriesApi(),
        fetchThreatMeshStatsApi(),
      ]);
      if (Array.isArray(clusterList)) setClusters(clusterList);
      if (Array.isArray(advList)) {
        setAdvisories(advList);
        if (advList.length && !selectedAdvisoryId) {
          setSelectedAdvisoryId(advList[0].advisory_id);
        }
      }
      if (statsData) setStats(statsData);

      // Run initial simulator test
      runBannerSimulation('110007');
    } catch (e) {
      console.warn('Failed to load threat mesh data:', e);
    }
  }

  async function handleCommanderSignoff(advisoryId, action) {
    setSigningOff(true);
    try {
      await commanderSignoffApi(advisoryId, {
        commander_badge_id: commanderBadge,
        commander_name: commanderName,
        action,
        notes: action === 'approve_publish' ? 'Approved for citizen portal broadcast.' : 'Dismissed by commander.',
      });
      await loadData();
      if (simPincode) runBannerSimulation(simPincode);
    } catch (e) {
      console.error('Sign-off error:', e);
    } finally {
      setSigningOff(false);
    }
  }

  async function runBannerSimulation(pincodeToTest) {
    setSimLoading(true);
    try {
      const banner = await queryPortalMeshBannerApi({ pincode: pincodeToTest.trim() });
      setSimBanner(banner);
    } catch (e) {
      console.error('Banner simulation failed:', e);
    } finally {
      setSimLoading(false);
    }
  }

  function handleSimulateReport() {
    setIngesting(true);
    setIngestSuccess(null);
    try {
      const result = ingestReportLocally({
        pincode: simReportPincode,
        scam_category: simScamCategory,
        service_area_id: simServiceArea,
      });
      setIngestSuccess(
        result.advisory
          ? `Report ${result.anon_ref} logged! 3+ threshold reached -> New draft advisory created!`
          : `Report ${result.anon_ref} logged. Threshold not yet reached (needs 3 complaints within 24h).`
      );
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIngesting(false);
    }
  }

  const selectedAdv = advisories.find((a) => a.advisory_id === selectedAdvisoryId) || advisories[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-purple-800/40 rounded-xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-lg text-purple-300">
                <Radio className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Regional Threat Broadcast & Micro-Advisory Mesh
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    Spatial Geofencing
                  </span>
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  Aggregates verified citizen reports by postal pin code & police station circle.
                  Auto-drafts localized micro-advisories when 3+ complaints occur within 24h, requiring commander single-click sign-off.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <span className="text-slate-400">Active Clusters:</span>
              <span className="font-bold text-white">{stats.total_active_clusters}</span>
            </div>
            <div className="bg-amber-950/50 border border-amber-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300">Pending Sign-off:</span>
              <span className="font-bold text-amber-200">{stats.drafted_pending_signoff}</span>
            </div>
            <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300">Published Active:</span>
              <span className="font-bold text-emerald-200">{stats.published_active_advisories}</span>
            </div>
            <div className="bg-blue-950/50 border border-blue-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300">Target Pin Codes:</span>
              <span className="font-bold text-blue-200">{stats.covered_pincodes_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Threat Clusters Cards (3+ complaints within 24h) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-purple-500" />
            Active Regional Threat Clusters (3+ Complaints / 24-Hour Window)
          </label>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Privacy Guarantee: Zero PII or individual loss figures retained
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {clusters.map((c) => (
            <div
              key={c.cluster_id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {c.scam_category_label}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-bold">
                  {c.complaint_count} Complaints ({c.window_hours}h)
                </span>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div>Circle: <strong>{c.police_station_circle}</strong></div>
                <div>Service Area: <span>{c.service_area_name}</span></div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {c.postal_pincodes.map((pin) => (
                    <span
                      key={pin}
                      className="px-1.5 py-0.2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono"
                    >
                      {pin}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <Lock className="w-3 h-3" />
                <span>{c.privacy_guarantee}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commander Single-Click Sign-Off Console & Micro-Advisory Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Advisory List & Selection */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-purple-500" />
            Localized Micro-Advisories ({advisories.length})
          </h2>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {advisories.map((adv) => {
              const isSelected = selectedAdv?.advisory_id === adv.advisory_id;
              const isPending = adv.status === 'DRAFTED_PENDING_APPROVAL';
              return (
                <button
                  key={adv.advisory_id}
                  type="button"
                  onClick={() => setSelectedAdvisoryId(adv.advisory_id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-500 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {adv.service_area_name.replace(' Cyber Command', '')}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {isPending ? 'Pending Sign-off' : 'Published Active'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                    {adv.title}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <span>{adv.complaints_aggregated} complaints ({adv.window_hours}h)</span>
                    <span>Pincodes: {adv.target_pincodes.slice(0, 2).join(', ')}...</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Advisory Sign-off Console */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          {selectedAdv ? (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedAdv.status === 'DRAFTED_PENDING_APPROVAL'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {selectedAdv.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {selectedAdv.advisory_id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedAdv.title}
                  </h3>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 sm:text-right">
                  <div>Circle: <strong>{selectedAdv.police_station_circle}</strong></div>
                  <div>Geofence: <strong>{selectedAdv.geofence_radius_km} km radius</strong></div>
                </div>
              </div>

              {/* Guidance & Modus Operandi */}
              <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Synthesized Plain Language Advisory:
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedAdv.summary_guidance}
                </p>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="font-semibold text-slate-900 dark:text-white mb-1.5">
                    Citizen Action Checklist:
                  </div>
                  <ul className="space-y-1">
                    {selectedAdv.action_checklist.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Commander Sign-Off Console */}
              <div className="mt-4 p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Commander Single-Click Sign-Off Guardrail
                  </span>
                  {selectedAdv.approved_by_commander_name && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Authorized by: {selectedAdv.approved_by_commander_name} ({selectedAdv.approved_by_commander_badge})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Authorizing Commander Name</label>
                    <input
                      type="text"
                      value={commanderName}
                      onChange={(e) => setCommanderName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Commander Badge ID</label>
                    <input
                      type="text"
                      value={commanderBadge}
                      onChange={(e) => setCommanderBadge(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCommanderSignoff(selectedAdv.advisory_id, 'approve_publish')}
                    disabled={signingOff || selectedAdv.status === 'PUBLISHED_ACTIVE'}
                    className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {selectedAdv.status === 'PUBLISHED_ACTIVE'
                      ? 'Published & Live on Citizen Portal'
                      : 'Approve & Publish to Citizen Portal Banner (Single-Click)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCommanderSignoff(selectedAdv.advisory_id, 'dismiss')}
                    disabled={signingOff}
                    className="py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">Select an advisory draft to review.</div>
          )}
        </div>
      </div>

      {/* Interactive Geofenced Citizen Portal Banner Simulator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-500" />
              Interactive Geofenced Citizen Portal Banner Simulator
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tests strict jurisdiction boundary filtering. Alerts are displayed ONLY when the citizen is inside the affected geofence,
              and strictly withheld outside the boundary.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Test Pin Code:</span>
            <input
              type="text"
              value={simPincode}
              onChange={(e) => {
                setSimPincode(e.target.value);
                runBannerSimulation(e.target.value);
              }}
              placeholder="e.g. 110007 or 400001"
              className="w-28 px-2.5 py-1.5 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => runBannerSimulation(simPincode)}
              disabled={simLoading}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 text-xs"
            >
              Test Geofence
            </button>
          </div>
        </div>

        {/* Quick test buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Quick Test Locations:</span>
          <button
            type="button"
            onClick={() => {
              setSimPincode('110007');
              runBannerSimulation('110007');
            }}
            className="px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono"
          >
            110007 (North Delhi - Civil Lines) [Inside]
          </button>
          <button
            type="button"
            onClick={() => {
              setSimPincode('110017');
              runBannerSimulation('110017');
            }}
            className="px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono"
          >
            110017 (South Delhi - Saket) [Inside]
          </button>
          <button
            type="button"
            onClick={() => {
              setSimPincode('400001');
              runBannerSimulation('400001');
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono"
          >
            400001 (Mumbai Fort) [Outside Boundary]
          </button>
          <button
            type="button"
            onClick={() => {
              setSimPincode('560001');
              runBannerSimulation('560001');
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono"
          >
            560001 (Bengaluru MG Road) [Outside Boundary]
          </button>
        </div>

        {/* Simulator Output Display */}
        <div className="mt-3">
          {simBanner ? (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {simBanner.title}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-600 text-white">
                    Active Geofenced Advisory
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  {simBanner.banner_text}
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  Jurisdiction Circle: <strong>{simBanner.police_station_circle}</strong> ({simBanner.service_area_name}) |
                  Target Pincodes: {simBanner.matched_pincodes.join(', ')}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong>Boundary Restricted:</strong> No active micro-advisory targeted to pin code {simPincode}.
                Advisories are strictly withheld outside affected boundaries to prevent panic and alarm fatigue.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Simulator: Inject Citizen Complaint to test 3+ Threshold */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-500" />
          Test Mesh Cluster Trigger (Simulate Incoming Verified Report)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">Service Area</label>
            <select
              value={simServiceArea}
              onChange={(e) => setSimServiceArea(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {Object.values(SERVICE_AREAS_REGISTRY).map((sa) => (
                <option key={sa.service_area_id} value={sa.service_area_id}>
                  {sa.service_area_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Scam Category</label>
            <select
              value={simScamCategory}
              onChange={(e) => setSimScamCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {Object.entries(SCAM_DEFINITIONS).map(([cat, def]) => (
                <option key={cat} value={cat}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Postal Pin Code</label>
            <input
              type="text"
              value={simReportPincode}
              onChange={(e) => setSimReportPincode(e.target.value)}
              placeholder="e.g. 110007"
              className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSimulateReport}
              disabled={ingesting}
              className="w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
            >
              {ingesting ? 'Ingesting...' : 'Ingest Verified Complaint'}
            </button>
          </div>
        </div>

        {ingestSuccess && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
            {ingestSuccess}
          </div>
        )}
      </div>
    </div>
  );
}

