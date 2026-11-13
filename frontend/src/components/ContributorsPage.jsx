import { useState, useMemo } from 'react';
import {
  ExternalLink,
  GitPullRequest,
  Shield,
  Users,
  BookOpen,
  Heart,
  Search,
  CheckCircle2,
  Info,
  Layers,
} from 'lucide-react';
import { CONTAINER_VARIANTS } from '../layoutStyles.js';
import {
  ALL_CONTRIBUTORS,
  CONTRIBUTION_CATEGORIES,
  CONTRIBUTION_CATEGORY_MAP,
  CONTRIBUTION_AREAS_GUIDE,
  filterContributors,
  getContributionCategory,
  getContributorAvatarUrl,
} from '../data/contributorsData.js';
import GitHubContributorsSection from './GitHubContributorsSection';

const CATEGORY_BADGE_STYLES = {
  frontend: 'border-sky-200 bg-sky-50 text-sky-900',
  backend: 'border-violet-200 bg-violet-50 text-violet-900',
  'ai-research': 'border-amber-200 bg-amber-50 text-amber-900',
  documentation: 'border-teal-200 bg-teal-50 text-teal-900',
  testing: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  accessibility: 'border-rose-200 bg-rose-50 text-rose-900',
};

function ShieldMark({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9.5 12.5l2 2 4-4" />
    </svg>
  );
}

function GitHubMark({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function ContributorAvatar({ contributor, size = 56 }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const avatarUrl = getContributorAvatarUrl(contributor.github, 160);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-sm font-mono overflow-hidden transition-transform duration-300 group-hover:scale-105"
      style={{
        backgroundColor: contributor.color,
        width: size,
        height: size,
        fontSize: size * 0.36,
      }}
      aria-label={`${contributor.name} avatar`}
    >
      {/* Fallback initials always visible with signature background color */}
      <span>{contributor.initials}</span>

      {/* GitHub avatar layered on top when loaded */}
      {avatarUrl && !imgError && (
        <img
          src={avatarUrl}
          alt={`${contributor.name}'s GitHub avatar`}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

function ContributorCard({ contributor }) {
  const isCore = contributor.type === 'core';
  const categories = contributor.categories || [];

  return (
    <article
      className={`group flex min-w-0 flex-col justify-between rounded-3xl border bg-white p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        isCore
          ? 'border-[var(--saffron)]/40 ring-1 ring-[var(--saffron)]/15'
          : 'border-[var(--paper-line)] hover:border-[var(--ink)]/30'
      }`}
    >
      <div className="min-w-0">
        {/* Top Header: Avatar, Identity & Role Pill */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-[200px] flex-1 items-start gap-3.5">
            <ContributorAvatar contributor={contributor} size={56} />

            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg sm:text-xl font-bold leading-snug text-[var(--ink)] break-words group-hover:text-[var(--navy)]">
                {contributor.name}
              </h3>

              <a
                href={contributor.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1.5 font-mono text-xs sm:text-sm text-[var(--ink-text)]/80 hover:text-[var(--ink)] transition-colors break-all"
                title={`View @${contributor.github} on GitHub`}
              >
                <GitHubMark size={14} className="shrink-0" />
                <span>@{contributor.github}</span>
              </a>

              <p className="mt-1 text-xs sm:text-sm font-medium text-[var(--ink-text)]/75">
                {contributor.role}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
              isCore
                ? 'border-[var(--saffron)]/35 bg-amber-50 text-[var(--ink)]'
                : 'border-[var(--safe)]/35 bg-emerald-50 text-[var(--ink)]'
            }`}
          >
            {isCore ? (
              <>
                <Shield size={13} className="text-[var(--saffron)]" aria-hidden="true" />
                <span>Core Maintainer</span>
              </>
            ) : (
              <>
                <GitPullRequest size={13} className="text-[var(--safe)]" aria-hidden="true" />
                <span>Contributor</span>
              </>
            )}
          </span>
        </div>

        {/* Contribution Categories */}
        {categories.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Contribution categories">
            {categories.map((catId) => {
              const cat = CONTRIBUTION_CATEGORY_MAP[catId];
              const badgeStyle =
                CATEGORY_BADGE_STYLES[catId] || 'border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink)]';
              return (
                <span
                  key={catId}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badgeStyle}`}
                >
                  {cat ? cat.label : catId}
                </span>
              );
            })}
          </div>
        )}

        {/* Contribution Focus Area */}
        <div className="mt-4 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-3.5 sm:p-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--ink-text)]/70">
            Contribution Focus
          </p>
          <p className="mt-1.5 text-sm leading-relaxed font-medium text-[var(--ink)]">
            {contributor.area}
          </p>
        </div>

        {/* Profile Details */}
        {contributor.bio && (
          <p className="mt-4 text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/80">
            {contributor.bio}
          </p>
        )}

        {/* Notable Work Areas (no fabricated issue/PR numbers or rank prefixes) */}
        {contributor.highlights && contributor.highlights.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {contributor.highlights.map((item) => (
              <span
                key={item}
                className="rounded-lg border border-[var(--paper-line)] bg-[var(--paper)]/60 px-2.5 py-1 text-xs text-[var(--ink-text)]/80"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--paper-line)] pt-4">
        <span className="text-xs font-medium text-[var(--ink-text)]/70">
          {contributor.domain}
        </span>

        <a
          href={contributor.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-1.5 font-mono text-xs font-semibold text-[var(--ink)] transition-all hover:bg-[var(--ink)] hover:text-white"
          aria-label={`Visit ${contributor.name}'s GitHub profile`}
        >
          <span>GitHub Profile</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export default function ContributorsPage() {
  const [filterType, setFilterType] = useState('all'); // 'all', 'core', 'community'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeCategory = useMemo(
    () => getContributionCategory(selectedCategory),
    [selectedCategory]
  );

  const filteredContributors = useMemo(() => {
    return filterContributors(ALL_CONTRIBUTORS, {
      type: filterType,
      category: selectedCategory,
      query: searchQuery,
    });
  }, [filterType, selectedCategory, searchQuery]);

  const coreList = useMemo(
    () => filteredContributors.filter((c) => c.type === 'core'),
    [filteredContributors]
  );

  const communityList = useMemo(
    () => filteredContributors.filter((c) => c.type === 'community'),
    [filteredContributors]
  );

  const hasActiveFilters = filterType !== 'all' || selectedCategory !== 'all' || Boolean(searchQuery.trim());

  const resetFilters = () => {
    setFilterType('all');
    setSelectedCategory('all');
    setSearchQuery('');
  };

  return (
    <div className={CONTAINER_VARIANTS.public}>
      {/* Hero Section */}
      <header className="text-center">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--paper-line)] bg-white px-4 py-2 shadow-sm">
          <div className="text-[var(--saffron)]">
            <ShieldMark size={20} />
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-[var(--ink)]">
            Open Source Contributors Hub
          </span>
        </div>

        <h1 className="mt-6 font-display text-3xl sm:text-5xl font-bold tracking-tight text-[var(--ink)] leading-tight">
          Building Digital Public Safety Together
        </h1>

        <p className="mx-auto mt-4 max-w-3xl text-sm sm:text-lg leading-relaxed text-[var(--ink-text)]/80">
          KshemOS is a community-driven, privacy-first cybersecurity workspace.
          Explore listed maintainers and community contributors by contribution focus
          across frontend, backend, AI/research, documentation, testing, and accessibility.
        </p>

        {/* Scope Disclaimer (avoids implying unverified totals/rankings are official metrics) */}
        <div
          role="note"
          className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[var(--paper-line)] bg-white px-4 py-3.5 text-left shadow-xs sm:px-5"
        >
          <Info size={18} className="mt-0.5 shrink-0 text-[var(--navy)]" aria-hidden="true" />
          <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/80">
            This recognition area highlights listed project contributions by discipline.
            It is not an automated leaderboard or exhaustive count—no rankings, commit totals,
            or unverified activity badges are shown.
          </p>
        </div>
      </header>

      {/* Category, Role & Search Controls */}
      <section
        className="rounded-3xl border border-[var(--paper-line)] bg-white p-4 sm:p-6 shadow-sm space-y-5"
        aria-label="Filter contributors"
      >
        {/* Contribution Categories */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={15} className="text-[var(--saffron)]" aria-hidden="true" />
            <span
              id="contribution-categories-label"
              className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--ink)]"
            >
              Contribution Categories
            </span>
          </div>

          <div
            role="group"
            aria-labelledby="contribution-categories-label"
            className="flex flex-wrap gap-2"
          >
            {CONTRIBUTION_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`min-h-[40px] rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--ink)] text-white shadow-sm'
                      : 'border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink-text)] hover:border-[var(--ink)]/30 hover:bg-white'
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </div>

          <p className="mt-2.5 text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
            {activeCategory.description}
          </p>
        </div>

        {/* Role Filter & Search Input */}
        <div className="flex flex-col gap-3 border-t border-[var(--paper-line)] pt-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by contributor role">
            {[
              { id: 'all', label: 'All Roles' },
              { id: 'core', label: 'Core Maintainers' },
              { id: 'community', label: 'Community Contributors' },
            ].map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilterType(tab.id)}
                  className={`min-h-[38px] rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--navy)] text-white shadow-sm'
                      : 'bg-[var(--paper)] text-[var(--ink-text)]/80 hover:bg-[var(--paper-line)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <label htmlFor="contributors-search" className="sr-only">
              Search contributors
            </label>
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-text)]/50"
              aria-hidden="true"
            />
            <input
              id="contributors-search"
              name="contributors-search"
              type="text"
              placeholder="Search name, @handle, or focus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[40px] w-full rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] pl-9 pr-8 py-2 text-xs sm:text-sm text-[var(--ink-text)] placeholder:text-[var(--ink-text)]/50 focus:border-[var(--ink)] focus:bg-white focus:outline-none transition-all"
              aria-label="Search contributors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 font-mono text-sm text-[var(--ink-text)]/60 hover:text-[var(--ink)]"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Active Scope Bar (no fabricated totals or rankings) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--paper-line)] pt-3 text-xs sm:text-sm text-[var(--ink-text)]/75">
          <span>
            {selectedCategory === 'all'
              ? 'Browsing listed contributors across all contribution categories'
              : `Category focus: ${activeCategory.label}`}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-amber-800 hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </section>

      {/* Section 1: Core Team */}
      {coreList.length > 0 && (
        <section aria-labelledby="core-team-heading">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[var(--saffron)]">
              <Shield size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="core-team-heading" className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)]">
                Core Maintainers &amp; Leadership
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--ink-text)]/75">
                Project stewards steering system architecture, threat intelligence, and core platform capabilities
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {coreList.map((member) => (
              <ContributorCard key={member.id} contributor={member} />
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Community Contributors */}
      {communityList.length > 0 && (
        <section aria-labelledby="community-contributors-heading">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[var(--safe)]">
              <Users size={18} aria-hidden="true" />
            </span>
            <div>
              <h2
                id="community-contributors-heading"
                className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)]"
              >
                Community Contributors
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--ink-text)]/75">
                Open-source developers and researchers building citizen safety tools, security modules, and APIs
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {communityList.map((contributor) => (
              <ContributorCard key={contributor.id} contributor={contributor} />
            ))}
          </div>
        </section>
      )}

      {/* Meaningful Empty State */}
      {filteredContributors.length === 0 && (
        <section
          aria-live="polite"
          className="rounded-3xl border border-dashed border-[var(--paper-line)] bg-white p-6 sm:p-10 text-center shadow-xs"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--paper)] text-[var(--ink)]">
            <Users size={22} aria-hidden="true" />
          </div>

          <h2 className="mt-4 font-display text-xl sm:text-2xl font-bold text-[var(--ink)]">
            {searchQuery.trim()
              ? `No listed contributors matched "${searchQuery.trim()}"`
              : filterType !== 'all'
                ? `No listed ${filterType === 'core' ? 'core maintainers' : 'community contributors'} in ${activeCategory.label} yet`
                : `No listed contributors in ${activeCategory.label} yet`}
          </h2>

          <p className="mx-auto mt-2.5 max-w-xl text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
            {searchQuery.trim()
              ? 'Try another name, GitHub handle, or topic, or reset filters to browse all listed contributors.'
              : `We only display listed contributions rather than placeholder profiles. ${activeCategory.description}`}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {filterType !== 'all' && !searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className="min-h-[40px] rounded-full bg-[var(--navy)] px-5 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[var(--ink)] cursor-pointer"
              >
                Show all roles in {activeCategory.label}
              </button>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[40px] rounded-full bg-[var(--ink)] px-5 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[var(--navy)] cursor-pointer"
            >
              Show all categories
            </button>

            {selectedCategory !== 'all' && !searchQuery.trim() && (
              <a
                href={activeCategory.issuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-5 py-2 text-xs sm:text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white"
              >
                <span>Explore {activeCategory.label} tasks</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Resilient Live GitHub Contributors Section */}
      <GitHubContributorsSection />

      {/* Contribution Call-To-Action (CTA) & Guidance Section */}
      <section
        className="rounded-[32px] border border-[var(--paper-line)] bg-gradient-to-b from-white to-[var(--paper)] p-6 sm:p-12 shadow-sm"
        aria-labelledby="how-to-contribute-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--safe)]/30 bg-emerald-50 px-4 py-1.5 text-xs font-mono font-semibold text-[var(--safe)]">
            <Heart size={14} className="fill-[var(--safe)]" aria-hidden="true" />
            <span>Join the Community</span>
          </div>

          <h2
            id="how-to-contribute-heading"
            className="mt-4 font-display text-2xl sm:text-4xl font-bold text-[var(--ink)]"
          >
            How to Contribute to KshemOS
          </h2>

          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--ink-text)]/80">
            We welcome developers, UI/UX designers, cybersecurity researchers, testers, and technical writers.
            KshemOS encourages participation in community initiatives including the annual{' '}
            <strong className="text-[var(--ink)]">Winter of Code (Nov 1 – Jan 31)</strong>.
          </p>
        </div>

        {/* 4-Step Contribution Process */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-mono font-bold text-sm">
              01
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Find an Issue
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
              Browse the repository issue tracker for issues tagged with{' '}
              <code className="rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-xs">
                good first issue
              </code>{' '}
              or feature enhancements.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[var(--saffron)] font-mono font-bold text-sm">
              02
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Fork &amp; Branch
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
              Fork the repository to your account and create a focused topic branch:{' '}
              <code className="rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-xs">
                feature/your-topic
              </code>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 font-mono font-bold text-sm">
              03
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Build &amp; Test
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
              Implement your changes according to coding guidelines, run automated tests (
              <code className="rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-xs">
                npm test
              </code>
              ), and verify UI responsiveness.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[var(--safe)] font-mono font-bold text-sm">
              04
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Open a PR
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
              Submit a well-documented pull request explaining your problem statement, solution,
              and testing evidence.
            </p>
          </div>
        </div>

        {/* Contribution Areas Grid */}
        <div className="mt-12">
          <h3 className="mb-6 text-center font-display text-xl font-bold text-[var(--ink)]">
            Key Contribution Pathways
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTRIBUTION_AREAS_GUIDE.map((area) => (
              <a
                key={area.title}
                href={area.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-[var(--paper-line)] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--ink)]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-[var(--ink)] text-sm sm:text-base group-hover:text-[var(--navy)]">
                    {area.title}
                  </h4>
                  <ExternalLink size={14} className="shrink-0 text-[var(--ink-text)]/50 group-hover:text-[var(--ink)]" aria-hidden="true" />
                </div>
                <p className="mt-1.5 font-mono text-xs font-medium text-amber-800">
                  {area.tech}
                </p>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
                  {area.description}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Action Buttons / Repository Links */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-[var(--paper-line)] pt-8">
          <a
            href="https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm transition-all hover:bg-[var(--navy)] hover:shadow-md"
          >
            <BookOpen size={15} aria-hidden="true" />
            <span>Read Contribution Guidelines (CONTRIBUTING.md)</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>

          <a
            href="https://github.com/GoldRay19/kshemOS/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2.5 font-mono text-xs font-semibold text-[var(--ink)] shadow-sm transition-all hover:bg-[var(--paper)]"
          >
            <GitPullRequest size={15} aria-hidden="true" />
            <span>Browse Open Issues on GitHub</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>

          <a
            href="https://github.com/GoldRay19/kshemOS/blob/main/CODE_OF_CONDUCT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2.5 font-mono text-xs font-semibold text-[var(--ink-text)]/80 shadow-sm transition-all hover:bg-[var(--paper)]"
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>Code of Conduct</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Mission Footer */}
      <footer className="rounded-[28px] border border-[var(--paper-line)] bg-[var(--paper)] p-6 sm:p-8 text-center">
        <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)]">
          Our Public Safety Commitment
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/80">
          We believe cybersecurity should be explainable, transparent, and universally accessible.
          Every feature contributed to KshemOS helps protect citizens against evolving scams,
          digital arrest coercion, and financial exploitation.
        </p>
        <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--safe)]"></span>
          <span className="font-mono text-xs text-[var(--ink-text)]/80">
            Together for a Safer Digital India 🇮🇳
          </span>
        </div>
      </footer>
    </div>
  );
}
