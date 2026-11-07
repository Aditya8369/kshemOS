import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  Columns,
  LayoutGrid,
  PhoneCall,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  SCAM_EXAMPLES,
  COMPARISON_PAIRS,
  filterExamples,
  getResolvedComparisonPairs,
  getUniqueCategories
} from '../scamExamplesData';

export default function ScamExamplesPage({ setActiveView }) {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'compare'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'suspicious' | 'benign'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [focusedPairId, setFocusedPairId] = useState(null);

  const categories = useMemo(() => getUniqueCategories(SCAM_EXAMPLES), []);

  const filteredExamples = useMemo(() => {
    return filterExamples(SCAM_EXAMPLES, {
      type: typeFilter,
      category: selectedCategory,
      searchTerm: searchQuery
    });
  }, [typeFilter, selectedCategory, searchQuery]);

  const resolvedPairs = useMemo(() => {
    const pairs = getResolvedComparisonPairs(COMPARISON_PAIRS, SCAM_EXAMPLES);
    if (selectedCategory === 'all') return pairs;
    return pairs.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  const counts = useMemo(() => {
    const total = SCAM_EXAMPLES.length;
    const suspicious = SCAM_EXAMPLES.filter((ex) => ex.type === 'suspicious').length;
    const benign = SCAM_EXAMPLES.filter((ex) => ex.type === 'benign').length;
    return { total, suspicious, benign };
  }, []);

  function handleCopyScript(id, text) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  function handleTryInDemo(example) {
    try {
      sessionStorage.setItem(
        'kshemos_demo_prefill',
        JSON.stringify({
          transcript: example.scenario,
          claim: example.callerClaim || (example.type === 'suspicious' ? 'Scam Caller' : 'Official Representative')
        })
      );
    } catch {
      // Storage error fallback
    }
    if (typeof setActiveView === 'function') {
      setActiveView('portal');
    }
  }

  function handleJumpToPair(pairId) {
    setViewMode('compare');
    setFocusedPairId(pairId);
    // Smooth scroll down to comparison section
    setTimeout(() => {
      const el = document.getElementById(pairId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Hero Header */}
      <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-100/40 via-orange-50/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-mono font-semibold uppercase tracking-wider text-[var(--saffron)] mb-3">
            <Shield className="w-3.5 h-3.5" />
            Pattern Library & Comparison Intel
          </div>
          
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)]">
            Recognise the patterns before the money moves.
          </h1>
          
          <p className="mt-3 text-sm sm:text-base text-[var(--ink-text)]/75 leading-relaxed">
            Scammers rely on manufactured urgency, fake authority, and emotional isolation. 
            Compare real-world coercion scripts side-by-side with verified legitimate communications to train your intuition, examine warning signs, and test any message in the real-time verification portal.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setActiveView('portal')}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:gap-3"
            >
              <span>Test Live in Verification Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setViewMode('compare');
                setTypeFilter('all');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--paper-line)] hover:border-[var(--ink-text)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink-text)] transition-all"
            >
              <Columns className="w-4 h-4 text-[var(--saffron)]" />
              <span>Direct Side-by-Side Comparison</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--paper)] border border-[var(--paper-line)] rounded-2xl p-4 sm:p-5">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-[var(--paper-line)] self-start md:self-auto shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'text-[var(--ink-text)]/70 hover:bg-[var(--paper)]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card Grid ({filteredExamples.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'compare'
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'text-[var(--ink-text)]/70 hover:bg-[var(--paper)]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side Contrast ({resolvedPairs.length})</span>
            </button>
          </div>

          {/* Type Filter Pills (Grid View) */}
          {viewMode === 'grid' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  typeFilter === 'all'
                    ? 'bg-white text-[var(--ink)] border-[var(--ink)] shadow-xs'
                    : 'bg-white/60 text-[var(--ink-text)]/70 border-transparent hover:bg-white'
                }`}
              >
                All Examples ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('suspicious')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  typeFilter === 'suspicious'
                    ? 'bg-red-50 text-red-700 border-red-300 shadow-xs'
                    : 'bg-white/60 text-red-600 border-transparent hover:bg-red-50/50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span>Suspicious Scams ({counts.suspicious})</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('benign')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  typeFilter === 'benign'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                    : 'bg-white/60 text-emerald-700 border-transparent hover:bg-emerald-50/50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Benign Communications ({counts.benign})</span>
              </button>
            </div>
          )}
        </div>

        {/* Search & Category Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-[var(--ink-text)]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keywords, script phrases, authority claims, or safe actions..."
              className="w-full bg-white border border-[var(--paper-line)] focus:border-[var(--saffron)] focus:ring-2 focus:ring-[var(--saffron)]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-text)]/40 hover:text-[var(--ink)] bg-gray-100 hover:bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="sm:col-span-4 relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-white border border-[var(--paper-line)] focus:border-[var(--saffron)] focus:ring-2 focus:ring-[var(--saffron)]/20 rounded-xl px-3.5 py-2.5 text-sm outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Threat Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--ink-text)]/40 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main View: Grid vs Direct Side-by-Side Comparison */}
      {viewMode === 'grid' ? (
        <div className="space-y-6">
          {filteredExamples.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-[var(--paper-line)] p-8">
              <Info className="w-8 h-8 text-[var(--mist)] mx-auto mb-2" />
              <p className="font-display font-semibold text-lg text-[var(--ink)]">No examples matched your filter</p>
              <p className="text-sm text-[var(--ink-text)]/60 mt-1 max-w-md mx-auto">
                Try resetting your search query or choosing "All Examples" to explore the full library.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setTypeFilter('all');
                }}
                className="mt-4 rounded-full bg-[var(--paper)] border border-[var(--paper-line)] px-4 py-2 text-xs font-semibold hover:border-[var(--saffron)]"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredExamples.map((example) => (
                <ExampleCard
                  key={example.id}
                  example={example}
                  copiedId={copiedId}
                  onCopy={handleCopyScript}
                  onTryInDemo={handleTryInDemo}
                  onJumpToPair={handleJumpToPair}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Side-by-Side Comparison View */
        <div className="space-y-8">
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-amber-900">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Direct Comparison Mode</p>
              <p className="mt-0.5 text-amber-900/80">
                Observe the structural divergence: legitimate entities mandate verified channels, in-person attendance, and zero payment pressure. 
                Scammers invert these rules by fabricating immediate panic, secret lines, and remote escrow demands.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            {resolvedPairs.map((pair) => (
              <ComparisonPairSection
                key={pair.id}
                pair={pair}
                isFocused={focusedPairId === pair.id}
                copiedId={copiedId}
                onCopy={handleCopyScript}
                onTryInDemo={handleTryInDemo}
              />
            ))}
          </div>
        </div>
      )}

      {/* Verification Portal CTA Banner */}
      <div className="rounded-3xl border border-[var(--paper-line)] bg-gradient-to-br from-[var(--navy)] via-[#0d213b] to-[var(--ink)] p-8 sm:p-12 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-medium tracking-wide text-amber-300 mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            Live Risk Verification Portal
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Have a suspicious message or call transcript?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[var(--mist)] leading-relaxed">
            Paste any suspicious script or call excerpt into KshemOS's calibrated multi-signal risk model. 
            Our analyzer dissects authority coercion, urgency tactics, and known syndicate signatures in milliseconds — with zero sensitive data stored.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setActiveView('portal')}
              className="rounded-full bg-[var(--saffron)] hover:bg-[#e66c12] text-white px-6 py-3 text-sm font-semibold shadow-sm transition-all flex items-center gap-2 hover:gap-3"
            >
              <span>Open Verification Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('live-call-safety')}
              className="rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white px-5 py-3 text-sm font-medium transition-all flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>Try Live Call Shield</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Standard Example Card Component
 * Formats Title, Scenario, Warning Signs / Verification Indicators, and Safe Response consistently.
 */
function ExampleCard({ example, copiedId, onCopy, onTryInDemo, onJumpToPair }) {
  const isSuspicious = example.type === 'suspicious';

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between bg-white shadow-xs overflow-hidden ${
        isSuspicious
          ? 'border-red-200/90 hover:border-red-300 hover:shadow-md'
          : 'border-emerald-200/90 hover:border-emerald-300 hover:shadow-md'
      }`}
    >
      {/* Top Banner & Metadata */}
      <div>
        <div
          className={`px-5 py-3 border-b flex items-center justify-between gap-3 ${
            isSuspicious
              ? 'bg-red-50/70 border-red-100 text-red-800'
              : 'bg-emerald-50/70 border-emerald-100 text-emerald-800'
          }`}
        >
          {/* Visual Badge & Explicit Text Label */}
          <div className="flex items-center gap-2">
            {isSuspicious ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-red-100/90 text-red-700 border border-red-200">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                Suspicious Scam Pattern
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-emerald-100/90 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Benign Communication
              </span>
            )}
          </div>

          <div className="text-[11px] font-mono uppercase text-[var(--ink-text)]/50 tracking-wide truncate">
            {example.category}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Title & Context */}
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)]">
              {example.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[var(--ink-text)]/65">
              <span className="font-medium text-[var(--ink)]">Channel:</span>
              <span>{example.channel}</span>
              {example.callerClaim && (
                <>
                  <span>•</span>
                  <span className="italic text-[var(--ink-text)]/80">Claims: {example.callerClaim}</span>
                </>
              )}
            </div>
            {example.context && (
              <p className="mt-2 text-xs sm:text-sm text-[var(--ink-text)]/70 leading-relaxed">
                {example.context}
              </p>
            )}
          </div>

          {/* Scenario / Message Transcript Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[var(--ink-text)]/55">
              <span>Transcript Excerpt</span>
              <button
                type="button"
                onClick={() => onCopy(example.id, example.scenario)}
                className="inline-flex items-center gap-1 text-[var(--ink-text)]/70 hover:text-[var(--ink)] transition-colors"
                title="Copy transcript text"
              >
                {copiedId === example.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div
              className={`rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm font-mono leading-relaxed border relative ${
                isSuspicious
                  ? 'bg-red-50/30 border-red-200/80 text-red-950'
                  : 'bg-emerald-50/30 border-emerald-200/80 text-emerald-950'
              }`}
            >
              “{example.scenario}”
            </div>
          </div>

          {/* Warning Signs OR Verification Indicators */}
          <div className="space-y-2">
            <div
              className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                isSuspicious ? 'text-red-700' : 'text-emerald-800'
              }`}
            >
              {isSuspicious ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>Key Warning Signs (Red Flags)</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verification Indicators (Why It's Legitimate)</span>
                </>
              )}
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-[var(--ink-text)]/80">
              {example.warningSigns.map((sign, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      isSuspicious ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{sign}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Safe Response Section */}
          <div
            className={`rounded-xl p-3.5 sm:p-4 border text-xs sm:text-sm space-y-1 ${
              isSuspicious
                ? 'bg-amber-50/60 border-amber-200/70 text-amber-950'
                : 'bg-emerald-50/50 border-emerald-200/70 text-emerald-950'
            }`}
          >
            <div className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--saffron)]" />
              <span>Safe Recommended Action</span>
            </div>
            <p className="leading-relaxed opacity-90">{example.safeResponse}</p>
          </div>
        </div>
      </div>

      {/* Card Footer / Action Links */}
      <div className="p-4 sm:p-5 pt-0 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--paper-line)]/50 mt-2 bg-gray-50/50">
        <button
          type="button"
          onClick={() => onTryInDemo(example)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--saffron)] transition-colors group"
        >
          <span>Try in Verification Demo</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--saffron)] transition-transform group-hover:translate-x-1" />
        </button>

        {example.comparisonPairId && onJumpToPair && (
          <button
            type="button"
            onClick={() => onJumpToPair(example.comparisonPairId)}
            className="text-xs text-[var(--ink-text)]/60 hover:text-[var(--ink)] underline underline-offset-2 transition-colors"
          >
            Compare with {isSuspicious ? 'Benign' : 'Scam'} Equivalent
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Side-by-Side Comparison Pair Section
 */
function ComparisonPairSection({ pair, isFocused, copiedId, onCopy, onTryInDemo }) {
  return (
    <div
      id={pair.id}
      className={`rounded-3xl border bg-white p-5 sm:p-8 space-y-6 transition-all ${
        isFocused
          ? 'ring-2 ring-[var(--saffron)] border-[var(--saffron)] shadow-md'
          : 'border-[var(--paper-line)] shadow-xs'
      }`}
    >
      {/* Pair Header */}
      <div className="border-b border-[var(--paper-line)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--saffron)] font-semibold">
            {pair.category} Contrast Study
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
            {pair.title}
          </h2>
        </div>

        <div className="inline-flex items-center gap-2 bg-[var(--paper)] border border-[var(--paper-line)] px-3 py-1.5 rounded-full text-xs font-mono text-[var(--ink-text)]/70">
          <span>ID: {pair.id}</span>
        </div>
      </div>

      {/* Key Takeaway Callout */}
      <div className="rounded-xl bg-orange-50/80 border border-orange-200/80 p-4 text-xs sm:text-sm text-orange-950 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[var(--saffron)] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-orange-950">Core Structural Difference: </span>
          <span className="text-orange-900/90">{pair.keyTakeaway}</span>
        </div>
      </div>

      {/* Side-by-Side Cards: Suspicious vs Benign */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              Scam Pattern Script
            </span>
          </div>
          <ExampleCard
            example={pair.suspicious}
            copiedId={copiedId}
            onCopy={onCopy}
            onTryInDemo={onTryInDemo}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Legitimate Pattern Notice
            </span>
          </div>
          <ExampleCard
            example={pair.benign}
            copiedId={copiedId}
            onCopy={onCopy}
            onTryInDemo={onTryInDemo}
          />
        </div>
      </div>

      {/* Telltale Contrast Comparison Table */}
      {Array.isArray(pair.contrastPoints) && pair.contrastPoints.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink-text)]/60 font-semibold">
            Telltale Comparison Indicators
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--paper-line)]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[var(--paper)] text-[var(--ink-text)]/70 font-mono uppercase text-[11px] border-b border-[var(--paper-line)]">
                <tr>
                  <th className="p-3 sm:p-3.5">Factor</th>
                  <th className="p-3 sm:p-3.5 text-red-700">Suspicious Coercion</th>
                  <th className="p-3 sm:p-3.5 text-emerald-800">Legitimate Procedure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--paper-line)] bg-white">
                {pair.contrastPoints.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="p-3 sm:p-3.5 font-semibold text-[var(--ink)] whitespace-nowrap">
                      {pt.aspect}
                    </td>
                    <td className="p-3 sm:p-3.5 text-red-900 bg-red-50/20">
                      {pt.suspicious}
                    </td>
                    <td className="p-3 sm:p-3.5 text-emerald-950 bg-emerald-50/20">
                      {pt.benign}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
