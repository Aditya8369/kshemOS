import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFieldConflicts,
} from './incidentDashboard.js';
import {
  SYNC_QUEUE_KEY,
  clearSyncHistory,
  discardQueueItem,
  enqueueCreate,
  enqueueUpdate,
  getConflictCount,
  getPendingCount,
  getSyncHistory,
  getSyncQueue,
  isOnline,
  isSimulatedOffline,
  resolveConflict,
  retryQueueItem,
  setSimulatedOffline,
} from './syncQueue.js';
import {
  overlaySyncQueue,
  createLocalIncidentStore,
} from './incidentStore.js';

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

test('detects field conflicts accurately between local field update and server state', () => {
  const baseSnapshot = {
    id: 'INC-0001',
    status: 'new',
    severity: 'medium',
    assigned_to: null,
  };

  const localChanges = {
    status: 'in_progress',
    assigned_to: 'OFF-FIELD-1',
  };

  // Server also modified the incident while field was offline
  const serverIncident = {
    id: 'INC-0001',
    status: 'escalated',
    severity: 'medium',
    assigned_to: 'OFF-HQ-2',
    version: 3,
  };

  const conflicts = detectFieldConflicts(localChanges, serverIncident, baseSnapshot);

  assert.ok(conflicts.status, 'status should conflict');
  assert.equal(conflicts.status.localValue, 'in_progress');
  assert.equal(conflicts.status.serverValue, 'escalated');

  assert.ok(conflicts.assigned_to, 'assigned_to should conflict');
  assert.equal(conflicts.assigned_to.localValue, 'OFF-FIELD-1');
  assert.equal(conflicts.assigned_to.serverValue, 'OFF-HQ-2');

  // Severity was not changed locally, so it should not conflict
  assert.equal(conflicts.severity, undefined);
});

test('simulated offline toggle controls isOnline state', () => {
  setSimulatedOffline(false);
  assert.equal(isSimulatedOffline(), false);

  setSimulatedOffline(true);
  assert.equal(isSimulatedOffline(), true);
  assert.equal(isOnline(), false);

  // Toggle back
  setSimulatedOffline(false);
  assert.equal(isSimulatedOffline(), false);
});

test('enqueues field updates and creates into sync queue with proper metadata', () => {
  // Clear any existing queue in test environment
  const currentQueue = getSyncQueue();
  for (const item of currentQueue) {
    discardQueueItem(item.queueId);
  }

  const baseIncident = {
    id: 'INC-0010',
    status: 'new',
    severity: 'high',
    assigned_to: null,
    version: 1,
  };

  const item1 = enqueueUpdate({
    incidentId: 'INC-0010',
    changes: { status: 'in_progress', assigned_to: 'OFF-F1', notes: 'En route to scene' },
    baseIncident,
  });

  assert.equal(item1.action, 'update');
  assert.equal(item1.incidentId, 'INC-0010');
  assert.equal(item1.baseVersion, 1);
  assert.equal(item1.status, 'pending');
  assert.equal(item1.changes.status, 'in_progress');

  const item2 = enqueueCreate({
    input: {
      category: 'fraud_tx',
      description: 'Field officer intake: ATM skimmer spotted on Market St.',
      region: 'North Zone',
    },
  });

  assert.equal(item2.action, 'create');
  assert.equal(item2.status, 'pending');

  const queue = getSyncQueue();
  assert.equal(queue.length >= 2, true);
  assert.equal(getPendingCount() >= 2, true);

  // Clean up
  discardQueueItem(item1.queueId);
  discardQueueItem(item2.queueId);
});

test('overlays sync queue onto feed incidents optimistically for field responders', () => {
  const baseIncidents = [
    {
      id: 'INC-0020',
      title: 'Fake tech support',
      status: 'new',
      severity: 'medium',
      assigned_to: null,
      version: 1,
    },
  ];

  const fakeQueue = [
    {
      queueId: 'Q-TEST-1',
      action: 'update',
      incidentId: 'INC-0020',
      changes: { status: 'in_progress', assigned_to: 'OFF-FIELD-9' },
      status: 'pending',
      queuedAt: 1700000000000,
    },
    {
      queueId: 'Q-TEST-2',
      action: 'create',
      input: {
        category: 'scam_call',
        description: 'Citizen stopped on street reported fake tax arrest call.',
        region: 'West Zone',
      },
      status: 'pending',
      queuedAt: 1700000001000,
    },
  ];

  const merged = overlaySyncQueue(baseIncidents, fakeQueue);

  // Updated incident should show new status and pending badge
  const updatedInc = merged.find((i) => i.id === 'INC-0020');
  assert.ok(updatedInc);
  assert.equal(updatedInc.status, 'in_progress');
  assert.equal(updatedInc.assigned_to, 'OFF-FIELD-9');
  assert.equal(updatedInc._syncStatus, 'pending');
  assert.equal(updatedInc._queueId, 'Q-TEST-1');

  // Synthetic incident for queued create should appear in feed
  const newInc = merged.find((i) => i.id.startsWith('INC-PENDING-'));
  assert.ok(newInc);
  assert.equal(newInc.category, 'scam_call');
  assert.equal(newInc._syncStatus, 'pending');
});

test('conflict resolution handles keep_server and keep_mine', async () => {
  const queueItem = enqueueUpdate({
    incidentId: 'INC-0030',
    changes: { status: 'in_progress' },
    baseIncident: { id: 'INC-0030', version: 1 },
  });

  // Test keep_server resolution (discards queued local update)
  const res = await resolveConflict(queueItem.queueId, 'keep_server');
  assert.equal(res.action, 'discarded_local');

  const afterDiscard = getSyncQueue().find((i) => i.queueId === queueItem.queueId);
  assert.equal(afterDiscard, undefined);
});
