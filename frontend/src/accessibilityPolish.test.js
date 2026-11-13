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

test('index.css enforces high-contrast focus visibility and reduced motion', () => {
  const css = readComponent('index.css');

  assert.match(
    css,
    /:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--saffron\)/,
    'index.css must define visible keyboard focus outline with --saffron'
  );

  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    'index.css must include prefers-reduced-motion query'
  );

  assert.match(
    css,
    /scroll-behavior:\s*auto\s*!important/,
    'Reduced motion must disable smooth scroll behavior'
  );
});

test('Shell.jsx provides skip-to-content link and accessible main landmark', () => {
  const shell = readComponent('components/Shell.jsx');

  assert.match(
    shell,
    /href="#main-content"/,
    'Shell must have a skip link targeting #main-content'
  );
  assert.match(
    shell,
    /Skip to main content/,
    'Skip link text must be descriptive'
  );
  assert.match(
    shell,
    /<main[^>]*id="main-content"[^>]*tabIndex="-1"/,
    '<main> must have id="main-content" and tabIndex="-1"'
  );
  assert.match(
    shell,
    /overflow-x-hidden/,
    'Shell must enforce overflow-x-hidden to prevent horizontal clipping'
  );
});

test('HomePage.jsx avoids animating buttons and provides non-colour status indicators', () => {
  const home = readComponent('components/HomePage.jsx');

  assert.doesNotMatch(
    home,
    /<button[^>]*animate-float-soft/,
    'Buttons must not have continuous floating animations that disrupt clicking or focus'
  );

  assert.match(
    home,
    /<h2[^>]*>Live protection checklist<\/h2>/,
    'Checklist section must use a semantic <h2> heading'
  );

  assert.match(
    home,
    /<blockquote[^>]*>/,
    'Quotes should use semantic <blockquote> elements'
  );

  assert.match(
    home,
    /<svg[^>]*viewBox="0 0 24 24"/,
    'Checklist must include SVG icons as non-colour status indicators'
  );
});

test('CitizenPortal.jsx includes accessible form labels and aria attributes', () => {
  const portal = readComponent('components/CitizenPortal.jsx');

  assert.match(
    portal,
    /<textarea[^>]*aria-label="Paste the suspicious call transcript"/,
    'Call transcript textarea must have accessible aria-label'
  );

  assert.match(
    portal,
    /<input[^>]*aria-label="Caller claimed identity"/,
    'Claim input must have accessible aria-label'
  );

  assert.match(
    portal,
    /<button[^>]*aria-pressed=/,
    'Quick sample buttons must indicate selection via aria-pressed'
  );

  assert.match(
    portal,
    /aria-label="Select assistant language"/,
    'Language selector must have accessible aria-label'
  );

  assert.match(
    portal,
    /aria-label="Your full name"/,
    'Report name input must have accessible aria-label'
  );
});

test('OfficerCommandCenter.jsx prevents mobile tab overflow and labels inputs', () => {
  const occ = readComponent('components/OfficerCommandCenter.jsx');

  assert.match(
    occ,
    /overflow-x-auto[^>]*>\s*<div[^>]*role="tablist"/,
    'Tablist must be wrapped in overflow-x-auto to prevent mobile horizontal clipping'
  );

  assert.match(
    occ,
    /aria-label="Account ID to trace fraud ring"/,
    'Account input must have an accessible aria-label'
  );

  assert.match(
    occ,
    /aria-label="Analyst access token"/,
    'Analyst token input must have an accessible aria-label'
  );

  assert.match(
    occ,
    /aria-label="Report ID to summarize"/,
    'Report summary input must have an accessible aria-label'
  );

  assert.doesNotMatch(
    occ,
    /ΓÇª/,
    'Corrupted ellipsis characters must be resolved'
  );
});

test('ScamIntelligencePage, ThreatLibraryPage, and MeetPage enforce heading order and touch targets', () => {
  const scam = readComponent('components/ScamIntelligencePage.jsx');
  assert.match(
    scam,
    /<h2[^>]*>Try it live<\/h2>/,
    'Scam intelligence must use <h2> for Try it live'
  );
  assert.match(
    scam,
    /<h2[^>]*>Intelligence Results<\/h2>/,
    'Scam intelligence must use <h2> for Intelligence Results'
  );

  const threat = readComponent('components/ThreatLibraryPage.jsx');
  assert.match(
    threat,
    /<h2[^>]*>Summary<\/h2>/,
    'Threat library must use <h2> for Summary'
  );
  assert.match(
    threat,
    /<h2[^>]*>Sample cases<\/h2>/,
    'Threat library must use <h2> for Sample cases'
  );

  const meet = readComponent('components/MeetPage.jsx');
  assert.doesNotMatch(
    meet,
    /<h2[^>]*>\s*\{\s*number\s*\}\s*<\/h2>/,
    'Stats numbers should not be encoded as <h2> headings'
  );
  assert.match(
    meet,
    /aria-label="Core Team"/,
    'Core team section must have an accessible landmark label'
  );
});

test('ContributorsPage.jsx supports accessible categories, mobile readability, empty state, and no unverified metrics', () => {
  const contributors = readComponent('components/ContributorsPage.jsx');

  assert.match(
    contributors,
    /CONTAINER_VARIANTS\.public/,
    'ContributorsPage must use standardized responsive public container'
  );
  assert.match(
    contributors,
    /aria-pressed=\{isSelected\}/,
    'Category filter buttons must expose aria-pressed state'
  );
  assert.match(
    contributors,
    /No listed contributors in \$\{activeCategory\.label\} yet/,
    'ContributorsPage must provide a meaningful category-specific empty state'
  );
  assert.doesNotMatch(
    contributors,
    /Verified in git log|Verified Contributors|line-clamp-3/,
    'ContributorsPage must not claim unverified official verification badges or truncate mobile bios'
  );
});

