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
  sha256Sync,
  EVIDENCE_CHANGED_EVENT,
} from '../../evidenceStore.js';

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

  // Modals & Drawers
  const [selectedItemForLedger, setSelectedItemForLedger] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const [showIngestModal, setShowIngestModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleData, setBundleData] = useState(null);
  const [bundleLoading, setBundleLoading] = useState(false);

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

  const loadData = useCallback(async () => {
    try {
      const [fetchedItems, policies] = await Promise.all([
        fetchEvidenceItems({
          caseId: selectedCaseFilter || undefined,
          category: selectedCategoryFilter || undefined,
          legalHold: holdOnlyFilter ? true : undefined,
        }),
        fetchRetentionPoliciesApi(),
      ]);
      setItems(fetchedItems);
      setRetentionPolicies(policies);
    } catch {
      // Handled by store fallbacks
    } finally {
      setLoading(false);
    }
  }, [selectedCaseFilter, selectedCategoryFilter, holdOnlyFilter]);

  useEffect(() => {
    loadData();

    function handleChanged() {
      loadData();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(EVIDENCE_CHANGED_EVENT, handleChanged);
      return () => window.removeEventListener(EVIDENCE_CHANGED_EVENT, handleChanged);
    }
  }, [loadData]);

  // Open Custodial Ledger for Item
  async function openLedger(item) {
    setSelectedItemForLedger(item);
    setLedgerLoading(true);
    setVerificationResult(null);
    try {
      // Auto-log a VIEW action
      const ledger = await fetchCustodialLedgerApi(item.id);
      setLedgerEntries(ledger);
      const ver = await verifyEvidenceIntegrityApi(item.id);
      setVerificationResult(ver);
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  }

  // Handle Legal Hold Toggle
  async function handleToggleLegalHold(item) {
    const newHold = !item.legal_hold;
    const reason = newHold
      ? prompt('Enter active litigation / preservation reason for legal hold:', 'Ongoing Court Trial Proceeding')
      : prompt('Enter reason for releasing legal hold:', 'Case resolved or dismissed by court');

    if (reason === null) return;

    try {
      await toggleLegalHoldApi(item.id, {
        legalHold: newHold,
        reason: reason || 'Litigation status update',
        officerBadgeId: actionOfficer,
        officerName: 'Commanding Officer',
      });
      await loadData();
      if (selectedItemForLedger && selectedItemForLedger.id === item.id) {
        const updated = await fetchCustodialLedgerApi(item.id);
        setLedgerEntries(updated);
      }
    } catch (err) {
      alert(`Error toggling hold: ${err.message}`);
    }
  }

  // Handle Quick Action Log inside Ledger Drawer
  async function handleLogAction(actionType) {
    if (!selectedItemForLedger) return;
    try {
      await logCustodialActionApi(selectedItemForLedger.id, {
        action: actionType,
        officerBadgeId: actionOfficer,
        officerName: 'Investigating Officer',
        details: annotateNotes || `Executed custodial action ${actionType} from officer console.`,
      });
      setAnnotateNotes('');
      const updated = await fetchCustodialLedgerApi(selectedItemForLedger.id);
      setLedgerEntries(updated);
      const ver = await verifyEvidenceIntegrityApi(selectedItemForLedger.id);
      setVerificationResult(ver);
    } catch (err) {
      alert(`Failed to log action: ${err.message}`);
    }
  }

  // Ingest Evidence Form Submit
  async function handleIngestSubmit(e) {
    e.preventDefault();
    if (!ingestForm.title.trim() || !ingestForm.raw_content.trim()) {
      alert('Please provide title and evidence content/transcript.');
      return;
    }
    setIngesting(true);
    try {
      await ingestEvidenceApi({
        ...ingestForm,
        file_name: ingestForm.file_name.trim() || `${ingestForm.title.toLowerCase().replace(/\s+/g, '_')}.dat`,
      });
      setShowIngestModal(false);
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
      await loadData();
    } catch (err) {
      alert(`Ingest error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
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

        <div className="bg-[var(--navy)] border border-emerald-500/40 rounded-xl p-4 bg-emerald-950/20">
          <div className="text-[10px] font-mono uppercase text-emerald-300 flex items-center justify-between">
            <span>Integrity Status</span>
            <span>✓</span>
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-300 mt-1">100%</div>
          <div className="text-[11px] text-emerald-200/80 mt-0.5">Hash-Chained Verified</div>
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
              Tamper-evident evidence vault enforcing cryptographic fingerprints, immutable custodial logs, and statutory holds.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
              <option value="CASE-2026-DELHI-01">CASE-2026-DELHI-01 (Digital Arrest)</option>
              <option value="CASE-2026-NCR-02">CASE-2026-NCR-02 (Counterfeit ₹500)</option>
              <option value="CASE-2026-NORTH-11">CASE-2026-NORTH-11 (Extortion)</option>
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
                            {item.evidence_type.replace('_', ' ')}
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
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center gap-1.5 text-white/90">
                        <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[10px]">
                          {item.sha256_hash?.slice(0, 8)}...{item.sha256_hash?.slice(-8)}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(item.sha256_hash);
                            alert('SHA-256 hash copied to clipboard!');
                          }}
                          title="Copy Full SHA-256 Digest"
                          className="text-[var(--mist)] hover:text-white"
                        >
                          📋
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div className="text-emerald-400 font-semibold">{item.rfc3161_token?.serial_number}</div>
                      <div className="text-[10px] text-[var(--mist)]">
                        {new Date(item.ingested_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono text-white text-[11px]">{item.retention_days} Days</div>
                      <div className="text-[10px] text-[var(--mist)]">
                        Expires: {new Date(item.retention_until).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {item.legal_hold ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <span>🔒</span> Active Hold
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--mist)]">Standard Clock</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openLedger(item)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--saffron)]/20 hover:bg-[var(--saffron)] text-[var(--saffron)] hover:text-white border border-[var(--saffron)]/40 font-semibold transition text-[11px]"
                        >
                          Ledger & Chain →
                        </button>
                        <button
                          onClick={() => handleToggleLegalHold(item)}
                          title={item.legal_hold ? 'Release Legal Hold' : 'Apply Legal Hold'}
                          className={`p-1 rounded-lg border text-xs transition ${
                            item.legal_hold
                              ? 'border-amber-500/50 text-amber-300 hover:bg-amber-500/20'
                              : 'border-[var(--navy-line)] text-[var(--mist)] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          🔒
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custodial Chain Drawer / Modal */}
      {selectedItemForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--navy)] border-l border-[var(--navy-line)] w-full max-w-2xl h-full p-6 text-white overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-[var(--navy-line)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--saffron)] uppercase">Chain of Custody Ledger</span>
                    <span className="font-mono text-xs text-[var(--mist)]">{selectedItemForLedger.id}</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold mt-1">{selectedItemForLedger.title}</h3>
                  <p className="text-xs text-[var(--mist)] mt-0.5">
                    Case: <span className="font-mono text-white">{selectedItemForLedger.case_id}</span> | File:{' '}
                    <span className="font-mono text-white">{selectedItemForLedger.file_name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItemForLedger(null)}
                  className="text-[var(--mist)] hover:text-white p-1 rounded-lg hover:bg-white/5"
                >
                  ✕
                </button>
              </div>

              {/* Cryptographic Attestation Card */}
              <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs space-y-2">
                <div className="font-mono uppercase text-[10px] text-[var(--mist)]">Cryptographic Fingerprint & Time</div>
                <div className="font-mono text-[11px] text-white break-all bg-black/40 p-2 rounded border border-white/10">
                  SHA-256: {selectedItemForLedger.sha256_hash}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--mist)] pt-1">
                  <span>RFC 3161 Token: <span className="text-emerald-400 font-mono font-semibold">{selectedItemForLedger.rfc3161_token?.serial_number}</span></span>
                  <span>Authority: <span className="text-white/80">{selectedItemForLedger.rfc3161_token?.tsa_authority}</span></span>
                </div>
              </div>

              {/* Live Tamper-Verification Badge */}
              {verificationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    verificationResult.verified
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span>{verificationResult.verified ? '🛡️' : '⚠️'}</span>
                    <span>Verification: {verificationResult.tamper_status}</span>
                  </div>
                  <span className="font-mono text-[10px]">
                    {verificationResult.ledger_entries_verified} Chain Nodes Validated
                  </span>
                </div>
              )}

              {/* Immutable Hash-Chained Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono uppercase text-[var(--mist)]">
                  <span>Custodial Event Log ({ledgerEntries.length} Events)</span>
                  <span className="text-[10px]">Chained Hash Sequence</span>
                </div>

                {ledgerLoading ? (
                  <div className="p-6 text-center text-xs text-[var(--mist)]">Loading audit ledger…</div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--navy-line)] pl-7">
                    {ledgerEntries.map((entry, idx) => (
                      <div key={entry.log_id || idx} className="relative group">
                        {/* Dot indicator */}
                        <div className="absolute -left-7 top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--saffron)] ring-4 ring-[var(--navy)]" />

                        <div className="p-3 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-white text-[11px]">
                              {entry.action}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--mist)]">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-white/90 text-xs">{entry.details}</p>

                          <div className="flex items-center justify-between text-[10px] text-[var(--mist)] pt-1 border-t border-[var(--navy-line)]">
                            <span>Officer: <span className="font-mono text-white/90">{entry.officer_badge_id}</span> ({entry.officer_name})</span>
                            <span className="font-mono">IP: {entry.client_ip}</span>
                          </div>

                          <div className="font-mono text-[9px] text-[var(--mist)]/70 truncate pt-0.5">
                            Hash: {entry.integrity_hash?.slice(0, 16)}... ← Prev: {entry.previous_hash?.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Logging in Drawer */}
            <div className="pt-4 border-t border-[var(--navy-line)] space-y-3 mt-4">
              <div className="text-xs font-mono uppercase text-[var(--mist)]">Log Secure Custodial Interaction</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-xs text-white"
                  placeholder="Add inspection notes or court filing remarks..."
                  value={annotateNotes}
                  onChange={(e) => setAnnotateNotes(e.target.value)}
                />
                <button
                  onClick={() => handleLogAction('ANNOTATE')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--saffron)] text-white text-xs font-semibold hover:brightness-110"
                >
                  Log Action
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--mist)] pt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLogAction('DOWNLOAD')}
                    className="hover:text-white underline"
                  >
                    Log Download Copy
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => handleToggleLegalHold(selectedItemForLedger)}
                    className="hover:text-white underline"
                  >
                    {selectedItemForLedger.legal_hold ? 'Release Legal Hold' : 'Apply Legal Hold'}
                  </button>
                </div>
                <button
                  onClick={() => setSelectedItemForLedger(null)}
                  className="text-[var(--mist)] hover:text-white"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ingest Evidence Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-2xl w-full p-6 text-white space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <div>
                <span className="font-mono text-xs text-[var(--saffron)] uppercase">Vault Ingestion</span>
                <h3 className="font-display text-xl font-semibold">Ingest & Fingerprint Digital Evidence</h3>
              </div>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-[var(--mist)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIngestSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                    Linked Case ID
                  </label>
                  <input
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-white font-mono"
                    value={ingestForm.case_id}
                    onChange={(e) => setIngestForm({ ...ingestForm, case_id: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                    Evidence Type
                  </label>
                  <select
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-white"
                    value={ingestForm.evidence_type}
                    onChange={(e) => setIngestForm({ ...ingestForm, evidence_type: e.target.value })}
                  >
                    <option value="audio_recording">Audio Recording (VoIP / Intercept)</option>
                    <option value="document">Document (PDF Warrant / Notice)</option>
                    <option value="transaction_receipt">Transaction Receipt (UPI / RTGS Slip)</option>
                    <option value="image_screenshot">Image / Screenshot / Note Scan</option>
                    <option value="chat_transcript">Chat Transcript (WhatsApp / SMS)</option>
                    <option value="video">Video (Surveillance / Recording)</option>
                    <option value="other">Other Digital Artifact</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                  Artifact Title
                </label>
                <input
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-white"
                  placeholder="e.g. Forged CBI Digital Arrest Summons"
                  value={ingestForm.title}
                  onChange={(e) => setIngestForm({ ...ingestForm, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                  Crime Category & Statutory Retention Policy
                </label>
                <select
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-white"
                  value={ingestForm.category}
                  onChange={(e) => setIngestForm({ ...ingestForm, category: e.target.value })}
                >
                  <option value="digital_arrest">Digital Arrest Syndicate (5 Years Statutory Hold - BNS § 318)</option>
                  <option value="financial_fraud">Financial Fraud & UPI (3 Years Mandatory Preservation - PMLA § 12)</option>
                  <option value="counterfeit_currency">Counterfeit Currency Forgery (7 Years Preservation - BNS § 178)</option>
                  <option value="identity_theft">Identity Theft & KYC Spoofing (3 Years - IT Act § 66C)</option>
                  <option value="cyber_extortion">Cyber Extortion (5 Years - BNS § 308)</option>
                  <option value="other">General Incident (1 Year Standard)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                  Evidence Raw Content / Transcript / Payload
                </label>
                <textarea
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-3 text-white font-mono min-h-[90px]"
                  placeholder="Paste call transcript, extracted text, raw payment UTR strings, or base64 data..."
                  value={ingestForm.raw_content}
                  onChange={(e) => setIngestForm({ ...ingestForm, raw_content: e.target.value })}
                  required
                />
                {ingestForm.raw_content && (
                  <div className="text-[10px] text-emerald-400 font-mono mt-1">
                    Live SHA-256 Digest: {sha256Sync(ingestForm.raw_content).slice(0, 24)}...
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                    File Name
                  </label>
                  <input
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-white font-mono"
                    placeholder="e.g. cbi_fake_summons.pdf"
                    value={ingestForm.file_name}
                    onChange={(e) => setIngestForm({ ...ingestForm, file_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                    Officer Badge ID
                  </label>
                  <input
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-white font-mono"
                    value={ingestForm.officer_badge_id}
                    onChange={(e) => setIngestForm({ ...ingestForm, officer_badge_id: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--ink)] border border-[var(--navy-line)] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Litigation Legal Hold</div>
                  <div className="text-[10px] text-[var(--mist)]">Freeze retention clock for active court proceedings</div>
                </div>
                <input
                  type="checkbox"
                  checked={ingestForm.legal_hold}
                  onChange={(e) => setIngestForm({ ...ingestForm, legal_hold: e.target.checked })}
                  className="w-4 h-4 accent-[var(--saffron)] cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[var(--navy-line)]">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--navy-line)] text-[var(--mist)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="px-5 py-2 rounded-xl bg-[var(--saffron)] text-white font-semibold hover:brightness-110 shadow-md transition disabled:opacity-40"
                >
                  {ingesting ? 'Hashing & Vaulting…' : 'Vault & Fingerprint Artifact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forensic Court Export Bundle Modal */}
      {showBundleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--navy)] border border-[var(--saffron)] rounded-2xl max-w-3xl w-full p-6 text-white space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
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

