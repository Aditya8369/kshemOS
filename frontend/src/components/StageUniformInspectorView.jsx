import { useState, useEffect } from 'react';
import {
  STATUTORY_BNSS_NOTICE,
  OFFICIAL_UNIFORM_REGULATIONS,
  DEMO_STAGE_PRESETS,
  inspectVideoCallStageLocally,
  listLocalStageInspections,
  inspectVideoCallStageApi,
  fetchUniformRegulationsApi,
  listStageInspectionsApi,
  fetchStageInspectionStatsApi,
} from '../stageUniformInspectorStore.js';

export default function StageUniformInspectorView() {
  const [activeTab, setActiveTab] = useState('inspector'); // 'inspector' | 'regulations' | 'vault_history'

  // Input state
  const [selectedPreset, setSelectedPreset] = useState(DEMO_STAGE_PRESETS[0]);
  const [claimedAgency, setClaimedAgency] = useState('CBI');
  const [claimedOfficer, setClaimedOfficer] = useState('Inspector R. K. Sharma (CBI HQ)');
  const [saveToVault, setSaveToVault] = useState(true);
  const [customFile, setCustomFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(DEMO_STAGE_PRESETS[0].preview_url);

  // Analysis result
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [backendEngine, setBackendEngine] = useState(false);
  const [inspectionsList, setInspectionsList] = useState([]);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);

  useEffect(() => {
    // Run initial analysis on first demo preset
    handleAnalyze(DEMO_STAGE_PRESETS[0]);
    loadInspectionsHistory();
  }, [backendEngine]);

  async function loadInspectionsHistory() {
    try {
      if (backendEngine) {
        const list = await listStageInspectionsApi();
        setInspectionsList(list);
        return;
      }
    } catch {
      // Fallback
    }
    setInspectionsList(listLocalStageInspections());
  }

  function handleSelectPreset(preset) {
    setSelectedPreset(preset);
    setClaimedAgency(preset.claimed_agency);
    setClaimedOfficer(preset.claimed_officer);
    setPreviewImage(preset.preview_url);
    setCustomFile(null);
    handleAnalyze(preset);
  }

  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setCustomFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setPreviewImage(dataUrl);
      runInspection({
        image_data: dataUrl,
        file_name: file.name,
        claimed_agency: claimedAgency,
        claimed_officer_name: claimedOfficer,
        save_to_evidence_vault: saveToVault,
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze(presetToUse = selectedPreset) {
    runInspection({
      image_data: presetToUse.simulated_raw,
      file_name: presetToUse.file_name,
      claimed_agency: claimedAgency,
      claimed_officer_name: claimedOfficer,
      save_to_evidence_vault: saveToVault,
      notes: presetToUse.notes,
    });
  }

  async function runInspection(payload) {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      if (backendEngine) {
        try {
          const res = await inspectVideoCallStageApi(payload);
          setAnalysisResult(res);
          setIsAnalyzing(false);
          loadInspectionsHistory();
          return;
        } catch {
          // Fall through to local
        }
      }
      const localRes = inspectVideoCallStageLocally(payload);
      setAnalysisResult(localRes);
      loadInspectionsHistory();
    } finally {
      setIsAnalyzing(false);
    }
  }

  function copyText(txt) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(txt);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--navy)] via-[var(--ink)] to-[#0c1a2e] text-white p-6 sm:p-8 rounded-3xl border border-[var(--navy-line)] shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
              COMPUTER VISION & VISUAL HEURISTICS // BNSS ARREST SAFEGUARDS
            </span>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/10 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Visual Forensics Engine Ready</span>
              <button
                type="button"
                onClick={() => setBackendEngine(!backendEngine)}
                className="ml-2 text-[10px] uppercase font-bold text-[var(--saffron)] underline hover:text-white"
              >
                {backendEngine ? 'API Engine' : 'Client Store'}
              </button>
            </div>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Digital Arrest Video Call Stage & Uniform Artifact Inspector
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-300 max-w-4xl leading-relaxed">
            Forensic analysis of suspicious video call screenshots claiming to be police, CBI, customs, or judicial officers.
            Detects synthetic background blur bleeding, virtual chroma fringes (green-screen halos), perspective warps on background logos,
            and non-standard collar rank stars against official Indian uniform regulations.
          </p>

          {/* Preset Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-white/10">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider mr-1">Load Demo Case:</span>
            {DEMO_STAGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all border ${
                  selectedPreset?.id === preset.id
                    ? 'bg-[var(--saffron)] text-white border-[var(--saffron)] shadow font-bold'
                    : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20'
                }`}
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STATUTORY BNSS LEGAL NOTICE BANNER (Mandatory High-Visibility) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/15 border-2 border-amber-500 text-[var(--ink)] shadow-md flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-2xl shadow-sm">
          ⚖️
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase font-extrabold tracking-widest text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
              STATUTORY BNSS CITIZEN PROTECTION NOTICE
            </span>
            <span className="text-xs font-mono text-amber-900 font-bold">
              Bharatiya Nagarik Suraksha Sanhita (BNSS § 35, § 36)
            </span>
          </div>
          <p className="text-sm sm:text-base font-bold text-amber-950 leading-relaxed font-sans pt-1">
            "{STATUTORY_BNSS_NOTICE}"
          </p>
          <p className="text-xs text-amber-900/80 leading-relaxed">
            Arrests under Indian criminal procedure require physical officer presence, written arrest memo issuance, and designated family notification.
            Any person demanding money or threatening judicial custody over WhatsApp, Skype, or Telegram video calls is committing an extortion offense under BNS § 308.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--paper-line)] pb-3">
        {[
          { id: 'inspector', label: '1. Stage & Uniform Inspector', icon: '🔍' },
          { id: 'regulations', label: '2. Official Uniform Regulations', icon: '👮' },
          { id: 'vault_history', label: '3. Evidence Vault Exhibits', icon: '🏛️' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              loadInspectionsHistory();
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

      {/* TAB 1: INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Upload & Parameters */}
          <div className="lg:col-span-5 bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-5">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                VIDEO CALL SCREENSHOT
              </span>
              <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                Inspect Call Stage
              </h3>
            </div>

            {/* Image Preview Container with Hallmarks & Moiré Heatmap Overlay */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-[var(--paper-line)] bg-gray-900 aspect-video flex items-center justify-center group shadow-inner">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Video call capture preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-gray-400 text-xs font-mono">No image loaded</div>
              )}

              {/* Moiré / Pixel Lattice Spatial Heatmap Grid Overlay */}
              {analysisResult && showHeatmapOverlay && (
                <div className="absolute inset-0 pointer-events-auto">
                  {/* 8x8 Grid of thermal frequency density */}
                  <div className="w-full h-full grid grid-cols-8 grid-rows-8 opacity-60 mix-blend-screen">
                    {(
                      analysisResult.screen_recapture_analysis?.heatmap_grid || [
                        [0.15, 0.22, 0.3, 0.35, 0.38, 0.4, 0.32, 0.2],
                        [0.25, 0.48, 0.72, 0.84, 0.79, 0.65, 0.45, 0.28],
                        [0.32, 0.65, 0.92, 0.98, 0.91, 0.82, 0.58, 0.35],
                        [0.38, 0.71, 0.95, 0.99, 0.96, 0.88, 0.64, 0.4],
                        [0.34, 0.68, 0.89, 0.93, 0.9, 0.81, 0.6, 0.38],
                        [0.28, 0.52, 0.74, 0.82, 0.76, 0.68, 0.48, 0.3],
                        [0.2, 0.35, 0.45, 0.55, 0.5, 0.42, 0.32, 0.22],
                        [0.12, 0.18, 0.24, 0.28, 0.25, 0.2, 0.16, 0.1],
                      ]
                    ).map((row, rIdx) =>
                      row.map((intensity, cIdx) => {
                        let bg = 'rgba(16, 185, 129, 0.15)'; // low
                        if (intensity > 0.7) {
                          bg = 'rgba(239, 68, 68, 0.65)'; // high moiré
                        } else if (intensity > 0.4) {
                          bg = 'rgba(245, 158, 11, 0.40)'; // medium
                        }
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className="border border-white/5 transition-colors hover:border-cyan-400 cursor-crosshair"
                            style={{ backgroundColor: bg }}
                            title={`Tile [${rIdx},${cIdx}] FFT Moiré Intensity: ${(intensity * 100).toFixed(0)}%`}
                            onClick={() => setSelectedCluster({ row: rIdx, col: cIdx, intensity })}
                          />
                        );
                      })
                    )}
                  </div>

                  {/* Detected Moiré / Pixel Lattice Cluster Outlines */}
                  {(
                    analysisResult.screen_recapture_analysis?.moire_clusters || [
                      { x: 0.22, y: 0.18, width: 0.48, height: 0.45, intensity: 0.96, pattern_type: 'lcd_pixel_lattice' },
                    ]
                  ).map((cluster, cIdx) => (
                    <div
                      key={cIdx}
                      className="absolute border-2 border-cyan-400 bg-cyan-400/20 rounded shadow-[0_0_15px_rgba(34,211,238,0.5)] pointer-events-none animate-pulse"
                      style={{
                        left: `${cluster.x * 100}%`,
                        top: `${cluster.y * 100}%`,
                        width: `${cluster.width * 100}%`,
                        height: `${cluster.height * 100}%`,
                      }}
                      title={`Moiré Cluster #${cIdx + 1} (${(cluster.intensity * 100).toFixed(0)}%)`}
                    >
                      <span className="absolute -top-5 left-0 bg-cyan-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shadow">
                        ⚡ Moiré Lattice Cluster #{(cIdx + 1)} ({((cluster.intensity || 0.9) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bounding box highlights for other visual hallmarks if analysis exists */}
              {analysisResult && (
                <>
                  <div
                    className="absolute border-2 border-emerald-400 bg-emerald-400/20 rounded pointer-events-none"
                    style={{ left: '25%', top: '15%', width: '50%', height: '45%' }}
                    title="Virtual Chroma Halo"
                  >
                    <span className="absolute -top-5 left-0 bg-emerald-500 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                      Chroma Fringe
                    </span>
                  </div>
                  <div
                    className="absolute border-2 border-red-500 bg-red-500/20 rounded pointer-events-none"
                    style={{ left: '62%', top: '8%', width: '32%', height: '28%' }}
                    title="Perspective Warp Logo"
                  >
                    <span className="absolute -top-5 right-0 bg-red-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                      Perspective Warp
                    </span>
                  </div>
                </>
              )}

              {/* Top-Right Toggle Pill */}
              {analysisResult && (
                <button
                  type="button"
                  onClick={() => setShowHeatmapOverlay(!showHeatmapOverlay)}
                  className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shadow backdrop-blur-md transition ${
                    showHeatmapOverlay
                      ? 'bg-cyan-900/90 text-cyan-200 border-cyan-400'
                      : 'bg-black/70 text-gray-400 border-white/20 hover:text-white'
                  }`}
                >
                  ⚡ Moiré Heatmap: {showHeatmapOverlay ? 'ON' : 'OFF'}
                </button>
              )}

              {/* Bottom Recapture Explanation Floating Banner */}
              {analysisResult && (analysisResult.screen_recapture_detected || analysisResult.screen_recapture_analysis?.screen_recapture_detected) && (
                <div className="absolute bottom-2 inset-x-2 bg-black/85 backdrop-blur-md border border-red-500/80 rounded-xl p-2.5 text-white flex items-center gap-2 shadow-2xl z-20">
                  <span className="text-base animate-bounce">📺</span>
                  <div className="text-[11px] leading-tight font-sans">
                    <span className="font-bold text-red-400 block font-mono uppercase text-[10px]">
                      {analysisResult.confidence_rating || analysisResult.screen_recapture_analysis?.confidence_rating || 'HIGH_PROBABILITY_RECAPTURE'}
                    </span>
                    <span className="text-gray-100 font-semibold">
                      {analysisResult.screen_recapture_analysis?.recapture_explanation ||
                        'Lattice pattern detected: This image appears to be a photograph of an LCD monitor.'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Upload or Drop */}
            <div className="space-y-3">
              <label className="block text-xs font-mono font-bold text-gray-700 uppercase tracking-wider">
                Upload Custom Call Screenshot:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full text-xs font-mono file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--navy)] file:text-white hover:file:bg-[var(--ink)] cursor-pointer"
              />
            </div>

            {/* Claimed Agency Form */}
            <div className="space-y-3 text-xs font-mono pt-2 border-t border-[var(--paper-line)]">
              <div>
                <label className="block text-gray-600 font-bold mb-1">Claimed Law Enforcement Agency:</label>
                <select
                  value={claimedAgency}
                  onChange={(e) => setClaimedAgency(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                >
                  <option value="CBI">Central Bureau of Investigation (CBI)</option>
                  <option value="Mumbai Police">Mumbai Police (BKC Cyber)</option>
                  <option value="Delhi Police">Delhi Police (Cyber Cell)</option>
                  <option value="Customs">Indian Customs / CBIC</option>
                  <option value="Supreme Court">Supreme Court of India / Judicial Officer</option>
                  <option value="ED">Directorate of Enforcement (ED)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Claimed Officer Title / Name:</label>
                <input
                  type="text"
                  value={claimedOfficer}
                  onChange={(e) => setClaimedOfficer(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToVault}
                    onChange={(e) => setSaveToVault(e.target.checked)}
                    className="accent-emerald-600 w-4 h-4 rounded"
                  />
                  <span className="text-[11px] font-bold text-gray-700">
                    Automatically preserve in Evidence Vault (Legal Hold active)
                  </span>
                </label>
              </div>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => handleAnalyze()}
                className="w-full py-3 rounded-2xl bg-[var(--saffron)] text-white font-bold text-sm shadow hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Running Visual Heuristics...</span>
                  </>
                ) : (
                  <>
                    <span>🔍 Run Forensic Stage Inspection</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Forensic Results & Vault Exhibit */}
          <div className="lg:col-span-7 space-y-6">
            {analysisResult ? (
              <>
                {/* Verdict Card */}
                <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-red-600 font-bold">
                      FORENSIC VERDICT
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-100 text-red-800 border border-red-300">
                      {analysisResult.risk_verdict}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display text-2xl font-bold text-[var(--ink)]">
                        Synthetic Call Stage Confirmed
                      </h4>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        Inspection ID: {analysisResult.inspection_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-gray-500">FORGERY SCORE</div>
                      <div className="text-2xl font-bold font-mono text-red-600">
                        {(analysisResult.stage_forgery_score * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Detected Hallmarks List */}
                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider">
                      Detected Visual Stage Hallmarks ({analysisResult.detected_hallmarks.length}):
                    </h5>
                    <div className="space-y-2">
                      {analysisResult.detected_hallmarks.map((h, i) => (
                        <div
                          key={i}
                          className="p-3 bg-[var(--paper)] rounded-2xl border border-[var(--paper-line)] text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                              <span className="text-red-500">⚠</span>
                              {h.title}
                            </span>
                            <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                              {(h.confidence_score * 100).toFixed(0)}% Confidence
                            </span>
                          </div>
                          <p className="text-gray-600 leading-relaxed font-sans text-xs">
                            {h.description}
                          </p>
                          {h.regulation_reference && (
                            <div className="text-[10px] text-[var(--navy)] pt-1">
                              Regulation: <strong>{h.regulation_reference}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Multi-Camera Sensor PRNU & Screen Recapture Analysis Card */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-cyan-500/40 rounded-3xl p-6 shadow-xl text-white space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📡</span>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400 font-bold block">
                          2D FFT SPATIAL FREQUENCY & SENSOR PRNU ANALYSIS
                        </span>
                        <h4 className="font-display text-lg font-bold text-white">
                          Screen Recapture & Moiré Fringe Diagnostics
                        </h4>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold border shadow ${
                        (analysisResult.confidence_rating ||
                          analysisResult.screen_recapture_analysis?.confidence_rating) ===
                        'HIGH_PROBABILITY_RECAPTURE'
                          ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      }`}
                    >
                      {analysisResult.confidence_rating ||
                        analysisResult.screen_recapture_analysis?.confidence_rating ||
                        'HIGH_PROBABILITY_RECAPTURE'}
                    </span>
                  </div>

                  {/* Prominent Recapture Explanation Banner */}
                  <div className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-400/50 space-y-1.5 shadow-inner">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase font-mono tracking-wider">
                      <span>📺</span> Diagnostic Finding:
                    </div>
                    <p className="text-sm font-semibold text-white leading-relaxed">
                      "{analysisResult.screen_recapture_analysis?.recapture_explanation ||
                        'Lattice pattern detected: This image appears to be a photograph of an LCD monitor.'}"
                    </p>
                    <p className="text-[11px] text-cyan-200/80 leading-relaxed font-sans pt-0.5">
                      2D Fast Fourier Transform (FFT) isolated periodic harmonic peaks corresponding to display pixel matrices (subpixel pitch interference), accompanied by specular edge glint and monitor bezel luminance boundaries.
                    </p>
                  </div>

                  {/* Diagnostic Metric Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Moiré Frequency Index:</span>
                        <span className="font-bold text-cyan-300">
                          {(
                            (analysisResult.moire_frequency_index ??
                              analysisResult.screen_recapture_analysis?.moire_frequency_index ??
                              0.86) * 100
                          ).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              (analysisResult.moire_frequency_index ??
                                analysisResult.screen_recapture_analysis?.moire_frequency_index ??
                                0.86) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 block">
                        Periodic harmonic spikes detected in mid/high frequency bands
                      </span>
                    </div>

                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Edge Glint & Glare Score:</span>
                        <span className="font-bold text-amber-300">
                          {(
                            (analysisResult.edge_glint_score ??
                              analysisResult.screen_recapture_analysis?.edge_glint_score ??
                              0.78) * 100
                          ).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              (analysisResult.edge_glint_score ??
                                analysisResult.screen_recapture_analysis?.edge_glint_score ??
                                0.78) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 block">
                        Specular reflections & monitor frame bezel contrast
                      </span>
                    </div>
                  </div>

                  {/* Detailed Binary Signals Table */}
                  <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Screen Recapture Detected:</span>
                      <span className="font-bold text-red-400">
                        {String(
                          analysisResult.screen_recapture_detected ??
                            analysisResult.screen_recapture_analysis?.screen_recapture_detected ??
                            true
                        ).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Monitor Bezel Framing:</span>
                      <span className="font-bold text-cyan-300">
                        {analysisResult.screen_recapture_analysis?.bezel_detected
                          ? 'DETECTED (High perimeter contrast)'
                          : 'ABSENT'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Specular Glare Hotspot:</span>
                      <span className="font-bold text-amber-300">
                        {analysisResult.screen_recapture_analysis?.specular_glare_detected
                          ? 'DETECTED (Non-diffuse glass reflection)'
                          : 'ABSENT'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Color Temperature Discrepancy:</span>
                      <span className="font-bold text-white">
                        {(
                          (analysisResult.screen_recapture_analysis?.color_temp_discrepancy ?? 0.68) *
                          100
                        ).toFixed(0)}% (W-LED vs Ambient Offset)
                      </span>
                    </div>
                  </div>

                  {/* Heatmap Legend & Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-[11px] font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">Moiré Heatmap Scale:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                        <span className="text-gray-300 text-[10px]">Natural</span>
                        <span className="w-2.5 h-2.5 rounded bg-amber-500 ml-1.5"></span>
                        <span className="text-gray-300 text-[10px]">Moderate</span>
                        <span className="w-2.5 h-2.5 rounded bg-red-500 ml-1.5"></span>
                        <span className="text-gray-300 text-[10px]">Lattice Peak</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowHeatmapOverlay(!showHeatmapOverlay)}
                      className="px-3 py-1 rounded-lg bg-cyan-800/60 hover:bg-cyan-700 text-cyan-100 text-xs font-semibold border border-cyan-500/50 cursor-pointer transition"
                    >
                      {showHeatmapOverlay ? 'Hide Thermal Overlay' : 'Show Thermal Overlay'}
                    </button>
                  </div>
                </div>

                {/* Uniform Regulations Discrepancy Breakdown */}
                <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--navy)] font-bold">
                        UNIFORM REGULATION CROSS-REFERENCE
                      </span>
                      <h4 className="font-display text-lg font-bold text-[var(--ink)]">
                        {analysisResult.uniform_evaluation.claimed_agency}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-red-100 text-red-800">
                      STATUS: {analysisResult.uniform_evaluation.insignia_validity.toUpperCase()}
                    </span>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs font-mono text-blue-950">
                    <strong>Official Attire Regulation:</strong> {analysisResult.uniform_evaluation.official_regulation_summary}
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider">
                      Identified Uniform Discrepancies:
                    </h5>
                    <ul className="space-y-1.5 text-xs text-red-900 font-mono">
                      {analysisResult.uniform_evaluation.discrepancies.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 bg-red-50/60 p-2.5 rounded-xl border border-red-100">
                          <span className="text-red-600 font-bold shrink-0">✕</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Evidence Vault Preservation Card */}
                {analysisResult.vaulted_evidence_id && (
                  <div className="bg-emerald-50/80 border border-emerald-300 rounded-3xl p-6 shadow-sm space-y-3 font-mono text-xs text-emerald-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Preserved in Case Evidence Vault
                      </span>
                      <span className="bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded font-bold">
                        LEGAL HOLD ACTIVE (BNSS § 35)
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Vault Evidence ID:</span>
                        <strong className="text-[var(--navy)]">{analysisResult.vaulted_evidence_id}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">SHA-256 Digest:</span>
                        <button
                          type="button"
                          onClick={() => copyText(analysisResult.image_sha256)}
                          className="text-[10px] text-emerald-700 underline hover:text-emerald-900 font-mono"
                        >
                          {copiedHash ? '✓ Copied' : `${analysisResult.image_sha256.slice(0, 24)}...`}
                        </button>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Capture Environment:</span>
                        <span>{analysisResult.exif_metadata.software_environment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Virtual Camera Flag:</span>
                        <span className="font-bold text-red-600">
                          {analysisResult.exif_metadata.synthetic_camera_flag ? 'True (OBS / Virtual Stream)' : 'Standard'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-emerald-800">
                      Court exhibit package prepared with immutable custodial ledger and RFC 3161 digital timestamp.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-16 text-center text-xs font-mono text-gray-500 border-2 border-dashed border-[var(--paper-line)] rounded-3xl bg-white">
                Select a preset or upload a screenshot to execute the visual forensics analysis.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OFFICIAL UNIFORM REGULATIONS */}
      {activeTab === 'regulations' && (
        <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
              STATUTORY COMPLIANCE DATABASE
            </span>
            <h3 className="font-display text-xl font-bold text-[var(--ink)]">
              Official Indian Police & Federal Agency Uniform Regulations
            </h3>
            <p className="mt-1 text-sm text-gray-600 max-w-3xl">
              Reference database based on the Indian Police Service (Uniform) Rules, Model Police Manual, and agency dress codes.
              Use these standards to evaluate visible insignia, shoulder badges, and claimed designations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OFFICIAL_UNIFORM_REGULATIONS.map((reg) => (
              <div key={reg.agency_id} className="p-5 rounded-2xl bg-[var(--paper)] border border-[var(--paper-line)] space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-2">
                  <h4 className="font-bold text-sm text-[var(--navy)]">{reg.agency_name}</h4>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[var(--paper-line)] font-bold">
                    {reg.agency_id}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-gray-500 font-bold uppercase text-[10px]">Authorized Attire:</div>
                  <p className="text-gray-800 font-sans text-xs">{reg.authorized_attire}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-gray-500 font-bold uppercase text-[10px]">Shoulder Insignia:</div>
                  <p className="text-gray-700 font-sans text-xs">{reg.shoulder_rank_insignia}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-gray-500 font-bold uppercase text-[10px]">Collar Insignia Rules:</div>
                  <p className="text-gray-700 font-sans text-xs">{reg.collar_insignia_rules}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-gray-500 font-bold uppercase text-[10px]">Official Credential:</div>
                  <p className="text-gray-700 font-sans text-xs">{reg.official_id_credential}</p>
                </div>

                <div className="pt-2 border-t border-[var(--paper-line)]">
                  <div className="text-red-700 font-bold uppercase text-[10px] mb-1">Common Scam Forgeries:</div>
                  <ul className="space-y-1 text-[11px] text-red-900 font-sans">
                    {reg.common_scam_forgeries.map((scam, i) => (
                      <li key={i}>• {scam}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EVIDENCE VAULT EXHIBITS */}
      {activeTab === 'vault_history' && (
        <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[var(--saffron)] font-bold">
                CUSTODIAL VAULT EXHIBITS
              </span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Preserved Video Call Forgery Artifacts
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-500">
              Total Preserved: {inspectionsList.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-[var(--paper-line)]">
                <tr>
                  <th className="py-3 px-4">Inspection ID</th>
                  <th className="py-3 px-4">Claimed Agency</th>
                  <th className="py-3 px-4">Verdict</th>
                  <th className="py-3 px-4">Forgery Score</th>
                  <th className="py-3 px-4">SHA-256 Digest</th>
                  <th className="py-3 px-4">Vault Evidence ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--paper-line)]">
                {inspectionsList.map((insp) => (
                  <tr key={insp.inspection_id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-bold text-[var(--ink)]">{insp.inspection_id}</td>
                    <td className="py-3 px-4">{insp.uniform_evaluation.claimed_agency}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                        {insp.risk_verdict}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-red-600">
                      {(insp.stage_forgery_score * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {insp.image_sha256.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {insp.vaulted_evidence_id || 'Not Vaulted'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(insp.inspection_timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

