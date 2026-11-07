import { useEffect, useState } from 'react';
import { getRuleLibrarySamples } from '../api';

export default function ThreatLibraryPage({ setActiveView }) {
  const [library, setLibrary] = useState(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  useEffect(() => {
    let mounted = true;
    getRuleLibrarySamples(2200)
      .then((data) => {
        if (mounted) setLibrary(data);
      })
      .catch(() => {
        if (mounted) {
          setError('Unable to load threat library. Please try again.');
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCases = (library?.sample_cases || []).filter((sample) => {
    const searchText = searchTerm.toLowerCase().trim();

    const matchesSearch = [
      sample.phrase,
      sample.authority,
      sample.target,
      sample.medium,
      sample.issue,
    ].some((value) => String(value || '').toLowerCase().includes(searchText));

    const matchesCategory =
      selectedCategory === 'all' || sample.target === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10 w-full">
      <div className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--saffron)] font-semibold">Rule library</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-[var(--ink)]">Explore the rule-based scam patterns behind the demo.</h1>
        <p className="mt-2 text-[var(--ink-text)]/70 max-w-2xl text-sm sm:text-base leading-relaxed">
          KshemOS generates and evaluates hundreds of suspicious patterns using authority, urgency, secrecy, and payment signals. The rule library shows how these cases are built and detected.
        </p>
      </div>

      {library ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--paper-line)] bg-[var(--paper)] p-6 shadow-sm">
              <h2 className="text-[var(--mist)] uppercase tracking-[0.25em] text-xs font-mono font-semibold mb-3">Summary</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-4xl font-display font-semibold text-[var(--ink)]">{library.total_examples}</div>
                  <div className="text-sm text-[var(--ink-text)]/70 mt-1">Generated scam phrases</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-4xl font-display font-semibold text-[var(--ink)]">{library.total_authority_patterns}</div>
                  <div className="text-sm text-[var(--ink-text)]/70 mt-1">Authority templates</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-4xl font-display font-semibold text-[var(--ink)]">{library.total_target_patterns}</div>
                  <div className="text-sm text-[var(--ink-text)]/70 mt-1">Target categories</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-line)] bg-[var(--navy)] p-6 text-white shadow-sm">
              <h2 className="font-display text-2xl font-semibold">Why this matters</h2>
              <p className="mt-3 text-[var(--mist)] leading-relaxed text-sm sm:text-base">
                Seeing the patterns helps people understand that scams are not random. They follow rules, and the same signals repeat in different forms.
              </p>
              <button
                onClick={() => setActiveView('portal')}
                className="mt-5 rounded-full bg-[var(--saffron)] px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white"
              >
                Try the scam detector
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--paper-line)] bg-white p-6 shadow-sm">
              <h2 className="text-[var(--mist)] uppercase tracking-[0.25em] text-xs font-mono font-semibold mb-3">Sample cases</h2>
              <div className="mb-4">
                <label
                  htmlFor="threat-search"
                  className="block text-sm font-semibold text-[var(--ink)] mb-2"
                >
                  Search threat cases
                </label>

                <input
                  id="threat-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by phrase, authority, target, medium..."
                  className="w-full rounded-xl border border-[var(--paper-line)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--saffron)]"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="threat-category"
                  className="block text-sm font-semibold text-[var(--ink)] mb-2"
                >
                  Filter by category
                </label>

                <select
                  id="threat-category"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-xl border border-[var(--paper-line)] bg-white px-4 py-3 text-sm"
                >
                  <option value="all">All categories</option>

                  {[...new Set(
                    (library?.sample_cases || [])
                      .map((sample) => sample.target)
                      .filter(Boolean)
                    )].sort().map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mb-4 rounded-full border border-[var(--paper-line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)] min-h-[44px] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
              >
                Clear filters
              </button>
              {(searchTerm || selectedCategory !== 'all') && (
                <div className="mb-3 text-sm text-[var(--ink-text)]">
                  <span className="font-semibold">Active filters:</span>

                  {searchTerm && (
                    <span className="ml-2">Search: "{searchTerm}"</span>
                  )}

                  {selectedCategory !== 'all' && (
                    <span className="ml-2">Category: {selectedCategory}</span>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {filteredCases.length > 0 ? (
                  filteredCases.map((sample) => (
                  <div
                    key={`${sample.phrase}-${sample.authority}-${sample.target}`}
                    className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4"
                  >
                    <div className="text-sm font-semibold text-[var(--ink)]">{sample.authority} • {sample.medium}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.25em] text-[var(--ink-text)]/50">Target: {sample.target} • Issue: {sample.issue}</div>
                    <p className="text-sm text-[var(--ink-text)]/75 mt-2">{sample.phrase}</p>
                  </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--paper-line)] p-6 text-center">
                    <p className="font-semibold text-[var(--ink)]">
                      No matching threat cases found.
                    </p>
                    <p className="mt-2 text-sm text-[var(--ink-text)]/70">
                      Try a different search term or clear your filters.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--paper-line)] bg-[var(--paper)] p-6">
              <h2 className="text-[var(--mist)] uppercase tracking-[0.25em] text-xs font-mono font-semibold mb-3">Library note</h2>
              <p className="text-sm text-[var(--ink-text)]/80 leading-relaxed">These examples are generated from a broad library of rule-based inputs. They show how the same warning signs repeat across different scam scripts.</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700"
        >
          {error}
        </div>
      ) : (
        <div
          role="status"
          className="rounded-3xl border border-[var(--paper-line)] bg-[var(--paper)] p-6 shadow-sm"
        >
          Loading library samples…
        </div>
      )}
    </div>
  );
}
