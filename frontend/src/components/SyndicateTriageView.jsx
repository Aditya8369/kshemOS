import { useState, useEffect } from 'react';
import {
  parseSyndicateChatApi,
  analyzeApkApi,
  uploadApkApi,
  fetchSyndicateCorrelationsApi,
  fetchSyndicateStatsApi,
  fetchSyndicateChatsApi,
  fetchSyndicateApksApi,
  SAMPLE_CHAT_WHATSAPP,
  SAMPLE_CHAT_TELEGRAM,
  SAMPLE_APK_PAYLOAD,
} from '../api';

export default function SyndicateTriageView({ activeIncidentId = null, onTraceInGraph = null }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'apk' | 'clusters'

  // Stats
  const [stats, setStats] = useState({
    total_chats_parsed: 0,
    total_apks_quarantined: 0,
    total_syndicate_clusters: 0,
    total_linked_incidents: 0,
    high_risk_admin_numbers: 0,
    crypto_wallets_indexed: 0,
    upi_handles_indexed: 0,
  });

  // Chat Tab State
  const [chatText, setChatText] = useState(SAMPLE_CHAT_WHATSAPP);
  const [chatPlatform, setChatPlatform] = useState('auto');
  const [chatIncidentId, setChatIncidentId] = useState(activeIncidentId || 'INC-2024-8841');
  const [chatOfficerBadge, setChatOfficerBadge] = useState('OFF-CYBER-88');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState(null);
  const [chatError, setChatError] = useState(null);

  // APK Tab State
  const [apkFilename, setApkFilename] = useState('e-Challan_Parivahan_v3.apk');
  const [apkPayloadText, setApkPayloadText] = useState(SAMPLE_APK_PAYLOAD);
  const [apkIncidentId, setApkIncidentId] = useState(activeIncidentId || 'INC-2024-8841');
  const [apkFile, setApkFile] = useState(null);
  const [apkLoading, setApkLoading] = useState(false);
  const [apkResult, setApkResult] = useState(null);
  const [apkError, setApkError] = useState(null);

  // Clusters & Correlation State
  const [correlations, setCorrelations] = useState(null);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    loadStats();
    loadCorrelations();
  }, []);

  async function loadStats() {
    try {
      const data = await fetchSyndicateStatsApi();
      setStats(data);
    } catch (err) {
      // ignore
    }
  }

  async function loadCorrelations() {
    setCorrelationsLoading(true);
    try {
      const data = await fetchSyndicateCorrelationsApi();
      setCorrelations(data);
    } catch (err) {
      // ignore
    } finally {
      setCorrelationsLoading(false);
    }
  }

  async function handleParseChat(e) {
    if (e) e.preventDefault();
    if (!chatText.trim()) return;

    setChatLoading(true);
    setChatError(null);
    try {
      const res = await parseSyndicateChatApi({
        raw_text: chatText,
        incident_id: chatIncidentId.trim() || undefined,
        source_platform: chatPlatform,
        officer_badge: chatOfficerBadge.trim() || 'OFFICER-SYS',
      });
      setChatResult(res);
      loadStats();
      loadCorrelations();
    } catch (err) {
      setChatError(err.message || 'Failed to parse chat log.');
    } finally {
      setChatLoading(false);
    }
  }

  async function handleAnalyzeApk(e) {
    if (e) e.preventDefault();
    setApkLoading(true);
    setApkError(null);

    try {
      let res;
      if (apkFile) {
        res = await uploadApkApi(apkFile, apkIncidentId.trim() || null, 'OFF-CYBER-88');
      } else {
        const b64 = btoa(unescape(encodeURIComponent(apkPayloadText)));
        res = await analyzeApkApi({
          filename: apkFilename.trim() || 'suspect_payload.apk',
          file_bytes_base64: b64,
          incident_id: apkIncidentId.trim() || undefined,
          officer_badge: 'OFF-CYBER-88',
        });
      }
      setApkResult(res);
      loadStats();
      loadCorrelations();
    } catch (err) {
      setApkError(err.message || 'Failed to analyze APK package.');
    } finally {
      setApkLoading(false);
    }
  }

  function copyToClipboard(key, text) {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div className="space-y-6 text-white">
      {/* Header Banner */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] font-semibold">
                Organized Cyber Syndicate Triage
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-[var(--alert)]/20 text-[var(--alert)] border border-[var(--alert)]/30">
                Sandbox Quarantine Active
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              WhatsApp & Telegram Syndicate Parser and APK Triage
            </h2>
            <p className="text-sm text-[var(--mist)] mt-1 max-w-3xl leading-relaxed">
              Ingest recruitment chats to extract invite links, international syndicate admin numbers,
              and crypto laundering wallets. Statically inspect untrusted Android APKs for accessibility
              service abuse and SMS interception without executing code.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                loadStats();
                loadCorrelations();
              }}
              className="px-3 py-2 text-xs font-mono rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-[var(--mist)] hover:text-white hover:border-[var(--saffron)] transition-colors min-h-[40px]"
            >
              🔄 Refresh Mappings
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[var(--navy-line)]">
          <div className="bg-[var(--ink)]/80 p-3 rounded-xl border border-[var(--navy-line)]">
            <div className="text-[11px] font-mono uppercase text-[var(--mist)]">Chats Ingested</div>
            <div className="text-xl font-bold font-mono text-[var(--saffron)] mt-0.5">{stats.total_chats_parsed}</div>
          </div>
          <div className="bg-[var(--ink)]/80 p-3 rounded-xl border border-[var(--navy-line)]">
            <div className="text-[11px] font-mono uppercase text-[var(--mist)]">APKs Quarantined</div>
            <div className="text-xl font-bold font-mono text-[var(--alert)] mt-0.5">{stats.total_apks_quarantined}</div>
          </div>
          <div className="bg-[var(--ink)]/80 p-3 rounded-xl border border-[var(--navy-line)]">
            <div className="text-[11px] font-mono uppercase text-[var(--mist)]">Syndicate Clusters</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{stats.total_syndicate_clusters}</div>
          </div>
          <div className="bg-[var(--ink)]/80 p-3 rounded-xl border border-[var(--navy-line)]">
            <div className="text-[11px] font-mono uppercase text-[var(--mist)]">Linked Incidents</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.total_linked_incidents}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[var(--navy-line)] flex items-center justify-between pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors min-h-[40px] ${
              activeTab === 'chat'
                ? 'bg-[var(--saffron)] text-white shadow-sm'
                : 'text-[var(--mist)] hover:text-white bg-[var(--navy)]/50'
            }`}
          >
            💬 Chat & Invite Link Parser
          </button>
          <button
            onClick={() => setActiveTab('apk')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors min-h-[40px] ${
              activeTab === 'apk'
                ? 'bg-[var(--saffron)] text-white shadow-sm'
                : 'text-[var(--mist)] hover:text-white bg-[var(--navy)]/50'
            }`}
          >
            🛡️ APK Static Inspector & Quarantine
          </button>
          <button
            onClick={() => setActiveTab('clusters')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors min-h-[40px] ${
              activeTab === 'clusters'
                ? 'bg-[var(--saffron)] text-white shadow-sm'
                : 'text-[var(--mist)] hover:text-white bg-[var(--navy)]/50'
            }`}
          >
            🕸️ Syndicate Correlation Matrix ({stats.total_syndicate_clusters})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Chat & Invite Link Parser */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Form Column */}
          <div className="lg:col-span-6 bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-white">Chat Transcript Ingestion</h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setChatText(SAMPLE_CHAT_WHATSAPP);
                    setChatPlatform('whatsapp');
                    setChatIncidentId('INC-2024-8841');
                  }}
                  className="px-2.5 py-1 text-xs font-mono rounded bg-[var(--ink)] text-[var(--saffron)] border border-[var(--navy-line)] hover:border-[var(--saffron)]"
                >
                  Load WhatsApp Sample
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatText(SAMPLE_CHAT_TELEGRAM);
                    setChatPlatform('telegram');
                    setChatIncidentId('INC-2024-9912');
                  }}
                  className="px-2.5 py-1 text-xs font-mono rounded bg-[var(--ink)] text-cyan-400 border border-[var(--navy-line)] hover:border-cyan-400"
                >
                  Load Telegram Sample
                </button>
              </div>
            </div>

            <form onSubmit={handleParseChat} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                    Linked Incident ID
                  </label>
                  <input
                    type="text"
                    value={chatIncidentId}
                    onChange={(e) => setChatIncidentId(e.target.value)}
                    placeholder="INC-2024-XXXX"
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                    Platform Hint
                  </label>
                  <select
                    value={chatPlatform}
                    onChange={(e) => setChatPlatform(e.target.value)}
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
                  >
                    <option value="auto">Auto-detect platform</option>
                    <option value="whatsapp">WhatsApp Group Export / OCR</option>
                    <option value="telegram">Telegram Channel / Direct</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                  Chat Log / Screenshot OCR Text
                </label>
                <textarea
                  rows={9}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Paste raw exported chat logs, OCR text from screenshots, or syndicate message broadcasts..."
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-3 text-xs font-mono text-white/90 focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                />
              </div>

              {chatError && (
                <div className="p-3 rounded-lg bg-[var(--alert)]/15 border border-[var(--alert)]/40 text-xs text-[var(--alert)]">
                  ⚠️ {chatError}
                </div>
              )}

              <button
                type="submit"
                disabled={chatLoading}
                className="w-full bg-[var(--saffron)] hover:bg-[var(--saffron)]/90 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
              >
                {chatLoading ? (
                  <>
                    <span className="animate-spin text-lg">⏳</span>
                    Extracting Syndicate Entities & Correlating...
                  </>
                ) : (
                  <>
                    <span>🔍</span> Parse & Correlate Syndicate Entities
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-6 space-y-4">
            {chatResult ? (
              <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-[var(--mist)] uppercase">Artifact ID</div>
                    <div className="text-sm font-mono font-bold text-[var(--saffron)]">{chatResult.artifact_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      chatResult.threat_band === 'CRITICAL' ? 'bg-[var(--alert)]/20 text-[var(--alert)] border border-[var(--alert)]/40' :
                      chatResult.threat_band === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      {chatResult.threat_band} ({Math.round(chatResult.risk_score * 100)}%)
                    </span>
                    <span className="text-xs font-mono text-[var(--mist)] uppercase px-2 py-1 rounded bg-[var(--ink)]">
                      {chatResult.source_platform}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs text-[var(--mist)] leading-relaxed">
                  {chatResult.summary}
                </div>

                {/* Extracted Phone Numbers */}
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-2 flex items-center justify-between">
                    <span>Admin & Recruiter Phone Numbers ({chatResult.phone_numbers.length})</span>
                    <span className="text-[10px] text-[var(--saffron)]">Flagged Hubs Indexed</span>
                  </div>
                  {chatResult.phone_numbers.length === 0 ? (
                    <div className="text-xs text-[var(--mist)]/60 italic p-2 bg-[var(--ink)]/50 rounded-lg">No phone numbers discovered.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {chatResult.phone_numbers.map((phone, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] flex items-center justify-between">
                          <div>
                            <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                              {phone.number}
                              {phone.is_syndicate_intl && (
                                <span className="text-[10px] bg-red-950/80 text-red-300 px-1.5 py-0.2 rounded border border-red-800">
                                  {phone.country}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--mist)] mt-0.5 capitalize">Role: {phone.role}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`phone-${i}`, phone.number)}
                            className="text-xs text-[var(--mist)] hover:text-white px-2 py-1 rounded bg-[var(--navy)]/80 min-h-[32px]"
                            title="Copy number"
                          >
                            {copiedKey === `phone-${i}` ? '✓' : '📋'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Crypto Wallets */}
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-2">
                    Crypto Laundering Wallets ({chatResult.crypto_wallets.length})
                  </div>
                  {chatResult.crypto_wallets.length === 0 ? (
                    <div className="text-xs text-[var(--mist)]/60 italic p-2 bg-[var(--ink)]/50 rounded-lg">No crypto wallets discovered.</div>
                  ) : (
                    <div className="space-y-2">
                      {chatResult.crypto_wallets.map((wallet, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] flex items-center justify-between">
                          <div className="overflow-hidden pr-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                                {wallet.network} ({wallet.standard})
                              </span>
                            </div>
                            <div className="font-mono text-xs text-white/90 truncate">{wallet.address}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`wallet-${i}`, wallet.address)}
                            className="text-xs text-[var(--mist)] hover:text-white px-2 py-1 rounded bg-[var(--navy)]/80 min-h-[32px] shrink-0"
                            title="Copy address"
                          >
                            {copiedKey === `wallet-${i}` ? '✓' : '📋'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Group Invites & UPI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-1">
                      Group Invites ({chatResult.invite_links.length})
                    </div>
                    {chatResult.invite_links.length === 0 ? (
                      <div className="text-xs text-[var(--mist)]/60 italic p-2 bg-[var(--ink)]/50 rounded-lg">None</div>
                    ) : (
                      <div className="space-y-1.5">
                        {chatResult.invite_links.map((inv, i) => (
                          <div key={i} className="p-2 rounded bg-[var(--ink)] border border-[var(--navy-line)] text-xs font-mono">
                            <span className="text-[var(--saffron)] font-bold">{inv.platform}:</span> {inv.code}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-1">
                      Mule UPI Handles ({chatResult.upi_ids.length})
                    </div>
                    {chatResult.upi_ids.length === 0 ? (
                      <div className="text-xs text-[var(--mist)]/60 italic p-2 bg-[var(--ink)]/50 rounded-lg">None</div>
                    ) : (
                      <div className="space-y-1.5">
                        {chatResult.upi_ids.map((vpa, i) => (
                          <div key={i} className="p-2 rounded bg-[var(--ink)] border border-[var(--navy-line)] text-xs font-mono text-emerald-400">
                            {vpa}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fraud Graph Link Notice */}
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between">
                  <div className="text-xs text-cyan-200">
                    <span className="font-bold">Fraud Graph Integration:</span> Injected {chatResult.graph_nodes_injected} indicator nodes.
                    Cluster ID: <span className="font-mono text-cyan-400">{chatResult.cluster_id}</span>
                  </div>
                  {onTraceInGraph && (
                    <button
                      type="button"
                      onClick={() => onTraceInGraph(`INCIDENT:${chatResult.incident_id}`)}
                      className="px-2.5 py-1 text-xs font-mono rounded bg-cyan-800 hover:bg-cyan-700 text-white min-h-[32px]"
                    >
                      View in Graph →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[var(--navy)]/50 border border-dashed border-[var(--navy-line)] rounded-2xl p-12 text-center text-[var(--mist)] space-y-2">
                <div className="text-3xl">💬</div>
                <div className="font-display text-base font-semibold text-white">No Chat Ingested Yet</div>
                <p className="text-xs max-w-sm mx-auto">
                  Paste WhatsApp or Telegram export logs on the left or click "Load Sample" to triage syndicate recruitment infrastructure.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: APK Static Inspector & Quarantine */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'apk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* APK Input Form */}
          <div className="lg:col-span-5 bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-white">Android APK Static Triage</h3>
              <button
                type="button"
                onClick={() => {
                  setApkFilename('e-Challan_Parivahan_v3.apk');
                  setApkPayloadText(SAMPLE_APK_PAYLOAD);
                  setApkIncidentId('INC-2024-8841');
                  setApkFile(null);
                }}
                className="px-2.5 py-1 text-xs font-mono rounded bg-[var(--ink)] text-[var(--alert)] border border-[var(--navy-line)] hover:border-[var(--alert)]"
              >
                Load SpyDropper Sample
              </button>
            </div>

            <form onSubmit={handleAnalyzeApk} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                  Package / File Name
                </label>
                <input
                  type="text"
                  value={apkFilename}
                  onChange={(e) => setApkFilename(e.target.value)}
                  placeholder="suspect_application.apk"
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                  Linked Incident ID
                </label>
                <input
                  type="text"
                  value={apkIncidentId}
                  onChange={(e) => setApkIncidentId(e.target.value)}
                  placeholder="INC-2024-XXXX"
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] min-h-[44px]"
                />
              </div>

              {/* Upload file or paste strings */}
              <div>
                <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                  Upload Binary APK File (Isolated Sandbox)
                </label>
                <input
                  type="file"
                  accept=".apk,.bin,.zip,.txt"
                  onChange={(e) => setApkFile(e.target.files?.[0] || null)}
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-xs font-mono text-[var(--mist)] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[var(--saffron)] file:text-white"
                />
                {apkFile && (
                  <p className="mt-1 text-xs text-emerald-400 font-mono">
                    Selected binary: {apkFile.name} ({(apkFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {!apkFile && (
                <div>
                  <label className="block text-xs font-mono text-[var(--mist)] uppercase mb-1">
                    Or Inspect Manifest & Binary Strings
                  </label>
                  <textarea
                    rows={6}
                    value={apkPayloadText}
                    onChange={(e) => setApkPayloadText(e.target.value)}
                    placeholder="Paste AndroidManifest permissions, package components, or extracted DEX strings..."
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-3 text-xs font-mono text-white/90 focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                  />
                </div>
              )}

              {apkError && (
                <div className="p-3 rounded-lg bg-[var(--alert)]/15 border border-[var(--alert)]/40 text-xs text-[var(--alert)]">
                  ⚠️ {apkError}
                </div>
              )}

              <button
                type="submit"
                disabled={apkLoading}
                className="w-full bg-[var(--alert)] hover:bg-[var(--alert)]/90 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
              >
                {apkLoading ? (
                  <>
                    <span className="animate-spin text-lg">⏳</span>
                    Quarantining & Inspecting Permissions...
                  </>
                ) : (
                  <>
                    <span>🛡️</span> Quarantine & Inspect APK Manifest
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Inspection Results */}
          <div className="lg:col-span-7 space-y-4">
            {apkResult ? (
              <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 space-y-5">
                {/* Threat Banner & Quarantine Confirmation */}
                <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-[var(--mist)] uppercase">Malware Classification</div>
                      <div className="text-base font-bold text-white font-display mt-0.5">{apkResult.malware_family}</div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--alert)]/20 text-[var(--alert)] border border-[var(--alert)]/40">
                      {apkResult.threat_level} ({Math.round(apkResult.overall_risk_score * 100)}%)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--navy-line)] text-xs font-mono text-emerald-400">
                    <span>🔒</span>
                    <span>Safely Quarantined:</span>
                    <span className="text-[var(--mist)] truncate">{apkResult.quarantine_path}</span>
                  </div>
                </div>

                {/* Hashes & Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)]">
                    <span className="text-[var(--mist)]">SHA-256 Fingerprint:</span>
                    <div className="text-white truncate font-bold mt-0.5">{apkResult.sha256}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)]">
                    <span className="text-[var(--mist)]">Package & Version:</span>
                    <div className="text-white truncate font-bold mt-0.5">{apkResult.package_name} (v{apkResult.version_name})</div>
                  </div>
                </div>

                {/* Dangerous Permissions Table */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] mb-2 flex items-center justify-between">
                    <span>Dangerous Android Permissions Flagged ({apkResult.dangerous_permissions.length})</span>
                    <span className="text-[10px] text-[var(--alert)]">Static Sandbox Analysis</span>
                  </h4>

                  {apkResult.dangerous_permissions.length === 0 ? (
                    <div className="p-3 rounded-lg bg-[var(--ink)] text-xs text-[var(--mist)] italic">
                      No dangerous permissions detected in this package.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {apkResult.dangerous_permissions.map((perm, i) => (
                        <div key={i} className="p-3 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-white">{perm.permission}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                              perm.risk_level === 'CRITICAL' ? 'bg-red-950 text-red-300 border border-red-800' :
                              'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {perm.risk_level}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--mist)]/90">{perm.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* C2 Endpoints */}
                {apkResult.c2_endpoints.length > 0 && (
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--alert)] mb-2">
                      Command-and-Control (C2) Exfiltration Channels ({apkResult.c2_endpoints.length})
                    </h4>
                    <div className="space-y-2">
                      {apkResult.c2_endpoints.map((c2, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-xs font-mono flex items-center justify-between">
                          <div>
                            <span className="text-red-400 font-bold uppercase">[{c2.endpoint_type}]</span> {c2.target}
                            <div className="text-[10px] text-[var(--mist)] mt-0.5">{c2.notes}</div>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] bg-red-900/60 text-red-200 rounded">FLAGGED C2</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--navy)]/50 border border-dashed border-[var(--navy-line)] rounded-2xl p-12 text-center text-[var(--mist)] space-y-2">
                <div className="text-3xl">🛡️</div>
                <div className="font-display text-base font-semibold text-white">No APK Analyzed Yet</div>
                <p className="text-xs max-w-sm mx-auto">
                  Upload an Android package or click "Load SpyDropper Sample" to inspect accessibility services, SMS interception, and C2 beacons.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: Syndicate Correlation Matrix & Cross-Report Linker */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'clusters' && (
        <div className="space-y-6">
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Cross-Report Syndicate Correlation Matrix
                </h3>
                <p className="text-xs text-[var(--mist)] mt-0.5">
                  Disparate citizen reports connected by shared recruitment group links, international admin phones, or crypto addresses.
                </p>
              </div>
              <button
                type="button"
                onClick={loadCorrelations}
                disabled={correlationsLoading}
                className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] transition-colors min-h-[36px]"
              >
                {correlationsLoading ? 'Refreshing...' : '🔄 Refresh Matrix'}
              </button>
            </div>

            {correlations?.clusters?.length > 0 ? (
              <div className="space-y-4">
                {correlations.clusters.map((cluster) => (
                  <div key={cluster.cluster_id} className="p-5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--navy-line)] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-cyan-400">{cluster.cluster_id}</span>
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-red-950 text-red-300 border border-red-800">
                            {cluster.threat_tier}
                          </span>
                        </div>
                        <div className="text-xs text-white/90 font-medium mt-0.5">{cluster.cluster_name}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--mist)] font-mono">
                          Linked Incidents: <span className="text-white font-bold">{cluster.linked_incidents?.length || 0}</span>
                        </span>
                        {onTraceInGraph && (
                          <button
                            type="button"
                            onClick={() => onTraceInGraph(`CLUSTER:${cluster.cluster_id}`)}
                            className="px-3 py-1 text-xs font-mono rounded bg-[var(--saffron)] hover:bg-[var(--saffron)]/90 text-white min-h-[32px]"
                          >
                            Trace in Fraud Graph →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Linked Incident Badges */}
                    <div>
                      <div className="text-[11px] font-mono uppercase text-[var(--mist)] mb-1.5">
                        Correlated Citizen Reports Sharing Infrastructure:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cluster.linked_incidents?.map((inc) => (
                          <span
                            key={inc}
                            className="px-2.5 py-1 rounded-lg bg-[var(--navy)] border border-[var(--navy-line)] text-xs font-mono font-bold text-emerald-400"
                          >
                            📁 {inc}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Indicators Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono pt-2">
                      <div className="p-2.5 rounded bg-[var(--navy)]/60 border border-[var(--navy-line)]">
                        <div className="text-[10px] text-[var(--mist)] uppercase">Admin Numbers</div>
                        <div className="mt-1 text-white truncate">
                          {cluster.indicators?.PHONE?.join(', ') || '—'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[var(--navy)]/60 border border-[var(--navy-line)]">
                        <div className="text-[10px] text-[var(--mist)] uppercase">TRON / Crypto Wallets</div>
                        <div className="mt-1 text-amber-300 truncate">
                          {cluster.indicators?.CRYPTO?.join(', ') || '—'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[var(--navy)]/60 border border-[var(--navy-line)]">
                        <div className="text-[10px] text-[var(--mist)] uppercase">Group Invites</div>
                        <div className="mt-1 text-cyan-300 truncate">
                          {cluster.indicators?.GROUP?.join(', ') || '—'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[var(--navy)]/60 border border-[var(--navy-line)]">
                        <div className="text-[10px] text-[var(--mist)] uppercase">UPI Collection VPAs</div>
                        <div className="mt-1 text-emerald-300 truncate">
                          {cluster.indicators?.UPI?.join(', ') || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[var(--mist)]">
                No active syndicate clusters recorded yet. Ingest chat logs or APKs above to generate cross-report correlations.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

