import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCAM_EXAMPLES,
  COMPARISON_PAIRS,
  filterExamples,
  getResolvedComparisonPairs,
  getUniqueCategories
} from './scamExamplesData.js';

test('SCAM_EXAMPLES contains well-structured suspicious and benign records', () => {
  assert.ok(SCAM_EXAMPLES.length >= 8, 'Expected at least 8 examples in dataset');

  const suspicious = SCAM_EXAMPLES.filter((item) => item.type === 'suspicious');
  const benign = SCAM_EXAMPLES.filter((item) => item.type === 'benign');

  assert.ok(suspicious.length >= 4, 'Expected multiple suspicious examples');
  assert.ok(benign.length >= 4, 'Expected multiple benign examples');

  // Verify consistent structure for each card
  for (const item of SCAM_EXAMPLES) {
    assert.ok(item.id, 'Every example must have an id');
    assert.ok(item.title && item.title.trim().length > 0, `Missing title in ${item.id}`);
    assert.ok(item.scenario && item.scenario.trim().length > 0, `Missing scenario in ${item.id}`);
    assert.ok(Array.isArray(item.warningSigns) && item.warningSigns.length > 0, `Missing warningSigns in ${item.id}`);
    assert.ok(item.safeResponse && item.safeResponse.trim().length > 0, `Missing safeResponse in ${item.id}`);
    assert.ok(['suspicious', 'benign'].includes(item.type), `Invalid type in ${item.id}`);
    assert.ok(item.category, `Missing category in ${item.id}`);
  }
});

test('distinguishes suspicious examples from benign examples using labels and types', () => {
  const suspiciousOnly = filterExamples(SCAM_EXAMPLES, { type: 'suspicious' });
  assert.ok(suspiciousOnly.every((item) => item.type === 'suspicious'));
  assert.ok(suspiciousOnly.length > 0);

  const benignOnly = filterExamples(SCAM_EXAMPLES, { type: 'benign' });
  assert.ok(benignOnly.every((item) => item.type === 'benign'));
  assert.ok(benignOnly.length > 0);

  const allItems = filterExamples(SCAM_EXAMPLES, { type: 'all' });
  assert.equal(allItems.length, SCAM_EXAMPLES.length);
});

test('filters examples accurately by category and keyword search', () => {
  const bankingExamples = filterExamples(SCAM_EXAMPLES, { category: 'Banking & Financial' });
  assert.ok(bankingExamples.length >= 2, 'Should find banking examples');
  assert.ok(bankingExamples.every((item) => item.category === 'Banking & Financial'));

  const searchResults = filterExamples(SCAM_EXAMPLES, { searchTerm: 'Aadhaar' });
  assert.ok(searchResults.length >= 1, 'Should find examples referencing Aadhaar');

  const searchSafe = filterExamples(SCAM_EXAMPLES, { searchTerm: 'Hauz Khas' });
  assert.ok(searchSafe.length >= 1, 'Should find benign police summons');
});

test('resolves comparison pairs with matching suspicious and benign records', () => {
  const pairs = getResolvedComparisonPairs(COMPARISON_PAIRS, SCAM_EXAMPLES);
  assert.ok(pairs.length >= 4, 'Expected multiple comparison pairs');

  for (const pair of pairs) {
    assert.ok(pair.suspicious, `Pair ${pair.id} missing resolved suspicious example`);
    assert.ok(pair.benign, `Pair ${pair.id} missing resolved benign example`);
    assert.equal(pair.suspicious.type, 'suspicious');
    assert.equal(pair.benign.type, 'benign');
    assert.ok(pair.keyTakeaway, `Pair ${pair.id} missing key takeaway`);
    assert.ok(Array.isArray(pair.contrastPoints) && pair.contrastPoints.length > 0);
  }
});

test('extracts unique categories cleanly', () => {
  const categories = getUniqueCategories(SCAM_EXAMPLES);
  assert.ok(categories.includes('Authority Impersonation'));
  assert.ok(categories.includes('Courier & Customs'));
  assert.ok(categories.includes('Banking & Financial'));
  assert.ok(categories.includes('Investments'));
  assert.ok(categories.includes('Utilities'));
});

