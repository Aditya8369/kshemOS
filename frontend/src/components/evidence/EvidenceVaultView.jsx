import { useState, useEffect, useCallback } from 'react';
import {
  fetchEvidenceItems,
  fetchCustodialLedgerApi,
  ingestEvidenceApi,
  logCustodialActionApi,
  toggleLegalHoldApi,
  verifyEvidenceIntegrityApi,
  generateForensicBundleApi,
  fetchRetentionPoliciesApi,
  fetchUploadLinksApi,
  createUploadLinkApi,
  revokeUploadLinkApi,
  sha256Sync,
  EVIDENCE_CHANGED_EVENT,
} from '../../evidenceStore.js';
import CitizenEvidenceUploadPortal from './CitizenEvidenceUploadPortal.jsx';

const TYPE_ICONS = {
  audio_recording: '🎙️',
  document: '📄',
  transaction_receipt: '💳',
  image_screenshot: '🖼️',
  chat_transcript: '💬',
  video: '📹',
  other: '📁',
};

const CATEGORY_LABELS = {
  digital_arrest: 'Digital Arrest Scam',
  financial_fraud: 'Financial Fraud & UPI',
  counterfeit_currency: 'Counterfeit Currency',
  identity_theft: 'Identity Theft & KYC',
  cyber_extortion: 'Cyber Extortion',
  other: 'General Incident',
};

export default function EvidenceVaultView({ activeCaseId = null }) {
  const [items, setItems] = useState([]);
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaseFilter, setSelectedCaseFilter] = useState(activeCaseId || '');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [holdOnlyFilter, setHoldOnlyFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // SubTab view: 'evidence' | 'upload_links'
  const [vaultSubTab, setVaultSubTab] = useState('evidence');
  const [uploadLinks, setUploadLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);

  // Modals & Drawers
  const [selectedItemForLedger, setSelectedItemForLedger] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const [showIngestModal, setShowIngestModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleData, setBundleData] = useState(null);
  const [bundleLoading, setBundleLoading] = useState(false);

  // Secure Upload Link Modals
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [targetRevokeLink, setTargetRevokeLink] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [previewCitizenToken, setPreviewCitizenToken] = useState(null);
  const [copyNotification, setCopyNotification] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Ingest form state
  const [ingestForm, setIngestForm] = useState({
    case_id: activeCaseId || 'CASE-2026-DELHI-01',
    title: '',
    description: '',
    evidence_type: 'document',
    category: 'digital_arrest',
    source: 'citizen_report',
    raw_content: '',
    file_name: '',
    officer_badge_id: 'OFF-VAULT-01',
    officer_name: 'Officer Ingest',
    legal_hold: false,
    legal_hold_reason: '',
  });
  const [ingesting, setIngesting] = useState(false);
  const [actionOfficer, setActionOfficer] = useState('OFF-INSPECT-01');
  const [annotateNotes, setAnnotateNotes] = useState('');

  // Create Upload Link form state
  const [createLinkForm, setCreateLinkForm] = useState({
    report_id: activeCaseId || 'RPT-0001',
    incident_id: 'INC-001',
    title: 'Extortion Call Recording & WhatsApp Chats',
    description: 'Please upload the screen recording, audio call clip, or bank transfer slip.',
    allowed_file_types: ['application/pdf', 'image/png', 'image/jpeg', 'audio/wav', 'audio/mpeg', 'video/mp4'],
    max_file_size_bytes: 25 * 1024 * 1024,
    expiry_minutes: 60,
    requires_passcode: false,
    passcode: '',
    created_by_badge: 'OFF-VAULT-01',
    officer_name: 'Investigating Officer',
    recipient_email: '',
    recipient_phone: '',
  });
  const [creatingLink, setCreatingLink] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [fetchedItems, policies, fetchedLinks] = await Promise.all([
        fetchEvidenceItems({
          caseId: selectedCaseFilter || undefined,
          category: selectedCategoryFilter || undefined,
          legalHold: holdOnlyFilter ? true : undefined,
        }),
        fetchRetentionPoliciesApi(),
        fetchUploadLinksApi(),
      ]);
      setItems(fetchedItems);
      setRetentionPolicies(policies);
      setUploadLinks(fetchedLinks);
    } catch (err) {
      console.error('Failed to load evidence vault data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCaseFilter, selectedCategoryFilter, holdOnlyFilter]);

  useEffect(() => {
    loadData();
    const handleEvidenceChange = () => loadData();
    window.addEventListener(EVIDENCE_CHANGED_EVENT, handleEvidenceChange);
    return () => window.removeEventListener(EVIDENCE_CHANGED_EVENT, handleEvidenceChange);
  }, [loadData]);

  // Open Custodial Ledger Drawer
  async function handleOpenLedger(item) {
    setSelectedItemForLedger(item);
    setLedgerLoading(true);
    setVerificationResult(null);
    try {
      const [ledger, ver] = await Promise.all([
        fetchCustodialLedgerApi(item.id),
        verifyEvidenceIntegrityApi(item.id),
      ]);
      setLedgerEntries(ledger);
      setVerificationResult(ver);
    } catch (err) {
      alert(`Error fetching custodial ledger: ${err.message}`);
    } finally {
      setLedgerLoading(false);
    }
  }

  // Toggle Litigation Hold
  async function handleToggleLegalHold(item) {
    const nextHold = !item.legal_hold;
    let reason = item.legal_hold_reason;
    if (nextHold) {
      const prompted = window.prompt(
        'Enter statutory justification for imposing litigation legal-hold:',
        'Active Sessions Court Trial - Crime Exhibit'
      );
      if (!prompted) return;
      reason = prompted;
    }

    try {
      const updated = await toggleLegalHoldApi(item.id, {
        legalHold: nextHold,
        reason,
        officerBadgeId: actionOfficer,
        officerName: 'Authorizing Officer',
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
      if (selectedItemForLedger?.id === item.id) {
        setSelectedItemForLedger((prev) => ({ ...prev, ...updated }));
        const ledger = await fetchCustodialLedgerApi(item.id);
        setLedgerEntries(ledger);
      }
    } catch (err) {
      alert(`Failed to update legal hold: ${err.message}`);
    }
  }

  // Log Custom Officer Annotation
  async function handleLogAnnotation(e) {
    e.preventDefault();
    if (!selectedItemForLedger || !annotateNotes.trim()) return;
    try {
      await logCustodialActionApi(selectedItemForLedger.id, {
        action: 'OFFICER_ANNOTATION',
        officer_badge_id: actionOfficer,
        officer_name: 'Investigating Officer',
        client_ip: '127.0.0.1',
        details: annotateNotes.trim(),
      });
      setAnnotateNotes('');
      const ledger = await fetchCustodialLedgerApi(selectedItemForLedger.id);
      setLedgerEntries(ledger);
    } catch (err) {
      alert(`Failed to log action: ${err.message}`);
    }
  }

  // Submit Ingestion
  async function handleIngestSubmit(e) {
    e.preventDefault();
    setIngesting(true);
    try {
      const newItem = await ingestEvidenceApi({
        ...ingestForm,
        file_name: ingestForm.file_name || `${ingestForm.title.toLowerCase().replace(/\s+/g, '_')}.dat`,
      });
      setShowIngestModal(false);
      setItems((prev) => [newItem, ...prev]);
      setIngestForm({
        case_id: activeCaseId || 'CASE-2026-DELHI-01',
        title: '',
        description: '',
        evidence_type: 'document',
        category: 'digital_arrest',
        source: 'citizen_report',
        raw_content: '',
        file_name: '',
        officer_badge_id: 'OFF-VAULT-01',
        officer_name: 'Officer Ingest',
        legal_hold: false,
        legal_hold_reason: '',
      });
    } catch (err) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  }

  // Create Upload Link Submit
  async function handleCreateLinkSubmit(e) {
    e.preventDefault();
    setCreatingLink(true);
    try {
      const link = await createUploadLinkApi(createLinkForm);
      setShowCreateLinkModal(false);
      setUploadLinks((prev) => [link, ...prev]);
      setCopyNotification(`Created single-purpose link for ${link.report_id}!`);
      setTimeout(() => setCopyNotification(''), 4000);
    } catch (err) {
      alert(`Failed to create upload link: ${err.message}`);
    } finally {
      setCreatingLink(false);
    }
  }

  // Revoke Upload Link Submit
  async function handleRevokeSubmit(e) {
    e.preventDefault();
    if (!targetRevokeLink) return;
    try {
      const updated = await revokeUploadLinkApi(targetRevokeLink.link_id, {
        revokedByBadge: actionOfficer,
        officerName: 'Authorizing Officer',
        revocationReason: revokeReason || 'Administrative revocation',
      });
      setShowRevokeModal(false);
      setTargetRevokeLink(null);
      setRevokeReason('');
      setUploadLinks((prev) => prev.map((l) => (l.link_id === updated.link_id ? updated : l)));
    } catch (err) {
      alert(`Failed to revoke link: ${err.message}`);
    }
  }

  function copyLinkToClipboard(link) {
    const fullUrl = window.location.origin + link.upload_url;
    navigator.clipboard?.writeText(fullUrl);
    setCopyNotification(`Copied upload URL for ${link.link_id} to clipboard!`);
    setTimeout(() => setCopyNotification(''), 4000);
  }

  // Generate Forensic Export Bundle
  async function handleGenerateBundle(targetCaseId) {
    setBundleLoading(true);
    setShowBundleModal(true);
    try {
      const bundle = await generateForensicBundleApi(targetCaseId || selectedCaseFilter || 'CASE-2026-DELHI-01', actionOfficer);
      setBundleData(bundle);
    } catch (err) {
      alert(`Failed to generate bundle: ${err.message}`);
    } finally {
      setBundleLoading(false);
    }
  }

  // Filter items
  const filteredItems = items.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.case_id?.toLowerCase().includes(q) ||
        item.file_name?.toLowerCase().includes(q) ||
        item.sha256_hash?.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const totalVaulted = items.length;
  const activeLegalHolds = items.filter((i) => i.legal_hold).length;
  const activeLinksCount = uploadLinks.filter((l) => l.status === 'active' && !l.is_expired).length;
  const uniqueCases = new Set(items.map((i) => i.case_id)).size;

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Vaulted Artifacts</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">{totalVaulted}</div>
          <div className="text-[11px] text-[var(--mist)] mt-0.5">SHA-256 Fingerprinted</div>
        </div>

        <div
          onClick={() => setVaultSubTab('upload_links')}
          className="bg-[var(--navy)] border border-cyan-500/40 rounded-xl p-4 bg-cyan-950/20 cursor-pointer hover:bg-cyan-900/30 transition"
        >
          <div className="text-[10px] font-mono uppercase text-cyan-300 flex items-center justify-between">
            <span>Citizen Upload Links</span>
            <span className="animate-pulse">🔗</span>
          </div>
          <div className="font-mono text-2xl font-bold text-cyan-300 mt-1">{activeLinksCount} Active</div>
          <div className="text-[11px] text-cyan-200/80 mt-0.5">Zero-Email Custody</div>
        </div>

        <div className="bg-[var(--navy)] border border-amber-500/40 rounded-xl p-4 bg-amber-950/20">
          <div className="text-[10px] font-mono uppercase text-amber-300 flex items-center justify-between">
            <span>Litigation Holds</span>
            <span>🔒</span>
          </div>
          <div className="font-mono text-2xl font-bold text-amber-300 mt-1">{activeLegalHolds}</div>
          <div className="text-[11px] text-amber-200/80 mt-0.5">Retention Freeze Active</div>
        </div>

        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Active Cyber Cases</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">{uniqueCases}</div>
          <div className="text-[11px] text-[var(--mist)] mt-0.5">Court Case Files</div>
        </div>

        <div
          onClick={() => handleGenerateBundle()}
          className="bg-[var(--navy)] border border-[var(--saffron)] rounded-xl p-4 cursor-pointer hover:bg-[var(--saffron)]/10 transition"
        >
          <div className="text-[10px] font-mono uppercase text-[var(--saffron)]">Forensic Bundles</div>
          <div className="font-mono text-base font-bold text-white mt-1">Court Package</div>
          <div className="text-[11px] text-[var(--saffron)] mt-0.5">Generate § 65B Bundle →</div>
        </div>
      </div>

      {copyNotification && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="font-semibold">{copyNotification}</span>
          </div>
          <button onClick={() => setCopyNotification('')} className="text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Console & Filter Toolbar */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--navy-line)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--saffron)]">
                Digital Evidence Vault
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white">
                RFC 3161 Authenticated
              </span>
            </div>
            <h2 className="font-display text-2xl font-semibold mt-1">Chain of Custody & Evidence Repository</h2>
            <p className="text-xs text-[var(--mist)] mt-0.5">
              Tamper-evident evidence vault enforcing cryptographic fingerprints, immutable custodial logs, and case-scoped upload links.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateLinkModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition flex items-center gap-1.5"
            >
              <span>🔗</span> New Upload Link
            </button>
            <button
              onClick={() => handleGenerateBundle(selectedCaseFilter)}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] hover:bg-white/5 transition flex items-center gap-1.5"
            >
              <span>🏛️</span> Export Court Bundle
            </button>
            <button
              onClick={() => setShowIngestModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--saffron)] text-white hover:brightness-110 shadow-md transition flex items-center gap-1.5"
            >
              <span>+</span> Ingest New Evidence
            </button>
          </div>
        </div>

        {/* SUBTAB VIEW SWITCHER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setVaultSubTab('evidence')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                vaultSubTab === 'evidence'
                  ? 'bg-[var(--saffron)] text-white shadow'
                  : 'bg-[var(--ink)] text-[var(--mist)] hover:text-white border border-[var(--navy-line)]'
              }`}
            >
              📁 Vaulted Evidence Items ({items.length})
            </button>
            <button
              onClick={() => setVaultSubTab('upload_links')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                vaultSubTab === 'upload_links'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-[var(--ink)] text-[var(--mist)] hover:text-white border border-[var(--navy-line)]'
              }`}
            >
              <span>🔗</span>
              <span>Secure Citizen Upload Links ({uploadLinks.length})</span>
              {activeLinksCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* SUBTAB 1: VAULTED EVIDENCE ITEMS */}
        {vaultSubTab === 'evidence' && (
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[var(--ink)] p-3 rounded-xl border border-[var(--navy-line)] text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Search Vault</label>
                <input
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-white placeholder-[var(--mist)]/50"
                  placeholder="Title, hash, tag, or file..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Case Filter</label>
                <select
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-white"
                  value={selectedCaseFilter}
                  onChange={(e) => setSelectedCaseFilter(e.target.value)}
                >
                  <option value="">All Cases</option>
                  <option value="CASE-2026-DELHI-01">CASE-2026-DELHI-01 (Digital Arrest Ring)</option>
                  <option value="CASE-2026-NCR-02">CASE-2026-NCR-02 (Counterfeit Currency)</option>
                  <option value="RPT-0001">RPT-0001 (Citizen Intake)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Crime Category</label>
                <select
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-white"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="digital_arrest">Digital Arrest</option>
                  <option value="financial_fraud">Financial Fraud</option>
                  <option value="counterfeit_currency">Counterfeit Currency</option>
                  <option value="identity_theft">Identity Theft</option>
                  <option value="cyber_extortion">Cyber Extortion</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setHoldOnlyFilter(!holdOnlyFilter)}
                  className={`w-full py-2 rounded-lg font-mono text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                    holdOnlyFilter
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-[var(--navy)] text-[var(--mist)] border-[var(--navy-line)] hover:text-white'
                  }`}
                >
                  <span>🔒</span> {holdOnlyFilter ? 'Filtering: Holds Only' : 'Show Legal Holds Only'}
                </button>
              </div>
            </div>

            {/* Evidence Table */}
            {loading ? (
              <div className="p-12 text-center text-sm text-[var(--mist)]">Loading evidence vault repository…</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-[var(--navy-line)] rounded-xl text-xs text-[var(--mist)]">
                No evidence artifacts matched the selected filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--navy-line)] text-[var(--mist)] font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">Type & ID</th>
                      <th className="py-2.5 px-3">Artifact Title & Case</th>
                      <th className="py-2.5 px-3">SHA-256 Digest</th>
                      <th className="py-2.5 px-3">RFC 3161 TSA Serial</th>
                      <th className="py-2.5 px-3">Retention Schedule</th>
                      <th className="py-2.5 px-3">Legal Hold</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--navy-line)]">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{TYPE_ICONS[item.evidence_type] || '📁'}</span>
                            <div>
                              <div className="font-mono font-bold text-white">{item.id}</div>
                              <div className="text-[10px] font-mono text-[var(--mist)] capitalize">
                                {item.evidence_type?.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{item.title}</div>
                          <div className="text-[11px] text-[var(--mist)] flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[var(--saffron)]">{item.case_id}</span>
                            <span>•</span>
                            <span className="text-white/80">{CATEGORY_LABELS[item.category] || item.category}</span>
                            {item.source === 'citizen_upload_link' && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-mono">
                                Citizen Link
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <div className="flex items-center gap-1.5 text-white/90">
                            <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[10px]">
                              {item.sha256_hash?.slice(0, 8)}...{item.sha256_hash?.slice(-8)}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px]">
                            {item.rfc3161_token?.serial_number}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-[11px] font-mono text-white/90">{item.retention_days} Days</div>
                          <div className="text-[10px] text-[var(--mist)]">
                            Until {new Date(item.retention_until).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleToggleLegalHold(item)}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition border flex items-center gap-1 ${
                              item.legal_hold
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                            }`}
                          >
                            <span>{item.legal_hold ? '🔒 Hold Imposed' : '🔓 Unlocked'}</span>
                          </button>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenLedger(item)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--ink)] border border-[var(--navy-line)] hover:border-[var(--saffron)] hover:text-white text-[var(--mist)] transition"
                          >
                            View Custody Ledger →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: SECURE CITIZEN UPLOAD LINKS */}
        {vaultSubTab === 'upload_links' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)]">
              <div>
                <h3 className="font-semibold text-sm text-cyan-300">Case-Scoped Evidence Upload Requests</h3>
                <p className="text-xs text-[var(--mist)]">
                  Generate secure, time-bounded links for complainants to upload evidence directly into the vault. No attachments in email.
                </p>
              </div>
              <button
                onClick={() => setShowCreateLinkModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition flex items-center gap-1.5"
              >
                <span>+</span> Generate Single-Purpose Link
              </button>
            </div>

            {uploadLinks.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-[var(--navy-line)] rounded-xl text-xs text-[var(--mist)]">
                No evidence upload links generated yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--navy-line)] text-[var(--mist)] font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">Link ID & Case</th>
                      <th className="py-2.5 px-3">Title & Instructions</th>
                      <th className="py-2.5 px-3">Allowed Formats & Max Size</th>
                      <th className="py-2.5 px-3">Expiry / Status</th>
                      <th className="py-2.5 px-3">Passcode</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--navy-line)]">
                    {uploadLinks.map((link) => {
                      const now = Date.now();
                      const isExpired = link.is_expired || now > link.expires_at;
                      const minutesLeft = Math.max(0, Math.round((link.expires_at - now) / 60000));

                      return (
                        <tr key={link.link_id} className="hover:bg-white/5 transition">
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-cyan-300">{link.link_id}</div>
                            <div className="text-[11px] font-mono text-[var(--saffron)] mt-0.5">
                              {link.report_id}
                              {link.incident_id && ` • ${link.incident_id}`}
                            </div>
                            <div className="text-[10px] text-[var(--mist)] mt-0.5">
                              By: {link.created_by_badge}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{link.title}</div>
                            <div className="text-[11px] text-[var(--mist)] max-w-xs truncate mt-0.5" title={link.description}>
                              {link.description}
                            </div>
                            {link.recipient_email && (
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                Recipient: {link.recipient_email}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-mono text-cyan-300 text-[10px] max-w-xs">
                              {link.allowed_file_types?.map((t) => t.split('/')[1] || t).join(', ').toUpperCase()}
                            </div>
                            <div className="text-[10px] text-[var(--mist)] font-mono mt-0.5">
                              Max: {(link.max_file_size_bytes / (1024 * 1024)).toFixed(0)} MB
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {link.status === 'completed' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                ✓ FULFILLED
                              </span>
                            ) : link.status === 'revoked' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                                ✕ REVOKED
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-700 text-gray-300 border border-gray-600">
                                EXPIRED
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  ACTIVE ({minutesLeft}m left)
                                </span>
                                <div className="text-[10px] font-mono text-[var(--mist)]">
                                  Until {new Date(link.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {link.requires_passcode ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40" title={link.passcode_hint || ''}>
                                🔒 Passcode Req
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-gray-400">Standard</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => copyLinkToClipboard(link)}
                                className="px-2.5 py-1 rounded bg-[var(--ink)] hover:bg-[var(--navy-line)] border border-[var(--navy-line)] text-cyan-300 text-[11px] font-semibold transition"
                                title="Copy upload URL"
                              >
                                📋 Copy URL
                              </button>
                              <button
                                onClick={() => setPreviewCitizenToken(link.token)}
                                className="px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-[11px] font-semibold transition"
                                title="Test upload link directly as citizen"
                              >
                                🌐 Open Portal
                              </button>
                              {link.status === 'completed' && link.receipt && (
                                <button
                                  onClick={() => setSelectedReceipt(link.receipt)}
                                  className="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-[11px] font-semibold transition"
                                >
                                  🧾 Receipt
                                </button>
                              )}
                              {link.status === 'active' && !isExpired && (
                                <button
                                  onClick={() => {
                                    setTargetRevokeLink(link);
                                    setShowRevokeModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 border border-red-700 text-red-200 text-[11px] font-semibold transition"
                                  title="Revoke active upload link"
                                >
                                  ✕ Revoke
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CREATE SECURE UPLOAD LINK */}
      {showCreateLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateLinkSubmit}
            className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔗</span>
                <h3 className="font-semibold text-lg text-white">Generate Secure Evidence Upload Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateLinkModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 text-xs">
              <strong>Zero-Email Transmission Guarantee:</strong> This single-purpose link binds evidence directly to the case vault with RFC 3161 timestamps, keeping sensitive citizen files out of unencrypted email attachments.
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-[var(--mist)]">Report / Case ID:</label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                  value={createLinkForm.report_id}
                  onChange={(e) => setCreateLinkForm({ ...createLinkForm, report_id: e.target.value })}
                  placeholder="RPT-0001"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[var(--mist)]">Incident ID (Optional):</label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                  value={createLinkForm.incident_id}
                  onChange={(e) => setCreateLinkForm({ ...createLinkForm, incident_id: e.target.value })}
                  placeholder="INC-001"
                />
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-mono text-[var(--mist)]">Evidence Request Title:</label>
              <input
                className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[var(--saffron)]"
                value={createLinkForm.title}
                onChange={(e) => setCreateLinkForm({ ...createLinkForm, title: e.target.value })}
                placeholder="e.g. Scammer WhatsApp Video Call Recording"
                required
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-mono text-[var(--mist)]">Instructions for Citizen:</label>
              <textarea
                className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2.5 text-white focus:outline-none focus:border-[var(--saffron)]"
                rows={2}
                value={createLinkForm.description}
                onChange={(e) => setCreateLinkForm({ ...createLinkForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-[var(--mist)]">Expiry Duration:</label>
                <select
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white focus:outline-none"
                  value={createLinkForm.expiry_minutes}
                  onChange={(e) => setCreateLinkForm({ ...createLinkForm, expiry_minutes: Number(e.target.value) })}
                >
                  <option value={15}>15 Minutes (Urgent)</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>1 Hour (Standard)</option>
                  <option value={1440}>24 Hours</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[var(--mist)]">Max Upload Size:</label>
                <select
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white focus:outline-none"
                  value={createLinkForm.max_file_size_bytes}
                  onChange={(e) => setCreateLinkForm({ ...createLinkForm, max_file_size_bytes: Number(e.target.value) })}
                >
                  <option value={10 * 1024 * 1024}>10 MB</option>
                  <option value={25 * 1024 * 1024}>25 MB (Standard)</option>
                  <option value={50 * 1024 * 1024}>50 MB</option>
                  <option value={100 * 1024 * 1024}>100 MB</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createLinkForm.requires_passcode}
                    onChange={(e) => setCreateLinkForm({ ...createLinkForm, requires_passcode: e.target.checked })}
                    className="rounded bg-black border-gray-600"
                  />
                  <span className="font-semibold text-white">Require Verification Passcode</span>
                </label>
                <span className="text-[10px] text-[var(--mist)] font-mono">Optional OTP / PIN</span>
              </div>
              {createLinkForm.requires_passcode && (
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-mono text-[var(--mist)]">Access Passcode (e.g. 7492):</label>
                  <input
                    className="w-full bg-black/40 border border-[var(--navy-line)] rounded-lg px-3 py-1.5 font-mono text-center text-cyan-300"
                    placeholder="Leave blank to auto-generate"
                    value={createLinkForm.passcode}
                    onChange={(e) => setCreateLinkForm({ ...createLinkForm, passcode: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-[var(--mist)]">Citizen Email (Optional):</label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white"
                  value={createLinkForm.recipient_email}
                  onChange={(e) => setCreateLinkForm({ ...createLinkForm, recipient_email: e.target.value })}
                  placeholder="citizen@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[var(--mist)]">Authorizing Officer Badge:</label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white font-mono"
                  value={createLinkForm.created_by_badge}
                  onChange={(e) => setCreateLinkForm({ ...createLinkForm, created_by_badge: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--navy-line)]">
              <button
                type="button"
                onClick={() => setShowCreateLinkModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingLink}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-40"
              >
                {creatingLink ? 'Generating…' : 'Generate Secure Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REVOKE UPLOAD LINK */}
      {showRevokeModal && targetRevokeLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleRevokeSubmit}
            className="bg-[var(--navy)] border border-red-500/40 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛑</span>
                <h3 className="font-semibold text-base text-white">Revoke Evidence Upload Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRevokeModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs">
              Revoking will immediately invalidate link <strong>{targetRevokeLink.link_id}</strong> for report <strong>{targetRevokeLink.report_id}</strong>. Any citizen upload attempts will be rejected.
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-mono text-[var(--mist)]">Revocation Reason (Required):</label>
              <textarea
                className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2.5 text-white text-xs focus:border-red-500 focus:outline-none"
                rows={3}
                placeholder="e.g. Complainant attended precinct in person; physical handset seized under Section 102 CrPC."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--navy-line)]">
              <button
                type="button"
                onClick={() => setShowRevokeModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow transition"
              >
                Confirm Revocation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW CRYPTOGRAPHIC RECEIPT */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--navy)] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <h3 className="font-semibold text-lg text-white">Cryptographic Upload Receipt</h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-emerald-500/30 font-mono text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Receipt ID:</span>
                <span className="text-emerald-300 font-bold">{selectedReceipt.receipt_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Target Case:</span>
                <span className="text-white font-bold">{selectedReceipt.report_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Evidence ID:</span>
                <span className="text-cyan-300 font-bold">{selectedReceipt.evidence_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">File:</span>
                <span className="text-white">{selectedReceipt.file_name} ({selectedReceipt.file_size_bytes} bytes)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">SHA-256 Fingerprint:</span>
                <span className="text-emerald-400 break-all">{selectedReceipt.sha256_fingerprint}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">RFC 3161 Serial:</span>
                <span className="text-amber-300">{selectedReceipt.rfc3161_serial}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Client IP:</span>
                <span className="text-white">{selectedReceipt.client_ip}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--navy-line)]">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-[var(--saffron)] text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW CITIZEN EVIDENCE UPLOAD PORTAL */}
      {previewCitizenToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <CitizenEvidenceUploadPortal
              token={previewCitizenToken}
              onClose={() => setPreviewCitizenToken(null)}
            />
          </div>
        </div>
      )}

      {/* CUSTODIAL LEDGER DRAWER / MODAL */}
      {selectedItemForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--navy)] border-l border-[var(--navy-line)] w-full max-w-xl h-full p-6 text-white overflow-y-auto space-y-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-4">
                <div>
                  <span className="font-mono text-xs text-[var(--saffron)] uppercase">Chain of Custody Ledger</span>
                  <h3 className="font-display text-xl font-semibold mt-0.5">{selectedItemForLedger.title}</h3>
                  <div className="font-mono text-xs text-[var(--mist)] mt-0.5">
                    {selectedItemForLedger.id} • Case: {selectedItemForLedger.case_id}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItemForLedger(null)}
                  className="p-1 rounded-lg bg-[var(--ink)] text-[var(--mist)] hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Cryptographic Verification Card */}
              {verificationResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    verificationResult.verified
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Cryptographic Verification Status:</span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-black/40">
                      {verificationResult.tamper_status}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] space-y-1">
                    <div>SHA-256 Digest Match: {verificationResult.sha256_match ? '✓ MATCHED' : '✕ MISMATCH'}</div>
                    <div>Custody Chain Intact: {verificationResult.custodial_ledger_intact ? '✓ UNBROKEN' : '✕ BROKEN'}</div>
                    <div>RFC 3161 TSA Serial: {verificationResult.rfc3161_serial}</div>
                  </div>
                </div>
              )}

              {/* Ledger Entries Timeline */}
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[var(--mist)]">
                  Custodial Trail ({ledgerEntries.length} Actions Recorded)
                </div>
                {ledgerLoading ? (
                  <div className="p-8 text-center text-xs text-[var(--mist)]">Verifying custodial chain…</div>
                ) : (
                  <div className="space-y-3">
                    {ledgerEntries.map((log, idx) => (
                      <div
                        key={log.log_id || idx}
                        className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-cyan-300">{log.action}</span>
                          <span className="font-mono text-[10px] text-[var(--mist)]">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-white/90">{log.details}</div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--mist)] pt-1 border-t border-[var(--navy-line)]">
                          <span>Officer: {log.officer_badge_id}</span>
                          <span>IP: {log.client_ip}</span>
                        </div>
                        <div className="text-[9px] font-mono text-gray-500 truncate" title={log.integrity_hash}>
                          Hash: {log.integrity_hash}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Officer Annotation Action Form */}
            <form onSubmit={handleLogAnnotation} className="pt-4 border-t border-[var(--navy-line)] space-y-2">
              <label className="block text-xs font-mono text-[var(--mist)]">Record Custodial Annotation:</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                  placeholder="e.g. Physical forensic imaging completed at CFSL..."
                  value={annotateNotes}
                  onChange={(e) => setAnnotateNotes(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--saffron)] text-white rounded-xl text-xs font-semibold hover:brightness-110"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL INGESTION */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleIngestSubmit}
            className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="font-semibold text-lg text-white">Manual Digital Evidence Ingestion</h3>
              <button
                type="button"
                onClick={() => setShowIngestModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-mono text-[var(--mist)] block mb-1">Case Number / Incident ID:</label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white font-mono"
                  value={ingestForm.case_id}
                  onChange={(e) => setIngestForm({ ...ingestForm, case_id: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="font-mono text-[var(--mist)] block mb-1">Evidence Title:</label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white"
                  value={ingestForm.title}
                  onChange={(e) => setIngestForm({ ...ingestForm, title: e.target.value })}
                  placeholder="e.g. WhatsApp Extortion Audio Clip"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono text-[var(--mist)] block mb-1">Evidence Type:</label>
                  <select
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white"
                    value={ingestForm.evidence_type}
                    onChange={(e) => setIngestForm({ ...ingestForm, evidence_type: e.target.value })}
                  >
                    <option value="audio_recording">Audio Recording</option>
                    <option value="document">Document / PDF</option>
                    <option value="transaction_receipt">Bank / UPI Receipt</option>
                    <option value="image_screenshot">Image Screenshot</option>
                    <option value="chat_transcript">Chat Transcript</option>
                    <option value="video">Video Recording</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[var(--mist)] block mb-1">Crime Category:</label>
                  <select
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl px-3 py-2 text-white"
                    value={ingestForm.category}
                    onChange={(e) => setIngestForm({ ...ingestForm, category: e.target.value })}
                  >
                    <option value="digital_arrest">Digital Arrest</option>
                    <option value="financial_fraud">Financial Fraud</option>
                    <option value="counterfeit_currency">Counterfeit Currency</option>
                    <option value="identity_theft">Identity Theft</option>
                    <option value="cyber_extortion">Cyber Extortion</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono text-[var(--mist)] block mb-1">Raw Artifact Stream / Payload:</label>
                <textarea
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-[var(--saffron)]"
                  rows={4}
                  value={ingestForm.raw_content}
                  onChange={(e) => setIngestForm({ ...ingestForm, raw_content: e.target.value })}
                  placeholder="Paste raw text, hex stream, or transcription data..."
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--navy-line)]">
              <button
                type="button"
                onClick={() => setShowIngestModal(false)}
                className="px-4 py-2 text-xs text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={ingesting}
                className="px-5 py-2 bg-[var(--saffron)] text-white text-xs font-semibold rounded-xl"
              >
                {ingesting ? 'Ingesting…' : 'Ingest & Seal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: FORENSIC EXPORT BUNDLE */}
      {showBundleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-2xl w-full p-6 text-white space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <div>
                <span className="font-mono text-xs text-[var(--saffron)] uppercase">Court-Admissible Export Package</span>
                <h3 className="font-display text-xl font-semibold">Forensic Evidence Certificate & Manifest</h3>
              </div>
              <button
                onClick={() => setShowBundleModal(false)}
                className="text-[var(--mist)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {bundleLoading ? (
              <div className="p-10 text-center text-sm text-[var(--mist)]">Compiling court forensic package…</div>
            ) : bundleData ? (
              <div className="space-y-4 text-xs">
                {/* Official Attestation Banner */}
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 space-y-2">
                  <div className="font-bold flex items-center gap-2 text-emerald-300">
                    <span>🏛️</span> Section 65B Indian Evidence Act / BSA § 63 Certificate
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-100">
                    {bundleData.attestation_statement}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-emerald-300 pt-1 border-t border-emerald-500/30">
                    <span>Bundle ID: <code className="font-mono font-bold text-white">{bundleData.bundle_id}</code></span>
                    <span>Certified at: {new Date(bundleData.generated_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Master Cryptographic Manifest */}
                <div className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-2">
                  <div className="font-mono text-[10px] uppercase text-[var(--mist)]">Master Cryptographic Manifest Hash</div>
                  <div className="font-mono text-xs text-white bg-black/40 p-2.5 rounded border border-white/10 break-all">
                    {bundleData.manifest_sha256}
                  </div>
                  <div className="text-[10px] text-[var(--mist)]">
                    Generated by: <span className="font-mono text-white">{bundleData.generated_by}</span> | Total Evidence Exhibits: <span className="font-mono text-white">{bundleData.evidence_items?.length}</span>
                  </div>
                </div>

                {/* Exhibit List */}
                <div className="space-y-2">
                  <div className="font-mono uppercase text-[10px] text-[var(--mist)]">Enclosed Digital Exhibits</div>
                  {bundleData.evidence_items?.map((it, idx) => (
                    <div key={it.id} className="p-2.5 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--saffron)]">Exhibit #{idx + 1}</span>
                        <div>
                          <div className="font-semibold text-white">{it.title}</div>
                          <div className="font-mono text-[10px] text-[var(--mist)]">
                            {it.id} • {it.file_name} • SHA-256: {it.sha256_hash?.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {it.rfc3161_token?.serial_number}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--navy-line)]">
                  <button
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundleData, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', dataStr);
                      downloadAnchor.setAttribute('download', `${bundleData.bundle_id}_forensic_manifest.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--saffron)] text-white font-semibold hover:brightness-110 shadow-md transition"
                  >
                    Download Forensic JSON Manifest
                  </button>
                  <button
                    onClick={() => window.print?.()}
                    className="px-4 py-2 rounded-xl border border-[var(--navy-line)] text-white hover:bg-white/5"
                  >
                    Print Certificate
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
