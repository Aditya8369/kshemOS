import { useState, useMemo } from 'react';
import {
  PhoneCall,
  PhoneOff,
  MessageSquare,
  CreditCard,
  Lock,
  FileText,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Building2,
  Clock,
  Sparkles,
  LifeBuoy,
  Search,
  Check,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  EMERGENCY_ACTIONS,
  SAFETY_CATEGORIES,
  TRUSTED_REPORTING_DIRECTORY,
  MAJOR_BANKS_HOTLINES
} from '../safetyTipsData';

export default function SafetyTipsPage({ setActiveView }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [completedSteps, setCompletedSteps] = useState({});
  const [viewTab, setViewTab] = useState('all'); // 'all' | 'emergency' | 'categories' | 'directory'

  // Toggle step completion for stressed users tracking progress
  function toggleStep(id) {
    setCompletedSteps((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  const categoryList = useMemo(() => Object.values(SAFETY_CATEGORIES), []);

  const filteredCategories = useMemo(() => {
    let cats = categoryList;

    if (selectedCategory !== 'all') {
      cats = cats.filter((c) => c.id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      cats = cats.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.immediateActions.some((a) => a.rule.toLowerCase().includes(q) || a.why.toLowerCase().includes(q)) ||
          c.preventionTips.some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    return cats;
  }, [categoryList, selectedCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Emergency Distress Header */}
      <div className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 via-rose-50/50 to-orange-50/40 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 border border-red-200 text-xs font-mono font-bold tracking-wide uppercase text-red-800">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />
              Emergency Response Guidance
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-red-950">
              Quick Safety Action & Emergency Scanning
            </h1>

            <p className="text-sm sm:text-base text-red-900/80 leading-relaxed">
              If you or someone nearby is currently on a suspicious call or noticed unauthorized transactions, 
              <strong> stay calm and execute these immediate steps</strong>.
            </p>
          </div>

          {/* Quick Call 1930 Button */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <a
              href="tel:1930"
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <PhoneCall className="w-4 h-4 animate-bounce" />
              <span>Dial 1930 National Helpline</span>
            </a>
            <button
              onClick={() => setActiveView('portal')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300 bg-white hover:bg-red-50 text-red-950 px-5 py-2.5 text-xs font-semibold transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-red-600" />
              <span>File Guided Incident Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Immediate Emergency Action Checklist: Separated from General Advice */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--paper-line)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs">
              SOS
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)]">
                Immediate Actions (If Under Active Threat Right Now)
              </h2>
              <p className="text-xs text-[var(--ink-text)]/65">
                Execute these high-priority containment steps in order before dealing with paperwork.
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-[var(--ink-text)]/60 bg-[var(--paper)] px-3 py-1 rounded-full border border-[var(--paper-line)] self-start sm:self-auto">
            {Object.values(completedSteps).filter(Boolean).length} / {EMERGENCY_ACTIONS.length} Actions Completed
          </span>
        </div>

        {/* Rapid Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EMERGENCY_ACTIONS.map((item) => {
            const isDone = !!completedSteps[item.id];
            const isCritical = item.urgency === 'critical';

            return (
              <div
                key={item.id}
                onClick={() => toggleStep(item.id)}
                className={`rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all flex flex-col justify-between select-none ${
                  isDone
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                    : isCritical
                    ? 'bg-white border-red-200/90 hover:border-red-400 hover:shadow-sm'
                    : 'bg-white border-amber-200/90 hover:border-amber-400 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                        isDone
                          ? 'bg-emerald-200 text-emerald-900'
                          : isCritical
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      STEP {item.stepNumber}
                    </span>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isDone
                          ? 'text-emerald-700 bg-emerald-100'
                          : 'text-[var(--ink-text)]/60 bg-[var(--paper)]'
                      }`}
                    >
                      {item.timeframe}
                    </span>
                  </div>

                  <h3
                    className={`font-display text-base font-bold leading-snug ${
                      isDone ? 'line-through text-emerald-900/60' : 'text-[var(--ink)]'
                    }`}
                  >
                    {item.title}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-3 p-2.5 rounded-xl bg-[var(--paper)]/70 text-xs text-[var(--ink-text)]/80 italic border border-[var(--paper-line)]">
                    💡 {item.actionGuidance}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/50 flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase font-bold text-[var(--saffron)]">
                    {item.actionVerb}
                  </span>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-text)]/80 hover:text-[var(--ink)]"
                  >
                    {isDone ? (
                      <>
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Done</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 text-[var(--ink-text)]/40" />
                        <span>Mark Done</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Navigation Toolbar & Search Bar */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--paper)] border border-[var(--paper-line)] rounded-2xl p-4 sm:p-5">
          {/* Category Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedCategory === 'all'
                  ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-xs'
                  : 'bg-white text-[var(--ink-text)]/70 border-transparent hover:bg-white'
              }`}
            >
              All Categories
            </button>

            {categoryList.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-xs'
                    : 'bg-white text-[var(--ink-text)]/70 border-transparent hover:bg-white'
                }`}
              >
                <span>{cat.shortName}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('reporting-directory');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition-all ml-1"
            >
              📞 Trusted Directory
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[var(--ink-text)]/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tips (e.g. UPI, SIM, OTP)..."
              className="w-full bg-white border border-[var(--paper-line)] focus:border-[var(--saffron)] focus:ring-2 focus:ring-[var(--saffron)]/20 rounded-xl pl-9 pr-3 py-2 text-xs outline-none"
            />
          </div>
        </div>
      </div>

      {/* Categorized Safety Advice: Highlighting Immediate Actions vs Prevention */}
      <section className="space-y-6">
        <div className="border-b border-[var(--paper-line)] pb-2 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)]">
              Domain Safety Guidance
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/65">
              Specific protocols for calls, messages, payments, accounts, and official reporting.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {filteredCategories.map((cat) => (
            <CategorySafetyBlock
              key={cat.id}
              category={cat}
              onNavigate={setActiveView}
            />
          ))}
        </div>
      </section>

      {/* Trusted Reporting Directory Section */}
      <section id="reporting-directory" className="space-y-6 pt-6">
        <div className="border-b border-[var(--paper-line)] pb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-xs font-mono font-semibold uppercase text-emerald-800 mb-2">
            <LifeBuoy className="w-3.5 h-3.5" />
            Official Authority Routing
          </div>
          <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
            Trusted Reporting Information & Hotlines
          </h2>
          <p className="text-sm text-[var(--ink-text)]/70 max-w-3xl">
            Never pay private recovery agents or online fixers. Only official Indian government portals and scheduled banks have legal standing to freeze fraud accounts and issue FIRs.
          </p>
        </div>

        {/* Official Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRUSTED_REPORTING_DIRECTORY.map((dir) => (
            <div
              key={dir.id}
              className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 shadow-xs flex flex-col justify-between hover:border-[var(--saffron)] transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-text)]/70 font-bold border border-[var(--paper-line)]">
                    {dir.badge}
                  </span>
                  <span className="text-[11px] text-[var(--ink-text)]/50 font-mono">
                    {dir.timing}
                  </span>
                </div>

                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  {dir.title}
                </h3>
                <p className="text-xs text-[var(--ink-text)]/60 font-medium mt-0.5">
                  {dir.organization}
                </p>

                <p className="mt-3 text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
                  {dir.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--paper-line)]/60 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[var(--ink)]">
                  {dir.contact}
                </span>

                <a
                  href={dir.actionHref}
                  target={dir.isUrl ? '_blank' : undefined}
                  rel={dir.isUrl ? 'noreferrer noopener' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] hover:bg-[var(--saffron)] hover:text-white border border-[var(--paper-line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] transition-all"
                >
                  <span>{dir.actionLabel}</span>
                  {dir.isUrl ? (
                    <ExternalLink className="w-3 h-3" />
                  ) : (
                    <PhoneCall className="w-3 h-3" />
                  )}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Bank Emergency Blocking Numbers Table */}
        <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--saffron)]" />
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-[var(--ink)]">
                Instant Bank Card & Account Blocking Hotlines
              </h3>
              <p className="text-xs text-[var(--ink-text)]/65">
                Save these emergency desk numbers to halt unauthorized debits immediately.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--paper-line)]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[var(--paper)] text-[var(--ink-text)]/70 font-mono uppercase text-[11px] border-b border-[var(--paper-line)]">
                <tr>
                  <th className="p-3 sm:p-3.5">Bank</th>
                  <th className="p-3 sm:p-3.5">24/7 Fraud Emergency Line</th>
                  <th className="p-3 sm:p-3.5">Emergency SMS Blocking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--paper-line)] bg-white">
                {MAJOR_BANKS_HOTLINES.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="p-3 sm:p-3.5 font-semibold text-[var(--ink)] whitespace-nowrap">
                      {row.bank}
                    </td>
                    <td className="p-3 sm:p-3.5 font-mono text-xs font-bold text-red-900 whitespace-nowrap">
                      {row.phone}
                    </td>
                    <td className="p-3 sm:p-3.5 font-mono text-xs text-[var(--ink-text)]/75">
                      {row.blockSms}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Zero-Click Report & Verification Actions */}
      <div className="rounded-3xl border border-[var(--paper-line)] bg-[var(--navy)] p-6 sm:p-10 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Ready to report or verify a suspicious event?
            </h2>
            <p className="text-xs sm:text-sm text-[var(--mist)] leading-relaxed">
              KshemOS assists citizens in preparing draft FIR statements, verifying scam transcripts in real time, and depositing court-admissible evidence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveView('portal')}
              className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] text-white px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all shadow-sm"
            >
              Open Citizen Verification Portal
            </button>
            <button
              onClick={() => setActiveView('scam-examples')}
              className="rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all"
            >
              Browse Scam Examples
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Category Safety Block
 * Explicitly separates Immediate Actions from General Prevention Tips
 */
function CategorySafetyBlock({ category, onNavigate }) {
  const [showAllTips, setShowAllTips] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Category Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--paper-line)]/70 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-[var(--saffron)] flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">
              {category.name}
            </h3>
            <p className="text-xs text-[var(--ink-text)]/60">
              {category.summary}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
          {category.shortName} Checklist
        </span>
      </div>

      {/* Immediate Actions Highlight Box (Separated) */}
      <div className="rounded-xl bg-red-50/70 border border-red-200 p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-800">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>Immediate Action Guardrails</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {category.immediateActions.map((action, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-white/90 p-3 border border-red-100 text-xs sm:text-sm space-y-1"
            >
              <div className="font-bold text-red-950 flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                <span>{action.rule}</span>
              </div>
              <p className="text-xs text-red-900/75 pl-3 leading-relaxed">
                <em>Why:</em> {action.why}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* General Prevention Advice Checklist */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--ink-text)]/60">
          <span>General Prevention & Cyber Hygiene</span>
          <span className="text-[11px] font-mono lowercase text-[var(--ink-text)]/40">
            {category.preventionTips.length} tips
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {category.preventionTips.map((tip, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-[var(--paper)] p-3 border border-[var(--paper-line)] text-xs sm:text-sm text-[var(--ink-text)]/85 flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
