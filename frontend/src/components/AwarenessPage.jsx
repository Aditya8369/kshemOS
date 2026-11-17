import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  PhoneCall,
  Lock,
  CreditCard,
  Eye,
  ArrowRight,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Layers,
  Users,
  BookOpen,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Info,
  Check
} from 'lucide-react';
import {
  AWARENESS_RESOURCES,
  TOPICS,
  AUDIENCES,
  filterAwarenessResources,
  groupResourcesBy
} from '../awarenessData';

export default function AwarenessPage({ setActiveView }) {
  const [groupBy, setGroupBy] = useState('topic'); // 'topic' | 'audience'
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const [selectedAudience, setSelectedAudience] = useState('All Audiences');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedItems, setCheckedItems] = useState({});

  const filteredResources = useMemo(() => {
    return filterAwarenessResources(AWARENESS_RESOURCES, {
      topic: selectedTopic,
      audience: selectedAudience,
      searchQuery
    });
  }, [selectedTopic, selectedAudience, searchQuery]);

  const groupedResources = useMemo(() => {
    return groupResourcesBy(filteredResources, groupBy);
  }, [filteredResources, groupBy]);

  function handleResetFilters() {
    setSelectedTopic('All Topics');
    setSelectedAudience('All Audiences');
    setSearchQuery('');
  }

  function toggleCheckItem(idx) {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  }

  const redFlags = [
    "Calls claiming you are under 'Digital Arrest' or in a virtual courtroom",
    "Extreme artificial urgency demanding instant decision-making",
    "Demands for OTPs, Aadhaar OTPs, passwords, or remote screen sharing (AnyDesk)",
    "Threats of immediate arrest, non-bailable warrants, or passport blacklisting",
    "Orders to transfer funds to 'clearance', 'escrow', or private UPI accounts",
    "Forbidding you from speaking to family, local police, or disconnecting the call"
  ];

  const psychologicalTactics = [
    {
      label: "Authority Impersonation",
      percent: "88%",
      desc: "Impersonating CBI, Cyber Police, Customs, or RBI to create an illusion of official compliance."
    },
    {
      label: "Manufactured Urgency",
      percent: "92%",
      desc: "Imposing arbitrary 15-to-30 minute deadlines to disable rational second-opinion consultation."
    },
    {
      label: "Social Isolation",
      percent: "78%",
      desc: "Forcing victims to stay isolated on video calls so friends and family cannot intervene."
    }
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Hero Header */}
      <section className="rounded-3xl bg-gradient-to-br from-[var(--navy)] via-[#0d213b] to-[var(--ink)] text-white p-6 sm:p-10 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-400/20 via-orange-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-semibold uppercase tracking-wider text-[var(--saffron)]">
            <ShieldCheck className="w-4 h-4 text-[var(--saffron)]" />
            Citizen Cyber Defense Education
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Stay Alert.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-amber-100">
              Think Before You Trust.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
            Cyber scams succeed by hijacking emotions—fabricating panic, authority, and urgency to bypass rational judgment. 
            Explore structured playbooks grouped by topic and audience to build long-term digital resilience.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveView('portal')}
              className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] text-white px-6 py-3 text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <span>Test Suspicious Call in Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('scam-examples')}
              className="rounded-full border border-white/20 bg-white/10 hover:bg-white/15 px-6 py-3 text-sm font-semibold text-white transition-all"
            >
              Compare Scam vs Benign Patterns
            </button>
          </div>
        </div>
      </section>

      {/* Psychological Exploit Stats */}
      <section className="space-y-4">
        <div className="border-b border-[var(--paper-line)] pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
            Psychological Vectors
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
            Why Intelligent People Fall for Modern Scams
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
            Scammers do not hack bank mainframes—they hack human fear, respect for law enforcement, and love for family.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {psychologicalTactics.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                <span className="text-3xl sm:text-4xl font-display font-bold text-red-600">
                  {item.percent}
                </span>
                <h3 className="font-display text-base font-bold text-[var(--ink)] mt-2">
                  {item.label}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Educational Resource Directory */}
      <section className="space-y-6 pt-2">
        <div className="border-b border-[var(--paper-line)] pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-orange-100/70 border border-orange-200 text-xs font-mono font-bold tracking-wide uppercase text-[var(--saffron)] mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              Structured Library
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
              Educational Guides & Toolkits
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-text)]/70 max-w-2xl mt-1">
              Curated playbooks and interactive simulations organized by cyber threat domain and target citizen audience.
            </p>
          </div>

          {/* Group By Toggle */}
          <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--paper-line)] p-1 rounded-xl self-start md:self-auto shadow-xs">
            <span className="text-xs font-mono text-[var(--ink-text)]/50 px-2 uppercase font-medium">Group by:</span>
            <button
              type="button"
              onClick={() => setGroupBy('topic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupBy === 'topic'
                  ? 'bg-white text-[var(--ink)] shadow-xs border border-[var(--paper-line)]'
                  : 'text-[var(--ink-text)]/70 hover:bg-white/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[var(--saffron)]" />
              <span>Topic</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('audience')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupBy === 'audience'
                  ? 'bg-white text-[var(--ink)] shadow-xs border border-[var(--paper-line)]'
                  : 'text-[var(--ink-text)]/70 hover:bg-white/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[var(--saffron)]" />
              <span>Audience</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="space-y-3 bg-[var(--paper)] border border-[var(--paper-line)] rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-[var(--ink-text)]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources, topics, or audiences..."
                className="w-full bg-white border border-[var(--paper-line)] focus:border-[var(--saffron)] focus:ring-2 focus:ring-[var(--saffron)]/20 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-text)]/40 hover:text-[var(--ink)] bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>

            {/* Topic Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full bg-white border border-[var(--paper-line)] focus:border-[var(--saffron)] focus:ring-2 focus:ring-[var(--saffron)]/20 rounded-xl px-3 py-2.5 text-xs sm:text-sm outline-none cursor-pointer"
              >
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            {/* Audience Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                className="w-full bg-white border border-[var(--paper-line)] focus:border-[var(--saffron)] focus:ring-2 focus:ring-[var(--saffron)]/20 rounded-xl px-3 py-2.5 text-xs sm:text-sm outline-none cursor-pointer"
              >
                {AUDIENCES.map((aud) => (
                  <option key={aud} value={aud}>
                    {aud}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {(selectedTopic !== 'All Topics' || selectedAudience !== 'All Audiences' || searchQuery) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-[var(--ink-text)]/60">Active Filters:</span>
              {selectedTopic !== 'All Topics' && (
                <span className="inline-flex items-center gap-1 bg-white border border-[var(--paper-line)] px-2.5 py-1 rounded-full text-[var(--ink)] font-medium">
                  Topic: {selectedTopic}
                  <button onClick={() => setSelectedTopic('All Topics')} className="text-red-500 font-bold ml-1">×</button>
                </span>
              )}
              {selectedAudience !== 'All Audiences' && (
                <span className="inline-flex items-center gap-1 bg-white border border-[var(--paper-line)] px-2.5 py-1 rounded-full text-[var(--ink)] font-medium">
                  Audience: {selectedAudience}
                  <button onClick={() => setSelectedAudience('All Audiences')} className="text-red-500 font-bold ml-1">×</button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-white border border-[var(--paper-line)] px-2.5 py-1 rounded-full text-[var(--ink)] font-medium">
                  Keyword: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="text-red-500 font-bold ml-1">×</button>
                </span>
              )}
              <button
                onClick={handleResetFilters}
                className="text-[var(--saffron)] hover:underline font-semibold ml-2"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Grouped Resource Cards OR Empty State */}
        {filteredResources.length === 0 ? (
          /* Empty State Feedback */
          <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-[var(--saffron)] flex items-center justify-center mx-auto">
              <Info className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)]">
                No educational resources match your filter criteria
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-text)]/65 max-w-md mx-auto">
                We couldn't find any guides matching your query. Try choosing "All Topics" or reset your search keywords.
              </p>
            </div>

            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--paper)] hover:bg-[var(--saffron)] hover:text-white border border-[var(--paper-line)] px-5 py-2.5 text-xs font-semibold text-[var(--ink)] transition-all"
            >
              Reset Filters to View All Resources
            </button>
          </div>
        ) : (
          /* Render by Group */
          <div className="space-y-8">
            {Object.entries(groupedResources).map(([groupTitle, resources]) => (
              <div key={groupTitle} className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--paper-line)]/70 pb-2">
                  <div className="flex items-center gap-2">
                    {groupBy === 'topic' ? (
                      <Layers className="w-4 h-4 text-[var(--saffron)]" />
                    ) : (
                      <Users className="w-4 h-4 text-emerald-600" />
                    )}
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)]">
                      {groupTitle}
                    </h3>
                  </div>

                  <span className="text-xs font-mono text-[var(--ink-text)]/50">
                    {resources.length} {resources.length === 1 ? 'Resource' : 'Resources'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {resources.map((res) => (
                    <ResourceCard
                      key={res.id}
                      resource={res}
                      onNavigate={setActiveView}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Red Flags & Safety Rules */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Red Flags Card */}
        <div className="rounded-3xl border border-red-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="font-display text-xl font-bold text-red-950">
              Universal Scam Red Flags
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-red-950/70">
            If an inbound call or message exhibits any of these patterns, stop immediately:
          </p>

          <div className="space-y-2.5">
            {redFlags.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl bg-red-50/70 border border-red-100 p-3 text-xs sm:text-sm text-red-950 leading-relaxed"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pre-Response Pause Checklist */}
        <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[var(--ink)]">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">
              Pre-Response Pause Checklist
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-[var(--ink-text)]/70">
            Ask yourself these 4 simple sanity questions before clicking or transferring money:
          </p>

          <div className="space-y-2.5">
            {[
              { q: 'Did an unsolicited caller ask for money, escrow, or bail?', why: 'Legitimate courts never accept bail over the phone.' },
              { q: 'Did they ask for an OTP or prompt you to install AnyDesk/QuickSupport?', why: 'Zero bank systems require OTPs or screen access.' },
              { q: 'Are they generating extreme pressure or ordering you not to tell anyone?', why: 'Isolation is the signature technique of syndicate extortion.' },
              { q: 'Can you verify this independently through an official website number?', why: 'Always break the call and ring the verified official desk.' }
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleCheckItem(idx)}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  checkedItems[idx]
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-[var(--paper)] border-[var(--paper-line)] hover:bg-gray-50'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {checkedItems[idx] ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-md border border-[var(--paper-line)] bg-white" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className={`text-xs sm:text-sm font-semibold ${checkedItems[idx] ? 'text-emerald-950' : 'text-[var(--ink)]'}`}>
                    {item.q}
                  </div>
                  <div className="text-[11px] text-[var(--ink-text)]/65 italic">
                    💡 {item.why}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="rounded-3xl bg-[var(--navy)] text-white p-8 sm:p-12 text-center shadow-md relative overflow-hidden">
        <ShieldCheck className="mx-auto text-[var(--saffron)] w-12 h-12" />

        <h2 className="mt-4 font-display text-2xl sm:text-4xl font-bold">
          Pause. Verify. Protect.
        </h2>

        <p className="mt-3 text-xs sm:text-sm max-w-xl mx-auto text-gray-300 leading-relaxed">
          Cyber criminals rely on fear and urgency. Take a 5-minute pause to verify every request before sharing information or transferring funds.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveView('portal')}
            className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] px-8 py-3 text-sm font-semibold text-white transition-all shadow-sm flex items-center gap-2"
          >
            <span>Start Security Analysis</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveView('safety-tips')}
            className="rounded-full bg-white/10 hover:bg-white/15 border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all"
          >
            Read Emergency Safety Tips
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Standard Resource Card
 * Displays title, short summary, format tags, audience, key takeaways, and action treatment.
 * Provides clear unavailable feedback if isAvailable is false.
 */
function ResourceCard({ resource, onNavigate }) {
  const isAvailable = resource.isAvailable !== false;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between bg-white shadow-xs overflow-hidden ${
        isAvailable
          ? 'border-[var(--paper-line)] hover:border-[var(--saffron)] hover:shadow-md'
          : 'border-gray-200 bg-gray-50/60 opacity-80'
      }`}
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Badges: Format & Audience */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-[var(--saffron)]">
            {resource.format}
          </span>

          <span className="text-[11px] text-[var(--ink-text)]/55 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {resource.readTime}
          </span>
        </div>

        {/* Title & Audience Subtitle */}
        <div>
          <h4 className="font-display text-base sm:text-lg font-bold text-[var(--ink)] leading-snug">
            {resource.title}
          </h4>

          <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--ink-text)]/60">
            <Users className="w-3 h-3 text-[var(--mist)]" />
            <span>Target: <strong>{resource.audience}</strong></span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
          {resource.summary}
        </p>

        {/* Key Takeaways */}
        {Array.isArray(resource.keyTakeaways) && resource.keyTakeaways.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-mono uppercase text-[var(--ink-text)]/50 font-bold tracking-wider">
              Core Defense Insights
            </div>
            <ul className="space-y-1 text-xs text-[var(--ink-text)]/80">
              {resource.keyTakeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] mt-1.5 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Card Action & Unavailable Feedback */}
      <div className="p-4 sm:p-5 pt-0 border-t border-[var(--paper-line)]/50 mt-2 bg-gray-50/40">
        {isAvailable ? (
          <button
            type="button"
            onClick={() => onNavigate(resource.targetView)}
            className="w-full inline-flex items-center justify-between rounded-xl bg-[var(--paper)] hover:bg-[var(--saffron)] hover:text-white border border-[var(--paper-line)] px-4 py-2.5 text-xs font-semibold text-[var(--ink)] transition-all group"
          >
            <span>{resource.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--saffron)] group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>
        ) : (
          /* Unavailable Resource Feedback */
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Resource in Review / Scheduled</span>
            </div>
            <p className="text-[11px] text-amber-800/75 mt-0.5">
              Available in the upcoming advisory publication cycle.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
