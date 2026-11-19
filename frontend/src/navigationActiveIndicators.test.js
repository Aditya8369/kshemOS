import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PORTALS,
  SECTIONS,
  PORTAL_LABELS,
  getNavigationContext,
  OFFICER_VIEWS,
  CITIZEN_VIEWS,
} from './navigationMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shellSource = readFileSync(join(__dirname, 'components', 'Shell.jsx'), 'utf8');

test('Shell.jsx clearly identifies current destination and active portal in breadcrumb navigation', () => {
  // Breadcrumb landmark navigation
  assert.match(
    shellSource,
    /<nav[^>]*aria-label="Breadcrumb navigation"/,
    'Shell must provide an accessible breadcrumb navigation landmark'
  );

  // aria-current="page" on destination
  assert.match(
    shellSource,
    /<span[^>]*aria-current="page"[^>]*>\{navContext\.destinationLabel\}<\/span>/,
    'Destination item must be marked with aria-current="page"'
  );

  // Non-colour indicator on destination item
  assert.match(
    shellSource,
    /bg-\[var\(--saffron\)\][^>]*aria-hidden="true"/,
    'Active destination item must feature a non-colour visual marker (saffron pip)'
  );

  // Active portal display
  assert.match(
    shellSource,
    /\{navContext\.portalLabel\}/,
    'Active portal label must be displayed clearly in navigation context'
  );
});

test('Shell.jsx provides active portal mode selector and accessible indicators', () => {
  assert.match(
    shellSource,
    /aria-label="Portal Selection"/,
    'Shell must expose an explicit active portal selection group'
  );

  assert.match(
    shellSource,
    /aria-current=\{navContext\.effectivePortal === PORTALS\.CITIZEN \? 'true' : undefined\}/,
    'Citizen Portal selector button must expose aria-current state when active'
  );

  assert.match(
    shellSource,
    /aria-current=\{navContext\.effectivePortal === PORTALS\.OFFICER \? 'true' : undefined\}/,
    'Officer Console selector button must expose aria-current state when active'
  );

  assert.match(
    shellSource,
    /\(active portal\)/,
    'Screen reader text must explicitly state active portal'
  );
});

test('Shell.jsx ensures specialist views reflect correct parent navigation context', () => {
  // Officer specialist view testing
  const officerViews = ['mule-freeze', 'money-trail', 'evidence-affidavit-compiler', 'cli-spoof-detector', 'dpdp-redaction'];
  for (const view of officerViews) {
    const ctx = getNavigationContext(view, 'citizen');
    assert.equal(ctx.effectivePortal, PORTALS.OFFICER);
    assert.equal(ctx.parentSectionKey, SECTIONS.OFFICER_OPERATIONS);
    assert.equal(ctx.activeDropdownKey, 'officer-operations');
  }

  // Citizen specialist view testing
  const citizenViews = ['regional-threat-mesh', 'emergency-killswitch', 'voice-deepfake', 'takedown-generator'];
  for (const view of citizenViews) {
    const ctx = getNavigationContext(view, 'officer');
    assert.equal(ctx.effectivePortal, PORTALS.CITIZEN);
    assert.equal(ctx.parentSectionKey, SECTIONS.CITIZEN_TOOLS);
    assert.equal(ctx.activeDropdownKey, 'citizen-tools');
  }

  // Shell handles parent dropdown context highlighting
  assert.match(
    shellSource,
    /navContext\.activeDropdownKey === menuId/,
    'Dropdown trigger must mark itself active when child specialist view is open'
  );

  assert.match(
    shellSource,
    /\(contains active page\)/,
    'Dropdown trigger must announce active child view to assistive tech'
  );
});

test('Shell.jsx does not rely on colour alone for active states', () => {
  // Non-colour visual cues for active navButtons: saffron indicator pip + ring + sr-only text
  assert.match(
    shellSource,
    /isDirectMatch\s*\?\s*'[^']*ring-2 ring-\[var\(--saffron\)\][^']*font-bold'/,
    'Directly active buttons must use a non-colour ring and bold weight'
  );

  assert.match(
    shellSource,
    /isParentContext\s*\?\s*'[^']*border border-\[var\(--saffron\)\]\/70[^']*font-semibold'/,
    'Parent context buttons must use a distinct border and font weight'
  );

  // Dropdown menu items active state must have checkmark SVG and active dot
  assert.match(
    shellSource,
    /isItemActive\s*\?\s*'[^']*ring-1 ring-\[var\(--saffron\)\]'/,
    'Active dropdown menu items must use a ring for non-colour distinction'
  );

  assert.match(
    shellSource,
    /<svg[^>]*className="w-3\.5 h-3\.5 text-\[var\(--saffron\)\] shrink-0"[^>]*viewBox="0 0 20 20"/,
    'Active dropdown items must render a visual checkmark icon'
  );

  // Mobile menu items active state must have checkmark SVG and ring
  assert.match(
    shellSource,
    /<svg[^>]*className="w-4 h-4 text-\[var\(--saffron\)\] shrink-0"[^>]*viewBox="0 0 20 20"/,
    'Active mobile menu items must render a visual checkmark icon'
  );

  assert.match(
    shellSource,
    /isActive\s*\?\s*'[^']*(?:ring-2 ring-\[var\(--saffron\)\][^']*font-bold|font-bold[^']*ring-2 ring-\[var\(--saffron\)\])/,
    'Active mobile items must use a ring and bold weight'
  );
});
