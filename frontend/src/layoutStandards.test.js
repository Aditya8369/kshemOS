import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTAINER_VARIANTS,
  HEADER_TYPOGRAPHY,
  CARD_SURFACES
} from './layoutStyles.js';

test('CONTAINER_VARIANTS defines standard responsive container widths and paddings', () => {
  const variants = ['public', 'tool', 'officer', 'narrow'];

  for (const v of variants) {
    const cls = CONTAINER_VARIANTS[v];
    assert.ok(cls, `Missing container variant: ${v}`);
    assert.ok(cls.includes('mx-auto'), `Variant ${v} must center via mx-auto`);
    assert.ok(cls.includes('px-4'), `Variant ${v} must include mobile horizontal padding px-4`);
    assert.ok(cls.includes('sm:px-6'), `Variant ${v} must include tablet/desktop horizontal padding sm:px-6`);
    assert.ok(cls.includes('w-full'), `Variant ${v} must enforce w-full to avoid horizontal overflow`);
  }

  // Check specific width bounds
  assert.ok(CONTAINER_VARIANTS.public.includes('max-w-7xl'));
  assert.ok(CONTAINER_VARIANTS.tool.includes('max-w-5xl'));
  assert.ok(CONTAINER_VARIANTS.narrow.includes('max-w-3xl'));
  assert.ok(CONTAINER_VARIANTS.officer.includes('max-w-7xl'));
});

test('HEADER_TYPOGRAPHY defines consistent font families, tracking, and sizes', () => {
  assert.ok(HEADER_TYPOGRAPHY.eyebrow.includes('font-mono'));
  assert.ok(HEADER_TYPOGRAPHY.eyebrow.includes('uppercase'));
  assert.ok(HEADER_TYPOGRAPHY.eyebrow.includes('tracking-[0.25em]'));
  assert.ok(HEADER_TYPOGRAPHY.eyebrow.includes('var(--saffron)'));

  assert.ok(HEADER_TYPOGRAPHY.title.includes('font-display'));
  assert.ok(HEADER_TYPOGRAPHY.title.includes('font-bold'));
  assert.ok(HEADER_TYPOGRAPHY.title.includes('text-[var(--ink)]'));

  assert.ok(HEADER_TYPOGRAPHY.description.includes('max-w-2xl'));
  assert.ok(HEADER_TYPOGRAPHY.description.includes('leading-relaxed'));
});

test('Preserves intentional differences between citizen and officer workspaces', () => {
  // Citizen public typography uses dark ink text on light background
  assert.ok(HEADER_TYPOGRAPHY.title.includes('text-[var(--ink)]'));
  assert.ok(HEADER_TYPOGRAPHY.description.includes('text-[var(--ink-text)]'));

  // Officer workspace typography preserves tactical dark theme
  assert.ok(HEADER_TYPOGRAPHY.titleOfficer.includes('text-white'));
  assert.ok(HEADER_TYPOGRAPHY.descriptionOfficer.includes('text-[var(--mist)]'));

  // Officer panel surfaces use dark navy lines and backgrounds
  assert.ok(CARD_SURFACES.officerPanel.includes('var(--navy)'));
  assert.ok(CARD_SURFACES.officerPanel.includes('var(--navy-line)'));
});

test('CARD_SURFACES specifies consistent rounded radius and borders', () => {
  assert.ok(CARD_SURFACES.standard.includes('rounded-2xl'));
  assert.ok(CARD_SURFACES.standard.includes('border-[var(--paper-line)]'));
  assert.ok(CARD_SURFACES.hero.includes('rounded-3xl'));
});

