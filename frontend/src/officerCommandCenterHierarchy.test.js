import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SAMPLE_ACCOUNTS,
  WORKSPACE_SECTIONS,
  TABS,
  getVisibleTabs,
  getTabMeta,
  getUrgentTabs,
} from './officerCommandCenterData.js';
import { CONTAINER_VARIANTS, HEADER_TYPOGRAPHY, CARD_SURFACES } from './layoutStyles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readComponent(filename) {
  return fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
}

test('Criterion 1: WORKSPACE_SECTIONS groups workspaces into operations, incidents, and investigation', () => {
  assert.ok(Array.isArray(WORKSPACE_SECTIONS), 'WORKSPACE_SECTIONS must be an array');
  assert.equal(WORKSPACE_SECTIONS.length, 4, 'Must have All + 3 functional categories');

  const sectionIds = WORKSPACE_SECTIONS.map((s) => s.id);
  assert.deepEqual(sectionIds, ['all', 'operations', 'incidents', 'investigation']);

  const operations = WORKSPACE_SECTIONS.find((s) => s.id === 'operations');
  assert.ok(operations.label.includes('Operational Summary'));
  assert.deepEqual(operations.tabs, ['incidents', 'jurisdiction']);

  const incidents = WORKSPACE_SECTIONS.find((s) => s.id === 'incidents');
  assert.ok(incidents.label.includes('Active Incidents') || incidents.label.includes('Fast Response'));
  assert.deepEqual(incidents.tabs, ['freeze', 'cli-spoof']);

  const investigation = WORKSPACE_SECTIONS.find((s) => s.id === 'investigation');
  assert.ok(investigation.label.includes('Investigation'));
  assert.deepEqual(investigation.tabs, [
    'copilot',
    'tools',
    'syndicate',
    'evidence',
    'affidavit',
    'dpdp',
  ]);

  // Ensure all tabs map to a declared functional section
  const totalTabsCovered = [
    ...operations.tabs,
    ...incidents.tabs,
    ...investigation.tabs,
  ];
  assert.equal(totalTabsCovered.length, 10, 'All 10 tabs must belong to a functional section');
  for (const t of TABS) {
    assert.ok(
      totalTabsCovered.includes(t.key),
      `Tab key "${t.key}" must be included in one of the sections`
    );
  }

  // Verify helper functions
  assert.equal(getVisibleTabs('all').length, 10, 'All section returns all 10 tabs');
  assert.equal(getVisibleTabs('operations').length, 2, 'Operations section returns 2 tabs');
  assert.equal(getVisibleTabs('incidents').length, 2, 'Incidents section returns 2 tabs');
  assert.equal(getVisibleTabs('investigation').length, 6, 'Investigation section returns 6 tabs');

  const freezeMeta = getTabMeta('freeze');
  assert.equal(freezeMeta.label, 'UPI Mule Freeze (1930)');
  assert.equal(freezeMeta.urgent, true);

  const urgentTabs = getUrgentTabs();
  assert.equal(urgentTabs.length, 2);
  assert.ok(urgentTabs.some((t) => t.key === 'freeze'));
  assert.ok(urgentTabs.some((t) => t.key === 'cli-spoof'));
});

test('Criterion 2: Time-sensitive information and rapid-response actions are prominent', () => {
  const componentSrc = readComponent('components/OfficerCommandCenter.jsx');

  // Verify time-sensitive operational alert ticker region
  assert.match(
    componentSrc,
    /<section[^>]*role="region"[^>]*aria-label="Operational Summary and Time-Sensitive Alerts"/,
    'Must render a prominent landmark section for operational alerts'
  );

  // Verify Priority 1 Critical and Escalation SLA Alert indicators
  assert.match(componentSrc, /Priority 1 · Immediate Action/, 'Must show P1 Immediate Action alert');
  assert.match(componentSrc, /animate-ping/, 'P1 badge must have animated visual urgency pulse');
  assert.match(componentSrc, /Escalation SLA Alert/, 'Must show Escalation SLA warning indicator');

  // Verify Fast-Action Priority Shortcuts
  assert.match(
    componentSrc,
    /1930 Fast-Freeze Desk/,
    'Must provide immediate shortcut button to 1930 Mule Freeze desk'
  );
  assert.match(
    componentSrc,
    /Active Incident Feed/,
    'Must provide immediate shortcut button to live incidents feed'
  );

  // Verify urgent tab metadata
  const urgentTabs = TABS.filter((t) => t.urgent);
  assert.equal(urgentTabs.length, 2, 'Freeze and CLI-Spoof must be flagged as urgent');
  assert.ok(urgentTabs.some((t) => t.key === 'freeze'));
  assert.ok(urgentTabs.some((t) => t.key === 'cli-spoof'));
});

test('Criterion 3: Standardise section headings, spacing, and panel styles', () => {
  const componentSrc = readComponent('components/OfficerCommandCenter.jsx');

  // Uses layoutStyles tokens
  assert.ok(
    componentSrc.includes('CONTAINER_VARIANTS.officer'),
    'Must use CONTAINER_VARIANTS.officer for outer container'
  );
  assert.ok(
    componentSrc.includes('CARD_SURFACES.officerPanel'),
    'Must use CARD_SURFACES.officerPanel for standardized panels'
  );
  assert.ok(
    componentSrc.includes('HEADER_TYPOGRAPHY.eyebrowOfficer'),
    'Must use standardized officer eyebrow typography'
  );
  assert.ok(
    componentSrc.includes('HEADER_TYPOGRAPHY.titleOfficer'),
    'Must use standardized officer title typography'
  );

  // Check layoutStyles contracts
  assert.ok(CONTAINER_VARIANTS.officer.includes('max-w-7xl'));
  assert.ok(CARD_SURFACES.officerPanel.includes('var(--navy)'));
  assert.ok(HEADER_TYPOGRAPHY.titleOfficer.includes('font-display'));

  // Standardized active module context header
  assert.match(
    componentSrc,
    /currentTabMeta\.sectionName/,
    'Must display breadcrumb/hierarchy section name in context header'
  );
  assert.match(
    componentSrc,
    /currentTabMeta\.tag/,
    'Must display subsystem tag in context header'
  );
});

test('Criterion 4: Preserves all existing officer workflows, tabs, and responsive behaviour', () => {
  const componentSrc = readComponent('components/OfficerCommandCenter.jsx');

  // All 10 tab workflows present
  const requiredViews = [
    '<IncidentDashboardView',
    '<MuleFreezeDispatchView',
    '<JurisdictionConfigView',
    '<EvidenceGroundedCopilotView',
    '<CliSpoofDetectorView',
    '<EvidenceVaultView',
    '<DpdpRedactionView',
    '<Section63AffidavitCompilerView',
    '<SyndicateTriageView',
    '<GraphPanel',
    '<CaseSummaryPanel',
  ];
  for (const view of requiredViews) {
    assert.ok(componentSrc.includes(view), `Must preserve view component: ${view}`);
  }

  // Mobile horizontal scroll wrapper for tablist
  assert.match(
    componentSrc,
    /overflow-x-auto[^>]*>\s*<div[^>]*role="tablist"/,
    'Tablist must be wrapped in overflow-x-auto to prevent mobile horizontal clipping'
  );

  // Critical accessibility labels preserved
  assert.match(
    componentSrc,
    /aria-label="Account ID to trace fraud ring"/,
    'Must preserve Account ID input aria-label'
  );
  assert.match(
    componentSrc,
    /aria-label="Analyst access token"/,
    'Must preserve Analyst access token input aria-label'
  );
  assert.match(
    componentSrc,
    /aria-label="Report ID to summarize"/,
    'Must preserve Report ID input aria-label'
  );

  // Sample account quick-buttons preserved
  assert.ok(Array.isArray(SAMPLE_ACCOUNTS) && SAMPLE_ACCOUNTS.length >= 4);
  assert.match(
    componentSrc,
    /SAMPLE_ACCOUNTS\.map/,
    'Must preserve sample accounts quick-lookup buttons'
  );
});
