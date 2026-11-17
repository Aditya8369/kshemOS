/*

 * Live incident feed & offline synchronization store for field units.

 *

 * Responders in the field may lose connectivity at any time. This store:

 * 1. Automatically caches the incident feed in encrypted local storage (`kshemos.cache.incidents.v2`).

 * 2. When offline, serves the cached snapshot with queued local changes merged optimistically.

 * 3. Enqueues field updates (status changes, triage, notes, assignments) into the Outbox.

 * 4. Pushes changes automatically once connectivity resumes, handling version conflicts clearly.

 */

import { analyzeScamTranscript } from './ruleEngine.js';

import {

  applyIncidentUpdate,

  createIncident,

  defaultStaffing,

  REGIONS,

} from './incidentDashboard.js';

import {

  enqueueCreate,

  enqueueUpdate,

  clearOfflineData,

  createOperationId,

  getSyncQueue,

  hydrateSyncQueue,

  isOnline,

  localIncidentIdFor,

  markQueueItemConflict,

  processSyncQueue,

} from './syncQueue.js';

import { getCachedJson, saveJson } from './secureDraftStore.js';

const BASE_URL = import.meta.env?.VITE_API_URL || '';

const INCIDENTS_KEY = 'kshemos.incidents.v1';

const STAFFING_KEY = 'kshemos.staffing.v1';

const CACHE_KEY = 'kshemos.cache.incidents.v2';

export const INCIDENTS_CHANGED_EVENT = 'kshemos:incidents-changed';

const BACKEND_RETRY_MS = 15 * 1000;

let backendDownUntil = 0;

async function backendRequest(path, options = {}) {

  const res = await fetch(`${BASE_URL}${path}`, {

    ...options,

    headers: { 'Content-Type': 'application/json', ...options.headers },

  });

  if (res.status === 401) {
    // Device/session revoked: local drafts must not outlive the session.
    await clearOfflineData('session_revoked');
  }

  if (!(res.headers.get('content-type') || '').includes('application/json')) {

    throw Object.assign(new Error('Incident backend is not available'), { unavailable: true });

  }

  const body = await res.json();

  if (!res.ok) {

    const message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body);

    throw Object.assign(new Error(message), { status: res.status, detail: body.detail || body });

  }

  return body;

}

const UNAVAILABLE_STATUSES = [404, 502, 503, 504];

function isUnavailable(error) {

  return error?.unavailable || error instanceof TypeError || UNAVAILABLE_STATUSES.includes(error?.status);

}

function readCache(storage = null) {

  if (storage) {

    try {

      const raw = storage.getItem(CACHE_KEY);

      return raw ? JSON.parse(raw) : null;

    } catch {

      return null;

    }

  }

  return getCachedJson(CACHE_KEY, null);

}

function writeCache(feed, storage = null) {

  if (storage) {

    try {

      storage.setItem(CACHE_KEY, JSON.stringify(feed));

    } catch {

      // Ignore storage issues in test/private mode

    }

    return;

  }

  saveJson(CACHE_KEY, feed);

}

/**

 * Merge the persistent sync queue onto incidents so field responders see their

 * queued changes optimistically, with clear sync indicators.

 */

export function overlaySyncQueue(baseIncidents = [], queue = getSyncQueue()) {

  const incidentMap = new Map(baseIncidents.map((i) => [i.id, { ...i, _syncStatus: 'synced' }]));

  for (const item of queue) {

    if (item.action === 'update' && item.incidentId) {

      const existing = incidentMap.get(item.incidentId);

      if (existing) {

        const merged = applyIncidentUpdate(existing, item.changes, item.queuedAt || Date.now());

        merged._syncStatus = item.status;

        merged._queueId = item.queueId;

        merged._serverConflictData = item.serverConflictData || null;

        merged._syncError = item.error || null;

        incidentMap.set(item.incidentId, merged);

      }

    } else if (item.action === 'create' && item.input) {

      const tempId = item.localIncidentId || localIncidentIdFor(item.queueId);

      if (!incidentMap.has(tempId)) {

        const synthetic = createIncident(item.input, {

          id: tempId,

          severity: analyzeScamTranscript(item.input.description || '').risk_band,

          now: item.queuedAt || Date.now(),

        });

        synthetic._syncStatus = item.status;

        synthetic._queueId = item.queueId;

        synthetic._syncError = item.error || null;

        incidentMap.set(tempId, synthetic);

      }

    }

  }

  return Array.from(incidentMap.values());

}

export function createLocalIncidentStore(storage = null, { notify = () => {} } = {}) {

  const secure = storage === null;

  function read(key, fallback) {

    if (secure) return getCachedJson(key, fallback);

    try {

      const raw = storage?.getItem(key);

      return raw ? JSON.parse(raw) : fallback;

    } catch {

      return fallback;

    }

  }

  function write(key, value) {

    if (secure) {

      saveJson(key, value);

    } else {

      try {

        storage?.setItem(key, JSON.stringify(value));

      } catch {

        throw new Error('Could not save to browser storage');

      }

    }

    notify();

  }

  function incidents() {

    return read(INCIDENTS_KEY, []);

  }

  function staffing() {

    const saved = read(STAFFING_KEY, []);

    return defaultStaffing().map((s) => saved.find((x) => x.region === s.region) || s);

  }

  return {

    feed() {

      return { regions: REGIONS, staffing: staffing(), incidents: incidents() };

    },

    create(input, now = Date.now(), preferredId = null) {

      const all = incidents();

      const next = all.reduce((max, i) => Math.max(max, Number(i.id.replace(/\D/g, '')) || 0), 0) + 1;

      const severity = analyzeScamTranscript(input.description || '').risk_band;

      const incident = createIncident(input, {
        id: preferredId || `INC-L${String(next).padStart(4, '0')}`,
        severity,
        now,
      });

      write(INCIDENTS_KEY, [...all, incident]);

      return incident;

    },

    update(id, changes, now = Date.now()) {

      const all = incidents();

      const current = all.find((i) => i.id === id);

      if (!current) throw new Error('Incident not found');

      const updated = applyIncidentUpdate(current, changes, now);

      write(INCIDENTS_KEY, all.map((i) => (i.id === id ? updated : i)));

      return updated;

    },

    setStaffing(region, officersOnDuty) {

      if (!REGIONS.includes(region)) throw new Error('Unknown region');

      write(

        STAFFING_KEY,

        staffing().map((s) => (s.region === region ? { region, officers_on_duty: officersOnDuty } : s))

      );

      return { region, officers_on_duty: officersOnDuty };

    },

  };

}

const local = createLocalIncidentStore(undefined, {

  notify: () => globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT)),

});

export async function fetchIncidentFeed() {

  await hydrateSyncQueue();

  const online = isOnline();

  if (online && Date.now() >= backendDownUntil) {

    try {

      const feed = await backendRequest('/api/incidents');

      backendDownUntil = 0;

      writeCache(feed);

      // Trigger background sync if queue has pending items

      const queue = getSyncQueue();

      if (queue.some((i) => i.status === 'pending')) {

        processSyncQueue().then(() => {

          globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

        });

      }

      return {

        ...feed,

        incidents: overlaySyncQueue(feed.incidents, queue),

        source: 'backend',

      };

    } catch (error) {

      if (!isUnavailable(error)) throw error;

      backendDownUntil = Date.now() + BACKEND_RETRY_MS;

    }

  }

  // Fallback: Read from local cache or local store

  const cached = readCache();

  const queue = getSyncQueue();

  if (cached) {

    return {

      ...cached,

      incidents: overlaySyncQueue(cached.incidents, queue),

      source: online ? 'cached_offline' : 'offline',

    };

  }

  const localFeed = local.feed();

  return {

    ...localFeed,

    incidents: overlaySyncQueue(localFeed.incidents, queue),

    source: 'local',

  };

}

export async function recordIncident(input) {

  const operationId = createOperationId();

  if (!isOnline()) {

    const queueItem = enqueueCreate({ input, operationId });

    const localIncident = local.create(
      input,
      Date.now(),
      queueItem.localIncidentId,
    );

    const incidentWithSync = { ...localIncident, _syncStatus: 'pending', _queueId: queueItem.queueId };

    globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

    return { incident: incidentWithSync, source: 'offline' };

  }

  try {

    const remote = await backendRequest('/api/incidents', {

      method: 'POST',

      body: JSON.stringify({ ...input, operation_id: operationId }),

    });

    return { incident: { ...remote, _syncStatus: 'synced' }, source: 'backend' };

  } catch (error) {

    if (isUnavailable(error)) {

      const queueItem = enqueueCreate({ input, operationId });

      const localIncident = local.create(
        input,
        Date.now(),
        queueItem.localIncidentId,
      );

      const incidentWithSync = { ...localIncident, _syncStatus: 'pending', _queueId: queueItem.queueId };

      globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

      return { incident: incidentWithSync, source: 'local' };

    }

    throw error;

  }

}

export async function updateIncident(id, changes, source, baseIncident = null) {

  const operationId = createOperationId();

  const online = isOnline();

  // If responder is offline or in simulated offline mode:

  if (!online || source === 'local' || source === 'offline' || source === 'cached_offline') {

    const queueItem = enqueueUpdate({

      incidentId: id,

      changes,

      baseIncident,

      operationId,

    });

    // Update local cache & fallback store optimistically

    try {

      local.update(id, changes);

    } catch {

      // Incident may only exist in cache

    }

    const cached = readCache();

    if (cached) {

      const updatedIncidents = cached.incidents.map((i) =>

        i.id === id ? applyIncidentUpdate(i, changes, Date.now()) : i

      );

      writeCache({ ...cached, incidents: updatedIncidents });

    }

    globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

    return {

      ...(baseIncident || { id }),

      ...changes,

      _syncStatus: 'pending',

      _queueId: queueItem.queueId,

    };

  }

  // If online, push directly to backend with expected_version for conflict detection

  try {

    const payload = {

      ...changes,

      expected_version: baseIncident?.version,

      operation_id: operationId,

      force: false,

    };

    const updated = await backendRequest(`/api/incidents/${encodeURIComponent(id)}`, {

      method: 'PATCH',

      body: JSON.stringify(payload),

    });

    // Update local cache with confirmed version

    const cached = readCache();

    if (cached) {

      const updatedIncidents = cached.incidents.map((i) => (i.id === id ? updated : i));

      writeCache({ ...cached, incidents: updatedIncidents });

    }

    globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

    return { ...updated, _syncStatus: 'synced' };

  } catch (error) {

    if (error.status === 409) {

      // Conflict detected by server! Enqueue as conflict so user can resolve in UI

      const serverIncident = error.detail?.server_incident || {};

      const queueItem = enqueueUpdate({

        incidentId: id,

        changes,

        baseIncident,

        operationId,

      });

      // Mark queue item as conflict (without writing plaintext directly)
      const conflictingFields = error.detail?.conflicting_fields || ['status'];
      const message =
        error.detail?.message ||
        'Server incident was modified by another officer';

      markQueueItemConflict(queueItem.queueId, {
        serverIncident,
        conflictingFields,
        message,
      });

      globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

      return {

        ...(baseIncident || { id }),

        ...changes,

        _syncStatus: 'conflict',

        _queueId: queueItem.queueId,

        _serverConflictData: {

          serverIncident,

          conflictingFields: error.detail?.conflicting_fields || ['status'],

        },

      };

    }

    if (isUnavailable(error)) {

      // Connection dropped during update — queue for offline sync

      const queueItem = enqueueUpdate({
        incidentId: id,
        changes,
        baseIncident,
        operationId,
      });

      const cached = readCache();

      if (cached) {

        const updatedIncidents = cached.incidents.map((i) =>

          i.id === id ? applyIncidentUpdate(i, changes, Date.now()) : i

        );

        writeCache({ ...cached, incidents: updatedIncidents });

      }

      globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT));

      return {

        ...(baseIncident || { id }),

        ...changes,

        _syncStatus: 'pending',

        _queueId: queueItem.queueId,

      };

    }

    throw error;

  }

}

export async function setRegionStaffing(region, officersOnDuty, source) {

  if (source === 'local' || !isOnline()) return local.setStaffing(region, officersOnDuty);

  return backendRequest(`/api/incidents/staffing/${encodeURIComponent(region)}`, {

    method: 'PUT',

    body: JSON.stringify({ officers_on_duty: officersOnDuty }),

  });

}

