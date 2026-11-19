import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { submitCitizenReportLocally } from './ruleEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const portalSource = readFileSync(join(__dirname, 'components', 'CitizenPortal.jsx'), 'utf8');

test('CitizenPortal imports required spinner and success indicator icons', () => {
  assert.match(
    portalSource,
    /import\s*\{[^}]*Loader2[^}]*\}\s*from\s*['"]lucide-react['"]/,
    'CitizenPortal must import Loader2 for the visual loading spinner'
  );
  assert.match(
    portalSource,
    /import\s*\{[^}]*CheckCircle2[^}]*\}\s*from\s*['"]lucide-react['"]/,
    'CitizenPortal must import CheckCircle2 for the success confirmation state'
  );
});

test('Citizen report submit button contains loading spinner and accessible loading attributes', () => {
  // Check aria-busy and dynamic aria-label
  assert.match(
    portalSource,
    /aria-busy=\{loading\}/,
    'Submit button must dynamically communicate busy state via aria-busy'
  );
  assert.match(
    portalSource,
    /aria-label=\{loading\s*\?\s*['"]Submitting citizen report\.\.\.['"]\s*:\s*['"]Submit citizen report['"]\}/,
    'Submit button must provide clear, dynamic aria-label for screen readers'
  );

  // Check animated spinner icon
  assert.match(
    portalSource,
    /<Loader2[^>]*animate-spin[^>]*\/>/,
    'Submit button must render an animated spinner icon when loading'
  );

  // Check dynamic button label text
  assert.match(
    portalSource,
    /\{loading\s*\?\s*\(\s*<>[\s\S]*?Submitting…[\s\S]*?<\/>\s*\)\s*:\s*\(\s*<span>Submit report<\/span>\s*\)\}/,
    'Submit button must alternate between loading and idle labels'
  );
});

test('Citizen report submit button enforces disabled and cursor states', () => {
  // Button disabled attribute
  assert.match(
    portalSource,
    /<button[^>]*disabled=\{loading\}/,
    'Submit button must be disabled while API request is processing'
  );

  // Button disabled cursor and visual styling
  assert.match(
    portalSource,
    /disabled:cursor-not-allowed/,
    'Submit button must specify disabled:cursor-not-allowed to visually cue unavailable state'
  );
  assert.match(
    portalSource,
    /cursor-pointer/,
    'Submit button must specify cursor-pointer for interactive state'
  );
});

test('Form inputs are disabled during submission to prevent duplicate edits and submissions', () => {
  // Name input
  assert.match(
    portalSource,
    /<input[\s\S]*?disabled=\{loading\}[\s\S]*?aria-label="Your full name"/,
    'Full name input must be disabled during loading'
  );

  // Email input
  assert.match(
    portalSource,
    /<input[\s\S]*?disabled=\{loading\}[\s\S]*?aria-label="Your email address for confirmation"/,
    'Email confirmation input must be disabled during loading'
  );

  // Category select
  assert.match(
    portalSource,
    /<select[\s\S]*?disabled=\{loading\}[\s\S]*?aria-label="Incident category"/,
    'Incident category dropdown must be disabled during loading'
  );

  // Region select
  assert.match(
    portalSource,
    /<select[\s\S]*?disabled=\{loading\}[\s\S]*?aria-label="Your region"/,
    'Region dropdown must be disabled during loading'
  );

  // Description textarea
  assert.match(
    portalSource,
    /<textarea[\s\S]*?disabled=\{loading\}[\s\S]*?aria-label="Describe what happened"/,
    'Description textarea must be disabled during loading'
  );
});

test('Citizen report renders clear visual confirmation and success state', () => {
  // Accessible role and live announcement
  assert.match(
    portalSource,
    /role="status"/,
    'Success section must specify role="status" for live announcements'
  );
  assert.match(
    portalSource,
    /aria-live="polite"/,
    'Success section must specify aria-live="polite"'
  );

  // Visual success check icon and heading
  assert.match(
    portalSource,
    /<CheckCircle2[^>]*\/>[\s\S]*?Report submitted successfully!/,
    'Success state must display a visual checkmark and affirmative heading'
  );

  // Reference and tracking ID
  assert.match(
    portalSource,
    /ID:\s*\{result\.report_id\}/,
    'Success state must prominently present the report ID tracking reference'
  );

  // Form reset action to file another report
  assert.match(
    portalSource,
    /onClick=\{resetForm\}[\s\S]*?\+\s*File another report/,
    'Success card must provide a reset action to file another report without duplicate confusion'
  );
});

test('submitCitizenReportLocally successfully records report with valid tracking metadata', () => {
  const result = submitCitizenReportLocally({
    reporter_name: 'Test Citizen',
    category: 'scam_call',
    description: 'Suspicious digital arrest call claiming to be CBI police officer',
    region: 'Mumbai',
    language: 'English',
  });

  assert.ok(result.report_id, 'Report ID must be generated');
  assert.ok(result.acknowledgement, 'Acknowledgement message must be provided');
  assert.equal(typeof result.draft_fir, 'string', 'Draft FIR statement must be prepared');
});
