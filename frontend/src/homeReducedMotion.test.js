import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(join(__dirname, 'index.css'), 'utf8');
const homePage = readFileSync(join(__dirname, 'components', 'HomePage.jsx'), 'utf8');

function getReducedMotionBlock(css) {
  const marker = '@media (prefers-reduced-motion: reduce)';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, 'index.css should define @media (prefers-reduced-motion: reduce)');
  const openBrace = css.indexOf('{', start);
  let depth = 0;
  for (let i = openBrace; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) {
      return css.slice(openBrace + 1, i);
    }
  }
  assert.fail('Unclosed @media (prefers-reduced-motion: reduce) block');
}

test('normal hero animations remain defined outside reduced-motion media query', () => {
  for (const keyframe of ['floatSoft', 'driftSlow', 'glowPulse', 'fadeUp']) {
    assert.match(indexCss, new RegExp(`@keyframes\\s+${keyframe}\\b`));
  }
  for (const cls of [
    '.animate-float-soft',
    '.animate-drift-slow',
    '.animate-glow-pulse',
    '.animate-fade-up',
  ]) {
    assert.ok(indexCss.includes(cls), `Expected ${cls} in index.css`);
  }
});

test('reduced-motion media query disables hero animations and keeps fade-up content visible', () => {
  const reducedBlock = getReducedMotionBlock(indexCss);

  for (const cls of [
    '.animate-float-soft',
    '.animate-drift-slow',
    '.animate-glow-pulse',
    '.animate-fade-up',
  ]) {
    assert.ok(reducedBlock.includes(cls), `Reduced-motion block should cover ${cls}`);
  }

  assert.match(reducedBlock, /animation:\s*none\s*!important/);
  assert.match(reducedBlock, /animation-iteration-count:\s*1\s*!important/);
  assert.match(reducedBlock, /\.animate-fade-up\s*\{[^}]*opacity:\s*1/s);
  assert.match(reducedBlock, /transform:\s*none/);
});

test('HomePage gates hover translation with motion-safe and hides decorative layer from AT', () => {
  assert.match(homePage, /aria-hidden="true"/);
  assert.doesNotMatch(homePage, /(?<!motion-safe:)hover:-translate-y-/);
  assert.match(homePage, /motion-safe:hover:-translate-y-0\.5/);
  assert.match(homePage, /motion-safe:hover:-translate-y-1/);
});

