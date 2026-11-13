import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Zap,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  RotateCcw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import {
  parseFinancialEntitiesApi,
  evaluateMuleFreezeApi,
  dispatchMuleFreezeApi,
  fetchMuleFreezeRequestsApi,
  acknowledgeMuleFreezeApi,
  revokeMuleFreezeApi,
  fetchMuleFreezeStatsApi,
  validateVpa,
  validateUtr,
  validateIfsc,
  MULE_FREEZE_CHANGED_EVENT,
} from '../api';

export default function MuleFreezeDispatchView() {
  // Input fields
  const [rawText, setRawText] = useState(
    'Victim coerced on call. Transferred ₹85,000 to fraud.mule@okaxis. Transaction UTR 431209876543, Beneficiary ACC-1002 IFSC UTIB0000124.'
  );
  const [vpa, setVpa] = useState('fraud.mule@okaxis');
  const [accountNumber, setAccountNumber] = useState('ACC-1002');
  const [ifsc, setIfsc] = useState('UTIB0000124');
  const [utrNumber, setUtrNumber] = useState('431209876543');
  const [amount, setAmount] = useState('85000');
  const [incidentId, setIncidentId] = useState('INC-2026-DELHI-889');
  const [isDigitalArrest, setIsDigitalArrest] = useState(true);

  // Officer credentials
  const [officerName, setOfficerName] = useState('Inspector Rajesh Sharma');
  const [officerBadgeId, setOfficerBadgeId] = useState('OFF-DELHI-101');

  // Evaluation & dispatch state
  const [evaluation, setEvaluation] = useState(null);
  const [activeTab, setActiveTab] = useState('notice'); // 'notice' | 'cfcfrms'
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(null);

  // Ledger & stats state
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    dispatched: 0,
    frozen: 0,
    averageBankLatencyMs: 0,
    totalAmountProtectedInr: 0,
  });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequestId, setExpandedRequestId] = useState(null);

  // Load ledger and stats
  async function reloadData() {
    const data = await fetchMuleFreezeRequestsApi();
    const statsData = await fetchMuleFreezeStatsApi();
    setRequests(data);
    setStats(statsData);
  }

  useEffect(() => {
    reloadData();
    function handleChanged() {
      reloadData();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(MULE_FREEZE_CHANGED_EVENT, handleChanged);
      return () => window.removeEventListener(MULE_FREEZE_CHANGED_EVENT, handleChanged);
    }
  }, []);

  // Quick Parse handler
  async function handleAutoExtract() {
    if (!rawText.trim()) return;
    const extracted = await parseFinancialEntitiesApi(rawText);
    if (extracted.vpas && extracted.vpas.length > 0) {
      setVpa(extracted.vpas[0]);
    }
    if (extracted.utrs && extracted.utrs.length > 0) {
      setUtrNumber(extracted.utrs[0]);
    }
    if (extracted.ifscCodes && extracted.ifscCodes.length > 0) {
      setIfsc(extracted.ifscCodes[0]);
    }
    if (extracted.accountNumbers && extracted.accountNumbers.length > 0) {
      setAccountNumber(extracted.accountNumbers[0]);
    }
    handleEvaluate(extracted.vpas[0] || vpa);
  }

  // Evaluate Priority Stop Tier
  async function handleEvaluate(overrideVpa = null) {
    const targetVpa = overrideVpa || vpa;
    if (!targetVpa.trim()) return;
    try {
      const evalData = await evaluateMuleFreezeApi({
        vpa: targetVpa,
        account_number: accountNumber || null,
        transaction_amount: Number(amount) || 0,
        utr_number: utrNumber || null,
        is_digital_arrest: isDigitalArrest,
      });
      setEvaluation(evalData);
    } catch {
      // Handled
    }
  }

  // Dispatch Freeze Mandate
  async function handleDispatchFreeze() {
    if (!vpa.trim() || !incidentId.trim()) return;
    setDispatching(true);
    setDispatchSuccess(null);
    try {
      const record = await dispatchMuleFreezeApi({
        incident_id: incidentId,
        suspect_vpa: vpa,
        suspect_account: accountNumber || null,
        suspect_ifsc: ifsc || null,
        utr_number: utrNumber || null,
        transaction_amount: Number(amount) || 0,
        officer_name: officerName,
        officer_badge_id: officerBadgeId,
        is_digital_arrest: isDigitalArrest,
      });
      setDispatchSuccess(record);
      await reloadData();
    } finally {
      setDispatching(false);
    }
  }

  // Bank Acknowledgment Simulator
  async function handleAcknowledge(freezeId) {
    const randomRef = `BANK-NODAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await acknowledgeMuleFreezeApi(freezeId, randomRef, 'FROZEN', 'Automated debit freeze confirmed by beneficiary bank.');
    await reloadData();
  }

  // Revoke Freeze
  async function handleRevoke(freezeId) {
    const reason = prompt('Please enter the statutory justification for revoking this freeze mandate:', 'Mule account misidentification resolved; legitimate business transaction verified.');
    if (!reason) return;
    await revokeMuleFreezeApi(freezeId, officerBadgeId, reason);
    await reloadData();
  }

  const vpaStatus = validateVpa(vpa);
  const utrStatus = validateUtr(utrNumber);
  const ifscStatus = validateIfsc(ifsc);

  const filteredRequests = requests.filter((r) => {
    const matchStatus = statusFilter === 'ALL' || r.status.toUpperCase() === statusFilter.toUpperCase();
    const matchSearch =
      !searchQuery.trim() ||
      r.suspect_vpa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.freeze_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.utr_number && r.utr_number.includes(searchQuery));
    return matchStatus && matchSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 w-full text-[var(--ink-text)]">
      {/* Page Header */}
      <div className="space-y-2 border-b border-[var(--paper-line)] pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">
            I4C CFCFRMS & 1930 Financial Fraud Protocol
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            NPCI Priority Stop v2.4
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
          Automated UPI Mule Account Freeze Dispatch
        </h1>
        <p className="max-w-3xl text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">
          Parse reported UPI VPAs, beneficiary accounts, and 12-digit UTRs. Automatically evaluate transaction velocity and KshemOS Fraud Graph hop distance to generate statutory Section 91 & 102 CrPC provisional debit freeze notices and I4C CFCFRMS dispatch payloads.
        </p>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-text)]/60">Total Freeze Dispatches</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-display text-[var(--ink)]">{stats.totalRequests || requests.length}</div>
          <div className="mt-1 text-xs text-blue-600 font-medium">CFCFRMS Gateways</div>
        </div>
        <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-text)]/60">Active Frozen Accounts</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-display text-emerald-700">{stats.frozen}</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Debit channel locked</div>
        </div>
        <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-text)]/60">Protected Amount</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-display text-[var(--saffron)]">
            ₹{(stats.totalAmountProtectedInr || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-[var(--ink-text)]/60 font-medium">Proceeds safeguarded</div>
        </div>
        <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-text)]/60">Avg Nodal Latency</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-display text-purple-700">
            {stats.averageBankLatencyMs ? `${(stats.averageBankLatencyMs / 1000).toFixed(1)}s` : '3.8s'}
          </div>
          <div className="mt-1 text-xs text-purple-600 font-medium">Bank acknowledgment SLA</div>
        </div>
      </div>

      {/* Main Grid: Input & Evaluation Column + Legal Preview Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Triage & Entity Parser Form */}
        <div className="lg:col-span-6 space-y-6">
          {/* Quick Parser */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--saffron)]" />
                <span>Unstructured Message Extractor</span>
              </h2>
              <button
                type="button"
                onClick={handleAutoExtract}
                className="px-3.5 py-1.5 rounded-full bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--navy)] min-h-[36px] inline-flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
              >
                <span>Extract Entities</span>
              </button>
            </div>
            <textarea
              aria-label="Raw citizen complaint text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[var(--paper-line)] p-3 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
              placeholder="Paste citizen statement, SMS text, or transaction note here..."
            />
            <p className="text-[11px] text-[var(--ink-text)]/60">
              Heuristic parser scans for 12-digit UTRs, VPAs (`user@handle`, phone-linked VPAs), IFSC codes, and bank accounts.
            </p>
          </div>

          {/* Structured Triage Form */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--ink)] flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-600" />
              <span>Suspect Beneficiary Mandate</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Suspect UPI VPA *
                </label>
                <input
                  aria-label="Suspect UPI VPA"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  placeholder="e.g. fraud.mule@okaxis"
                  className={`w-full rounded-xl border p-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] ${
                    vpaStatus.isValid ? 'border-emerald-300 bg-emerald-50/20' : 'border-[var(--paper-line)]'
                  }`}
                />
                {vpaStatus.isValid && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid {vpaStatus.isPhoneLinked ? 'Phone-Linked' : 'Standard'} VPA</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Transaction Reference (UTR) *
                </label>
                <input
                  aria-label="12-digit UTR Number"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="12-digit number (e.g. 431209876543)"
                  className={`w-full rounded-xl border p-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] ${
                    utrStatus ? 'border-emerald-300 bg-emerald-50/20' : 'border-[var(--paper-line)]'
                  }`}
                />
                {utrStatus && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid 12-digit UTR</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Beneficiary Account (Optional)
                </label>
                <input
                  aria-label="Beneficiary Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. ACC-1002"
                  className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Bank IFSC
                </label>
                <input
                  aria-label="Bank IFSC"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  placeholder="e.g. UTIB0000124"
                  className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Freeze Amount (₹) *
                </label>
                <input
                  aria-label="Transaction Amount in INR"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 85000"
                  className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={isDigitalArrest}
                  onChange={(e) => setIsDigitalArrest(e.target.checked)}
                  className="rounded border-[var(--paper-line)] text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span>Digital Arrest / Extortion Coercion Flag</span>
              </label>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleEvaluate()}
                className="flex-1 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--ink)] hover:bg-neutral-100 min-h-[44px] transition-colors"
              >
                Evaluate Priority Tier
              </button>

              <button
                type="button"
                onClick={handleDispatchFreeze}
                disabled={dispatching || !vpaStatus.isValid}
                className="flex-1 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold hover:bg-rose-800 disabled:opacity-50 min-h-[44px] inline-flex items-center justify-center gap-2 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{dispatching ? 'Dispatching Mandate…' : 'Authorize & Dispatch Freeze'}</span>
              </button>
            </div>

            {dispatchSuccess && (
              <div className="mt-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Freeze Mandate Successfully Dispatched: {dispatchSuccess.freeze_id}</span>
                </div>
                <p>
                  Section 102 CrPC notice generated and transmitted to CFCFRMS priority gateway with SLA of {dispatchSuccess.sla_minutes} minutes.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Telemetry Evaluation & Legal Artifact Preview */}
        <div className="lg:col-span-6 space-y-6">
          {/* Evaluation Banner */}
          {evaluation && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-rose-800 font-bold">
                  Telemetry & Priority Evaluation
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-rose-700 text-white shadow-2xs">
                  {evaluation.priority_tier || evaluation.priorityTier}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-xl p-3 border border-rose-200">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Fraud Graph Hop</div>
                  <div className="text-xl font-bold font-display text-rose-800">
                    {evaluation.graph_hop_distance !== undefined ? evaluation.graph_hop_distance : evaluation.graphHopDistance} Hops
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-rose-200">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Mule Probability</div>
                  <div className="text-xl font-bold font-display text-rose-800">
                    {Math.round((evaluation.mule_probability || evaluation.muleProbability || 0.8) * 100)}%
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-rose-200">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Response SLA</div>
                  <div className="text-xl font-bold font-display text-rose-800">
                    {evaluation.sla_minutes || evaluation.slaMinutes} min
                  </div>
                </div>
              </div>

              <p className="text-xs text-rose-950/80 leading-relaxed">
                {evaluation.evaluation_rationale || evaluation.evaluationRationale}
              </p>
            </div>
          )}

          {/* Legal Notice / JSON Tabs */}
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
              <div className="inline-flex rounded-full bg-[var(--paper)] p-1 border border-[var(--paper-line)] text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('notice')}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                    activeTab === 'notice' ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)]'
                  }`}
                >
                  Section 91/102 Notice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cfcfrms')}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                    activeTab === 'cfcfrms' ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)]'
                  }`}
                >
                  CFCFRMS JSON Payload
                </button>
              </div>

              <span className="text-[11px] font-mono text-[var(--ink-text)]/50">
                Statutory Artifacts
              </span>
            </div>

            {activeTab === 'notice' ? (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-[var(--ink-text)]/60 flex items-center justify-between">
                  <span>Section 102 Cr.P.C. / Section 106 BNSS Requisition</span>
                  <span className="text-emerald-700 font-semibold">Certified Form</span>
                </div>
                <pre className="p-4 bg-[var(--paper)] rounded-2xl border border-[var(--paper-line)] text-[11px] font-mono leading-relaxed overflow-x-auto max-h-96 text-[var(--ink)]">
                  {dispatchSuccess?.statutory_notice?.legal_text ||
                    `STATUTORY PROVISIONAL DEBIT FREEZE NOTICE
UNDER SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE, 1973
(READ WITH SECTION 91 Cr.P.C. & SECTION 106 BHARATIYA NAGARIK SURAKSHA SANHITA, 2023)
--------------------------------------------------------------------------------
NOTICE REFERENCE NO: FRZ-UPI-2026-DRAFT
POLICE STATION: Cyber Crime Police Station, Central Delhi
CYBER CRIME INCIDENT/FIR REF: ${incidentId}

TO:
The Nodal Officer / Fraud Risk Management Team / Legal Cell,
Beneficiary Bank / Payment Service Provider / NPCI Central Switch.

SUBJECT: URGENT PROVISIONAL DEBIT FREEZE ORDER ON MULE/BENEFICIARY ACCOUNT / VPA

WHEREAS, an urgent cyber financial crime report has been registered wherein fraudulent debit of Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} was executed under transaction reference UTR: ${utrNumber || 'UNDER_TRACING'}.

Beneficiary Channel to Freeze:
  • Suspect UPI VPA: ${vpa}
  • Suspect Bank Account No: ${accountNumber || 'VPA-LINKED'}
  • Suspect Bank IFSC: ${ifsc || 'TO BE PROVIDED BY PSP'}

NOW THEREFORE, under Section 102 Cr.P.C., YOU ARE HEREBY DIRECTED TO IMMEDIATELY EXECUTE A PROVISIONAL DEBIT FREEZE / LIEN MARK on the aforesaid account/VPA to prevent further layering.`}
                </pre>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-[var(--ink-text)]/60 flex items-center justify-between">
                  <span>I4C-NPCI Priority Stop JSON Schema</span>
                  <span className="text-blue-700 font-semibold">v2.4 Production</span>
                </div>
                <pre className="p-4 bg-[var(--paper)] rounded-2xl border border-[var(--paper-line)] text-[11px] font-mono leading-relaxed overflow-x-auto max-h-96 text-[var(--ink)]">
                  {JSON.stringify(
                    dispatchSuccess?.cfcfrms_payload || {
                      cfcfrms_header: {
                        portal: 'Citizen Financial Cyber Fraud Reporting and Management System (CFCFRMS)',
                        gateway_protocol: 'I4C-NPCI-PRIORITY-FREEZE-v2.4',
                        cfcfrms_ticket_id: 'CFCFRMS-1930-SAMPLE',
                        priority_tier: evaluation?.priority_tier || 'TIER_1_IMMEDIATE_STOP',
                        sla_minutes: 15,
                      },
                      transaction_mandate: {
                        utr_number: utrNumber,
                        amount: Number(amount) || 0,
                        currency: 'INR',
                        transaction_type: 'UPI',
                      },
                      suspect_beneficiary: {
                        vpa: vpa,
                        account_number: accountNumber || null,
                        freeze_type: 'PROVISIONAL_DEBIT_FREEZE',
                      },
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dispatched Freeze Requests Ledger */}
      <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--paper-line)] pb-5">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--ink)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--saffron)]" />
              <span>Active Freeze Mandates & Bank Nodal Audit Trail</span>
            </h2>
            <p className="text-xs text-[var(--ink-text)]/60 mt-1">
              Live audit lifecycle of Section 102 CrPC debit freezes dispatched across bank nodal desks.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="inline-flex rounded-full bg-[var(--paper)] p-1 border border-[var(--paper-line)] text-xs">
              {['ALL', 'DISPATCHED', 'FROZEN', 'REVOKED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                    statusFilter === st ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                aria-label="Filter freeze mandates by VPA or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search VPA, ID, UTR..."
                className="pl-9 pr-3 py-1.5 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] w-48 sm:w-60"
              />
            </div>
          </div>
        </div>

        {/* Freeze Cards List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-10 text-xs text-[var(--ink-text)]/60">
              No matching provisional freeze mandates found.
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isExpanded = expandedRequestId === req.freeze_id;
              const isFrozen = req.status === 'FROZEN' || req.status === 'LIEN_MARKED';
              const isDispatched = req.status === 'DISPATCHED';
              const isRevoked = req.status === 'REVOKED';

              return (
                <div
                  key={req.freeze_id}
                  className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)]/40 p-5 space-y-4 transition-all hover:border-[var(--saffron)]/40"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[var(--ink)]">{req.freeze_id}</span>
                        <span className="text-xs text-[var(--ink-text)]/50">•</span>
                        <span className="text-xs font-mono text-[var(--saffron)]">{req.incident_id}</span>
                        <span className="text-xs text-[var(--ink-text)]/50">•</span>
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          ₹{Number(req.transaction_amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-700">
                        VPA: <span className="font-bold text-[var(--ink)]">{req.suspect_vpa}</span>
                        {req.utr_number && <span className="ml-3 text-gray-500">UTR: {req.utr_number}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          isFrozen
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isDispatched
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-neutral-100 text-neutral-800 border border-neutral-300'
                        }`}
                      >
                        {isFrozen && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                        {isDispatched && <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />}
                        {isRevoked && <RotateCcw className="w-3.5 h-3.5 text-neutral-700" />}
                        <span>{req.status}</span>
                      </span>

                      {/* Simulation Button */}
                      {isDispatched && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(req.freeze_id)}
                          className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 min-h-[32px] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Confirm Bank Freeze</span>
                        </button>
                      )}

                      {isFrozen && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(req.freeze_id)}
                          className="px-3 py-1 rounded-full border border-rose-300 bg-rose-50 text-rose-800 text-xs font-semibold hover:bg-rose-100 min-h-[32px] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Revoke Freeze</span>
                        </button>
                      )}

                      {/* Expand Details */}
                      <button
                        type="button"
                        onClick={() => setExpandedRequestId(isExpanded ? null : req.freeze_id)}
                        className="p-1 rounded-lg hover:bg-white text-gray-500"
                        aria-label="Toggle audit details"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Bank Nodal Info */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-text)]/70 pt-2 border-t border-[var(--paper-line)]">
                    <span>
                      Priority Tier: <strong className="text-[var(--ink)]">{req.priority_tier}</strong>
                    </span>
                    <span>
                      Officer: <strong className="text-[var(--ink)]">{req.officer_name} ({req.officer_badge_id})</strong>
                    </span>
                    {req.bank_nodal_ref && (
                      <span>
                        Bank Ref: <strong className="font-mono text-blue-700">{req.bank_nodal_ref}</strong>
                      </span>
                    )}
                    {req.bank_response_time_ms && (
                      <span>
                        Latency: <strong className="font-mono text-purple-700">{(req.bank_response_time_ms / 1000).toFixed(2)}s</strong>
                      </span>
                    )}
                  </div>

                  {/* Expanded Audit Log & Legal Document */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--paper-line)] space-y-4 animate-fade-up">
                      <div className="space-y-2">
                        <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink)] font-bold">
                          Chain of Custody & Audit Events
                        </div>
                        <div className="space-y-1.5">
                          {(req.audit_events || []).map((evt, idx) => (
                            <div key={idx} className="bg-white rounded-xl p-3 border border-[var(--paper-line)] text-xs flex items-start justify-between gap-3">
                              <div>
                                <span className="font-mono font-bold text-[var(--saffron)]">{evt.event_type}</span>
                                <p className="mt-0.5 text-gray-700">{evt.details}</p>
                              </div>
                              <span className="font-mono text-[10px] text-gray-400 shrink-0">
                                {new Date(evt.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {req.statutory_notice?.legal_text && (
                        <div className="space-y-1.5">
                          <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink)] font-bold">
                            Dispatched Section 102 CrPC Legal Notice
                          </div>
                          <pre className="p-3 bg-white rounded-xl border border-[var(--paper-line)] text-[10px] font-mono leading-relaxed overflow-x-auto max-h-48 text-[var(--ink)]">
                            {req.statutory_notice.legal_text}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

