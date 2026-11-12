import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIONS,
  UNSPECIFIED_REGION,
  applyIncidentUpdate,
  computeCoverage,
  computeDemandTrend,
  computeLoadTrend,
  createIncident,
  defaultStaffing,
  deriveTitle,
  escalationReasons,
  filterIncidents,
  findEscalations,
  getDashboardSnapshot,
  summarizeBySeverityAndRegion,
} from './incidentDashboard.js';
import { createLocalIncidentStore } from './incidentStore.js';

const NOW = Date.UTC(2026, 10, 1, 12, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function incident(overrides) {
  return {
    id: 'INC-1',
    title: 'Test incident',
    category: 'scam_call',
    severity: 'medium',
    region: 'North',
    status: 'triaged',
    assigned_to: 'OFF-1',
    opened_at: NOW - 30 * MIN,
    first_response_at: NOW - 20 * MIN,
    resolved_at: null,
    previous_severity: null,
    linked_account: null,
    ...overrides,
  };
}

test('groups only active incidents by severity and region', () => {
  const incidents = [
    incident({ id: 'a', region: 'North', severity: 'critical' }),
    incident({ id: 'b', region: 'North', severity: 'low' }),
    incident({ id: 'c', region: 'South', severity: 'critical' }),
    incident({ id: 'd', region: 'South', severity: 'high', status: 'resolved', resolved_at: NOW - MIN }),
  ];

  const { rows, totals } = summarizeBySeverityAndRegion(incidents, ['North', 'South', 'East']);

  assert.deepEqual(rows.North, { critical: 1, high: 0, medium: 0, low: 1, total: 2 });
  assert.deepEqual(rows.South, { critical: 1, high: 0, medium: 0, low: 0, total: 1 });
  assert.equal(rows.East.total, 0, 'regions with no incidents still appear');
  assert.equal(totals.total, 3);
  assert.equal(totals.critical, 2);
});

test('computes severity-weighted load against officer capacity', () => {
  const incidents = [
    incident({ id: 'a', severity: 'critical' }), // 3
    incident({ id: 'b', severity: 'critical' }), // 3
    incident({ id: 'c', severity: 'high', assigned_to: null }), // 2
    incident({ id: 'd', severity: 'high', status: 'resolved' }), // ignored
  ];

  const [north] = computeCoverage(incidents, [{ region: 'North', officers_on_duty: 1 }]);

  assert.equal(north.weighted_load, 8);
  assert.equal(north.capacity, 6);
  assert.equal(north.active_count, 3);
  assert.equal(north.unassigned_count, 1);
  assert.equal(north.status, 'overloaded');
});

test('classifies coverage as covered, stretched, or overloaded', () => {
  const staffing = [{ region: 'North', officers_on_duty: 1 }];
  const status = (severities) =>
    computeCoverage(severities.map((severity, n) => incident({ id: `i${n}`, severity })), staffing)[0].status;

  assert.equal(status(['high', 'high']), 'covered'); // 4 / 6
  assert.equal(status(['critical', 'high']), 'stretched'); // 5 / 6
  assert.equal(status(['critical', 'critical']), 'stretched'); // exactly at capacity
  assert.equal(status(['critical', 'critical', 'low']), 'overloaded'); // 6.5 / 6
});

test('treats a region with open work and no officers as overloaded', () => {
  const [region] = computeCoverage([incident({ severity: 'low' })], [{ region: 'North', officers_on_duty: 0 }]);
  assert.equal(region.status, 'overloaded');
});

test('flags missed response targets, raised severity, and manual escalation', () => {
  const late = incident({ severity: 'critical', opened_at: NOW - 45 * MIN, first_response_at: null });
  const onTime = incident({ severity: 'critical', opened_at: NOW - 10 * MIN, first_response_at: null });
  const raised = incident({ severity: 'high', previous_severity: 'medium' });
  const escalated = incident({ status: 'escalated' });
  const resolved = incident({ status: 'resolved', previous_severity: 'low', severity: 'high' });

  assert.match(escalationReasons(late, NOW)[0], /No response for 45m \(target 30m\)/);
  assert.deepEqual(escalationReasons(onTime, NOW), []);
  assert.deepEqual(escalationReasons(raised, NOW), ['Severity raised from medium to high']);
  assert.deepEqual(escalationReasons(escalated, NOW), ['Escalated by responding officer']);
  assert.deepEqual(escalationReasons(resolved, NOW), [], 'resolved incidents never escalate');
});

test('orders escalations by severity, then oldest first', () => {
  const list = findEscalations(
    [
      incident({ id: 'medium-old', status: 'escalated', severity: 'medium', opened_at: NOW - 5 * HOUR }),
      incident({ id: 'critical-new', status: 'escalated', severity: 'critical', opened_at: NOW - HOUR }),
      incident({ id: 'critical-old', status: 'escalated', severity: 'critical', opened_at: NOW - 2 * HOUR }),
    ],
    NOW
  );

  assert.deepEqual(
    list.map((e) => e.incident.id),
    ['critical-old', 'critical-new', 'medium-old']
  );
});

test('reconstructs backlog over time from open and resolve timestamps', () => {
  const incidents = [
    incident({ id: 'a', severity: 'critical', opened_at: NOW - 3 * HOUR, resolved_at: NOW - HOUR, status: 'resolved' }),
    incident({ id: 'b', severity: 'critical', opened_at: NOW - 30 * MIN }),
  ];

  const [north] = computeLoadTrend(incidents, [{ region: 'North', officers_on_duty: 1 }], NOW, 4);
  const counts = north.points.map((p) => p.active_count);

  // Points at now-4h, -3h, -2h, -1h, now.
  assert.deepEqual(counts, [0, 1, 1, 0, 1]);
  assert.equal(north.points.at(-1).load_ratio, 0.5);
});

test('marks demand as rising only when recent intake clearly exceeds the prior window', () => {
  const opened = (hoursAgo) => incident({ id: `${hoursAgo}`, opened_at: NOW - hoursAgo * HOUR });
  const incidents = [opened(1), opened(2), opened(3), opened(4), opened(7), opened(8)];

  const [north] = computeDemandTrend(incidents, ['North'], NOW);
  assert.deepEqual(north, { region: 'North', recent: 4, previous: 2, rising: true });

  const [noise] = computeDemandTrend([opened(1), opened(2), opened(3), opened(7), opened(8)], ['North'], NOW);
  assert.equal(noise.rising, false, 'one extra incident is noise, not a trend');

  const [fromZero] = computeDemandTrend([opened(1)], ['North'], NOW);
  assert.equal(fromZero.rising, false, 'a single new incident is not a trend');
});

test('filters the drill-down list without losing active-only scope', () => {
  const incidents = [
    incident({ id: 'a', title: 'Digital arrest coercion scam', region: 'North', severity: 'critical', assigned_to: null }),
    incident({ id: 'b', title: 'Fake electricity bill SMS', region: 'North', severity: 'low', assigned_to: 'OFF-1' }),
    incident({ id: 'c', title: 'Part-time job Ponzi lure', region: 'South', severity: 'critical', assigned_to: null }),
    incident({ id: 'd', title: 'Phishing refund email', region: 'North', severity: 'critical', status: 'resolved' }),
  ];

  assert.deepEqual(filterIncidents(incidents, { region: 'North' }, NOW).map((i) => i.id), ['a', 'b']);
  assert.deepEqual(filterIncidents(incidents, { region: 'North', severity: 'critical' }, NOW).map((i) => i.id), ['a']);
  assert.deepEqual(filterIncidents(incidents, { unassignedOnly: true }, NOW).map((i) => i.id), ['a', 'c']);
  assert.deepEqual(filterIncidents(incidents, { query: 'digital arrest' }, NOW).map((i) => i.id), ['a']);
  assert.deepEqual(filterIncidents(incidents, { query: 'OFF-1' }, NOW).map((i) => i.id), ['b']);
  assert.deepEqual(filterIncidents(incidents, { region: 'North', query: 'electricity' }, NOW).map((i) => i.id), ['b']);
  assert.deepEqual(filterIncidents(incidents, { region: 'South', query: 'electricity' }, NOW), [], 'returns empty array when filters match no incidents');
});

test('creates new incidents from citizen reports with no response yet', () => {
  const created = createIncident(
    { category: 'scam_call', description: 'CBI caller says I am under digital arrest. He wants money.', region: 'West Zone', report_id: 'RPT-1' },
    { id: 'INC-1', severity: 'critical', now: NOW }
  );

  assert.equal(created.title, 'CBI caller says I am under digital arrest');
  assert.equal(created.status, 'new');
  assert.equal(created.opened_at, NOW);
  assert.equal(created.first_response_at, null);
  assert.equal(created.report_id, 'RPT-1');

  const nowhere = createIncident({ category: 'other', description: 'x', region: 'Mars' }, { id: 'INC-2', severity: 'low', now: NOW });
  assert.equal(nowhere.region, UNSPECIFIED_REGION);
});

test('truncates long titles', () => {
  const title = deriveTitle('word '.repeat(40));
  assert.equal(title.length, 80);
  assert.ok(title.endsWith('…'));
});

test('applies officer updates: first response, raised severity, resolve and reopen', () => {
  const opened = incident({ status: 'new', assigned_to: null, first_response_at: null, severity: 'medium' });

  const assigned = applyIncidentUpdate(opened, { assigned_to: ' OFF-1 ' }, NOW);
  assert.equal(assigned.assigned_to, 'OFF-1');
  assert.equal(assigned.first_response_at, NOW, 'assignment counts as the first response');

  const raised = applyIncidentUpdate(assigned, { severity: 'critical' }, NOW + MIN);
  assert.equal(raised.previous_severity, 'medium');
  assert.deepEqual(escalationReasons(raised, NOW + MIN), ['Severity raised from medium to critical']);

  const resolved = applyIncidentUpdate(raised, { status: 'resolved' }, NOW + 2 * MIN);
  assert.equal(resolved.resolved_at, NOW + 2 * MIN);

  const reopened = applyIncidentUpdate(resolved, { status: 'in_progress' }, NOW + 3 * MIN);
  assert.equal(reopened.resolved_at, null);

  const unassigned = applyIncidentUpdate(reopened, { assigned_to: '' }, NOW + 4 * MIN);
  assert.equal(unassigned.assigned_to, null);
  assert.equal(unassigned.first_response_at, NOW, 'first response time is kept');

  const triaged = applyIncidentUpdate(opened, { status: 'triaged' }, NOW);
  assert.equal(triaged.first_response_at, NOW, 'leaving "new" counts as the first response');
});

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('local fallback store starts empty and records reports, updates, and staffing', () => {
  const store = createLocalIncidentStore(memoryStorage());

  const empty = store.feed();
  assert.deepEqual(empty.incidents, []);
  assert.deepEqual(empty.staffing, defaultStaffing());
  assert.deepEqual(empty.regions, REGIONS);

  const created = store.create(
    {
      category: 'scam_call',
      region: 'North Zone',
      description: 'This is the CBI. You are under digital arrest and must transfer the verification amount now.',
    },
    NOW
  );
  assert.equal(created.id, 'INC-L0001');
  assert.equal(created.severity, 'critical', 'severity comes from the scam rule engine');

  store.update(created.id, { assigned_to: 'OFF-N1' }, NOW + MIN);
  store.setStaffing('North Zone', 2);

  const feed = store.feed();
  assert.equal(feed.incidents[0].assigned_to, 'OFF-N1');
  assert.equal(feed.staffing.find((s) => s.region === 'North Zone').officers_on_duty, 2);
  assert.equal(store.create({ category: 'other', description: 'x' }, NOW).id, 'INC-L0002');

  assert.throws(() => store.update('INC-NOPE', { status: 'triaged' }), /not found/);
  assert.throws(() => store.setStaffing('Mars', 1), /Unknown region/);
});

test('headline counts match the breakdown and coverage for the same feed', () => {
  const incidents = [
    incident({ id: 'a', region: 'North Zone', severity: 'critical' }),
    incident({ id: 'b', region: 'West Zone', severity: 'low', assigned_to: null }),
    incident({ id: 'c', region: 'West Zone', status: 'resolved', resolved_at: NOW - MIN }),
  ];
  const staffing = defaultStaffing();

  const snapshot = getDashboardSnapshot(incidents, staffing, NOW);
  assert.equal(snapshot.headline.active, 2);
  assert.equal(snapshot.headline.active, snapshot.breakdown.totals.total);
  assert.equal(snapshot.headline.active, snapshot.coverage.reduce((sum, c) => sum + c.active_count, 0));
  assert.equal(snapshot.headline.unassigned, 1);
  assert.equal(snapshot.headline.regions_over_capacity, 2, 'open work with nobody on duty is over capacity');
});
