import { useState } from 'react';

export default function SnapshotHistoryDrawer({ snapshots = [], onRestore, onClose }) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [compareSnapshotId, setCompareSnapshotId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [restoredBy, setRestoredBy] = useState('OFF-SUPERVISOR-AUDIT');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const selectedSnap = snapshots.find((s) => s.snapshot_id === selectedSnapshotId);
  const compareSnap = snapshots.find((s) => s.snapshot_id === compareSnapshotId);

  async function handleRestore(snapId) {
    setRestoring(true);
    setError(null);
    setMessage(null);
    try {
      await onRestore(snapId, { restoredBy });
      setMessage(`Successfully restored configuration to ${snapId}!`);
      setConfirmRollback(false);
    } catch (err) {
      setError(err.message || 'Rollback failed');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-4xl w-full p-6 shadow-2xl text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--saffron)] uppercase tracking-wider">
                Immutable Audit Trail
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white">
                {snapshots.length} Snapshots
              </span>
            </div>
            <h2 className="font-display text-xl font-semibold mt-0.5">Historical Configuration Versions</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--mist)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
          {/* Snapshots Timeline List */}
          <div className="space-y-2 overflow-y-auto pr-1">
            <div className="text-xs font-mono uppercase text-[var(--mist)] mb-2">Version Timeline (Newest First)</div>
            {snapshots.map((s, idx) => {
              const isSelected = s.snapshot_id === selectedSnapshotId;
              const isCompare = s.snapshot_id === compareSnapshotId;
              return (
                <div
                  key={s.snapshot_id}
                  onClick={() => {
                    if (!selectedSnapshotId) {
                      setSelectedSnapshotId(s.snapshot_id);
                    } else if (selectedSnapshotId === s.snapshot_id) {
                      setSelectedSnapshotId(null);
                    } else {
                      setCompareSnapshotId(s.snapshot_id);
                    }
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition text-xs space-y-1 ${
                    isSelected
                      ? 'bg-[var(--saffron)]/15 border-[var(--saffron)]'
                      : isCompare
                      ? 'bg-blue-900/20 border-blue-400'
                      : 'bg-[var(--ink)]/80 border-[var(--navy-line)] hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white">
                      v{s.version} — {s.snapshot_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        s.impact_level === 'high'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-white/5 text-[var(--mist)]'
                      }`}
                    >
                      {s.impact_level || 'standard'}
                    </span>
                  </div>

                  <p className="text-white/90 line-clamp-2">{s.change_summary}</p>

                  <div className="flex items-center justify-between text-[11px] text-[var(--mist)] pt-1">
                    <span>By: <span className="font-mono text-white/80">{s.author}</span></span>
                    <span className="font-mono">{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {idx === 0 && (
                    <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider pt-0.5">
                      ● Active Live Configuration
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Details & Diff Pane */}
          <div className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-4 overflow-y-auto flex flex-col justify-between text-xs">
            {selectedSnap ? (
              <div className="space-y-4">
                <div>
                  <div className="font-mono text-[10px] uppercase text-[var(--mist)]">Selected Snapshot Detail</div>
                  <h3 className="font-semibold text-white text-base mt-0.5">
                    v{selectedSnap.version} ({selectedSnap.snapshot_id})
                  </h3>
                  <p className="text-white/80 mt-1">{selectedSnap.change_summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[var(--navy)] border border-[var(--navy-line)]">
                    <div className="text-[10px] text-[var(--mist)] uppercase">Author</div>
                    <div className="font-mono text-white font-semibold truncate">{selectedSnap.author}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--navy)] border border-[var(--navy-line)]">
                    <div className="text-[10px] text-[var(--mist)] uppercase">Recorded At</div>
                    <div className="font-mono text-white font-semibold">
                      {new Date(selectedSnap.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                {compareSnap && (
                  <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/40 space-y-2">
                    <div className="font-bold text-blue-300">Comparing with v{compareSnap.version}:</div>
                    <div className="text-[11px] text-blue-200">
                      <div>
                        Service Areas:{' '}
                        <span className="font-mono">{selectedSnap.service_area_count ?? (selectedSnap.service_areas?.length || 0)}</span> vs{' '}
                        <span className="font-mono">{compareSnap.service_area_count ?? (compareSnap.service_areas?.length || 0)}</span>
                      </div>
                      <div>
                        Dispatch Rules:{' '}
                        <span className="font-mono">{selectedSnap.dispatch_rule_count ?? (selectedSnap.dispatch_rules?.length || 0)}</span> vs{' '}
                        <span className="font-mono">{compareSnap.dispatch_rule_count ?? (compareSnap.dispatch_rules?.length || 0)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setCompareSnapshotId(null)}
                      className="text-[10px] underline text-blue-300 hover:text-white"
                    >
                      Clear Comparison
                    </button>
                  </div>
                )}

                {/* Rollback Prompt */}
                <div className="pt-4 border-t border-[var(--navy-line)] space-y-3">
                  {!confirmRollback ? (
                    <button
                      onClick={() => setConfirmRollback(true)}
                      className="w-full py-2.5 rounded-xl font-semibold bg-amber-600/80 hover:bg-amber-500 text-white transition text-xs shadow-md"
                    >
                      Restore & Rollback to this Snapshot (v{selectedSnap.version})
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/50 space-y-2 text-amber-200">
                      <div className="font-semibold text-xs text-amber-300">
                        Confirm Configuration Rollback:
                      </div>
                      <p className="text-[11px]">
                        This will revert all service area boundaries, capacities, and dispatch rules to this exact snapshot.
                        A new audit rollback snapshot will be captured.
                      </p>
                      <input
                        className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded px-2 py-1 text-xs text-white font-mono"
                        value={restoredBy}
                        onChange={(e) => setRestoredBy(e.target.value)}
                        placeholder="Authorizing officer code"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setConfirmRollback(false)}
                          className="flex-1 py-1.5 rounded border border-[var(--navy-line)] text-xs text-[var(--mist)] hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRestore(selectedSnap.snapshot_id)}
                          disabled={restoring}
                          className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-xs"
                        >
                          {restoring ? 'Rolling back…' : 'Execute Rollback'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--mist)]">
                <span className="text-3xl mb-2">📜</span>
                <p>Select any snapshot from the timeline to inspect audit details, diff changes, or execute a rollback.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
