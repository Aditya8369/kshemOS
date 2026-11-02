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
    <div className="bg-[var(--navy)]/80 backdrop-blur border border-[var(--navy-line)] rounded-2xl p-4 shadow-sm">
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
          >
            {simulated ? (
              <>
                <WifiOff size={14} className="text-amber-400" />
                <span>Simulated Field Disconnect</span>
              </>
            ) : online ? (
              <>
                <Wifi size={14} className="text-emerald-400" />
                <span>Live Connected · HQ Sync</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-rose-400" />
                <span>Field Offline · Local Caching Active</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 border border-rose-500 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
            >
              <AlertTriangle size={14} className="text-rose-400 animate-pulse" />
              <span>{conflictCount} Sync Conflict{conflictCount > 1 ? 's' : ''} (Review)</span>
            </button>
          ) : failedCount > 0 ? (
            <button
              onClick={onOpenOutbox}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 border border-amber-500 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              <AlertTriangle size={14} className="text-amber-400" />
              <span>{failedCount} Push Failed (Retry)</span>
            </button>
          ) : pendingCount > 0 ? (
            <button
              onClick={onOpenOutbox}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--saffron)]/15 border border-[var(--saffron)] text-[var(--saffron)] hover:bg-[var(--saffron)]/25 transition-colors"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{pendingCount} Update{pendingCount > 1 ? 's' : ''} Queued in Outbox</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-[var(--navy-line)] text-[var(--mist)]">
              <CheckCircle2 size={14} className="text-emerald-400" />
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
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[var(--navy-line)] text-white hover:border-[var(--saffron)] transition-colors"
          >
            <Inbox size={14} className="text-[var(--saffron)]" />
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
            className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-semibold bg-[var(--saffron)] text-[var(--ink)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing…' : 'Sync Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
