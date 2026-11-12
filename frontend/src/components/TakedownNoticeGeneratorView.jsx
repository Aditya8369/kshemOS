import { useState, useEffect } from 'react';
import {
  Globe,
  Server,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Send,
  RefreshCw,
  Copy,
  Check,
  Lock,
  ExternalLink,
  Activity,
  FileText,
  Mail,
  Zap,
  Radio,
  Eye,
  CheckCircle2,
} from 'lucide-react';

import {
  generateTakedownNoticeApi,
  listTakedownNoticesApi,
  updateTakedownStatusApi,
  checkDomainDnsStatusApi,
  fetchTakedownStatsApi,
} from '../api';

import {
  CERT_IN_INCIDENT_EMAIL,
  CERT_IN_HELPDESK_PHONE,
  TAKEDOWN_PRESETS,
} from '../takedownStore';

export default function TakedownNoticeGeneratorView() {
  // Input fields
  const [selectedPresetId, setSelectedPresetId] = useState('preset-sbi-phish');
  const [targetUrl, setTargetUrl] = useState(TAKEDOWN_PRESETS[0].url);
  const [brandImpersonated, setBrandImpersonated] = useState(TAKEDOWN_PRESETS[0].brand);
  const [urgencyLevel, setUrgencyLevel] = useState(TAKEDOWN_PRESETS[0].urgency);
  const [customNotes, setCustomNotes] = useState(TAKEDOWN_PRESETS[0].notes);

  // Officer info
  const [officerName, setOfficerName] = useState('Inspector Rajesh Sharma');
  const [officerBadgeId, setOfficerBadgeId] = useState('OFF-DELHI-104');
  const [officerEmail, setOfficerEmail] = useState('cybercell.delhi@gov.in');
  const [includeCertIn, setIncludeCertIn] = useState(true);
  const [saveToVault, setSaveToVault] = useState(true);

  // Generation & Active Notice state
  const [generating, setGenerating] = useState(false);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [probingDns, setProbingDns] = useState(false);
  const [dnsProbeResult, setDnsProbeResult] = useState(null);

  // History & stats
  const [notices, setNotices] = useState([]);
  const [stats, setStats] = useState({
    total_notices_dispatched: 0,
    active_under_review: 0,
    domains_suspended: 0,
    sla_breached_count: 0,
    offline_domains_detected: 0,
    average_takedown_time_hours: 14.2,
  });

  // Load initial data
  useEffect(() => {
    loadData();
    // Generate notice for default preset on initial view mount
    handleGenerateNotice();
  }, []);

  async function loadData() {
    try {
      const [noticeList, statsData] = await Promise.all([
        listTakedownNoticesApi(),
        fetchTakedownStatsApi(),
      ]);
      if (Array.isArray(noticeList)) {
        setNotices(noticeList);
      }
      if (statsData) {
        setStats(statsData);
      }
    } catch (e) {
      console.warn('Failed to load takedown notices/stats:', e);
    }
  }

  function handleSelectPreset(preset) {
    setSelectedPresetId(preset.id);
    setTargetUrl(preset.url);
    setBrandImpersonated(preset.brand);
    setUrgencyLevel(preset.urgency);
    setCustomNotes(preset.notes);
    setDnsProbeResult(null);
  }

  async function handleGenerateNotice() {
    if (!targetUrl.trim()) return;

    setGenerating(true);
    setDnsProbeResult(null);
    try {
      const payload = {
        target_url: targetUrl.trim(),
        brand_impersonated: brandImpersonated.trim(),
        officer_name: officerName,
        officer_badge_id: officerBadgeId,
        officer_email: officerEmail,
        include_cert_in_cc: includeCertIn,
        urgency_level: urgencyLevel,
        custom_notes: customNotes,
        save_to_evidence_vault: saveToVault,
      };

      const record = await generateTakedownNoticeApi(payload);
      setCurrentNotice(record);
      await loadData();
    } catch (e) {
      console.error('Failed to generate takedown notice:', e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!currentNotice) return;
    try {
      const updated = await updateTakedownStatusApi(
        currentNotice.notice_id,
        newStatus,
        officerBadgeId,
        `Manual officer update to ${newStatus}`
      );
      if (updated) {
        setCurrentNotice(updated);
        await loadData();
      }
    } catch (e) {
      console.error('Failed to update takedown status:', e);
    }
  }

  async function handleProbeDns() {
    if (!currentNotice) return;
    setProbingDns(true);
    try {
      const probeRes = await checkDomainDnsStatusApi(currentNotice.notice_id);
      setDnsProbeResult(probeRes);
      // Refresh current notice if status updated
      const updated = await listTakedownNoticesApi();
      const match = updated.find((x) => x.notice_id === currentNotice.notice_id);
      if (match) setCurrentNotice(match);
      await loadData();
    } catch (e) {
      console.error('Failed to probe DNS:', e);
    } finally {
      setProbingDns(false);
    }
  }

  function handleCopyEmailBody() {
    if (!currentNotice?.rfc_email_body) return;
    navigator.clipboard?.writeText?.(currentNotice.rfc_email_body);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  const isSuspended = currentNotice?.status === 'DOMAIN_SUSPENDED' || currentNotice?.domain_offline;
  const isBreached = currentNotice?.status === 'SLA_BREACHED' || currentNotice?.sla_breached;
  const isUnderReview = currentNotice?.status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 rounded-xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-lg text-blue-300">
                <Globe className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Automated Registrar & Hosting Abuse Takedown Generator
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    CERT-In & IT Act § 79(3)(b)
                  </span>
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  Automated domain WHOIS, DNS record resolution, web host abuse correlation, certified RFC takedown notice dispatch,
                  and offline domain watchdog monitoring.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400">Total Dispatched:</span>
              <span className="font-bold text-white">{stats.total_notices_dispatched}</span>
            </div>
            <div className="bg-amber-950/50 border border-amber-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300">Under Review:</span>
              <span className="font-bold text-amber-200">{stats.active_under_review}</span>
            </div>
            <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300">Domains Suspended:</span>
              <span className="font-bold text-emerald-200">{stats.domains_suspended}</span>
            </div>
            <div className="bg-red-950/50 border border-red-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="text-red-300">SLA Breaches:</span>
              <span className="font-bold text-red-200">{stats.sla_breached_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            Active Phishing & Impersonation Campaign Presets
          </label>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Click to auto-populate live hosting & registrar targets
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TAKEDOWN_PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-3.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {p.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {p.providerExpected}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mb-2">
                  {p.url}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-700/60 pt-2 mt-1">
                  <span>Target: {p.brand}</span>
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {p.urgency === 'CRITICAL_IMMINENT_FRAUD' ? '6h SLA' : '24h SLA'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Configuration & Officer Dispatch Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Target Phishing & Malicious Host Parameters
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Malicious Phishing / Extortion URL
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="e.g. https://sbi-netbanking-kyc-alert.top/login.php"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Brand / Authority Impersonated
            </label>
            <input
              type="text"
              value={brandImpersonated}
              onChange={(e) => setBrandImpersonated(e.target.value)}
              placeholder="e.g. State Bank of India (SBI), Delhi Police, CBI"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Enforcement Urgency Level & Statutory SLA
            </label>
            <select
              value={urgencyLevel}
              onChange={(e) => setUrgencyLevel(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="CRITICAL_IMMINENT_FRAUD">CRITICAL IMMINENT FRAUD (6-Hour CERT-In SLA)</option>
              <option value="HIGH_CREDENTIAL_PHISH">HIGH CREDENTIAL PHISH (24-Hour Registrar SLA)</option>
              <option value="MODERATE_IMPERSONATION">MODERATE IMPERSONATION (48-Hour Intermediary Notice)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Investigating Officer Credentials
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="Officer Name"
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={officerBadgeId}
                onChange={(e) => setOfficerBadgeId(e.target.value)}
                placeholder="Badge ID"
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <input
              type="email"
              value={officerEmail}
              onChange={(e) => setOfficerEmail(e.target.value)}
              placeholder="Officer Official Email"
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5 pt-1 text-xs text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCertIn}
                onChange={(e) => setIncludeCertIn(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>CC CERT-In Incident Response Desk ({CERT_IN_INCIDENT_EMAIL})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToVault}
                onChange={(e) => setSaveToVault(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Seal in Evidence Vault (Section 79(3)(b) Legal Hold)</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleGenerateNotice}
            disabled={generating}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Querying DNS & WHOIS Desks...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Generate Certified Takedown Package
              </>
            )}
          </button>
        </div>

        {/* DNS Infrastructure & WHOIS Telemetry */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-500" />
                Infrastructure & Autonomous System Correlator
              </h2>
              {currentNotice && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Ref: {currentNotice.cert_in_reference_id}
                </span>
              )}
            </div>

            {currentNotice?.dns_records ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Hosting Provider</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                      {currentNotice.dns_records.hosting_provider}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Host Abuse Email: <strong className="font-mono text-slate-900 dark:text-white">{currentNotice.dns_records.hosting_abuse_email}</strong>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Network ASN: <span className="font-mono">{currentNotice.dns_records.asn || 'N/A'}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Primary IP: <span className="font-mono text-slate-900 dark:text-white font-bold">{currentNotice.dns_records.ip_address}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Domain Registrar</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                      {currentNotice.dns_records.registrar_name}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Registrar Abuse: <strong className="font-mono text-slate-900 dark:text-white">{currentNotice.dns_records.registrar_abuse_email}</strong>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    SSL Issuer: <span className="font-mono">{currentNotice.dns_records.ssl_issuer || 'N/A'}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    SSL Expiry: <span className="font-mono">{currentNotice.dns_records.ssl_valid_until || 'N/A'}</span>
                  </div>
                </div>

                <div className="md:col-span-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-900 dark:text-white">Authoritative Nameservers (DNS A/NS)</span>
                    <span className="text-[11px] text-slate-500">{currentNotice.dns_records.ns_records.length} Delegation Records</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentNotice.dns_records.ns_records.map((ns, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                      >
                        {ns}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 border border-dashed rounded-lg">
                Enter a malicious URL and click Generate to resolve infrastructure records.
              </div>
            )}
          </div>

          {/* Forensic Evidence & Indicators Preview */}
          {currentNotice?.evidence_package && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                Certified Forensic Evidence Package (DOM SHA-256)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="md:col-span-2 bg-slate-100 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 mb-0.5">SHA-256 DOM Fingerprint:</div>
                  <div className="font-mono text-[11px] text-slate-900 dark:text-slate-200 break-all font-semibold">
                    {currentNotice.evidence_package.sha256_dom_hash}
                  </div>
                </div>
                <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500">Screenshot Exhibit:</div>
                    <div className="font-mono text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate">
                      {currentNotice.evidence_package.screenshot_filename}
                    </div>
                  </div>
                  <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Takedown Lifecycle Pipeline & Online Watchdog Prober */}
      {currentNotice && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Takedown Notice Lifecycle Pipeline & DNS Watchdog Monitor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Notice: <strong className="font-mono">{currentNotice.notice_id}</strong> | Dispatched: {new Date(currentNotice.dispatched_at).toLocaleString()} | SLA Cutoff: {new Date(currentNotice.sla_deadline).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleProbeDns}
                disabled={probingDns}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <Radio className={`w-3.5 h-3.5 ${probingDns ? 'animate-pulse text-red-500' : 'text-blue-500'}`} />
                {probingDns ? 'Probing DNS & HTTP...' : 'Probe DNS / Online Status'}
              </button>
            </div>
          </div>

          {/* Officer Alert Banner from Watchdog */}
          {dnsProbeResult?.officer_alert && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                dnsProbeResult.is_offline
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                  : dnsProbeResult.nameservers_churned
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-900 dark:text-amber-200'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-900 dark:text-red-200'
              }`}
            >
              {dnsProbeResult.is_offline ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <span className="font-bold">{dnsProbeResult.officer_alert}</span>
                <p className="mt-1 opacity-90">
                  {dnsProbeResult.is_offline
                    ? 'The domain fails authoritative resolution or returns NXDOMAIN. The takedown has been successfully enforced.'
                    : dnsProbeResult.nameservers_churned
                    ? 'The domain migrated to offshore bulletproof nameservers to evade domestic takedown. Forwarding grey route to telecom triage.'
                    : 'The domain remains active beyond designated SLA. Escalation notice dispatches to statutory cyber desk.'}
                </p>
              </div>
            </div>
          )}

          {/* Lifecycle Status Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-slate-500 mr-2">Update Stage:</span>
            <button
              type="button"
              onClick={() => handleStatusChange('UNDER_REVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isUnderReview
                  ? 'bg-amber-500 text-white border-amber-600 shadow'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              Under Review (Ticket Acknowledged)
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('DOMAIN_SUSPENDED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isSuspended
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              Domain Suspended (clientHold Active)
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('SLA_BREACHED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isBreached
                  ? 'bg-red-600 text-white border-red-700 shadow'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              SLA Breached (Escalate to CERT-In)
            </button>
          </div>
        </div>
      )}

      {/* Certified RFC-Compliant Abuse Email Package */}
      {currentNotice && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Certified RFC-Compliant Takedown Email Package
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCopyEmailBody}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow transition-colors"
            >
              {copiedEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedEmail ? 'Copied Full Notice' : 'Copy RFC Notice Text'}
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-slate-200 font-mono text-xs space-y-3 overflow-x-auto">
            <div className="border-b border-slate-800 pb-2 space-y-1 text-slate-400">
              <div><strong className="text-blue-400">TO:</strong> {currentNotice.primary_recipient}</div>
              <div><strong className="text-blue-400">CC:</strong> {currentNotice.cc_recipients.join(', ')}</div>
              <div><strong className="text-blue-400">SUBJECT:</strong> {currentNotice.rfc_email_subject}</div>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
              {currentNotice.rfc_email_body}
            </pre>
          </div>
        </div>
      )}

      {/* Recent Dispatched Takedowns Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Recent Abuse Takedown Notices & Watchdog Audit Feed
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Notice ID</th>
                <th className="py-2.5 px-3">Target Domain</th>
                <th className="py-2.5 px-3">Hosting Provider</th>
                <th className="py-2.5 px-3">Registrar</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">DNS Online Status</th>
                <th className="py-2.5 px-3">Evidence Vault</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {notices.map((item) => (
                <tr
                  key={item.notice_id}
                  onClick={() => setCurrentNotice(item)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-white">
                    {item.notice_id}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">
                    {item.target_domain}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {item.dns_records.hosting_provider}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {item.dns_records.registrar_name}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'DOMAIN_SUSPENDED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.status === 'UNDER_REVIEW'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : item.status === 'SLA_BREACHED'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[11px] font-semibold ${
                        item.domain_offline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                      }`}
                    >
                      {item.domain_offline ? 'OFFLINE (NXDOMAIN)' : 'LIVE / ACTIVE'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                    {item.vaulted_evidence_id || 'Sealed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

