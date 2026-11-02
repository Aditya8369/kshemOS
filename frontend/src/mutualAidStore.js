/*
 * Cross-Jurisdiction Mutual Aid & Dynamic Resource Rebalancing Store for KshemOS.
 *
 * Implements:
 * - Automated 150% workload threshold triggers
 * - Time-bounded guest officer dispatch delegation (JUR-NCR-SOUTH <-> JUR-DELHI-METRO)
 * - Joint Taskforce Workspaces aggregating multi-zone syndicate intelligence
 * - Auto-revocation & sunset audits
 * - Dual-mode backend API client with offline localStorage fallback
 */

const BASE_URL = import.meta.env?.VITE_API_URL || '';

export const DECLARATIONS_KEY = 'kshemos.mutual_aid.declarations.v1';
export const GUEST_DELEGATIONS_KEY = 'kshemos.mutual_aid.guest_delegations.v1';
export const JOINT_TASKFORCES_KEY = 'kshemos.mutual_aid.joint_taskforces.v1';
export const GUEST_AUDIT_LOG_KEY = 'kshemos.mutual_aid.guest_audit.v1';
export const SUNSET_AUDIT_LOG_KEY = 'kshemos.mutual_aid.sunset_audit.v1';

export const MUTUAL_AID_CHANGED_EVENT = 'kshemos:mutual-aid-changed';

export const SEVERITY_WEIGHTS = {
  critical: 3.0,
  high: 2.0,
  medium: 1.0,
  low: 0.5,
};

export const ACTIVE_STATUSES = ['new', 'triaged', 'in_progress', 'escalated'];

export const ADJACENT_JURISDICTIONS = {
  'JUR-DELHI-METRO': ['JUR-NCR-SOUTH'],
  'JUR-NCR-SOUTH': ['JUR-DELHI-METRO'],
};

export const DEFAULT_JOINT_TASKFORCES = [
  {
    id: 'JTF-NCR-METRO-01',
    name: 'Delhi-Gurugram Interstate Cyber Syndicate Taskforce',
    lead_jurisdiction_id: 'JUR-DELHI-METRO',
    participating_jurisdiction_ids: ['JUR-DELHI-METRO', 'JUR-NCR-SOUTH'],
    monitored_regions: ['Central Zone', 'South Zone'],
    active_taskforce_officers: ['OFF-DIR-01', 'OFF-S1', 'OFF-C1', 'CYBER-SPECIAL'],
    target_syndicate_tags: ['digital_arrest', 'mule_network', 'telecom_spoof'],
    status: 'active',
    created_at: Date.now() - 86400000,
    created_by: 'OFF-DIR-01',
    notes: 'Unified command hub coordinating rapid freeze orders across Delhi-NCR financial and telecom gateways.',
  },
];

export const DEFAULT_DECLARATIONS = [
  {
    id: 'MAD-2026-00101',
    requesting_jurisdiction_id: 'JUR-DELHI-METRO',
    service_area_id: 'SA-CENTRAL-01',
    region: 'Central Zone',
    declared_by: 'OFF-DIR-01',
    trigger_type: 'automatic_threshold',
    workload_points: 48.0,
    capacity_limit_points: 30.0,
    workload_ratio: 1.6,
    target_neighbor_jurisdictions: ['JUR-NCR-SOUTH'],
    requested_units_count: 2,
    status: 'active',
    declared_at: Date.now() - 7200000,
    deescalated_at: null,
    notes: 'Central Secretariat workload at 160% of capacity points due to multi-caller digital arrest surge.',
  },
];

export const DEFAULT_GUEST_DELEGATIONS = [
  {
    delegation_id: 'GUEST-DEL-201',
    declaration_id: 'MAD-2026-00101',
    guest_officer_id: 'OFF-S1',
    home_jurisdiction_id: 'JUR-NCR-SOUTH',
    home_service_area_id: 'SA-SOUTH-01',
    borrowing_jurisdiction_id: 'JUR-DELHI-METRO',
    borrowing_service_area_id: 'SA-CENTRAL-01',
    target_region: 'Central Zone',
    authorized_by: 'OFF-DIR-01',
    authorized_at: Date.now() - 3600000,
    valid_from: Date.now() - 3600000,
    valid_until: Date.now() + 7 * 3600000,
    permissions: ['triage', 'respond', 'log_action', 'reassign'],
    status: 'active',
    revocation_reason: null,
    revoked_at: null,
    revoked_by: null,
  },
];

export const DEFAULT_GUEST_AUDIT = [
  {
    id: 'AUDIT-001',
    delegation_id: 'GUEST-DEL-201',
    guest_officer_id: 'OFF-S1',
    home_jurisdiction_id: 'JUR-NCR-SOUTH',
    borrowed_jurisdiction_id: 'JUR-DELHI-METRO',
    incident_id: 'INC-0001',
    action_type: 'triage',
    details: 'Cross-zone guest officer OFF-S1 triaged digital arrest report and flagged linked mule account ACC-9941.',
    timestamp: Date.now() - 1800000,
  },
];

export const DEFAULT_SUNSET_AUDIT = [
  {
    audit_id: 'AUTH-401',
    delegation_id: 'GUEST-DEL-201',
    guest_officer_id: 'OFF-S1',
    home_jurisdiction_id: 'JUR-NCR-SOUTH',
    borrowing_jurisdiction_id: 'JUR-DELHI-METRO',
    target_region: 'Central Zone',
    sunset_reason: 'DISPATCH_AUTHORIZED',
    details: 'Temporary access granted for 8.0h. Permanent roster maintained at JUR-NCR-SOUTH.',
    timestamp: Date.now() - 3600000,
  },
];

let backendDownUntil = 0;
const BACKEND_RETRY_MS = 5000;

function safeStorageGet(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota
  }
}

function emitMutualAidChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(MUTUAL_AID_CHANGED_EVENT));
    } catch {
      // Ignore
    }
  }
}

async function requestBackend(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Backend error: ${res.status}`);
  }
  return res.json();
}

export class MutualAidStore {
  constructor() {
    this._declarations = safeStorageGet(DECLARATIONS_KEY, DEFAULT_DECLARATIONS);
    this._guestDelegations = safeStorageGet(GUEST_DELEGATIONS_KEY, DEFAULT_GUEST_DELEGATIONS);
    this._jointTaskforces = safeStorageGet(JOINT_TASKFORCES_KEY, DEFAULT_JOINT_TASKFORCES);
    this._guestAudit = safeStorageGet(GUEST_AUDIT_LOG_KEY, DEFAULT_GUEST_AUDIT);
    this._sunsetAudit = safeStorageGet(SUNSET_AUDIT_LOG_KEY, DEFAULT_SUNSET_AUDIT);
  }

  save() {
    safeStorageSet(DECLARATIONS_KEY, this._declarations);
    safeStorageSet(GUEST_DELEGATIONS_KEY, this._guestDelegations);
    safeStorageSet(JOINT_TASKFORCES_KEY, this._jointTaskforces);
    safeStorageSet(GUEST_AUDIT_LOG_KEY, this._guestAudit);
    safeStorageSet(SUNSET_AUDIT_LOG_KEY, this._sunsetAudit);
    emitMutualAidChanged();
  }

  getDeclarations(status = null) {
    this.checkAutoRevocation();
    if (!status) return [...this._declarations];
    return this._declarations.filter((d) => d.status === status);
  }

  getGuestDelegations(status = null) {
    this.checkAutoRevocation();
    if (!status) return [...this._guestDelegations];
    return this._guestDelegations.filter((g) => g.status === status);
  }

  getJointTaskforces() {
    return [...this._jointTaskforces];
  }

  getGuestAuditLog(guestOfficerId = null) {
    if (!guestOfficerId) return [...this._guestAudit];
    return this._guestAudit.filter((a) => a.guest_officer_id === guestOfficerId);
  }

  getSunsetAuditLog() {
    return [...this._sunsetAudit];
  }

  checkWorkloadAndAutoTrigger(incidents = [], serviceAreas = []) {
    const triggered = [];
    const now = Date.now();

    for (const sa of serviceAreas) {
      const region = sa.region;
      const activeIncidents = incidents.filter(
        (i) => i.region === region && ACTIVE_STATUSES.includes(i.status)
      );
      const load = activeIncidents.reduce(
        (sum, inc) => sum + (SEVERITY_WEIGHTS[inc.severity] || 0.5),
        0
      );
      const capacity = Number(sa.capacity_limit_points || 24);
      const ratio = capacity > 0 ? load / capacity : 0;

      if (ratio >= 1.5) {
        const existing = this._declarations.find(
          (d) => d.service_area_id === sa.id && (d.status === 'active' || d.status === 'partially_fulfilled')
        );

        if (!existing) {
          const decId = `MAD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          const parentJur = sa.jurisdiction_id || 'JUR-DELHI-METRO';
          const adjacent = ADJACENT_JURISDICTIONS[parentJur] || ['JUR-NCR-SOUTH'];
          const needed = Math.max(1, Math.ceil((load - capacity) / 6.0));

          const newDec = {
            id: decId,
            requesting_jurisdiction_id: parentJur,
            service_area_id: sa.id,
            region,
            declared_by: 'SYSTEM_AUTOTRIGGER',
            trigger_type: 'automatic_threshold',
            workload_points: Number(load.toFixed(1)),
            capacity_limit_points: capacity,
            workload_ratio: Number(ratio.toFixed(2)),
            target_neighbor_jurisdictions: adjacent,
            requested_units_count: needed,
            status: 'active',
            declared_at: now,
            deescalated_at: null,
            notes: `Automated trigger: ${sa.name} workload exceeded 150% threshold (${Math.round(ratio * 100)}% load ratio).`,
          };

          this._declarations.unshift(newDec);
          triggered.push(newDec);
        }
      }
    }

    if (triggered.length > 0) {
      this.save();
    }
    return triggered;
  }

  declareMutualAid({
    serviceAreaId,
    serviceAreaName,
    region,
    jurisdictionId,
    declaredBy = 'COMMANDING_OFFICER',
    requestedUnitsCount = 2,
    targetNeighborJurisdictions = null,
    notes = null,
    workloadPoints = 40.0,
    capacityLimitPoints = 24.0,
  }) {
    const now = Date.now();
    const decId = `MAD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const adjacent = targetNeighborJurisdictions || ADJACENT_JURISDICTIONS[jurisdictionId] || ['JUR-NCR-SOUTH'];
    const ratio = capacityLimitPoints > 0 ? Number((workloadPoints / capacityLimitPoints).toFixed(2)) : 1.0;

    const declaration = {
      id: decId,
      requesting_jurisdiction_id: jurisdictionId,
      service_area_id: serviceAreaId,
      region,
      declared_by: declaredBy,
      trigger_type: 'commander_manual',
      workload_points: workloadPoints,
      capacity_limit_points: capacityLimitPoints,
      workload_ratio: ratio,
      target_neighbor_jurisdictions: adjacent,
      requested_units_count: requestedUnitsCount,
      status: 'active',
      declared_at: now,
      deescalated_at: null,
      notes: notes || `Commander manual declaration: Reinforcement requested for ${serviceAreaName || serviceAreaId}.`,
    };

    this._declarations.unshift(declaration);
    this.save();
    return declaration;
  }

  deescalateDeclaration(declarationId, reason = 'Workload normalized below threshold') {
    const dec = this._declarations.find((d) => d.id === declarationId);
    if (!dec) throw new Error(`Declaration ${declarationId} not found`);

    const now = Date.now();
    dec.status = 'de_escalated';
    dec.deescalated_at = now;
    dec.notes = `${dec.notes || ''} | De-escalated: ${reason}`.trim();

    let sunsetCount = 0;
    for (const deleg of this._guestDelegations) {
      if (deleg.declaration_id === declarationId && deleg.status === 'active') {
        deleg.status = 'revoked';
        deleg.revoked_at = now;
        deleg.revoked_by = 'AUTO_SUNSET_SYSTEM';
        deleg.revocation_reason = `Mutual aid declaration ${declarationId} de-escalated: ${reason}`;
        sunsetCount++;

        this._sunsetAudit.unshift({
          audit_id: `SUNSET-${Math.floor(1000 + Math.random() * 9000)}`,
          delegation_id: deleg.delegation_id,
          guest_officer_id: deleg.guest_officer_id,
          home_jurisdiction_id: deleg.home_jurisdiction_id,
          borrowing_jurisdiction_id: deleg.borrowing_jurisdiction_id,
          target_region: deleg.target_region,
          sunset_reason: 'WORKLOAD_NORMALIZED_BELOW_THRESHOLD',
          details: 'Caseload normalized; guest delegation sunset and access decommissioned.',
          timestamp: now,
        });
      }
    }

    this.save();
    return { declaration: dec, sunset_delegations_count: sunsetCount };
  }

  delegateGuestUnit({
    guestOfficerId,
    homeJurisdictionId,
    borrowingJurisdictionId,
    targetServiceAreaId,
    targetRegion,
    authorizedBy = 'COMMANDING_OFFICER',
    durationHours = 8.0,
    permissions = ['triage', 'respond', 'log_action', 'reassign'],
    declarationId = null,
    notes = null,
  }) {
    const existing = this._guestDelegations.find(
      (g) => g.guest_officer_id === guestOfficerId && g.status === 'active'
    );
    if (existing) {
      throw new Error(`Officer ${guestOfficerId} is already deployed on active delegation ${existing.delegation_id}.`);
    }

    const now = Date.now();
    const validUntil = now + Math.round(durationHours * 3600 * 1000);
    const delId = `GUEST-DEL-${Math.floor(1000 + Math.random() * 9000)}`;

    const delegation = {
      delegation_id: delId,
      declaration_id: declarationId,
      guest_officer_id: guestOfficerId,
      home_jurisdiction_id: homeJurisdictionId,
      home_service_area_id: homeJurisdictionId === 'JUR-NCR-SOUTH' ? 'SA-SOUTH-01' : 'SA-CENTRAL-01',
      borrowing_jurisdiction_id: borrowingJurisdictionId,
      borrowing_service_area_id: targetServiceAreaId,
      target_region: targetRegion || 'Central Zone',
      authorized_by: authorizedBy,
      authorized_at: now,
      valid_from: now,
      valid_until: validUntil,
      permissions,
      status: 'active',
      revocation_reason: null,
      revoked_at: null,
      revoked_by: null,
    };

    this._guestDelegations.unshift(delegation);

    if (declarationId) {
      const dec = this._declarations.find((d) => d.id === declarationId);
      if (dec) {
        const activeCount = this._guestDelegations.filter(
          (d) => d.declaration_id === declarationId && d.status === 'active'
        ).length;
        dec.status = activeCount >= dec.requested_units_count ? 'fulfilled' : 'partially_fulfilled';
      }
    }

    this._sunsetAudit.unshift({
      audit_id: `AUTH-${Math.floor(1000 + Math.random() * 9000)}`,
      delegation_id: delId,
      guest_officer_id: guestOfficerId,
      home_jurisdiction_id: homeJurisdictionId,
      borrowing_jurisdiction_id: borrowingJurisdictionId,
      target_region: targetRegion,
      sunset_reason: 'DISPATCH_AUTHORIZED',
      details: `Temporary access granted for ${durationHours}h. Permanent roster maintained at ${homeJurisdictionId}.`,
      timestamp: now,
    });

    this.save();
    return delegation;
  }

  revokeGuestDelegation(delegationId, { revokedBy = 'COMMANDING_OFFICER', reason = 'Manual command revocation' } = {}) {
    const deleg = this._guestDelegations.find((d) => d.delegation_id === delegationId);
    if (!deleg) throw new Error(`Delegation ${delegationId} not found`);

    const now = Date.now();
    deleg.status = 'revoked';
    deleg.revoked_at = now;
    deleg.revoked_by = revokedBy;
    deleg.revocation_reason = reason;

    this._sunsetAudit.unshift({
      audit_id: `SUNSET-${Math.floor(1000 + Math.random() * 9000)}`,
      delegation_id: delegationId,
      guest_officer_id: deleg.guest_officer_id,
      home_jurisdiction_id: deleg.home_jurisdiction_id,
      borrowing_jurisdiction_id: deleg.borrowing_jurisdiction_id,
      target_region: deleg.target_region,
      sunset_reason: 'COMMAND_REVOCATION',
      details: reason,
      timestamp: now,
    });

    this.save();
    return deleg;
  }

  checkAutoRevocation(incidents = []) {
    const now = Date.now();
    let changed = false;

    for (const deleg of this._guestDelegations) {
      if (deleg.status !== 'active') continue;

      if (now >= deleg.valid_until) {
        deleg.status = 'expired';
        deleg.revoked_at = now;
        deleg.revoked_by = 'AUTO_SUNSET_CLOCK';
        deleg.revocation_reason = 'Time-bounded guest window expired';

        this._sunsetAudit.unshift({
          audit_id: `SUNSET-${Math.floor(1000 + Math.random() * 9000)}`,
          delegation_id: deleg.delegation_id,
          guest_officer_id: deleg.guest_officer_id,
          home_jurisdiction_id: deleg.home_jurisdiction_id,
          borrowing_jurisdiction_id: deleg.borrowing_jurisdiction_id,
          target_region: deleg.target_region,
          sunset_reason: 'DELEGATION_TIMED_EXPIRY',
          details: 'Time-bounded delegation duration completed; session automatically sunset.',
          timestamp: now,
        });
        changed = true;
      }
    }

    if (changed) this.save();
  }

  logGuestAction({ guestOfficerId, incidentId, actionType, details }) {
    const deleg = this._guestDelegations.find(
      (d) => d.guest_officer_id === guestOfficerId && d.status === 'active'
    );

    const now = Date.now();
    const entry = {
      id: `AUDIT-${Math.floor(10000 + Math.random() * 90000)}`,
      delegation_id: deleg?.delegation_id || 'DIRECT_ASSIGNMENT',
      guest_officer_id: guestOfficerId,
      home_jurisdiction_id: deleg?.home_jurisdiction_id || 'JUR-NCR-SOUTH',
      borrowed_jurisdiction_id: deleg?.borrowing_jurisdiction_id || 'JUR-DELHI-METRO',
      incident_id: incidentId,
      action_type: actionType,
      details,
      timestamp: now,
    };

    this._guestAudit.unshift(entry);
    this.save();
    return entry;
  }

  createJointTaskforce({
    name,
    leadJurisdictionId,
    participatingJurisdictionIds,
    monitoredRegions,
    activeTaskforceOfficers,
    targetSyndicateTags = ['digital_arrest', 'mule_network'],
    createdBy = 'COMMANDING_OFFICER',
    notes = null,
  }) {
    const now = Date.now();
    const jtfId = `JTF-${Math.floor(100 + Math.random() * 900)}`;

    const taskforce = {
      id: jtfId,
      name,
      lead_jurisdiction_id: leadJurisdictionId,
      participating_jurisdiction_ids: participatingJurisdictionIds,
      monitored_regions: monitoredRegions,
      active_taskforce_officers: activeTaskforceOfficers,
      target_syndicate_tags: targetSyndicateTags,
      status: 'active',
      created_at: now,
      created_by: createdBy,
      notes,
    };

    this._jointTaskforces.unshift(taskforce);
    this.save();
    return taskforce;
  }

  getJointTaskforceWorkspace(taskforceId, incidents = []) {
    const jtf = this._jointTaskforces.find((t) => t.id === taskforceId);
    if (!jtf) throw new Error(`Joint Taskforce ${taskforceId} not found`);

    const regions = jtf.monitored_regions || [];
    const taskforceIncidents = incidents.filter((i) => regions.includes(i.region));

    const accountCounts = {};
    for (const inc of taskforceIncidents) {
      const acc = inc.linked_account;
      if (acc) {
        if (!accountCounts[acc]) accountCounts[acc] = new Set();
        accountCounts[acc].add(inc.region);
      }
    }

    const crossZoneSyndicates = Object.entries(accountCounts)
      .filter(([, regs]) => regs.size > 1)
      .map(([acc, regs]) => ({
        account_id: acc,
        regions: Array.from(regs),
        incident_count: taskforceIncidents.filter((i) => i.linked_account === acc).length,
      }));

    const activeCount = taskforceIncidents.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;
    const criticalCount = taskforceIncidents.filter(
      (i) => i.severity === 'critical' && ACTIVE_STATUSES.includes(i.status)
    ).length;
    const totalWorkload = taskforceIncidents
      .filter((i) => ACTIVE_STATUSES.includes(i.status))
      .reduce((sum, inc) => sum + (SEVERITY_WEIGHTS[inc.severity] || 0.5), 0);

    return {
      taskforce: jtf,
      aggregated_metrics: {
        monitored_regions_count: regions.length,
        total_incidents: taskforceIncidents.length,
        active_incidents: activeCount,
        critical_incidents: criticalCount,
        combined_workload_points: Number(totalWorkload.toFixed(1)),
        cross_zone_syndicates_detected: crossZoneSyndicates.length,
        active_guest_units_in_regions: this._guestDelegations.filter(
          (g) => regions.includes(g.target_region) && g.status === 'active'
        ).length,
      },
      cross_zone_syndicate_accounts: crossZoneSyndicates,
      incidents: taskforceIncidents,
    };
  }

  evaluateDynamicRebalancing(incidents = [], serviceAreas = []) {
    this.checkWorkloadAndAutoTrigger(incidents, serviceAreas);
    this.checkAutoRevocation(incidents);

    const sectors = serviceAreas.map((sa) => {
      const region = sa.region;
      const active = incidents.filter((i) => i.region === region && ACTIVE_STATUSES.includes(i.status));
      const load = active.reduce((sum, inc) => sum + (SEVERITY_WEIGHTS[inc.severity] || 0.5), 0);
      const cap = Number(sa.capacity_limit_points || 24);
      const activeGuests = this._guestDelegations.filter(
        (g) => g.borrowing_service_area_id === sa.id && g.status === 'active'
      );
      const ratio = cap > 0 ? Number((load / cap).toFixed(2)) : 0;

      return {
        service_area_id: sa.id,
        service_area_name: sa.name,
        region,
        jurisdiction_id: sa.jurisdiction_id,
        capacity_limit_points: cap,
        workload_points: Number(load.toFixed(1)),
        workload_ratio: ratio,
        active_incidents_count: active.length,
        is_overloaded_150: ratio >= 1.5,
        has_surplus_capacity: ratio < 0.7,
        guest_units_count: activeGuests.length,
      };
    });

    const overloaded = sectors.filter((s) => s.is_overloaded_150);
    const surplus = sectors.filter((s) => s.has_surplus_capacity);
    const recommendations = [];

    overloaded.forEach((o, idx) => {
      const donor = surplus.find((s) => s.jurisdiction_id !== o.jurisdiction_id || s.service_area_id !== o.service_area_id);
      if (donor) {
        const unitsNeeded = Math.max(1, Math.ceil((o.workload_points - o.capacity_limit_points) / 6.0));
        const projCap = o.capacity_limit_points + unitsNeeded * 6.0;
        const projRatio = Number((o.workload_points / projCap).toFixed(2));

        recommendations.push({
          recommendation_id: `REC-REBAL-${idx + 1}`,
          overloaded_service_area_id: o.service_area_id,
          overloaded_region: o.region,
          donor_jurisdiction_id: donor.jurisdiction_id,
          donor_service_area_id: donor.service_area_id,
          recommended_units: unitsNeeded,
          projected_workload_ratio_after: projRatio,
          rationales: [
            `${o.service_area_name} operating at ${Math.round(o.workload_ratio * 100)}% capacity (${o.workload_points} / ${o.capacity_limit_points} pts).`,
            `Donor ${donor.service_area_name} has surplus capacity at ${Math.round(donor.workload_ratio * 100)}% load ratio.`,
            `Deploying ${unitsNeeded} guest units will stabilize workload to ${Math.round(projRatio * 100)}% without altering permanent rosters.`,
          ],
        });
      }
    });

    return {
      timestamp: Date.now(),
      sectors,
      overloaded_sectors_count: overloaded.length,
      active_declarations_count: this._declarations.filter((d) => d.status === 'active' || d.status === 'partially_fulfilled').length,
      active_guest_delegations_count: this._guestDelegations.filter((g) => g.status === 'active').length,
      recommendations,
      auto_declarations_triggered: [],
    };
  }
}

export const defaultMutualAidStore = new MutualAidStore();

// ---------- API Wrappers with Live Fallback ----------

export async function fetchMutualAidDataApi(incidents = [], serviceAreas = []) {
  if (Date.now() >= backendDownUntil) {
    try {
      const [declarations, guestDelegations, jointTaskforces, rebalanceEval] = await Promise.all([
        requestBackend('/api/mutual-aid/declarations'),
        requestBackend('/api/mutual-aid/guest-delegations'),
        requestBackend('/api/mutual-aid/joint-taskforces'),
        requestBackend('/api/mutual-aid/rebalance-evaluation'),
      ]);
      return {
        declarations,
        guestDelegations,
        jointTaskforces,
        rebalanceEval,
        source: 'backend',
      };
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }

  // Fallback to local store
  const rebalanceEval = defaultMutualAidStore.evaluateDynamicRebalancing(incidents, serviceAreas);
  return {
    declarations: defaultMutualAidStore.getDeclarations(),
    guestDelegations: defaultMutualAidStore.getGuestDelegations(),
    jointTaskforces: defaultMutualAidStore.getJointTaskforces(),
    rebalanceEval,
    source: 'local',
  };
}

export async function declareMutualAidApi(payload) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend('/api/mutual-aid/declarations', {
        method: 'POST',
        body: JSON.stringify({
          service_area_id: payload.serviceAreaId,
          declared_by: payload.declaredBy || 'COMMANDING_OFFICER',
          requested_units_count: payload.requestedUnitsCount || 2,
          target_neighbor_jurisdictions: payload.targetNeighborJurisdictions || null,
          notes: payload.notes || null,
        }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.declareMutualAid(payload);
}

export async function deescalateDeclarationApi(declarationId, reason = 'Workload normalized below threshold') {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend(`/api/mutual-aid/declarations/${declarationId}/deescalate?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.deescalateDeclaration(declarationId, reason);
}

export async function delegateGuestUnitApi(payload) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend('/api/mutual-aid/guest-delegations', {
        method: 'POST',
        body: JSON.stringify({
          guest_officer_id: payload.guestOfficerId,
          home_jurisdiction_id: payload.homeJurisdictionId,
          borrowing_jurisdiction_id: payload.borrowingJurisdictionId,
          target_service_area_id: payload.targetServiceAreaId,
          authorized_by: payload.authorizedBy || 'COMMANDING_OFFICER',
          duration_hours: payload.durationHours || 8.0,
          permissions: payload.permissions || ['triage', 'respond', 'log_action', 'reassign'],
          declaration_id: payload.declarationId || null,
          notes: payload.notes || null,
        }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.delegateGuestUnit(payload);
}

export async function revokeGuestUnitApi(delegationId, { revokedBy = 'COMMANDING_OFFICER', reason = 'Manual command revocation' } = {}) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend(`/api/mutual-aid/guest-delegations/${delegationId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ revoked_by: revokedBy, reason }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.revokeGuestDelegation(delegationId, { revokedBy, reason });
}

export async function createJointTaskforceApi(payload) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend('/api/mutual-aid/joint-taskforces', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          lead_jurisdiction_id: payload.leadJurisdictionId,
          participating_jurisdiction_ids: payload.participatingJurisdictionIds,
          monitored_regions: payload.monitoredRegions,
          active_taskforce_officers: payload.activeTaskforceOfficers,
          target_syndicate_tags: payload.targetSyndicateTags || ['digital_arrest', 'mule_network'],
          created_by: payload.createdBy || 'COMMANDING_OFFICER',
          notes: payload.notes || null,
        }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.createJointTaskforce(payload);
}

export async function getJointTaskforceWorkspaceApi(taskforceId, incidents = []) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend(`/api/mutual-aid/joint-taskforces/${taskforceId}/workspace`);
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.getJointTaskforceWorkspace(taskforceId, incidents);
}

export async function logGuestActionApi(payload) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend('/api/mutual-aid/guest-action', {
        method: 'POST',
        body: JSON.stringify({
          guest_officer_id: payload.guestOfficerId,
          incident_id: payload.incidentId,
          action_type: payload.actionType,
          details: payload.details,
        }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.logGuestAction(payload);
}

export async function getSunsetAuditLogApi() {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend('/api/mutual-aid/sunset-audit');
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultMutualAidStore.getSunsetAuditLog();
}

