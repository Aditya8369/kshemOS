import React, { useState, useEffect, useRef } from 'react';
import {
  captureFieldSeizure,
  getStoredFieldSeizures,
  getFieldSeizureStats,
  isDeviceOnline,
  isSimulatedOffline,
  setSimulatedOffline,
  triggerVaultSync,
  verifyIntakeLocally,
  resetLocalFieldSeizuresStore,
  FIELD_SEIZURES_CHANGED_EVENT,
  DEFAULT_OFFICER_PIN,
} from '../../fieldSeizureStore';
import {
  generateQRCodeSVG,
  encodeSignalingPayload,
  decodeSignalingPayload,
  applyPeerMeshExchange,
  P2PMeshSyncSession,
  executeSimulatedPeerMeshSync,
} from '../../p2pSyncEngine';

const DEVICE_CATEGORIES = [
  { id: 'smartphone', label: 'Smartphone', icon: '📱' },
  { id: 'laptop', label: 'Laptop / PC', icon: '💻' },
  { id: 'tablet', label: 'Tablet', icon: '📟' },
  { id: 'hard_drive', label: 'Hard Drive / SSD', icon: '💾' },
  { id: 'crypto_hardware_wallet', label: 'Crypto Wallet', icon: '🔑' },
  { id: 'sim_card', label: 'SIM Card', icon: '📇' },
  { id: 'feature_phone', label: 'Feature Phone', icon: '📞' },
];

export default function FieldSeizureCompanionView() {
  const [activeTab, setActiveTab] = useState('vault'); // 'vault' | 'intake' | 'intake-verification'
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    totalSeizures: 0,
    offlineQueued: 0,
    syncedClean: 0,
    tamperFlagged: 0,
    faradaySealedPercent: 100,
  });
  const [online, setOnline] = useState(true);
  const [simulatedOfflineActive, setSimulatedOfflineActive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for New Intake
  const [formData, setFormData] = useState({
    case_id: 'CASE-2026-DELHI-01',
    incident_id: 'INC-DEL-405',
    officer_badge: 'INSP-VERMA-771',
    officer_name: 'Inspector Ananya Verma',
    police_station: 'Special Cyber Crime Cell, New Delhi',
    device_category: 'smartphone',
    make_model: 'Google Pixel 8 Pro (256GB, Obsidian)',
    imei1: '358901239988771',
    imei2: '358901239988772',
    mac_address: '74:8D:08:44:11:99',
    serial_number: 'PIX8-9922110',
    seizure_bag_barcode: `BAG-DEL-${Math.floor(1000 + Math.random() * 9000)}-X`,
    faraday_bag_sealed: true,
    power_state_at_seizure: 'powered_off',
    sim_card_status: 'removed_and_bagged',
    landmark: 'Syndicate Call Center Floor 3, Connaught Place',
    police_circle: 'Connaught Place PS',
    photo_hashes: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  });

  // Central Intake Verification Form State
  const [intakeTargetId, setIntakeTargetId] = useState('SEIZ-2026-DEL-02');
  const [intakeForm, setIntakeForm] = useState({
    verified_by_badge: 'LAB-TECH-SOOD-09',
    received_bag_barcode: 'BAG-DEL-7783-B',
    verified_serial: 'C02G90XXMD6M',
    verified_imei1: '',
    bag_seal_intact: true,
    intake_notes: 'Evidence bag seal verified under UV lamp. Intact.',
  });
  const [intakeResult, setIntakeResult] = useState(null);

  // Peer Mesh Sync State
  const [meshMode, setMeshMode] = useState('initiator'); // 'initiator' | 'receiver' | 'simulation'
  const [meshSession, setMeshSession] = useState(null);
  const [meshStatus, setMeshStatus] = useState('idle'); // 'idle' | 'generating' | 'ready_offer' | 'ready_answer' | 'connected' | 'completed' | 'error'
  const [offerPayloadString, setOfferPayloadString] = useState('');
  const [answerPayloadString, setAnswerPayloadString] = useState('');
  const [scannedInput, setScannedInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [meshLogs, setMeshLogs] = useState([]);
  const [meshResult, setMeshResult] = useState(null);
  const [peerOfficerBadge, setPeerOfficerBadge] = useState('SUB-INSP-DESHMUKH-202');
  const [peerOfficerName, setPeerOfficerName] = useState('Sub-Inspector Vikram Deshmukh');
  const [officerPinInput, setOfficerPinInput] = useState(DEFAULT_OFFICER_PIN);
  const [copiedToken, setCopiedToken] = useState(false);
  const videoRef = useRef(null);

  function addMeshLog(message, type = 'info') {
    setMeshLogs((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), message, type },
    ]);
  }

  async function startCameraScanner() {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access API not available in this browser context. Please paste the QR payload string below.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      addMeshLog('Camera scanner activated. Point lens at peer officer QR code.');
    } catch (err) {
      console.warn('Camera scanner error:', err);
      setCameraError(err.message || 'Camera permission denied or device not found.');
      setCameraActive(false);
      addMeshLog(`Camera start warning: ${err.message || 'Permission denied'}. Using manual paste mode.`, 'warn');
    }
  }

  function stopCameraScanner() {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function handleGenerateOffer() {
    setMeshStatus('generating');
    setMeshResult(null);
    addMeshLog('Generating Ephemeral WebRTC DataChannel Offer...');
    try {
      const session = new P2PMeshSyncSession({
        role: 'initiator',
        officerBadge: formData.officer_badge,
        officerName: formData.officer_name,
        officerPin: officerPinInput,
        onStatusChange: (st) => setMeshStatus(st),
        onLog: ({ message, type }) => addMeshLog(message, type),
        onSyncComplete: (summary) => {
          setMeshResult(summary);
          refreshData();
        },
      });
      setMeshSession(session);
      const offer = await session.createOffer();
      setOfferPayloadString(offer);
      setMeshStatus('ready_offer');
      addMeshLog('Ephemeral Offer QR ready. Present this screen to Peer Officer to scan.');
    } catch (err) {
      setMeshStatus('error');
      addMeshLog(`Offer generation failed: ${err.message}`, 'error');
    }
  }

  async function handleProcessOfferAndCreateAnswer() {
    if (!scannedInput || !scannedInput.trim()) {
      alert('Please scan or paste the Offer QR payload first.');
      return;
    }
    setMeshStatus('generating');
    setMeshResult(null);
    addMeshLog('Ingesting Offer and generating Ephemeral SDP Answer...');
    try {
      const session = new P2PMeshSyncSession({
        role: 'receiver',
        officerBadge: peerOfficerBadge,
        officerName: peerOfficerName,
        officerPin: officerPinInput,
        onStatusChange: (st) => setMeshStatus(st),
        onLog: ({ message, type }) => addMeshLog(message, type),
        onSyncComplete: (summary) => {
          setMeshResult(summary);
          refreshData();
        },
      });
      setMeshSession(session);
      const answer = await session.createAnswerFromOffer(scannedInput.trim());
      setAnswerPayloadString(answer);
      setMeshStatus('ready_answer');
      if (cameraActive) stopCameraScanner();
      addMeshLog('Ephemeral Answer QR generated! Show this QR to the Initiator Officer.');
    } catch (err) {
      setMeshStatus('error');
      addMeshLog(`Answer generation error: ${err.message}`, 'error');
    }
  }

  async function handleFinalizeAnswerOnInitiator() {
    if (!scannedInput || !scannedInput.trim()) {
      alert('Please scan or paste the Answer QR payload from the peer device.');
      return;
    }
    addMeshLog('Applying Peer Answer to finalize WebRTC DataChannel...');
    try {
      if (meshSession) {
        await meshSession.applyAnswer(scannedInput.trim());
      } else {
        const answerObj = decodeSignalingPayload(scannedInput.trim());
        addMeshLog(`Pairing acknowledged by ${answerObj.officerBadge}. Performing cryptographic reconciliation.`);
        const res = executeSimulatedPeerMeshSync({
          localOfficerBadge: formData.officer_badge,
          localOfficerName: formData.officer_name,
          peerOfficerBadge: answerObj.officerBadge || peerOfficerBadge,
          peerOfficerName: answerObj.officerName || peerOfficerName,
          officerPin: officerPinInput,
        });
        setMeshResult(res.auditSummary);
        setMeshStatus('completed');
        refreshData();
      }
      if (cameraActive) stopCameraScanner();
    } catch (err) {
      addMeshLog(`Finalization failed: ${err.message}`, 'error');
    }
  }

  function handleExecuteSimulation() {
    addMeshLog('Starting 1-Tap Peer Mesh Synchronization Loopback Simulation...');
    setMeshStatus('generating');
    try {
      const res = executeSimulatedPeerMeshSync({
        localOfficerBadge: formData.officer_badge,
        localOfficerName: formData.officer_name,
        peerOfficerBadge,
        peerOfficerName,
        officerPin: officerPinInput,
      });
      setMeshResult(res.auditSummary);
      setMeshStatus('completed');
      refreshData();
      addMeshLog(`Peer sync succeeded! ${res.auditSummary.addedNew} added, ${res.auditSummary.conflictsResolved} conflicts resolved under immutable timestamp order.`, 'success');
    } catch (err) {
      setMeshStatus('error');
      addMeshLog(`Simulation error: ${err.message}`, 'error');
    }
  }

  function handleCopyToken(tokenText) {
    if (!tokenText) return;
    navigator.clipboard?.writeText?.(tokenText);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  function refreshData() {
    try {
      const recs = getStoredFieldSeizures();
      setRecords(recs);
      setStats(getFieldSeizureStats());
      setOnline(isDeviceOnline());
      setSimulatedOfflineActive(isSimulatedOffline());
    } catch {
      // Storage decrypt failed or error
    }
  }

  useEffect(() => {
    refreshData();

    function handleStorageChanged() {
      refreshData();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(FIELD_SEIZURES_CHANGED_EVENT, handleStorageChanged);
      window.addEventListener('online', refreshData);
      window.addEventListener('offline', refreshData);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(FIELD_SEIZURES_CHANGED_EVENT, handleStorageChanged);
        window.removeEventListener('online', refreshData);
        window.removeEventListener('offline', refreshData);
      }
    };
  }, []);

  function handleToggleSimulatedOffline() {
    const nextState = !simulatedOfflineActive;
    setSimulatedOffline(nextState);
    setSimulatedOfflineActive(nextState);
    setOnline(!nextState);
    refreshData();
  }

  async function handleManualSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await triggerVaultSync();
      setSyncMessage(res.message || `Successfully synced ${res.synced} devices to Central Evidence Vault.`);
      refreshData();
    } catch (err) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function handleCaptureSubmit(e) {
    e.preventDefault();
    try {
      const record = captureFieldSeizure({
        ...formData,
        seizure_location: {
          landmark: formData.landmark,
          police_circle: formData.police_circle,
        },
      });
      setSelectedReceipt(record.genesis_receipt);
      refreshData();
      setActiveTab('vault');
    } catch (err) {
      alert(`Capture failed: ${err.message}`);
    }
  }

  function handleExecuteIntakeVerification(e) {
    e.preventDefault();
    try {
      const res = verifyIntakeLocally(intakeTargetId, intakeForm);
      setIntakeResult(res);
      refreshData();
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    }
  }

  // Filtered Records
  const filteredRecords = records.filter((r) => {
    if (filterStatus === 'queued_offline' && r.sync_status !== 'queued_offline') return false;
    if (filterStatus === 'synced_verified' && (r.sync_status !== 'synced_verified' || r.tamper_flag)) return false;
    if (filterStatus === 'tamper_flagged' && !r.tamper_flag) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.seizure_id?.toLowerCase().includes(q) ||
        r.case_id?.toLowerCase().includes(q) ||
        r.make_model?.toLowerCase().includes(q) ||
        r.seizure_bag_barcode?.toLowerCase().includes(q) ||
        r.serial_number?.toLowerCase().includes(q) ||
        r.imei1?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Connectivity & PWA Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--paper-line)] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--saffron)] font-bold">
                KshemOS Field Forensics PWA
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300">
                BNSS § 105 / CrPC § 102
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)] tracking-tight">
              Offline Field Seizure & Device Triage Companion
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/70 mt-1 max-w-3xl">
              Ruggedized offline capture for on-scene electronic hardware seizures. Generates SHA-256 genesis receipts,
              secures storage at rest with officer key encryption, and resolves conflicts via immutable timestamp order.
            </p>
          </div>

          {/* Offline / Cellular Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${online
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}
              title={
                online
                  ? 'Live Connected: Uplink to Central Evidence Vault is active'
                  : 'Field Offline: Local IndexedDB encryption active. Records have not reached HQ.'
              }
              aria-label={
                online
                  ? 'Cellular Active: Online and connected to Evidence Vault'
                  : 'Offline Field Mode: Local device storage only'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                  }`}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] opacity-75 uppercase" aria-hidden="true">
                {online ? '[LIVE]' : '[OFFLINE]'}
              </span>
              <span>{online ? 'Cellular Active (Online)' : 'Offline Field Mode'}</span>
            </div>

            <button
              type="button"
              onClick={handleToggleSimulatedOffline}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-sm cursor-pointer ${simulatedOfflineActive
                  ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                  : 'bg-white text-[var(--ink)] border-[var(--paper-line)] hover:bg-[var(--paper)]'
                }`}
            >
              {simulatedOfflineActive ? '⚡ Restore Cellular Signal' : '📡 Simulate Cellular Drop'}
            </button>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing || !online}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink)]/90 disabled:opacity-40 transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {syncing ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Syncing...
                </>
              ) : (
                <>🔄 Sync to Evidence Vault</>
              )}
            </button>
          </div>
        </div>

        {/* Sync message alert banner */}
        {syncMessage && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium flex items-center justify-between">
            <span>ℹ️ {syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-blue-700 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-mono uppercase text-[var(--ink-text)]/60">Total Hardware Seizures</div>
            <div className="text-2xl font-bold font-mono text-[var(--ink)] mt-1">{stats.totalSeizures}</div>
            <div className="text-[10px] text-emerald-600 mt-1">Encrypted at rest</div>
          </div>

          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-mono uppercase text-amber-700 font-bold">Queued Offline</div>
            <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{stats.offlineQueued}</div>
            <div className="text-[10px] text-[var(--ink-text)]/50 mt-1">Awaiting cellular sync</div>
          </div>

          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-mono uppercase text-emerald-700 font-bold">Vault Synced Clean</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">{stats.syncedClean}</div>
            <div className="text-[10px] text-[var(--ink-text)]/50 mt-1">Genesis verified</div>
          </div>

          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-mono uppercase text-red-700 font-bold">Tamper Flagged</div>
            <div className="text-2xl font-bold font-mono text-red-600 mt-1">{stats.tamperFlagged}</div>
            <div className="text-[10px] text-red-500 mt-1">Breach warning active</div>
          </div>

          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="text-[10px] font-mono uppercase text-[var(--ink-text)]/60">Faraday Isolation</div>
            <div className="text-2xl font-bold font-mono text-purple-700 mt-1">{stats.faradaySealedPercent}%</div>
            <div className="text-[10px] text-[var(--ink-text)]/50 mt-1">Anti-remote wipe sealed</div>
          </div>
        </div>

        {/* Truth-in-State Field Warning Banner */}
        {stats.offlineQueued > 0 && (
          <div
            role="status"
            className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base" aria-hidden="true">📡</span>
              <div>
                <span className="font-bold block">
                  {stats.offlineQueued} Hardware Capture{stats.offlineQueued > 1 ? 's' : ''} Stored Locally (Pending Uplink):
                </span>
                <span className="text-[11px] text-amber-800">
                  Genesis receipts are cryptographically sealed in local IndexedDB. These records have <strong>not</strong> reached the Central Evidence Vault yet.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing || !online}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer disabled:opacity-40 shadow-sm"
            >
              {syncing ? 'Syncing…' : 'Sync to Central Vault Now'}
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--paper-line)] gap-2">
          <div className="flex border-b border-[var(--paper-line)] gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${onClick = {() => {
              if (cameraActive) stopCameraScanner();
            setActiveTab('vault');
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'vault'
                ? 'border-[var(--saffron)] text-[var(--ink)]'
                : 'border-transparent text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
              }`}
          >
            📦 Seized Hardware Vault & Sync Queue ({records.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intake')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${onClick = {() => {
              if (cameraActive) stopCameraScanner();
          setActiveTab('intake');
            }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'intake'
              ? 'border-[var(--saffron)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
            }`}
          >
          ➕ On-Scene Seizure Capture (PWA)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('intake-verification')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${onClick = {() => {
              if (cameraActive) stopCameraScanner();
        setActiveTab('intake-verification');
            }}
        className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'intake-verification'
            ? 'border-[var(--saffron)] text-[var(--ink)]'
            : 'border-transparent text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
          }`}
          >
        🔬 Central Intake & Tamper Lab
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('mesh-sync')}
        className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeTab === 'mesh-sync'
            ? 'border-[var(--saffron)] text-[var(--ink)]'
            : 'border-transparent text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
          }`}
      >
        📡 Peer Mesh Sync (Local)
        {records.some((r) => r.chain_of_custody_events?.some((e) => e.action === 'PEER_MESH_EXCHANGED')) && (
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="Peer mesh records reconciled" />
        )}
      </button>
    </div>

        {/* TAB 1: VAULT LIST */ }
  {
    activeTab === 'vault' && (
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[var(--paper-line)]">
          <input
            type="text"
            placeholder="Search by Seizure ID, Case, Make, Barcode, Serial, IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--paper-line)] text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none flex-1"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {['all', 'queued_offline', 'synced_verified', 'tamper_flagged'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl font-semibold capitalize whitespace-nowrap cursor-pointer transition ${filterStatus === st
                    ? 'bg-[var(--ink)] text-white'
                    : 'bg-[var(--paper)] text-[var(--ink-text)]/70 hover:bg-gray-200'
                  }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Hardware Cards */}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[var(--paper-line)] text-xs text-[var(--ink-text)]/60">
            No seized devices match your filter criteria.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((r) => {
              const isTampered = r.tamper_flag;
              const isOfflineQueued = r.sync_status === 'queued_offline';

              return (
                <div
                  key={r.seizure_id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm transition hover:shadow-md flex flex-col justify-between ${isTampered
                      ? 'border-red-300 ring-2 ring-red-400/20'
                      : isOfflineQueued
                        ? 'border-amber-300'
                        : 'border-[var(--paper-line)]'
                    }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] text-[var(--ink-text)]/50 block">
                          {r.seizure_id}
                        </span>
                        <h3 className="font-bold text-sm text-[var(--ink)] leading-snug">
                          {r.make_model}
                        </h3>
                      </div>
                      {isTampered ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 shrink-0"
                          title="Tamper warning: on-scene and central hashes mismatch"
                          aria-label="Tamper Flagged: On-scene capture differs from central intake verification"
                        >
                          [TAMPER] ⚠️ TAMPER FLAGGED
                        </span>
                      ) : isOfflineQueued ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0"
                          title="Saved locally on device — has NOT reached Central Evidence Vault yet"
                          aria-label="Queued Offline: Saved locally on this device only, not yet confirmed by Central Evidence Vault"
                        >
                          [LOCAL ONLY] 📡 QUEUED OFFLINE
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0"
                          title="Confirmed on Central Evidence Vault"
                          aria-label="Vault Synced: Confirmed by Central Evidence Vault"
                        >
                          [CONFIRMED] ✓ VAULT SYNCED
                        </span>
                      )}
                    </div>

                    {/* Truth-in-State Card Level Indicator */}
                    {isOfflineQueued ? (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] leading-relaxed">
                        <span className="font-bold block text-[10px] font-mono text-amber-850 uppercase">[LOCAL STORAGE ONLY]</span>
                        Genesis receipt generated &amp; encrypted. Has <strong>not</strong> reached Central Evidence Vault yet.
                      </div>
                    ) : !isTampered && (
                      <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-[10px] font-mono flex items-center gap-1.5">
                        <span className="text-emerald-700 font-bold uppercase">[CONFIRMED]</span>
                        <span>Central Evidence Vault verified</span>
                      </div>
                    )}

                    {/* Tamper Warning Banner */}
                    {isTampered && r.tamper_reason && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px] leading-relaxed">
                        <span className="font-bold block">🚨 Chain of Custody Breach:</span>
                        {r.tamper_reason}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[var(--paper)] p-2.5 rounded-xl font-mono">
                      <div>
                        <span className="text-[var(--ink-text)]/50 block text-[9px] uppercase">Bag Barcode</span>
                        <span className="font-bold text-[var(--ink)]">{r.seizure_bag_barcode}</span>
                      </div>
                      <div>
                        <span className="text-[var(--ink-text)]/50 block text-[9px] uppercase">Faraday Sealed</span>
                        <span className={r.faraday_bag_sealed ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                          {r.faraday_bag_sealed ? '✓ Isolated' : '✕ Unshielded'}
                        </span>
                      </div>
                      {r.imei1 && (
                        <div className="col-span-2">
                          <span className="text-[var(--ink-text)]/50 block text-[9px] uppercase">IMEI 1</span>
                          <span className="text-[var(--ink)] break-all">{r.imei1}</span>
                        </div>
                      )}
                      {r.serial_number && (
                        <div className="col-span-2">
                          <span className="text-[var(--ink-text)]/50 block text-[9px] uppercase">Serial Number</span>
                          <span className="text-[var(--ink)] break-all">{r.serial_number}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-[var(--ink-text)]/60 font-mono space-y-0.5">
                      <div>Case: <span className="text-[var(--ink)] font-semibold">{r.case_id}</span></div>
                      <div>Officer: {r.officer_name} ({r.officer_badge})</div>
                      <div>Captured: {new Date(r.offline_timestamp_ms).toLocaleString()}</div>
                    </div>

                    {/* Peer Mesh Reconciled Indicator */}
                    {r.chain_of_custody_events?.some((e) => e.action === 'PEER_MESH_EXCHANGED') && (
                      <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 text-[10px] font-mono flex items-center justify-between">
                        <div className="flex items-center gap-1 font-bold text-indigo-700">
                          <span>📡 [PEER MESH RECONCILED]</span>
                        </div>
                        <span className="text-[9px] text-indigo-800">
                          Peer: {r.chain_of_custody_events.find((e) => e.action === 'PEER_MESH_EXCHANGED')?.peer_officer_badge_id || 'PEER-UNIT'}
                        </span>
                      </div>
                    )}

                    {/* Cryptographic Genesis Digest */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-[9px] break-all">
                      <span className="text-gray-400 block uppercase">SHA-256 Genesis Hash:</span>
                      <span className="text-gray-800">{r.on_site_genesis_hash}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--paper-line)] mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(r.genesis_receipt)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--paper)] hover:bg-gray-200 text-[var(--ink)] text-xs font-semibold cursor-pointer"
                    >
                      📜 Genesis Receipt
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIntakeTargetId(r.seizure_id);
                        setIntakeForm({
                          verified_by_badge: 'LAB-TECH-SOOD-09',
                          received_bag_barcode: r.seizure_bag_barcode,
                          verified_serial: r.serial_number || '',
                          verified_imei1: r.imei1 || '',
                          bag_seal_intact: true,
                          intake_notes: 'Physical intake inspection.',
                        });
                        setActiveTab('intake-verification');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold cursor-pointer border border-purple-200"
                    >
                      🔬 Inspect at Intake
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )
  }

  {/* TAB 2: ON-SCENE CAPTURE FORM */ }
  {
    activeTab === 'intake' && (
      <form
        onSubmit={handleCaptureSubmit}
        className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-6 max-w-4xl mx-auto"
      >
        <div>
          <span className="text-xs font-mono font-bold uppercase text-[var(--saffron)]">
            On-Scene Seizure Intake
          </span>
          <h2 className="text-xl font-bold font-display text-[var(--ink)]">
            Photograph & Cryptographically Seal Seized Hardware
          </h2>
          <p className="text-xs text-[var(--ink-text)]/70 mt-1">
            Generates immutable SHA-256 genesis hash binding hardware serials, Faraday seal status, and GNSS clock strata.
          </p>
        </div>

        {/* Category selection */}
        <div>
          <label className="block text-xs font-semibold text-[var(--ink)] mb-2">
            Device Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DEVICE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData({ ...formData, device_category: cat.id })}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition ${formData.device_category === cat.id
                    ? 'border-[var(--saffron)] bg-amber-50 text-[var(--ink)] ring-2 ring-[var(--saffron)]/20'
                    : 'border-[var(--paper-line)] bg-white text-[var(--ink-text)]/70 hover:bg-[var(--paper)]'
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hardware Identifiers */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Device Make & Model *
            </label>
            <input
              type="text"
              required
              value={formData.make_model}
              onChange={(e) => setFormData({ ...formData, make_model: e.target.value })}
              placeholder="e.g. Apple iPhone 15 Pro Max 256GB"
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Tamper-Evident Bag Barcode *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={formData.seizure_bag_barcode}
                onChange={(e) => setFormData({ ...formData, seizure_bag_barcode: e.target.value })}
                placeholder="BAG-DEL-XXXX-A"
                className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    seizure_bag_barcode: `BAG-DEL-${Math.floor(1000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
                  })
                }
                className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[10px] font-mono cursor-pointer shrink-0"
              >
                Scan / Gen
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              IMEI 1 (Primary SIM)
            </label>
            <input
              type="text"
              value={formData.imei1}
              onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
              placeholder="15-digit IMEI (e.g. 358901239988771)"
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              IMEI 2 / eSIM Identifier
            </label>
            <input
              type="text"
              value={formData.imei2}
              onChange={(e) => setFormData({ ...formData, imei2: e.target.value })}
              placeholder="Secondary IMEI (if dual SIM)"
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Serial Number (Chassis / Board)
            </label>
            <input
              type="text"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              placeholder="Manufacturer Serial No."
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Wi-Fi / Bluetooth MAC Address
            </label>
            <input
              type="text"
              value={formData.mac_address}
              onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none"
            />
          </div>
        </div>

        {/* Preservation Safeguards */}
        <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 space-y-3">
          <span className="text-xs font-bold text-purple-900 block">
            🛡️ Digital Preservation Checklist (Anti-Remote Wipe & Evidence Integrity)
          </span>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="faraday"
              checked={formData.faraday_bag_sealed}
              onChange={(e) => setFormData({ ...formData, faraday_bag_sealed: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="faraday" className="text-xs font-medium text-[var(--ink)] cursor-pointer">
              Sealed inside RF-shielded Faraday Bag / Sleeve (Prevents MDM remote wipes, cellular pings, and iCloud kills)
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Power State at Seizure</label>
              <select
                value={formData.power_state_at_seizure}
                onChange={(e) => setFormData({ ...formData, power_state_at_seizure: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white"
              >
                <option value="powered_off">Powered Off (Cold Boot Protection)</option>
                <option value="powered_on">Powered On (Volatile RAM Acquisition)</option>
                <option value="airplane_mode_locked">Airplane Mode & Locked</option>
                <option value="damaged">Physically Damaged</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">SIM Card Handling</label>
              <select
                value={formData.sim_card_status}
                onChange={(e) => setFormData({ ...formData, sim_card_status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white"
              >
                <option value="removed_and_bagged">Removed & Bagged in Separate Anti-Static Pouch</option>
                <option value="kept_in_slot">Kept in SIM Tray (Locked)</option>
                <option value="no_sim">No Physical SIM Slot (eSIM only)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Officer & Location Details */}
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Investigating Case ID</label>
            <input
              type="text"
              value={formData.case_id}
              onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Officer Badge & Name</label>
            <input
              type="text"
              value={`${formData.officer_badge} - ${formData.officer_name}`}
              disabled
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] bg-gray-50 text-gray-600 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Seizure Location Landmark</label>
            <input
              type="text"
              value={formData.landmark}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)]"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 rounded-2xl bg-[var(--saffron)] text-white font-bold text-sm hover:opacity-95 transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
        >
          <span>🔒</span>
          <span>Generate SHA-256 Genesis Receipt & Seal Record</span>
        </button>
      </form>
    )
  }

  {/* TAB 3: CENTRAL INTAKE VERIFICATION LAB */ }
  {
    activeTab === 'intake-verification' && (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase text-purple-700">
              Central Forensic Evidence Room
            </span>
            <h2 className="text-xl font-bold font-display text-[var(--ink)]">
              Physical Hardware Intake & Tamper Detection Inspection
            </h2>
            <p className="text-xs text-[var(--ink-text)]/70 mt-1">
              When evidence bags arrive at the central cyber forensics desk, re-inspect barcodes and serials.
              Any deviation from the on-site genesis hash triggers an automatic statutory breach alert.
            </p>
          </div>

          {/* Select target seizure */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Select Seized Device Arrived at Forensics Desk
            </label>
            <select
              value={intakeTargetId}
              onChange={(e) => {
                const id = e.target.value;
                setIntakeTargetId(id);
                const sel = records.find((r) => r.seizure_id === id);
                if (sel) {
                  setIntakeForm({
                    verified_by_badge: 'LAB-TECH-SOOD-09',
                    received_bag_barcode: sel.seizure_bag_barcode,
                    verified_serial: sel.serial_number || '',
                    verified_imei1: sel.imei1 || '',
                    bag_seal_intact: true,
                    intake_notes: 'Physical intake inspection.',
                  });
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--paper-line)] text-xs font-mono"
            >
              {records.map((r) => (
                <option key={r.seizure_id} value={r.seizure_id}>
                  {r.seizure_id} - {r.make_model} (Bag: {r.seizure_bag_barcode}) {r.tamper_flag ? '[TAMPER FLAGGED]' : ''}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleExecuteIntakeVerification} className="space-y-4 pt-2">
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Received Physical Bag Barcode *
                </label>
                <input
                  type="text"
                  required
                  value={intakeForm.received_bag_barcode}
                  onChange={(e) => setIntakeForm({ ...intakeForm, received_bag_barcode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono"
                />
                <span className="text-[10px] text-gray-500">
                  Simulate tampering: alter this barcode to trigger alert
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Verified Hardware Serial
                </label>
                <input
                  type="text"
                  value={intakeForm.verified_serial}
                  onChange={(e) => setIntakeForm({ ...intakeForm, verified_serial: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Verified Hardware IMEI 1
                </label>
                <input
                  type="text"
                  value={intakeForm.verified_imei1}
                  onChange={(e) => setIntakeForm({ ...intakeForm, verified_imei1: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Examining Lab Officer Badge
                </label>
                <input
                  type="text"
                  value={intakeForm.verified_by_badge}
                  onChange={(e) => setIntakeForm({ ...intakeForm, verified_by_badge: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono"
                />
              </div>
            </div>

            {/* Tamper Seal Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                id="sealIntact"
                checked={intakeForm.bag_seal_intact}
                onChange={(e) => setIntakeForm({ ...intakeForm, bag_seal_intact: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="sealIntact" className="text-xs font-semibold text-[var(--ink)] cursor-pointer">
                Tamper-Evident Tape & Bag Heat-Seal Intact (Uncheck to simulate broken bag seal)
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-700 text-white font-bold text-xs hover:bg-purple-800 transition cursor-pointer shadow-sm"
            >
              Verify Physical Intake & Compute Verification Hash
            </button>
          </form>

          {/* Real-time result banner */}
          {intakeResult && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${intakeResult.tamper_flag
                  ? 'bg-red-50 border-red-300 text-red-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {intakeResult.tamper_flag ? (
                  <>🚨 INTEGRITY_TAMPER_FLAGGED: Breached Custodial Chain</>
                ) : (
                  <>✓ INTAKE_VERIFIED_VALID: Genesis Seal Intact</>
                )}
              </div>
              <div className="font-mono text-[11px] break-all">
                <div>On-Site Genesis Hash: {intakeResult.on_site_genesis_hash}</div>
                <div>Central Intake Hash: {intakeResult.central_intake_hash}</div>
              </div>
              {intakeResult.tamper_reason && (
                <p className="font-semibold text-red-800">{intakeResult.tamper_reason}</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  {/* TAB 4: PEER-TO-PEER WEBRTC MESH SYNC */ }
  {
    activeTab === 'mesh-sync' && (
      <div className="space-y-6">
        {/* Mesh Mode Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 text-white shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">📡</span>
                <h2 className="text-xl font-bold tracking-tight">
                  Peer-to-Peer WebRTC Mesh Synchronization (Local)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Zero-Cellular WebRTC DataChannel
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                Synchronize electronic hardware seizure records between field companion devices without cellular or HQ uplink.
                Uses ephemeral QR codes for SDP offer/answer signaling, transmits PIN-encrypted genesis logs over direct WebRTC DataChannel,
                and resolves concurrent seizures via immutable on-scene timestamp order.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono">
                <span className="text-slate-400 text-[10px] block">Local Officer Badge:</span>
                <span className="font-bold text-white">{formData.officer_badge}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono">
                <span className="text-slate-400 text-[10px] block">Vault Encryption PIN:</span>
                <span className="font-bold text-emerald-400">•••• ({officerPinInput})</span>
              </div>
            </div>
          </div>

          {/* Sub-Mode Selector */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-900/50">
            <button
              type="button"
              onClick={() => {
                setMeshMode('initiator');
                setMeshStatus('idle');
                setScannedInput('');
                if (cameraActive) stopCameraScanner();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${meshMode === 'initiator'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-indigo-200 hover:bg-slate-800 border border-indigo-900'
                }`}
            >
              <span>📡</span>
              Initiate Mesh (Offer QR)
            </button>

            <button
              type="button"
              onClick={() => {
                setMeshMode('receiver');
                setMeshStatus('idle');
                setScannedInput('');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${meshMode === 'receiver'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-indigo-200 hover:bg-slate-800 border border-indigo-900'
                }`}
            >
              <span>📷</span>
              Join Mesh (Scan &amp; Answer QR)
            </button>

            <button
              type="button"
              onClick={() => {
                setMeshMode('simulation');
                if (cameraActive) stopCameraScanner();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${meshMode === 'simulation'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-emerald-200 hover:bg-slate-800 border border-emerald-900'
                }`}
            >
              <span>⚡</span>
              1-Tap Loopback Test (Simulation)
            </button>
          </div>
        </div>

        {/* INITIATOR FLOW */}
        {meshMode === 'initiator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Step 1: Generate & Present Offer QR */}
            <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">Step 1: Offeror</span>
                  <h3 className="font-bold text-sm text-[var(--ink)]">Generate Ephemeral Offer QR</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SDP Handshake
                </span>
              </div>

              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Creates an ephemeral WebRTC DataChannel connection offer embedded with local ICE candidates and officer credentials.
                The peer officer scans this QR code to generate their cryptographic answer.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateOffer}
                  disabled={meshStatus === 'generating'}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {meshStatus === 'generating' ? 'Generating SDP...' : '🔄 Generate Offer QR Code'}
                </button>
                {offerPayloadString && (
                  <button
                    type="button"
                    onClick={() => handleCopyToken(offerPayloadString)}
                    className="px-3.5 py-2.5 rounded-xl border border-[var(--paper-line)] hover:bg-[var(--paper)] text-xs font-semibold transition cursor-pointer"
                  >
                    {copiedToken ? '✓ Copied Token' : '📋 Copy Offer Token'}
                  </button>
                )}
              </div>

              {offerPayloadString && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
                  <div className="text-[11px] font-bold text-slate-700">
                    Scan with Peer Companion Camera:
                  </div>
                  <div className="flex justify-center">
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(generateQRCodeSVG(offerPayloadString, { size: 240 }))}`}
                      alt="WebRTC SDP Offer QR Code"
                      className="w-56 h-56 rounded-2xl border border-slate-300 shadow-md p-2 bg-white mx-auto"
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 break-all bg-white p-2 rounded-xl border max-h-20 overflow-y-auto">
                    {offerPayloadString}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Ingest Receiver Answer */}
            <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase">Step 2: Pairing</span>
                  <h3 className="font-bold text-sm text-[var(--ink)]">Ingest Peer Answer &amp; Finalize</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Channel Open
                </span>
              </div>

              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Scan the Answer QR code presented by the joining peer officer (or paste their signaling token string) to open the WebRTC DataChannel.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cameraActive ? stopCameraScanner : startCameraScanner}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${cameraActive
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                  >
                    {cameraActive ? '⏹ Stop Camera' : '📷 Start Camera Scanner'}
                  </button>
                </div>

                {cameraActive && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-black aspect-video max-h-56">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none m-6" />
                    <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-white bg-black/70 px-2 py-1 rounded">
                      Point camera lens at peer officer's Answer QR code
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono uppercase text-[var(--ink-text)]/60 block mb-1">
                    Peer Answer Token (Paste or Camera Decode):
                  </label>
                  <textarea
                    rows={3}
                    value={scannedInput}
                    onChange={(e) => setScannedInput(e.target.value)}
                    placeholder="Paste KSHEMOS:ANSWER:... payload here"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleFinalizeAnswerOnInitiator}
                  disabled={!scannedInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40"
                >
                  Establish DataChannel &amp; Exchange Seizures
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RECEIVER FLOW */}
        {meshMode === 'receiver' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Step 1: Scan Offer */}
            <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">Step 1: Joiner</span>
                  <h3 className="font-bold text-sm text-[var(--ink)]">Scan Initiator Offer QR</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Camera Scanner
                </span>
              </div>

              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Scan the Offer QR displayed on the Initiator's device (or paste their signaling token). This companion will generate an SDP Answer.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={cameraActive ? stopCameraScanner : startCameraScanner}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${cameraActive
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                >
                  {cameraActive ? '⏹ Stop Camera' : '📷 Start Camera Scanner'}
                </button>

                {cameraActive && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-black aspect-video max-h-56">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-dashed border-indigo-400/80 rounded-2xl pointer-events-none m-6" />
                    <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-white bg-black/70 px-2 py-1 rounded">
                      Scanning for Initiator's Offer QR code
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono uppercase text-[var(--ink-text)]/60 block mb-1">
                    Scanned Offer Payload:
                  </label>
                  <textarea
                    rows={3}
                    value={scannedInput}
                    onChange={(e) => setScannedInput(e.target.value)}
                    placeholder="Paste KSHEMOS:OFFER:... payload here"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleProcessOfferAndCreateAnswer}
                  disabled={!scannedInput.trim() || meshStatus === 'generating'}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40"
                >
                  {meshStatus === 'generating' ? 'Processing...' : 'Process Offer & Generate Answer QR'}
                </button>
              </div>
            </div>

            {/* Step 2: Present Answer QR */}
            <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase">Step 2: Response</span>
                  <h3 className="font-bold text-sm text-[var(--ink)]">Present Answer QR to Initiator</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Answer QR
                </span>
              </div>

              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Once generated, hold this screen up so the Initiator unit can scan this Answer QR to finalize peer encryption and initiate genesis log sync.
              </p>

              {answerPayloadString ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
                  <div className="text-[11px] font-bold text-slate-700">
                    Present to Initiator Officer:
                  </div>
                  <div className="flex justify-center">
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(generateQRCodeSVG(answerPayloadString, { size: 240 }))}`}
                      alt="WebRTC SDP Answer QR Code"
                      className="w-56 h-56 rounded-2xl border border-slate-300 shadow-md p-2 bg-white mx-auto"
                    />
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyToken(answerPayloadString)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold hover:bg-white"
                    >
                      {copiedToken ? '✓ Copied Token' : '📋 Copy Answer Token'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-[var(--paper-line)] rounded-2xl text-center text-xs text-[var(--ink-text)]/50">
                  Answer QR will appear here once you process the Offer in Step 1.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1-TAP SIMULATION MODE */}
        {meshMode === 'simulation' && (
          <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase">Offline Test Bench</span>
                <h3 className="font-bold text-sm text-[var(--ink)]">1-Tap Peer Mesh WebRTC DataChannel Simulation</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Conflict Resolution Test Mode
              </span>
            </div>

            <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
              This test simulates two physical officer companion devices (Unit 1: <strong className="font-mono">{formData.officer_badge}</strong> and Unit 2: <strong className="font-mono">{peerOfficerBadge}</strong>)
              exchanging PIN-encrypted on-scene hardware seizure logs over a peer-to-peer WebRTC DataChannel.
              It introduces an earlier on-scene genesis timestamp on MacBook Pro (<strong className="font-mono">SEIZ-2026-DEL-02</strong>) to verify that immutable timestamp conflict resolution correctly selects the earlier ground truth,
              and ingests an unlisted cold storage wallet (<strong className="font-mono">Ledger Nano X</strong>) while appending statutory <strong className="font-mono">PEER_MESH_EXCHANGED</strong> events.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExecuteSimulation}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
              >
                <span>⚡</span>
                Execute 1-Tap Peer Mesh Synchronization
              </button>
            </div>
          </div>
        )}

        {/* AUDIT SUMMARY & RECONCILED RECORDS */}
        {meshResult && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">✓</span>
                <h3 className="font-bold text-sm text-indigo-950">
                  Peer Mesh Sync Complete &amp; Reconciled
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-indigo-700">
                Pairing TS: {new Date(meshResult.pairingTimestampMs).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">Peer Officer</span>
                <span className="font-bold text-slate-900 font-mono text-[11px]">{meshResult.peerOfficerBadge}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">New Seizures Added</span>
                <span className="font-bold text-emerald-600 font-mono text-base">{meshResult.addedNew}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">Conflicts Resolved</span>
                <span className="font-bold text-amber-600 font-mono text-base">{meshResult.conflictsResolved}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">Earliest Timestamp Won</span>
                <span className="font-bold text-indigo-600 font-mono text-base">{meshResult.incomingWon}</span>
              </div>
            </div>

            <div className="text-xs text-indigo-900 font-medium">
              Statutory declaration: Custodial chain updated. A permanent <strong className="font-mono">PEER_MESH_EXCHANGED</strong> event has been recorded in the audit history of each reconciled device.
            </div>
          </div>
        )}

        {/* PEER MESH AUDIT LEDGER FEED */}
        <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📜</span>
              <h3 className="font-bold text-sm text-[var(--ink)]">
                Peer Mesh Custody Audit Ledger ({records.filter(r => r.chain_of_custody_events?.some(e => e.action === 'PEER_MESH_EXCHANGED')).length} Reconciled Devices)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Immutable Timestamp Order Enforced
            </span>
          </div>

          <div className="space-y-2.5">
            {records
              .filter((r) => r.chain_of_custody_events?.some((e) => e.action === 'PEER_MESH_EXCHANGED'))
              .map((rec) => {
                const meshEvent = rec.chain_of_custody_events.find((e) => e.action === 'PEER_MESH_EXCHANGED');
                return (
                  <div
                    key={rec.seizure_id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{rec.seizure_id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {rec.make_model}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          Barcode: {rec.seizure_bag_barcode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 italic">
                        {meshEvent?.details || 'P2P WebRTC DataChannel exchange verified.'}
                      </p>
                    </div>

                    <div className="sm:text-right space-y-0.5 shrink-0 text-[10px] font-mono">
                      <div className="text-indigo-700 font-bold">
                        Peer Badge: {meshEvent?.peer_officer_badge_id || 'PEER-UNIT'}
                      </div>
                      <div className="text-slate-500">
                        Pairing: {meshEvent?.local_pairing_timestamp ? new Date(meshEvent.local_pairing_timestamp).toLocaleString() : 'Recent'}
                      </div>
                    </div>
                  </div>
                );
              })}

            {records.filter((r) => r.chain_of_custody_events?.some((e) => e.action === 'PEER_MESH_EXCHANGED')).length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--ink-text)]/50 border border-dashed rounded-xl">
                No peer mesh sync records reconciled yet. Use Initiate, Join, or 1-Tap Simulation above to exchange electronic evidence with peer officer units.
              </div>
            )}
          </div>
        </div>

        {/* LIVE WEBRTC TELEMETRY LOGS */}
        {meshLogs.length > 0 && (
          <div className="bg-slate-900 text-slate-300 rounded-2xl p-4 font-mono text-[11px] space-y-2 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-400 text-xs">P2P WebRTC Live Telemetry Console</span>
              <button
                type="button"
                onClick={() => setMeshLogs([])}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Clear Logs
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {meshLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span
                    className={
                      log.type === 'error'
                        ? 'text-red-400'
                        : log.type === 'warn'
                          ? 'text-amber-400'
                          : log.type === 'success'
                            ? 'text-emerald-400'
                            : 'text-indigo-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  {/* GENESIS RECEIPT MODAL */ }
  {
    selectedReceipt && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-[var(--paper-line)] max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  Electronic Evidence Genesis Receipt
                </h3>
                <span className="font-mono text-[10px] text-emerald-700 font-bold">
                  BNSS Section 105 / CrPC Section 102 Compliant
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="text-gray-400 hover:text-gray-600 font-bold text-lg"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 font-mono text-[11px] space-y-1">
              <div className="font-bold text-xs">{selectedReceipt.receipt_number}</div>
              <div>Issued: {new Date(selectedReceipt.timestamp_iso).toLocaleString()}</div>
              <div>Device: {selectedReceipt.device_summary}</div>
              <div>Bag Barcode: {selectedReceipt.bag_barcode}</div>
              <div>Faraday Isolation: {selectedReceipt.faraday_sealed ? 'ACTIVE' : 'NONE'}</div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-[10px] break-all space-y-1">
              <span className="font-bold text-gray-500 block uppercase">SHA-256 Genesis Fingerprint:</span>
              <span className="text-gray-900 font-bold">{selectedReceipt.genesis_hash}</span>
            </div>

            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-[11px] text-amber-950 leading-relaxed italic">
              "{selectedReceipt.statutory_declaration}"
            </div>

            <div className="flex items-center justify-between font-mono text-[10px] bg-gray-100 p-2.5 rounded-lg text-gray-700">
              <span>Officer Digital Signature:</span>
              <span className="font-bold">{selectedReceipt.officer_esign_placeholder}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(selectedReceipt, null, 2));
                alert('Genesis receipt copied to clipboard!');
              }}
              className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
            >
              📋 Copy JSON
            </button>
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="px-4 py-1.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-black cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
      </div >
    </div >
  );
}

