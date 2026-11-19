import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  getConflictCount,
  getFailedCount,
  getPendingCount,
  getSyncQueue,
  isOnline,
  isSimulatedOffline,
  processSyncQueue,
  setSimulatedOffline,
  SYNC_STATUS_CHANGED_EVENT,
  INCIDENTS_CHANGED_EVENT,
} from '../../api';

export default function SyncStatusBanner({ onOpenOutbox, onOpenConflict }) {
  const [online, setOnline] = useState(() => isOnline());
  const [simulated, setSimulated] = useState(() => isSimulatedOffline());
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());
  const [conflictCount, setConflictCount] = useState(() => getConflictCount());
  const [failedCount, setFailedCount] = useState(() => getFailedCount());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  function refreshStatus() {
    setOnline(isOnline());
    setSimulated(isSimulatedOffline());
    setPendingCount(getPendingCount());
    setConflictCount(getConflictCount());
    setFailedCount(getFailedCount());
  }

  useEffect(() => {
    refreshStatus();
    window.addEventListener(SYNC_STATUS_CHANGED_EVENT, refreshStatus);
    window.addEventListener(INCIDENTS_CHANGED_EVENT, refreshStatus);
    window.addEventListener('online', refreshStatus);
    window.addEventListener('offline', refreshStatus);
    return () => {
      window.removeEventListener(SYNC_STATUS_CHANGED_EVENT, refreshStatus);
      window.removeEventListener(INCIDENTS_CHANGED_EVENT, refreshStatus);
      window.removeEventListener('online', refreshStatus);
      window.removeEventListener('offline', refreshStatus);
    };
  }, []);

  async function handleManualSync() {
    if (!online) return;
    setSyncing(true);
    try {
      await processSyncQueue();
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      refreshStatus();
      globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));
    } finally {
      setSyncing(false);
    }
  }

  function handleToggleSimulatedOffline() {
    const next = !simulated;
    setSimulatedOffline(next);
    setSimulated(next);
    refreshStatus();
  }

  const totalOutbox = pendingCount + conflictCount + failedCount;

  return (
    <div
      role="region"
      aria-label="Field synchronization and connectivity status"
      className="bg-[var(--navy)]/80 backdrop-blur border border-[var(--navy-line)] rounded-2xl p-4 shadow-sm space-y-3"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Status Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Connectivity Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              simulated
                ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                : online
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-400'
                : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
            }`}
            aria-label={
              simulated
                ? 'Simulated Field Disconnect: testing offline mode'
                : online
                ? 'Live Connected: Uplink to Headquarters active'
                : 'Field Offline: Cellular/Wi-Fi down; local storage active'
            }
          >
            {simulated ? (
              <>
                <WifiOff size={14} className="text-amber-400" aria-hidden="true" />
                <span className="font-mono text-[10px] opacity-75 uppercase" aria-hidden="true">[SIMULATED]</span>
                <span>Field Disconnect</span>
              </>
            ) : online ? (
              <>
                <Wifi size={14} className="text-emerald-400" aria-hidden="true" />
                <span className="font-mono text-[10px] opacity-75 uppercase" aria-hidden="true">[LIVE]</span>
                <span>HQ Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-rose-400" aria-hidden="true" />
                <span className="font-mono text-[10px] opacity-75 uppercase" aria-hidden="true">[OFFLINE]</span>
                <span>Local Caching Active</span>
              </>
            )}
          </span>

          {/* Sync Health / Queue Status */}
          {conflictCount > 0 ? (
            <button
              onClick={() => {
                const firstConflict = getSyncQueue().find((i) => i.status === 'conflict');
                if (firstConflict) onOpenConflict?.(firstConflict);
              }}
              aria-label={`${conflictCount} Sync Conflicts detected: click to review and reconcile`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 border border-rose-500 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
            >
              <AlertTriangle size={14} className="text-rose-400 animate-pulse" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase font-bold" aria-hidden="true">[CONFLICT]</span>
              <span>{conflictCount} Conflict{conflictCount > 1 ? 's' : ''} (Review)</span>
            </button>
          ) : failedCount > 0 ? (
            <button
              onClick={onOpenOutbox}
              aria-label={`${failedCount} Push Failed: click Outbox to retry transmission`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 border border-amber-500 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
            >
              <AlertTriangle size={14} className="text-amber-400" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase font-bold" aria-hidden="true">[FAILED]</span>
              <span>{failedCount} Push Failed (Retry)</span>
            </button>
          ) : pendingCount > 0 ? (
            <button
              onClick={onOpenOutbox}
              aria-label={`${pendingCount} Updates Queued locally: click Outbox to review pending items`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--saffron)]/15 border border-[var(--saffron)] text-[var(--saffron)] hover:bg-[var(--saffron)]/25 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase font-bold" aria-hidden="true">[LOCAL ONLY]</span>
              <span>{pendingCount} Queued in Outbox</span>
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-[var(--navy-line)] text-[var(--mist)]"
              aria-label="All Field Updates Synced: Confirmed on Headquarters server"
            >
              <CheckCircle2 size={14} className="text-emerald-400" aria-hidden="true" />
              <span className="font-mono text-[10px] opacity-75 uppercase" aria-hidden="true">[HQ SYNCED]</span>
              <span>All Field Updates Synced</span>
            </span>
          )}

          {lastSyncTime && (
            <span className="text-[11px] text-[var(--mist)]/70 hidden lg:inline">
              Last synced at {lastSyncTime}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          {/* Simulated Offline Toggle for Testing */}
          <button
            onClick={handleToggleSimulatedOffline}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
              simulated
                ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                : 'border-[var(--navy-line)] text-[var(--mist)] hover:text-white hover:border-[var(--mist)]'
            }`}
            title="Toggle simulated network disconnection to test field offline reliability"
          >
            {simulated ? 'Resume Online' : 'Simulate Offline'}
          </button>

          {/* Outbox Drawer Button */}
          <button
            onClick={onOpenOutbox}
            aria-label={`View Field Outbox with ${totalOutbox} items`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] transition-colors cursor-pointer"
          >
            <Inbox size={14} className="text-[var(--saffron)]" aria-hidden="true" />
            <span>Outbox</span>
            {totalOutbox > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[var(--saffron)] text-[var(--ink)]">
                {totalOutbox}
              </span>
            )}
          </button>

          {/* Sync Now Button */}
          <button
            onClick={handleManualSync}
            disabled={!online || syncing || pendingCount === 0}
            className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-semibold bg-[var(--saffron)] text-[var(--ink)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{syncing ? 'Syncing…' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Truth-in-State Operational Callout Banner */}
      {conflictCount > 0 ? (
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/60 text-xs text-rose-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" aria-hidden="true" />
            <span>
              <strong>Version Conflict Detected:</strong> {conflictCount} field update{conflictCount > 1 ? 's diverge' : ' diverges'} from Headquarters records. Local changes have <strong>not</strong> been confirmed by HQ.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const firstConflict = getSyncQueue().find((i) => i.status === 'conflict');
              if (firstConflict) onOpenConflict?.(firstConflict);
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors shrink-0 text-xs cursor-pointer shadow-sm"
          >
            Review Conflicts
          </button>
        </div>
      ) : pendingCount > 0 ? (
        <div
          role="status"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-950/40 border border-amber-500/60 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              <strong>Saved locally on this device only:</strong> {pendingCount} update{pendingCount > 1 ? 's have' : ' has'} <strong>not</strong> reached Headquarters yet. Data is encrypted in local device storage and will upload once confirmed.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenOutbox}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/60 font-semibold rounded-lg transition-colors shrink-0 text-xs cursor-pointer"
          >
            Review Queued Updates
          </button>
        </div>
      ) : !online || simulated ? (
        <div
          role="status"
          className="p-2.5 rounded-xl bg-slate-900/60 border border-[var(--navy-line)] text-xs text-[var(--mist)] flex items-center gap-2"
        >
          <WifiOff size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
          <span>
            <strong>Field Offline Mode:</strong> Cellular/network unreachable. Any edits or new incidents will be saved locally on this device only and will not reach Headquarters until reconnected.
          </span>
        </div>
      ) : null}
    </div>
  );
}
