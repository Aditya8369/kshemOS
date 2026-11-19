import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOfflineData,
  enqueueCreate,
  enqueueUpdate,
  getSyncHistory,
  getSyncQueue,
  markQueueItemConflict,
  processSyncQueue,
  purgeExpiredLocalData,
  resolveConflict,
  retryQueueItem,
  setSyncStorage,
  SYNC_HISTORY_KEY,
  SYNC_QUEUE_KEY,
} from './syncQueue.js';
import { SYNCED_HISTORY_TTL_MS } from './offlineDataPolicy.js';

function memoryStorage() {
  const store = new Map();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

let storage;

function resetStorage() {
  storage = memoryStorage();
  setSyncStorage(storage);
  globalThis.fetch = undefined;
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function installedResponse(incidentById) {
  return (body) =>
    jsonResponse({
      applied_count: body.items.length,
      conflict_count: 0,
      failed_count: 0,
      replayed_count: 0,
      results: body.items.map((item) => ({
        queue_id: item.queue_id,
        operation_id: item.operation_id,
        status: 'applied',
        incident:
          incidentById[item.incident_id] ||
          incidentById[item.local_incident_id] || {
            id: 'INC-0001',
            version: 2,
          },
      })),
    });
}

test('a retried push reuses the same operation ID', async () => {
  resetStorage();

  const item = enqueueUpdate({
    incidentId: 'INC-0100',
    changes: { status: 'in_progress' },
    baseIncident: { id: 'INC-0100', version: 1 },
  });

  const operationId = item.operationId;
  assert.ok(operationId);

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body));
    throw new TypeError('network dropped');
  };

  const first = await processSyncQueue();
  assert.equal(first.failed, 1);
  assert.equal(calls[0].items[0].operation_id, operationId);

  const queued = getSyncQueue()[0];
  assert.equal(queued.status, 'pending');
  assert.equal(queued.operationId, operationId, 'retry must keep the same ID');

  globalThis.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return jsonResponse({
      applied_count: 1,
      conflict_count: 0,
      failed_count: 0,
      replayed_count: 0,
      results: [
        {
          queue_id: queued.queueId,
          operation_id: operationId,
          status: 'applied',
          incident: { id: 'INC-0100', version: 2 },
        },
      ],
    });
  };

  await retryQueueItem(queued.queueId);

  assert.equal(calls.length, 2);  assert.equal(calls[1].items[0].operation_id, operationId);
  assert.equal(getSyncQueue().length, 0);
  assert.equal(getSyncHistory().length, 1);
});

test('consecutive offline edits chain expected versions instead of conflicting', async () => {
  resetStorage();

  const first = enqueueUpdate({
    incidentId: 'INC-0200',
    changes: { severity: 'high' },
    baseIncident: { id: 'INC-0200', version: 1 },
  });
  const second = enqueueUpdate({
    incidentId: 'INC-0200',
    changes: { status: 'resolved' },
    baseIncident: { id: 'INC-0200', version: 1 },
  });

  let payload;
  globalThis.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return installedResponse({
      'INC-0200': { id: 'INC-0200', version: 3 },
    })(payload);
  };

  const result = await processSyncQueue();
  assert.equal(result.synced, 2);
  assert.equal(result.conflicts, 0);

  assert.deepEqual(
    payload.items.map((item) => item.expected_version),
    [1, 2],
  );
  assert.deepEqual(
    payload.items.map((item) => item.operation_id),
    [first.operationId, second.operationId],
  );
  assert.equal(getSyncQueue().length, 0);
});

test('out-of-order queue entries are sent by authoring timestamp', async () => {
  resetStorage();

  const earlier = enqueueUpdate({
    incidentId: 'INC-0300',
    changes: { severity: 'high' },
    baseIncident: { id: 'INC-0300', version: 1 },
  });
  const later = enqueueUpdate({
    incidentId: 'INC-0300',
    changes: { status: 'resolved' },
    baseIncident: { id: 'INC-0300', version: 2 },
  });

  // Force the in-memory queue into reverse array order while keeping the
  // authoring timestamps intact.
  storage.setItem(
    SYNC_QUEUE_KEY,
    JSON.stringify([
      { ...later, queuedAt: later.queuedAt, clientTimestamp: later.clientTimestamp },
      { ...earlier, queuedAt: earlier.queuedAt, clientTimestamp: earlier.clientTimestamp },
    ]),
  );

  let payload;
  globalThis.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return installedResponse({})(payload);
  };

  await processSyncQueue();

  const severityIndex = payload.items.findIndex(
    (item) => item.changes?.severity === 'high',
  );
  const resolvedIndex = payload.items.findIndex(
    (item) => item.changes?.status === 'resolved',
  );

  assert.ok(severityIndex >= 0 && resolvedIndex >= 0);
  assert.ok(
    severityIndex < resolvedIndex,
    'earlier authored change should be applied first',
  );
  assert.equal(payload.items[severityIndex].expected_version, 1);
  assert.equal(payload.items[resolvedIndex].expected_version, 2);
});

test('offline create remaps dependent draft updates to the server ID', async () => {
  resetStorage();

  const created = enqueueCreate({
    input: {
      category: 'fraud_tx',
      description: 'Offline field draft',
      region: 'West Zone',
    },
  });
  const localId = created.localIncidentId;
  assert.ok(localId.startsWith('INC-PENDING-'));

  const dependent = enqueueUpdate({
    incidentId: localId,
    changes: { status: 'in_progress' },
    baseIncident: { id: localId, version: 1 },
  });

  globalThis.fetch = async () =>
    jsonResponse({
      applied_count: 1,
      conflict_count: 0,
      failed_count: 0,
      replayed_count: 0,
      results: [
        {
          queue_id: created.queueId,
          operation_id: created.operationId,
          status: 'applied',
          incident: { id: 'INC-0450', version: 1 },
        },
      ],
    });

  await processSyncQueue({ targetQueueId: created.queueId });

  const remaining = getSyncQueue().find((item) => item.queueId === dependent.queueId);
  assert.ok(remaining);
  assert.equal(remaining.incidentId, 'INC-0450');

  let payload;
  globalThis.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return installedResponse({ 'INC-0450': { id: 'INC-0450', version: 2 } })(payload);
  };

  await processSyncQueue();

  assert.equal(payload.items[0].incident_id, 'INC-0450');
  assert.equal(payload.items[0].expected_version, 1);
});

test('merge resolution creates a fresh operation ID and sends merged fields', async () => {
  resetStorage();

  const item = enqueueUpdate({
    incidentId: 'INC-0500',
    changes: { status: 'in_progress', notes: 'Local note' },
    baseIncident: { id: 'INC-0500', version: 1 },
  });

  markQueueItemConflict(item.queueId, {
    serverIncident: { id: 'INC-0500', version: 2, status: 'escalated' },
    conflictingFields: ['status'],
    message: 'Server changed this incident',
  });

  let payload;
  globalThis.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return installedResponse({ 'INC-0500': { id: 'INC-0500', version: 3 } })(payload);
  };

  await resolveConflict(item.queueId, 'merge', {
    status: 'triaged',
    notes: 'Local note',
  });

  const sent = payload.items[0];
  assert.notEqual(sent.operation_id, item.operationId);
  assert.equal(sent.force, true);
  assert.equal(sent.changes.status, 'triaged');
  assert.equal(sent.changes.notes, 'Local note');
  assert.equal(getSyncQueue().length, 0);
});

test('a permission error keeps drafts, while a revoked session wipes them', async () => {
  resetStorage();

  enqueueUpdate({
    incidentId: 'INC-0700',
    changes: { status: 'in_progress' },
    baseIncident: { id: 'INC-0700', version: 1 },
  });

  globalThis.fetch = async () => jsonResponse({ detail: 'Access forbidden' }, 403);
  const forbidden = await processSyncQueue();

  assert.equal(forbidden.failed, 1);
  assert.equal(getSyncQueue().length, 1, '403 must not destroy drafts');

  globalThis.fetch = async () => jsonResponse({ detail: 'Unauthorized' }, 401);
  const revoked = await processSyncQueue({ force: true });

  assert.equal(revoked.revoked, true);
  assert.equal(getSyncQueue().length, 0, '401 must purge local data');
});

test('logout wipes encrypted drafts, history, and cached incident data', async () => {
  resetStorage();

  enqueueUpdate({
    incidentId: 'INC-0600',
    changes: { status: 'in_progress' },
    baseIncident: { id: 'INC-0600', version: 1 },
  });

  storage.setItem(
    SYNC_HISTORY_KEY,
    JSON.stringify([
      {
        queueId: 'Q-OLD',
        status: 'synced',
        syncedAt: Date.now(),
        confirmedIncident: { id: 'INC-0600', version: 2 },
      },
    ]),
  );
  storage.setItem('kshemos.cache.incidents.v2', '{"incidents":[]}');

  const result = await clearOfflineData('logout');

  assert.equal(result.clearedQueue, 1);
  assert.equal(result.clearedHistory, 1);
  assert.equal(getSyncQueue().length, 0);
  assert.equal(getSyncHistory().length, 0);
  assert.equal(storage.getItem('kshemos.cache.incidents.v2'), null);
});

test('synced history is retained for a bounded window only', async () => {
  resetStorage();

  const now = Date.now();
  storage.setItem(
    SYNC_HISTORY_KEY,
    JSON.stringify([
      { queueId: 'Q-NEW', status: 'synced', syncedAt: now - 1000 },
      {
        queueId: 'Q-STALE',
        status: 'synced',
        syncedAt: now - SYNCED_HISTORY_TTL_MS - 1000,
      },
    ]),
  );

  const result = await purgeExpiredLocalData(now);

  assert.equal(result.removed, 1);
  const remaining = JSON.parse(storage.getItem(SYNC_HISTORY_KEY));
  assert.deepEqual(
    remaining.map((entry) => entry.queueId),
    ['Q-NEW'],
  );
});
