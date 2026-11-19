/**
 * Resilient GitHub Contributors loader and normalizer for the Contributors Hub.
 * Strictly displays fields returned by the GitHub API without fabricating or
 * substituting hard-coded community contributor data.
 */

export const GITHUB_REPO_OWNER = 'GoldRay19';
export const GITHUB_REPO_NAME = 'kshemOS';
export const GITHUB_CONTRIBUTORS_ENDPOINT = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contributors?per_page=100`;
export const GITHUB_REPO_CONTRIBUTORS_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/graphs/contributors`;

export const CONTRIBUTORS_LOAD_STATES = {
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
};

function isSafeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeGitHubProfileUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com')
    );
  } catch {
    return false;
  }
}

/**
 * Normalize a raw contributor object returned by GitHub's contributors API.
 * Preserves profile image, username, and contribution count only when present.
 */
export function normalizeGitHubContributor(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const username =
    typeof raw.login === 'string' && raw.login.trim() ? raw.login.trim() : null;

  const avatarUrl =
    typeof raw.avatar_url === 'string' && isSafeHttpUrl(raw.avatar_url)
      ? raw.avatar_url.trim()
      : null;

  let profileUrl = null;
  if (typeof raw.html_url === 'string' && isSafeGitHubProfileUrl(raw.html_url)) {
    profileUrl = raw.html_url.trim();
  } else if (username) {
    profileUrl = `https://github.com/${encodeURIComponent(username)}`;
  }

  if (!profileUrl) {
    return null;
  }

  const contributions =
    typeof raw.contributions === 'number' &&
    Number.isFinite(raw.contributions) &&
    raw.contributions >= 0
      ? raw.contributions
      : null;

  const id =
    raw.id !== undefined && raw.id !== null && String(raw.id).trim()
      ? String(raw.id)
      : username || profileUrl;

  const type =
    typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : null;

  return {
    id,
    username,
    avatarUrl,
    profileUrl,
    contributions,
    type,
  };
}

/**
 * Validate and normalize the payload returned by the GitHub contributors API.
 */
export function normalizeGitHubContributors(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected response format from GitHub contributors API.');
  }

  return payload.map(normalizeGitHubContributor).filter(Boolean);
}

/**
 * Format contribution count only when a valid count was returned by the source.
 */
export function formatContributionCount(contributions) {
  if (
    typeof contributions !== 'number' ||
    !Number.isFinite(contributions) ||
    contributions < 0
  ) {
    return null;
  }

  const unit = contributions === 1 ? 'contribution' : 'contributions';
  return `${contributions.toLocaleString()} ${unit}`;
}

/**
 * Build an accessible link label for a GitHub contributor card.
 */
export function getGitHubContributorAccessibleName(contributor) {
  if (!contributor || typeof contributor !== 'object') {
    return 'View GitHub contributor profile';
  }

  const countLabel = formatContributionCount(contributor.contributions);

  if (contributor.username && countLabel) {
    return `View @${contributor.username} on GitHub (${countLabel})`;
  }

  if (contributor.username) {
    return `View @${contributor.username} on GitHub`;
  }

  if (countLabel) {
    return `View GitHub contributor profile (${countLabel})`;
  }

  return 'View GitHub contributor profile';
}

/**
 * Convert request errors into concise, user-facing messages.
 */
export function getGitHubContributorsErrorMessage(err) {
  if (err?.name === 'TimeoutError') {
    return 'The request to GitHub timed out. Check your connection and retry.';
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return 'Unable to load live repository contributors from GitHub right now.';
}

/**
 * Fetch repository contributors from GitHub without hard-coded fallbacks.
 */
export async function fetchGitHubContributors({
  fetchImpl = globalThis.fetch,
  signal,
  endpoint = GITHUB_CONTRIBUTORS_ENDPOINT,
  timeoutMs = 8000,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is unavailable in this environment.');
  }

  const controller = new AbortController();
  let timedOut = false;

  const onCallerAbort = () => {
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  try {
    const res = await fetchImpl(endpoint, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          'GitHub API rate limit reached. Live repository contributor data is temporarily unavailable.'
        );
      }

      throw new Error(
        `GitHub returned HTTP ${res.status}. Live repository contributor data could not be loaded.`
      );
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(
        'GitHub returned an unreadable response. Live repository contributor data could not be loaded.'
      );
    }

    const contributors = normalizeGitHubContributors(data);

    return {
      contributors,
      status:
        contributors.length === 0
          ? CONTRIBUTORS_LOAD_STATES.EMPTY
          : CONTRIBUTORS_LOAD_STATES.SUCCESS,
    };
  } catch (err) {
    if (timedOut) {
      const timeoutErr = new Error(
        'The request to GitHub timed out. Check your connection and retry.'
      );
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }

    throw err;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

