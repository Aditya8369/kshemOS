import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRIBUTORS_LOAD_STATES,
  fetchGitHubContributors,
  formatContributionCount,
  getGitHubContributorAccessibleName,
  getGitHubContributorsErrorMessage,
  normalizeGitHubContributor,
  normalizeGitHubContributors,
} from './githubContributors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sectionSource = readFileSync(
  join(__dirname, '..', 'components', 'GitHubContributorsSection.jsx'),
  'utf8'
);
const contributorsPageSource = readFileSync(
  join(__dirname, '..', 'components', 'ContributorsPage.jsx'),
  'utf8'
);

test('normalizeGitHubContributor preserves only fields returned by the source', () => {
  const full = normalizeGitHubContributor({
    id: 42,
    login: 'octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/42?v=4',
    html_url: 'https://github.com/octocat',
    contributions: 17,
    type: 'User',
  });

  assert.deepEqual(full, {
    id: '42',
    username: 'octocat',
    avatarUrl: 'https://avatars.githubusercontent.com/u/42?v=4',
    profileUrl: 'https://github.com/octocat',
    contributions: 17,
    type: 'User',
  });

  // Missing avatar_url and contributions must stay null rather than fabricated
  const minimal = normalizeGitHubContributor({
    login: 'only-login',
  });
  assert.equal(minimal.username, 'only-login');
  assert.equal(minimal.avatarUrl, null);
  assert.equal(minimal.contributions, null);
  assert.equal(minimal.profileUrl, 'https://github.com/only-login');

  // Missing login with valid html_url preserves profileUrl without fabricating username
  const noLogin = normalizeGitHubContributor({
    html_url: 'https://github.com/anonymous-org-member',
    contributions: 0,
  });
  assert.equal(noLogin.username, null);
  assert.equal(noLogin.avatarUrl, null);
  assert.equal(noLogin.contributions, 0);
  assert.equal(noLogin.profileUrl, 'https://github.com/anonymous-org-member');
});

test('normalizeGitHubContributor rejects unsafe URLs and incomplete entries', () => {
  const unsafeUrls = normalizeGitHubContributor({
    login: 'safeuser',
    avatar_url: 'javascript:alert(1)',
    html_url: 'https://evil.example.com/safeuser',
    contributions: -5,
  });

  assert.equal(unsafeUrls.avatarUrl, null);
  assert.equal(unsafeUrls.profileUrl, 'https://github.com/safeuser');
  assert.equal(unsafeUrls.contributions, null);

  assert.equal(normalizeGitHubContributor(null), null);
  assert.equal(normalizeGitHubContributor({}), null);
  assert.equal(
    normalizeGitHubContributor({ avatar_url: 'https://avatars.githubusercontent.com/u/1' }),
    null
  );
});

test('formatContributionCount and accessible names handle optional metadata accurately', () => {
  assert.equal(formatContributionCount(null), null);
  assert.equal(formatContributionCount(undefined), null);
  assert.equal(formatContributionCount(NaN), null);
  assert.equal(formatContributionCount(0), '0 contributions');
  assert.equal(formatContributionCount(1), '1 contribution');
  assert.equal(formatContributionCount(24), '24 contributions');

  assert.equal(
    getGitHubContributorAccessibleName({ username: 'GoldRay19', contributions: 12 }),
    'View @GoldRay19 on GitHub (12 contributions)'
  );
  assert.equal(
    getGitHubContributorAccessibleName({ username: 'GoldRay19', contributions: null }),
    'View @GoldRay19 on GitHub'
  );
  assert.equal(
    getGitHubContributorAccessibleName({ username: null, contributions: 3 }),
    'View GitHub contributor profile (3 contributions)'
  );
  assert.equal(
    getGitHubContributorAccessibleName({ username: null, contributions: null }),
    'View GitHub contributor profile'
  );
});

test('normalizeGitHubContributors rejects non-array payloads and filters invalid items', () => {
  assert.throws(
    () => normalizeGitHubContributors({ message: 'Not an array' }),
    /Unexpected response format/
  );

  const normalized = normalizeGitHubContributors([
    null,
    {},
    { login: 'alice', html_url: 'https://github.com/alice', contributions: 5 },
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].username, 'alice');
});

test('fetchGitHubContributors handles success, empty, HTTP errors, network failures, and timeouts', async () => {
  // 1. Success state
  const successResult = await fetchGitHubContributors({
    fetchImpl: async () => ({
      ok: true,
      json: async () => [
        {
          id: 1,
          login: 'contributor-one',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          html_url: 'https://github.com/contributor-one',
          contributions: 9,
        },
      ],
    }),
  });
  assert.equal(successResult.status, CONTRIBUTORS_LOAD_STATES.SUCCESS);
  assert.equal(successResult.contributors.length, 1);
  assert.equal(successResult.contributors[0].username, 'contributor-one');

  // 2. Empty state (no hard-coded fallback contributors)
  const emptyResult = await fetchGitHubContributors({
    fetchImpl: async () => ({
      ok: true,
      json: async () => [],
    }),
  });
  assert.equal(emptyResult.status, CONTRIBUTORS_LOAD_STATES.EMPTY);
  assert.deepEqual(emptyResult.contributors, []);

  // 3. Rate limit (403) error state
  await assert.rejects(
    () =>
      fetchGitHubContributors({
        fetchImpl: async () => ({ ok: false, status: 403 }),
      }),
    /rate limit/i
  );

  // 4. Generic HTTP error (500)
  await assert.rejects(
    () =>
      fetchGitHubContributors({
        fetchImpl: async () => ({ ok: false, status: 500 }),
      }),
    /HTTP 500/
  );

  // 5. Network failure
  await assert.rejects(
    () =>
      fetchGitHubContributors({
        fetchImpl: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    /Failed to fetch/
  );

  // 5b. Invalid JSON body
  await assert.rejects(
    () =>
      fetchGitHubContributors({
        fetchImpl: async () => ({
          ok: true,
          json: async () => {
            throw new SyntaxError('Unexpected token <');
          },
        }),
      }),
    /unreadable response/i
  );

  // 6. Timeout handling
  await assert.rejects(
    () =>
      fetchGitHubContributors({
        timeoutMs: 15,
        fetchImpl: (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      }),
    (err) => {
      assert.equal(err.name, 'TimeoutError');
      assert.match(getGitHubContributorsErrorMessage(err), /timed out/i);
      return true;
    }
  );
});

test('GitHubContributorsSection implements all resilient UI states and integrates into ContributorsPage', () => {
  // Loading, success, empty, error states
  assert.match(sectionSource, /CONTRIBUTORS_LOAD_STATES\.LOADING/);
  assert.match(sectionSource, /CONTRIBUTORS_LOAD_STATES\.ERROR/);
  assert.match(sectionSource, /CONTRIBUTORS_LOAD_STATES\.EMPTY/);
  assert.match(sectionSource, /CONTRIBUTORS_LOAD_STATES\.SUCCESS/);

  // Accessible status / alert landmarks and retry button
  assert.match(sectionSource, /role="status"/);
  assert.match(sectionSource, /aria-busy="true"/);
  assert.match(sectionSource, /role="alert"/);
  assert.match(sectionSource, /onClick=\{loadContributors\}/);
  assert.match(sectionSource, /<span>Retry<\/span>/);

  // Conditional rendering of avatar, username, and contribution count
  assert.match(sectionSource, /contributor\.avatarUrl && !imgError/);
  assert.match(sectionSource, /contributor\.username \?/);
  assert.match(sectionSource, /\{contributionLabel && \(/);

  // GitHub link with accessible name
  assert.match(sectionSource, /href=\{contributor\.profileUrl\}/);
  assert.match(sectionSource, /aria-label=\{accessibleName\}/);

  // Integrated into ContributorsPage without blocking page rendering
  assert.match(contributorsPageSource, /import GitHubContributorsSection from '\.\/GitHubContributorsSection'/);
  assert.match(contributorsPageSource, /<GitHubContributorsSection \/>/);
});

