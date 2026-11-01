import { useState } from 'react';

export default function HighImpactReviewModal({ proposal, onReview, onClose }) {
  const [reviewerCode, setReviewerCode] = useState('OFF-COMMANDER-01');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!proposal) return null;

  const val = proposal.validation || {};
  const proposed = proposal.proposed_payload || {};
  const original = proposal.original_payload || {};

  async function handleAction(decision) {
    if (!reviewerCode.trim()) {
      setError('Reviewer officer code is required.');
      return;
    }
    if (!reviewerNotes.trim()) {
      setError('Please provide reviewer rationale/notes before submitting decision.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReview(proposal.id, {
        reviewerCode: reviewerCode.trim(),
        decision,
        reviewerNotes: reviewerNotes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit review decision');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--navy)] border border-amber-500/40 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-[var(--navy-line)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                High-Impact Boundary Review
              </span>
              <span className="font-mono text-xs text-[var(--mist)]">{proposal.id}</span>
            </div>
            <h2 className="font-display text-xl font-semibold mt-1">Multi-Officer Authorization Required</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--mist)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-sm space-y-2">
          <div className="font-semibold flex items-center gap-2 text-amber-300">
            <span>⚠️</span> Guardrail Triggers Detected:
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-amber-100">
            {val.coverage_gap_detected && (
              <li>Boundary radius reduced by &gt;25% — potential perimeter coverage gap.</li>
            )}
            {val.affected_active_incidents > 0 && (
              <li>
                Affects <span className="font-bold underline">{val.affected_active_incidents}</span> active
                incident(s) currently open in this operational sector.
              </li>
            )}
            {val.warnings &&
              val.warnings.map((w, idx) => (
                <li key={idx} className="text-amber-300">
                  {w}
                </li>
              ))}
          </ul>
        </div>

        {/* Proposed Changes Diff Card */}
        <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-4 text-xs space-y-3">
          <div className="text-[var(--mist)] font-mono uppercase tracking-wider text-[11px]">
            Target Sector: <span className="text-white font-semibold">{proposed.name || proposal.entity_id}</span> ({proposed.region})
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5 p-3 rounded-lg bg-[var(--navy)]/50 border border-[var(--navy-line)]">
              <div className="font-mono text-[10px] uppercase text-[var(--mist)]">Current / Baseline</div>
              <div>Radius: <span className="font-mono font-semibold text-white">{original.radius_km ?? '—'} km</span></div>
              <div>Station: <span className="text-white">{original.primary_station ?? '—'}</span></div>
              <div>Capacity Limit: <span className="font-mono text-white">{original.capacity_limit_points ?? '—'} pts</span></div>
              <div>Status: <span className="font-mono text-white">{original.status ?? 'active'}</span></div>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="font-mono text-[10px] uppercase text-amber-400">Proposed Modification</div>
              <div>
                Radius:{' '}
                <span className="font-mono font-bold text-amber-300">
                  {proposed.radius_km ?? '—'} km
                </span>
                {original.radius_km && proposed.radius_km && (
                  <span className="text-red-400 ml-1">
                    ({Math.round(((proposed.radius_km - original.radius_km) / original.radius_km) * 100)}%)
                  </span>
                )}
              </div>
              <div>Station: <span className="text-white">{proposed.primary_station ?? '—'}</span></div>
              <div>Capacity Limit: <span className="font-mono text-white">{proposed.capacity_limit_points ?? '—'} pts</span></div>
              <div>Status: <span className="font-mono text-amber-300">{proposed.status ?? 'active'}</span></div>
            </div>
          </div>

          <div className="text-[11px] text-[var(--mist)] pt-1">
            Proposed by: <span className="font-mono text-white">{proposal.proposed_by}</span> at{' '}
            <span className="font-mono text-white">{new Date(proposal.created_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Review Form */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
              Reviewing Officer ID / Badge
            </label>
            <input
              className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm text-white font-mono"
              value={reviewerCode}
              onChange={(e) => setReviewerCode(e.target.value)}
              placeholder="e.g. OFF-COMMANDER-01"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
              Reviewer Authorization Rationale / Action Plan
            </label>
            <textarea
              className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-3 text-sm text-white min-h-[80px]"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="State rationale, perimeter reallocation plan, or reason for rejection..."
            />
          </div>

          {error && <p className="text-xs text-[var(--alert)]">{error}</p>}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--navy-line)]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--navy-line)] text-[var(--mist)] hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleAction('rejected')}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-900/60 border border-red-500/40 text-red-200 hover:bg-red-800 transition disabled:opacity-40"
          >
            {submitting ? '…' : 'Reject Change'}
          </button>
          <button
            type="button"
            onClick={() => handleAction('approved')}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--saffron)] text-white hover:brightness-110 shadow-lg transition disabled:opacity-40"
          >
            {submitting ? '…' : 'Approve & Apply Boundary'}
          </button>
        </div>
      </div>
    </div>
  );
}
