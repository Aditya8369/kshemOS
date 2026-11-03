import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Siren,
  ShieldCheck,
  ShieldAlert,
  Send,
  CheckCircle2,
  Clock,
  Radio,
  Users,
  Building2,
  Store,
  MapPin,
  MessageSquare,
  Smartphone,
  Bell,
  Globe,
  RefreshCw,
  Plus,
  Compass,
  FileText,
  Lock,
  Eye,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import {
  fetchAdvisoriesApi,
  createBroadcastApi,
  authorizeBroadcastApi,
  dispatchBroadcastApi,
  advanceTelemetryApi,
  estimateAudienceApi,
  fetchAdvisoryTemplatesApi,
  SERVICE_AREAS_DEMOGRAPHICS,
  EMERGENCY_TEMPLATES,
  BROADCAST_CHANGED_EVENT,
} from '../api.js';

const SEVERITY_BADGES = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

const STATUS_BADGES = {
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  approved: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  pending_second_authorization: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  pending_approval: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

export default function PublicAdvisoryComposer() {
  const [advisories, setAdvisories] = useState([]);
  const [selectedAdvisory, setSelectedAdvisory] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [channelPreviewTab, setChannelPreviewTab] = useState('sms');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'critical',
    target_audience: 'citizens',
    template_type: null,
  });

  // Targeting State
  const [targetingType, setTargetingType] = useState('service_area');
  const [selectedServiceAreaId, setSelectedServiceAreaId] = useState('SA-CENTRAL-01');
  const [customCenterLat, setCustomCenterLat] = useState(28.6139);
  const [customCenterLng, setCustomCenterLng] = useState(77.2090);
  const [customRadiusKm, setCustomRadiusKm] = useState(4.5);
  const [estimatedAudience, setEstimatedAudience] = useState(null);

  // Channels State
  const [channels, setChannels] = useState({
    sms_gateway: true,
    whatsapp_emergency: true,
    push_notifications: true,
    portal_header_banner: true,
  });

  // Second Authorizer Sign-Off Input
  const [secondAuthOfficer, setSecondAuthOfficer] = useState({
    badge: 'BADGE-DCP-402',
    name: 'Deputy Commissioner Ananya Sen',
    role: 'Joint Director, Cyber Public Safety',
    notes: 'Reviewed operational radius, senior centers, and channel distribution. Cleared for siren broadcast.',
  });

  const [notification, setNotification] = useState(null);

  async function loadData() {
    try {
      const items = await fetchAdvisoriesApi();
      setAdvisories(items);
      if (items.length > 0 && !selectedAdvisory) {
        setSelectedAdvisory(items[0]);
      } else if (selectedAdvisory) {
        const found = items.find((i) => i.id === selectedAdvisory.id);
        if (found) setSelectedAdvisory(found);
      }
    } catch (err) {
      console.error('Failed to load advisories:', err);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener(BROADCAST_CHANGED_EVENT, loadData);
    return () => {
      window.removeEventListener(BROADCAST_CHANGED_EVENT, loadData);
    };
  }, []);

  // Recalculate audience estimation when targeting changes
  useEffect(() => {
    let mounted = true;
    async function updateAudience() {
      try {
        const res = await estimateAudienceApi({
          targeting_type: targetingType,
          service_area_id: targetingType === 'service_area' ? selectedServiceAreaId : null,
          center_lat: targetingType === 'custom_perimeter' ? customCenterLat : null,
          center_lng: targetingType === 'custom_perimeter' ? customCenterLng : null,
          radius_km: targetingType === 'custom_perimeter' ? customRadiusKm : null,
        });
        if (mounted) setEstimatedAudience(res);
      } catch (e) {
        console.error('Error estimating audience:', e);
      }
    }
    updateAudience();
    return () => {
      mounted = false;
    };
  }, [targetingType, selectedServiceAreaId, customCenterLat, customCenterLng, customRadiusKm]);

  function handleTemplateSelect(tpl) {
    setFormData({
      title: tpl.title,
      description: tpl.description,
      severity: tpl.severity,
      target_audience: tpl.target_audience,
      template_type: tpl.id,
    });
    setNotification({ type: 'info', text: `Loaded template: "${tpl.name}"` });
  }

  async function handleCreateDraft(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        severity: formData.severity,
        affected_location: estimatedAudience?.region || 'Metropolitan Area',
        target_audience: formData.target_audience,
        template_type: formData.template_type,
        targeting: estimatedAudience,
        channels,
        created_by_badge: 'BADGE-CMD-701',
        created_by_name: 'Commander Rajesh Varma',
      };
      const created = await createBroadcastApi(payload);
      setSelectedAdvisory(created);
      setNotification({
        type: 'success',
        text: `Advisory ${created.id} drafted. Dual-authorization requirement: ${created.dual_auth.requires_dual_auth ? 'Active (Requires 2nd Officer)' : 'Cleared'}.`,
      });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message || 'Failed to create broadcast draft' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSecondAuthorizerSignOff() {
    if (!selectedAdvisory) return;
    setLoading(true);
    try {
      const updated = await authorizeBroadcastApi(selectedAdvisory.id, {
        authorizer_badge: secondAuthOfficer.badge,
        authorizer_name: secondAuthOfficer.name,
        authorizer_role: secondAuthOfficer.role,
        decision: 'approve',
        reviewer_notes: secondAuthOfficer.notes,
      });
      setSelectedAdvisory(updated);
      setNotification({
        type: 'success',
        text: `Dual-Authorization Complete! Signed by ${secondAuthOfficer.name}. Ready for emergency dispatch.`,
      });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message || 'Second authorization failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDispatchSiren() {
    if (!selectedAdvisory) return;
    setLoading(true);
    try {
      const dispatched = await dispatchBroadcastApi(selectedAdvisory.id);
      setSelectedAdvisory(dispatched);
      setNotification({
        type: 'success',
        text: `🚀 Multi-Channel Emergency Siren Dispatched! Confirmed delivery across enabled channels.`,
      });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message || 'Dispatch failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulateFeedback() {
    if (!selectedAdvisory || selectedAdvisory.status !== 'published') return;
    try {
      await advanceTelemetryApi(selectedAdvisory.id, 350);
      setNotification({
        type: 'info',
        text: `Telemetry influx: +350 citizen reads and +14 linked scam reports recorded.`,
      });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message || 'Failed to advance telemetry' });
    }
  }

  // Previews for Channel Adapters
  const smsPreview = useMemo(() => {
    const t = formData.title || selectedAdvisory?.title || 'Emergency Public Alert';
    return `[KSHEM-POLICE ALERT] ${t}. Police never ask for money or video arrest. Dial 1930. kshemos.gov.in`;
  }, [formData.title, selectedAdvisory]);

  const stats = useMemo(() => {
    const published = advisories.filter((a) => a.status === 'published');
    const totalDelivered = published.reduce((acc, a) => acc + (a.telemetry?.delivered || 0), 0);
    const totalLinkedReports = published.reduce((acc, a) => acc + (a.telemetry?.linked_citizen_reports || 0), 0);
    const totalCitizensTargeted = published.reduce((acc, a) => acc + (a.targeting?.estimated_citizens || 0), 0);
    return {
      activeSirens: published.length,
      totalDelivered,
      totalLinkedReports,
      totalCitizensTargeted,
    };
  }, [advisories]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-white font-sans animate-fade-in">
      {/* Top Banner / Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-md ${
            notification.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              : notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-[var(--navy)] border-[var(--saffron)]/40 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === 'error' ? '🚨' : notification.type === 'success' ? '✓' : 'ℹ️'}</span>
            <span className="font-medium">{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] flex items-center gap-1.5 mb-1">
              <Radio size={14} className="animate-pulse text-red-400" />
              <span>Geo-Targeted Multi-Channel Emergency Broadcast Command</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              Emergency Siren & Public Safety Bulletin Console
            </h1>
            <p className="text-xs text-[var(--mist)] mt-0.5 max-w-3xl">
              Reverse-geocode perimeter audience targeting, simultaneous delivery over SMS, WhatsApp, Push & Portal Banner,
              commander dual-authorization guardrail, and real-time acknowledgment telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition flex items-center gap-1.5"
            >
              <Eye size={14} />
              <span>{showPreview ? 'Command Console View' : 'Live Citizen Preview'}</span>
            </button>
          </div>
        </div>

        {/* Live Operational Metrics Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Active Sirens</div>
            <div className="text-2xl font-bold font-display text-red-400 mt-0.5">{stats.activeSirens}</div>
            <div className="text-[10px] text-[var(--mist)]">Published & Broadcastic</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Targeted Footprint</div>
            <div className="text-2xl font-bold font-display text-cyan-300 mt-0.5">
              {stats.totalCitizensTargeted.toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--mist)]">Citizens in Perimeters</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Dispatches Delivered</div>
            <div className="text-2xl font-bold font-display text-emerald-400 mt-0.5">
              {stats.totalDelivered.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400">98.2% avg delivery rate</div>
          </div>

          <div className="bg-[var(--ink)] border border-[var(--navy-line)] p-3 rounded-xl font-mono">
            <div className="text-[10px] text-[var(--mist)] uppercase">Citizen Feedback / Leads</div>
            <div className="text-2xl font-bold font-display text-[var(--saffron)] mt-0.5">
              {stats.totalLinkedReports}
            </div>
            <div className="text-[10px] text-[var(--mist)]">Linked Incident Reports</div>
          </div>
        </div>

        {/* Quick Emergency Template Bar */}
        <div className="pt-2 border-t border-[var(--navy-line)]">
          <div className="text-[11px] font-mono text-[var(--mist)] mb-2 flex items-center gap-1.5">
            <FileText size={12} className="text-[var(--saffron)]" />
            <span>Emergency Broadcast Templates:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EMERGENCY_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleTemplateSelect(tpl)}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--ink)] border border-[var(--navy-line)] hover:border-[var(--saffron)] text-[var(--mist)] hover:text-white transition flex items-center gap-1.5"
              >
                <span>{tpl.severity === 'critical' ? '🚨' : '⚠️'}</span>
                <span>{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!showPreview ? (
        /* Main Two-Column Workflow */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Composer Form & Reverse-Geocoded Targeting (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <form onSubmit={handleCreateDraft} className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <h2 className="font-display font-semibold text-white text-base flex items-center gap-2">
                  <Sliders size={16} className="text-[var(--saffron)]" />
                  <span>Compose Siren Advisory</span>
                </h2>
                <span className="text-[10px] font-mono text-[var(--mist)]">v2.1 Dual-Auth</span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">Bulletin Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. CRITICAL SIREN: Digital Arrest Extortion Syndicate"
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--saffron)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">Severity Rating</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                  >
                    <option value="critical">🚨 Critical (Siren Broadcast)</option>
                    <option value="high">⚠️ High (Operational Warning)</option>
                    <option value="medium">🟡 Medium (Precautionary)</option>
                    <option value="low">🟢 Low (Advisory Directive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">Target Audience</label>
                  <select
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                  >
                    <option value="citizens">Citizens & Residents</option>
                    <option value="banks">Banks & Financial Cashouts</option>
                    <option value="telecom">Telecom Gateways</option>
                    <option value="officers">Field Patrol Officers</option>
                    <option value="all">Universal Multi-Stakeholder</option>
                  </select>
                </div>
              </div>

              {/* Reverse-Geocode Perimeter Audience Targeting */}
              <div className="p-3.5 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-[var(--saffron)] flex items-center gap-1.5 font-bold">
                    <Compass size={13} />
                    <span>Reverse-Geocode Perimeter Targeting</span>
                  </span>
                  <div className="flex gap-1 bg-[var(--navy)] p-0.5 rounded-lg border border-[var(--navy-line)]">
                    <button
                      type="button"
                      onClick={() => setTargetingType('service_area')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        targetingType === 'service_area' ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)]'
                      }`}
                    >
                      Service Area
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetingType('custom_perimeter')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        targetingType === 'custom_perimeter' ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold' : 'text-[var(--mist)]'
                      }`}
                    >
                      Perimeter (km)
                    </button>
                  </div>
                </div>

                {targetingType === 'service_area' ? (
                  <div>
                    <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">
                      Pick Boundary Registry Service Area:
                    </label>
                    <select
                      value={selectedServiceAreaId}
                      onChange={(e) => setSelectedServiceAreaId(e.target.value)}
                      className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      {Object.values(SERVICE_AREAS_DEMOGRAPHICS).map((sa) => (
                        <option key={sa.id} value={sa.id}>
                          {sa.id} — {sa.name} ({sa.region}, r={sa.radius_km}km)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--mist)] font-mono">Center Lat</span>
                        <input
                          type="number"
                          step="0.001"
                          value={customCenterLat}
                          onChange={(e) => setCustomCenterLat(parseFloat(e.target.value))}
                          className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--mist)] font-mono">Center Lng</span>
                        <input
                          type="number"
                          step="0.001"
                          value={customCenterLng}
                          onChange={(e) => setCustomCenterLng(parseFloat(e.target.value))}
                          className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-[var(--mist)] mb-1">
                        <span>Perimeter Radius:</span>
                        <span className="text-white font-bold">{customRadiusKm} km</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="12.0"
                        step="0.5"
                        value={customRadiusKm}
                        onChange={(e) => setCustomRadiusKm(parseFloat(e.target.value))}
                        className="w-full accent-[var(--saffron)] cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Instant Reverse-Geocode Metrics Radar */}
                {estimatedAudience && (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-white/5 p-2 rounded-lg">
                        <div className="text-[10px] text-[var(--mist)] flex items-center gap-1">
                          <Users size={11} className="text-cyan-400" />
                          <span>Registered Citizens</span>
                        </div>
                        <div className="text-base font-bold text-white mt-0.5">
                          {estimatedAudience.estimated_citizens.toLocaleString()}
                        </div>
                      </div>

                      <div className="bg-white/5 p-2 rounded-lg">
                        <div className="text-[10px] text-[var(--mist)] flex items-center gap-1">
                          <Building2 size={11} className="text-amber-400" />
                          <span>Senior Care Centers</span>
                        </div>
                        <div className="text-base font-bold text-amber-300 mt-0.5">
                          {estimatedAudience.senior_centers_count} Facilities
                        </div>
                      </div>

                      <div className="bg-white/5 p-2 rounded-lg">
                        <div className="text-[10px] text-[var(--mist)] flex items-center gap-1">
                          <Store size={11} className="text-emerald-400" />
                          <span>Local Merchants</span>
                        </div>
                        <div className="text-base font-bold text-emerald-300 mt-0.5">
                          {estimatedAudience.merchant_nodes_count} Nodes
                        </div>
                      </div>

                      <div className="bg-white/5 p-2 rounded-lg">
                        <div className="text-[10px] text-[var(--mist)] flex items-center gap-1">
                          <MapPin size={11} className="text-purple-400" />
                          <span>Bank & ATM Branches</span>
                        </div>
                        <div className="text-base font-bold text-purple-300 mt-0.5">
                          {estimatedAudience.bank_branches_count} POIs
                        </div>
                      </div>
                    </div>

                    {/* Identified Senior Centers Breakdown */}
                    {estimatedAudience.senior_centers?.length > 0 && (
                      <div className="bg-white/5 p-2 rounded-lg text-[10px] font-mono space-y-1">
                        <div className="text-[var(--saffron)] font-bold uppercase">
                          Identified Elder Care Nodes ({estimatedAudience.senior_centers.length}):
                        </div>
                        <div className="max-h-20 overflow-y-auto space-y-0.5 text-white/80 pr-1">
                          {estimatedAudience.senior_centers.map((sc, idx) => (
                            <div key={idx} className="flex justify-between border-b border-white/5 py-0.5">
                              <span>• {sc.name}</span>
                              <span className="text-[var(--mist)]">{sc.capacity_beds} beds</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-[var(--mist)] font-mono">
                      Station: <span className="text-white">{estimatedAudience.primary_station}</span> · PIN:{' '}
                      <span className="text-white">{estimatedAudience.postal_pincodes?.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-Channel Delivery Channels Toggle */}
              <div className="p-3 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl space-y-2.5">
                <div className="text-xs font-mono uppercase text-[var(--saffron)] font-bold flex items-center gap-1.5">
                  <Send size={13} />
                  <span>Simultaneous Delivery Channels</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition">
                    <input
                      type="checkbox"
                      checked={channels.sms_gateway}
                      onChange={(e) => setChannels({ ...channels, sms_gateway: e.target.checked })}
                      className="accent-[var(--saffron)]"
                    />
                    <div className="truncate">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <MessageSquare size={12} className="text-cyan-400" />
                        <span>SMS Gateway</span>
                      </div>
                      <div className="text-[9px] text-[var(--mist)] font-mono">CDAC/TRAI Priority</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition">
                    <input
                      type="checkbox"
                      checked={channels.whatsapp_emergency}
                      onChange={(e) => setChannels({ ...channels, whatsapp_emergency: e.target.checked })}
                      className="accent-[var(--saffron)]"
                    />
                    <div className="truncate">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <Smartphone size={12} className="text-emerald-400" />
                        <span>WhatsApp Gov</span>
                      </div>
                      <div className="text-[9px] text-[var(--mist)] font-mono">Meta Verified</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition">
                    <input
                      type="checkbox"
                      checked={channels.push_notifications}
                      onChange={(e) => setChannels({ ...channels, push_notifications: e.target.checked })}
                      className="accent-[var(--saffron)]"
                    />
                    <div className="truncate">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <Bell size={12} className="text-amber-400" />
                        <span>Priority Push</span>
                      </div>
                      <div className="text-[9px] text-[var(--mist)] font-mono">Mobile App FCM/APNS</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition">
                    <input
                      type="checkbox"
                      checked={channels.portal_header_banner}
                      onChange={(e) => setChannels({ ...channels, portal_header_banner: e.target.checked })}
                      className="accent-[var(--saffron)]"
                    />
                    <div className="truncate">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <Globe size={12} className="text-purple-400" />
                        <span>Portal Marquee</span>
                      </div>
                      <div className="text-[9px] text-[var(--mist)] font-mono">Top Sticky Siren</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
                  Advisory Description & Precautionary Directives
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide detailed incident signals, scam modus operandi, and protective directives..."
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--saffron)]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-semibold text-xs bg-[var(--saffron)] text-[var(--ink)] hover:brightness-110 transition shadow-md flex items-center justify-center gap-2 font-mono uppercase tracking-wider disabled:opacity-50"
              >
                <Plus size={15} />
                <span>Save Draft & Evaluate Guardrails</span>
              </button>
            </form>
          </div>

          {/* Right Column: Queue, Dual-Authorization Guardrail & Telemetry (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Advisory Queue List */}
            <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <h3 className="font-display font-semibold text-white text-base">
                  Emergency Broadcast Queue ({advisories.length})
                </h3>
                <button onClick={loadData} className="p-1 rounded text-[var(--mist)] hover:text-white" title="Refresh">
                  <RefreshCw size={13} />
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {advisories.map((adv) => {
                  const isSelected = selectedAdvisory?.id === adv.id;
                  return (
                    <div
                      key={adv.id}
                      onClick={() => setSelectedAdvisory(adv)}
                      className={`p-3 rounded-xl border transition cursor-pointer font-mono text-xs ${
                        isSelected
                          ? 'bg-[var(--ink)] border-[var(--saffron)] ring-1 ring-[var(--saffron)]'
                          : 'bg-[var(--ink)]/60 border-[var(--navy-line)] hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--saffron)]">{adv.id}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase border ${SEVERITY_BADGES[adv.severity] || ''}`}>
                            {adv.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase border ${STATUS_BADGES[adv.status] || ''}`}>
                            {adv.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="font-semibold text-white text-xs truncate mt-1">{adv.title}</div>
                      <div className="text-[10px] text-[var(--mist)] mt-0.5 flex justify-between">
                        <span>{adv.affected_location}</span>
                        <span>{new Date(adv.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Advisory Inspection, Dual-Authorization & Telemetry */}
            {selectedAdvisory && (
              <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--navy-line)] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--saffron)]">{selectedAdvisory.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${STATUS_BADGES[selectedAdvisory.status]}`}>
                        {selectedAdvisory.status.replace(/_/g, ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${SEVERITY_BADGES[selectedAdvisory.severity]}`}>
                        {selectedAdvisory.severity} Siren
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-bold text-white mt-1">{selectedAdvisory.title}</h2>
                  </div>

                  {/* Dispatch Button */}
                  {selectedAdvisory.status !== 'published' && (
                    <button
                      onClick={handleDispatchSiren}
                      disabled={loading || (selectedAdvisory.dual_auth.requires_dual_auth && !selectedAdvisory.dual_auth.is_fully_authorized)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition shadow-md flex items-center gap-1.5 font-mono uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        selectedAdvisory.dual_auth.requires_dual_auth && !selectedAdvisory.dual_auth.is_fully_authorized
                          ? 'Blocked by Dual-Authorization Guardrail'
                          : 'Ready to Dispatch'
                      }
                    >
                      <Siren size={15} />
                      <span>Dispatch Multi-Channel Siren</span>
                    </button>
                  )}
                </div>

                {/* Commander Approval Guardrail: Dual-Authorization Workflow Card */}
                <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-[var(--saffron)] font-bold flex items-center gap-1.5">
                      <Lock size={13} />
                      <span>Commander Approval Guardrail: Dual-Authorization Protocol</span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                        selectedAdvisory.dual_auth.is_fully_authorized
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {selectedAdvisory.dual_auth.is_fully_authorized ? '✓ Dual-Auth Cleared' : '⏳ 2nd Auth Required'}
                    </span>
                  </div>

                  {/* Sign-Off Officer Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    {/* Authorizer 1 */}
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--mist)] uppercase">1st Sign-Off (Draft Commander)</span>
                        <span className="text-emerald-400 font-bold">✓ Validated</span>
                      </div>
                      <div className="font-bold text-white text-sm">{selectedAdvisory.dual_auth.authorizer_1_name}</div>
                      <div className="text-[11px] text-[var(--mist)]">{selectedAdvisory.dual_auth.authorizer_1_badge}</div>
                      <div className="text-[10px] text-white/70">{selectedAdvisory.dual_auth.authorizer_1_role}</div>
                      <div className="text-[9px] text-[var(--mist)] pt-1">
                        {new Date(selectedAdvisory.dual_auth.authorizer_1_timestamp).toLocaleString()}
                      </div>
                    </div>

                    {/* Authorizer 2 */}
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--mist)] uppercase">2nd Sign-Off (Reviewing DCP)</span>
                        {selectedAdvisory.dual_auth.authorizer_2_badge ? (
                          <span className="text-emerald-400 font-bold">✓ Confirmed</span>
                        ) : (
                          <span className="text-amber-400 font-bold">⏳ Awaiting Signature</span>
                        )}
                      </div>
                      {selectedAdvisory.dual_auth.authorizer_2_badge ? (
                        <>
                          <div className="font-bold text-white text-sm">{selectedAdvisory.dual_auth.authorizer_2_name}</div>
                          <div className="text-[11px] text-[var(--mist)]">{selectedAdvisory.dual_auth.authorizer_2_badge}</div>
                          <div className="text-[10px] text-white/70">{selectedAdvisory.dual_auth.authorizer_2_role}</div>
                          <div className="text-[9px] text-[var(--mist)] pt-1">
                            {new Date(selectedAdvisory.dual_auth.authorizer_2_timestamp).toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] text-amber-200">
                            High-impact broadcast requires dual-authorization before live dispatch to prevent mass panic.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Second Authorizer Sign-Off Modal/Bar */}
                  {!selectedAdvisory.dual_auth.is_fully_authorized && selectedAdvisory.status !== 'rejected' && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="text-[11px] font-mono text-[var(--mist)]">
                        Confirm 2nd Commanding Officer Sign-Off (Dual Authorization Guardrail):
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={secondAuthOfficer.name}
                          onChange={(e) => setSecondAuthOfficer({ ...secondAuthOfficer, name: e.target.value })}
                          className="bg-[var(--navy)] border border-[var(--navy-line)] rounded px-2.5 py-1 text-xs text-white"
                          placeholder="Officer Name"
                        />
                        <input
                          type="text"
                          value={secondAuthOfficer.badge}
                          onChange={(e) => setSecondAuthOfficer({ ...secondAuthOfficer, badge: e.target.value })}
                          className="bg-[var(--navy)] border border-[var(--navy-line)] rounded px-2.5 py-1 text-xs text-white font-mono"
                          placeholder="Badge ID"
                        />
                        <button
                          onClick={handleSecondAuthorizerSignOff}
                          disabled={loading}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition flex items-center gap-1 font-mono uppercase"
                        >
                          <ShieldCheck size={13} />
                          <span>Authorize as 2nd Officer</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery & Acknowledgment Telemetry HUD */}
                {selectedAdvisory.status === 'published' && (
                  <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                        <Radio size={13} className="animate-pulse" />
                        <span>Live Delivery & Acknowledgment Telemetry HUD</span>
                      </span>
                      <button
                        onClick={handleSimulateFeedback}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-mono flex items-center gap-1"
                        title="Simulate user acknowledgments"
                      >
                        <RefreshCw size={11} />
                        <span>Simulate Feedback (+350 Acks)</span>
                      </button>
                    </div>

                    {/* Telemetry Counter Tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xl font-bold text-white">
                          {selectedAdvisory.telemetry.dispatched.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[var(--mist)] uppercase">Dispatched</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                        <div className="text-xl font-bold text-emerald-400">
                          {selectedAdvisory.telemetry.delivered.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-emerald-300 uppercase">
                          Delivered ({selectedAdvisory.telemetry.delivery_rate_pct}%)
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/30">
                        <div className="text-xl font-bold text-cyan-300">
                          {selectedAdvisory.telemetry.read.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-cyan-300 uppercase">
                          Acknowledged ({selectedAdvisory.telemetry.read_rate_pct}%)
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30">
                        <div className="text-xl font-bold text-[var(--saffron)]">
                          {selectedAdvisory.telemetry.linked_citizen_reports}
                        </div>
                        <div className="text-[10px] text-amber-300 uppercase">Linked Citizen Leads</div>
                      </div>
                    </div>

                    {/* Channel Delivery Progress Bars */}
                    <div className="space-y-1.5 pt-1 text-[11px] font-mono">
                      <div className="text-[10px] text-[var(--mist)] uppercase">Channel Delivery Breakdown:</div>
                      {Object.values(selectedAdvisory.telemetry.channels || {}).map((c) => (
                        <div key={c.channel} className="space-y-0.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-white/80">{c.channel_name}</span>
                            <span className="text-emerald-400 font-bold">
                              {c.delivered.toLocaleString()} / {c.dispatched.toLocaleString()} ({c.delivery_rate_pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.delivery_rate_pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channel Message Adapters Live Preview Tabs */}
                <div className="p-3.5 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-[10px] uppercase text-[var(--saffron)] font-bold">
                      Multi-Channel Dispatch Adapter Previews
                    </span>
                    <div className="flex gap-1">
                      {['sms', 'whatsapp', 'push', 'portal_banner'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setChannelPreviewTab(tab)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                            channelPreviewTab === tab ? 'bg-white/20 text-white font-bold' : 'text-[var(--mist)]'
                          }`}
                        >
                          {tab.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {channelPreviewTab === 'sms' && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="text-[10px] text-[var(--mist)] flex justify-between">
                        <span>TRAI DLT Template (&lt; 160 chars):</span>
                        <span className="text-emerald-400 font-bold">{smsPreview.length} / 160 chars</span>
                      </div>
                      <div className="p-2.5 rounded bg-white/5 border border-white/10 text-white/90">
                        {smsPreview}
                      </div>
                    </div>
                  )}

                  {channelPreviewTab === 'whatsapp' && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="text-[10px] text-emerald-400">Meta Verified Gov Channel Template:</div>
                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-white/90 space-y-2">
                        <div className="font-bold text-emerald-300">🚨 LAW ENFORCEMENT PUBLIC SAFETY ADVISORY</div>
                        <div className="font-semibold text-white">{selectedAdvisory.title}</div>
                        <p className="text-[10px] opacity-90">{selectedAdvisory.description}</p>
                        <div className="flex gap-2 pt-1">
                          <button className="px-2.5 py-1 rounded bg-emerald-600 text-[10px] font-bold text-white">
                            Verify Official Notice
                          </button>
                          <button className="px-2.5 py-1 rounded bg-white/10 text-[10px] font-bold text-white">
                            Call 1930
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {channelPreviewTab === 'push' && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="text-[10px] text-amber-400">APNS/FCM High-Priority Siren Push:</div>
                      <div className="p-2.5 rounded bg-amber-950/30 border border-amber-500/30 text-white/90">
                        <div className="font-bold text-amber-300">🚨 EMERGENCY SIREN: {selectedAdvisory.title}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">{selectedAdvisory.description.slice(0, 140)}...</div>
                      </div>
                    </div>
                  )}

                  {channelPreviewTab === 'portal_banner' && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="text-[10px] text-purple-400">Citizen Portal Sticky Marquee:</div>
                      <div className="p-2.5 rounded bg-red-950/80 border border-red-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-red-600 text-[9px] font-bold uppercase">Critical Siren</span>
                          <span className="font-semibold text-[11px]">⚠️ {selectedAdvisory.title}</span>
                        </div>
                        <span className="text-[10px] bg-white text-red-950 px-2 py-0.5 rounded font-bold">
                          Review Directives &rarr;
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit Trail Log */}
                <div className="p-3 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl space-y-2">
                  <span className="font-mono text-[10px] uppercase text-[var(--mist)] font-bold">
                    Immutable Audit Trail & Dispatch Telemetry
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] pr-1">
                    {selectedAdvisory.audit_trail?.map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-white/70 border-b border-white/5 py-1">
                        <span className="text-[10px] text-[var(--saffron)] whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <div>
                          <strong className="text-white">{entry.action}:</strong> <span>{entry.details}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Citizen Live Advisory Public Preview Screen */
        <div className="max-w-3xl mx-auto bg-gradient-to-b from-[#0f172a] to-[#080d1a] border-2 border-red-500 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <span className="px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-full uppercase tracking-widest flex items-center gap-1.5">
              <Siren size={13} className="animate-pulse" />
              <span>OFFICIAL PUBLIC SAFETY SIREN</span>
            </span>
            <span className="text-xs font-mono text-[var(--mist)]">
              Ref: {selectedAdvisory?.id || 'ADV-LIVE'}
            </span>
          </div>

          <div>
            <div className="font-mono text-xs text-[var(--saffron)] uppercase tracking-wider">
              Issued for: {selectedAdvisory?.affected_location || 'Central Zone Corridor'}
            </div>
            <h1 className="font-display text-2xl font-bold text-white mt-1">
              {selectedAdvisory?.title || formData.title || 'CRITICAL EXTORTION SCAM WARNING'}
            </h1>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm leading-relaxed text-slate-200 whitespace-pre-line">
            {selectedAdvisory?.description || formData.description || 'Precautionary directives...'}
          </div>

          <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 space-y-2 text-xs">
            <div className="font-bold text-red-300 font-mono flex items-center gap-1.5">
              <AlertTriangle size={14} />
              <span>OFFICIAL POLICE DIRECTIVE:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Law enforcement agencies NEVER conduct interrogations or arrest trials via video calls.</li>
              <li>Supreme Court warrants are never served via WhatsApp or personal email.</li>
              <li>Never transfer funds into 'verification accounts' or share one-time passwords (OTPs).</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs font-mono text-[var(--mist)]">
            <div>Helpline: Dial <span className="text-white font-bold text-sm">1930</span></div>
            <div>Authorized by: <span className="text-white">{selectedAdvisory?.dual_auth?.authorizer_2_name || 'Cyber Command'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
