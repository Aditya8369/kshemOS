import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORE_TEAM,
  COMMUNITY_CONTRIBUTORS,
  ALL_CONTRIBUTORS,
  CONTRIBUTION_CATEGORIES,
  CONTRIBUTION_CATEGORY_MAP,
  filterContributors,
  getContributionCategory,
  getContributorAvatarUrl,
} from './contributorsData.js';

test('distinguishes core team members from community contributors', () => {
  assert.equal(CORE_TEAM.length, 2);
  assert.ok(COMMUNITY_CONTRIBUTORS.length >= 8);

  for (const member of CORE_TEAM) {
    assert.equal(member.type, 'core');
    assert.equal(member.typeLabel, 'Core Maintainer');
    assert.ok(member.name);
    assert.ok(member.role);
    assert.ok(member.github);
    assert.ok(member.githubUrl.startsWith('https://github.com/'));
    assert.ok(member.area);
    assert.ok(member.initials);
  }

  for (const contributor of COMMUNITY_CONTRIBUTORS) {
    assert.equal(contributor.type, 'community');
    assert.equal(contributor.typeLabel, 'Community Contributor');
    assert.ok(contributor.name);
    assert.ok(contributor.role);
    assert.ok(contributor.github);
    assert.ok(contributor.githubUrl.startsWith('https://github.com/'));
    assert.ok(contributor.area);
    assert.ok(contributor.initials);
  }
});

test('contributor profile cards include valid GitHub links and avatar URLs', () => {
  for (const c of ALL_CONTRIBUTORS) {
    assert.match(c.githubUrl, /^https:\/\/github\.com\/[A-Za-z0-9_-]+$/);
    const avatarUrl = getContributorAvatarUrl(c.github);
    assert.match(avatarUrl, /^https:\/\/github\.com\/[A-Za-z0-9_-]+\.png\?size=120$/);
  }
});

test('does not invent fictitious contributor identities', () => {
  // Check known verified contributors from git history
  const githubHandles = ALL_CONTRIBUTORS.map((c) => c.github);
  assert.ok(githubHandles.includes('GoldRay19'));
  assert.ok(githubHandles.includes('Eshitajha19'));
  assert.ok(githubHandles.includes('Aditya8369'));
  assert.ok(githubHandles.includes('Khushi-agarwal1401'));
  assert.ok(githubHandles.includes('bhavesh-patil2007'));
  assert.ok(githubHandles.includes('Venkatasai200628'));
  assert.ok(githubHandles.includes('Roxyh-code'));
  assert.ok(githubHandles.includes('CoderSoham345'));
  assert.ok(githubHandles.includes('KartikManral092006'));
  assert.ok(githubHandles.includes('sukhijapurnima888'));
  assert.equal(ALL_CONTRIBUTORS.length, 10);
});

test('filtering contributors by category works correctly', () => {
  const all = filterContributors(ALL_CONTRIBUTORS, { type: 'all' });
  assert.equal(all.length, 10);

  const coreOnly = filterContributors(ALL_CONTRIBUTORS, { type: 'core' });
  assert.equal(coreOnly.length, 2);
  assert.ok(coreOnly.every((c) => c.type === 'core'));

  const communityOnly = filterContributors(ALL_CONTRIBUTORS, { type: 'community' });
  assert.equal(communityOnly.length, 8);
  assert.ok(communityOnly.every((c) => c.type === 'community'));
});

test('filtering contributors by domain and search query works', () => {
  const uxContributors = filterContributors(ALL_CONTRIBUTORS, { domain: 'Frontend & UX' });
  assert.ok(uxContributors.some((c) => c.github === 'Khushi-agarwal1401'));

  const searchAditya = filterContributors(ALL_CONTRIBUTORS, { query: 'aditya' });
  assert.equal(searchAditya.length, 1);
  assert.equal(searchAditya[0].github, 'Aditya8369');

  const searchArea = filterContributors(ALL_CONTRIBUTORS, { query: 'triage' });
  assert.ok(searchArea.some((c) => c.github === 'CoderSoham345'));
});

test('supports required contribution categories without fabricated metrics', () => {
  const categoryIds = CONTRIBUTION_CATEGORIES.map((cat) => cat.id);
  for (const required of [
    'all',
    'frontend',
    'backend',
    'ai-research',
    'documentation',
    'testing',
    'accessibility',
  ]) {
    assert.ok(categoryIds.includes(required), `Missing category: ${required}`);
  }

  for (const c of ALL_CONTRIBUTORS) {
    assert.ok(Array.isArray(c.categories) && c.categories.length > 0, `${c.name} must have categories`);
    for (const catId of c.categories) {
      assert.ok(catId !== 'all' && CONTRIBUTION_CATEGORY_MAP[catId], `Invalid category ${catId} on ${c.name}`);
    }
    for (const metricKey of ['rank', 'ranking', 'commitCount', 'prCount', 'score', 'points', 'total']) {
      assert.equal(c[metricKey], undefined, `${c.name} must not expose fabricated metric ${metricKey}`);
    }
  }
});

test('filtering by contribution category works and supports empty categories', () => {
  const frontend = filterContributors(ALL_CONTRIBUTORS, { category: 'frontend' });
  assert.ok(frontend.some((c) => c.github === 'Khushi-agarwal1401'));

  const backend = filterContributors(ALL_CONTRIBUTORS, { category: 'backend' });
  assert.ok(backend.some((c) => c.github === 'bhavesh-patil2007'));

  const aiResearch = filterContributors(ALL_CONTRIBUTORS, { category: 'ai-research' });
  assert.ok(aiResearch.some((c) => c.github === 'Eshitajha19'));

  const testing = filterContributors(ALL_CONTRIBUTORS, { category: 'testing' });
  assert.ok(testing.some((c) => c.github === 'Roxyh-code'));

  const accessibility = filterContributors(ALL_CONTRIBUTORS, { category: 'accessibility' });
  assert.ok(accessibility.some((c) => c.github === 'Khushi-agarwal1401'));

  const documentation = filterContributors(ALL_CONTRIBUTORS, { category: 'documentation' });
  assert.deepEqual(documentation, []);

  assert.equal(getContributionCategory('accessibility').label, 'Accessibility');
  assert.equal(getContributionCategory('unknown').id, 'all');
});

