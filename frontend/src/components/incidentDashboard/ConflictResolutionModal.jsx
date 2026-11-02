import { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';
import { resolveConflict, INCIDENTS_CHANGED_EVENT } from '../../api';
import { SEVERITIES, STATUSES } from '../../incidentDashboard';
import { STATUS_LABEL } from './display';

export default function ConflictResolutionModal({ conflictItem, onClose }) {
  if (!conflictItem) return null;

  const { queueId, incidentId, changes = {}, serverConflictData = {}, baseSnapshot = {} } = conflictItem;
  const serverIncident = serverConflictData?.serverIncident || {};
  const conflictingFields = serverConflictData?.conflictingFields || Object.keys(changes);

  // State for manual merge mode
  const [isMerging, setIsMerging] = useState(false);
  const [mergedStatus, setMergedStatus] = useState(changes.status || serverIncident.status || 'in_progress');
  const [mergedSeverity, setMergedSeverity] = useState(changes.severity || serverIncident.severity || 'medium');
  const [mergedAssignee, setMergedAssignee] = useState(changes.assigned_to ?? serverIncident.assigned_to ?? '');
  const [mergedNotes, setMergedNotes] = useState(changes.notes || '');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  async function handleResolution(type, customChanges = null) {
    setResolving(true);
    setError(null);
    try {
      await resolveConflict(queueId, type, customChanges);
      globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to resolve conflict');
    } finally {
      setResolving(false);
    }
  }

  function handleSaveMerge() {
    const custom = {
      status: mergedStatus,
      severity: mergedSeverity,
      assigned_to: mergedAssignee.trim() || null,
      notes: mergedNotes.trim() || undefined,
    };
    handleResolution('merge', custom);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[var(--navy)] border border-rose-500/50 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--navy-line)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-rose-400">Sync Conflict Detected</div>
              <h2 id="conflict-dialog-title" className="text-xl font-display font-bold">
                Incident {incidentId}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[var(--mist)] hover:text-white hover:bg-[var(--navy-line)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-[var(--mist)]">
          This incident was updated at Command Center while your field unit was offline. Review the conflicting values below and choose how to reconcile them:
        </p>

        {/* Side-by-side Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Local Field Unit Update */}
          <div className="bg-[var(--ink)]/80 border-2 border-[var(--saffron)]/70 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-bold">
                Your Field Update (Offline)
              </span>
              <span className="text-[10px] bg-[var(--saffron)]/20 text-[var(--saffron)] px-2 py-0.5 rounded-full font-mono">
                Local Queued
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className={`p-2 rounded-lg ${conflictingFields.includes('status') ? 'bg-amber-950/40 border border-amber-500/40' : ''}`}>
                <div className="text-[var(--mist)]">Status:</div>
                <div className="font-semibold text-sm capitalize">{STATUS_LABEL[changes.status] || changes.status || 'Unchanged'}</div>
              </div>

              <div className={`p-2 rounded-lg ${conflictingFields.includes('severity') ? 'bg-amber-950/40 border border-amber-500/40' : ''}`}>
                <div className="text-[var(--mist)]">Severity:</div>
                <div className="font-semibold text-sm capitalize">{changes.severity || 'Unchanged'}</div>
              </div>

              <div className={`p-2 rounded-lg ${conflictingFields.includes('assigned_to') ? 'bg-amber-950/40 border border-amber-500/40' : ''}`}>
                <div className="text-[var(--mist)]">Assigned Officer:</div>
                <div className="font-mono text-sm">{changes.assigned_to || '(Unassigned)'}</div>
              </div>

              {changes.notes && (
                <div className="p-2 rounded-lg bg-[var(--navy)]">
                  <div className="text-[var(--mist)]">Field Notes Added:</div>
                  <div className="text-white italic mt-0.5">"{changes.notes}"</div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Server HQ Version */}
          <div className="bg-[var(--ink)]/80 border-2 border-emerald-500/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                Command Center (Server Live)
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
                v{serverIncident.version || 2} Live
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className={`p-2 rounded-lg ${conflictingFields.includes('status') ? 'bg-amber-950/40 border border-amber-500/40' : ''}`}>
                <div className="text-[var(--mist)]">Status:</div>
                <div className="font-semibold text-sm capitalize">{STATUS_LABEL[serverIncident.status] || serverIncident.status || '—'}</div>
              </div>

              <div className={`p-2 rounded-lg ${conflictingFields.includes('severity') ? 'bg-amber-950/40 border border-amber-500/40' : ''}`}>
                <div className="text-[var(--mist)]">Severity:</div>
                <div className="font-semibold text-sm capitalize">{serverIncident.severity || '—'}</div>
              </div>

              <div className={`p-2 rounded-lg ${conflictingFields.includes('assigned_to') ? 'bg-amber-950/40 border border-amber-500/40' : ''}`}>
                <div className="text-[var(--mist)]">Assigned Officer:</div>
                <div className="font-mono text-sm">{serverIncident.assigned_to || '(Unassigned)'}</div>
              </div>

              {serverIncident.notes && serverIncident.notes.length > 0 && (
                <div className="p-2 rounded-lg bg-[var(--navy)]">
                  <div className="text-[var(--mist)]">HQ Notes:</div>
                  <div className="text-white italic mt-0.5">"{serverIncident.notes[serverIncident.notes.length - 1]}"</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Merge Form if isMerging */}
        {isMerging && (
          <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-2xl p-4 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-bold">
              Custom Merged Reconciliation
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-[var(--mist)]">Reconciled Status</span>
                <select
                  value={mergedStatus}
                  onChange={(e) => setMergedStatus(e.target.value)}
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg p-2 text-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[var(--mist)]">Reconciled Severity</span>
                <select
                  value={mergedSeverity}
                  onChange={(e) => setMergedSeverity(e.target.value)}
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg p-2 text-white capitalize"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-[var(--mist)]">Assign To</span>
                <input
                  value={mergedAssignee}
                  onChange={(e) => setMergedAssignee(e.target.value)}
                  placeholder="Officer Code, e.g. OFF-FIELD-1"
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded-lg p-2 text-white font-mono"
                />
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          {!isMerging ? (
            <>
              <button
                onClick={() => setIsMerging(true)}
                disabled={resolving}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] transition-colors"
              >
                Custom Merge…
              </button>
              <button
                onClick={() => handleResolution('keep_server')}
                disabled={resolving}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-emerald-950/60 border border-emerald-500 text-emerald-300 hover:bg-emerald-900/80 transition-colors"
              >
                Accept HQ Version (Discard Field)
              </button>
              <button
                onClick={() => handleResolution('keep_mine')}
                disabled={resolving}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-[var(--saffron)] text-[var(--ink)] hover:brightness-110 font-bold transition-all"
              >
                Keep Field Update (Force Push)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsMerging(false)}
                disabled={resolving}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-[var(--navy-line)] text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMerge}
                disabled={resolving}
                className="px-5 py-2 text-xs font-semibold rounded-full bg-[var(--saffron)] text-[var(--ink)] hover:brightness-110 font-bold transition-all"
              >
                Apply Merged Resolution
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
