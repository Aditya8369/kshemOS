import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterIncidents } from './incidentDashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readComponent(filename) {
  return fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
}

const NOW = Date.UTC(2026, 10, 1, 12, 0);
const MIN = 60 * 1000;

function mockIncident(overrides = {}) {
  return {
    id: 'INC-101',
    title: 'Digital arrest coercion attempt',
    description: 'Scammer posing as police officer demanding UPI payment',
    category: 'digital_arrest',
    severity: 'critical',
    region: 'North Zone',
    status: 'new',
    assigned_to: null,
    opened_at: NOW - 15 * MIN,
    first_response_at: null,
    resolved_at: null,
    previous_severity: null,
    linked_account: null,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Criterion 1: Display active filters as removable chips or clear indicators
// -----------------------------------------------------------------------------
test('Criterion 1: FilterChips renders removable chips with accessible remove buttons and category styling', () => {
  const caseListSource = readComponent('components/incidentDashboard/CaseList.jsx');

  // Verify chips support all filter categories
  assert.match(caseListSource, /key:\s*'query'/, 'Must support search query chips');
  assert.match(caseListSource, /key:\s*'region'/, 'Must support region filter chips');
  assert.match(caseListSource, /key:\s*'severity'/, 'Must support severity filter chips');
  assert.match(caseListSource, /key:\s*'escalatingOnly'/, 'Must support escalating filter chips');
  assert.match(caseListSource, /key:\s*'unassignedOnly'/, 'Must support unassigned filter chips');

  // Verify chips have accessible remove buttons with aria-labels and X icons
  assert.match(
    caseListSource,
    /aria-label=\{`Remove filter \$\{chip\.fullLabel\}`\}/,
    'Filter chips must provide accessible aria-label to remove filter'
  );
  assert.match(
    caseListSource,
    /<X[^>]*aria-hidden="true"/,
    'Filter chips must include clear X dismissal icon'
  );

  // Verify filter selection controls exist for direct manipulation
  assert.match(
    caseListSource,
    /<select[\s\S]*?aria-label="Filter by region"/,
    'Must provide region dropdown filter control'
  );
  assert.match(
    caseListSource,
    /<select[\s\S]*?aria-label="Filter by severity"/,
    'Must provide severity dropdown filter control'
  );
  assert.match(
    caseListSource,
    /<input[\s\S]*?aria-label="Filter incidents by keyword or ID"/,
    'Must provide search/ID filter input'
  );
  assert.match(
    caseListSource,
    /aria-label="Toggle escalating incidents only"/,
    'Must provide quick escalating toggle'
  );
  assert.match(
    caseListSource,
    /aria-label="Toggle unassigned incidents only"/,
    'Must provide quick unassigned toggle'
  );
});

// -----------------------------------------------------------------------------
// Criterion 2: Provide a one-action reset to the unfiltered feed
// -----------------------------------------------------------------------------
test('Criterion 2: Provides one-action reset in filter bar, empty state, and dashboard feedback banner', () => {
  const caseListSource = readComponent('components/incidentDashboard/CaseList.jsx');
  const dashboardSource = readComponent('components/IncidentDashboardView.jsx');
  const matrixSource = readComponent('components/incidentDashboard/SeverityRegionTable.jsx');

  // 1. Filter bar one-action reset
  assert.match(
    caseListSource,
    /<button[\s\S]*?onClick=\{onClear\}[\s\S]*?aria-label="Reset all filters to unfiltered feed"/,
    'FilterChips must provide a single-action Reset all filters button when filters are active'
  );
  assert.match(caseListSource, /Reset all filters/, 'Must display clear text for resetting filters');

  // 2. IncidentEmptyState one-action reset
  assert.match(
    caseListSource,
    /<button[\s\S]*?onClick=\{onResetFilters\}[\s\S]*?aria-label=\{`Clear all filters and view all \$\{totalCount\} active cases`\}/,
    'IncidentEmptyState must provide a prominent primary reset button'
  );

  // 3. IncidentDashboardView dashboard-wide reset banner
  assert.match(
    dashboardSource,
    /role="status"[\s\S]*?aria-label="Active filter status summary"/,
    'IncidentDashboardView must surface an active filter summary status'
  );
  assert.match(
    dashboardSource,
    /<button[\s\S]*?onClick=\{handleResetFilters\}[\s\S]*?aria-label="Reset all filters to unfiltered feed"/,
    'IncidentDashboardView must provide a top-level Reset to unfiltered feed button'
  );

  // 4. SeverityRegionTable footer reset to all incidents
  assert.match(
    matrixSource,
    /aria-label=\{`All \$\{breakdown\.totals\.total\} active incidents`\}/,
    'SeverityRegionTable footer total must support clicking to reset to all active incidents'
  );
});

// -----------------------------------------------------------------------------
// Criterion 3: Show the number of matching incidents where the data supports it
// -----------------------------------------------------------------------------
test('Criterion 3: Displays quantitative matching incident counts across filter bar, empty state, and panel', () => {
  const caseListSource = readComponent('components/incidentDashboard/CaseList.jsx');
  const dashboardSource = readComponent('components/IncidentDashboardView.jsx');

  // FilterChips matching counts
  assert.match(
    caseListSource,
    /Showing \{matchingCount\} of \{totalCount\} active cases/,
    'FilterChips must display quantitative feedback: Showing X of Y active cases'
  );
  assert.match(
    caseListSource,
    /\{totalCount - matchingCount\} hidden/,
    'FilterChips must display how many cases are filtered out / hidden'
  );

  // Empty state matching counts
  assert.match(
    caseListSource,
    /0 matching out of \{totalCount\} total active cases/,
    'Empty state must explicitly show 0 matching out of total active cases'
  );

  // Panel title count formatting (e.g. Active cases (3 of 12))
  assert.match(
    dashboardSource,
    /Active cases \(\$\{visible\.length\}\$\{visible\.length !== incidents\.length \? ` of \$\{incidents\.length\}` : ''\}\)/,
    'Drill-down panel title must show matching count vs total count when filtered'
  );

  // Logic verification: filterIncidents returns correct matching counts
  const incidents = [
    mockIncident({ id: 'INC-1', region: 'North Zone', severity: 'critical' }),
    mockIncident({ id: 'INC-2', region: 'North Zone', severity: 'low' }),
    mockIncident({ id: 'INC-3', region: 'South Zone', severity: 'critical' }),
    mockIncident({ id: 'INC-4', region: 'West Zone', severity: 'medium', assigned_to: 'OFF-4' }),
  ];

  assert.equal(filterIncidents(incidents, {}).length, 4, 'Unfiltered count matches total active');
  assert.equal(filterIncidents(incidents, { region: 'North Zone' }).length, 2, 'Region filter count is 2');
  assert.equal(filterIncidents(incidents, { severity: 'critical' }).length, 2, 'Severity filter count is 2');
  assert.equal(filterIncidents(incidents, { region: 'North Zone', severity: 'critical' }).length, 1, 'Combined filter count is 1');
  assert.equal(filterIncidents(incidents, { unassignedOnly: true }).length, 3, 'Unassigned count is 3');
});

// -----------------------------------------------------------------------------
// Criterion 4: Useful no-results state explaining how to clear or adjust filters
// -----------------------------------------------------------------------------
test('Criterion 4: IncidentEmptyState provides rich explanation, individual filter chips, and recovery guidance', () => {
  const caseListSource = readComponent('components/incidentDashboard/CaseList.jsx');

  // Verify empty state container and icon
  assert.match(
    caseListSource,
    /role="region"[^>]*aria-label="No matching incidents feedback"/,
    'IncidentEmptyState must have an accessible region container'
  );
  assert.match(caseListSource, /<FilterX[^>]*size=\{24\}/, 'Must display FilterX diagnostic icon');
  assert.match(caseListSource, /No matching incidents found/, 'Must display clear no-matching-incidents heading');

  // Verify explanation of active filter criteria
  assert.match(
    caseListSource,
    /Active filter criteria:/,
    'Empty state must list active filter criteria'
  );

  // Verify individual removable chips in empty state
  assert.match(
    caseListSource,
    /onClick=\{\(\) => onToggleFilter && onToggleFilter\(chip\.key\)\}/,
    'Empty state must allow removing individual offending filters directly'
  );

  // Verify actionable advice text
  assert.match(
    caseListSource,
    /Adjust or remove specific filters above, or reset to view the entire unfiltered incident feed\./,
    'Must provide explicit instructions on adjusting or resetting filters'
  );

  // Verify IncidentList delegates to IncidentEmptyState when matching cases are 0
  assert.match(
    caseListSource,
    /if \(incidents\.length === 0\) \{\s*return \(\s*<IncidentEmptyState/,
    'IncidentList must render IncidentEmptyState when incidents array is empty'
  );
});
