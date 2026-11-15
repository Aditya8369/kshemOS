/*
 * Local-data retention policy for field devices.
 *
 * Synced history is capped and expired; unsynced drafts survive until they
 * sync, are discarded, or the session is revoked. See docs/offline-sync.md.
 */

export const SYNCED_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SYNCED_HISTORY_LIMIT = 30;

/* Plaintext keys that must never survive logout or device revocation. */
export const OFFLINE_DATA_KEYS = [
  'kshemos.sync_queue.v1',
  'kshemos.sync_history.v1',
  'kshemos.simulated_offline.v1',
  'kshemos.cache.incidents.v2',
  'kshemos.incidents.v1',
  'kshemos.staffing.v1',
];

export function applyHistoryRetention(history, now = Date.now()) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((entry) => {
      if (!entry || entry.status !== 'synced') return false;
      const syncedAt = Number(entry.syncedAt || entry.queuedAt || 0);
      return now - syncedAt <= SYNCED_HISTORY_TTL_MS;
    })
    .slice(0, SYNCED_HISTORY_LIMIT);
}

export function describePurge(reason) {
  const labels = {
    logout: 'Signed out — local field drafts were removed from this device.',
    session_revoked:
      'Device session revoked — unsynced field drafts were removed from this device.',
    device_revoked:
      'Device access revoked — local field drafts were removed from this device.',
    manual: 'Local field draft data was removed from this device.',
  };

  return labels[reason] || labels.manual;
}
