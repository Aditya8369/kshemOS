/*

 * Mobile offline sync queue for field units.

 *

 * Responders in the field may lose connectivity at any time. This queue:

 * - Persists field incident drafts locally, encrypted at rest.

 * - Gives every queued change a stable operation ID and client timestamp.

 * - Orders operations by authoring time and chains expected versions so a

 *   later offline edit never conflicts with an earlier one from the same unit.

 * - Synchronises through the batch endpoint, which makes retries idempotent.

 * - Detects version conflicts and captures remote state for manual resolution.

 * - Retains a capped audit trail of synced operations for responder confidence.

 */



import { detectFieldConflicts } from './incidentDashboard.js';

import {
  getCachedJson,
  loadJson,
  purgeSecureDrafts,
  removeCached,
  saveJson,
} from './secureDraftStore.js';
import {
  OFFLINE_DATA_KEYS,
  applyHistoryRetention,
  describePurge,
} from './offlineDataPolicy.js';

export const SYNC_QUEUE_KEY = 'kshemos.sync_queue.v1';

export const SYNC_HISTORY_KEY = 'kshemos.sync_history.v1';

export const SIMULATED_OFFLINE_KEY = 'kshemos.simulated_offline.v1';

export const SYNC_STATUS_CHANGED_EVENT = 'kshemos:sync-status-changed';

export const LOCAL_INCIDENT_PREFIX = 'INC-PENDING-';

/* Other draft-bearing records that must live in encrypted storage too. */
export const ENCRYPTED_DRAFT_KEYS = [
  SYNC_QUEUE_KEY,
  SYNC_HISTORY_KEY,
  'kshemos.cache.incidents.v2',
  'kshemos.incidents.v1',
  'kshemos.staffing.v1',
];



const BASE_URL = import.meta.env?.VITE_API_URL || '';



const legacyMemory = new Map();

const legacyFallback = {
  getItem: (k) => legacyMemory.get(k) ?? null,
  setItem: (k, v) => legacyMemory.set(k, String(v)),
  removeItem: (k) => legacyMemory.delete(k),
  clear: () => legacyMemory.clear(),
};

let injectedStorage = null;

let simulatedOffline = false;

let isSyncing = false;

let hydrationPromise = null;



/* ------------------------------------------------------------------ */
/* Storage (injected for tests; encrypted IndexedDB in the browser)    */
/* ------------------------------------------------------------------ */

export function setSyncStorage(custom) {
  injectedStorage = custom;
}

function legacyStore() {
  if (injectedStorage) return injectedStorage;

  try {
    if (
      typeof globalThis.localStorage?.getItem === 'function' &&
      typeof globalThis.localStorage?.setItem === 'function'
    ) {
      return globalThis.localStorage;
    }
  } catch {
    // fall through
  }

  return legacyFallback;
}

function readJsonFromLegacy(key, fallback) {
  try {
    const raw = legacyStore()?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonToLegacy(key, value) {
  try {
    legacyStore()?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write issues (private mode, quota)
  }
}

async function migrateLegacyPlaintext() {
  if (injectedStorage) return;

  try {
    const legacy = globalThis.localStorage;
    if (!legacy) return;

    for (const key of ENCRYPTED_DRAFT_KEYS) {
      const raw = legacy.getItem(key);
      if (!raw) continue;

      const alreadySecure = await loadJson(key, null);
      if (alreadySecure === null) {
        const parsed = JSON.parse(raw);
        await saveJson(key, parsed);
      }

      // Remove the plaintext copy once the encrypted copy exists.
      legacy.removeItem(key);
    }
  } catch {
    // A malformed legacy payload must not block app start.
  }
}

/**
 * Load encrypted drafts into the synchronous cache. Call before first render.
 */
export function hydrateSyncQueue() {
  if (injectedStorage) return Promise.resolve();

  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      await migrateLegacyPlaintext();

      await loadJson(SYNC_QUEUE_KEY, []);
      const history = await loadJson(SYNC_HISTORY_KEY, []);
      const trimmed = applyHistoryRetention(history);
      if (!Array.isArray(history) || trimmed.length !== history.length) {
        await saveJson(SYNC_HISTORY_KEY, trimmed);
      }

      // Hydrate the cached feed and local fallback records so the first render
      // can read them synchronously from the encrypted cache.
      await loadJson('kshemos.cache.incidents.v2', null);
      await loadJson('kshemos.incidents.v1', []);
      await loadJson('kshemos.staffing.v1', []);

      try {
        simulatedOffline =
          globalThis.localStorage?.getItem(SIMULATED_OFFLINE_KEY) === 'true';
      } catch {
        simulatedOffline = false;
      }
    })();
  }

  return hydrationPromise;
}

function readQueue() {
  if (injectedStorage) return readJsonFromLegacy(SYNC_QUEUE_KEY, []);
  return getCachedJson(SYNC_QUEUE_KEY, []);
}

function writeQueue(queue) {
  if (injectedStorage) {
    writeJsonToLegacy(SYNC_QUEUE_KEY, queue);
  } else {
    saveJson(SYNC_QUEUE_KEY, queue);
  }

  emitSyncChange();
}

function readHistory() {
  if (injectedStorage) return readJsonFromLegacy(SYNC_HISTORY_KEY, []);
  return getCachedJson(SYNC_HISTORY_KEY, []);
}

function writeHistory(history) {
  const retained = applyHistoryRetention(history);

  if (injectedStorage) {
    writeJsonToLegacy(SYNC_HISTORY_KEY, retained);
  } else {
    saveJson(SYNC_HISTORY_KEY, retained);
  }

  emitSyncChange();
}



/* ------------------------------------------------------------------ */
/* Connectivity                                                        */
/* ------------------------------------------------------------------ */

export function isSimulatedOffline() {
  return simulatedOffline;
}

export function setSimulatedOffline(value) {
  simulatedOffline = Boolean(value);

  try {
    if (simulatedOffline) {
      legacyStore()?.setItem(SIMULATED_OFFLINE_KEY, 'true');
    } else {
      legacyStore()?.removeItem(SIMULATED_OFFLINE_KEY);
    }
  } catch {
    // Ignore storage errors in test or private mode
  }

  emitSyncChange();

  if (!simulatedOffline && isOnline()) {
    processSyncQueue();
  }
}

export function isOnline() {
  if (simulatedOffline) return false;

  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }

  return true;
}

export function emitSyncChange() {
  if (typeof globalThis.dispatchEvent === 'function' && typeof Event === 'function') {
    globalThis.dispatchEvent(new Event(SYNC_STATUS_CHANGED_EVENT));
  }
}



/* ------------------------------------------------------------------ */
/* Queue reads                                                         */
/* ------------------------------------------------------------------ */

export function getSyncQueue() {
  const queue = readQueue();
  return Array.isArray(queue) ? queue : [];
}

export function getSyncHistory() {
  const history = readHistory();
  return Array.isArray(history) ? history : [];
}

export function getPendingCount() {
  return getSyncQueue().filter((item) => item.status === 'pending' || item.status === 'syncing').length;
}

export function getConflictCount() {
  return getSyncQueue().filter((item) => item.status === 'conflict').length;
}

export function getFailedCount() {
  return getSyncQueue().filter((item) => item.status === 'failed').length;
}

export function localIncidentIdFor(queueId) {
  return `${LOCAL_INCIDENT_PREFIX}${String(queueId).slice(-8)}`;
}



/* ------------------------------------------------------------------ */
/* Enqueue                                                             */
/* ------------------------------------------------------------------ */

export function createOperationId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // fall through to a non-crypto identifier
  }

  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextQueueId() {
  return `Q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

let lastQueuedAt = 0;

/**
 * Monotonic local timestamp: two edits queued in the same millisecond still
 * retain their authoring order.
 */
function nextQueuedAt() {
  const now = Date.now();
  lastQueuedAt = now > lastQueuedAt ? now : lastQueuedAt + 1;
  return lastQueuedAt;
}

export function enqueueUpdate({ incidentId, changes, baseIncident, operationId = null }) {
  const queue = getSyncQueue();
  const queueId = nextQueueId();
  const queuedAt = nextQueuedAt();

  const newItem = {
    queueId,
    operationId: operationId || createOperationId(),
    action: 'update',
    incidentId,
    changes,
    baseVersion: baseIncident?.version ?? 1,
    baseSnapshot: baseIncident || null,
    status: 'pending',
    queuedAt,
    clientTimestamp: queuedAt,
    retryCount: 0,
    error: null,
    serverConflictData: null,
    force: false,
  };

  writeQueue([...queue, newItem]);

  return newItem;
}

export function enqueueCreate({ input, operationId = null }) {
  const queue = getSyncQueue();
  const queueId = nextQueueId();
  const queuedAt = nextQueuedAt();

  const newItem = {
    queueId,
    operationId: operationId || createOperationId(),
    action: 'create',
    incidentId: null,
    localIncidentId: localIncidentIdFor(queueId),
    input,
    status: 'pending',
    queuedAt,
    clientTimestamp: queuedAt,
    retryCount: 0,
    error: null,
    serverConflictData: null,
    force: false,
  };

  writeQueue([...queue, newItem]);

  return newItem;
}

export function discardQueueItem(queueId) {
  const queue = getSyncQueue();
  writeQueue(queue.filter((i) => i.queueId !== queueId));
}

export function retryQueueItem(queueId) {
  const queue = getSyncQueue();

  const updated = queue.map((item) => {
    if (item.queueId === queueId) {
      return { ...item, status: 'pending', error: null };
    }

    return item;
  });

  writeQueue(updated);

  if (isOnline()) {
    return processSyncQueue();
  }

  return Promise.resolve({ synced: 0, conflicts: 0, failed: 0, offline: true });
}

export function clearSyncHistory() {
  writeHistory([]);
}



/* ------------------------------------------------------------------ */
/* Conflict resolution                                                 */
/* ------------------------------------------------------------------ */

function replaceItem(queue, queueId, mutate) {
  return queue.map((item) => (item.queueId === queueId ? mutate(item) : item));
}

/**
 * Resolve a sync conflict for an item in the queue.
 *
 * @param {string} queueId
 * @param {'keep_mine' | 'keep_server' | 'merge'} resolution
 * @param {object} customChanges - for merge or modified changes
 */
export async function resolveConflict(queueId, resolution, customChanges = null) {
  const queue = getSyncQueue();
  const item = queue.find((i) => i.queueId === queueId);

  if (!item) throw new Error('Queue item not found');

  if (resolution === 'keep_server') {
    writeQueue(queue.filter((i) => i.queueId !== queueId));
    return { resolved: true, action: 'discarded_local' };
  }

  // A forced retry is a new logical operation: reusing the conflicting
  // operation ID would replay the cached conflict result forever.
  const forced = {
    status: 'pending',
    force: true,
    operationId: createOperationId(),
    error: null,
    retryCount: 0,
    serverConflictData: null,
  };

  if (resolution === 'keep_mine') {
    writeQueue(replaceItem(queue, queueId, (current) => ({ ...current, ...forced })));
  } else if (resolution === 'merge') {
    writeQueue(
      replaceItem(queue, queueId, (current) => ({
        ...current,
        ...forced,
        changes: { ...current.changes, ...(customChanges || {}) },
      })),
    );
  } else {
    throw new Error(`Unknown conflict resolution: ${resolution}`);
  }

  return processSyncQueue({ force: true, targetQueueId: queueId });
}



/* ------------------------------------------------------------------ */
/* Batch sync                                                          */
/* ------------------------------------------------------------------ */

function ensureOperationIds() {
  let changed = false;

  const queue = getSyncQueue().map((item) => {
    if (item.operationId) return item;

    changed = true;
    return {
      ...item,
      operationId: createOperationId(),
      clientTimestamp: item.clientTimestamp ?? item.queuedAt ?? Date.now(),
    };
  });

  if (changed) writeQueue(queue);

  return queue;
}

/**
 * Chain expected versions per incident so consecutive offline edits apply
 * without conflicting with each other.
 */
function buildSyncItems(items) {
  const nextVersion = new Map();

  return items.map((item) => {
    if (item.action === 'create') {
      return {
        queue_id: item.queueId,
        operation_id: item.operationId,
        action: 'create',
        local_incident_id: item.localIncidentId || localIncidentIdFor(item.queueId),
        create_payload: {
          ...item.input,
          operation_id: item.operationId,
        },
        client_timestamp: item.clientTimestamp ?? item.queuedAt,
        force: false,
      };
    }

    const base = Number(item.baseVersion) || 1;
    let expectedVersion;

    if (!item.force) {
      const chained = nextVersion.get(item.incidentId);
      expectedVersion = chained === undefined ? base : Math.max(base, chained);
      nextVersion.set(item.incidentId, expectedVersion + 1);
    }

    return {
      queue_id: item.queueId,
      operation_id: item.operationId,
      action: 'update',
      incident_id: item.incidentId,
      changes: {
        ...item.changes,
        operation_id: item.operationId,
      },
      expected_version: expectedVersion,
      client_timestamp: item.clientTimestamp ?? item.queuedAt,
      force: Boolean(item.force),
    };
  });
}

function markItems(selected, mutate) {
  const ids = new Set(selected.map((item) => item.queueId));
  const queue = getSyncQueue().map((item) =>
    ids.has(item.queueId) ? { ...item, ...mutate(item) } : item,
  );

  writeQueue(queue);
}

function remapLocalIds(localIncidentId, serverIncidentId) {
  if (!localIncidentId || !serverIncidentId) return;

  const queue = getSyncQueue().map((item) => {
    if (item.incidentId !== localIncidentId) return item;

    return { ...item, incidentId: serverIncidentId };
  });

  writeQueue(queue);
}

export async function processSyncQueue({ force = false, targetQueueId = null } = {}) {
  if (!isOnline()) {
    return { synced: 0, conflicts: 0, failed: 0, offline: true };
  }

  if (isSyncing) {
    return { syncing: true };
  }

  isSyncing = true;
  emitSyncChange();

  try {
    ensureOperationIds();

    const queue = getSyncQueue();

    const itemsToProcess = queue
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (targetQueueId) return item.queueId === targetQueueId;
        if (item.status === 'conflict') return false; // Requires explicit user resolution
        if (item.status === 'failed' && !force) return false;
        return item.status !== 'syncing';
      })
      .sort((a, b) => {
        const aTime = a.item.clientTimestamp ?? a.item.queuedAt ?? 0;
        const bTime = b.item.clientTimestamp ?? b.item.queuedAt ?? 0;
        return aTime - bTime || a.index - b.index;
      })
      .map(({ item }) => item);

    if (itemsToProcess.length === 0) {
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    const payload = { items: buildSyncItems(itemsToProcess) };

    let response;

    try {
      response = await fetch(`${BASE_URL}/api/incidents/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      markItems(itemsToProcess, (item) => ({
        status: 'pending',
        retryCount: (item.retryCount || 0) + 1,
        error: networkError.message || 'Network disconnected during sync',
      }));

      return { synced: 0, conflicts: 0, failed: itemsToProcess.length };
    }

    if (response.status === 401) {
      await clearOfflineData('session_revoked');
      return { synced: 0, conflicts: 0, failed: 0, revoked: true };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message =
        typeof body.detail === 'string'
          ? body.detail
          : `Sync failed with status ${response.status}`;

      markItems(itemsToProcess, (item) => ({
        status: 'failed',
        retryCount: (item.retryCount || 0) + 1,
        error: message,
      }));

      return { synced: 0, conflicts: 0, failed: itemsToProcess.length };
    }

    const body = await response.json();
    const results = Array.isArray(body.results) ? body.results : [];
    const byQueueId = new Map(results.map((result) => [result.queue_id, result]));

    const historyEntries = [];
    const counts = { synced: 0, conflicts: 0, failed: 0, replayed: 0 };

    for (const item of itemsToProcess) {
      const result = byQueueId.get(item.queueId);

      if (!result) {
        counts.failed += 1;
        updateQueueItem(item.queueId, (current) => ({
          ...current,
          status: 'failed',
          retryCount: (current.retryCount || 0) + 1,
          error: 'Server returned no result for this queued change',
        }));
        continue;
      }

      if (result.status === 'applied') {
        counts.synced += 1;
        if (result.replayed) counts.replayed += 1;

        if (item.action === 'create') {
          const localId =
            item.localIncidentId || localIncidentIdFor(item.queueId);
          remapLocalIds(localId, result.incident?.id);
        }

        historyEntries.push({
          ...item,
          status: 'synced',
          syncedAt: Date.now(),
          confirmedIncident: result.incident,
          replayed: Boolean(result.replayed),
        });

        deleteQueueItem(item.queueId);
      } else if (result.status === 'conflict') {
        counts.conflicts += 1;

        const serverIncident = result.server_incident || {};
        const conflictingFields =
          result.conflicting_fields ||
          Object.keys(
            detectFieldConflicts(item.changes || {}, serverIncident, item.baseSnapshot),
          );

        updateQueueItem(item.queueId, (current) => ({
          ...current,
          status: 'conflict',
          serverConflictData: {
            serverIncident,
            conflictingFields,
            message:
              result.error ||
              'Server incident was modified by another officer',
          },
        }));
      } else {
        counts.failed += 1;

        updateQueueItem(item.queueId, (current) => ({
          ...current,
          status: 'failed',
          retryCount: (current.retryCount || 0) + 1,
          error: result.error || 'Server rejected the update',
        }));
      }
    }

    if (historyEntries.length > 0) {
      writeHistory([...historyEntries].reverse().concat(getSyncHistory()));
    }

    return counts;
  } finally {
    isSyncing = false;
    emitSyncChange();
  }
}

function deleteQueueItem(queueId) {
  writeQueue(getSyncQueue().filter((item) => item.queueId !== queueId));
}

function updateQueueItem(queueId, mutate) {
  writeQueue(
    getSyncQueue().map((item) => (item.queueId === queueId ? mutate(item) : item)),
  );
}



export function markQueueItemConflict(
  queueId,
  { serverIncident = {}, conflictingFields = [], message = null } = {},
) {
  updateQueueItem(queueId, (current) => ({
    ...current,
    status: 'conflict',
    serverConflictData: {
      serverIncident,
      conflictingFields,
      message:
        message || 'Server incident was modified by another officer',
    },
  }));
}



/* ------------------------------------------------------------------ */
/* Local-data cleanup policy                                           */
/* ------------------------------------------------------------------ */

/**
 * Remove all locally stored field data. Call on explicit logout, on a 401
 * from the API (device/session revocation), or from the "wipe device" action.
 * A 403 means the caller lacks permission for this action, not that the
 * session is revoked, so drafts are preserved in that case.
 */
export async function clearOfflineData(reason = 'manual') {
  const queueSize = getSyncQueue().length;
  const historySize = getSyncHistory().length;

  try {
    if (injectedStorage) {
      for (const key of OFFLINE_DATA_KEYS) {
        injectedStorage.removeItem?.(key);
      }
    } else {
      await purgeSecureDrafts();
    }
  } catch {
    // Continue: a partial wipe must still clear what it can.
  }

  for (const key of OFFLINE_DATA_KEYS) {
    removeCached(key);

    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  }

  simulatedOffline = false;

  // Allow a later hydration (for example after signing back in) to reload.
  hydrationPromise = null;

  try {
    legacyStore()?.removeItem(SIMULATED_OFFLINE_KEY);
  } catch {
    // ignore
  }

  emitSyncChange();

  return {
    reason,
    clearedQueue: queueSize,
    clearedHistory: historySize,
    message: describePurge(reason),
  };
}

export async function purgeExpiredLocalData(now = Date.now()) {
  const history = getSyncHistory();
  const trimmed = applyHistoryRetention(history, now);
  const removed = history.length - trimmed.length;

  if (removed > 0) {
    if (injectedStorage) {
      writeJsonToLegacy(SYNC_HISTORY_KEY, trimmed);
    } else {
      saveJson(SYNC_HISTORY_KEY, trimmed);
    }
  }

  return { removed };
}



/* ------------------------------------------------------------------ */
/* Automatic sync on reconnect                                         */
/* ------------------------------------------------------------------ */

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!isSimulatedOffline()) {
      emitSyncChange();
      processSyncQueue();
    }
  });

  window.addEventListener('offline', () => {
    emitSyncChange();
  });
}
