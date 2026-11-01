/*
 * Operational incident dashboard — incident model and aggregation logic.
 *
 * Incidents come from citizen reports (see `incidentStore.js`). Every
 * aggregation function only depends on this shape:
 *
 *   { id, report_id, title, description, category, severity, previous_severity,
 *     region, status, assigned_to, linked_account,
 *     opened_at, first_response_at, resolved_at }
 *
 * All timestamps are epoch milliseconds. Functions that depend on the current
 * time take `now` explicitly so results are deterministic and testable.
 *
 * `createIncident` and `applyIncidentUpdate` mirror
 * `backend/app/services/incidents.py`, so the dashboard behaves the same when
 * it falls back to browser storage. Keep the two in step.
 */

export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const ACTIVE_STATUSES = ['new', 'triaged', 'in_progress', 'escalated'];
export const STATUSES = [...ACTIVE_STATUSES, 'resolved'];

export const REGIONS = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central Zone'];
export const UNSPECIFIED_REGION = 'Unspecified';

// Minutes allowed between an incident opening and the first officer response.
export const RESPONSE_TARGET_MINUTES = { critical: 30, high: 120, medium: 480, low: 1440 };

// Relative effort a case of each severity places on an officer.
export const SEVERITY_WEIGHT = { critical: 3, high: 2, medium: 1, low: 0.5 };

// Weighted case points one on-duty officer can carry before the desk is stretched.
export const CASE_CAPACITY_PER_OFFICER = 6;

// Load ratio thresholds (weighted load / capacity).
export const LOAD_STRETCHED = 0.8;
export const LOAD_OVERLOADED = 1.0;

// Demand is "rising" when the recent window has this much more intake than the one
// before, by at least this many incidents (so 3-vs-2 noise is not flagged).
export const RISING_DEMAND_FACTOR = 1.25;
export const RISING_DEMAND_MIN_INCREASE = 2;

const TITLE_MAX_LENGTH = 80;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Nobody is on duty until an officer says so — no assumed staffing.
export function defaultStaffing() {
  return REGIONS.map((region) => ({ region, officers_on_duty: 0 }));
}

export function deriveTitle(description) {
  const text = (description || '').split(/\s+/).filter(Boolean).join(' ');
  const firstSentence = text.split('. ')[0];
  if (firstSentence.length <= TITLE_MAX_LENGTH) return firstSentence || 'Untitled report';
  return `${firstSentence.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

export function createIncident({ category, description, region, report_id, linked_account }, { id, severity, now }) {
  return {
    id,
    report_id: report_id || null,
    title: deriveTitle(description),
    description,
    category,
    severity,
    previous_severity: null,
    region: REGIONS.includes(region) ? region : UNSPECIFIED_REGION,
    status: 'new',
    assigned_to: null,
    linked_account: linked_account || null,
    opened_at: now,
    first_response_at: null,
    resolved_at: null,
    updated_at: now,
    version: 1,
    notes: [],
  };
}

/*
 * Apply officer changes. The first officer action — assigning someone or moving
 * the status off "new" — counts as the first response for response targets.
 * Empty strings clear `assigned_to` / `linked_account`.
 */
export function applyIncidentUpdate(incident, changes, now) {
  const updated = { ...incident };

  if (changes.severity && changes.severity !== incident.severity) {
    updated.previous_severity = incident.severity;
    updated.severity = changes.severity;
  }
  if (changes.assigned_to != null) {
    updated.assigned_to = changes.assigned_to.trim() || null;
  }
  if (changes.linked_account != null) {
    updated.linked_account = changes.linked_account.trim().toUpperCase() || null;
  }
  if (changes.status) {
    updated.status = changes.status;
    updated.resolved_at = changes.status === 'resolved' ? incident.resolved_at || now : null;
  }
  if (changes.notes) {
    const note = String(changes.notes).trim();
    if (note) {
      updated.notes = [...(incident.notes || []), note];
    }
  }
  if (updated.first_response_at == null && (updated.assigned_to || updated.status !== 'new')) {
    updated.first_response_at = now;
  }

  updated.version = (incident.version || 1) + 1;
  updated.updated_at = now;

  return updated;
}

/**
 * Detect conflicting field values between local field unit changes and remote server state.
 */
export function detectFieldConflicts(localChanges = {}, serverIncident = {}, baseSnapshot = {}) {
  const conflicts = {};
  const relevantFields = ['status', 'severity', 'assigned_to', 'linked_account'];

  for (const field of relevantFields) {
    if (field in localChanges) {
      const localVal = localChanges[field] ?? null;
      const serverVal = serverIncident[field] ?? null;
      const baseVal = baseSnapshot[field] ?? null;

      // If local changed it, and server also changed it from base, or server differs from local
      if (serverVal !== localVal && serverVal !== baseVal) {
        conflicts[field] = {
          field,
          localValue: localVal,
          serverValue: serverVal,
          baseValue: baseVal,
        };
      }
    }
  }

  return conflicts;
}

export function isActive(incident) {
  return ACTIVE_STATUSES.includes(incident.status);
}

function severityRank(severity) {
  const rank = SEVERITIES.indexOf(severity);
  return rank === -1 ? SEVERITIES.length : rank;
}

export function summarizeBySeverityAndRegion(incidents, regions) {
  const emptyRow = () => Object.fromEntries([...SEVERITIES.map((s) => [s, 0]), ['total', 0]]);
  const rows = Object.fromEntries(regions.map((r) => [r, emptyRow()]));
  const totals = emptyRow();

  for (const incident of incidents) {
    if (!isActive(incident)) continue;
    const row = rows[incident.region] || (rows[incident.region] = emptyRow());
    row[incident.severity] += 1;
    row.total += 1;
    totals[incident.severity] += 1;
    totals.total += 1;
  }

  return { rows, totals };
}

function weightedLoad(incidents) {
  return incidents.reduce((sum, i) => sum + (SEVERITY_WEIGHT[i.severity] || 0), 0);
}

export function coverageStatus(loadRatio) {
  if (loadRatio > LOAD_OVERLOADED) return 'overloaded';
  if (loadRatio >= LOAD_STRETCHED) return 'stretched';
  return 'covered';
}

export function computeCoverage(incidents, staffing) {
  return staffing.map(({ region, officers_on_duty }) => {
    const active = incidents.filter((i) => i.region === region && isActive(i));
    const load = weightedLoad(active);
    const capacity = officers_on_duty * CASE_CAPACITY_PER_OFFICER;
    // No officers on duty with any open work is the worst possible coverage.
    const loadRatio = capacity > 0 ? load / capacity : active.length > 0 ? Infinity : 0;

    return {
      region,
      officers_on_duty,
      active_count: active.length,
      unassigned_count: active.filter((i) => !i.assigned_to).length,
      weighted_load: load,
      capacity,
      load_ratio: loadRatio,
      status: coverageStatus(loadRatio),
    };
  });
}

export function escalationReasons(incident, now) {
  if (!isActive(incident)) return [];
  const reasons = [];

  if (incident.status === 'escalated') {
    reasons.push('Escalated by responding officer');
  }
  if (incident.previous_severity && severityRank(incident.severity) < severityRank(incident.previous_severity)) {
    reasons.push(`Severity raised from ${incident.previous_severity} to ${incident.severity}`);
  }

  const target = RESPONSE_TARGET_MINUTES[incident.severity];
  if (target != null && incident.first_response_at == null) {
    const waited = Math.floor((now - incident.opened_at) / MINUTE);
    if (waited > target) {
      reasons.push(`No response for ${formatDuration(waited)} (target ${formatDuration(target)})`);
    }
  }

  return reasons;
}

export function findEscalations(incidents, now) {
  return incidents
    .map((incident) => ({ incident, reasons: escalationReasons(incident, now) }))
    .filter((e) => e.reasons.length > 0)
    .sort(
      (a, b) =>
        severityRank(a.incident.severity) - severityRank(b.incident.severity) ||
        a.incident.opened_at - b.incident.opened_at
    );
}

function wasActiveAt(incident, t) {
  return incident.opened_at <= t && (incident.resolved_at == null || incident.resolved_at > t);
}

/*
 * Backlog and load ratio per region at hourly points over the last `hours`.
 * Assumes current staffing and severity held for the whole window — there is
 * no staffing or severity history in the data yet.
 */
export function computeLoadTrend(incidents, staffing, now, hours = 12) {
  return staffing.map(({ region, officers_on_duty }) => {
    const regional = incidents.filter((i) => i.region === region);
    const capacity = officers_on_duty * CASE_CAPACITY_PER_OFFICER;
    const points = [];

    for (let h = hours; h >= 0; h -= 1) {
      const t = now - h * HOUR;
      const active = regional.filter((i) => wasActiveAt(i, t));
      const load = weightedLoad(active);
      points.push({
        t,
        active_count: active.length,
        load_ratio: capacity > 0 ? load / capacity : active.length > 0 ? Infinity : 0,
      });
    }

    return { region, points };
  });
}

export function computeDemandTrend(incidents, regions, now, windowHours = 6) {
  const windowMs = windowHours * HOUR;
  return regions.map((region) => {
    const regional = incidents.filter((i) => i.region === region);
    const recent = regional.filter((i) => i.opened_at > now - windowMs && i.opened_at <= now).length;
    const previous = regional.filter(
      (i) => i.opened_at > now - 2 * windowMs && i.opened_at <= now - windowMs
    ).length;
    const rising =
      recent - previous >= RISING_DEMAND_MIN_INCREASE && recent >= previous * RISING_DEMAND_FACTOR;
    return { region, recent, previous, rising };
  });
}

export function filterIncidents(incidents, filters = {}, now = Date.now()) {
  const { region, severity, escalatingOnly, unassignedOnly } = filters;
  return incidents
    .filter((i) => isActive(i))
    .filter((i) => !region || i.region === region)
    .filter((i) => !severity || i.severity === severity)
    .filter((i) => !unassignedOnly || !i.assigned_to)
    .filter((i) => !escalatingOnly || escalationReasons(i, now).length > 0)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.opened_at - b.opened_at);
}

export function getDashboardSnapshot(incidents, staffing, now) {
  const regions = staffing.map((s) => s.region);
  const coverage = computeCoverage(incidents, staffing);
  const escalations = findEscalations(incidents, now);
  const active = incidents.filter(isActive);

  return {
    generated_at: now,
    headline: {
      active: active.length,
      critical: active.filter((i) => i.severity === 'critical').length,
      escalating: escalations.length,
      unassigned: active.filter((i) => !i.assigned_to).length,
      regions_over_capacity: coverage.filter((c) => c.status === 'overloaded').length,
      officers_on_duty: staffing.reduce((sum, s) => sum + s.officers_on_duty, 0),
    },
    breakdown: summarizeBySeverityAndRegion(incidents, regions),
    coverage,
    escalations,
    loadTrend: computeLoadTrend(incidents, staffing, now),
    demand: computeDemandTrend(incidents, regions, now),
  };
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
