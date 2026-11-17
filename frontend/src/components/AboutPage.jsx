import {
  Shield,
  ShieldCheck,
  Users,
  Cpu,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  BookOpen,
  HeartHandshake,
  CheckCircle2,
  GitPullRequest,
  Code2,
  Layers,
  Info,
  Sparkles
} from 'lucide-react';
import {
  PROJECT_MISSION,
  INTENDED_USERS,
  CORE_CAPABILITIES,
  PROTOTYPE_LIMITATIONS,
  PROJECT_LINKS
} from '../aboutPageData';

export default function AboutPage({ setActiveView }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-14 sm:space-y-16">
      {/* Hero Header */}
      <section className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-100/50 via-orange-50/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-mono font-bold uppercase tracking-wider text-[var(--saffron)]">
            <Shield className="w-3.5 h-3.5 text-[var(--saffron)]" />
            Project Story & Architecture Scope
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)]">
            About KshemOS: A Public Safety Operating System for the Digital Age
          </h1>

          <p className="text-sm sm:text-base text-[var(--ink-text)]/75 leading-relaxed">
            KshemOS bridges citizen intuition, real-time fraud deflection, and cyber precinct triage. 
            Built as an open, explainable digital defense layer to protect citizens from extortion before money moves into mule syndicate accounts.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveView('portal')}
              className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <span>Explore Live Verification Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('how-it-works')}
              className="rounded-full border border-[var(--paper-line)] hover:border-[var(--ink-text)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink-text)] transition-all flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-[var(--saffron)]" />
              <span>How It Works Walkthrough</span>
            </button>
          </div>
        </div>
      </section>

      {/* 1. Mission & Origins */}
      <section className="space-y-5">
        <div className="border-b border-[var(--paper-line)] pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
            Section 01
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
            Mission & Genesis
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
            Why KshemOS was built and the core public safety challenge it addresses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-6 sm:p-7 shadow-xs space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-xs font-mono font-bold uppercase text-red-700">
              The Genesis Problem
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">
              {PROJECT_MISSION.headline}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/80 leading-relaxed">
              {PROJECT_MISSION.originStory}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--paper-line)] bg-gradient-to-br from-[var(--paper)] to-orange-50/30 p-6 sm:p-7 shadow-xs space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold uppercase text-emerald-800">
              Our Core Purpose
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">
              An Open, Explainable Defense Layer
            </h3>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/80 leading-relaxed">
              {PROJECT_MISSION.corePurpose}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Intended Users & Stakeholders */}
      <section className="space-y-5">
        <div className="border-b border-[var(--paper-line)] pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
              Section 02
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
              Intended Users & Stakeholders
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
              Tailored workflows for citizens, vulnerable targets, cyber responders, and community educators.
            </p>
          </div>

          <span className="text-xs font-mono text-[var(--ink-text)]/50">
            4 Core User Groups
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {INTENDED_USERS.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-[var(--saffron)] transition-all"
            >
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[var(--saffron)] flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>

                <h3 className="font-display text-base font-bold text-[var(--ink)]">
                  {user.role}
                </h3>

                <p className="text-xs text-[var(--ink-text)]/75 leading-relaxed">
                  {user.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60 space-y-1.5">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[var(--ink-text)]/50">
                  Key Capabilities
                </span>
                <ul className="space-y-1 text-xs text-[var(--ink-text)]/80">
                  {user.keyBenefits.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] mt-1.5 shrink-0" />
                      <span className="leading-tight">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Core System Capabilities */}
      <section className="space-y-5">
        <div className="border-b border-[var(--paper-line)] pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
              Section 03
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
              Implemented Core Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
              Grounded, verifiable modules currently implemented and active in the KshemOS codebase.
            </p>
          </div>

          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-semibold">
            Verified in Codebase
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_CAPABILITIES.map((cap) => (
            <div
              key={cap.id}
              className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-text)]/65 border border-[var(--paper-line)]">
                    {cap.category}
                  </span>

                  <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                </div>

                <h3 className="font-display text-base sm:text-lg font-bold text-[var(--ink)]">
                  {cap.title}
                </h3>

                <p className="text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
                  {cap.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--paper-line)]/60">
                <button
                  type="button"
                  onClick={() => setActiveView(cap.targetView)}
                  className="w-full inline-flex items-center justify-between text-xs font-semibold text-[var(--ink)] hover:text-[var(--saffron)] transition-colors group"
                >
                  <span>Launch Module</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--saffron)] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Prototype Scope & Current Limitations */}
      <section className="space-y-5">
        <div className="border-b border-[var(--paper-line)] pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
            Section 04
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
            Prototype Scope & Technical Boundaries
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
            Transparent disclosure of system boundaries, non-custodial privacy policies, and advisory scope.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PROTOTYPE_LIMITATIONS.map((lim) => (
            <div
              key={lim.id}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 sm:p-6 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <h3 className="font-display text-sm sm:text-base font-bold text-amber-950">
                  {lim.title}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-amber-900/80 leading-relaxed pl-6">
                {lim.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Open Source Collaboration & Project Links */}
      <section className="space-y-5">
        <div className="border-b border-[var(--paper-line)] pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
            Section 05
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
            Open Source Links & Project Navigation
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
            Explore documentation, meet the contributors, review the codebase, and get involved.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Link 1: How It Works */}
          <button
            type="button"
            onClick={() => setActiveView('how-it-works')}
            className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-left shadow-xs hover:border-[var(--saffron)] transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-[var(--saffron)] flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">
                How It Works
              </h3>
              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Step-by-step 4-phase walkthrough distinguishing citizen actions from engine processing.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60 text-xs font-semibold text-[var(--saffron)] flex items-center justify-between">
              <span>View Walkthrough</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Link 2: Contributors & Team */}
          <button
            type="button"
            onClick={() => setActiveView('meet')}
            className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-left shadow-xs hover:border-[var(--saffron)] transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">
                Contributors & Team
              </h3>
              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Meet the engineering and research contributors behind KshemOS and explore contribution paths.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60 text-xs font-semibold text-emerald-700 flex items-center justify-between">
              <span>Meet Contributors</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Link 3: GitHub Source Repository */}
          <a
            href={PROJECT_LINKS.sourceRepo}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-left shadow-xs hover:border-[var(--ink)] transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-xl bg-gray-100 text-[var(--ink)] flex items-center justify-center font-bold">
                <Code2 className="w-4 h-4" />
              </div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">
                Source Repository
              </h3>
              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Inspect backend FastAPI services, React frontend stores, and test suites on GitHub.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60 text-xs font-semibold text-[var(--ink)] flex items-center justify-between">
              <span>View on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>

          {/* Link 4: Issues & Contributions */}
          <a
            href={PROJECT_LINKS.issues}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 text-left shadow-xs hover:border-[var(--saffron)] transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">
                Issues & Roadmap
              </h3>
              <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                Track open tasks, report new scam patterns, and participate in open development discussions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60 text-xs font-semibold text-blue-800 flex items-center justify-between">
              <span>Open Issues</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="rounded-3xl bg-[var(--navy)] text-white p-8 sm:p-12 text-center shadow-md relative overflow-hidden">
        <Sparkles className="mx-auto text-[var(--saffron)] w-10 h-10 mb-3" />

        <h2 className="font-display text-2xl sm:text-4xl font-bold">
          Built for Public Trust & Collective Defense
        </h2>

        <p className="mt-3 text-xs sm:text-sm max-w-xl mx-auto text-gray-300 leading-relaxed">
          KshemOS combines practical citizen protection with an explainable, human-centered architecture. 
          Test any call, analyze a pattern, or report an incident in seconds.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveView('portal')}
            className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] px-8 py-3 text-sm font-semibold text-white transition-all shadow-sm flex items-center gap-2"
          >
            <span>Launch Citizen Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveView('safety-tips')}
            className="rounded-full bg-white/10 hover:bg-white/15 border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all"
          >
            Emergency Safety Tips
          </button>
        </div>
      </section>
    </div>
  );
}
