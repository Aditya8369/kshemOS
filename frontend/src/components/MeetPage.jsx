import ContributorsPage from './ContributorsPage';
import {
  GitPullRequest,
  GitBranch,
  BookOpen,
  Code,
  Palette,
  CheckCircle2,
  Search,
  ExternalLink,
  ArrowRight,
  Compass,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

/**
 * MeetPage serves as the dedicated Contributors & Team Hub.
 * Re-exports ContributorsPage for backward compatibility with existing links/routes,
 * while embedding comprehensive contributor pathways and team details.
 */

const TEAM = [
  {
    name: "Esha Jha",
    role: "Full Stack Developer & Cybersecurity Researcher",
    bio: "Building end-to-end cyber safety tools with a focus on rule-based scam detection, threat intelligence, and user protection systems. Passionate about making digital safety accessible to everyone.",
    initials: "EJ",
    color: "var(--saffron)",
    skills: ["React", "Cybersecurity", "Frontend", "Threat Detection"],
  },
  {
    name: "Eshita Jha",
    role: "ML Engineer & Cybersecurity Researcher",
    bio: "Engineering intelligent rule-based systems for phishing, impersonation, and financial fraud detection. Focused on creating scalable, explainable, and privacy-first safety solutions.",
    initials: "EJ",
    color: "var(--safe)",
    skills: ["Machine Learning", "Fraud Detection", "Python", "AI Security"],
  },
];

const REPO_LINKS = {
  issues: 'https://github.com/GoldRay19/kshemOS/issues',
  pulls: 'https://github.com/GoldRay19/kshemOS/pulls',
  contributing: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md',
};

const CONTRIBUTION_STEPS = [
  {
    step: '01',
    title: 'Find an Issue',
    description:
      'Explore open issues on GitHub. Look for labels like [level1] or good first issue for well-scoped, beginner-friendly tasks.',
    actionLabel: 'Browse Issues',
    actionHref: 'https://github.com/GoldRay19/kshemOS/issues',
    icon: Search,
  },
  {
    step: '02',
    title: 'Discuss Scope & Claim',
    description:
      'Comment on the issue to outline your planned approach and ask the maintainers (@GoldRay19) to assign it to you before starting.',
    actionLabel: 'Discuss on GitHub',
    actionHref: 'https://github.com/GoldRay19/kshemOS/issues',
    icon: MessageSquare,
  },
  {
    step: '03',
    title: 'Branch & Code Locally',
    description:
      'Fork the repository, clone it locally, and create a dedicated branch like feat/emergency-alerts or fix/map-display.',
    actionLabel: 'Setup Guide',
    actionHref: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md#how-to-contribute',
    icon: GitBranch,
  },
  {
    step: '04',
    title: 'Test & Open a PR',
    description:
      'Run frontend and backend test suites, verify responsive design, commit with clear messages, and submit your Pull Request.',
    actionLabel: 'View Active PRs',
    actionHref: 'https://github.com/GoldRay19/kshemOS/pulls',
    icon: GitPullRequest,
  },
  {
    step: '05',
    title: 'Review & Merge',
    description:
      'Engage with maintainer feedback, address review comments, pass CI checks, and see your code merged into KshemOS!',
    actionLabel: 'PR Guidelines',
    actionHref: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md#pull-request-guidelines',
    icon: CheckCircle2,
  },
];

const CONTRIBUTION_TYPES = [
  {
    title: 'Code & Engineering',
    category: 'Engineering',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Code,
    description:
      'Build React 19 UI features, FastAPI backend services, NetworkX graph intelligence, or local detection rule engines.',
    skills: ['React 19', 'FastAPI', 'Tailwind CSS', 'Python 3.11+', 'NetworkX'],
    link: 'https://github.com/GoldRay19/kshemOS/issues',
    linkLabel: 'View Code Issues',
  },
  {
    title: 'Documentation',
    category: 'Technical Writing',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: BookOpen,
    description:
      'Improve developer setup instructions, write architectural blueprints, clarify threat detection guides, or expand API references.',
    skills: ['Markdown', 'API Docs', 'Guides', 'Technical Writing'],
    link: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md',
    linkLabel: 'Read Contributing Docs',
  },
  {
    title: 'Design & UI / UX',
    category: 'Design & A11y',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Palette,
    description:
      'Enhance information architecture, make emergency interfaces calm and accessible, polish mobile responsiveness, and adhere to WCAG standards.',
    skills: ['UI/UX', 'Accessibility (a11y)', 'Tailwind CSS', 'Responsive Layouts'],
    link: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3AUI',
    linkLabel: 'Explore UI Tasks',
  },
  {
    title: 'Testing & QA',
    category: 'Quality Assurance',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: CheckCircle2,
    description:
      'Write unit tests for client-side stores, create backend router test fixtures with pytest, and verify cross-browser compatibility.',
    skills: ['Node.js Tests', 'Pytest', 'Edge Cases', 'Regression Testing'],
    link: 'https://github.com/GoldRay19/kshemOS/tree/main/backend/tests',
    linkLabel: 'Inspect Test Suites',
  },
  {
    title: 'Research & Threat Intel',
    category: 'Cyber Intelligence',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: Search,
    description:
      'Curate synthetic scam scripts, investigate real-world digital arrest patterns, expand counterfeit heuristics, and map regional fraud schemes.',
    skills: ['Cybersecurity', 'Threat Intelligence', 'Fraud Corpus', 'Analysis'],
    link: 'https://github.com/GoldRay19/kshemOS/tree/main/backend/app/data',
    linkLabel: 'Explore Scam Corpus',
  },
];

function ShieldMark({ size = 34 }) {
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

export default function MeetPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-12">

      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--paper-line)] bg-white px-4 py-1.5 shadow-2xs">
          <div className="text-[var(--safe)]">
            <ShieldMark size={20} />
          </div>

          <span className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--safe)]">
            Meet the Team
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[var(--ink)] leading-tight">
          Building Safer Digital Experiences
        </h1>

        <p className="mx-auto max-w-3xl text-sm sm:text-base leading-relaxed text-[var(--ink-text)]/75">
          KshemOS is built by passionate developers and cybersecurity
          researchers dedicated to protecting users from scams,
          impersonation, phishing, and online financial fraud through
          intelligent and explainable security tools.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          ["2", "Core Members"],
          ["12+", "Security Modules"],
          ["100%", "Privacy First"],
        ].map(([number, label]) => (
          <div
            key={label}
            className="rounded-3xl border border-[var(--paper-line)] bg-white p-8 text-center shadow-sm"
          >
            <div className="font-display text-4xl font-bold text-[var(--safe)]" aria-hidden="true">
              {number}
            </div>

            <p className="mt-2 text-sm text-[var(--ink-text)]/60">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Team */}
      <section aria-label="Core Team" className="mt-20">
        <h2 className="sr-only">Core Research and Engineering Team</h2>
        <div className="grid gap-8 md:grid-cols-2">
          {TEAM.map((member) => (
            <div
              key={member.name}
              className="group rounded-3xl border border-[var(--paper-line)] bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
            >
              {/* Avatar */}
              <div
                className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold text-white transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: member.color }}
              >
                {member.initials}
              </div>

              <h3 className="font-display text-2xl font-bold text-[var(--ink)]">
                {member.name}
              </h3>

              <p
                className="mt-2 text-xs font-mono uppercase tracking-[0.25em]"
                style={{ color: member.color }}
              >
                {member.role}
              </p>

              <p className="mt-5 leading-7 text-[var(--ink-text)]/70">
                {member.bio}
              </p>

              {/* Skills */}
              <div className="mt-6 flex flex-wrap gap-2">
                {member.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-1 text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="mt-8 border-t border-[var(--paper-line)] pt-5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--ink-text)]/50">
                  <ShieldMark size={16} />
                  KshemOS Core Team
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* First-Time Contributor Pathways (Issue #60) */}
      <section
        id="contribution-pathways"
        aria-labelledby="pathways-heading"
        className="mt-20 rounded-[32px] border border-[var(--paper-line)] bg-white/80 backdrop-blur p-8 sm:p-12 shadow-sm space-y-12"
      >
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-4 py-1 text-xs font-mono font-medium text-[var(--saffron)]">
            <Compass size={14} aria-hidden="true" />
            <span>Open Source Community</span>
          </div>

          <h2
            id="pathways-heading"
            className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]"
          >
            First-Time Contributor Pathways
          </h2>

          <p className="text-sm sm:text-base text-[var(--ink-text)]/70 leading-relaxed">
            First-time contributors need a clear path from discovering KshemOS to making their first pull request.
            Follow the 5-step roadmap below to find tasks, claim issues, and start building.
          </p>

          {/* Quick links banner */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href={REPO_LINKS.issues}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--navy)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:outline-none"
            >
              <span>Explore Open Issues</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>

            <a
              href={REPO_LINKS.contributing}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:outline-none"
            >
              <BookOpen size={13} aria-hidden="true" />
              <span>Read CONTRIBUTING.md</span>
            </a>

            <a
              href={REPO_LINKS.pulls}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] bg-white px-5 py-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:outline-none"
            >
              <GitPullRequest size={13} aria-hidden="true" />
              <span>Active Pull Requests</span>
            </a>
          </div>
        </div>

        {/* 5-Step Contribution Roadmap */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--ink-text)]/60 font-semibold">
            <ArrowRight size={14} className="text-[var(--saffron)]" />
            <span>5-Step Contribution Process</span>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {CONTRIBUTION_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="group rounded-2xl border border-[var(--paper-line)] bg-white p-5 shadow-2xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[var(--saffron)] bg-[var(--paper)] px-2.5 py-1 rounded-full border border-[var(--paper-line)]">
                        Step {item.step}
                      </span>
                      <div className="text-[var(--ink-text)]/40 group-hover:text-[var(--saffron)] transition-colors">
                        <Icon size={18} aria-hidden="true" />
                      </div>
                    </div>

                    <h3 className="font-display text-base font-bold text-[var(--ink)]">
                      {item.title}
                    </h3>

                    <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60">
                    <a
                      href={item.actionHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ink)] hover:text-[var(--saffron)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:outline-none rounded"
                      aria-label={`${item.actionLabel} for step ${item.step}: ${item.title}`}
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight size={11} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contribution Types by Discipline */}
        <div className="space-y-4 pt-4 border-t border-[var(--paper-line)]/80">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--ink-text)]/60 font-semibold">
            <Sparkles size={14} className="text-[var(--safe)]" />
            <span>Contribution Pathways by Skill</span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CONTRIBUTION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.title}
                  className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--paper)] text-[var(--ink)] border border-[var(--paper-line)]">
                        <Icon size={22} aria-hidden="true" />
                      </div>

                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full border font-semibold ${type.badgeColor}`}
                      >
                        {type.category}
                      </span>
                    </div>

                    <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                      {type.title}
                    </h3>

                    <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                      {type.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {type.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-[var(--paper-line)] bg-[var(--paper)] px-2.5 py-0.5 text-[10px] font-mono text-[var(--ink-text)]/75"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--paper-line)]/70 flex items-center justify-between">
                    <a
                      href={type.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--saffron)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:outline-none rounded py-1"
                      aria-label={`${type.linkLabel} for ${type.title}`}
                    >
                      <span>{type.linkLabel}</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>

                    <span className="text-[10px] font-mono text-[var(--ink-text)]/40 uppercase">
                      Open Source
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mission */}
      <div className="mt-20 rounded-[32px] border border-[var(--paper-line)] bg-[var(--paper)] p-10 text-center">
        <h2 className="font-display text-3xl font-bold text-[var(--ink)]">
          Our Mission
        </h2>

        <p className="mx-auto mt-5 max-w-3xl leading-8 text-[var(--ink-text)]/70">
          We believe cybersecurity should be simple, transparent, and
          accessible. KshemOS combines explainable rule-based detection,
          machine intelligence, and user-focused design to help everyone
          stay protected against evolving cyber threats.
        </p>

        <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-[var(--paper-line)] bg-white px-6 py-3 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--safe)]"></span>

          <span className="font-mono text-sm text-[var(--ink-text)]/70">
            Together for a Safer Digital India 🇮🇳
          </span>
        </div>
      </div>

    </div>
  );
}