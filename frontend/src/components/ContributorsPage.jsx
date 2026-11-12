import { useState, useMemo } from 'react';
import {
  ExternalLink,
  GitPullRequest,
  Shield,
  Users,
  Code2,
  BookOpen,
  Sparkles,
  Heart,
  Search,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import {
  CORE_TEAM,
  COMMUNITY_CONTRIBUTORS,
  ALL_CONTRIBUTORS,
  CONTRIBUTION_DOMAINS,
  CONTRIBUTION_AREAS_GUIDE,
  filterContributors,
  getContributorAvatarUrl,
} from '../data/contributorsData.js';
import GitHubContributorsSection from './GitHubContributorsSection';

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

function ContributorAvatar({ contributor, size = 64 }) {
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
        fontSize: size * 0.38,
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
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

function ContributorCard({ contributor }) {
  const isCore = contributor.type === 'core';

  return (
    <div
      className={`group flex flex-col justify-between rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        isCore
          ? 'border-[var(--saffron)]/40 ring-1 ring-[var(--saffron)]/20'
          : 'border-[var(--paper-line)] hover:border-[var(--ink)]/30'
      }`}
    >
      <div>
        {/* Top Header: Avatar & Badges */}
        <div className="flex items-start justify-between gap-4">
          <ContributorAvatar contributor={contributor} size={64} />

          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider ${
                isCore
                  ? 'bg-amber-50 text-[var(--saffron)] border border-[var(--saffron)]/30'
                  : 'bg-emerald-50 text-[var(--safe)] border border-[var(--safe)]/30'
              }`}
            >
              {isCore ? (
                <>
                  <Shield size={12} aria-hidden="true" />
                  Core Maintainer
                </>
              ) : (
                <>
                  <GitPullRequest size={12} aria-hidden="true" />
                  Contributor
                </>
              )}
            </span>

            <span className="font-mono text-[11px] text-[var(--ink-text)]/50">
              {contributor.domain}
            </span>
          </div>
        </div>

        {/* Identity & Role */}
        <div className="mt-5">
          <h3 className="font-display text-xl font-bold text-[var(--ink)] group-hover:text-[var(--navy)]">
            {contributor.name}
          </h3>

          <div className="mt-1 flex items-center gap-2">
            <a
              href={contributor.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-[var(--ink-text)]/60 hover:text-[var(--ink)] transition-colors"
              title={`View @${contributor.github} on GitHub`}
            >
              <GitHubMark size={13} />
              <span>@{contributor.github}</span>
            </a>
          </div>

          <p className="mt-2 text-xs font-mono font-medium tracking-wide text-[var(--ink-text)]/80">
            {contributor.role}
          </p>
        </div>

        {/* Contribution Area */}
        <div className="mt-4 rounded-2xl bg-[var(--paper)] p-3.5 border border-[var(--paper-line)]">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-text)]/60">
            Contribution Area
          </p>
          <p className="mt-1 text-xs leading-relaxed font-medium text-[var(--ink)]">
            {contributor.area}
          </p>
        </div>

        {/* Bio */}
        {contributor.bio && (
          <p className="mt-4 text-xs leading-relaxed text-[var(--ink-text)]/70 line-clamp-3">
            {contributor.bio}
          </p>
        )}

        {/* Highlights / PR Tags */}
        {contributor.highlights && contributor.highlights.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {contributor.highlights.map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-[var(--paper-line)] bg-white px-2 py-0.5 font-mono text-[11px] text-[var(--ink-text)]/70"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-6 border-t border-[var(--paper-line)] pt-4 flex items-center justify-between">
        <span className="font-mono text-[11px] text-[var(--ink-text)]/50">
          Verified in git log
        </span>

        <a
          href={contributor.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--ink)] transition-all hover:bg-[var(--ink)] hover:text-white"
          aria-label={`Visit ${contributor.name}'s GitHub profile`}
        >
          <span>Profile</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export default function ContributorsPage() {
  const [filterType, setFilterType] = useState('all'); // 'all', 'core', 'community'
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered contributors based on controls
  const filteredContributors = useMemo(() => {
    return filterContributors(ALL_CONTRIBUTORS, {
      type: filterType,
      domain: selectedDomain,
      query: searchQuery,
    });
  }, [filterType, selectedDomain, searchQuery]);

  const coreList = useMemo(
    () => filteredContributors.filter((c) => c.type === 'core'),
    [filteredContributors]
  );

  const communityList = useMemo(
    () => filteredContributors.filter((c) => c.type === 'community'),
    [filteredContributors]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero Section */}
      <header className="text-center">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2 shadow-sm">
          <div className="text-[var(--saffron)]">
            <ShieldMark size={20} />
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--ink)]">
            Open Source Contributors Hub
          </span>
        </div>

        <h1 className="mt-6 font-display text-4xl sm:text-5xl font-bold tracking-tight text-[var(--ink)]">
          Building Digital Public Safety Together
        </h1>

        <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg leading-relaxed text-[var(--ink-text)]/75">
          KshemOS is a community-driven, privacy-first cybersecurity operating system.
          Our platform brings together open-source contributors, cybersecurity researchers,
          and maintainers to protect citizens across India from online fraud, impersonation,
          and emerging digital threats.
        </p>

        {/* Quick Stats Bar */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-[var(--saffron)]">
              <Shield size={18} />
              <span className="font-display text-3xl font-bold">{CORE_TEAM.length}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--ink-text)]/60 uppercase tracking-wider">
              Core Maintainers
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-[var(--safe)]">
              <Users size={18} />
              <span className="font-display text-3xl font-bold">{COMMUNITY_CONTRIBUTORS.length}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--ink-text)]/60 uppercase tracking-wider">
              Community Contributors
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-[var(--navy)]">
              <Code2 size={18} />
              <span className="font-display text-3xl font-bold">{ALL_CONTRIBUTORS.length}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--ink-text)]/60 uppercase tracking-wider">
              Verified Contributors
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-indigo-600">
              <Sparkles size={18} />
              <span className="font-display text-3xl font-bold">100%</span>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--ink-text)]/60 uppercase tracking-wider">
              Open Source (MIT)
            </p>
          </div>
        </div>
      </header>

      {/* Filter and Search Navigation Bar */}
      <section
        className="mt-14 rounded-3xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-sm"
        aria-label="Filter contributors"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`rounded-full px-4 py-2 font-mono text-xs font-semibold transition-all ${
                filterType === 'all'
                  ? 'bg-[var(--ink)] text-white shadow-sm'
                  : 'bg-[var(--paper)] text-[var(--ink-text)]/70 hover:bg-[var(--paper-line)]'
              }`}
            >
              All Contributors ({ALL_CONTRIBUTORS.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('core')}
              className={`rounded-full px-4 py-2 font-mono text-xs font-semibold transition-all ${
                filterType === 'core'
                  ? 'bg-[var(--saffron)] text-white shadow-sm'
                  : 'bg-[var(--paper)] text-[var(--ink-text)]/70 hover:bg-[var(--paper-line)]'
              }`}
            >
              Core Maintainers ({CORE_TEAM.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('community')}
              className={`rounded-full px-4 py-2 font-mono text-xs font-semibold transition-all ${
                filterType === 'community'
                  ? 'bg-[var(--safe)] text-white shadow-sm'
                  : 'bg-[var(--paper)] text-[var(--ink-text)]/70 hover:bg-[var(--paper-line)]'
              }`}
            >
              Community ({COMMUNITY_CONTRIBUTORS.length})
            </button>
          </div>

          {/* Search & Domain Dropdown */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Domain Filter Dropdown */}
            <div className="relative w-full sm:w-auto">
              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-2">
                <Filter size={14} className="text-[var(--ink-text)]/50 shrink-0" />
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="bg-transparent font-mono text-xs text-[var(--ink-text)] focus:outline-none cursor-pointer pr-2"
                  aria-label="Filter by contribution domain"
                >
                  {CONTRIBUTION_DOMAINS.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-text)]/40 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search name, area, PR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] pl-9 pr-4 py-2 font-mono text-xs text-[var(--ink-text)] placeholder:text-[var(--ink-text)]/40 focus:border-[var(--ink)] focus:bg-white focus:outline-none transition-all"
                aria-label="Search contributors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--ink-text)]/50 hover:text-[var(--ink)]"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results summary bar */}
        <div className="mt-4 pt-3 border-t border-[var(--paper-line)] flex items-center justify-between font-mono text-xs text-[var(--ink-text)]/60">
          <span>
            Showing {filteredContributors.length} of {ALL_CONTRIBUTORS.length} verified contributors
          </span>
          {(filterType !== 'all' || selectedDomain !== 'All Domains' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterType('all');
                setSelectedDomain('All Domains');
                setSearchQuery('');
              }}
              className="text-[var(--saffron)] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </section>

      {/* Section 1: Core Team (when visible in current filter) */}
      {coreList.length > 0 && (
        <section className="mt-16" aria-labelledby="core-team-heading">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-[var(--saffron)]">
              <Shield size={18} />
            </span>
            <div>
              <h2 id="core-team-heading" className="font-display text-2xl font-bold text-[var(--ink)]">
                Core Maintainers & Leadership
              </h2>
              <p className="text-xs font-mono text-[var(--ink-text)]/60 mt-0.5">
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

      {/* Section 2: Community Contributors (when visible in current filter) */}
      {communityList.length > 0 && (
        <section className="mt-16" aria-labelledby="community-contributors-heading">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-[var(--safe)]">
              <Users size={18} />
            </span>
            <div>
              <h2
                id="community-contributors-heading"
                className="font-display text-2xl font-bold text-[var(--ink)]"
              >
                Community Contributors
              </h2>
              <p className="text-xs font-mono text-[var(--ink-text)]/60 mt-0.5">
                Open-source developers and researchers engineering key features, security modules, and APIs
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

      {/* Empty State */}
      {filteredContributors.length === 0 && (
        <div className="mt-16 rounded-3xl border border-dashed border-[var(--paper-line)] bg-white p-12 text-center">
          <p className="font-display text-lg font-bold text-[var(--ink)]">
            No contributors matched your filters
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--ink-text)]/60">
            Try adjusting your search query or selecting &quot;All Domains&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterType('all');
              setSelectedDomain('All Domains');
              setSearchQuery('');
            }}
            className="mt-5 rounded-full bg-[var(--ink)] px-5 py-2 font-mono text-xs font-semibold text-white hover:bg-[var(--navy)]"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Resilient Live GitHub Contributors Section */}
      <GitHubContributorsSection />

      {/* Contribution Call-To-Action (CTA) & Guidance Section */}
      <section
        className="mt-20 rounded-[32px] border border-[var(--paper-line)] bg-gradient-to-b from-white to-[var(--paper)] p-8 sm:p-12 shadow-sm"
        aria-labelledby="how-to-contribute-heading"
      >
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--safe)]/30 bg-emerald-50 px-4 py-1.5 text-xs font-mono font-semibold text-[var(--safe)]">
            <Heart size={14} className="fill-[var(--safe)]" />
            <span>Join the Community</span>
          </div>

          <h2
            id="how-to-contribute-heading"
            className="mt-4 font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]"
          >
            How to Contribute to KshemOS
          </h2>

          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--ink-text)]/75">
            We welcome developers, UI/UX designers, cybersecurity researchers, and technical writers.
            KshemOS encourages participation in community initiatives including the annual
            <strong className="text-[var(--ink)]"> Winter of Code (Nov 1 – Jan 31)</strong>.
          </p>
        </div>

        {/* 4-Step Contribution Process */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-mono font-bold text-sm">
              01
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Find an Issue
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-text)]/70">
              Browse the repository issue tracker for issues tagged with{' '}
              <code className="rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-[11px]">
                good first issue
              </code>{' '}
              or feature enhancements.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[var(--saffron)] font-mono font-bold text-sm">
              02
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Fork &amp; Branch
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-text)]/70">
              Fork the repository to your account and create a focused topic branch:{' '}
              <code className="rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-[11px]">
                feature/your-topic
              </code>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-mono font-bold text-sm">
              03
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Build &amp; Test
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-text)]/70">
              Implement your changes according to coding guidelines, run automated tests (
              <code className="rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-[11px]">
                npm test
              </code>
              ), and verify UI responsiveness.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[var(--safe)] font-mono font-bold text-sm">
              04
            </div>
            <h3 className="mt-4 font-display font-bold text-[var(--ink)] text-base">
              Open a PR
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-text)]/70">
              Submit a well-documented pull request explaining your problem statement, solution,
              and testing evidence.
            </p>
          </div>
        </div>

        {/* Contribution Areas Grid */}
        <div className="mt-12">
          <h3 className="font-display text-xl font-bold text-[var(--ink)] text-center mb-6">
            Key Contribution Pathways
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {CONTRIBUTION_AREAS_GUIDE.map((area) => (
              <a
                key={area.title}
                href={area.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-[var(--paper-line)] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--ink)]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-[var(--ink)] text-sm group-hover:text-[var(--navy)]">
                    {area.title}
                  </h4>
                  <ExternalLink size={14} className="text-[var(--ink-text)]/40 group-hover:text-[var(--ink)]" />
                </div>
                <p className="mt-1 font-mono text-[11px] text-[var(--saffron)]">
                  {area.tech}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-text)]/70">
                  {area.description}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Action Buttons / Repository Links */}
        <div className="mt-12 pt-8 border-t border-[var(--paper-line)] flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 font-mono text-xs font-semibold text-white shadow-sm transition-all hover:bg-[var(--navy)] hover:shadow-md"
          >
            <BookOpen size={15} />
            <span>Read Contribution Guidelines (CONTRIBUTING.md)</span>
            <ExternalLink size={13} />
          </a>

          <a
            href="https://github.com/GoldRay19/kshemOS/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-6 py-3 font-mono text-xs font-semibold text-[var(--ink)] shadow-sm transition-all hover:bg-[var(--paper)]"
          >
            <GitPullRequest size={15} />
            <span>Browse Open Issues on GitHub</span>
            <ExternalLink size={13} />
          </a>

          <a
            href="https://github.com/GoldRay19/kshemOS/blob/main/CODE_OF_CONDUCT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-5 py-3 font-mono text-xs font-semibold text-[var(--ink-text)]/80 shadow-sm transition-all hover:bg-[var(--paper)]"
          >
            <CheckCircle2 size={15} />
            <span>Code of Conduct</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </section>

      {/* Mission Footer */}
      <footer className="mt-16 rounded-[28px] border border-[var(--paper-line)] bg-[var(--paper)] p-8 text-center">
        <h3 className="font-display text-2xl font-bold text-[var(--ink)]">
          Our Public Safety Commitment
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-[var(--ink-text)]/75">
          We believe cybersecurity should be explainable, transparent, and universally accessible.
          Every feature contributed to KshemOS helps protect real citizens against evolving scams,
          digital arrest coercion, and financial exploitation.
        </p>
        <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--safe)] animate-pulse"></span>
          <span className="font-mono text-xs text-[var(--ink-text)]/80">
            Together for a Safer Digital India 🇮🇳
          </span>
        </div>
      </footer>
    </div>
  );
}

