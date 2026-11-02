import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Inbox,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  clearSyncHistory,
  discardQueueItem,
  getSyncHistory,
  getSyncQueue,
  isOnline,
  processSyncQueue,
  retryQueueItem,
  INCIDENTS_CHANGED_EVENT,
} from '../../api';
import { STATUS_LABEL } from './display';

export default function SyncQueueDrawer({ isOpen, onClose, onResolveConflict }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState(() => getSyncQueue());
  const [history, setHistory] = useState(() => getSyncHistory());
  const [syncing, setSyncing] = useState(false);

  function refresh() {
    setQueue(getSyncQueue());
    setHistory(getSyncHistory());
  }

  async function handleSyncAll() {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      await processSyncQueue();
      refresh();
      globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));
    } finally {
      setSyncing(false);
    }
  }

  function handleRetry(queueId) {
    retryQueueItem(queueId);
    refresh();
    globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));
  }

  function handleDiscard(queueId) {
    discardQueueItem(queueId);
    refresh();
    globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));
  }

  function handleClearHistory() {
    clearSyncHistory();
    refresh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outbox-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[var(--navy)] border-l border-[var(--navy-line)] w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between text-white overflow-hidden">
        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
            <div className="flex items-center gap-2">
              <Inbox size={20} className="text-[var(--saffron)]" />
              <div>
                <h2 id="outbox-drawer-title" className="font-display font-semibold text-lg">
                  Field Outbox & Sync Center
                </h2>
                <div className="text-xs text-[var(--mist)]">Reliable offline queue for field operations</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[var(--mist)] hover:text-white hover:bg-[var(--navy-line)]"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold'
                  : 'bg-[var(--ink)] border-[var(--navy-line)] text-[var(--mist)] hover:text-white'
              }`}
            >
              <Inbox size={14} />
              <span>Pending Queue ({queue.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold'
                  : 'bg-[var(--ink)] border-[var(--navy-line)] text-[var(--mist)] hover:text-white'
              }`}
            >
              <History size={14} />
              <span>Sync Audit Log ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {activeTab === 'queue' ? (
            queue.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--mist)] space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400 opacity-80" />
                <div>Outbox is empty.</div>
                <div className="text-xs text-[var(--mist)]/70">
                  All status updates and notes are verified and synced with Command Center.
                </div>
              </div>
            ) : (
              queue.map((item) => (
                <div
                  key={item.queueId}
                  className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-2xl p-4 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-white">
                      {item.action === 'create' ? 'New Field Incident' : `Update · ${item.incidentId}`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold flex items-center gap-1 ${
                        item.status === 'conflict'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500'
                          : item.status === 'failed'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500'
                          : item.status === 'syncing'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                      }`}
                    >
                      {item.status === 'syncing' && <RefreshCw size={10} className="animate-spin" />}
                      {item.status === 'conflict' && <AlertTriangle size={10} />}
                      {item.status === 'pending' && <Clock size={10} />}
                      {item.status}
                    </span>
                  </div>

                  {/* Changes Summary */}
                  <div className="space-y-1 bg-[var(--navy)]/60 p-2.5 rounded-xl text-[11px] text-[var(--mist)]">
                    {item.changes?.status && (
                      <div>
                        Status: <span className="text-white font-medium capitalize">{STATUS_LABEL[item.changes.status] || item.changes.status}</span>
                      </div>
                    )}
                    {item.changes?.severity && (
                      <div>
                        Severity: <span className="text-white font-medium capitalize">{item.changes.severity}</span>
                      </div>
                    )}
                    {item.changes?.assigned_to != null && (
                      <div>
                        Assignee: <span className="text-white font-mono">{item.changes.assigned_to || '(Unassigned)'}</span>
                      </div>
                    )}
                    {item.changes?.notes && (
                      <div>
                        Note: <span className="text-white italic">"{item.changes.notes}"</span>
                      </div>
                    )}
                    {item.input?.description && (
                      <div className="line-clamp-2">
                        Description: <span className="text-white">{item.input.description}</span>
                      </div>
                    )}
                  </div>

                  {item.error && (
                    <div className="p-2 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-[11px]">
                      {item.error}
                    </div>
                  )}

                  {/* Item Actions */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-[var(--mist)] font-mono text-[10px]">
                      Queued {new Date(item.queuedAt).toLocaleTimeString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {item.status === 'conflict' ? (
                        <button
                          onClick={() => {
                            onClose();
                            onResolveConflict(item);
                          }}
                          className="px-2.5 py-1 bg-rose-500 text-white font-semibold rounded-lg hover:bg-rose-600 transition-colors"
                        >
                          Resolve Conflict
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRetry(item.queueId)}
                          className="px-2.5 py-1 bg-[var(--navy-line)] text-white hover:text-[var(--saffron)] rounded-lg transition-colors"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDiscard(item.queueId)}
                        className="p-1 text-[var(--mist)] hover:text-rose-400 transition-colors"
                        title="Discard this change"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            history.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--mist)]">
                No sync history recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-[11px] text-[var(--mist)]">Recent successful pushes</span>
                  <button
                    onClick={handleClearHistory}
                    className="text-[11px] text-[var(--mist)] hover:text-white underline"
                  >
                    Clear log
                  </button>
                </div>
                {history.map((record, index) => (
                  <div
                    key={index}
                    className="bg-[var(--ink)] border border-emerald-900/40 rounded-xl p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {record.incidentId || record.confirmedIncident?.id || 'Report Intake'}
                      </span>
                      <span className="text-[10px] text-[var(--mist)] font-mono">
                        {new Date(record.syncedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--mist)]">
                      {record.changes?.status && `Status: ${STATUS_LABEL[record.changes.status] || record.changes.status} · `}
                      {record.changes?.assigned_to && `Assigned: ${record.changes.assigned_to} · `}
                      Confirmed on HQ server (v{record.confirmedIncident?.version || 1})
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Bottom Drawer Bar */}
        <div className="pt-3 border-t border-[var(--navy-line)] flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--mist)]">
            {isOnline() ? '🟢 HQ Backend reachable' : '🟡 Field offline mode'}
          </div>
          {activeTab === 'queue' && queue.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={!isOnline() || syncing}
              className="px-4 py-2 bg-[var(--saffron)] text-[var(--ink)] font-semibold text-xs rounded-full hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing Outbox…' : 'Sync All Pending'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
