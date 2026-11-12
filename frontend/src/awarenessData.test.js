import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AWARENESS_RESOURCES,
  TOPICS,
  AUDIENCES,
  filterAwarenessResources,
  groupResourcesBy
} from './awarenessData.js';

test('AWARENESS_RESOURCES contains well-formed educational resources', () => {
  assert.ok(AWARENESS_RESOURCES.length >= 8, 'Expected at least 8 educational resources');

  for (const item of AWARENESS_RESOURCES) {
    assert.ok(item.id, 'Every resource must have an id');
    assert.ok(item.title && item.title.trim().length > 0, `Missing title in ${item.id}`);
    assert.ok(item.summary && item.summary.trim().length > 0, `Missing summary in ${item.id}`);
    assert.ok(item.topic && TOPICS.includes(item.topic), `Invalid topic in ${item.id}: ${item.topic}`);
    assert.ok(item.audience && AUDIENCES.includes(item.audience), `Invalid audience in ${item.id}: ${item.audience}`);
    assert.ok(item.format, `Missing format in ${item.id}`);
    assert.ok(item.actionLabel, `Missing actionLabel in ${item.id}`);
    assert.ok(item.targetView, `Missing targetView in ${item.id}`);
    assert.equal(typeof item.isAvailable, 'boolean', `isAvailable must be boolean in ${item.id}`);
    assert.ok(Array.isArray(item.keyTakeaways) && item.keyTakeaways.length > 0, `Missing keyTakeaways in ${item.id}`);
  }
});

test('groups resources accurately by topic and audience', () => {
  const byTopic = groupResourcesBy(AWARENESS_RESOURCES, 'topic');
  assert.ok(Object.keys(byTopic).length >= 4, 'Should group into multiple topics');
  assert.ok(byTopic['Digital Arrest & Impersonation']?.length >= 2);
  assert.ok(byTopic['Banking & UPI Safety']?.length >= 2);

  const byAudience = groupResourcesBy(AWARENESS_RESOURCES, 'audience');
  assert.ok(Object.keys(byAudience).length >= 4, 'Should group into multiple audiences');
  assert.ok(byAudience['Seniors & Elders']?.length >= 2);
  assert.ok(byAudience['Students & Job Seekers']?.length >= 1);
});

test('filters resources accurately by topic, audience, and search query', () => {
  const seniorOnly = filterAwarenessResources(AWARENESS_RESOURCES, { audience: 'Seniors & Elders' });
  assert.ok(seniorOnly.length >= 2);
  assert.ok(seniorOnly.every((item) => item.audience === 'Seniors & Elders'));

  const upiOnly = filterAwarenessResources(AWARENESS_RESOURCES, { topic: 'Banking & UPI Safety' });
  assert.ok(upiOnly.length >= 2);
  assert.ok(upiOnly.every((item) => item.topic === 'Banking & UPI Safety'));

  const searchResults = filterAwarenessResources(AWARENESS_RESOURCES, { searchQuery: 'reverse QR' });
  assert.ok(searchResults.length >= 1);
  assert.ok(searchResults[0].title.includes('UPI PIN'));
});

test('handles empty search and filter states gracefully', () => {
  const unmatched = filterAwarenessResources(AWARENESS_RESOURCES, { searchQuery: 'quantum_blockchain_nonsense_xyz' });
  assert.equal(unmatched.length, 0, 'Unmatched search should return empty list');
});

test('identifies unavailable resources for status feedback', () => {
  const unavailable = AWARENESS_RESOURCES.filter((r) => r.isAvailable === false);
  assert.ok(unavailable.length >= 1, 'Should include at least 1 resource demonstrating unavailable feedback');
  assert.equal(unavailable[0].isAvailable, false);
});

