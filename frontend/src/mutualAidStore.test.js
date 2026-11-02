import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  MutualAidStore,
  SEVERITY_WEIGHTS,
} from './mutualAidStore.js';

describe('MutualAidStore and Resource Rebalancing Logic', () => {
  let store;

  beforeEach(() => {
    store = new MutualAidStore();
    store._declarations = [];
    store._guestDelegations = [];
    store._jointTaskforces = [];
    store._guestAudit = [];
    store._sunsetAudit = [];
  });

  it('triggers automated mutual aid declaration when sector workload exceeds 150%', () => {
    const serviceAreas = [
      {
        id: 'SA-CENTRAL-01',
        name: 'Central Secretariat Cyber Command',
        region: 'Central Zone',
        jurisdiction_id: 'JUR-DELHI-METRO',
        capacity_limit_points: 30,
      },
    ];

    // 16 critical incidents: 16 * 3.0 = 48 points -> 48 / 30 = 1.6 (160% workload)
    const incidents = Array.from({ length: 16 }, (_, idx) => ({
      id: `INC-TEST-${idx}`,
      region: 'Central Zone',
      severity: 'critical',
      status: 'new',
    }));

    const triggered = store.checkWorkloadAndAutoTrigger(incidents, serviceAreas);
    assert.equal(triggered.length, 1);
    assert.equal(triggered[0].trigger_type, 'automatic_threshold');
    assert.equal(triggered[0].region, 'Central Zone');
    assert.ok(triggered[0].workload_ratio >= 1.5);
    assert.ok(triggered[0].target_neighbor_jurisdictions.includes('JUR-NCR-SOUTH'));
  });

  it('allows commanders to manually declare mutual aid reinforcement', () => {
    const dec = store.declareMutualAid({
      serviceAreaId: 'SA-SOUTH-01',
      serviceAreaName: 'South Financial Corridors',
      region: 'South Zone',
      jurisdictionId: 'JUR-NCR-SOUTH',
      declaredBy: 'OFF-CMD-SOUTH',
      requestedUnitsCount: 3,
      workloadPoints: 54.0,
      capacityLimitPoints: 36.0,
    });

    assert.ok(dec.id.startsWith('MAD-'));
    assert.equal(dec.requesting_jurisdiction_id, 'JUR-NCR-SOUTH');
    assert.equal(dec.requested_units_count, 3);
    assert.equal(dec.status, 'active');
  });

  it('delegates temporary guest unit access without altering permanent rosters', () => {
    const guest = store.delegateGuestUnit({
      guestOfficerId: 'OFF-S1',
      homeJurisdictionId: 'JUR-NCR-SOUTH',
      borrowingJurisdictionId: 'JUR-DELHI-METRO',
      targetServiceAreaId: 'SA-CENTRAL-01',
      targetRegion: 'Central Zone',
      authorizedBy: 'OFF-DIR-01',
      durationHours: 6.0,
      declarationId: 'MAD-2026-TEST',
    });

    assert.ok(guest.delegation_id.startsWith('GUEST-DEL-'));
    assert.equal(guest.guest_officer_id, 'OFF-S1');
    assert.equal(guest.home_jurisdiction_id, 'JUR-NCR-SOUTH');
    assert.equal(guest.borrowing_jurisdiction_id, 'JUR-DELHI-METRO');
    assert.equal(guest.status, 'active');
    assert.ok(guest.valid_until > guest.valid_from);

    // Verify duplicate deployment is blocked
    assert.throws(() => {
      store.delegateGuestUnit({
        guestOfficerId: 'OFF-S1',
        homeJurisdictionId: 'JUR-NCR-SOUTH',
        borrowingJurisdictionId: 'JUR-DELHI-METRO',
        targetServiceAreaId: 'SA-CENTRAL-01',
      });
    }, /already deployed/);
  });

  it('logs guest actions with badge and cross-zone pointers in master audit trail', () => {
    store.delegateGuestUnit({
      guestOfficerId: 'OFF-S2',
      homeJurisdictionId: 'JUR-NCR-SOUTH',
      borrowingJurisdictionId: 'JUR-DELHI-METRO',
      targetServiceAreaId: 'SA-CENTRAL-01',
      targetRegion: 'Central Zone',
    });

    const entry = store.logGuestAction({
      guestOfficerId: 'OFF-S2',
      incidentId: 'INC-1099',
      actionType: 'severity_override',
      details: 'Guest officer upgraded severity to critical due to VIP victim impersonation.',
    });

    assert.ok(entry.id.startsWith('AUDIT-'));
    assert.equal(entry.guest_officer_id, 'OFF-S2');
    assert.equal(entry.home_jurisdiction_id, 'JUR-NCR-SOUTH');
    assert.equal(entry.incident_id, 'INC-1099');

    const auditTrail = store.getGuestAuditLog('OFF-S2');
    assert.equal(auditTrail.length, 1);
  });

  it('executes auto-revocation and sunset audits on de-escalation', () => {
    const dec = store.declareMutualAid({
      serviceAreaId: 'SA-EAST-01',
      serviceAreaName: 'East Safety Desk',
      region: 'East Zone',
      jurisdictionId: 'JUR-DELHI-METRO',
    });

    const guest = store.delegateGuestUnit({
      guestOfficerId: 'OFF-C9',
      homeJurisdictionId: 'JUR-DELHI-METRO',
      borrowingJurisdictionId: 'JUR-DELHI-METRO',
      targetServiceAreaId: 'SA-EAST-01',
      targetRegion: 'East Zone',
      declarationId: dec.id,
    });

    const res = store.deescalateDeclaration(dec.id, 'Caseload normalized');
    assert.equal(res.declaration.status, 'de_escalated');
    assert.equal(res.sunset_delegations_count, 1);

    const sunsetLogs = store.getSunsetAuditLog();
    assert.ok(sunsetLogs.some((s) => s.delegation_id === guest.delegation_id && s.sunset_reason === 'WORKLOAD_NORMALIZED_BELOW_THRESHOLD'));
  });

  it('aggregates multi-zone syndicate intelligence in Joint Taskforce Workspaces', () => {
    const jtf = store.createJointTaskforce({
      name: 'NCR Interstate Mule Takedown',
      leadJurisdictionId: 'JUR-DELHI-METRO',
      participatingJurisdictionIds: ['JUR-DELHI-METRO', 'JUR-NCR-SOUTH'],
      monitoredRegions: ['Central Zone', 'South Zone'],
      activeTaskforceOfficers: ['OFF-DIR-01', 'OFF-S1'],
    });

    const incidents = [
      { id: 'INC-A', region: 'Central Zone', status: 'new', severity: 'critical', linked_account: 'ACC-MULE-SHARED' },
      { id: 'INC-B', region: 'South Zone', status: 'in_progress', severity: 'high', linked_account: 'ACC-MULE-SHARED' },
      { id: 'INC-C', region: 'North Zone', status: 'new', severity: 'low', linked_account: 'ACC-OTHER' },
    ];

    const workspace = store.getJointTaskforceWorkspace(jtf.id, incidents);
    assert.equal(workspace.aggregated_metrics.monitored_regions_count, 2);
    assert.equal(workspace.aggregated_metrics.total_incidents, 2); // Central + South only
    assert.equal(workspace.aggregated_metrics.cross_zone_syndicates_detected, 1);
    assert.equal(workspace.cross_zone_syndicate_accounts[0].account_id, 'ACC-MULE-SHARED');
  });

  it('evaluates dynamic resource rebalancing and generates recommendations', () => {
    const serviceAreas = [
      { id: 'SA-CENTRAL-01', name: 'Central Command', region: 'Central Zone', jurisdiction_id: 'JUR-DELHI-METRO', capacity_limit_points: 30 },
      { id: 'SA-SOUTH-01', name: 'South Tech Hub', region: 'South Zone', jurisdiction_id: 'JUR-NCR-SOUTH', capacity_limit_points: 36 },
    ];

    // Central overloaded (16 critical = 48 pts / 30 cap = 1.6)
    const centralIncidents = Array.from({ length: 16 }, (_, idx) => ({
      id: `INC-C-${idx}`,
      region: 'Central Zone',
      severity: 'critical',
      status: 'new',
    }));

    // South underloaded (1 low = 0.5 pts / 36 cap = 0.01)
    const southIncidents = [
      { id: 'INC-S-1', region: 'South Zone', severity: 'low', status: 'new' },
    ];

    const evalResult = store.evaluateDynamicRebalancing([...centralIncidents, ...southIncidents], serviceAreas);
    assert.equal(evalResult.overloaded_sectors_count, 1);
    assert.ok(evalResult.recommendations.length >= 1);
    const rec = evalResult.recommendations[0];
    assert.equal(rec.overloaded_region, 'Central Zone');
    assert.equal(rec.donor_jurisdiction_id, 'JUR-NCR-SOUTH');
    assert.ok(rec.recommended_units >= 1);
  });
});

