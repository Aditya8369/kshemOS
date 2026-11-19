import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SYNC_STATES,
  TRUTH_IN_STATE_NOTICE,
  explainActionOutcome,
  getSyncStateMeta,
} from './syncStatusMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFile(relPath) {
  return readFileSync(join(__dirname, relPath), 'utf8');
}

// -----------------------------------------------------------------------------
// Criterion 1: Show clear badges for live, offline/local, pending sync, and conflict states
// -----------------------------------------------------------------------------
test('Criterion 1: Defines distinguishable badges with non-color cues for all four sync states', () => {
  const liveMeta = getSyncStateMeta({ isOnline: true, syncStatus: 'synced', version: 2 });
  const offlineMeta = getSyncStateMeta({ isOnline: false, queueCount: 0 });
  const pendingMeta = getSyncStateMeta({ isOnline: false, syncStatus: 'pending' });
  const conflictMeta = getSyncStateMeta({ isOnline: true, syncStatus: 'conflict' });

  // Each state must be distinct
  const states = [liveMeta.state, offlineMeta.state, pendingMeta.state, conflictMeta.state];
  assert.equal(new Set(states).size, 4, 'Must have 4 unique state constants');

  // Verify non-color textual tags exist for accessibility and color-blind users
  assert.equal(liveMeta.tag, '[HQ CONFIRMED]');
  assert.equal(offlineMeta.tag, '[OFFLINE]');
  assert.equal(pendingMeta.tag, '[LOCAL ONLY]');
  assert.equal(conflictMeta.tag, '[CONFLICT]');

  // Verify icons differentiate states
  assert.notEqual(liveMeta.icon, offlineMeta.icon);
  assert.notEqual(pendingMeta.icon, conflictMeta.icon);

  // Verify aria-labels are present and descriptive
  assert.match(liveMeta.ariaLabel, /HQ Confirmed.*Headquarters/i);
  assert.match(offlineMeta.ariaLabel, /Field Offline.*local storage/i);
  assert.match(pendingMeta.ariaLabel, /Pending Sync.*not reached Headquarters/i);
  assert.match(conflictMeta.ariaLabel, /Sync Conflict.*diverges from Headquarters/i);
});

test('Criterion 1: CaseList renders clear accessible status badges for all incidents', () => {
  const caseListSource = readFile('components/incidentDashboard/CaseList.jsx');

  // Verify badges for each state exist in CaseList
  assert.match(caseListSource, /\[LOCAL\]/);
  assert.match(caseListSource, /\[CONFLICT\]/);
  assert.match(caseListSource, /\[FAILED\]/);
  assert.match(caseListSource, /\[HQ\]/);

  // Check aria-labels explain confirmation status
  assert.match(caseListSource, /aria-label="Pending Sync: Saved locally on this device only/i);
  assert.match(caseListSource, /aria-label="HQ Confirmed: Synchronized with headquarters"/i);
  assert.match(caseListSource, /aria-label="Sync Conflict: Headquarters version differs/i);
});

// -----------------------------------------------------------------------------
// Criterion 2: Explain whether an action has been saved locally or confirmed by the server
// -----------------------------------------------------------------------------
test('Criterion 2: explainActionOutcome differentiates local-only from server-confirmed outcomes', () => {
  // Action saved locally while offline
  const offlineAction = explainActionOutcome({
    actionName: 'Status change to Triaged',
    syncStatus: 'pending',
    isOnline: false,
  });
  assert.equal(offlineAction.savedLocally, true);
  assert.equal(offlineAction.confirmedByServer, false);
  assert.match(offlineAction.message, /saved locally to this device only/i);
  assert.match(offlineAction.message, /NOT reached Headquarters yet/i);

  // Action confirmed by server
  const onlineAction = explainActionOutcome({
    actionName: 'Status change to In Progress',
    syncStatus: 'synced',
    isOnline: true,
    version: 3,
  });
  assert.equal(onlineAction.savedLocally, true);
  assert.equal(onlineAction.confirmedByServer, true);
  assert.match(onlineAction.message, /confirmed by Headquarters server \(v3\)/i);

  // Conflict action
  const conflictAction = explainActionOutcome({
    actionName: 'Case assignment',
    syncStatus: 'conflict',
    isOnline: true,
  });
  assert.equal(conflictAction.savedLocally, true);
  assert.equal(conflictAction.confirmedByServer, false);
  assert.equal(conflictAction.conflict, true);
  assert.match(conflictAction.message, /caused a version conflict with Headquarters/i);
});

test('Criterion 2: IncidentDetail provides explicit Truth-in-State cards for pending and synced states', () => {
  const detailSource = readFile('components/incidentDashboard/IncidentDetail.jsx');

  // Pending callout explicitly explains data has NOT reached HQ
  assert.match(detailSource, /Saved Locally On Device — Pending Sync/i);
  assert.match(detailSource, /have <strong>not<\/strong> reached Headquarters/i);

  // Confirmed callout explicitly asserts HQ confirmation
  assert.match(detailSource, /Confirmed by Headquarters server/i);

  // Conflict callout explains divergence
  assert.match(detailSource, /HQ Version Conflict/i);
  assert.match(detailSource, /Local updates have <strong>not<\/strong> been merged into HQ/i);
});

// -----------------------------------------------------------------------------
// Criterion 3: Provide clear actions for reviewing queued or conflicting updates
// -----------------------------------------------------------------------------
test('Criterion 3: SyncStatusBanner provides direct review actions for queued and conflicting items', () => {
  const bannerSource = readFile('components/incidentDashboard/SyncStatusBanner.jsx');

  // Must provide Review Conflicts button
  assert.match(bannerSource, /Review Conflicts/i);

  // Must provide Review Queued Updates button
  assert.match(bannerSource, /Review Queued Updates/i);

  // Must provide Outbox button
  assert.match(bannerSource, /Outbox/);
});

test('Criterion 3: SyncQueueDrawer and ConflictResolutionModal provide interactive review actions', () => {
  const drawerSource = readFile('components/incidentDashboard/SyncQueueDrawer.jsx');
  const conflictSource = readFile('components/incidentDashboard/ConflictResolutionModal.jsx');

  // Outbox provides conflict resolution and retry
  assert.match(drawerSource, /Resolve Conflict/i);
  assert.match(drawerSource, /Retry/i);
  assert.match(drawerSource, /Sync All Pending/i);

  // Conflict modal provides Accept HQ, Keep Mine, and Custom Merge
  assert.match(conflictSource, /Accept HQ Version/i);
  assert.match(conflictSource, /Keep Field Update/i);
  assert.match(conflictSource, /Custom Merge/i);
});

// -----------------------------------------------------------------------------
// Criterion 4: Do not imply that an offline update has reached headquarters before confirmation
// -----------------------------------------------------------------------------
test('Criterion 4: Disclaimers prevent misleading officers into believing offline updates reached HQ', () => {
  assert.match(TRUTH_IN_STATE_NOTICE, /stored locally on this device only/i);
  assert.match(TRUTH_IN_STATE_NOTICE, /has NOT reached Headquarters/i);

  const bannerSource = readFile('components/incidentDashboard/SyncStatusBanner.jsx');
  assert.match(bannerSource, /Saved locally on this device only/i);
  assert.match(bannerSource, /<strong>not<\/strong> reached Headquarters/i);

  const drawerSource = readFile('components/incidentDashboard/SyncQueueDrawer.jsx');
  assert.match(drawerSource, /stored locally on this device only/i);
  assert.match(drawerSource, /have <strong>not<\/strong> reached Headquarters/i);

  const fieldSeizureSource = readFile('components/evidence/FieldSeizureCompanionView.jsx');
  assert.match(fieldSeizureSource, /These records have <strong>not<\/strong> reached the Central Evidence Vault yet/i);
  assert.match(fieldSeizureSource, /Has <strong>not<\/strong> reached Central Evidence Vault yet/i);
});
