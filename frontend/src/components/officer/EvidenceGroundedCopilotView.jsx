import React, { useState, useEffect } from 'react';
import {
  fetchGroundedCopilotAnalysisApi,
  submitCopilotFeedbackApi,
  submitCopilotApprovalApi,
  APPROVED_OPERATING_PROCEDURES,
  COPILOT_CHANGED_EVENT,
} from '../../api.js';

const SAMPLE_PRESETS = [
  { label: 'RPT-0001 (Digital Arrest CBI Call)', id: 'RPT-0001', account: 'ACC-1002' },
  { label: 'INC-001 (Active Mule Ring)', id: 'INC-001', account: 'ACC-1002' },
  { label: 'ACC-1002 (Flagged Syndicate Account)', id: 'ACC-1002', account: 'ACC-1002' },
  { label: 'MISSING-RECORD-404 (Evidence Gap Test)', id: 'MISSING-RECORD-404', account: '' },
];

export default function EvidenceGroundedCopilotView({ initialIdentifier = 'RPT-0001', initialAccountId = 'ACC-1002' }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [accountId, setAccountId] = useState(initialAccountId);
  const [officerBadge, setOfficerBadge] = useState('INSP-KUMAR-771');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modal / Inline feedback note state
  const [activeFeedbackRecId, setActiveFeedbackRecId] = useState(null);
  const [feedbackType, setFeedbackType] = useState('helpful');
  const [feedbackNotes, setFeedbackNotes] = useState('');

  // Approval note state
  const [activeApprovalRecId, setActiveApprovalRecId] = useState(null);
  const [approvalDecision, setApprovalDecision] = useState('approved');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Selected source reference for inspection
  const [inspectedRef, setInspectedRef] = useState(null);

  async function loadAnalysis(targetId = identifier, targetAcc = accountId) {
    if (!targetId.trim()) return;
    setLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      const data = await fetchGroundedCopilotAnalysisApi(targetId.trim(), targetAcc?.trim() || null);
      setAnalysis(data);
    } catch (err) {
      setError(err.message || 'Failed to generate evidence-grounded analysis.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    function onCopilotChanged() {
      // Reload silently to keep approval/feedback in sync
      if (identifier) {
        fetchGroundedCopilotAnalysisApi(identifier, accountId).then(setAnalysis).catch(() => {});
      }
    }
    window.addEventListener(COPILOT_CHANGED_EVENT, onCopilotChanged);
    return () => window.removeEventListener(COPILOT_CHANGED_EVENT, onCopilotChanged);
  }, []);

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!activeFeedbackRecId) return;
    try {
      const updated = await submitCopilotFeedbackApi(
        activeFeedbackRecId,
        feedbackType,
        feedbackNotes || null,
        officerBadge
      );
      setActionSuccess(`Feedback '${feedbackType}' recorded for ${activeFeedbackRecId}`);
      setActiveFeedbackRecId(null);
      setFeedbackNotes('');

      // Update in local state immediately
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.rec_id === activeFeedbackRecId ? { ...r, ...updated } : r
          ),
        };
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApprovalSubmit(e) {
    e.preventDefault();
    if (!activeApprovalRecId) return;
    try {
      const updated = await submitCopilotApprovalApi(
        activeApprovalRecId,
        approvalDecision,
        officerBadge,
        approvalNotes || null
      );
      setActionSuccess(`Consequential action ${approvalDecision.toUpperCase()} by ${officerBadge}`);
      setActiveApprovalRecId(null);
      setApprovalNotes('');

      // Update in local state
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.rec_id === activeApprovalRecId ? { ...r, ...updated } : r
          ),
        };
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--navy-line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Retrieval-Grounded Copilot
            </span>
            <span className="text-xs font-mono text-[var(--mist)]">v2.0 • Zero Hallucination Standard</span>
          </div>
          <h2 className="text-2xl font-display font-semibold mt-1">
            Evidence-Grounded Officer Copilot
          </h2>
          <p className="text-sm text-[var(--mist)]">
            Separates verified facts, uncorroborated claims, and algorithmic signals. Consequential actions require mandatory human signoff.
          </p>
        </div>

        {/* Officer Active Badge Profile */}
        <div className="flex items-center gap-2 bg-[var(--ink)] px-3 py-2 rounded-xl border border-[var(--navy-line)]">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs">
            <div className="text-[var(--mist)]">Reviewing Officer Badge</div>
            <input
              className="bg-transparent font-mono font-semibold text-white focus:outline-none w-36"
              value={officerBadge}
              onChange={(e) => setOfficerBadge(e.target.value)}
              title="Click to change your officer badge code"
            />
          </div>
        </div>
      </div>

      {/* Query Bar & Presets */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--mist)] font-medium">Quick Presets:</span>
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setIdentifier(p.id);
                setAccountId(p.account);
                loadAnalysis(p.id, p.account);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                identifier === p.id
                  ? 'bg-[var(--saffron)] text-white border-[var(--saffron)] font-semibold shadow-sm'
                  : 'bg-[var(--ink)] text-[var(--mist)] border-[var(--navy-line)] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white px-4 py-2.5 text-sm font-mono focus:border-[var(--saffron)] focus:outline-none"
            placeholder="Report ID or Incident ID (e.g. RPT-0001, INC-001)"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <input
            className="sm:w-60 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white px-4 py-2.5 text-sm font-mono focus:border-[var(--saffron)] focus:outline-none"
            placeholder="Account ID (optional, e.g. ACC-1002)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button
            onClick={() => loadAnalysis()}
            disabled={loading}
            className="bg-[var(--saffron)] hover:bg-amber-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Grounding Evidence…
              </>
            ) : (
              'Run Grounded Analysis'
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
          <span className="text-red-400 font-bold text-lg">⚠️</span>
          <div>
            <div className="font-semibold">Analysis Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Analysis Presentation */}
      {analysis && (
        <div className="space-y-6">
          {/* Executive Overview & Insufficient Evidence Banner */}
          {!analysis.has_sufficient_evidence ? (
            <div className="p-5 rounded-2xl bg-amber-950/40 border-2 border-amber-500/50 text-amber-200 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-base font-bold text-amber-300">
                    INSUFFICIENT EVIDENCE DETECTED — CONSEQUENTIAL ACTIONS WITHHELD
                  </h3>
                  <p className="text-xs text-amber-200/80">
                    Pursuant to KshemOS Grounded Decision Protocol, legal mandates cannot be generated without verified primary complaints.
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 text-xs font-mono text-amber-100 border border-amber-500/20">
                {analysis.missing_records_summary}
              </div>
              <div className="text-xs text-amber-300/90 flex items-center gap-2">
                <span>Completeness Score: <strong>{(analysis.evidence_completeness_score * 100).toFixed(0)}%</strong></span>
                <span>•</span>
                <span>Recommendation: <strong>Preliminary Intake & Witness Corroboration</strong></span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono uppercase font-bold ${
                      analysis.priority === 'critical'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : analysis.priority === 'high'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    }`}
                  >
                    Priority: {analysis.priority}
                  </span>
                  <span className="text-xs text-[var(--mist)] font-mono">
                    Completeness: {(analysis.evidence_completeness_score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-white/90 leading-relaxed font-sans">{analysis.executive_summary}</p>
              </div>
            </div>
          )}

          {/* 4-TIER GROUNDING PRESENTATION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* TIER 1: Confirmed Facts */}
            <div className="bg-[var(--ink)] border border-emerald-500/30 rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--navy-line)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h3 className="font-semibold text-sm text-emerald-300">Tier 1: Confirmed Facts</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                  {analysis.confirmed_facts?.length || 0} Verified
                </span>
              </div>
              <p className="text-xs text-[var(--mist)] mb-3">
                Authoritative records verified directly from database tables, graph topology, and cryptographic vault.
              </p>
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72 pr-1">
                {(!analysis.confirmed_facts || analysis.confirmed_facts.length === 0) ? (
                  <div className="text-xs text-gray-400 italic p-3 text-center">No confirmed database facts located.</div>
                ) : (
                  analysis.confirmed_facts.map((fact) => (
                    <div key={fact.fact_id} className="p-2.5 rounded-xl bg-black/30 border border-emerald-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-mono">
                        <span>{fact.fact_type}</span>
                        <span className="text-emerald-300 font-bold">✓ VERIFIED</span>
                      </div>
                      <div className="text-white/90">{fact.statement}</div>
                      <div className="text-[10px] text-emerald-300/80 font-mono truncate" title={fact.source_citation}>
                        Ref: {fact.source_citation}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TIER 2: Unverified Claims */}
            <div className="bg-[var(--ink)] border border-amber-500/30 rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--navy-line)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h3 className="font-semibold text-sm text-amber-300">Tier 2: Unverified Claims</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800">
                  {analysis.unverified_claims?.length || 0} Pending
                </span>
              </div>
              <p className="text-xs text-[var(--mist)] mb-3">
                Citizen assertions, scammer impersonation claims, or uncorroborated allegations requiring verification.
              </p>
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72 pr-1">
                {(!analysis.unverified_claims || analysis.unverified_claims.length === 0) ? (
                  <div className="text-xs text-gray-400 italic p-3 text-center">No unverified claims pending.</div>
                ) : (
                  analysis.unverified_claims.map((claim) => (
                    <div key={claim.claim_id} className="p-2.5 rounded-xl bg-black/30 border border-amber-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-amber-400 font-mono">
                        <span>Source: {claim.reporting_party}</span>
                        <span className="uppercase font-semibold text-amber-300">⚠️ {claim.verification_status}</span>
                      </div>
                      <div className="text-white/90">"{claim.statement}"</div>
                      <div className="text-[10px] text-amber-200/70">
                        <strong className="text-amber-300">Needed:</strong> {claim.corroboration_needed}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TIER 3: System Signals */}
            <div className="bg-[var(--ink)] border border-cyan-500/30 rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--navy-line)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <h3 className="font-semibold text-sm text-cyan-300">Tier 3: System Signals</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800">
                  {analysis.system_signals?.length || 0} Algorithmic
                </span>
              </div>
              <p className="text-xs text-[var(--mist)] mb-3">
                Probabilistic heuristics, network centrality metrics, and telemetry indicators from security models.
              </p>
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72 pr-1">
                {(!analysis.system_signals || analysis.system_signals.length === 0) ? (
                  <div className="text-xs text-gray-400 italic p-3 text-center">No algorithmic signals generated.</div>
                ) : (
                  analysis.system_signals.map((sig) => (
                    <div key={sig.signal_id} className="p-2.5 rounded-xl bg-black/30 border border-cyan-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{sig.signal_name}</span>
                        <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                          {String(sig.value)}
                        </span>
                      </div>
                      <div className="text-[10px] text-cyan-300/80 font-mono">
                        Model: {sig.detector_model} ({(sig.confidence * 100).toFixed(0)}% conf)
                      </div>
                      <div className="text-white/80 text-[11px]">{sig.interpretation}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* TIER 4: MODEL RECOMMENDATIONS WITH ATTACHED SOURCE CITATIONS */}
          <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--navy-line)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--saffron)]" />
                  <h3 className="font-semibold text-lg text-white">Tier 4: Grounded Recommendations</h3>
                </div>
                <p className="text-xs text-[var(--mist)]">
                  Every recommendation is strictly anchored in confirmed facts, verified edges, or approved SOPs. Consequential actions require explicit officer authorization.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {analysis.recommendations?.length || 0} Actions Formulated
              </span>
            </div>

            <div className="space-y-4">
              {analysis.recommendations?.map((rec, idx) => (
                <div
                  key={rec.rec_id}
                  className={`p-4 rounded-xl border transition-all ${
                    rec.is_consequential
                      ? rec.approval_status === 'approved'
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : rec.approval_status === 'rejected'
                        ? 'bg-red-950/20 border-red-500/40'
                        : 'bg-amber-950/20 border-amber-500/40 shadow-md'
                      : 'bg-black/30 border-[var(--navy-line)]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white/70">#{idx + 1}</span>
                        <span className="text-xs font-mono font-bold text-[var(--saffron)]">{rec.rec_id}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                            rec.priority === 'critical'
                              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                              : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                          }`}
                        >
                          {rec.priority}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                          Role: {rec.suggested_role}
                        </span>

                        {/* Consequential Action Badge */}
                        {rec.is_consequential && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            ⚖️ Consequential Action
                          </span>
                        )}

                        {/* Human Approval Status */}
                        {rec.requires_human_approval && (
                          <span
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                              rec.approval_status === 'approved'
                                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                : rec.approval_status === 'rejected'
                                ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                            }`}
                          >
                            {rec.approval_status === 'approved'
                              ? `✓ APPROVED by ${rec.approved_by || 'Officer'}`
                              : rec.approval_status === 'rejected'
                              ? `✕ REJECTED by ${rec.approved_by || 'Officer'}`
                              : '⏳ PENDING HUMAN APPROVAL'}
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-base text-white">{rec.action_title}</h4>
                      <p className="text-xs text-[var(--mist)] leading-relaxed">{rec.rationale}</p>

                      {/* ATTACHED SOURCE CITATION PILLS */}
                      <div className="pt-2">
                        <div className="text-[10px] text-[var(--mist)] uppercase tracking-wider font-semibold mb-1">
                          Attached Source References ({rec.source_references?.length || 0}):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.source_references?.map((ref) => (
                            <button
                              key={ref.ref_id}
                              onClick={() => setInspectedRef(ref)}
                              className="text-[10px] font-mono px-2 py-1 rounded bg-[var(--navy)] hover:bg-[var(--navy-line)] border border-[var(--navy-line)] text-cyan-300 hover:text-white transition-all flex items-center gap-1.5"
                              title="Click to inspect exact statutory clause or database pointer"
                            >
                              <span>
                                {ref.source_type === 'approved_sop'
                                  ? '📜'
                                  : ref.source_type === 'fraud_graph'
                                  ? '🕸️'
                                  : '🗄️'}
                              </span>
                              <span className="font-semibold">{ref.citation_title}</span>
                              <span className="text-gray-400">({ref.field_or_clause})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ACTIONS: HUMAN APPROVAL & FEEDBACK BUTTONS */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      {/* Consequential Approval Action Buttons */}
                      {rec.requires_human_approval && (
                        <div className="bg-[var(--navy)] p-2 rounded-xl border border-[var(--navy-line)] space-y-1 text-right">
                          <div className="text-[10px] text-[var(--mist)] font-mono">Statutory Authority Signoff:</div>
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => {
                                setActiveApprovalRecId(rec.rec_id);
                                setApprovalDecision('approved');
                              }}
                              className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
                                rec.approval_status === 'approved'
                                  ? 'bg-emerald-600 text-white shadow'
                                  : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-800/80 border border-emerald-500/30'
                              }`}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => {
                                setActiveApprovalRecId(rec.rec_id);
                                setApprovalDecision('rejected');
                              }}
                              className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
                                rec.approval_status === 'rejected'
                                  ? 'bg-red-600 text-white shadow'
                                  : 'bg-red-950/60 text-red-300 hover:bg-red-800/80 border border-red-500/30'
                              }`}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Officer Feedback Buttons */}
                      <div className="flex items-center gap-1 bg-[var(--navy)] p-1.5 rounded-xl border border-[var(--navy-line)]">
                        <span className="text-[10px] text-[var(--mist)] px-1 font-mono">Flag:</span>
                        <button
                          onClick={() => {
                            setActiveFeedbackRecId(rec.rec_id);
                            setFeedbackType('helpful');
                          }}
                          className={`text-xs px-2 py-0.5 rounded transition-all ${
                            rec.officer_feedback === 'helpful'
                              ? 'bg-emerald-500 text-white font-bold'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`}
                          title="Flag as helpful"
                        >
                          👍 Helpful
                        </button>
                        <button
                          onClick={() => {
                            setActiveFeedbackRecId(rec.rec_id);
                            setFeedbackType('unsupported');
                          }}
                          className={`text-xs px-2 py-0.5 rounded transition-all ${
                            rec.officer_feedback === 'unsupported'
                              ? 'bg-amber-500 text-black font-bold'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`}
                          title="Flag as unsupported by facts"
                        >
                          ❓ Unsupported
                        </button>
                        <button
                          onClick={() => {
                            setActiveFeedbackRecId(rec.rec_id);
                            setFeedbackType('incorrect');
                          }}
                          className={`text-xs px-2 py-0.5 rounded transition-all ${
                            rec.officer_feedback === 'incorrect'
                              ? 'bg-red-500 text-white font-bold'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`}
                          title="Flag as incorrect"
                        >
                          👎 Incorrect
                        </button>
                      </div>

                      {/* Recorded Feedback Display */}
                      {rec.officer_feedback && (
                        <div className="text-[10px] font-mono text-[var(--mist)] text-right">
                          Flagged <strong className="text-white">{rec.officer_feedback}</strong> by {rec.feedback_submitted_by || 'Officer'}
                          {rec.feedback_notes && ` ("${rec.feedback_notes}")`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOURCE REFERENCE INSPECTION */}
      {inspectedRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <h3 className="font-semibold text-lg text-white">Source Reference Citation</h3>
              </div>
              <button
                onClick={() => setInspectedRef(null)}
                className="text-gray-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-[var(--mist)] uppercase font-mono">Reference ID:</span>
                <div className="font-mono text-cyan-300">{inspectedRef.ref_id}</div>
              </div>
              <div>
                <span className="text-xs text-[var(--mist)] uppercase font-mono">Citation Title:</span>
                <div className="font-semibold text-white">{inspectedRef.citation_title}</div>
              </div>
              <div>
                <span className="text-xs text-[var(--mist)] uppercase font-mono">Clause / Field:</span>
                <div className="text-amber-300 font-mono text-xs p-2 rounded bg-black/40 border border-[var(--navy-line)]">
                  {inspectedRef.field_or_clause}
                </div>
              </div>
              <div>
                <span className="text-xs text-[var(--mist)] uppercase font-mono">Exact Retrieval Pointer:</span>
                <div className="text-emerald-300 font-mono text-xs p-2 rounded bg-black/40 border border-[var(--navy-line)]">
                  {inspectedRef.exact_pointer}
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedRef(null)}
                className="bg-[var(--saffron)] text-white px-4 py-1.5 rounded-lg text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / POPUP: OFFICER FEEDBACK FORM */}
      {activeFeedbackRecId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleFeedbackSubmit}
            className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
              <h3 className="font-semibold text-base text-white">
                Submit Officer Alignment Feedback
              </h3>
              <button
                type="button"
                onClick={() => setActiveFeedbackRecId(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--mist)]">
              Your feedback is audited and used to fine-tune retrieval precision for operational incident response.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-[var(--mist)] font-mono">Flag Decision:</label>
              <div className="grid grid-cols-3 gap-2">
                {['helpful', 'unsupported', 'incorrect'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFeedbackType(f)}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize border ${
                      feedbackType === f
                        ? 'bg-[var(--saffron)] text-white border-[var(--saffron)] font-bold'
                        : 'bg-[var(--ink)] text-gray-300 border-[var(--navy-line)] hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--mist)] font-mono">Operational Notes (Optional):</label>
              <textarea
                className="w-full rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white p-3 text-xs focus:border-[var(--saffron)] focus:outline-none"
                rows={3}
                placeholder="Explain why this action is helpful, unsupported by facts, or incorrect..."
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveFeedbackRecId(null)}
                className="px-4 py-2 rounded-lg text-xs text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--saffron)] text-white px-5 py-2 rounded-lg text-xs font-semibold shadow"
              >
                Record Feedback
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL / POPUP: CONSEQUENTIAL ACTION HUMAN APPROVAL FORM */}
      {activeApprovalRecId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleApprovalSubmit}
            className="bg-[var(--navy)] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                <h3 className="font-semibold text-base text-white">
                  Consequential Action Authorization
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveApprovalRecId(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
              <strong>Mandatory Human Guardrail:</strong> This action alters legal rights or places statutory liens on bank/telecom infrastructure. AI cannot execute this action autonomously.
            </div>
            <div className="space-y-2">
              <label className="text-xs text-[var(--mist)] font-mono">Authorization Decision:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalDecision('approved')}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    approvalDecision === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow'
                      : 'bg-[var(--ink)] text-gray-300 border-[var(--navy-line)]'
                  }`}
                >
                  ✓ Authorize Action
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalDecision('rejected')}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    approvalDecision === 'rejected'
                      ? 'bg-red-600 text-white border-red-500 font-bold shadow'
                      : 'bg-[var(--ink)] text-gray-300 border-[var(--navy-line)]'
                  }`}
                >
                  ✕ Deny / Reject
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--mist)] font-mono">Officer Authorization Notes:</label>
              <textarea
                className="w-full rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] text-white p-3 text-xs focus:border-[var(--saffron)] focus:outline-none"
                rows={3}
                placeholder="Record statutory reasoning, witness verification, or jurisdictional justification..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveApprovalRecId(null)}
                className="px-4 py-2 rounded-lg text-xs text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`text-white px-5 py-2 rounded-lg text-xs font-semibold shadow ${
                  approvalDecision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                Confirm {approvalDecision.toUpperCase()}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

