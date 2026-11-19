import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNC_STATES,
  TRUTH_IN_STATE_NOTICE,
  explainActionOutcome,
  getSyncStateMeta,
} from './syncStatusMeta.js';

test('getSyncStateMeta correctly identifies Live / Server Confirmed state', () => {
  const meta = getSyncStateMeta({ isOnline: true, syncStatus: 'synced', version: 3 });
  assert.equal(meta.state, SYNC_STATES.LIVE);
  assert.equal(meta.isServerConfirmed, true);
  assert.equal(meta.isLocalOnly, false);
  assert.match(meta.label, /HQ Confirmed.*v3/);
  assert.equal(meta.tag, '[HQ CONFIRMED]');
  assert.match(meta.explanation, /Confirmed by Headquarters server/);
  assert.match(meta.ariaLabel, /Headquarters server/);
});

test('getSyncStateMeta identifies Pending Sync state and asserts data has NOT reached HQ', () => {
  const meta = getSyncStateMeta({ isOnline: false, syncStatus: 'pending' });
  assert.equal(meta.state, SYNC_STATES.PENDING);
  assert.equal(meta.isServerConfirmed, false);
  assert.equal(meta.isLocalOnly, true);
  assert.equal(meta.tag, '[LOCAL ONLY]');
  // Strict check: must explicitly state it has NOT reached HQ
  assert.match(meta.explanation, /has NOT reached Headquarters yet/i);
  assert.match(meta.ariaLabel, /Saved locally on this device only/i);
});

test('getSyncStateMeta gives top priority to Sync Conflict state and urges human review', () => {
  const meta = getSyncStateMeta({
    isOnline: true,
    syncStatus: 'conflict',
    queueCount: 2,
    conflictCount: 1,
  });
  assert.equal(meta.state, SYNC_STATES.CONFLICT);
  assert.equal(meta.isServerConfirmed, false);
  assert.equal(meta.isLocalOnly, true);
  assert.equal(meta.tag, '[CONFLICT]');
  assert.match(meta.explanation, /Headquarters record was modified while this unit was offline/i);
  assert.match(meta.actionRecommendation, /Review and resolve conflicting fields/i);
});

test('getSyncStateMeta identifies Field Offline state with clean queue', () => {
  const meta = getSyncStateMeta({ isOnline: false, queueCount: 0 });
  assert.equal(meta.state, SYNC_STATES.OFFLINE);
  assert.equal(meta.isServerConfirmed, false);
  assert.equal(meta.isLocalOnly, true);
  assert.equal(meta.tag, '[OFFLINE]');
  assert.match(meta.explanation, /Preserved in local encrypted storage/i);
  assert.match(meta.explanation, /will NOT reach Headquarters until reconnected/i);
});

test('explainActionOutcome clearly separates locally saved from server confirmed outcomes', () => {
  // Scenario A: Offline edit
  const offlineOutcome = explainActionOutcome({
    actionName: 'Status change to Investigating',
    syncStatus: 'pending',
    isOnline: false,
  });
  assert.equal(offlineOutcome.savedLocally, true);
  assert.equal(offlineOutcome.confirmedByServer, false);
  assert.match(offlineOutcome.message, /saved locally to this device only/i);
  assert.match(offlineOutcome.message, /NOT reached Headquarters yet/i);

  // Scenario B: Online server confirmed edit
  const onlineOutcome = explainActionOutcome({
    actionName: 'Severity update',
    syncStatus: 'synced',
    isOnline: true,
    version: 4,
  });
  assert.equal(onlineOutcome.savedLocally, true);
  assert.equal(onlineOutcome.confirmedByServer, true);
  assert.match(onlineOutcome.message, /confirmed by Headquarters server \(v4\)/i);

  // Scenario C: Conflict outcome
  const conflictOutcome = explainActionOutcome({
    actionName: 'Assignment update',
    syncStatus: 'conflict',
    isOnline: true,
  });
  assert.equal(conflictOutcome.savedLocally, true);
  assert.equal(conflictOutcome.confirmedByServer, false);
  assert.equal(conflictOutcome.conflict, true);
  assert.match(conflictOutcome.message, /conflict with Headquarters/i);
});

test('TRUTH_IN_STATE_NOTICE provides statutory notice for field teams', () => {
  assert.match(TRUTH_IN_STATE_NOTICE, /stored locally on this device only/i);
  assert.match(TRUTH_IN_STATE_NOTICE, /has NOT reached Headquarters/i);
});
