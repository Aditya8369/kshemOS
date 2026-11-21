import { useState, useEffect, useRef } from 'react';
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
  PenTool,
  RotateCcw,
  Maximize2,
  Layers,
  Sparkles,
  Target,
} from 'lucide-react';

import {
  fetchThreatClustersApi,
  fetchMicroAdvisoriesApi,
  commanderSignoffApi,
  createBroadcastAdvisoryApi,
  queryPortalMeshBannerApi,
  fetchThreatMeshStatsApi,
} from '../api';

import {
  SERVICE_AREAS_REGISTRY,
  SCAM_DEFINITIONS,
  ingestReportLocally,
} from '../regionalThreatMeshStore';

import {
  PIN_CENTROIDS,
  STATION_CIRCLES,
  matchPolygonToJurisdictions,
  validatePolygonVertices,
  booleanPointInPolygon,
} from '../spatialPolygonMatcher';

const MAP_CONFIG = {
  minLat: 28.50,
  maxLat: 28.73,
  minLng: 77.09,
  maxLng: 77.29,
  width: 760,
  height: 440,
};

function project(lat, lng) {
  const x = ((lng - MAP_CONFIG.minLng) / (MAP_CONFIG.maxLng - MAP_CONFIG.minLng)) * MAP_CONFIG.width;
  const y = ((MAP_CONFIG.maxLat - lat) / (MAP_CONFIG.maxLat - MAP_CONFIG.minLat)) * MAP_CONFIG.height;
  return {
    x: Math.max(15, Math.min(MAP_CONFIG.width - 15, x)),
    y: Math.max(15, Math.min(MAP_CONFIG.height - 15, y)),
  };
}

function unproject(x, y) {
  const lng = MAP_CONFIG.minLng + (x / MAP_CONFIG.width) * (MAP_CONFIG.maxLng - MAP_CONFIG.minLng);
  const lat = MAP_CONFIG.maxLat - (y / MAP_CONFIG.height) * (MAP_CONFIG.maxLat - MAP_CONFIG.minLat);
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

const PRESET_GEOMETRIES = {
  north_central: {
    name: 'North-Central Corridor (4 Sectors / 2 Circles)',
    points: [
      { lat: 28.718, lng: 77.185 },
      { lat: 28.712, lng: 77.245 },
      { lat: 28.625, lng: 77.248 },
      { lat: 28.628, lng: 77.180 },
    ],
  },
  south_tech: {
    name: 'South Financial & Tech Ring',
    points: [
      { lat: 28.555, lng: 77.195 },
      { lat: 28.555, lng: 77.265 },
      { lat: 28.515, lng: 77.265 },
      { lat: 28.515, lng: 77.195 },
    ],
  },
  west_district: {
    name: 'West Commercial Hub',
    points: [
      { lat: 28.685, lng: 77.110 },
      { lat: 28.685, lng: 77.155 },
      { lat: 28.640, lng: 77.155 },
      { lat: 28.640, lng: 77.110 },
    ],
  },
  quad_metro: {
    name: 'All Metropolitan Hubs',
    points: [
      { lat: 28.720, lng: 77.100 },
      { lat: 28.720, lng: 77.280 },
      { lat: 28.510, lng: 77.280 },
      { lat: 28.510, lng: 77.100 },
    ],
  },
};

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

  // Interactive Dynamic Geofence Polygon Builder state
  const svgRef = useRef(null);
  const [drawingMode, setDrawingMode] = useState('polygon'); // 'polygon' | 'freehand'
  const [polygonPoints, setPolygonPoints] = useState(PRESET_GEOMETRIES.north_central.points);
  const [isPolygonClosed, setIsPolygonClosed] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState('north_central');
  const [spatialMatch, setSpatialMatch] = useState(() =>
    matchPolygonToJurisdictions(PRESET_GEOMETRIES.north_central.points)
  );

  // Multi-Zone Advisory Broadcast Drafting
  const [draftTitle, setDraftTitle] = useState(
    'Notice: Fake electricity bill payment SMS active in North/Central corridor.'
  );
  const [draftGuidance, setDraftGuidance] = useState(
    'Coordinated cyber fraud detected across dynamic geofenced jurisdiction boundary. Citizens must verify all electricity disconnection notices directly via official DISCOM app or helpline 19122 / 1930.'
  );
  const [draftScamCategory, setDraftScamCategory] = useState('electricity_bill_scam');
  const [draftUrgency, setDraftUrgency] = useState('high');
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // Recalculate Point-in-Polygon intersections whenever polygon vertices change
  useEffect(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      const match = matchPolygonToJurisdictions(polygonPoints);
      setSpatialMatch(match);
      if (match.postal_sector_count > 0) {
        setDraftTitle(
          `Notice: Cyber Threat Alert across ${match.postal_sector_count} postal sectors in ${
            match.matched_circles[0] || 'Metropolitan Area'
          }.`
        );
      }
    } else {
      setSpatialMatch(null);
    }
  }, [polygonPoints]);

  function getSvgCoordinates(e) {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (MAP_CONFIG.width / rect.width);
    const y = (clientY - rect.top) * (MAP_CONFIG.height / rect.height);
    return {
      x: Math.max(0, Math.min(MAP_CONFIG.width, x)),
      y: Math.max(0, Math.min(MAP_CONFIG.height, y)),
    };
  }

  function handleCanvasClick(e) {
    if (drawingMode !== 'polygon') return;
    const coords = getSvgCoordinates(e);
    if (!coords) return;
    const pt = unproject(coords.x, coords.y);

    if (isPolygonClosed) {
      // Start a fresh custom boundary
      setPolygonPoints([pt]);
      setIsPolygonClosed(false);
      setSelectedPresetKey(null);
      setDraftFeedback(null);
      return;
    }

    // Check if clicked close to initial vertex to complete polygon
    if (polygonPoints.length >= 3) {
      const first = polygonPoints[0];
      const firstSvg = project(first.lat, first.lng);
      const dist = Math.hypot(firstSvg.x - coords.x, firstSvg.y - coords.y);
      if (dist < 20) {
        setIsPolygonClosed(true);
        return;
      }
    }

    if (polygonPoints.length < 500) {
      setPolygonPoints((prev) => [...prev, pt]);
    }
  }

  function handleCanvasMouseDown(e) {
    if (drawingMode !== 'freehand') return;
    const coords = getSvgCoordinates(e);
    if (!coords) return;
    const pt = unproject(coords.x, coords.y);
    setIsDrawing(true);
    setIsPolygonClosed(false);
    setSelectedPresetKey(null);
    setPolygonPoints([pt]);
    setDraftFeedback(null);
  }

  function handleCanvasMouseMove(e) {
    const coords = getSvgCoordinates(e);
    if (!coords) return;
    const geo = unproject(coords.x, coords.y);
    setMousePos({ ...coords, ...geo });

    if (drawingMode === 'freehand' && isDrawing) {
      setPolygonPoints((prev) => {
        if (!prev.length) return [geo];
        const last = prev[prev.length - 1];
        const lastSvg = project(last.lat, last.lng);
        // Throttle vertices distance >= 12px to stay well within 500 vertex limit
        if (Math.hypot(lastSvg.x - coords.x, lastSvg.y - coords.y) >= 12) {
          if (prev.length < 480) {
            return [...prev, geo];
          }
        }
        return prev;
      });
    }
  }

  function handleCanvasMouseUp() {
    if (drawingMode === 'freehand' && isDrawing) {
      setIsDrawing(false);
      if (polygonPoints.length >= 3) {
        setIsPolygonClosed(true);
      }
    }
  }

  function handleClosePolygon() {
    if (polygonPoints.length >= 3) {
      setIsPolygonClosed(true);
    }
  }

  function handleClearPolygon() {
    setPolygonPoints([]);
    setIsPolygonClosed(false);
    setSpatialMatch(null);
    setSelectedPresetKey(null);
    setDraftFeedback(null);
  }

  function handleApplyPreset(key) {
    if (PRESET_GEOMETRIES[key]) {
      setPolygonPoints(PRESET_GEOMETRIES[key].points);
      setIsPolygonClosed(true);
      setSelectedPresetKey(key);
      setDraftFeedback(null);
    }
  }

  async function handleDraftAdvisorySubmit(e) {
    e.preventDefault();
    if (!polygonPoints || polygonPoints.length < 3) {
      setDraftFeedback({
        type: 'error',
        message: 'Please sketch or select a geofence polygon with at least 3 vertices first.',
      });
      return;
    }

    const validation = validatePolygonVertices(polygonPoints);
    if (!validation.valid) {
      setDraftFeedback({ type: 'error', message: validation.error });
      return;
    }

    setSubmittingDraft(true);
    setDraftFeedback(null);
    try {
      const match = spatialMatch || matchPolygonToJurisdictions(polygonPoints);
      const payload = {
        title: draftTitle.trim() || 'Notice: Multi-Zone Cyber Threat Alert',
        summary_guidance:
          draftGuidance.trim() ||
          'Coordinated cyber fraud detected across dynamic geofenced jurisdiction boundary.',
        scam_category: draftScamCategory,
        urgency: draftUrgency,
        polygon_geojson: match.polygon_geojson,
        target_pincodes: match.matched_pincodes,
        police_station_circle: match.matched_circles[0] || 'Delhi Cyber Command',
        service_area_id: match.matched_service_areas[0] || 'SA-NORTH-01',
        estimated_citizen_reach: match.estimated_citizen_reach,
        action_checklist: [
          'Verify all claims through official portals or helpline 1930.',
          'Under Indian law (BNSS), no authority demands fund transfer over phone or video.',
          'Disconnect suspected extortion calls immediately and notify local police desk.',
        ],
        commander_badge_id: commanderBadge,
        commander_name: commanderName,
      };

      const res = await createBroadcastAdvisoryApi(payload);
      setDraftFeedback({
        type: 'success',
        message: `Draft Micro-Advisory ${res.advisory_id} successfully created! ${match.multi_zone_summary}. Available for Commander Sign-off below.`,
      });
      await loadData();
      if (res.advisory_id) setSelectedAdvisoryId(res.advisory_id);
    } catch (err) {
      setDraftFeedback({
        type: 'error',
        message: err.message || 'Failed to submit broadcast advisory.',
      });
    } finally {
      setSubmittingDraft(false);
    }
  }

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

      {/* Interactive Dynamic Geofence Polygon Builder for Micro-Advisories */}
      <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-xl p-5 shadow-sm space-y-4">
        {/* Header & Tool Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-400/30">
                <PenTool className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Interactive Dynamic Geofence Polygon Builder
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-700 uppercase">
                  Spatial Engine
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sketch freehand boundaries or click polygon vertices directly over the jurisdiction heat map. Intersects with station circles and PIN centroids to draft multi-zone micro-advisories.
            </p>
          </div>

          {/* Canvas Drawing Controls & Mode Switch */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDrawingMode('polygon')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                  drawingMode === 'polygon'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Polygon (Click)</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawingMode('freehand')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                  drawingMode === 'freehand'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Freehand (Drag)</span>
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleApplyPreset('north_central')}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  selectedPresetKey === 'north_central'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                North-Central
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('south_tech')}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  selectedPresetKey === 'south_tech'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                South Tech
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('west_district')}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  selectedPresetKey === 'west_district'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                West Hub
              </button>
            </div>

            {/* Complete & Clear actions */}
            {!isPolygonClosed && polygonPoints.length >= 3 && (
              <button
                type="button"
                onClick={handleClosePolygon}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all"
              >
                Complete Boundary
              </button>
            )}
            <button
              type="button"
              onClick={handleClearPolygon}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-300 transition-all flex items-center gap-1"
              title="Clear sketched polygon"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Dynamic Multi-Zone Summary Banner (Auto-populated reach) */}
        {spatialMatch && (
          <div className="p-3.5 rounded-xl border border-purple-500/50 bg-gradient-to-r from-purple-950/40 via-slate-900 to-purple-950/30 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg text-purple-300 shrink-0">
                <Compass className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-purple-300 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Spatial Point-in-Polygon Engine · Live Intersection
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {spatialMatch.multi_zone_summary}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-400/40 text-purple-200">
                {polygonPoints.length} Vertices
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-900/60 border border-blue-400/40 text-blue-200">
                {spatialMatch.postal_sector_count} Sectors
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-400/40 text-emerald-200">
                {spatialMatch.police_circle_count} Police Circles
              </span>
            </div>
          </div>
        )}

        {/* 2-Column Layout: Tactical GIS Canvas + Multi-Zone Advisory Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Canvas (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 p-2 shadow-inner relative overflow-hidden flex flex-col">
            {/* Canvas Header Overlay */}
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono text-slate-400 border-b border-slate-800/80 mb-1 z-10">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Delhi-NCR Metropolitan Threat Grid (28.50°N - 28.73°N)
              </span>
              <span>
                {mousePos ? `Lat: ${mousePos.lat.toFixed(4)}°N, Lng: ${mousePos.lng.toFixed(4)}°E` : 'Hover to inspect'}
              </span>
            </div>

            {/* Interactive SVG Drawing Viewport */}
            <div className="relative w-full aspect-[760/440] bg-slate-950 select-none cursor-crosshair">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${MAP_CONFIG.width} ${MAP_CONFIG.height}`}
                className="w-full h-full"
                onClick={handleCanvasClick}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onTouchStart={handleCanvasMouseDown}
                onTouchMove={handleCanvasMouseMove}
                onTouchEnd={handleCanvasMouseUp}
              >
                <defs>
                  {/* Heat Map Radial Gradient */}
                  <radialGradient id="heatGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#f97316" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                  </radialGradient>
                  {/* Subtle Grid Pattern */}
                  <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,2" />
                  </pattern>
                </defs>

                {/* Grid Background */}
                <rect width={MAP_CONFIG.width} height={MAP_CONFIG.height} fill="#090d16" />
                <rect width={MAP_CONFIG.width} height={MAP_CONFIG.height} fill="url(#gridPattern)" />

                {/* Coordinate Grid Axes & Labels */}
                <line x1="0" y1="110" x2={MAP_CONFIG.width} y2="110" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="220" x2={MAP_CONFIG.width} y2="220" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="330" x2={MAP_CONFIG.width} y2="330" stroke="#1e293b" strokeWidth="1" />
                <line x1="190" y1="0" x2="190" y2={MAP_CONFIG.height} stroke="#1e293b" strokeWidth="1" />
                <line x1="380" y1="0" x2="380" y2={MAP_CONFIG.height} stroke="#1e293b" strokeWidth="1" />
                <line x1="570" y1="0" x2="570" y2={MAP_CONFIG.height} stroke="#1e293b" strokeWidth="1" />

                <text x="10" y="105" fill="#475569" fontSize="9" fontFamily="monospace">28.67°N (Tis Hazari)</text>
                <text x="10" y="215" fill="#475569" fontSize="9" fontFamily="monospace">28.62°N (Central Desk)</text>
                <text x="10" y="325" fill="#475569" fontSize="9" fontFamily="monospace">28.56°N (Saket Unit)</text>

                {/* Active Threat Cluster Hotspots (Heat Map) */}
                {clusters.map((c, i) => {
                  const sa = SERVICE_AREAS_REGISTRY[c.service_area_id];
                  if (!sa) return null;
                  const center = project(sa.geofence_center.lat, sa.geofence_center.lng);
                  return (
                    <g key={c.cluster_id || i}>
                      <circle
                        cx={center.x}
                        cy={center.y}
                        r="60"
                        fill="url(#heatGradient)"
                        opacity="0.38"
                      />
                      <circle
                        cx={center.x}
                        cy={center.y}
                        r="25"
                        fill="url(#heatGradient)"
                        opacity="0.6"
                      />
                    </g>
                  );
                })}

                {/* Police Station Circles with Radius Boundary Rings */}
                {STATION_CIRCLES.map((st) => {
                  const pt = project(st.lat, st.lng);
                  const rPx = st.radius_km * 7.2;
                  const isIntersected = spatialMatch?.matched_circles?.includes(st.circle_name);
                  return (
                    <g key={st.circle_name}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={rPx}
                        fill="none"
                        stroke={isIntersected ? '#38bdf8' : '#334155'}
                        strokeWidth={isIntersected ? '1.5' : '1'}
                        strokeDasharray="4,4"
                        opacity={isIntersected ? '0.75' : '0.35'}
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5.5"
                        fill={isIntersected ? '#0284c7' : '#475569'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        textAnchor="middle"
                        fill={isIntersected ? '#7dd3fc' : '#64748b'}
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                        className="select-none pointer-events-none"
                      >
                        {st.service_area_name.replace(' Cyber Command', '').replace(' Cyber Cell', '')}
                      </text>
                    </g>
                  );
                })}

                {/* Postal PIN Centroids & Badges */}
                {PIN_CENTROIDS.map((pin) => {
                  const pt = project(pin.lat, pin.lng);
                  const isInside = spatialMatch?.matched_pincodes?.includes(pin.pincode);
                  return (
                    <g key={pin.pincode}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isInside ? '6' : '3.5'}
                        fill={isInside ? '#a855f7' : '#475569'}
                        stroke={isInside ? '#ffffff' : '#1e293b'}
                        strokeWidth="1.5"
                        className={isInside ? 'filter drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]' : ''}
                      />
                      <text
                        x={pt.x}
                        y={pt.y + 13}
                        textAnchor="middle"
                        fill={isInside ? '#e9d5ff' : '#64748b'}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight={isInside ? 'bold' : 'normal'}
                        className="select-none pointer-events-none"
                      >
                        {pin.pincode}
                      </text>
                    </g>
                  );
                })}

                {/* Drawn Geofence Polygon */}
                {polygonPoints && polygonPoints.length >= 2 && (
                  <>
                    <polygon
                      points={polygonPoints
                        .map((p) => {
                          const pt = project(p.lat, p.lng);
                          return `${pt.x},${pt.y}`;
                        })
                        .join(' ')}
                      fill={isPolygonClosed ? 'rgba(168, 85, 247, 0.24)' : 'rgba(168, 85, 247, 0.08)'}
                      stroke="#c084fc"
                      strokeWidth="2.5"
                      strokeDasharray={isPolygonClosed ? 'none' : '5,4'}
                      className="filter drop-shadow-[0_0_10px_rgba(192,132,252,0.4)]"
                    />

                    {/* Polygon Vertices */}
                    {polygonPoints.map((p, idx) => {
                      const pt = project(p.lat, p.lng);
                      const isFirst = idx === 0 && !isPolygonClosed && polygonPoints.length >= 3;
                      return (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={isFirst ? '6.5' : '4'}
                          fill={isFirst ? '#22c55e' : '#ffffff'}
                          stroke="#9333ea"
                          strokeWidth="2"
                          className={isFirst ? 'animate-bounce cursor-pointer' : ''}
                        />
                      );
                    })}

                    {/* Active Dragging or Cursor Trailing Guide */}
                    {!isPolygonClosed && mousePos && polygonPoints.length > 0 && (
                      <line
                        x1={project(polygonPoints[polygonPoints.length - 1].lat, polygonPoints[polygonPoints.length - 1].lng).x}
                        y1={project(polygonPoints[polygonPoints.length - 1].lat, polygonPoints[polygonPoints.length - 1].lng).y}
                        x2={mousePos.x}
                        y2={mousePos.y}
                        stroke="#c084fc"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                    )}
                  </>
                )}
              </svg>

              {/* Instructions Pill */}
              <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-900/90 border border-slate-700/80 rounded-md text-[10px] text-slate-300 font-mono flex items-center gap-1.5">
                <Target className="w-3 h-3 text-purple-400" />
                <span>
                  {drawingMode === 'polygon'
                    ? isPolygonClosed
                      ? 'Click canvas to start new polygon'
                      : 'Click to add vertex · Click green initial point to close'
                    : 'Click & drag cursor across map to sketch custom boundary'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Spatial Match Breakdown & Multi-Zone Advisory Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Draft Multi-Zone Micro-Advisory</span>
                <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400">
                  {spatialMatch?.postal_sector_count || 0} Sectors Intersected
                </span>
              </h3>

              {/* Form Inputs */}
              <form onSubmit={handleDraftAdvisorySubmit} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Advisory Headline Title
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Headline title for citizen broadcast"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Threat Scam Category
                    </label>
                    <select
                      value={draftScamCategory}
                      onChange={(e) => setDraftScamCategory(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                    >
                      {Object.entries(SCAM_DEFINITIONS).map(([cat, def]) => (
                        <option key={cat} value={cat}>
                          {def.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Urgency Level
                    </label>
                    <select
                      value={draftUrgency}
                      onChange={(e) => setDraftUrgency(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs uppercase font-semibold"
                    >
                      <option value="high">High Urgency</option>
                      <option value="critical">Critical (Immediate)</option>
                      <option value="medium">Medium Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plain-Language Citizen Guidance
                  </label>
                  <textarea
                    rows={3}
                    value={draftGuidance}
                    onChange={(e) => setDraftGuidance(e.target.value)}
                    placeholder="Instructions for citizens inside affected geofence perimeter"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs leading-relaxed"
                    required
                  />
                </div>

                {/* Spatial Intersection Badges */}
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Target Postal PINs:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {spatialMatch?.matched_pincodes?.length
                        ? spatialMatch.matched_pincodes.join(', ')
                        : 'No sectors inside polygon'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Police Circles:</span>
                    <span className="text-slate-900 dark:text-slate-200 truncate max-w-[200px]">
                      {spatialMatch?.matched_circles?.join(', ') || 'None'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Est. Citizen Population:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {spatialMatch ? spatialMatch.estimated_citizen_reach.toLocaleString('en-IN') : 0} citizens
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingDraft || !polygonPoints || polygonPoints.length < 3}
                  className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingDraft ? 'Drafting Advisory...' : 'Draft Multi-Zone Micro-Advisory'}
                </button>
              </form>

              {draftFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                    draftFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  {draftFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{draftFeedback.message}</span>
                </div>
              )}
            </div>
          </div>
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

