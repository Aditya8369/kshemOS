import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readComponent(filename) {
  return fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
}

test('FraudGraphView: Relationship legend is readable and visually consistent with edge types', () => {
  const code = readComponent('components/FraudGraphView.jsx');

  // Verify EDGE_CONFIG contains all relationship types with accurate line properties
  assert.match(
    code,
    /HARVESTED_HONEYPOT_BENEFICIARY:\s*\{[^}]*color:\s*'#f43f5e'[^}]*strokeDasharray:\s*'4 2'/s,
    'EDGE_CONFIG must define HARVESTED_HONEYPOT_BENEFICIARY with dashed stroke matching edge style'
  );
  assert.match(
    code,
    /SHARED_DEVICE:\s*\{[^}]*color:\s*'#ff7a1a'/s,
    'EDGE_CONFIG must define SHARED_DEVICE with orange stroke'
  );
  assert.match(
    code,
    /SAME_IP:\s*\{[^}]*color:\s*'#f2a93b'/s,
    'EDGE_CONFIG must define SAME_IP with amber stroke'
  );
  assert.match(
    code,
    /TRANSACTED_WITH:\s*\{[^}]*color:\s*'#5fb3d9'/s,
    'EDGE_CONFIG must define TRANSACTED_WITH with cyan/blue stroke'
  );

  // Verify the legend uses SVG line swatches instead of generic circular dots
  assert.match(
    code,
    /<svg[^>]*>\s*<line[^>]*stroke=\{config\.color\}[^>]*strokeWidth=\{config\.strokeWidth\}[^>]*strokeDasharray=\{config\.strokeDasharray\}/s,
    'Legend must render line swatches matching edge color, width, and dash style'
  );
  assert.doesNotMatch(
    code,
    /<span className="w-2 h-2 rounded-full bg-\[#[0-9a-fA-F]+\] inline-block" \/>/,
    'Legend must not use ambiguous round dots to represent edge types'
  );

  // Verify accessible region and legible typography
  assert.match(
    code,
    /role="region"[^>]*aria-label="Relationship edge legend"/,
    'Legend must have an accessible landmark role and label'
  );
  assert.match(
    code,
    /text-xs font-mono/,
    'Legend must use legible text-xs font-mono typography'
  );
});

test('FraudGraphView: Provides touch-friendly, non-hover node inspection and keyboard accessibility', () => {
  const code = readComponent('components/FraudGraphView.jsx');

  // Verify inspectedNode state exists
  assert.match(
    code,
    /const\s*\[inspectedNode,\s*setInspectedNode\]\s*=\s*useState\(null\)/,
    'FraudGraphView must track inspectedNode state for non-hover inspection'
  );

  // Verify node SVG groups are keyboard accessible buttons
  assert.match(
    code,
    /<g[^>]*role="button"[^>]*tabIndex=\{0\}[^>]*aria-label=\{`Inspect (?:center )?account/,
    'Node elements in SVG must be interactive buttons with tabIndex={0} and descriptive aria-labels'
  );
  assert.match(
    code,
    /aria-pressed=\{inspectedNode\?\.id ===/,
    'Node elements must indicate inspection state via aria-pressed'
  );
  assert.match(
    code,
    /onKeyDown=\{\(e\)\s*=>\s*handleKeyDown\(e,/,
    'Node elements must handle keyboard activation via Enter or Space'
  );

  // Verify persistent inspection panel with details and actions
  assert.match(
    code,
    /role="region"[^>]*aria-label="Node inspection details"/,
    'Component must render a dedicated inspection details region'
  );
  assert.match(
    code,
    /Trace Ring →/,
    'Inspection panel must provide a clear action button to pivot/trace the inspected account'
  );
  assert.match(
    code,
    /onClick=\{\(\)\s*=>\s*setInspectedNode\(null\)\}[^>]*aria-label="Dismiss node details"/,
    'Inspection panel must provide a clear dismiss button'
  );
  assert.match(
    code,
    /🍯 Trapped by Honeypot/,
    'Inspection panel must clearly display honeypot alert badges when node is harvested'
  );
});

test('FraudGraphView: Prevents SVG and evidence list from overflowing narrow screens', () => {
  const code = readComponent('components/FraudGraphView.jsx');

  // Verify root container enforces max-width and overflow containment
  assert.match(
    code,
    /className="space-y-4 w-full max-w-full min-w-0 overflow-x-hidden"/,
    'Root container must enforce w-full max-w-full min-w-0 overflow-x-hidden to prevent horizontal clipping'
  );

  // Verify SVG responsiveness
  assert.match(
    code,
    /preserveAspectRatio="xMidYMid meet"/,
    'SVG must preserve aspect ratio for responsive downscaling'
  );

  // Verify long account IDs wrap cleanly
  assert.match(
    code,
    /\{edge\.source\}\s*↔\s*\{edge\.target\}\s*<\/p>/,
    'Evidence cards must display account link pairs'
  );
  assert.match(
    code,
    /font-mono break-all sm:break-normal/,
    'Account link IDs must enforce break-all on mobile to avoid overflow'
  );

  // Verify responsive metadata grid
  assert.match(
    code,
    /grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-w-0/,
    'Evidence metadata must use responsive grid-cols-1 sm:grid-cols-2'
  );
});

test('FraudGraphView: Explains empty-filter results and synthetic-data notices clearly', () => {
  const code = readComponent('components/FraudGraphView.jsx');

  // Verify SVG does not render phantom fallback lines when filtered to 0
  assert.doesNotMatch(
    code,
    /visibleEdges\.length > 0\s*\?\s*visibleEdges\.map\([^)]*\)\s*:\s*points\.map\(/s,
    'SVG must not fall back to rendering fake placeholder edges when visibleEdges are filtered to 0'
  );

  // Verify contextual empty-filter feedback
  assert.match(
    code,
    /No direct relationships match the active filters:/,
    'Empty filter state must clearly state that filters caused the empty result'
  );
  assert.match(
    code,
    /Type:\s*\{formatLabel\(relationshipFilter\)\}/,
    'Empty filter state must report active relationship filter'
  );
  assert.match(
    code,
    /Provenance:\s*\{formatLabel\(provenanceFilter\)\}/,
    'Empty filter state must report active provenance filter'
  );
  assert.match(
    code,
    /setRelationshipFilter\('all'\);\s*setProvenanceFilter\('all'\);/,
    'Empty filter state must provide a Reset Filters button that restores all records'
  );

  // Verify clear synthetic data notice and card badges
  assert.match(
    code,
    /Synthetic Demonstration Data/,
    'Component must include a prominent Synthetic Demonstration Data header'
  );
  assert.match(
    code,
    /Synthetic Demo/,
    'Evidence cards must clearly label synthetic items with a Synthetic Demo badge'
  );
});
