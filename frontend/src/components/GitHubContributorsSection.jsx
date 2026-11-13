import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  CONTRIBUTORS_LOAD_STATES,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
  GITHUB_REPO_CONTRIBUTORS_URL,
  fetchGitHubContributors,
  formatContributionCount,
  getGitHubContributorAccessibleName,
  getGitHubContributorsErrorMessage,
} from '../data/githubContributors.js';

function GitHubContributorCard({ contributor }) {
  const [imgError, setImgError] = useState(false);
  const contributionLabel = formatContributionCount(contributor.contributions);
  const accessibleName = getGitHubContributorAccessibleName(contributor);

  useEffect(() => {
    setImgError(false);
  }, [contributor.avatarUrl]);

  return (
    <a
      href={contributor.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleName}
      className="group flex min-h-[76px] items-center justify-between gap-4 rounded-2xl border border-[var(--paper-line)] bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ink)]/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:ring-offset-2"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {contributor.avatarUrl && !imgError && (
          <img
            src={contributor.avatarUrl}
            alt={
              contributor.username
                ? `${contributor.username}'s GitHub profile picture`
                : 'GitHub contributor profile picture'
            }
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-12 w-12 shrink-0 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] object-cover"
          />
        )}

        <div className="min-w-0">
          {contributor.username ? (
            <div className="truncate font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--navy)]">
              @{contributor.username}
            </div>
          ) : (
            <div className="truncate font-display text-sm font-semibold text-[var(--ink)]">
              GitHub Profile
            </div>
          )}

          {contributionLabel && (
            <div className="mt-1 inline-flex items-center rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--ink-text)]/80">
              {contributionLabel}
            </div>
          )}
        </div>
      </div>

      <ExternalLink
        size={15}
        className="shrink-0 text-[var(--ink-text)]/40 transition-colors group-hover:text-[var(--saffron)]"
        aria-hidden="true"
      />
    </a>
  );
}

function StatusBadge({ status }) {
  if (status === CONTRIBUTORS_LOAD_STATES.LOADING) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
        Syncing
      </span>
    );
  }

  if (status === CONTRIBUTORS_LOAD_STATES.SUCCESS) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--safe)]/30 bg-emerald-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--safe)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--safe)]" aria-hidden="true" />
        Live
      </span>
    );
  }

  if (status === CONTRIBUTORS_LOAD_STATES.EMPTY) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-text)]/70">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-text)]/40" aria-hidden="true" />
        Empty
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--alert)]/30 bg-red-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--alert)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--alert)]" aria-hidden="true" />
      Unavailable
    </span>
  );
}

export default function GitHubContributorsSection({
  fetcher = fetchGitHubContributors,
}) {
  const [status, setStatus] = useState(CONTRIBUTORS_LOAD_STATES.LOADING);
  const [contributors, setContributors] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const loadContributors = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestSeq = ++requestSeqRef.current;

    setStatus(CONTRIBUTORS_LOAD_STATES.LOADING);
    setErrorMessage('');

    try {
      const result = await fetcher({ signal: controller.signal });
      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      const items = Array.isArray(result?.contributors) ? result.contributors : [];
      setContributors(items);
      setStatus(
        items.length === 0
          ? CONTRIBUTORS_LOAD_STATES.EMPTY
          : CONTRIBUTORS_LOAD_STATES.SUCCESS
      );
    } catch (err) {
      if (controller.signal.aborted && err?.name !== 'TimeoutError') {
        return;
      }
      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      setContributors([]);
      setErrorMessage(getGitHubContributorsErrorMessage(err));
      setStatus(CONTRIBUTORS_LOAD_STATES.ERROR);
    }
  }, [fetcher]);

  useEffect(() => {
    loadContributors();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadContributors]);

  const isLoading = status === CONTRIBUTORS_LOAD_STATES.LOADING;

  return (
    <section
      className="mt-16 rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-sm"
      aria-labelledby="github-contributors-heading"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[var(--paper-line)] pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--saffron)]">
              <GitBranch size={14} aria-hidden="true" />
              GitHub Repository Feed
            </span>
            <StatusBadge status={status} />
          </div>

          <h2
            id="github-contributors-heading"
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]"
          >
            Repository Contributors on GitHub
          </h2>

          <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
            Live contributor records fetched directly from{' '}
            <code className="rounded bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
              {GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}
            </code>
            . The Contributors Hub remains fully usable even if GitHub is unreachable or rate-limited.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {status !== CONTRIBUTORS_LOAD_STATES.ERROR && (
            <button
              type="button"
              onClick={loadContributors}
              disabled={isLoading}
              aria-label="Refresh repository contributors from GitHub"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-4 py-2 font-mono text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink)]/30 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw
                size={14}
                className={isLoading ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
            </button>
          )}

          <a
            href={GITHUB_REPO_CONTRIBUTORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View full contributor graph for GoldRay19/kshemOS on GitHub"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-4 py-2 font-mono text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink)]/30 hover:bg-[var(--paper)]"
          >
            <span>GitHub Graph</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Loading State */}
      {status === CONTRIBUTORS_LOAD_STATES.LOADING && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="mt-6 space-y-5"
        >
          <p className="font-mono text-xs text-[var(--ink-text)]/70">
            Loading repository contributors from GitHub...
          </p>

          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-hidden="true"
          >
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex min-h-[76px] items-center gap-3.5 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)]/50 p-4 animate-pulse"
              >
                <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--paper-line)]/80" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 rounded bg-[var(--paper-line)]" />
                  <div className="h-3 w-20 rounded bg-[var(--paper-line)]/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request-Error State */}
      {status === CONTRIBUTORS_LOAD_STATES.ERROR && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-[var(--alert)]/25 bg-red-50/40 p-6"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--alert)]/20 bg-white text-[var(--alert)]">
                <AlertCircle size={20} aria-hidden="true" />
              </span>

              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  Unable to load live GitHub contributors
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/80">
                  {errorMessage}
                </p>
                <p className="font-mono text-[11px] text-[var(--ink-text)]/60">
                  Core maintainer profiles and contribution guidelines on this page remain available offline.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={loadContributors}
                aria-label="Retry loading GitHub contributors"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--navy)] cursor-pointer"
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {status === CONTRIBUTORS_LOAD_STATES.EMPTY && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-2xl border border-dashed border-[var(--paper-line)] bg-[var(--paper)]/40 p-8 text-center"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--paper-line)] bg-white text-[var(--ink-text)]/60">
            <Users size={20} aria-hidden="true" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-[var(--ink)]">
            No GitHub contributors returned
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/70">
            The GitHub contributors endpoint returned an empty list for this repository.
          </p>
          <button
            type="button"
            onClick={loadContributors}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-[var(--navy)] cursor-pointer"
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Success State */}
      {status === CONTRIBUTORS_LOAD_STATES.SUCCESS && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[var(--ink-text)]/70">
            <span>
              Showing {contributors.length} repository{' '}
              {contributors.length === 1 ? 'contributor' : 'contributors'} returned by GitHub
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contributors.map((contributor) => (
              <GitHubContributorCard
                key={contributor.id}
                contributor={contributor}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

