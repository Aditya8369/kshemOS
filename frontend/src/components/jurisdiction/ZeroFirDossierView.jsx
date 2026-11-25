import { useState } from 'react';
import {
  resolveSpatialJurisdictionApi,
  compileZeroFirDossierApi,
  dispatchInterStateRequisitionApi,
  SAMPLE_ZERO_FIR_PAYLOAD,
} from '../../jurisdictionStore.js';

export default function ZeroFirDossierView() {
  const [formData, setFormData] = useState(SAMPLE_ZERO_FIR_PAYLOAD);
  const [spatialResult, setSpatialResult] = useState(null);
  const [spatialLoading, setSpatialLoading] = useState(false);

  const [dossierResult, setDossierResult] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  const [requisitionResult, setRequisitionResult] = useState(null);
  const [requisitionLoading, setRequisitionLoading] = useState(false);

  const [copiedKey, setCopiedKey] = useState(null);
  const [error, setError] = useState(null);

  function handleCopy(text, key) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  async function handleResolveSpatial() {
    setSpatialLoading(true);
    setError(null);
    try {
      const res = await resolveSpatialJurisdictionApi(formData);
      setSpatialResult(res);
    } catch (err) {
      setError(err.message || 'Spatial jurisdiction resolution failed');
    } finally {
      setSpatialLoading(false);
    }
  }

  async function handleCompileDossier(e) {
    if (e) e.preventDefault();
    setDossierLoading(true);
    setError(null);
    try {
      const res = await compileZeroFirDossierApi(formData);
      setDossierResult(res);
      // Automatically resolve spatial if not already resolved
      if (!spatialResult) {
        const sRes = await resolveSpatialJurisdictionApi(formData);
        setSpatialResult(sRes);
      }
    } catch (err) {
      setError(err.message || 'Zero-FIR dossier compilation failed');
    } finally {
      setDossierLoading(false);
    }
  }

  async function handleDispatchRequisition() {
    if (!dossierResult) return;
    setRequisitionLoading(true);
    setError(null);
    try {
      const targetState =
        spatialResult?.target_transfer_jurisdiction?.state ||
        formData.target_state_override ||
        'Gujarat';

      const payload = {
        zero_fir_number: dossierResult.zero_fir_number,
        incident_id: formData.incident_id,
        originating_station_code: formData.originating_station_code,
        target_state: targetState,
        investigating_officer_name: formData.reporting_officer_name,
        investigating_officer_badge: formData.reporting_officer_badge,
        investigating_officer_rank: formData.reporting_officer_rank,
        beneficiary_accounts: formData.financial_transactions.map((t) => t.beneficiary_account),
        beneficiary_ifsc: formData.financial_transactions[0]?.beneficiary_ifsc || 'ICIC0009123',
        suspect_numbers: formData.suspect_phone_numbers,
        urgency_level: 'IMMEDIATE_ASSET_FLIGHT_RISK',
      };

      const res = await dispatchInterStateRequisitionApi(payload);
      setRequisitionResult(res);
    } catch (err) {
      setError(err.message || 'Inter-state requisition dispatch failed');
    } finally {
      setRequisitionLoading(false);
    }
  }

  function handleOpenPdf(pdfBase64, fallbackUrl) {
    if (pdfBase64) {
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else if (fallbackUrl) {
      window.open(fallbackUrl, '_blank');
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">⚖️</span>
              <h2 className="font-display text-xl font-bold text-white tracking-wide">
                Automated Inter-State Cybercrime Zero-FIR (Section 173 BNSS)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                MANDATORY REGISTRATION
              </span>
            </div>
            <p className="text-xs text-[var(--mist)] max-w-3xl leading-relaxed">
              Cyber extortion and digital arrest syndicates cross state boundaries between victim residence, mule accounts,
              and call origins. Under <strong>Section 173 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023</strong>,
              police stations must register Zero-FIRs regardless of territorial locus delicti and transfer dossiers to the
              jurisdictional State Cyber Police Station.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormData(SAMPLE_ZERO_FIR_PAYLOAD);
              setSpatialResult(null);
              setDossierResult(null);
              setRequisitionResult(null);
            }}
            className="px-3 py-2 text-xs font-mono rounded-xl bg-[var(--ink)] text-[var(--saffron)] border border-[var(--navy-line)] hover:border-[var(--saffron)] transition cursor-pointer shrink-0"
          >
            ⚡ Reload Sample Case (Delhi &rarr; Gujarat &rarr; Haryana)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Form (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card 1: Complainant & Incident Details */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-white flex items-center justify-between">
              <span>1. Complainant & Crime Substance</span>
              <span className="text-[10px] font-mono text-[var(--mist)]">
                {formData.originating_station_code}
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Complainant Name:</label>
                <input
                  type="text"
                  value={formData.victim_name}
                  onChange={(e) => setFormData({ ...formData, victim_name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white font-mono text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Victim State / Circle:</label>
                <input
                  type="text"
                  value={formData.victim_location.state}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      victim_location: { ...formData.victim_location, state: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white font-mono text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Substance of Information (Narrative):</label>
              <textarea
                rows="3"
                value={formData.complaint_narrative}
                onChange={(e) => setFormData({ ...formData, complaint_narrative: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white text-xs outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Card 2: Inter-State Entities (Bank IFSC & Cell Tower) */}
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">2. Multi-State Financial & Telecom Attributes</h3>
              <button
                type="button"
                onClick={handleResolveSpatial}
                disabled={spatialLoading}
                className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-[var(--ink)] text-cyan-300 border border-cyan-800 hover:bg-cyan-950 transition cursor-pointer"
              >
                {spatialLoading ? 'Resolving...' : '🧭 Resolve Spatial Jurisdiction'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Beneficiary Mule IFSC:</label>
                <input
                  type="text"
                  value={formData.financial_transactions[0]?.beneficiary_ifsc || ''}
                  onChange={(e) => {
                    const txs = [...formData.financial_transactions];
                    if (txs[0]) txs[0].beneficiary_ifsc = e.target.value;
                    setFormData({ ...formData, financial_transactions: txs });
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white font-mono text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Disputed Amount (INR):</label>
                <input
                  type="number"
                  value={formData.financial_transactions[0]?.amount_inr || 0}
                  onChange={(e) => {
                    const txs = [...formData.financial_transactions];
                    if (txs[0]) txs[0].amount_inr = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, financial_transactions: txs });
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white font-mono text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Suspect Cell Tower Circle:</label>
                <input
                  type="text"
                  value={formData.suspect_cell_tower?.telecom_circle || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      suspect_cell_tower: {
                        ...formData.suspect_cell_tower,
                        telecom_circle: e.target.value,
                        state: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white font-mono text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[var(--mist)] mb-1">Suspect Origin District:</label>
                <input
                  type="text"
                  value={formData.suspect_cell_tower?.district || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      suspect_cell_tower: {
                        ...formData.suspect_cell_tower,
                        district: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white font-mono text-xs outline-none"
                />
              </div>
            </div>

            {/* Evidence items indicator */}
            <div className="bg-[var(--ink)] p-2.5 rounded-xl border border-[var(--navy-line)] text-[11px] flex items-center justify-between">
              <span className="text-[var(--mist)]">
                Section 63 BSA Digital Evidence Hashes: <strong>{formData.digital_evidence_hashes.length}</strong> items attached
              </span>
              <span className="text-emerald-400 font-mono">SHA-256 Validated</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompileDossier}
            disabled={dossierLoading}
            className="w-full py-3 rounded-xl bg-[var(--saffron)] text-white font-bold text-xs hover:opacity-90 transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {dossierLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating Section 173 BNSS Vector PDF...</span>
              </>
            ) : (
              <>
                <span>📜</span>
                <span>Compile Official Section 173 BNSS Zero-FIR Dossier (PDF)</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Spatial Resolution & Output Actions (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Spatial Jurisdiction Resolution Card */}
          {spatialResult ? (
            <div className="bg-[var(--navy)] border-2 border-cyan-500/50 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
                <span className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                  <span>🧭</span>
                  <span>Spatial Jurisdiction Boundaries Resolved</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                  {spatialResult.jurisdictional_conflict_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-[var(--ink)] p-2.5 rounded-xl border border-[var(--navy-line)]">
                  <span className="text-gray-400 block text-[10px]">1. Reporting Station (Victim Origin):</span>
                  <span className="font-bold text-white block">
                    {spatialResult.victim_reporting_jurisdiction?.station_name}
                  </span>
                  <span className="text-cyan-400 text-[10px]">
                    State: {spatialResult.victim_reporting_jurisdiction?.state}
                  </span>
                </div>

                <div className="bg-[var(--ink)] p-2.5 rounded-xl border border-[var(--navy-line)]">
                  <span className="text-gray-400 block text-[10px]">2. Beneficiary Bank Location (Mule Account):</span>
                  <span className="font-bold text-amber-300 block">
                    {spatialResult.beneficiary_bank_jurisdiction?.station_name}
                  </span>
                  <span className="text-amber-400 text-[10px]">
                    State: {spatialResult.beneficiary_bank_jurisdiction?.state}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-800/40 p-2.5 rounded-xl text-[11px] space-y-1">
                <span className="font-bold text-emerald-300 block">
                  Designated Transfer Recipient (Section 173 BNSS):
                </span>
                <div className="text-white font-mono text-[10px]">
                  {spatialResult.target_transfer_jurisdiction?.station_name}
                </div>
                <div className="text-[10px] text-gray-400">
                  Nodal Officer: {spatialResult.target_transfer_jurisdiction?.nodal_officer} ({spatialResult.target_transfer_jurisdiction?.email})
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 text-center space-y-2 text-xs text-[var(--mist)]">
              <span className="text-2xl block">🧭</span>
              <span className="font-bold text-white block">Spatial Jurisdiction Engine Ready</span>
              <span>Click "Resolve Spatial Jurisdiction" or compile the Zero-FIR to evaluate cross-border boundaries.</span>
            </div>
          )}

          {/* Compiled Zero-FIR Dossier Card */}
          {dossierResult && (
            <div className="bg-[var(--navy)] border-2 border-emerald-500 rounded-2xl p-5 space-y-3 text-xs animate-fade-in">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 block font-bold">
                    OFFICIAL ZERO-FIR REGISTERED
                  </span>
                  <h4 className="font-bold text-sm text-white font-mono">
                    {dossierResult.zero_fir_number}
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SEC 173 BNSS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-gray-400 block text-[10px]">Disputed Amount:</span>
                  <span className="font-bold text-white">
                    ₹ {dossierResult.total_disputed_amount_inr?.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Registration Time:</span>
                  <span className="text-gray-300">{dossierResult.registration_timestamp_ist}</span>
                </div>
              </div>

              <div className="bg-[var(--ink)] p-2 rounded-xl font-mono text-[9px] break-all border border-[var(--navy-line)]">
                <span className="text-gray-400 block font-bold uppercase">SHA-256 Dossier Seal:</span>
                <span className="text-emerald-300">{dossierResult.sha256_dossier_seal}</span>
              </div>

              {/* PDF Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(dossierResult.pdf_base64, dossierResult.pdf_download_url)}
                  className="flex-1 py-2 rounded-xl bg-white text-[var(--navy)] font-bold text-xs hover:bg-gray-100 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>📄</span>
                  <span>View / Print Zero-FIR PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(dossierResult.zero_fir_number, 'fir-no')}
                  className="px-3 py-2 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-xs text-white hover:border-[var(--saffron)] transition cursor-pointer"
                >
                  {copiedKey === 'fir-no' ? '✓ Copied' : '📋 Copy No'}
                </button>
              </div>

              {/* Next Step: Inter-State Mutual Aid Requisition */}
              <div className="pt-2 border-t border-[var(--navy-line)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-white">
                    Inter-State Mutual Aid Requisition (Section 78/79 IT Act)
                  </span>
                  <span className="text-[10px] font-mono text-amber-300">Section 106 BNSS Freeze</span>
                </div>

                {!requisitionResult ? (
                  <button
                    type="button"
                    onClick={handleDispatchRequisition}
                    disabled={requisitionLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold text-xs hover:opacity-95 transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {requisitionLoading ? (
                      <span>Dispatching Requisition to Recipient State...</span>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Dispatch Inter-State Mutual Aid Requisition Form</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="bg-[var(--ink)] border border-cyan-500/40 rounded-xl p-3 space-y-2 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300">
                        {requisitionResult.requisition_id}
                      </span>
                      <span className="text-emerald-400 font-bold">DISPATCHED ✓</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Dispatched to: {requisitionResult.target_nodal_station?.station_name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenPdf(requisitionResult.pdf_base64, requisitionResult.pdf_download_url)}
                      className="w-full py-1.5 rounded-lg bg-cyan-900/60 text-cyan-200 text-xs font-bold hover:bg-cyan-900 transition flex items-center justify-center gap-1"
                    >
                      <span>📑 View Inter-State Requisition Form (PDF)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
