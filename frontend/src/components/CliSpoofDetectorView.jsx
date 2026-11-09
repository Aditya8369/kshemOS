import { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Activity,
  Server,
  Cpu,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  Lock,
  Layers,
  ChevronRight,
  Sliders,
  Send,
  Flag,
} from 'lucide-react';
import {
  MANDATORY_WARNING_BANNER,
  TRAI_STD_CIRCLES,
  OFFICIAL_POLICE_DIRECTORIES,
  DEMO_CALL_PRESETS,
  verifyTelephonyRouteLocally,
  verifyCliRouteApi,
  fetchTelecomTriageFeedApi,
  updateTriageIncidentActionApi,
  fetchTelecomTriageSummaryApi,
} from '../api.js';

export default function CliSpoofDetectorView() {
  // Preset selector
  const [selectedPresetId, setSelectedPresetId] = useState('DEMO-CAMBODIA-SPOOF');

  // Input form state
  const [callerCli, setCallerCli] = useState('+91 22 2262 0111');
  const [ingressIp, setIngressIp] = useState('45.154.255.42');
  const [originatingCountry, setOriginatingCountry] = useState('KH');
  const [signalingProtocol, setSignalingProtocol] = useState('SIP_UDP');
  const [sipFromHeader, setSipFromHeader] = useState('"Mumbai Police" <sip:02222620111@scam-pbx.cambodia-gateway.net>');
  const [sipP事AssertedId, setSipPAssertedId] = useState('<sip:+85523998877@transit-voip.com>');
  const [sipUserAgent, setSipUserAgent] = useState('FreePBX-16.0 / Asterisk PBX 18.9');
  const [latencyMs, setLatencyMs] = useState(285);
  const [jitterMs, setJitterMs] = useState(48);
  const [packetLossPct, setPacketLossPct] = useState(3.8);
  const [audioCodec, setAudioCodec] = useState('G711U');
  const [statedAgency, setStatedAgency] = useState('Mumbai Police Commissionerate');
  const [statedArrestThreat, setStatedArrestThreat] = useState(true);

  // Analysis result state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [activeTab, setActiveTab] = useState('detector'); // 'detector' | 'triage' | 'directory'

  // Officer Triage state
  const [triageIncidents, setTriageIncidents] = useState([]);
  const [triageSummary, setTriageSummary] = useState(null);
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [triageActionStatus, setTriageActionStatus] = useState('');

  // Apply selected preset
  function handleSelectPreset(presetKey) {
    setSelectedPresetId(presetKey);
    const preset = DEMO_CALL_PRESETS[presetKey];
    if (!preset) return;

    setCallerCli(preset.caller_cli || '');
    setIngressIp(preset.ingress_ip || '');
    setOriginatingCountry(preset.originating_country || 'IN');
    setSignalingProtocol(preset.signaling_protocol || 'SIP_UDP');
    setSipFromHeader(preset.sip_from_header || '');
    setSipPAssertedId(preset.sip_p_asserted_identity || '');
    setSipUserAgent(preset.sip_user_agent || '');
    setLatencyMs(preset.latency_ms ?? 50);
    setJitterMs(preset.jitter_ms ?? 10);
    setPacketLossPct(preset.packet_loss_pct ?? 0.5);
    setAudioCodec(preset.audio_codec || 'G711U');
    setStatedAgency(preset.stated_agency || '');
    setStatedArrestThreat(Boolean(preset.stated_arrest_threat));
  }

  // Run Route Verification
  async function handleVerifyRoute(e) {
    if (e && e.preventDefault) e.preventDefault();
    setIsVerifying(true);
    setTriageActionStatus('');

    const payload = {
      caller_cli: callerCli,
      ingress_ip: ingressIp,
      originating_country: originatingCountry,
      signaling_protocol: signalingProtocol,
      sip_from_header: sipFromHeader,
      sip_p_asserted_identity: sipP事AssertedId,
      sip_user_agent: sipUserAgent,
      latency_ms: Number(latencyMs),
      jitter_ms: Number(jitterMs),
      packet_loss_pct: Number(packetLossPct),
      audio_codec: audioCodec,
      stated_agency: statedAgency,
      stated_arrest_threat: statedArrestThreat,
    };

    try {
      // Try backend API first, fallback to offline local engine
      const res = await verifyCliRouteApi(payload);
      setVerificationResult(res);
    } catch {
      const localRes = verifyTelephonyRouteLocally(payload);
      setVerificationResult(localRes);
    } finally {
      setIsVerifying(false);
    }
  }

  // Load Triage Feed
  async function loadTriageFeed() {
    setLoadingTriage(true);
    try {
      const incidents = await fetchTelecomTriageFeedApi();
      setTriageIncidents(incidents);
      const summary = await fetchTelecomTriageSummaryApi();
      setTriageSummary(summary);
    } catch (err) {
      console.warn('Could not fetch triage feed:', err);
    } finally {
      setLoadingTriage(false);
    }
  }

  // Update Triage Incident Status
  async function handleUpdateIncident(triageId, action) {
    try {
      await updateTriageIncidentActionApi(triageId, action, 'Officer (Console)');
      setTriageActionStatus(`Incident ${triageId} updated to ${action}`);
      await loadTriageFeed();
    } catch (err) {
      console.error('Failed to update incident:', err);
    }
  }

  // Initial run on mount
  useEffect(() => {
    handleVerifyRoute();
    loadTriageFeed();
  }, []);

  // Compute threat visual style
  const threatBadgeStyle = useMemo(() => {
    if (!verificationResult) return { bg: 'bg-slate-800', text: 'text-slate-300', label: 'PENDING' };
    switch (verificationResult.threat_tier) {
      case 'CRITICAL':
        return { bg: 'bg-red-950/80 border-red-500 text-red-300', label: 'CRITICAL SPOOF' };
      case 'HIGH':
        return { bg: 'bg-orange-950/80 border-orange-500 text-orange-300', label: 'HIGH RISK TRUNK' };
      case 'MEDIUM':
        return { bg: 'bg-amber-950/80 border-amber-500 text-amber-300', label: 'SUSPICIOUS ROUTE' };
      case 'LOW':
      default:
        return { bg: 'bg-emerald-950/80 border-emerald-500 text-emerald-300', label: 'VERIFIED ROUTE' };
    }
  }, [verificationResult]);

  return (
    <div className="min-h-full bg-[var(--ink)] text-white w-full overflow-x-hidden p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--navy-line)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-[var(--saffron)]" />
              Telephony Route Verification & SIM Box Engine
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Calling Line Identification (CLI) Spoof Detector
          </h1>
          <p className="text-sm text-[var(--mist)] mt-1 max-w-3xl">
            Cross-references incoming caller ID metadata, TRAI telecom circle numbering plans, SIP trunk headers,
            audio round-trip latency, and VoIP gateway IP ranges to unmask rogue grey GSM SIM Boxes and spoofed calls.
          </p>
        </div>

        {/* View Tabs */}
        <div className="inline-flex rounded-full bg-[var(--navy)] p-1 border border-[var(--navy-line)] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('detector')}
            className={`px-4 py-2 rounded-full transition-colors ${
              activeTab === 'detector' ? 'bg-[var(--saffron)] text-white' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            CLI Route Inspector
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('triage');
              loadTriageFeed();
            }}
            className={`px-4 py-2 rounded-full transition-colors flex items-center gap-1.5 ${
              activeTab === 'triage' ? 'bg-[var(--saffron)] text-white' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Telecom Ingress Triage
            {triageIncidents.length > 0 && (
              <span className="bg-red-600 text-white rounded-full px-1.5 py-0.2 text-[10px] font-mono">
                {triageIncidents.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2 rounded-full transition-colors ${
              activeTab === 'directory' ? 'bg-[var(--saffron)] text-white' : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            TRAI & Police Directory
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* MANDATORY STATUTORY WARNING BANNER */}
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border-2 border-red-500 bg-red-950/60 p-4 sm:p-5 shadow-lg flex items-start gap-4 transition-all"
        >
          <div className="p-2.5 rounded-xl bg-red-600/30 text-red-400 shrink-0">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
                Statutory Advisory (TRAI & Ministry of Home Affairs / I4C)
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold text-red-100 leading-snug">
              {MANDATORY_WARNING_BANNER}
            </p>
            <p className="text-xs text-red-300/80 leading-relaxed">
              Section 91 / 102 CrPC notices and arrest warrants are delivered in-person by uniformed officers with official identification or registered post. Any digital arrest, Skype video trial, or immediate bail demand is fraudulent.
            </p>
          </div>
        </div>

        {/* TAB 1: DETECTOR */}
        {activeTab === 'detector' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Form & Presets */}
            <div className="lg:col-span-5 space-y-5">
              {/* Preset Selector */}
              <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="preset-select" className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--saffron)] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Investigation Scenario Presets
                  </label>
                  <span className="text-[11px] text-[var(--mist)] font-mono">4 Demo Scenarios</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(DEMO_CALL_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`text-left p-3 rounded-xl border transition-all text-xs flex flex-col gap-1 ${
                        selectedPresetId === key
                          ? 'border-[var(--saffron)] bg-[var(--saffron)]/15 text-white shadow-sm'
                          : 'border-[var(--navy-line)] bg-slate-900/40 text-[var(--mist)] hover:bg-slate-900/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-white">{p.name}</span>
                        <span className="font-mono text-[10px] text-[var(--saffron)]">{p.caller_cli}</span>
                      </div>
                      <p className="text-[11px] line-clamp-1 opacity-80">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Technical Route Inspection Form */}
              <form onSubmit={handleVerifyRoute} className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-[var(--saffron)]" />
                    Telephony Route Telemetry
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('DEMO-CAMBODIA-SPOOF')}
                    className="text-[11px] text-[var(--mist)] hover:text-white underline font-mono"
                  >
                    Reset Form
                  </button>
                </div>

                {/* Stated Agency & Arrest Threat */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--mist)]">Stated Calling Authority / Agency</label>
                  <input
                    type="text"
                    value={statedAgency}
                    onChange={(e) => setStatedAgency(e.target.value)}
                    placeholder="e.g. Mumbai Police Commissionerate, CBI Cyber Desk"
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-950/30 border border-red-900/50">
                  <input
                    type="checkbox"
                    id="statedArrestThreat"
                    checked={statedArrestThreat}
                    onChange={(e) => setStatedArrestThreat(e.target.checked)}
                    className="h-4 w-4 rounded border-red-600 text-red-600 focus:ring-red-500 bg-slate-900"
                  />
                  <label htmlFor="statedArrestThreat" className="text-xs text-red-200 cursor-pointer">
                    Caller demanded immediate money, bail, or threatened digital arrest/summons
                  </label>
                </div>

                {/* Caller CLI & Ingress IP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--mist)]">Displayed CLI / Caller Number</label>
                    <input
                      type="text"
                      value={callerCli}
                      onChange={(e) => setCallerCli(e.target.value)}
                      placeholder="+91 22 2262 0111"
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--mist)]">Ingress IP / Host</label>
                    <input
                      type="text"
                      value={ingressIp}
                      onChange={(e) => setIngressIp(e.target.value)}
                      placeholder="45.154.255.42"
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                    />
                  </div>
                </div>

                {/* Protocol & Originating Country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--mist)]">Signaling Protocol</label>
                    <select
                      value={signalingProtocol}
                      onChange={(e) => setSignalingProtocol(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                    >
                      <option value="SIP_UDP">SIP UDP (VoIP Trunk)</option>
                      <option value="SIP_TLS">SIP TLS (Encrypted SIP)</option>
                      <option value="WEBRTC_VOIP">WebRTC VoIP Gateway</option>
                      <option value="WHATSAPP_VOIP">WhatsApp VoIP Call</option>
                      <option value="PSTN_ISDN">PSTN ISDN PRI (Fixed line)</option>
                      <option value="GSM_2G_3G">GSM Cellular Trunk</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--mist)]">Originating Country</label>
                    <input
                      type="text"
                      value={originatingCountry}
                      onChange={(e) => setOriginatingCountry(e.target.value.toUpperCase())}
                      placeholder="IN, KH, MM, AE..."
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                    />
                  </div>
                </div>

                {/* Latency & Jitter */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--mist)]">Latency (ms)</label>
                    <input
                      type="number"
                      value={latencyMs}
                      onChange={(e) => setLatencyMs(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--mist)]">Jitter (ms)</label>
                    <input
                      type="number"
                      value={jitterMs}
                      onChange={(e) => setJitterMs(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--mist)]">Loss (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={packetLossPct}
                      onChange={(e) => setPacketLossPct(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                    />
                  </div>
                </div>

                {/* SIP Headers */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--mist)]">SIP 'From' Header</label>
                  <input
                    type="text"
                    value={sipFromHeader}
                    onChange={(e) => setSipFromHeader(e.target.value)}
                    placeholder='"Mumbai Police" <sip:02222620111@gateway>'
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--mist)]">SIP 'P-Asserted-Identity' Header</label>
                  <input
                    type="text"
                    value={sipP事AssertedId}
                    onChange={(e) => setSipPAssertedId(e.target.value)}
                    placeholder="<sip:+85523998877@transit-voip.com>"
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--mist)]">SIP User-Agent Header</label>
                  <input
                    type="text"
                    value={sipUserAgent}
                    onChange={(e) => setSipUserAgent(e.target.value)}
                    placeholder="FreePBX-16.0 / Asterisk / Dinstar SIM Box"
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-bold bg-[var(--saffron)] hover:bg-[#e07505] text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Telephony Route & Gateways...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verify Telephony Route & CLI Authenticity
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right 7 Cols: Verification Results */}
            <div className="lg:col-span-7 space-y-5">
              {verificationResult ? (
                <>
                  {/* Top Result Banner */}
                  <div className={`rounded-2xl border p-5 shadow-lg space-y-4 ${threatBadgeStyle.bg}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${threatBadgeStyle.bg}`}>
                            {threatBadgeStyle.label}
                          </span>
                          <span className="font-mono text-xs text-[var(--mist)]">
                            ID: {verificationResult.call_id}
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">
                          {verificationResult.is_spoofed ? '⚠️ CALL IDENTITY SPOOF DETECTED' : '✅ LEGITIMATE CALL IDENTITY'}
                        </h2>
                      </div>

                      {/* Carrier Legitimacy Meter */}
                      <div className="bg-slate-900/80 rounded-xl p-3 border border-white/10 text-center min-w-[140px]">
                        <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Carrier Legitimacy</div>
                        <div className="text-2xl font-black font-mono mt-0.5 text-white flex items-center justify-center gap-1">
                          <span>{verificationResult.carrier_legitimacy_score}</span>
                          <span className="text-xs text-[var(--mist)] font-normal">/ 100</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              verificationResult.carrier_legitimacy_score < 40
                                ? 'bg-red-500'
                                : verificationResult.carrier_legitimacy_score < 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${verificationResult.carrier_legitimacy_score}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Summary text */}
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {verificationResult.summary_verdict}
                    </p>

                    {/* Impersonated Agency Warning if present */}
                    {verificationResult.impersonated_agency && (
                      <div className="rounded-xl bg-red-900/40 border border-red-500/50 p-3 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-mono uppercase font-bold text-red-300">
                            Impersonated Official Directory Record
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {verificationResult.impersonated_agency.official_name}
                          </div>
                          <div className="text-xs text-red-200/90 mt-0.5">
                            Official Registry CLI: <span className="font-mono">{verificationResult.impersonated_agency.expected_cli}</span> ({verificationResult.impersonated_agency.category})
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Telemetry Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="bg-slate-900/70 rounded-xl p-2.5 border border-white/10">
                        <div className="text-[10px] font-mono text-[var(--mist)] uppercase">Gateway Route</div>
                        <div className="text-xs font-bold text-white mt-0.5 truncate">
                          {verificationResult.ingress_classification}
                        </div>
                      </div>
                      <div className="bg-slate-900/70 rounded-xl p-2.5 border border-white/10">
                        <div className="text-[10px] font-mono text-[var(--mist)] uppercase">TRAI Circle</div>
                        <div className="text-xs font-bold text-white mt-0.5 truncate">
                          {verificationResult.trai_circle_detected
                            ? `${verificationResult.trai_circle_detected.circle_name} (${verificationResult.trai_circle_detected.std_code})`
                            : 'Unknown Circle'}
                        </div>
                      </div>
                      <div className="bg-slate-900/70 rounded-xl p-2.5 border border-white/10">
                        <div className="text-[10px] font-mono text-[var(--mist)] uppercase">RTT Latency</div>
                        <div className={`text-xs font-bold mt-0.5 font-mono ${
                          verificationResult.latency_ms > 200 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {verificationResult.latency_ms} ms {verificationResult.latency_ms > 200 ? '(Offshore)' : '(Local)'}
                        </div>
                      </div>
                      <div className="bg-slate-900/70 rounded-xl p-2.5 border border-white/10">
                        <div className="text-[10px] font-mono text-[var(--mist)] uppercase">Jitter & Loss</div>
                        <div className="text-xs font-bold text-white mt-0.5 font-mono">
                          {verificationResult.jitter_ms}ms / {verificationResult.packet_loss_pct}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Anomaly Breakdown Cards */}
                  <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[var(--saffron)]" />
                        Detected Anomaly Flags ({verificationResult.anomalies.length})
                      </h3>
                      <span className="text-xs font-mono text-[var(--mist)]">
                        Confidence: {(verificationResult.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>

                    {verificationResult.anomalies.length === 0 ? (
                      <div className="p-6 text-center text-[var(--mist)] rounded-xl bg-slate-900/50">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm font-medium">No routing or CLI anomalies detected.</p>
                        <p className="text-xs mt-1">This call conforms with standard domestic carrier signaling rules.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {verificationResult.anomalies.map((anomaly, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex flex-col gap-1 transition-all ${
                              anomaly.severity === 'CRITICAL'
                                ? 'bg-red-950/40 border-red-800/80 text-red-200'
                                : anomaly.severity === 'HIGH'
                                ? 'bg-orange-950/40 border-orange-800/80 text-orange-200'
                                : anomaly.severity === 'MEDIUM'
                                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                                : 'bg-slate-900/80 border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  anomaly.severity === 'CRITICAL'
                                    ? 'bg-red-600 text-white'
                                    : anomaly.severity === 'HIGH'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-amber-600 text-black'
                                }`}>
                                  {anomaly.severity}
                                </span>
                                <span className="text-xs font-bold font-mono text-white">
                                  {anomaly.flag_name}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-[var(--mist)]">
                                {anomaly.category}
                              </span>
                            </div>
                            <p className="text-xs opacity-90 leading-relaxed mt-1">
                              {anomaly.description}
                            </p>
                            {anomaly.statutory_citation && (
                              <div className="text-[10px] font-mono text-[var(--saffron)] mt-1 flex items-center gap-1">
                                <Flag className="w-3 h-3 inline" />
                                Ref: {anomaly.statutory_citation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Operational Recommendations for Officer */}
                  <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[var(--saffron)]" />
                      Law Enforcement & Citizen Action Protocols
                    </h3>
                    <ul className="space-y-2 text-xs text-[var(--mist)]">
                      {verificationResult.investigative_recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
                          <ChevronRight className="w-4 h-4 text-[var(--saffron)] shrink-0 mt-0.5" />
                          <span className="text-slate-200">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center p-12 rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] text-center">
                  <div className="space-y-3 max-w-sm">
                    <Radio className="w-10 h-10 text-[var(--saffron)] mx-auto animate-pulse" />
                    <h3 className="text-base font-semibold text-white">Ready for Call Verification</h3>
                    <p className="text-xs text-[var(--mist)]">
                      Select a preset on the left or enter SIP trunk parameters to evaluate carrier legitimacy and unmask spoofed caller numbers.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TELECOM INGRESS TRIAGE DASHBOARD */}
        {activeTab === 'triage' && (
          <div className="space-y-5">
            {/* Triage Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-4 text-center">
                <div className="text-xs font-mono uppercase text-[var(--mist)]">Total Interceptions</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {triageSummary?.total_interceptions ?? triageIncidents.length}
                </div>
              </div>
              <div className="rounded-2xl bg-red-950/40 border border-red-900/60 p-4 text-center">
                <div className="text-xs font-mono uppercase text-red-300">Critical Spoofed Calls</div>
                <div className="text-2xl font-bold font-mono text-red-400 mt-1">
                  {triageSummary?.critical_spoofs ?? triageIncidents.filter((i) => i.threat_tier === 'CRITICAL').length}
                </div>
              </div>
              <div className="rounded-2xl bg-orange-950/40 border border-orange-900/60 p-4 text-center">
                <div className="text-xs font-mono uppercase text-orange-300">Rogue SIM Box Gateways</div>
                <div className="text-2xl font-bold font-mono text-orange-400 mt-1">
                  {triageSummary?.active_simboxes ?? triageIncidents.filter((i) => i.ingress_classification === 'UNAUTHORIZED_GSM_SIM_BOX').length}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-950/40 border border-emerald-900/60 p-4 text-center">
                <div className="text-xs font-mono uppercase text-emerald-300">Blocked At Gateway</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {triageSummary?.blocked_gateways ?? triageIncidents.filter((i) => i.status === 'BLOCKED_AT_GATEWAY').length}
                </div>
              </div>
            </div>

            {/* Action Feedback Notification */}
            {triageActionStatus && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500 text-xs text-emerald-200 font-mono flex items-center justify-between">
                <span>{triageActionStatus}</span>
                <button
                  type="button"
                  onClick={() => setTriageActionStatus('')}
                  className="text-white hover:text-emerald-300 text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Triage Incidents Table */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] overflow-hidden shadow-sm">
              <div className="p-4 sm:p-5 border-b border-[var(--navy-line)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[var(--saffron)]" />
                    Live Officer Telecom Ingress Triage Stream
                  </h3>
                  <p className="text-xs text-[var(--mist)] mt-0.5">
                    Flagged grey trunk transit endpoints dispatched for DOT / TSP blocking
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadTriageFeed}
                  disabled={loadingTriage}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-white border border-[var(--navy-line)] flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTriage ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-[var(--mist)] font-mono uppercase text-[11px] border-b border-[var(--navy-line)]">
                    <tr>
                      <th className="py-3 px-4">Triage ID</th>
                      <th className="py-3 px-4">Spoofed CLI</th>
                      <th className="py-3 px-4">Ingress IP / Type</th>
                      <th className="py-3 px-4">Carrier Legitimacy</th>
                      <th className="py-3 px-4">Threat Tier</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Officer Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--navy-line)] text-slate-200">
                    {triageIncidents.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-[var(--mist)]">
                          No rogue telephony ingress points in triage queue.
                        </td>
                      </tr>
                    ) : (
                      triageIncidents.map((inc) => (
                        <tr key={inc.triage_id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-[var(--saffron)] font-semibold">
                            {inc.triage_id}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-white">{inc.caller_cli}</div>
                            {inc.stated_agency && (
                              <div className="text-[10px] text-[var(--mist)] truncate max-w-[160px]">
                                {inc.stated_agency}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs">{inc.ingress_ip}</div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-[var(--mist)]">
                              {inc.ingress_classification}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span className={inc.carrier_legitimacy_score < 40 ? 'text-red-400' : 'text-amber-400'}>
                              {inc.carrier_legitimacy_score}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              inc.threat_tier === 'CRITICAL'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-orange-950 text-orange-300 border border-orange-800'
                            }`}>
                              {inc.threat_tier}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              inc.status === 'BLOCKED_AT_GATEWAY'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : inc.status === 'DISPATCHED_TO_TELCO'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {inc.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleUpdateIncident(inc.triage_id, 'BLOCKED_AT_GATEWAY')}
                              className="px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700 font-mono text-[10px]"
                            >
                              Block IP
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIncident(inc.triage_id, 'DISPATCHED_TO_TELCO')}
                              className="px-2.5 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 font-mono text-[10px]"
                            >
                              Dispatch Telco
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIncident(inc.triage_id, 'RESOLVED')}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-mono text-[10px]"
                            >
                              Resolve
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRAI & POLICE DIRECTORY */}
        {activeTab === 'directory' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Verified Police Agency Numbers */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[var(--saffron)]" />
                  Verified Official Police & Law Enforcement Numbers
                </h3>
              </div>
              <p className="text-xs text-[var(--mist)] leading-relaxed">
                Legitimate police fixed-line numbers that scammers commonly spoof using offshore VoIP PBX trunks.
              </p>

              <div className="space-y-3">
                {OFFICIAL_POLICE_DIRECTORIES.map((dir, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-900/60 border border-[var(--navy-line)] flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{dir.official_name}</div>
                      <div className="text-[11px] text-[var(--mist)] mt-0.5">{dir.jurisdiction_area} ({dir.category})</div>
                      <div className="font-mono text-xs text-[var(--saffron)] font-bold mt-1">
                        CLI: {dir.expected_cli}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                      OFFICIAL
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* TRAI STD Circle Directory */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--saffron)]" />
                  TRAI Fixed-Line STD Telecom Circles
                </h3>
              </div>
              <p className="text-xs text-[var(--mist)] leading-relaxed">
                National Numbering Plan STD codes cross-referenced against originating PSTN switches.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {TRAI_STD_CIRCLES.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-[var(--navy-line)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[var(--saffron)]">STD {c.std_code}</span>
                      <span className="text-[10px] text-[var(--mist)] font-mono">{c.carrier}</span>
                    </div>
                    <div className="text-xs font-semibold text-white mt-1">{c.circle_name}</div>
                    <div className="text-[10px] text-[var(--mist)]">{c.area}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

