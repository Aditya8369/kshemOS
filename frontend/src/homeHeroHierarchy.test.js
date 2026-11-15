import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homePage = readFileSync(join(__dirname, 'components', 'HomePage.jsx'), 'utf8');

function getButtonBlocks(source) {
  const matches = [...source.matchAll(/<button\b[\s\S]*?<\/button>/g)];
  return matches.map((m) => m[0]);
}

test('HomePage preserves safety messaging and route destinations', () => {
  for (const text of [
    'Trusted digital safety for every citizen',
    'Stop scams before they become losses.',
    'KshemOS combines awareness, calm verification, and quick support so people can respond confidently to suspicious calls, messages, and payment requests.',
    'Live protection checklist',
    'Pause before sharing OTPs, Aadhaar, or payment details.',
    'Verify calls through an official number or trusted channel.',
    'Report suspicious activity early to reduce harm.',
    'A calm check can save a life, a livelihood, and a family’s peace.',
  ]) {
    assert.ok(homePage.includes(text), `Expected HomePage to preserve copy: ${text}`);
  }

  for (const route of ["setActiveView('portal')", "setActiveView('awareness')", "setActiveView('rule-library')"]) {
    assert.ok(homePage.includes(route), `Expected HomePage to preserve route ${route}`);
  }
});

test('HomePage establishes one primary CTA and consistent secondary CTAs', () => {
  const buttons = getButtonBlocks(homePage);
  assert.equal(buttons.length, 3, 'HomePage hero should render 3 action buttons');

  const primaryButtons = buttons.filter((b) => b.includes("setActiveView('portal')"));
  const secondaryButtons = buttons.filter((b) => !b.includes("setActiveView('portal')"));

  assert.equal(primaryButtons.length, 1);
  assert.equal(secondaryButtons.length, 2);

  assert.match(primaryButtons[0], /bg-\[var\(--ink\)\]/);
  assert.doesNotMatch(primaryButtons[0], /animate-float-soft/);

  const extractClassAttr = (btn) => {
    const match = btn.match(/className=(?:"([^"]+)"|\{([^}]+)\})/);
    assert.ok(match, 'Button should define a className');
    return match[1] ?? match[2];
  };

  const secondaryClassRef = extractClassAttr(secondaryButtons[0]);
  assert.equal(
    secondaryClassRef,
    extractClassAttr(secondaryButtons[1]),
    'Secondary CTAs should share identical styling classes',
  );
  assert.doesNotMatch(secondaryClassRef, /bg-\[var\(--ink\)\]/);

  const sharedDefMatch = homePage.match(/const secondaryButtonClass =\s*'([^']+)'/);
  assert.ok(sharedDefMatch, 'Secondary buttons should share secondaryButtonClass');
  assert.doesNotMatch(sharedDefMatch[1], /bg-\[var\(--ink\)\]/);
  assert.match(sharedDefMatch[1], /w-full[\s\S]*sm:w-auto/);
});

test('HomePage includes responsive layout rules for mobile, tablet, and desktop widths', () => {
  assert.match(homePage, /w-full[\s\S]*sm:w-auto/);
  assert.match(homePage, /flex-col[\s\S]*sm:flex-row/);
  assert.match(homePage, /sm:grid-cols-3/);
  assert.match(homePage, /lg:grid-cols-\[1\.15fr_0\.85fr\]/);
});

