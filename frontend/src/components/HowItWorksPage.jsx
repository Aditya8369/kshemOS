import { useState } from 'react';
import {
  User,
  Cpu,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Activity,
  Info,
  Sparkles,
  Terminal,
  HelpCircle,
  PhoneCall,
  Lock,
  Layers
} from 'lucide-react';
import {
  WALKTHROUGH_STEPS,
  SYSTEM_DISCLAIMERS,
  COMPARISON_TRACKS,
  filterWalkthroughSteps
} from '../howItWorksData';

export default function HowItWorksPage({ setActiveView }) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'user_action' | 'system_processing'
  const [expandedStep, setExpandedStep] = useState(null);

  const displayedSteps = filterWalkthroughSteps(WALKTHROUGH_STEPS, activeFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Hero Section */}
      <section className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-100/50 via-orange-50/30 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-mono font-bold uppercase tracking-wider text-[var(--saffron)]">
            <Activity className="w-3.5 h-3.5 text-[var(--saffron)]" />
            Process Walkthrough & Verification Architecture
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)]">
            How KshemOS Protects Citizens Before Money Moves
          </h1>

          <p className="text-sm sm:text-base text-[var(--ink-text)]/75 leading-relaxed">
            Follow the 4-step sequence from the moment a suspicious call or message arrives to transparent risk evaluation and actionable containment. 
            See clearly <strong>what you do</strong> versus <strong>what the engine processes behind the scenes</strong>.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveView('portal')}
              className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <span>Try Live in Verification Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('scam-examples')}
              className="rounded-full border border-[var(--paper-line)] hover:border-[var(--ink-text)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink-text)] transition-all"
            >
              Browse Scam Examples
            </button>
          </div>
        </div>
      </section>

      {/* Filter Toolbar: Distinguishing User Actions vs System Processing */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--paper)] border border-[var(--paper-line)] rounded-2xl p-4 sm:p-5">
          <div className="space-y-0.5">
            <h2 className="font-display text-base sm:text-lg font-bold text-[var(--ink)]">
              Interactive Sequence Walkthrough
            </h2>
            <p className="text-xs text-[var(--ink-text)]/65">
              Filter by actor role or inspect the end-to-end 4-step sequence.
            </p>
          </div>

          {/* Actor Filter Pills */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[var(--paper-line)] self-start sm:self-auto shadow-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'text-[var(--ink-text)]/70 hover:bg-[var(--paper)]'
              }`}
            >
              Complete Sequence (All 4)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('user_action')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'user_action'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-blue-900/80 hover:bg-blue-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>What You Do (2)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('system_processing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'system_processing'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'text-purple-900/80 hover:bg-purple-50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Behind the Scenes (2)</span>
            </button>
          </div>
        </div>

        {/* Responsive Sequential Step Cards with Visual Connectors */}
        <div className="relative">
          {/* Vertical Connecting Spine for Mobile / Stacked views (visible on all screens without relying solely on color) */}
          <div className="space-y-6 sm:space-y-8">
            {displayedSteps.map((step, idx) => {
              const isUser = step.actorType === 'user_action';
              const isLast = idx === displayedSteps.length - 1;

              return (
                <div key={step.stepNumber} className="relative">
                  {/* Step Card */}
                  <div
                    className={`rounded-2xl border transition-all duration-200 bg-white p-5 sm:p-7 shadow-xs ${
                      isUser
                        ? 'border-blue-200 hover:border-blue-400 hover:shadow-md'
                        : 'border-purple-200 hover:border-purple-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Accessible Step Number & Actor Badge */}
                      <div className="flex items-start gap-4">
                        {/* High-Contrast Number Badge: Understandable without color */}
                        <div
                          className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display font-bold shrink-0 border-2 select-none ${
                            isUser
                              ? 'bg-blue-50 text-blue-950 border-blue-900'
                              : 'bg-purple-50 text-purple-950 border-purple-900'
                          }`}
                        >
                          <span className="text-[10px] font-mono tracking-tighter uppercase font-semibold">
                            STEP
                          </span>
                          <span className="text-2xl leading-none font-extrabold">
                            {step.stepLabel}
                          </span>
                        </div>

                        {/* Title, Subtitle, and Actor Indicator */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Explicit Actor Badge */}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                                isUser
                                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : 'bg-purple-100 text-purple-900 border border-purple-300'
                              }`}
                            >
                              {isUser ? (
                                <User className="w-3 h-3 text-blue-700" />
                              ) : (
                                <Cpu className="w-3 h-3 text-purple-700" />
                              )}
                              <span>{step.actorBadge}: {step.actorLabel}</span>
                            </span>

                            <span className="text-xs font-mono text-[var(--ink-text)]/40 font-semibold">
                              Step {step.stepNumber} of 4
                            </span>
                          </div>

                          <h3 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)]">
                            {step.title}
                          </h3>

                          <p className="text-xs sm:text-sm text-[var(--ink-text)]/65 font-medium">
                            {step.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Description Body */}
                    <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60 grid grid-cols-1 lg:grid-cols-12 gap-5">
                      <div className="lg:col-span-7 space-y-3">
                        <p className="text-xs sm:text-sm text-[var(--ink-text)]/85 leading-relaxed">
                          {step.shortDescription}
                        </p>

                        <div
                          className={`rounded-xl p-3 text-xs leading-relaxed border ${
                            isUser
                              ? 'bg-blue-50/50 border-blue-200/80 text-blue-950'
                              : 'bg-purple-50/50 border-purple-200/80 text-purple-950'
                          }`}
                        >
                          <strong>{isUser ? 'Citizen Safeguard:' : 'System Intelligence:'}</strong> {step.systemOrUserDetail}
                        </div>

                        {/* Expandable Technical Snippet */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStep(
                                expandedStep === step.stepNumber ? null : step.stepNumber
                              )
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--saffron)] hover:underline"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>
                              {expandedStep === step.stepNumber
                                ? 'Hide Concrete Data Example'
                                : 'View Concrete Data Example'}
                            </span>
                          </button>

                          {expandedStep === step.stepNumber && (
                            <div className="mt-2 rounded-xl bg-[var(--ink)] text-gray-200 p-3.5 text-xs font-mono border border-gray-700 leading-relaxed">
                              {step.exampleSnippet}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Key Micro-Points Checklist */}
                      <div className="lg:col-span-5 bg-[var(--paper)] rounded-xl p-4 border border-[var(--paper-line)] space-y-2">
                        <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[var(--ink-text)]/60 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Key Protocol Points
                        </span>
                        <ul className="space-y-1.5 text-xs text-[var(--ink-text)]/80">
                          {step.keyPoints.map((pt, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-2">
                              <span
                                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                  isUser ? 'bg-blue-600' : 'bg-purple-600'
                                }`}
                              />
                              <span className="leading-relaxed">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Responsive Visual Connector (Understandable without color) */}
                  {!isLast && (
                    <div className="py-2 flex items-center justify-center" aria-hidden="true">
                      <div className="flex flex-col items-center gap-1 text-[var(--ink-text)]/40 font-mono text-[10px] uppercase font-bold tracking-widest">
                        <div className="w-0.5 h-4 bg-[var(--paper-line)] border-l-2 border-dashed border-gray-400" />
                        <div className="inline-flex items-center gap-1.5 bg-white border border-[var(--paper-line)] px-3 py-1 rounded-full shadow-2xs">
                          <ArrowDown className="w-3.5 h-3.5 text-[var(--ink)]" />
                          <span>Then Continues To Step 0{step.stepNumber + 1}</span>
                        </div>
                        <div className="w-0.5 h-4 bg-[var(--paper-line)] border-l-2 border-dashed border-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Avoid Implying Guarantee: Non-Guarantee Advisory & Inconclusive Safeguard */}
      <section className="rounded-3xl border-2 border-amber-300 bg-amber-50/70 p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-950" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-xs font-mono font-bold uppercase tracking-wide">
              Transparency & Limitations Policy
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-amber-950">
              {SYSTEM_DISCLAIMERS.title}
            </h2>
            <p className="text-xs sm:text-sm text-amber-900/85 leading-relaxed max-w-4xl">
              {SYSTEM_DISCLAIMERS.summary}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {SYSTEM_DISCLAIMERS.points.map((pt, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-white/90 border border-amber-200 p-3.5 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5 leading-relaxed"
            >
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Two-Track Overview: What You Experience vs What the Engine Computes */}
      <section className="space-y-4">
        <div className="border-b border-[var(--paper-line)] pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
            Side-by-Side Swimlane
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
            Two Tracks of Safety: Experience vs System Processing
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
            Compare each phase of the journey side-by-side to understand how user intuition coordinates with automated extraction.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--paper-line)] bg-white shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[var(--paper)] text-[var(--ink-text)]/70 font-mono uppercase text-[11px] border-b border-[var(--paper-line)]">
              <tr>
                <th className="p-3.5 sm:p-4 w-1/4">Process Phase</th>
                <th className="p-3.5 sm:p-4 w-3/8 text-blue-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <User className="w-3.5 h-3.5" />
                    <span>Citizen User Track (What You Do)</span>
                  </div>
                </th>
                <th className="p-3.5 sm:p-4 w-3/8 text-purple-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>KshemOS Engine Track (Behind The Scenes)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--paper-line)]">
              {COMPARISON_TRACKS.map((track, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="p-3.5 sm:p-4 font-semibold text-[var(--ink)] whitespace-nowrap">
                    {track.pillar}
                  </td>
                  <td className="p-3.5 sm:p-4 text-blue-950 bg-blue-50/20 leading-relaxed">
                    {track.userAction}
                  </td>
                  <td className="p-3.5 sm:p-4 text-purple-950 bg-purple-50/20 leading-relaxed">
                    {track.systemProcessing}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="rounded-3xl bg-[var(--navy)] text-white p-8 sm:p-12 text-center shadow-md relative overflow-hidden">
        <Sparkles className="mx-auto text-[var(--saffron)] w-10 h-10 mb-3" />

        <h2 className="font-display text-2xl sm:text-4xl font-bold">
          Ready to experience the verification flow?
        </h2>

        <p className="mt-3 text-xs sm:text-sm max-w-xl mx-auto text-gray-300 leading-relaxed">
          Test any suspicious call script or SMS notice in real time. 
          See how the 4-step process analyzes authority claims, calibrates risk scores, and drafts safe responses.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveView('portal')}
            className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] px-8 py-3 text-sm font-semibold text-white transition-all shadow-sm flex items-center gap-2"
          >
            <span>Launch Citizen Verification Demo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveView('rule-library')}
            className="rounded-full bg-white/10 hover:bg-white/15 border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all"
          >
            Explore Rule Engine Library
          </button>
        </div>
      </section>
    </div>
  );
}
