import { useState, useEffect, useMemo } from 'react';
import {
  sanitizeTextLocally,
  pseudonymizeThreatFeedLocally,
  listUnmaskRequestsLocally,
  submitUnmaskRequestLocally,
  reviewUnmaskRequestLocally,
  revealUnmaskedValueLocally,
  getDpdpAuditTrailLocally,
  sanitizePiiApi,
  submitUnmaskRequestApi,
  listUnmaskRequestsApi,
  reviewUnmaskRequestApi,
  revealUnmaskedValueApi,
  fetchDpdpAuditTrailApi,
} from '../api.js';

const SAMPLE_TEXTS = {
  digital_arrest: `Victim Rajesh Kumar reported extortion call claiming to be CBI Chief. 
Aadhaar: 4829 1042 8492, PAN: ABCDE1234F. 
Transferred Rs 4,50,000 from SBI Savings Account 987654321098 to mule account. 
Victim phone: +91 98765 43210, Email: rajesh.k@example.com.`,
  mule_transfer: `Beneficiary mule KYC inspection for transaction UTR 402918274910. 
Account Number 501004928172 with HDFC Bank linked to Aadhaar 9281 4402 1192. 
Registered mobile: +91 91234 56789. Suspect PAN: BKZPS9876K.`,
  job_scam: `Complainant submitted bank details: Axis Bank A/C 918273645012, PAN: ALKPR4491M, Mobile: 9811223344. 
Scam recruiter contacted victim via Telegram @task_admin promising crypto task payouts.`,
};

const SAMPLE_GRAPH_FEED = [
  {
    record_id: 'INC-2026-DEL-01',
    source: '482910428492',
    source_type: 'CITIZEN',
    target: 'MULE-ACC-8819',
    target_type: 'ACCOUNT',
    relation: 'FUNDS_TRANSFERRED',
    description: 'Victim 4829 1042 8492 sent Rs 50,000 to mule account 987654321098.',
  },
  {
    record_id: 'INC-2026-DEL-02',
    source: '482910428492',
    source_type: 'CITIZEN',
    target: 'TG-CHANNEL-SCAM',
    target_type: 'CHANNEL',
    relation: 'SOLICITED_BY',
    description: 'Same citizen with PAN ABCDE1234F was solicited via fake task channel.',
  },
  {
    record_id: 'INC-2026-MUM-01',
    source: '928144021192',
    source_type: 'CITIZEN',
    target: 'MULE-ACC-8819',
    target_type: 'ACCOUNT',
    relation: 'FUNDS_TRANSFERRED',
    description: 'Second victim Aadhaar 9281 4402 1192 transferred Rs 1,20,000 to mule 987654321098.',
  },
];

export default function DpdpRedactionView() {
  const [activeTab, setActiveTab] = useState('playground'); // 'playground' | 'topology' | 'unmask' | 'audit'

  // Playground state
  const [inputText, setInputText] = useState(SAMPLE_TEXTS.digital_arrest);
  const [selectedTypes, setSelectedTypes] = useState(['AADHAAR', 'PAN', 'BANK_ACCOUNT', 'PHONE', 'EMAIL']);
  const [sanitizedResult, setSanitizedResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [backendEngine, setBackendEngine] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Topology state
  const [feedItems, setFeedItems] = useState(SAMPLE_GRAPH_FEED);
  const [pseudonymizedFeed, setPseudonymizedFeed] = useState(null);
  const [topologyPreserved, setTopologyPreserved] = useState(false);

  // Unmask state
  const [unmaskRequests, setUnmaskRequests] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState({
    record_id: 'REP-2026-DELHI-8841',
    field_name: 'aadhaar',
    case_fir_number: 'FIR No. 142/2026 PS Cyber Crime',
    legal_basis: 'SECTION_91_CRPC',
    justification: 'Judicial summons issued under Section 91 CrPC to correlate victim KYC with mule beneficiary ledger.',
    requester_badge_id: 'OFF-IO-4412',
    requester_name: 'Inspector Rajesh Kumar',
  });
  const [reviewModalRequest, setReviewModalRequest] = useState(null);
  const [supervisorBadge, setSupervisorBadge] = useState('SUP-DCP-9901');
  const [supervisorName, setSupervisorName] = useState('DCP Cyber Crime Ops');
  const [approvalNotes, setApprovalNotes] = useState('Approved under statutory court summons.');
  const [unmaskError, setUnmaskError] = useState(null);
  const [revealedData, setRevealedData] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // Audit state
  const [auditLogs, setAuditLogs] = useState([]);

  // Load unmask requests and audit logs on mount
  useEffect(() => {
    refreshUnmaskList();
    refreshAuditTrail();
  }, []);

  // Timer countdown for active reveal lease
  useEffect(() => {
    if (!revealedData || !revealedData.lease_expires_at) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((revealedData.lease_expires_at - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setRevealedData(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [revealedData]);

  async function refreshUnmaskList() {
    try {
      if (backendEngine) {
        const list = await listUnmaskRequestsApi();
        setUnmaskRequests(list);
        return;
      }
    } catch {
      // Fallback to local
    }
    setUnmaskRequests(listUnmaskRequestsLocally());
  }

  async function refreshAuditTrail() {
    try {
      if (backendEngine) {
        const logs = await fetchDpdpAuditTrailApi();
        setAuditLogs(logs);
        return;
      }
    } catch {
      // Fallback to local
    }
    setAuditLogs(getDpdpAuditTrailLocally());
  }

  // Handle local or backend text sanitization
  async function handleSanitize() {
    setProcessing(true);
    try {
      if (backendEngine) {
        try {
          const res = await sanitizePiiApi({ text: inputText, mask_types: selectedTypes });
          setSanitizedResult({
            sanitizedText: res.sanitized_text,
            detectedEntities: res.detected_entities,
          });
          setProcessing(false);
          return;
        } catch {
          // Fall through to local engine
        }
      }
      const localRes = sanitizeTextLocally(inputText, selectedTypes);
      setSanitizedResult(localRes);
    } finally {
      setProcessing(false);
    }
  }

  // Handle feed pseudonymization
  function handlePseudonymizeFeed() {
    const res = pseudonymizeThreatFeedLocally(feedItems);
    setPseudonymizedFeed(res.sanitizedItems);
    setTopologyPreserved(res.graphTopologyPreserved);
  }

  // Handle new unmask request submission
  async function handleSubmitNewRequest(e) {
    e.preventDefault();
    setUnmaskError(null);
    try {
      if (backendEngine) {
        try {
          await submitUnmaskRequestApi(newRequestForm);
          setShowNewModal(false);
          refreshUnmaskList();
          refreshAuditTrail();
          return;
        } catch (err) {
          setUnmaskError(err.message);
          return;
        }
      }
      submitUnmaskRequestLocally(newRequestForm);
      setShowNewModal(false);
      refreshUnmaskList();
      refreshAuditTrail();
    } catch (err) {
      setUnmaskError(err.message);
    }
  }

  // Handle supervisor review (Approve / Reject)
  async function handleReviewAction(action) {
    if (!reviewModalRequest) return;
    setUnmaskError(null);
    try {
      if (backendEngine) {
        try {
          await reviewUnmaskRequestApi({
            request_id: reviewModalRequest.request_id,
            action,
            supervisor_badge_id: supervisorBadge,
            supervisor_name: supervisorName,
            approval_notes: approvalNotes,
          });
          setReviewModalRequest(null);
          refreshUnmaskList();
          refreshAuditTrail();
          return;
        } catch (err) {
          setUnmaskError(err.message);
          return;
        }
      }
      reviewUnmaskRequestLocally({
        requestId: reviewModalRequest.request_id,
        action,
        supervisorBadgeId: supervisorBadge,
        supervisorName: supervisorName,
        approvalNotes,
      });
      setReviewModalRequest(null);
      refreshUnmaskList();
      refreshAuditTrail();
    } catch (err) {
      setUnmaskError(err.message);
    }
  }

  // Handle reveal unmasked value
  async function handleReveal(req) {
    setUnmaskError(null);
    try {
      if (backendEngine) {
        try {
          const res = await revealUnmaskedValueApi(req.request_id, 'OFF-IO-4412');
          setRevealedData(res);
          refreshAuditTrail();
          return;
        } catch (err) {
          setUnmaskError(err.message);
          return;
        }
      }
      const localReveal = revealUnmaskedValueLocally(req.request_id, 'OFF-IO-4412');
      setRevealedData(localReveal);
      refreshAuditTrail();
    } catch (err) {
      setUnmaskError(err.message);
    }
  }

  function handleCopy(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleType(type) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--navy)] via-[var(--ink)] to-[#0c1a2e] text-white p-6 sm:p-8 rounded-3xl border border-[var(--navy-line)] shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
              DPDP ACT, 2023 // §§ 4, 8, 9, 17 STATUTORY COMPLIANCE
            </span>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/10 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Sanitization Pipeline Active</span>
              <button
                type="button"
                onClick={() => setBackendEngine(!backendEngine)}
                className="ml-2 text-[10px] uppercase font-bold text-[var(--saffron)] underline hover:text-white"
              >
                {backendEngine ? 'API Engine' : 'Client-Side'}
              </button>
            </div>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            DPDP Act Redaction & Identity Masking Pipeline
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-300 max-w-4xl leading-relaxed">
            Automated citizen identifier sanitization conforming to the Digital Personal Data Protection Act, 2023.
            Masks 12-digit Aadhaar (<code className="text-[var(--saffron)] font-mono">XXXX-XXXX-1234</code>), 10-character PAN (<code className="text-[var(--saffron)] font-mono">ABCDE****F</code>),
            and Bank Accounts (<code className="text-[var(--saffron)] font-mono">XXXXXXXX1234</code>). Preserves threat intelligence graph topology via persistent pseudonyms (<code className="text-[var(--saffron)] font-mono">CITIZEN_REF_8492</code>)
            under role-audited, supervisory unmask workflows.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs font-mono">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-gray-400">AADHAAR FORMAT</div>
              <div className="text-sm font-bold text-[var(--saffron)] mt-1">XXXX-XXXX-1234</div>
              <div className="text-[10px] text-gray-400">UIDAI Regulation 16A</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-gray-400">PAN MASKING</div>
              <div className="text-sm font-bold text-sky-400 mt-1">ABCDE****F</div>
              <div className="text-[10px] text-gray-400">Income Tax Act § 139A</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-gray-400">BANK ACCOUNT</div>
              <div className="text-sm font-bold text-amber-300 mt-1">XXXXXXXX1234</div>
              <div className="text-[10px] text-gray-400">RBI KYC Master Direction</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-gray-400">GRAPH TOPOLOGY</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">CITIZEN_REF_8492</div>
              <div className="text-[10px] text-gray-400">Deterministic HMAC-SHA256</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--paper-line)] pb-3">
        {[
          { id: 'playground', label: '1. Sanitization Playground', icon: '🛡️' },
          { id: 'topology', label: '2. Feed Topology & Pseudonyms', icon: '🕸️' },
          { id: 'unmask', label: '3. Access-Controlled Unmask Console', icon: '⚖️' },
          { id: 'audit', label: '4. Statutory Audit Trail (§ 8)', icon: '📜' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'unmask') refreshUnmaskList();
              if (tab.id === 'audit') refreshAuditTrail();
            }}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[var(--navy)] text-white shadow-md'
                : 'bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-line)]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                  INPUT DATA
                </span>
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  Citizen Narrative / Case Payload
                </h3>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setInputText(SAMPLE_TEXTS.digital_arrest)}
                  className="text-[11px] px-2.5 py-1 rounded bg-[var(--paper)] hover:bg-[var(--paper-line)] font-medium text-[var(--ink)]"
                >
                  Arrest FIR
                </button>
                <button
                  type="button"
                  onClick={() => setInputText(SAMPLE_TEXTS.mule_transfer)}
                  className="text-[11px] px-2.5 py-1 rounded bg-[var(--paper)] hover:bg-[var(--paper-line)] font-medium text-[var(--ink)]"
                >
                  Mule KYC
                </button>
                <button
                  type="button"
                  onClick={() => setInputText(SAMPLE_TEXTS.job_scam)}
                  className="text-[11px] px-2.5 py-1 rounded bg-[var(--paper)] hover:bg-[var(--paper-line)] font-medium text-[var(--ink)]"
                >
                  Task Scam
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste FIR narrative, complaint text, or chat transcript containing Aadhaar, PAN, Bank account, Phone, or Email..."
              className="w-full p-4 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]"
            />

            {/* Entity Filter Checkboxes */}
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-2 uppercase tracking-wider font-mono">
                Masking Targets:
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'AADHAAR', label: 'Aadhaar (XXXX-XXXX-1234)' },
                  { key: 'PAN', label: 'PAN (ABCDE****F)' },
                  { key: 'BANK_ACCOUNT', label: 'Bank Account (XXXXXXXX1234)' },
                  { key: 'PHONE', label: 'Phone Number (+91 XXXXX)' },
                  { key: 'EMAIL', label: 'Email (u***r@domain.com)' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleType(item.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                      selectedTypes.includes(item.key)
                        ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                        : 'bg-white text-[var(--ink)] border-[var(--paper-line)] hover:bg-[var(--paper)]'
                    }`}
                  >
                    {selectedTypes.includes(item.key) ? '✓ ' : '+ '}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={processing || !inputText.trim()}
              onClick={handleSanitize}
              className="w-full py-3 rounded-2xl bg-[var(--saffron)] text-white font-semibold text-sm shadow hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Sanitizing Citizen Identifiers...</span>
                </>
              ) : (
                <>
                  <span>🛡️ Run DPDP Sanitization Engine</span>
                </>
              )}
            </button>
          </div>

          {/* Output Panel */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-600 font-bold">
                  SANITIZED OUTPUT
                </span>
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  Redacted Citizen Narrative
                </h3>
              </div>
              {sanitizedResult && (
                <button
                  type="button"
                  onClick={() => handleCopy(sanitizedResult.sanitizedText)}
                  className="px-3 py-1 rounded-lg bg-[var(--paper)] hover:bg-[var(--paper-line)] text-xs font-medium text-[var(--ink)] transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy Redacted'}
                </button>
              )}
            </div>

            {sanitizedResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-sm font-mono text-[var(--ink)] whitespace-pre-wrap leading-relaxed">
                  {sanitizedResult.sanitizedText}
                </div>

                {/* Detected Entities Breakdown */}
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase text-[var(--ink)] tracking-wider mb-2">
                    Detected PII Entities ({sanitizedResult.detectedEntities.length}):
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {sanitizedResult.detectedEntities.map((ent, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-xs font-mono flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ent.entity_type === 'AADHAAR'
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : ent.entity_type === 'PAN'
                                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                : ent.entity_type === 'BANK_ACCOUNT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-purple-100 text-purple-800 border border-purple-300'
                            }`}
                          >
                            {ent.entity_type}
                          </span>
                          <span className="text-gray-400 line-through">{ent.original_snippet}</span>
                          <span className="text-gray-400">➔</span>
                          <span className="font-bold text-emerald-700">{ent.masked_value}</span>
                        </div>
                        <div className="text-[11px] text-[var(--navy)] bg-white px-2 py-0.5 rounded border border-[var(--paper-line)]">
                          Token: <span className="font-bold">{ent.pseudonym_token}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                  <strong>Statutory Notice:</strong> Sanitization performed in accordance with Section 8(4) DPDP Act, 2023.
                  Masked values are safely exportable to external nodal systems, state threat desks, and public dashboards.
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed border-[var(--paper-line)] rounded-2xl text-gray-400 text-sm">
                Click <strong>Run DPDP Sanitization Engine</strong> to view the redacted narrative and detected citizen credentials.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FEED TOPOLOGY & PSEUDONYMIZATION */}
      {activeTab === 'topology' && (
        <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                GRAPH PRESERVATION // ZERO-TRUST SHARING
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Threat Intelligence Topology & Persistent Tokenizer
              </h3>
              <p className="mt-1 text-sm text-gray-600 max-w-3xl">
                When sharing cross-jurisdiction threat feeds, citizen identities are replaced with persistent HMAC-SHA256 tokens (<code className="font-mono text-emerald-700">CITIZEN_REF_8492</code>).
                Even across distinct incidents, the same victim maintains the identical token, allowing the Fraud Graph to uncover syndicates targeting repeated victims without storing plain credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePseudonymizeFeed}
              className="px-5 py-2.5 rounded-full bg-[var(--navy)] text-white text-xs font-semibold shadow hover:bg-[var(--ink)] transition-colors flex items-center gap-2"
            >
              <span>🕸️ Generate Pseudonymized Feed</span>
            </button>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Raw Feed (PII Exposed) */}
            <div className="p-5 rounded-2xl border border-red-200 bg-red-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-red-700 uppercase tracking-wider">
                  ⚠️ Raw Threat Feed (Plain PII Exposure)
                </span>
                <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono font-bold">
                  NON-COMPLIANT
                </span>
              </div>
              <p className="text-xs text-red-900/80">
                Contains unmasked Aadhaar and account numbers that violate DPDP Act Section 4 if exported.
              </p>
              <div className="space-y-2 text-xs font-mono">
                {feedItems.map((item, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-red-100 shadow-xs space-y-1">
                    <div className="flex justify-between text-gray-400 text-[10px]">
                      <span>{item.record_id}</span>
                      <span className="text-red-600 font-bold">{item.relation}</span>
                    </div>
                    <div className="text-[var(--ink)]">
                      <span className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-bold">
                        {item.source}
                      </span>{' '}
                      ➔{' '}
                      <span className="bg-gray-100 px-1 py-0.5 rounded font-bold">
                        {item.target}
                      </span>
                    </div>
                    <div className="text-gray-500 text-[11px]">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pseudonymized Feed */}
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-800 uppercase tracking-wider">
                  ✅ Pseudonymized Feed (Topology Preserved)
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                  DPDP COMPLIANT
                </span>
              </div>
              <p className="text-xs text-emerald-900/80">
                Plain identifiers replaced by keyed HMAC-SHA256 tokens. Graph clusters and hop paths remain fully analyzable.
              </p>

              {pseudonymizedFeed ? (
                <div className="space-y-2 text-xs font-mono">
                  {pseudonymizedFeed.map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs space-y-1">
                      <div className="flex justify-between text-gray-400 text-[10px]">
                        <span>{item.record_id}</span>
                        <span className="text-emerald-700 font-bold">{item.relation}</span>
                      </div>
                      <div className="text-[var(--ink)]">
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          {item.source}
                        </span>{' '}
                        ➔{' '}
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-bold">
                          {item.target}
                        </span>
                      </div>
                      <div className="text-gray-600 text-[11px]">{item.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-gray-500 font-mono">
                  Click <strong>Generate Pseudonymized Feed</strong> to tokenize graph nodes.
                </div>
              )}
            </div>
          </div>

          {topologyPreserved && (
            <div className="p-4 rounded-2xl bg-[var(--paper)] border border-[var(--paper-line)] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-emerald-600 font-bold text-base">✓</span>
                <span>Graph Relationship Topology: <strong className="text-emerald-700">100% INTACT</strong> (Node cluster preserved across INC-01 & INC-02)</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(pseudonymizedFeed, null, 2))}
                className="px-3 py-1.5 rounded-lg bg-[var(--navy)] text-white font-medium hover:bg-[var(--ink)]"
              >
                Export Pseudonymized JSON
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACCESS-CONTROLLED UNMASK CONSOLE */}
      {activeTab === 'unmask' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                ROLE-AUDITED IDENTITY WORKFLOW
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Statutory Unmask Approval & Dual-Authorization Console
              </h3>
              <p className="mt-1 text-sm text-gray-600 max-w-3xl">
                Pursuant to Section 17 DPDP Act and Section 91 CrPC, plain citizen identities can only be unmasked for active criminal investigations upon dual supervisory authorization.
                Self-approval by the investigating officer is strictly blocked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="px-5 py-2.5 rounded-full bg-[var(--saffron)] text-white text-xs font-semibold shadow hover:opacity-95 transition-opacity flex items-center gap-2"
            >
              <span>+ New Unmask Request</span>
            </button>
          </div>

          {unmaskError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-mono flex items-start gap-2">
              <span className="text-red-600 font-bold text-sm">⚠</span>
              <div>
                <strong>Authorization Failure:</strong> {unmaskError}
              </div>
            </div>
          )}

          {/* Active Reveal Card (if unmasked) */}
          {revealedData && (
            <div className="p-6 rounded-3xl bg-amber-50/90 border-2 border-amber-300 shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-mono font-bold text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                  CONFIDENTIAL IDENTITY UNMASKED // TIME-BOUND LEASE
                </span>
                <span className="text-xs font-mono bg-amber-200 text-amber-950 px-3 py-1 rounded-full font-bold">
                  ⏱ Lease Expires in: {countdown !== null ? `${countdown}s` : '3600s'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-amber-200 font-mono text-sm space-y-2">
                <div className="text-xs text-gray-400">UNMASKED SENSITIVE VALUE:</div>
                <div className="text-lg font-bold text-red-700 tracking-wide selection:bg-red-100">
                  {revealedData.unmasked_value}
                </div>
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex flex-wrap gap-4">
                  <span>Record: <strong>{revealedData.record_id}</strong></span>
                  <span>Officer: <strong>{revealedData.requester_badge_id}</strong></span>
                  <span>Supervisor: <strong>{revealedData.supervisor_badge_id}</strong></span>
                  <span>Audit Tx: <strong>{revealedData.audit_transaction_id}</strong></span>
                </div>
              </div>

              <p className="text-[11px] text-amber-900 font-medium">
                {revealedData.statutory_warning}
              </p>
            </div>
          )}

          {/* Requests Table */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--paper-line)] bg-[var(--paper)]">
              <h4 className="font-display text-sm font-bold text-[var(--ink)] uppercase tracking-wider">
                Unmask Requests Queue ({unmaskRequests.length})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-[var(--paper-line)]">
                  <tr>
                    <th className="py-3 px-4">Request ID</th>
                    <th className="py-3 px-4">Record / Case FIR</th>
                    <th className="py-3 px-4">Field</th>
                    <th className="py-3 px-4">Legal Authority</th>
                    <th className="py-3 px-4">Requester</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--paper-line)]">
                  {unmaskRequests.map((req) => (
                    <tr key={req.request_id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-bold text-[var(--ink)]">{req.request_id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold">{req.record_id}</div>
                        <div className="text-gray-400 text-[10px]">{req.case_fir_number}</div>
                      </td>
                      <td className="py-3 px-4 uppercase font-bold text-[var(--navy)]">{req.field_name}</td>
                      <td className="py-3 px-4 text-[10px] text-gray-600">{req.legal_basis}</td>
                      <td className="py-3 px-4">
                        <div>{req.requester_badge_id}</div>
                        <div className="text-gray-400 text-[10px]">{req.requester_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {req.status === 'PENDING_SUPERVISORY_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalRequest(req);
                              setUnmaskError(null);
                            }}
                            className="px-2.5 py-1 rounded bg-[var(--navy)] text-white text-[11px] font-medium hover:bg-[var(--ink)]"
                          >
                            Review
                          </button>
                        )}
                        {req.status === 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleReveal(req)}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
                          >
                            Access Identity
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STATUTORY AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                DPDP ACT § 8(4) RECORD RETENTION
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Statutory Immutable Audit Trail
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Chronological immutable ledger of all citizen identifier masking, unmasking authorizations, and supervisory approvals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(JSON.stringify(auditLogs, null, 2))}
              className="px-4 py-2 rounded-full bg-[var(--paper)] hover:bg-[var(--paper-line)] text-xs font-mono font-medium text-[var(--ink)]"
            >
              Export Audit Trail (JSON)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-[var(--paper-line)]">
                <tr>
                  <th className="py-3 px-4">Audit ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor Badge</th>
                  <th className="py-3 px-4">Record ID</th>
                  <th className="py-3 px-4">Legal Authority</th>
                  <th className="py-3 px-4">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--paper-line)]">
                {auditLogs.map((log) => (
                  <tr key={log.audit_id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-bold text-gray-700">{log.audit_id}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {log.timestamp_iso || new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-[var(--navy)]">{log.action}</td>
                    <td className="py-3 px-4">{log.actor_badge_id}</td>
                    <td className="py-3 px-4">{log.record_id}</td>
                    <td className="py-3 px-4 text-[10px] text-gray-600">{log.legal_basis}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800">
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT NEW UNMASK REQUEST */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[var(--paper-line)] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--paper-line)]">
              <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                Request Statutory Identity Unmask
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewRequest} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Target Record ID:</label>
                <input
                  type="text"
                  required
                  value={newRequestForm.record_id}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, record_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Field to Unmask:</label>
                <select
                  value={newRequestForm.field_name}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, field_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                >
                  <option value="aadhaar">Aadhaar Number</option>
                  <option value="pan">Permanent Account Number (PAN)</option>
                  <option value="bank_account">Bank Account Number</option>
                  <option value="all_pii">All Redacted Citizen PII</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Case FIR Number:</label>
                <input
                  type="text"
                  required
                  value={newRequestForm.case_fir_number}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, case_fir_number: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Statutory Legal Basis:</label>
                <select
                  value={newRequestForm.legal_basis}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, legal_basis: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                >
                  <option value="SECTION_91_CRPC">Section 91 CrPC (Summons to Produce Documents)</option>
                  <option value="SECTION_102_CRPC">Section 102 CrPC (Police Seizure & Freeze Power)</option>
                  <option value="SECTION_17_DPDP_INVESTIGATION_EXEMPTION">Section 17 DPDP Act (Crime Investigation Exemption)</option>
                  <option value="COURT_SEARCH_WARRANT">Judicial Magistrate Search Warrant</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Investigation Justification:</label>
                <textarea
                  rows={3}
                  required
                  value={newRequestForm.justification}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, justification: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Officer Badge ID:</label>
                  <input
                    type="text"
                    required
                    value={newRequestForm.requester_badge_id}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, requester_badge_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Officer Name:</label>
                  <input
                    type="text"
                    required
                    value={newRequestForm.requester_name}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, requester_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--paper-line)] text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--saffron)] text-white font-bold hover:opacity-90"
                >
                  Submit for Supervisory Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUPERVISOR REVIEW */}
      {reviewModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[var(--paper-line)] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--paper-line)]">
              <div>
                <span className="text-[10px] font-mono text-[var(--saffron)] font-bold uppercase tracking-wider">
                  DUAL-AUTHORIZATION REVIEW
                </span>
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  Supervisory Decision: {reviewModalRequest.request_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalRequest(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl space-y-1 text-xs font-mono">
              <div>Case FIR: <strong>{reviewModalRequest.case_fir_number}</strong></div>
              <div>Field: <strong>{reviewModalRequest.field_name}</strong></div>
              <div>Legal Authority: <strong>{reviewModalRequest.legal_basis}</strong></div>
              <div>Requester: <strong>{reviewModalRequest.requester_name} ({reviewModalRequest.requester_badge_id})</strong></div>
              <div className="text-gray-500 pt-1">Reason: {reviewModalRequest.justification}</div>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Supervisor Badge ID:</label>
                <input
                  type="text"
                  required
                  value={supervisorBadge}
                  onChange={(e) => setSupervisorBadge(e.target.value)}
                  placeholder="e.g. SUP-DCP-9901"
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
                <span className="text-[10px] text-gray-500">
                  Note: Must be distinct from requester ({reviewModalRequest.requester_badge_id}) to satisfy dual authorization.
                </span>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Supervisor Name:</label>
                <input
                  type="text"
                  required
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Supervisory Finding & Notes:</label>
                <textarea
                  rows={2}
                  required
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => handleReviewAction('REJECT')}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-bold border border-red-200 hover:bg-red-100"
              >
                Reject Request
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewModalRequest(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--paper-line)] text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('APPROVE')}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Authorize Unmask Lease
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

