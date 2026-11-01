/*

 * Mobile offline sync queue for field units.

 *

 * Responders in the field may lose connectivity at any time. This queue:

 * - Persists all field status changes, notes, and incident updates locally.

 * - Monitors online/offline connectivity (with optional simulated offline mode for verification).

 * - Automatically synchronizes queued changes when connectivity resumes.

 * - Detects version conflicts with the server and captures remote state for manual resolution.

 * - Retains an audit trail of synced operations for responder confidence.

 */



import { detectFieldConflicts } from './incidentDashboard.js';



export const SYNC_QUEUE_KEY = 'kshemos.sync_queue.v1';

export const SYNC_HISTORY_KEY = 'kshemos.sync_history.v1';

export const SIMULATED_OFFLINE_KEY = 'kshemos.simulated_offline.v1';

export const SYNC_STATUS_CHANGED_EVENT = 'kshemos:sync-status-changed';



const BASE_URL = import.meta.env?.VITE_API_URL || '';



const memoryStore = new Map();

const fallbackStorage = {

  getItem: (k) => memoryStore.get(k) ?? null,

  setItem: (k, v) => memoryStore.set(k, String(v)),

  removeItem: (k) => memoryStore.delete(k),

  clear: () => memoryStore.clear(),

};



let activeStorage = null;



export function setSyncStorage(custom) {

  activeStorage = custom;

}



function safeStorage() {

  if (activeStorage) return activeStorage;

  try {

    if (typeof globalThis.localStorage?.getItem === 'function' && typeof globalThis.localStorage?.setItem === 'function') {

      return globalThis.localStorage;

    }

  } catch {

    // fallback

  }

  return fallbackStorage;

}



let simulatedOffline = false;

try {

  simulatedOffline = safeStorage()?.getItem(SIMULATED_OFFLINE_KEY) === 'true';

} catch {

  simulatedOffline = false;

}



export function isSimulatedOffline() {

  return simulatedOffline;

}



export function setSimulatedOffline(value) {

  simulatedOffline = Boolean(value);

  try {

    if (simulatedOffline) {

      safeStorage()?.setItem(SIMULATED_OFFLINE_KEY, 'true');

    } else {

      safeStorage()?.removeItem(SIMULATED_OFFLINE_KEY);

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



function readStorage(key, fallback = []) {

  try {

    const raw = safeStorage()?.getItem(key);

    return raw ? JSON.parse(raw) : fallback;

  } catch {

    return fallback;

  }

}



function writeStorage(key, value) {

  try {

    safeStorage()?.setItem(key, JSON.stringify(value));

  } catch {

    // Ignore storage write issues

  }

  emitSyncChange();

}



export function getSyncQueue() {

  return readStorage(SYNC_QUEUE_KEY, []);

}



export function getSyncHistory() {

  return readStorage(SYNC_HISTORY_KEY, []);

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



export function enqueueUpdate({ incidentId, changes, baseIncident }) {

  const queue = getSyncQueue();

  const queueId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;



  // If there is already a pending item for this incident, combine or sequence it

  const newItem = {

    queueId,

    action: 'update',

    incidentId,

    changes,

    baseVersion: baseIncident?.version || 1,

    baseSnapshot: baseIncident || null,

    status: 'pending',

    queuedAt: Date.now(),

    retryCount: 0,

    error: null,

    serverConflictData: null,

  };



  writeStorage(SYNC_QUEUE_KEY, [...queue, newItem]);

  return newItem;

}



export function enqueueCreate({ input }) {

  const queue = getSyncQueue();

  const queueId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;



  const newItem = {

    queueId,

    action: 'create',

    incidentId: null,

    input,

    status: 'pending',

    queuedAt: Date.now(),

    retryCount: 0,

    error: null,

    serverConflictData: null,

  };



  writeStorage(SYNC_QUEUE_KEY, [...queue, newItem]);

  return newItem;

}



export function discardQueueItem(queueId) {

  const queue = getSyncQueue();

  writeStorage(SYNC_QUEUE_KEY, queue.filter((i) => i.queueId !== queueId));

}



export function retryQueueItem(queueId) {

  const queue = getSyncQueue();

  const updated = queue.map((item) => {

    if (item.queueId === queueId) {

      return { ...item, status: 'pending', error: null };

    }

    return item;

  });

  writeStorage(SYNC_QUEUE_KEY, updated);

  if (isOnline()) {

    processSyncQueue();

  }

}



export function clearSyncHistory() {

  writeStorage(SYNC_HISTORY_KEY, []);

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

    // Discard local change, accept remote

    writeStorage(SYNC_QUEUE_KEY, queue.filter((i) => i.queueId !== queueId));

    return { resolved: true, action: 'discarded_local' };

  }



  if (resolution === 'keep_mine') {

    // Force push local changes to server

    const updated = queue.map((i) => {

      if (i.queueId === queueId) {

        return { ...i, status: 'pending', force: true, error: null };

      }

      return i;

    });

    writeStorage(SYNC_QUEUE_KEY, updated);

    return processSyncQueue({ force: true, targetQueueId: queueId });

  }



  if (resolution === 'merge') {

    // Apply merged custom changes with force push

    const updated = queue.map((i) => {

      if (i.queueId === queueId) {

        return {

          ...i,

          changes: { ...i.changes, ...(customChanges || {}) },

          status: 'pending',

          force: true,

          error: null,

        };

      }

      return i;

    });

    writeStorage(SYNC_QUEUE_KEY, updated);

    return processSyncQueue({ force: true, targetQueueId: queueId });

  }



  throw new Error(`Unknown conflict resolution: ${resolution}`);

}



let isSyncing = false;



/**

 * Process all pending items in the offline queue and push to backend.

 */

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

    let queue = getSyncQueue();

    const history = getSyncHistory();



    const itemsToProcess = queue.filter((item) => {

      if (targetQueueId) return item.queueId === targetQueueId;

      if (item.status === 'conflict') return false; // Requires explicit user resolution

      if (item.status === 'failed' && !force) return false;

      return true;

    });



    if (itemsToProcess.length === 0) {

      return { synced: 0, conflicts: 0, failed: 0 };

    }



    let syncedCount = 0;

    let conflictCount = 0;

    let failedCount = 0;



    for (const item of itemsToProcess) {

      // Mark as syncing

      queue = queue.map((i) => (i.queueId === item.queueId ? { ...i, status: 'syncing' } : i));

      writeStorage(SYNC_QUEUE_KEY, queue);



      try {

        if (item.action === 'update') {

          const payload = {

            ...item.changes,

            expected_version: item.force ? undefined : item.baseVersion,

            force: item.force || false,

          };



          const res = await fetch(`${BASE_URL}/api/incidents/${encodeURIComponent(item.incidentId)}`, {

            method: 'PATCH',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify(payload),

          });



          if (res.status === 409) {

            // Conflict returned from server

            const body = await res.json();

            const serverIncident = body.detail?.server_incident || body.detail || {};

            const conflictingFields =

              body.detail?.conflicting_fields ||

              Object.keys(detectFieldConflicts(item.changes, serverIncident, item.baseSnapshot));



            queue = queue.map((i) =>

              i.queueId === item.queueId

                ? {

                    ...i,

                    status: 'conflict',

                    serverConflictData: {

                      serverIncident,

                      conflictingFields,

                      message: body.detail?.message || 'Server incident was modified by another officer',

                    },

                  }

                : i

            );

            conflictCount += 1;

            writeStorage(SYNC_QUEUE_KEY, queue);

            continue;

          }



          if (!res.ok) {

            const errBody = await res.json().catch(() => ({}));

            const errMsg = errBody.detail || `Server responded with ${res.status}`;

            queue = queue.map((i) =>

              i.queueId === item.queueId

                ? {

                    ...i,

                    status: 'failed',

                    retryCount: (i.retryCount || 0) + 1,

                    error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),

                  }

                : i

            );

            failedCount += 1;

            writeStorage(SYNC_QUEUE_KEY, queue);

            continue;

          }



          const confirmedIncident = await res.json();



          // Push succeeded: remove from queue and add to sync history

          queue = queue.filter((i) => i.queueId !== item.queueId);

          writeStorage(SYNC_QUEUE_KEY, queue);



          const historyRecord = {

            ...item,

            status: 'synced',

            syncedAt: Date.now(),

            confirmedIncident,

          };

          writeStorage(SYNC_HISTORY_KEY, [historyRecord, ...history].slice(0, 30));

          syncedCount += 1;

        } else if (item.action === 'create') {

          const res = await fetch(`${BASE_URL}/api/incidents`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify(item.input),

          });



          if (!res.ok) {

            const errBody = await res.json().catch(() => ({}));

            queue = queue.map((i) =>

              i.queueId === item.queueId

                ? {

                    ...i,

                    status: 'failed',

                    retryCount: (i.retryCount || 0) + 1,

                    error: errBody.detail || `Server responded with ${res.status}`,

                  }

                : i

            );

            failedCount += 1;

            writeStorage(SYNC_QUEUE_KEY, queue);

            continue;

          }



          const confirmedIncident = await res.json();

          queue = queue.filter((i) => i.queueId !== item.queueId);

          writeStorage(SYNC_QUEUE_KEY, queue);



          const historyRecord = {

            ...item,

            status: 'synced',

            syncedAt: Date.now(),

            confirmedIncident,

          };

          writeStorage(SYNC_HISTORY_KEY, [historyRecord, ...history].slice(0, 30));

          syncedCount += 1;

        }

      } catch (networkError) {

        // Network drop during push: leave as pending for retry

        queue = queue.map((i) =>

          i.queueId === item.queueId

            ? {

                ...i,

                status: 'pending',

                retryCount: (i.retryCount || 0) + 1,

                error: networkError.message || 'Network disconnected during sync',

              }

            : i

        );

        failedCount += 1;

        writeStorage(SYNC_QUEUE_KEY, queue);

      }

    }



    return { synced: syncedCount, conflicts: conflictCount, failed: failedCount };

  } finally {

    isSyncing = false;

    emitSyncChange();

  }

}



// Auto-sync listener when browser reconnects to network

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

