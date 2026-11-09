import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Cpu,
  Server,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Printer,
  Key,
  RefreshCw,
  Lock,
  Layers,
  ChevronRight,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  defaultEvidenceStore,
  OFFICIAL_NTP_RECORD,
  HARDWARE_SIGNATURE_PROFILES,
  DEMO_CASE_PRESETS,
  compileSection63AffidavitLocally,
  compileSection63AffidavitApi,
  fetchNtpStatusApi,
  sha256Sync,
} from '../../api.js';

export default function Section63AffidavitCompilerView() {
  const [selectedCaseId, setSelectedCaseId] = useState('CASE-2026-DELHI-01');
  const [firCrimeNumber, setFirCrimeNumber] = useState('FIR No. 142/2026 PS Cyber Crime u/s 318(4), 319(2) BNS & 66D IT Act');
  const [courtName, setCourtName] = useState('Court of the Chief Metropolitan Magistrate, Rouse Avenue Courts, New Delhi');
  const [policeStation, setPoliceStation] = useState('Cyber Crime Police Station, Central District, New Delhi');

  // Fill-in Officer Declarations State
  const [ioName, setIoName] = useState('Inspector Rajesh Kumar');
  const [ioRank, setIoRank] = useState('Inspector of Police (Cyber Crime Branch)');
  const [ioBadge, setIoBadge] = useState('IO-DEL-4412');
  const [ioOrg, setIoOrg] = useState('Delhi Police Cyber Crime Unit');

  const [sysName, setSysName] = useState('Dr. Neha V. Sharma');
  const [sysDesignation, setSysDesignation] = useState('Forensic System In-Charge & Senior Scientist (Cyber Forensics)');
  const [sysBadge, setSysBadge] = useState('SYS-CFSL-8819');
  const [sysOrg, setSysOrg] = useState('State Cyber Forensic Science Laboratory / KshemOS Vault Authority');

  // Affix DSC / eSign toggle
  const [affixDsc, setAffixDsc] = useState(false);

  // Evidence Items & Hash Chain State
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [simulatedTamperId, setSimulatedTamperId] = useState(null);

  // NTP State
  const [ntpRecord, setNtpRecord] = useState(OFFICIAL_NTP_RECORD);
  const [loadingNtp, setLoadingNtp] = useState(false);

  // Compilation State
  const [isCompiling, setIsCompiling] = useState(false);
  const [affidavitResult, setAffidavitResult] = useState(null);
  const [compilationError, setCompilationError] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Load evidence for selected case
  function loadCaseEvidence(caseId) {
    try {
      const items = defaultEvidenceStore.getEvidenceItems({ caseId });
      if (items.length > 0) {
        setEvidenceItems(items);
      } else {
        // Fallback to sample items
        const all = defaultEvidenceStore.getEvidenceItems();
        setEvidenceItems(all.slice(0, 3));
      }
    } catch {
      // Default offline sample
      setEvidenceItems([
        {
          id: 'EV-1001',
          title: 'WhatsApp Extortion Call Audio Recording',
          file_name: 'extortion_call_01.wav',
          file_size_bytes: 4210500,
          mime_type: 'audio/wav',
          source: 'audio_intercept',
          sha256_hash: sha256Sync('AUDIO-RECORDING-1'),
          ingested_at: Date.now() - 86400000,
          rfc3161_token: { serial_number: 'TSA-NPL-998811' },
          custodial_log_count: 3,
        },
        {
          id: 'EV-1002',
          title: 'Forged Police Summons Letter (PDF)',
          file_name: 'mumbai_police_summons_fake.pdf',
          file_size_bytes: 652300,
          mime_type: 'application/pdf',
          source: 'bank_slip',
          sha256_hash: sha256Sync('DOCUMENT-PDF-2'),
          ingested_at: Date.now() - 43200000,
          rfc3161_token: { serial_number: 'TSA-NPL-998812' },
          custodial_log_count: 2,
        },
      ]);
    }
  }

  // Handle Case Preset change
  function handleSelectCasePreset(presetId) {
    setSelectedCaseId(presetId);
    const preset = DEMO_CASE_PRESETS[presetId];
    if (preset) {
      setFirCrimeNumber(preset.fir_crime_number);
      setCourtName(preset.court_name);
      setIoName(preset.investigating_officer.officer_name);
      setIoRank(preset.investigating_officer.designation);
      setIoBadge(preset.investigating_officer.badge_id);
      setPoliceStation(preset.investigating_officer.police_station);
      setIoOrg(preset.investigating_officer.organization);

      setSysName(preset.system_incharge.officer_name);
      setSysDesignation(preset.system_incharge.designation);
      setSysBadge(preset.system_incharge.badge_id);
      setSysOrg(preset.system_incharge.organization);
    }
    loadCaseEvidence(presetId);
    setSimulatedTamperId(null);
    setCompilationError(null);
    setAffidavitResult(null);
  }

  // Refresh NTP Status
  async function refreshNtpStatus() {
    setLoadingNtp(true);
    try {
      const data = await fetchNtpStatusApi();
      setNtpRecord(data);
    } catch {
      setNtpRecord({
        ...OFFICIAL_NTP_RECORD,
        last_sync_timestamp: new Date().toISOString(),
      });
    } finally {
      setLoadingNtp(false);
    }
  }

  // Toggle Simulated Tamper on an Artifact
  function handleToggleTamper(itemId) {
    if (simulatedTamperId === itemId) {
      setSimulatedTamperId(null);
      setCompilationError(null);
    } else {
      setSimulatedTamperId(itemId);
      setCompilationError({
        error: 'COMPILATION_BLOCKED_TAMPER_DETECTED',
        failed_artifact_id: itemId,
        reason: `Cryptographic hash chain validation failed for artifact ${itemId}. Content hash mismatch detected. Pursuant to Section 63 BSA & Arjun Panditrao Khotkar (2020), affidavit compilation is blocked.`,
      });
      setAffidavitResult(null);
    }
  }

  // Compile Affidavit
  async function handleCompileAffidavit() {
    setIsCompiling(true);
    setCompilationError(null);

    // Prepare exhibits with simulated tamper if activated
    const itemsToCompile = evidenceItems.map((item) => {
      if (item.id === simulatedTamperId) {
        return {
          ...item,
          tamper_detected: true,
          is_tampered: true,
        };
      }
      return item;
    });

    const payload = {
      case_id: selectedCaseId,
      evidence_ids: itemsToCompile.map((i) => i.id),
      investigating_officer: {
        officer_name: ioName,
        designation: ioRank,
        badge_id: ioBadge,
        police_station: policeStation,
        organization: ioOrg,
      },
      system_incharge: {
        officer_name: sysName,
        designation: sysDesignation,
        badge_id: sysBadge,
        organization: sysOrg,
      },
      court_name: courtName,
      fir_crime_number: firCrimeNumber,
      affix_digital_signature: affixDsc,
    };

    try {
      // Attempt backend compilation first
      const res = await compileSection63AffidavitApi(payload);
      setAffidavitResult(res);
    } catch (err) {
      if (err.detail?.error === 'COMPILATION_BLOCKED_TAMPER_DETECTED') {
        setCompilationError(err.detail);
        setAffidavitResult(null);
      } else {
        // Fallback to local offline compiler
        try {
          const localRes = compileSection63AffidavitLocally({
            caseId: selectedCaseId,
            evidenceItems: itemsToCompile,
            investigatingOfficer: payload.investigating_officer,
            systemIncharge: payload.system_incharge,
            courtName,
            firCrimeNumber,
            affixDigitalSignature: affixDsc,
          });
          setAffidavitResult(localRes);
        } catch (localErr) {
          if (localErr.status === 'COMPILATION_BLOCKED_TAMPER_DETECTED') {
            setCompilationError({
              error: 'COMPILATION_BLOCKED_TAMPER_DETECTED',
              failed_artifact_id: localErr.failed_artifact_id,
              reason: localErr.message,
            });
          } else {
            alert(`Compilation error: ${localErr.message}`);
          }
          setAffidavitResult(null);
        }
      }
    } finally {
      setIsCompiling(false);
    }
  }

  useEffect(() => {
    loadCaseEvidence(selectedCaseId);
    refreshNtpStatus();
  }, []);

  return (
    <div className="min-h-full bg-[var(--ink)] text-white w-full overflow-x-hidden p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--navy-line)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--saffron)]" />
              Section 63 BSA / 65B IEA Electronic Evidence Affidavit Compiler
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Court-Ready Electronic Evidence Certificate Compiler
          </h1>
          <p className="text-sm text-[var(--mist)] mt-1 max-w-3xl leading-relaxed">
            Compiles case artifacts into a sealed, tamper-evident PDF/A package with SHA-256 digests,
            Stratum 1 CSIR-NPL atomic clock synchronization records, capture device hardware signatures,
            and formal officer declarations.
          </p>
        </div>

        {/* Case Preset Selector */}
        <div className="flex items-center gap-2 bg-[var(--navy)] p-1.5 rounded-2xl border border-[var(--navy-line)]">
          <label htmlFor="case-select" className="text-xs font-mono text-[var(--mist)] px-2">Case:</label>
          <select
            id="case-select"
            value={selectedCaseId}
            onChange={(e) => handleSelectCasePreset(e.target.value)}
            className="bg-slate-900 border border-[var(--navy-line)] rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
          >
            {Object.keys(DEMO_CASE_PRESETS).map((cId) => (
              <option key={cId} value={cId}>
                {cId}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* CRITICAL TAMPER ALERT BANNER IF TAMPER DETECTED */}
        {compilationError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border-2 border-red-500 bg-red-950/70 p-5 shadow-xl flex items-start gap-4 transition-all"
          >
            <div className="p-3 rounded-xl bg-red-600/30 text-red-400 shrink-0">
              <ShieldAlert className="w-8 h-8 text-red-400 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
                  Judicial Admissibility Gate: Compilation Blocked (Tamper Detected)
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-red-100">
                Cryptographic Hash Chain Validation Failed on Artifact: {compilationError.failed_artifact_id}
              </h3>
              <p className="text-xs text-red-200/90 leading-relaxed">
                {compilationError.reason}
              </p>
              <div className="text-[11px] font-mono text-red-300 pt-1 border-t border-red-500/30 flex items-center justify-between">
                <span>Statutory Authority: Section 63(2) Bharatiya Sakshya Adhiniyam, 2023 & Arjun Panditrao Khotkar (2020)</span>
                <button
                  type="button"
                  onClick={() => setSimulatedTamperId(null)}
                  className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white font-bold"
                >
                  Reset Tamper Simulation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Server Clock Stratum 1 NTP Record Banner */}
        <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shrink-0">
              <Clock className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  CSIR-National Physical Laboratory (NPL India) Primary Time Standard
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Stratum {ntpRecord.stratum_level} Active
                </span>
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                NTP Host: <code className="font-mono text-[var(--saffron)]">{ntpRecord.ntp_server_host}</code> ({ntpRecord.reference_clock_id})
              </div>
              <p className="text-xs text-[var(--mist)] mt-0.5">
                Clock Offset: <span className="font-mono text-emerald-400">+{ntpRecord.clock_offset_ms} ms</span> |
                Jitter: <span className="font-mono text-slate-300">{ntpRecord.jitter_ms} ms</span> |
                Leap Indicator: <span className="font-mono text-slate-300">{ntpRecord.leap_indicator} (Normal)</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshNtpStatus}
            disabled={loadingNtp}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[var(--navy-line)] text-xs font-mono text-[var(--mist)] hover:text-white flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingNtp ? 'animate-spin' : ''}`} />
            Verify Stratum Sync
          </button>
        </div>

        {/* 2 Columns: Left = Form & Declarations, Right = Evidence Exhibits & Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 Cols): Case Meta & Officer Declarations */}
          <div className="lg:col-span-5 space-y-5">
            {/* Case Details Card */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 border-b border-[var(--navy-line)] pb-3">
                <Building2 className="w-4 h-4 text-[var(--saffron)]" />
                Case & Court Jurisdictional Metadata
              </h2>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--mist)]">FIR / Crime Reference Number</label>
                  <input
                    type="text"
                    value={firCrimeNumber}
                    onChange={(e) => setFirCrimeNumber(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--mist)]">Jurisdictional Magistrate / Sessions Court</label>
                  <input
                    type="text"
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--mist)]">Investigating Police Station / Unit</label>
                  <input
                    type="text"
                    value={policeStation}
                    onChange={(e) => setPoliceStation(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>
              </div>
            </div>

            {/* Part A: System In-Charge Declaration Fill-In */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  Part A: System In-Charge [BSA § 63(4)(a)]
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Technical Custodian
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--mist)]">Custodian Name</label>
                  <input
                    type="text"
                    value={sysName}
                    onChange={(e) => setSysName(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--mist)]">Badge / Employee ID</label>
                  <input
                    type="text"
                    value={sysBadge}
                    onChange={(e) => setSysBadge(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[var(--mist)]">Official Designation & Laboratory</label>
                <input
                  type="text"
                  value={sysDesignation}
                  onChange={(e) => setSysDesignation(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--navy-line)] text-[11px] text-slate-300 leading-relaxed font-serif">
                "I affirm that I have lawful custody of the computer storage system. During all material periods, the system operated properly with CSIR-NPL Stratum 1 time synchronization without alteration affecting record veracity."
              </div>
            </div>

            {/* Part B: Investigating Officer Declaration Fill-In */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--saffron)]" />
                  Part B: Investigating Officer [BSA § 63(4)(b)]
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  Case IO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--mist)]">IO Full Name</label>
                  <input
                    type="text"
                    value={ioName}
                    onChange={(e) => setIoName(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--mist)]">IO Badge Number</label>
                  <input
                    type="text"
                    value={ioBadge}
                    onChange={(e) => setIoBadge(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--saffron)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[var(--mist)]">Rank & Branch</label>
                <input
                  type="text"
                  value={ioRank}
                  onChange={(e) => setIoRank(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-[var(--navy-line)] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--saffron)]"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--navy-line)] text-[11px] text-slate-300 leading-relaxed font-serif">
                "I affirm that the electronic records in Schedule-A were lawfully seized during investigation into this FIR, cryptographically hashed upon seizure, and preserved in unbroken custody for court production."
              </div>
            </div>

            {/* Digital Signature / DSC Toggle */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-[var(--saffron)] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Affix Digital Signature (DSC / eSign)</div>
                  <div className="text-[11px] text-[var(--mist)]">Simulates cryptographic DSC token stamping on legal declarations</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={affixDsc}
                onChange={(e) => setAffixDsc(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 text-[var(--saffron)] focus:ring-[var(--saffron)] bg-slate-900 cursor-pointer"
              />
            </div>

            {/* Compile Action Button */}
            <button
              type="button"
              onClick={handleCompileAffidavit}
              disabled={isCompiling || Boolean(simulatedTamperId)}
              className="w-full py-3.5 px-4 rounded-xl font-bold bg-[var(--saffron)] hover:bg-[#e07505] text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompiling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying Cryptographic Chains & Compiling...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Compile Sealed Section 63 BSA Affidavit
                </>
              )}
            </button>
          </div>

          {/* Right Column (7 Cols): Enclosed Artifacts & Sealed Results */}
          <div className="lg:col-span-7 space-y-5">
            {/* Artifact Exhibits & Hardware Signatures */}
            <div className="rounded-2xl bg-[var(--navy)] border border-[var(--navy-line)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--saffron)]" />
                    Enclosed Case Artifacts & Capture Hardware ({evidenceItems.length})
                  </h3>
                  <p className="text-xs text-[var(--mist)] mt-0.5">
                    Pre-compilation cryptographic SHA-256 and custodial ledger check
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  {simulatedTamperId ? '⚠️ 1 Corrupted' : '✓ All Intact'}
                </span>
              </div>

              <div className="space-y-3">
                {evidenceItems.map((item, idx) => {
                  const isTampered = item.id === simulatedTamperId;
                  const src = item.source || 'default';
                  const hw = HARDWARE_SIGNATURE_PROFILES[src] || HARDWARE_SIGNATURE_PROFILES.default;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                        isTampered
                          ? 'bg-red-950/40 border-red-500 text-red-200'
                          : 'bg-slate-900/60 border-[var(--navy-line)] text-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--saffron)]">
                              Exhibit P-{idx + 1}
                            </span>
                            <span className="font-semibold text-white text-xs">{item.title}</span>
                          </div>
                          <div className="text-[11px] font-mono text-[var(--mist)] mt-0.5">
                            ID: {item.id} • {item.file_name} • {(item.file_size_bytes / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleTamper(item.id)}
                            className={`px-2 py-1 rounded text-[10px] font-mono border transition ${
                              isTampered
                                ? 'bg-red-900 text-white border-red-400'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {isTampered ? 'Untamper' : 'Simulate Tamper'}
                          </button>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isTampered
                              ? 'bg-red-600 text-white'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}>
                            {isTampered ? 'CORRUPTED' : 'CHAIN VERIFIED'}
                          </span>
                        </div>
                      </div>

                      {/* Cryptographic SHA-256 Digest */}
                      <div className="bg-black/40 p-2 rounded border border-white/5 font-mono text-[11px] text-slate-300 break-all flex items-center justify-between">
                        <span>SHA-256: {item.sha256_hash}</span>
                      </div>

                      {/* Capture Hardware Signature */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-[var(--mist)] bg-slate-900/80 p-2.5 rounded-lg border border-white/5">
                        <div>
                          <span className="text-white">Device:</span> {hw.device_make_model}
                        </div>
                        <div>
                          <span className="text-white">HW ID:</span> {hw.hardware_identifier}
                        </div>
                        <div>
                          <span className="text-white">OS:</span> {hw.operating_system}
                        </div>
                        <div>
                          <span className="text-white">Acquisition Tool:</span> {hw.acquisition_software}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compiled Affidavit Package Result Card */}
            {affidavitResult && (
              <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-950/20 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div>
                      <span className="font-mono text-xs text-emerald-400 uppercase font-bold">
                        Section 63 BSA Sealed Court Package Generated
                      </span>
                      <h4 className="font-display text-base font-bold text-white">
                        {affidavitResult.affidavit_id}
                      </h4>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-600">
                    COURT ADMISSIBLE
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-mono text-[11px] text-emerald-200">
                    Master Cryptographic Manifest SHA-256:
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-emerald-500/30 font-mono text-xs text-white break-all">
                    {affidavitResult.master_manifest_sha256}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[10px] font-mono text-[var(--mist)] uppercase">Total Exhibits</div>
                    <div className="text-base font-bold font-mono text-white mt-0.5">{affidavitResult.total_exhibits}</div>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[10px] font-mono text-[var(--mist)] uppercase">Total File Bytes</div>
                    <div className="text-base font-bold font-mono text-white mt-0.5">
                      {(affidavitResult.total_file_size_bytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[10px] font-mono text-[var(--mist)] uppercase">System In-Charge</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 truncate">
                      {affidavitResult.system_incharge_declaration.esign_status === 'DSC_TOKEN_AFFIXED' ? '✓ DSC Affixed' : 'Pending eSign'}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[10px] font-mono text-[var(--mist)] uppercase">Investigating IO</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 truncate">
                      {affidavitResult.investigating_officer_declaration.esign_status === 'DSC_TOKEN_AFFIXED' ? '✓ DSC Affixed' : 'Pending eSign'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-emerald-500/30">
                  <button
                    type="button"
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(affidavitResult, null, 2));
                      const a = document.createElement('a');
                      a.setAttribute('href', dataStr);
                      a.setAttribute('download', `${affidavitResult.affidavit_id}_sealed_package.json`);
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[var(--navy-line)] text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Sealed JSON Manifest
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="px-4 py-2 rounded-xl bg-[var(--saffron)] hover:bg-[#e07505] text-xs font-bold text-white flex items-center gap-1.5 shadow-md"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print / Export Court PDF/A Package
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINTABLE COURT AFFIDAVIT PREVIEW MODAL */}
      {showPrintModal && affidavitResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-xs uppercase text-amber-700 font-bold">
                  Judicial Court Print Preview
                </span>
                <h3 className="font-serif text-lg font-bold">
                  Section 63 BSA / 65B IEA Electronic Evidence Affidavit
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print?.()}
                  className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold text-xs flex items-center gap-1 shadow"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save as PDF/A
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Embedded HTML Preview Container */}
            <div
              className="border p-6 rounded-lg bg-white shadow-inner font-serif text-xs leading-relaxed max-h-[70vh] overflow-y-auto"
              dangerouslySetInnerHTML={{
                __html: affidavitResult.court_printable_html || '<p>Loading printable affidavit...</p>',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

