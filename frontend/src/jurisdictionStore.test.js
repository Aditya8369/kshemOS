import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLocalJurisdictionStore,
  validateBoundaryLocally,
  DEFAULT_SERVICE_AREAS,
  DEFAULT_JURISDICTIONS,
  DEFAULT_DISPATCH_RULES,
} from './jurisdictionStore.js';

test('boundary validation detects radius shrinkage > 25% as high-impact review requirement', () => {
  const existing = {
    id: 'SA-NORTH-01',
    name: 'North Sector',
    region: 'North Zone',
    radius_km: 10.0,
    status: 'active',
  };

  // Shrink to 7.0km (30% reduction, > 25% threshold)
  const proposedShrunk = {
    ...existing,
    radius_km: 7.0,
    boundary_type: 'circle',
    center_lat: 28.69,
    center_lng: 77.21,
  };

  const result = validateBoundaryLocally(existing, proposedShrunk, 0);
  assert.equal(result.isValid, true);
  assert.equal(result.requiresReview, true);
  assert.equal(result.coverageGapDetected, true);
  assert.equal(result.impactLevel, 'high');
  assert.ok(result.warnings.some((w) => w.includes('Boundary radius shrunk by >25%')));
});

test('boundary validation permits low-impact adjustments directly without review', () => {
  const existing = {
    id: 'SA-CENTRAL-01',
    name: 'Central Sector',
    region: 'Central Zone',
    radius_km: 5.0,
    status: 'active',
    primary_station: 'Old Station',
  };

  // Modest radius adjustment from 5.0 to 4.8km (< 25% shrink) and station update
  const proposed = {
    ...existing,
    radius_km: 4.8,
    primary_station: 'Renovated Central Cyber Headquarters',
    boundary_type: 'circle',
    center_lat: 28.6139,
    center_lng: 77.209,
  };

  const result = validateBoundaryLocally(existing, proposed, 1);
  assert.equal(result.isValid, true);
  assert.equal(result.requiresReview, false);
  assert.equal(result.impactLevel, 'standard');
});

test('deactivating an active zone with open incidents requires commanding officer review', () => {
  const existing = {
    id: 'SA-SOUTH-01',
    name: 'South Sector',
    region: 'South Zone',
    status: 'active',
    radius_km: 6.0,
  };

  const proposed = {
    ...existing,
    status: 'inactive',
  };

  // With 3 active incidents
  const result = validateBoundaryLocally(existing, proposed, 3);
  assert.equal(result.requiresReview, true);
  assert.equal(result.impactLevel, 'high');
  assert.equal(result.affectedActiveIncidents, 3);
  assert.ok(result.warnings.some((w) => w.includes('impacts 3 active incident(s)')));
});

test('local store stages high-impact change as pending proposal', () => {
  const store = createLocalJurisdictionStore(null);
  const targetArea = { ...DEFAULT_SERVICE_AREAS[0] };
  const originalRadius = targetArea.radius_km;

  // Attempt 50% radius reduction
  const shrunk = {
    ...targetArea,
    radius_km: originalRadius * 0.5,
  };

  const saveRes = store.saveServiceArea(shrunk, { forceApply: false, author: 'OFF-FIELD-01' });
  assert.equal(saveRes.requires_review, true);
  assert.ok(saveRes.proposal_id.startsWith('PROP-'));

  // Ensure service area was NOT modified yet
  const currentArea = store.getServiceAreas().find((sa) => sa.id === targetArea.id);
  assert.equal(currentArea.radius_km, originalRadius);

  // Proposal exists in pending proposals
  const proposals = store.getChangeProposals();
  assert.ok(proposals.some((p) => p.id === saveRes.proposal_id && p.status === 'pending'));
});

test('approving a proposal applies the boundary change and generates audit snapshot', () => {
  const store = createLocalJurisdictionStore(null);
  const targetArea = { ...DEFAULT_SERVICE_AREAS[1] }; // SA-NORTH-01
  const baselineSnapshotsCount = store.getSnapshots().length;

  // Stage high impact reduction
  const shrunk = {
    ...targetArea,
    radius_km: 2.0,
  };
  const saveRes = store.saveServiceArea(shrunk, { forceApply: false, author: 'OFF-SUBMITTER' });
  const propId = saveRes.proposal_id;

  // Review and Approve
  const reviewRes = store.reviewChangeProposal(propId, {
    reviewerCode: 'OFF-COMMANDER-01',
    decision: 'approved',
    reviewerNotes: 'Approved perimeter reconfiguration with cross-sector coverage.',
  });

  assert.equal(reviewRes.proposal.status, 'approved');
  assert.equal(reviewRes.applied_entity.radius_km, 2.0);

  // Verify updated in service areas
  const updatedArea = store.getServiceAreas().find((sa) => sa.id === targetArea.id);
  assert.equal(updatedArea.radius_km, 2.0);

  // Verify snapshot captured
  assert.ok(store.getSnapshots().length > baselineSnapshotsCount);
});

test('rejecting a proposal preserves the original boundary without applying change', () => {
  const store = createLocalJurisdictionStore(null);
  const targetArea = { ...DEFAULT_SERVICE_AREAS[2] }; // SA-SOUTH-01
  const originalRadius = targetArea.radius_km;

  const shrunk = {
    ...targetArea,
    radius_km: 1.5,
  };
  const saveRes = store.saveServiceArea(shrunk, { forceApply: false, author: 'OFF-SUBMITTER' });
  const propId = saveRes.proposal_id;

  // Review and Reject
  const reviewRes = store.reviewChangeProposal(propId, {
    reviewerCode: 'OFF-COMMANDER-01',
    decision: 'rejected',
    reviewerNotes: 'Rejected: high crime corridor would be left without coverage.',
  });

  assert.equal(reviewRes.proposal.status, 'rejected');

  // Verify original radius is untouched
  const currentArea = store.getServiceAreas().find((sa) => sa.id === targetArea.id);
  assert.equal(currentArea.radius_km, originalRadius);
});

test('snapshot rollback restores previous configuration state', () => {
  const store = createLocalJurisdictionStore(null);

  // Capture baseline snapshot ID
  const baselineId = store.getSnapshots()[0].snapshot_id;

  // Add custom jurisdiction
  store.saveJurisdiction(
    {
      id: 'JUR-TEMP-SPECIAL',
      name: 'Temporary Special Ops Hub',
      code: 'DL-TEMP-OPS',
      status: 'active',
      headquarters: 'Outpost Delta',
      contact_officer: 'OFF-TEMP',
      region_scope: ['East Zone'],
    },
    'OFF-SUPERVISOR'
  );

  // Modify service area
  store.saveServiceArea(
    {
      ...DEFAULT_SERVICE_AREAS[3],
      name: 'Altered East Zone Name',
    },
    { forceApply: true, author: 'OFF-ADMIN' }
  );

  assert.ok(store.getJurisdictions().some((j) => j.id === 'JUR-TEMP-SPECIAL'));

  // Restore baseline snapshot
  const rollbackSnap = store.restoreSnapshot(baselineId, 'OFF-AUDITOR');
  assert.ok(rollbackSnap);

  // Check state reverted
  assert.equal(
    store.getJurisdictions().some((j) => j.id === 'JUR-TEMP-SPECIAL'),
    false
  );
  const revertedEast = store.getServiceAreas().find((sa) => sa.id === DEFAULT_SERVICE_AREAS[3].id);
  assert.equal(revertedEast.name, DEFAULT_SERVICE_AREAS[3].name);
});

test('dispatch rule engine routes incidents based on category, severity, and region', () => {
  const store = createLocalJurisdictionStore(null);

  // Critical digital arrest in Central Zone -> OFF-SPEC-DIGITAL-ARREST
  const ruleDigitalArrest = store.matchDispatchRule('scam_call', 'critical', 'Central Zone');
  assert.ok(ruleDigitalArrest);
  assert.equal(ruleDigitalArrest.target_desk, 'OFF-SPEC-DIGITAL-ARREST');

  // Low severity in Central Zone should NOT match the critical digital arrest rule
  // (or will match general rule if present)
  const lowScam = store.matchDispatchRule('scam_call', 'low', 'Central Zone');
  assert.notEqual(lowScam?.id, 'DISP-RULE-DIGITAL-ARREST');

  // General intake in North Zone
  const ruleNorth = store.matchDispatchRule('other_scam', 'low', 'North Zone');
  assert.ok(ruleNorth);
  assert.equal(ruleNorth.target_desk, 'OFF-N1');
});
