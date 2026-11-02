import { useState, useEffect } from 'react';
import CyberFeatureCard from './CyberFeatureCard';
import { buildCyberCase } from '../cyberFeatures/caseBuilder';
import {
  fetchEvidenceItems,
  ingestEvidenceApi,
  generateForensicBundleApi,
  sha256Sync,
  EVIDENCE_CHANGED_EVENT,
} from '../evidenceStore';
import EvidenceVaultView from './evidence/EvidenceVaultView';

export default function CyberCaseBuilderView() {
  const [caseId, setCaseId] = useState('CASE-2026-DELHI-01');
  const [title, setTitle] = useState('Digital Arrest Extortion Syndicate Investigation');
  const [summary, setSummary] = useState(
    'Victim in Central Delhi coerced via WhatsApp video call by impersonator claiming to be CBI Chief Officer. Transferred ₹4.8L to mule account ACC-1002.'
  );
  const [evidence, setEvidence] = useState('Call audio recording, Fake arrest warrant PDF, Bank RTGS slip');
  const [urgency, setUrgency] = useState('critical');
  const [result, setResult] = useState(null);

  // Evidence Vault Integration State
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'vault'
  const [vaultItems, setVaultItems] = useState([]);
  const [quickArtifactText, setQuickArtifactText] = useState('');
  const [quickArtifactType, setQuickArtifactType] = useState('audio_recording');
  const [quickArtifactTitle, setQuickArtifactTitle] = useState('');
  const [ingestingQuick, setIngestingQuick] = useState(false);
  const [bundleNotice, setBundleNotice] = useState(null);

  async function loadVaultItems() {
    try {
      const items = await fetchEvidenceItems({ caseId });
      setVaultItems(items);
    } catch {
      // Handled by store
    }
  }

  useEffect(() => {
    loadVaultItems();

    function handleChanged() {
      loadVaultItems();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(EVIDENCE_CHANGED_EVENT, handleChanged);
      return () => window.removeEventListener(EVIDENCE_CHANGED_EVENT, handleChanged);
    }
  }, [caseId]);

  async function handleQuickIngest(e) {
    e.preventDefault();
    if (!quickArtifactText.trim() || !quickArtifactTitle.trim()) return;
    setIngestingQuick(true);
    try {
      await ingestEvidenceApi({
        case_id: caseId,
        title: quickArtifactTitle.trim(),
        description: `Attached directly via CyberCaseBuilder for ${caseId}`,
        evidence_type: quickArtifactType,
        category: 'digital_arrest',
        source: 'field_capture',
        raw_content: quickArtifactText.trim(),
        file_name: `${quickArtifactTitle.toLowerCase().replace(/\s+/g, '_')}.dat`,
        officer_badge_id: 'OFF-CASE-BUILDER',
        officer_name: 'Lead Investigating Officer',
        legal_hold: true,
        legal_hold_reason: 'Active Cyber Syndicate Investigation',
      });
      setQuickArtifactTitle('');
      setQuickArtifactText('');
      await loadVaultItems();
    } catch (err) {
      alert(`Ingest error: ${err.message}`);
    } finally {
      setIngestingQuick(false);
    }
  }

  async function handleExportCaseBundle() {
    try {
      const bundle = await generateForensicBundleApi(caseId, 'OFF-CASE-BUILDER');
      setBundleNotice(bundle);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-[var(--saffron)]">
            CyberCase Builder & Evidence Vault
          </div>
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Case Assembly & Digital Evidence Chain
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-text)]/70">
            Build investigation case summaries, attach cryptographically hashed digital artifacts, and export court-admissible forensic packages.
          </p>
        </div>

        {/* Tab switch */}
        <div className="inline-flex gap-1 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-xs self-start">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-1.5 rounded-full font-semibold transition ${
              activeTab === 'builder'
                ? 'bg-[var(--ink)] text-white shadow-sm'
                : 'text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
            }`}
          >
            Case Summary & Signals
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-1.5 rounded-full font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'vault'
                ? 'bg-[var(--ink)] text-white shadow-sm'
                : 'text-[var(--ink-text)]/60 hover:text-[var(--ink)]'
            }`}
          >
            <span>🔐 Evidence Vault ({vaultItems.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'builder' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Case Builder Form */}
          <div className="lg:col-span-2 space-y-6">
            <CyberFeatureCard
              eyebrow="Case Metadata & Analysis"
              title="Incident Synopsis & Prioritization"
              description="Structures the complaint narrative and identifies extortion, identity, or payment signals."
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                      Case Reference ID
                    </label>
                    <input
                      value={caseId}
                      onChange={(e) => setCaseId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-sm font-mono"
                      placeholder="Case ID (e.g. CASE-2026-DELHI-01)"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                      Urgency Band
                    </label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-sm"
                    >
                      <option value="critical">Critical (Immediate Loss Risk)</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="standard">Standard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                    Case Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-sm"
                    placeholder="Case title"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                    Investigative Summary & Modus Operandi
                  </label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="min-h-24 w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--ink-text)]/60 mb-1">
                    Evidence Checklist Items (Comma Separated)
                  </label>
                  <input
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    className="w-full rounded-xl border border-[var(--paper-line)] p-2.5 text-sm"
                    placeholder="Screenshot, call log, message"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() =>
                      setResult(
                        buildCyberCase({
                          title,
                          summary,
                          evidence: evidence.split(',').map((s) => s.trim()).filter(Boolean),
                          urgency,
                        })
                      )
                    }
                    className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white hover:bg-black transition"
                  >
                    Build Case Analysis
                  </button>

                  <button
                    onClick={handleExportCaseBundle}
                    className="rounded-full bg-[var(--saffron)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition shadow-sm flex items-center gap-1.5"
                  >
                    <span>🏛️</span> Export Court Bundle (§ 65B)
                  </button>
                </div>
              </div>

              {result && (
                <div className="mt-4 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 text-sm space-y-2">
                  <div className="mb-1 inline-flex rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--saffron)]">
                    {result.risk_band} Priority • Score: {result.risk_score}
                  </div>
                  <p className="font-semibold text-[var(--ink)]">{result.recommendation}</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--ink-text)]/80">
                    {result.signals.map((signal) => (
                      <li key={signal.type}>• {signal.detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CyberFeatureCard>
          </div>

          {/* Vaulted Evidence Sidebar & Quick Fingerprint Ingestion */}
          <div className="space-y-6">
            {/* Vaulted Artifacts for this case */}
            <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
                <div>
                  <h3 className="font-display font-semibold text-[var(--ink)]">Linked Vault Evidence</h3>
                  <div className="font-mono text-[10px] text-[var(--ink-text)]/60">Case: {caseId}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[var(--saffron)]/15 text-[var(--saffron)]">
                  {vaultItems.length} Exhibits
                </span>
              </div>

              {vaultItems.length === 0 ? (
                <p className="text-xs text-[var(--ink-text)]/60 py-4 text-center">
                  No evidence items linked yet. Ingest an artifact below to secure its SHA-256 fingerprint.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {vaultItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)]/50 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-[var(--ink)] line-clamp-1">{item.title}</span>
                        {item.legal_hold && (
                          <span className="text-[10px] text-amber-600 font-mono font-bold ml-1">🔒 Hold</span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-[var(--ink-text)]/70 break-all">
                        SHA-256: {item.sha256_hash?.slice(0, 16)}...
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--ink-text)]/50 pt-0.5">
                        <span>{item.rfc3161_token?.serial_number}</span>
                        <span>{new Date(item.ingested_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Ingest Panel */}
            <form onSubmit={handleQuickIngest} className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 shadow-sm space-y-3 text-xs">
              <div className="font-semibold text-sm text-[var(--ink)] flex items-center gap-1.5">
                <span>🔐</span> Secure Ingest to Vault
              </div>
              <p className="text-[11px] text-[var(--ink-text)]/70">
                Instantly compute SHA-256 fingerprint and generate RFC 3161 timestamp.
              </p>

              <div>
                <input
                  value={quickArtifactTitle}
                  onChange={(e) => setQuickArtifactTitle(e.target.value)}
                  className="w-full rounded-xl border border-[var(--paper-line)] p-2 text-xs"
                  placeholder="Artifact title (e.g. Call audio intercept)"
                  required
                />
              </div>

              <div>
                <select
                  value={quickArtifactType}
                  onChange={(e) => setQuickArtifactType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--paper-line)] p-2 text-xs"
                >
                  <option value="audio_recording">Audio Recording</option>
                  <option value="document">Legal Document / Notice</option>
                  <option value="transaction_receipt">Bank Transfer Slip</option>
                  <option value="image_screenshot">Screenshot / Scan</option>
                  <option value="chat_transcript">Chat Transcript</option>
                </select>
              </div>

              <div>
                <textarea
                  value={quickArtifactText}
                  onChange={(e) => setQuickArtifactText(e.target.value)}
                  className="w-full rounded-xl border border-[var(--paper-line)] p-2 text-xs font-mono min-h-16"
                  placeholder="Paste raw transcript, base64 payload, or text..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={ingestingQuick}
                className="w-full py-2 rounded-xl bg-[var(--ink)] text-white font-semibold text-xs hover:bg-black transition disabled:opacity-40"
              >
                {ingestingQuick ? 'Fingerprinting…' : 'Fingerprint & Add to Vault'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Full Evidence Vault Embed View */
        <EvidenceVaultView activeCaseId={caseId} />
      )}

      {/* Forensic Bundle Alert Modal */}
      {bundleNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--navy)] border border-[var(--saffron)] rounded-2xl max-w-xl w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <div>
                <span className="font-mono text-xs text-[var(--saffron)] uppercase">Export Confirmed</span>
                <h3 className="font-display text-xl font-semibold">Court Forensic Package Ready</h3>
              </div>
              <button onClick={() => setBundleNotice(null)} className="text-[var(--mist)] hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5">
              <div className="font-bold">✓ Section 65B Indian Evidence Act Manifest Compiled</div>
              <div>Bundle Reference: <span className="font-mono font-bold text-white">{bundleNotice.bundle_id}</span></div>
              <div className="font-mono text-[10px] break-all text-emerald-300">
                Manifest SHA-256: {bundleNotice.manifest_sha256}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setBundleNotice(null)}
                className="px-4 py-2 rounded-xl border border-[var(--navy-line)] text-xs text-[var(--mist)] hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundleNotice, null, 2));
                  const a = document.createElement('a');
                  a.href = dataStr;
                  a.download = `${bundleNotice.bundle_id}.json`;
                  a.click();
                }}
                className="px-4 py-2 rounded-xl bg-[var(--saffron)] text-white text-xs font-semibold hover:brightness-110"
              >
                Download JSON Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
