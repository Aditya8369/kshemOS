/*
 * Jurisdiction and Zone Configuration Store for KshemOS.
 *
 * Uses the FastAPI backend (`/api/jurisdiction`) when it is reachable.
 * When backend is offline or during testing, falls back to local storage and in-memory
 * state to ensure zero-downtime field operations and test reliability.
 */

const BASE_URL = import.meta.env?.VITE_API_URL || '';

export const JURISDICTIONS_KEY = 'kshemos.jurisdictions.v1';
export const SERVICE_AREAS_KEY = 'kshemos.service_areas.v1';
export const DISPATCH_RULES_KEY = 'kshemos.dispatch_rules.v1';
export const PROPOSALS_KEY = 'kshemos.change_proposals.v1';
export const SNAPSHOTS_KEY = 'kshemos.snapshots.v1';

export const JURISDICTION_CHANGED_EVENT = 'kshemos:jurisdiction-changed';

export const DEFAULT_JURISDICTIONS = [
  {
    id: 'JUR-DELHI-METRO',
    name: 'Delhi Metropolitan Cyber Command',
    code: 'DL-CYBER',
    status: 'active',
    headquarters: 'Central Zone Police HQ, Barakhamba Road',
    contact_officer: 'OFF-DIR-01',
    region_scope: ['Central Zone', 'North Zone', 'East Zone'],
    description: 'Primary metropolitan cyber public safety and fraud response jurisdiction.',
    version: 1,
    updated_at: Date.now(),
  },
  {
    id: 'JUR-NCR-SOUTH',
    name: 'NCR South Cyber & Financial Crime Authority',
    code: 'NCR-SOUTH',
    status: 'active',
    headquarters: 'Cyber Hub Precinct, Sector 29',
    contact_officer: 'OFF-DIR-02',
    region_scope: ['South Zone', 'West Zone'],
    description: 'Specialized jurisdiction for high-value financial fraud, mule networks, and cyber forensics.',
    version: 1,
    updated_at: Date.now(),
  },
];

export const DEFAULT_SERVICE_AREAS = [
  {
    id: 'SA-CENTRAL-01',
    jurisdiction_id: 'JUR-DELHI-METRO',
    name: 'Central Secretariat Cyber Command',
    region: 'Central Zone',
    primary_station: 'Central Cyber Cell Desk',
    boundary_type: 'circle',
    center_lat: 28.6139,
    center_lng: 77.209,
    radius_km: 4.5,
    authorized_units: ['OFF-C1', 'OFF-C2', 'OFF-SPEC-DIGITAL-ARREST'],
    capacity_limit_points: 30,
    risk_level: 'critical',
    status: 'active',
    version: 1,
    updated_at: Date.now(),
  },
  {
    id: 'SA-NORTH-01',
    jurisdiction_id: 'JUR-DELHI-METRO',
    name: 'North University & Transit Sector',
    region: 'North Zone',
    primary_station: 'Civil Lines Cyber Post',
    boundary_type: 'circle',
    center_lat: 28.69,
    center_lng: 77.21,
    radius_km: 5.0,
    authorized_units: ['OFF-N1', 'OFF-N2'],
    capacity_limit_points: 24,
    risk_level: 'moderate',
    status: 'active',
    version: 1,
    updated_at: Date.now(),
  },
  {
    id: 'SA-SOUTH-01',
    jurisdiction_id: 'JUR-NCR-SOUTH',
    name: 'South Financial Corridors',
    region: 'South Zone',
    primary_station: 'Saket Tech Crime Unit',
    boundary_type: 'circle',
    center_lat: 28.5244,
    center_lng: 77.2066,
    radius_km: 6.5,
    authorized_units: ['OFF-S1', 'OFF-S2', 'OFF-S3'],
    capacity_limit_points: 36,
    risk_level: 'high',
    status: 'active',
    version: 1,
    updated_at: Date.now(),
  },
  {
    id: 'SA-EAST-01',
    jurisdiction_id: 'JUR-DELHI-METRO',
    name: 'East Trans-Yamuna Safety Sector',
    region: 'East Zone',
    primary_station: 'East Precinct Cyber Unit',
    boundary_type: 'circle',
    center_lat: 28.62,
    center_lng: 77.3,
    radius_km: 5.5,
    authorized_units: ['OFF-E1', 'OFF-E2'],
    capacity_limit_points: 20,
    risk_level: 'moderate',
    status: 'active',
    version: 1,
    updated_at: Date.now(),
  },
  {
    id: 'SA-WEST-01',
    jurisdiction_id: 'JUR-NCR-SOUTH',
    name: 'West Commercial Sector',
    region: 'West Zone',
    primary_station: 'Janakpuri Cyber Station',
    boundary_type: 'circle',
    center_lat: 28.6219,
    center_lng: 77.0878,
    radius_km: 5.0,
    authorized_units: ['OFF-W1', 'OFF-W2'],
    capacity_limit_points: 24,
    risk_level: 'high',
    status: 'active',
    version: 1,
    updated_at: Date.now(),
  },
];

export const DEFAULT_DISPATCH_RULES = [
  {
    id: 'DISP-RULE-DIGITAL-ARREST',
    name: 'Critical Digital Arrest Priority Dispatch',
    jurisdiction_id: 'JUR-DELHI-METRO',
    service_area_id: 'SA-CENTRAL-01',
    categories: ['scam_call'],
    min_severity: 'critical',
    target_desk: 'OFF-SPEC-DIGITAL-ARREST',
    overflow_service_area_id: 'SA-SOUTH-01',
    priority: 1,
    enabled: true,
    updated_at: Date.now(),
  },
  {
    id: 'DISP-RULE-FIN-FRAUD-SOUTH',
    name: 'South Zone Financial Scam & UPI Overflow Dispatch',
    jurisdiction_id: 'JUR-NCR-SOUTH',
    service_area_id: 'SA-SOUTH-01',
    categories: ['fraud_tx'],
    min_severity: 'high',
    target_desk: 'OFF-S1',
    overflow_service_area_id: 'SA-WEST-01',
    priority: 2,
    enabled: true,
    updated_at: Date.now(),
  },
  {
    id: 'DISP-RULE-GENERAL-NORTH',
    name: 'North Sector General Cyber Intake',
    jurisdiction_id: 'JUR-DELHI-METRO',
    service_area_id: 'SA-NORTH-01',
    categories: ['*'],
    min_severity: 'low',
    target_desk: 'OFF-N1',
    overflow_service_area_id: 'SA-CENTRAL-01',
    priority: 3,
    enabled: true,
    updated_at: Date.now(),
  },
  {
    id: 'DISP-RULE-CURRENCY-WEST',
    name: 'West Sector Counterfeit Currency & Field Operations',
    jurisdiction_id: 'JUR-DELHI-METRO',
    service_area_id: 'SA-WEST-01',
    categories: ['fake_currency', 'counterfeit_currency'],
    min_severity: 'medium',
    target_desk: 'OFF-W1',
    overflow_service_area_id: 'SA-CENTRAL-01',
    priority: 4,
    enabled: true,
    updated_at: Date.now(),
  },
];

export function safeLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Test writability to protect against Node 22 DOMException
      const testKey = '__kshem_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch {
    // Memory fallback
  }
  return null;
}

export function validateBoundaryLocally(existing, proposed, activeIncidentCount = 0) {
  const warnings = [];
  let impactLevel = 'standard';
  let requiresReview = false;
  let coverageGapDetected = false;

  const targetRegion = proposed.region || existing?.region || '';

  // 1. Deactivating with active cases
  if (existing && existing.status === 'active' && (proposed.status === 'inactive' || proposed.status === 'maintenance')) {
    if (activeIncidentCount > 0) {
      warnings.push(`Deactivating service area in ${targetRegion} impacts ${activeIncidentCount} active incident(s).`);
      impactLevel = 'high';
      requiresReview = true;
    }
  }

  // 2. Radius shrink > 25%
  if (existing && existing.radius_km && proposed.radius_km) {
    const oldR = parseFloat(existing.radius_km);
    const newR = parseFloat(proposed.radius_km);
    if (newR < oldR * 0.75) {
      warnings.push(`Boundary radius shrunk by >25% (from ${oldR}km to ${newR}km). Coverage gap detected.`);
      coverageGapDetected = true;
      impactLevel = 'high';
      requiresReview = true;
    }
  }

  // 3. Capacity reduction below active cases
  if (proposed.capacity_limit_points !== undefined && proposed.capacity_limit_points < 12 && activeIncidentCount > 3) {
    warnings.push(`Capacity limit reduced below active workload of ${activeIncidentCount} cases.`);
    impactLevel = 'high';
    requiresReview = true;
  }

  // 4. Coordinates validation
  if (proposed.boundary_type === 'circle') {
    if (proposed.center_lat === undefined || proposed.center_lng === undefined || proposed.radius_km === undefined) {
      return {
        isValid: false,
        impactLevel: 'standard',
        warnings: ['Center coordinates and radius_km are required.'],
        affectedActiveIncidents: activeIncidentCount,
        coverageGapDetected: false,
        requiresReview: false,
      };
    }
  }

  return {
    isValid: true,
    impactLevel,
    warnings,
    affectedActiveIncidents: activeIncidentCount,
    coverageGapDetected,
    requiresReview,
  };
}

export function createLocalJurisdictionStore(storage = safeLocalStorage(), { notify = () => {} } = {}) {
  const memStore = new Map();

  function read(key, fallback) {
    if (storage) {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }
    return memStore.has(key) ? memStore.get(key) : fallback;
  }

  function write(key, value) {
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch {
        memStore.set(key, value);
      }
    } else {
      memStore.set(key, value);
    }
    notify();
  }

  function getJurisdictions() {
    return read(JURISDICTIONS_KEY, DEFAULT_JURISDICTIONS);
  }

  function getServiceAreas() {
    return read(SERVICE_AREAS_KEY, DEFAULT_SERVICE_AREAS);
  }

  function getDispatchRules() {
    return read(DISPATCH_RULES_KEY, DEFAULT_DISPATCH_RULES);
  }

  function getChangeProposals() {
    return read(PROPOSALS_KEY, []);
  }

  function getSnapshots() {
    return read(SNAPSHOTS_KEY, [
      {
        snapshot_id: 'SNAP-BASELINE-001',
        version: 1,
        timestamp: Date.now() - 3600000,
        author: 'SYSTEM_INITIALIZER',
        change_summary: 'Initial baseline jurisdiction configuration',
        impact_level: 'standard',
        jurisdiction_count: DEFAULT_JURISDICTIONS.length,
        service_area_count: DEFAULT_SERVICE_AREAS.length,
        dispatch_rule_count: DEFAULT_DISPATCH_RULES.length,
        jurisdictions: DEFAULT_JURISDICTIONS,
        service_areas: DEFAULT_SERVICE_AREAS,
        dispatch_rules: DEFAULT_DISPATCH_RULES,
      },
    ]);
  }

  function takeSnapshot(author, summary, impactLevel) {
    const snaps = getSnapshots();
    const v = snaps.length + 1;
    const snapId = `SNAP-${Date.now()}-v${v}`;
    const snap = {
      snapshot_id: snapId,
      version: v,
      timestamp: Date.now(),
      author,
      change_summary: summary,
      impact_level: impactLevel,
      jurisdiction_count: getJurisdictions().length,
      service_area_count: getServiceAreas().length,
      dispatch_rule_count: getDispatchRules().length,
      jurisdictions: JSON.parse(JSON.stringify(getJurisdictions())),
      service_areas: JSON.parse(JSON.stringify(getServiceAreas())),
      dispatch_rules: JSON.parse(JSON.stringify(getDispatchRules())),
    };
    snaps.unshift(snap);
    write(SNAPSHOTS_KEY, snaps.slice(0, 50));
    return snap;
  }

  function saveJurisdiction(jur, author = 'OFFICER') {
    const list = [...getJurisdictions()];
    const idx = list.findIndex((j) => j.id === jur.id);
    const updated = {
      ...jur,
      updated_at: Date.now(),
      version: idx >= 0 ? (list[idx].version || 1) + 1 : 1,
    };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    write(JURISDICTIONS_KEY, list);
    takeSnapshot(author, `Saved jurisdiction ${updated.name || updated.id}`, 'standard');
    return updated;
  }

  function saveServiceArea(sa, { forceApply = false, author = 'OFFICER', activeCases = 0 } = {}) {
    const list = [...getServiceAreas()];
    const idx = list.findIndex((item) => item.id === sa.id);
    const existing = idx >= 0 ? list[idx] : null;

    const validation = validateBoundaryLocally(existing, sa, activeCases);

    if (validation.requiresReview && !forceApply) {
      const proposals = getChangeProposals();
      const propId = `PROP-${Date.now()}`;
      const proposal = {
        id: propId,
        entity_type: 'service_area',
        entity_id: sa.id || 'NEW_SA',
        proposed_by: author,
        change_summary: `Boundary / capacity revision for ${sa.name || sa.id}`,
        impact_level: 'high',
        status: 'pending',
        validation,
        proposed_payload: sa,
        original_payload: existing,
        created_at: Date.now(),
        reviewed_by: null,
        reviewed_at: null,
        reviewer_notes: null,
      };
      proposals.unshift(proposal);
      write(PROPOSALS_KEY, proposals);
      return {
        requires_review: true,
        proposal_id: propId,
        validation,
        message: 'High-impact boundary change detected. Staged for review.',
      };
    }

    const updated = {
      ...sa,
      updated_at: Date.now(),
      version: existing ? (existing.version || 1) + 1 : 1,
    };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    write(SERVICE_AREAS_KEY, list);
    takeSnapshot(author, `Saved service area ${updated.name || updated.id}`, validation.impactLevel);
    return {
      requires_review: false,
      service_area: updated,
      validation,
    };
  }

  function reviewChangeProposal(proposalId, { reviewerCode, decision, reviewerNotes }) {
    const proposals = getChangeProposals();
    const prop = proposals.find((p) => p.id === proposalId);
    if (!prop) return null;

    prop.status = decision;
    prop.reviewed_by = reviewerCode;
    prop.reviewed_at = Date.now();
    prop.reviewer_notes = reviewerNotes;

    let appliedEntity = null;
    if (decision === 'approved' && prop.entity_type === 'service_area') {
      const res = saveServiceArea(prop.proposed_payload, {
        forceApply: true,
        author: `${reviewerCode} (Approved ${prop.proposed_by})`,
      });
      appliedEntity = res.service_area;
    }

    write(PROPOSALS_KEY, proposals);
    return { proposal: prop, applied_entity: appliedEntity };
  }

  function saveDispatchRule(rule, author = 'OFFICER') {
    const list = [...getDispatchRules()];
    const idx = list.findIndex((r) => r.id === rule.id);
    const updated = { ...rule, updated_at: Date.now() };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    write(DISPATCH_RULES_KEY, list);
    takeSnapshot(author, `Saved dispatch rule ${updated.name || updated.id}`, 'standard');
    return updated;
  }

  function deleteDispatchRule(ruleId) {
    const list = getDispatchRules().filter((r) => r.id !== ruleId);
    write(DISPATCH_RULES_KEY, list);
    takeSnapshot('OFFICER', `Deleted dispatch rule ${ruleId}`, 'standard');
    return true;
  }

  function restoreSnapshot(snapshotId, restoredBy = 'OFFICER') {
    const snaps = getSnapshots();
    const target = snaps.find((s) => s.snapshot_id === snapshotId);
    if (!target) return null;

    write(JURISDICTIONS_KEY, target.jurisdictions || DEFAULT_JURISDICTIONS);
    write(SERVICE_AREAS_KEY, target.service_areas || DEFAULT_SERVICE_AREAS);
    write(DISPATCH_RULES_KEY, target.dispatch_rules || DEFAULT_DISPATCH_RULES);

    const rollbackSnap = takeSnapshot(
      restoredBy,
      `Rolled back configuration to snapshot ${snapshotId} (v${target.version})`,
      'high'
    );
    return rollbackSnap;
  }

  function matchDispatchRule(category, severity, region) {
    const sevRank = { low: 0, medium: 1, high: 2, critical: 3 };
    const incidentRank = sevRank[severity] ?? 0;
    const rules = getDispatchRules();
    const areas = getServiceAreas();

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const cats = rule.categories || [];
      if (!cats.includes('*') && !cats.includes(category)) continue;

      const minSev = rule.min_severity || 'low';
      if (incidentRank < (sevRank[minSev] ?? 0)) continue;

      const sa = areas.find((a) => a.id === rule.service_area_id);
      if (sa && sa.region !== region) continue;

      return rule;
    }
    return null;
  }

  return {
    getJurisdictions,
    getServiceAreas,
    getDispatchRules,
    getChangeProposals,
    getSnapshots,
    saveJurisdiction,
    saveServiceArea,
    reviewChangeProposal,
    saveDispatchRule,
    deleteDispatchRule,
    restoreSnapshot,
    matchDispatchRule,
    validateBoundary: (existing, proposed, activeCases) =>
      validateBoundaryLocally(existing, proposed, activeCases),
  };
}

// Global default store instance
export const defaultJurisdictionStore = createLocalJurisdictionStore(safeLocalStorage(), {
  notify: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(JURISDICTION_CHANGED_EVENT));
    }
  },
});

/*
 * Backend-aware API methods with automatic fallback to local store.
 */
let backendDownUntil = 0;
const BACKEND_RETRY_MS = 20 * 1000;

async function requestBackend(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    throw Object.assign(new Error('Backend not available'), { unavailable: true });
  }
  const body = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(body.detail || 'Request failed'), { status: res.status });
  }
  return body;
}

export async function fetchJurisdictionData() {
  if (Date.now() >= backendDownUntil) {
    try {
      const [jurisdictions, serviceAreas, dispatchRules, proposals, snapshots] = await Promise.all([
        requestBackend('/api/jurisdiction/jurisdictions'),
        requestBackend('/api/jurisdiction/service-areas'),
        requestBackend('/api/jurisdiction/dispatch-rules'),
        requestBackend('/api/jurisdiction/proposals'),
        requestBackend('/api/jurisdiction/snapshots'),
      ]);
      backendDownUntil = 0;
      return {
        jurisdictions,
        serviceAreas,
        dispatchRules,
        proposals,
        snapshots,
        source: 'backend',
      };
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }

  return {
    jurisdictions: defaultJurisdictionStore.getJurisdictions(),
    serviceAreas: defaultJurisdictionStore.getServiceAreas(),
    dispatchRules: defaultJurisdictionStore.getDispatchRules(),
    proposals: defaultJurisdictionStore.getChangeProposals(),
    snapshots: defaultJurisdictionStore.getSnapshots(),
    source: 'local',
  };
}

export async function validateBoundaryApi(payload, existingId) {
  if (Date.now() >= backendDownUntil) {
    try {
      const query = existingId ? `?existing_id=${encodeURIComponent(existingId)}` : '';
      return await requestBackend(`/api/jurisdiction/validate-boundary${query}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  const existing = defaultJurisdictionStore.getServiceAreas().find((sa) => sa.id === (existingId || payload.id));
  return defaultJurisdictionStore.validateBoundary(existing, payload, 2);
}

export async function saveServiceAreaApi(payload, { forceApply = false, author = 'OFFICER' } = {}) {
  if (Date.now() >= backendDownUntil) {
    try {
      const query = forceApply ? '?force_apply=true' : '';
      return await requestBackend(`/api/jurisdiction/service-areas${query}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultJurisdictionStore.saveServiceArea(payload, { forceApply, author });
}

export async function reviewProposalApi(proposalId, { reviewerCode, decision, reviewerNotes }) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend(`/api/jurisdiction/proposals/${proposalId}/review`, {
        method: 'POST',
        body: JSON.stringify({ reviewer_code: reviewerCode, decision, reviewer_notes: reviewerNotes }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultJurisdictionStore.reviewChangeProposal(proposalId, { reviewerCode, decision, reviewerNotes });
}

export async function restoreSnapshotApi(snapshotId, restoredBy = 'OFFICER') {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend(`/api/jurisdiction/snapshots/${snapshotId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ restored_by: restoredBy }),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultJurisdictionStore.restoreSnapshot(snapshotId, restoredBy);
}

export async function saveDispatchRuleApi(payload, author = 'OFFICER') {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend('/api/jurisdiction/dispatch-rules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultJurisdictionStore.saveDispatchRule(payload, author);
}

export async function deleteDispatchRuleApi(ruleId) {
  if (Date.now() >= backendDownUntil) {
    try {
      return await requestBackend(`/api/jurisdiction/dispatch-rules/${ruleId}`, {
        method: 'DELETE',
      });
    } catch {
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return defaultJurisdictionStore.deleteDispatchRule(ruleId);
}
