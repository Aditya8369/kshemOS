
import { useEffect, useState } from 'react';
import {
  PhoneCall,
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  LifeBuoy,
  Phone,
  Globe,
  ShieldCheck,
  RefreshCw,
  Database,
  Search,
} from 'lucide-react';

import { fetchOfficialContactsApi } from '../api';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All official contacts' },
  { value: 'immediate_emergency', label: 'Immediate Emergency' },
  { value: 'cyber_financial_fraud', label: 'Cyber Financial Fraud' },
  { value: 'cybercrime_reporting', label: 'Cybercrime Reporting' },
];

function getContactIcon(contact) {
  if (contact.category === 'immediate_emergency') return LifeBuoy;

  if (contact.category === 'cyber_financial_fraud') return ShieldAlert;

  return Globe;
}

function getCategoryStyle(category) {
  switch (category) {
    case 'immediate_emergency':
      return 'bg-rose-100 text-rose-800 border-rose-200';

    case 'cyber_financial_fraud':
      return 'bg-amber-100 text-amber-800 border-amber-200';

    case 'cybercrime_reporting':
      return 'bg-blue-100 text-blue-800 border-blue-200';

    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
}

function getCategoryLabel(category) {
  const option = CATEGORY_OPTIONS.find(
    (item) => item.value === category
  );

  return option?.label || category?.replaceAll('_', ' ') || 'Official Contact';
}

export default function ContactPage({ setActiveView }) {
  const [contacts, setContacts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedNumber, setCopiedNumber] = useState(null);

  const loadContacts = async (category = selectedCategory) => {
    setLoading(true);
    setError('');

    try {
      const result = await fetchOfficialContactsApi(category);

      setContacts(
        Array.isArray(result?.contacts) ? result.contacts : []
      );
    } catch (err) {
      setError(
        err?.message ||
        'Unable to fetch official contacts. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts('');
  }, []);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    loadContacts(category);
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedNumber(value);

      window.setTimeout(() => {
        setCopiedNumber(null);
      }, 2000);
    } catch {
      setError('Unable to copy. Please copy the contact manually.');
    }
  };

  const isPhoneContact = (contact) =>
    contact.contact_type === 'phone';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-6 sm:space-y-8">

      {/* Header */}
      <header className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-xs">

        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--saffron)] font-semibold">
          Official Emergency Contact Directory
        </p>

        <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2 text-[var(--ink)]">
          Need help fast? Reach verified government channels.
        </h1>

        <p className="mt-3 text-[var(--ink-text)]/70 max-w-2xl text-sm sm:text-base leading-relaxed">
          Access official Indian emergency response and cybercrime
          reporting contacts. Contact information is retrieved from
          the KSHEMOS backend rather than an unverified frontend list.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-800 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified records only
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-blue-800 font-semibold">
            <Database className="w-3.5 h-3.5" />
            Backend connected
          </span>

        </div>
      </header>

      {/* Safety Advisory */}
      <section
        role="alert"
        aria-labelledby="advisory-title"
        className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-amber-950 shadow-xs"
      >

        <div className="flex items-start gap-3.5">

          <AlertTriangle
            className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />

          <div className="space-y-1.5 text-sm">

            <h2
              id="advisory-title"
              className="font-display font-semibold text-amber-900 text-base"
            >
              Important Safety Reminder
            </h2>

            <p className="text-amber-900/90 leading-relaxed text-xs sm:text-sm">
              Always verify contact details using the official
              government source linked with each record. Never trust
              numbers shared through suspicious calls or unsolicited messages.
            </p>

            <p className="text-amber-900/90 leading-relaxed text-xs sm:text-sm">
              Never share OTPs, UPI PINs, passwords, or transfer money
              to someone claiming they can resolve a legal investigation
              or digital arrest.
            </p>

          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
              Official Contact Directory
            </h2>

            <p className="text-xs sm:text-sm text-[var(--ink-text)]/60 mt-1">
              Filter contacts by emergency or reporting category.
            </p>
          </div>

          <div className="flex items-center gap-2">

            <Search className="w-4 h-4 text-[var(--ink-text)]/50" />

            <select
              value={selectedCategory}
              onChange={(event) =>
                handleCategoryChange(event.target.value)
              }
              className="w-full sm:w-auto rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--saffron)]"
              aria-label="Filter official contacts"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

          </div>

        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--paper-line)] pt-4">

          <p className="text-xs text-[var(--ink-text)]/60">
            {loading
              ? 'Fetching official records...'
              : `${contacts.length} official record${contacts.length === 1 ? '' : 's'} found`}
          </p>

          <button
            type="button"
            onClick={() => loadContacts()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--navy)] hover:text-[var(--saffron)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div
          className="rounded-2xl border border-[var(--paper-line)] bg-white p-10 text-center"
          role="status"
        >
          <RefreshCw className="w-8 h-8 mx-auto text-[var(--saffron)] animate-spin" />

          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
            Loading official contacts
          </p>

          <p className="mt-1 text-xs text-[var(--ink-text)]/60">
            Connecting to the KSHEMOS backend...
          </p>
        </div>
      )}

      {/* API Error */}
      {!loading && error && (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-5"
          role="alert"
        >

          <div className="flex items-start gap-3">

            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />

            <div className="flex-1">

              <h3 className="font-semibold text-red-900">
                Unable to load official contacts
              </h3>

              <p className="mt-1 text-sm text-red-800">
                {error}
              </p>

              <button
                type="button"
                onClick={() => loadContacts()}
                className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Try again
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Contact Cards */}
      {!loading && !error && contacts.length > 0 && (

        <section
          aria-label="Verified official helplines"
          className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6"
        >

          {contacts.map((item) => {

            const Icon = getContactIcon(item);
            const isPhone = isPhoneContact(item);
            const isCopied = copiedNumber === item.value;

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs hover:border-[var(--saffron)]/40 transition-colors"
              >

                <div>

                  {/* Category and Verification */}
                  <div className="flex items-center justify-between gap-2 mb-4">

                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${getCategoryStyle(item.category)}`}
                    >
                      {getCategoryLabel(item.category)}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </span>

                  </div>

                  {/* Title */}
                  <div className="flex items-start gap-3">

                    <div className="rounded-xl bg-[var(--paper)] p-3">
                      <Icon className="w-5 h-5 text-[var(--navy)]" />
                    </div>

                    <div className="min-w-0">

                      <h3 className="font-display font-semibold text-lg text-[var(--ink)]">
                        {item.name}
                      </h3>

                      <p className="mt-1 text-xs text-[var(--ink-text)]/60">
                        {item.authority}
                      </p>

                    </div>

                  </div>

                  {/* Contact Value */}
                  <div className="mt-5">

                    <p className="text-[10px] uppercase tracking-widest font-mono text-[var(--ink-text)]/50">
                      {isPhone ? 'Official Helpline Number' : 'Official Reporting Portal'}
                    </p>

                    {isPhone ? (
                      <p className="font-display text-3xl font-bold text-[var(--ink)] tracking-tight mt-1 break-all">
                        {item.value}
                      </p>
                    ) : (
                      <a
                        href={item.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--navy)] hover:text-[var(--saffron)] break-all"
                      >
                        Visit official portal
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </a>
                    )}

                  </div>

                  {/* Description */}
                  <p className="mt-4 text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Authority */}
                  <div className="mt-4 pt-3 border-t border-[var(--paper-line)]/60">

                    <p className="text-[10px] uppercase tracking-widest text-[var(--ink-text)]/50 font-mono">
                      Responsible Authority
                    </p>

                    <p className="mt-1 text-xs font-medium text-[var(--ink)]">
                      {item.authority}
                    </p>

                  </div>

                  {/* Source */}
                  <div className="mt-3">

                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--navy)] hover:text-[var(--saffron)] font-medium"
                    >
                      <span>View official source</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                  </div>

                  {item.last_verified && (
                    <p className="mt-2 text-[10px] text-[var(--ink-text)]/50">
                      Last verified: {item.last_verified}
                    </p>
                  )}

                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-[var(--paper-line)] flex items-center gap-2">

                  {isPhone ? (

                    <a
                      href={`tel:${item.value}`}
                      aria-label={`Call ${item.name} at ${item.value}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--navy)] active:scale-[0.98] transition-all min-h-[44px]"
                    >
                      <PhoneCall className="w-4 h-4 text-[var(--saffron)]" />
                      Call {item.value}
                    </a>

                  ) : (

                    <a
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--navy)] min-h-[44px]"
                    >
                      <Globe className="w-4 h-4 text-[var(--saffron)]" />
                      Open Portal
                    </a>

                  )}

                  <button
                    type="button"
                    onClick={() => handleCopy(item.value)}
                    aria-label={`Copy ${item.name} contact`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-3.5 py-2.5 text-xs font-medium text-[var(--ink-text)] hover:bg-neutral-100 min-h-[44px]"
                  >

                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">
                          Copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-neutral-500" />
                        <span>Copy</span>
                      </>
                    )}

                  </button>

                </div>

              </article>
            );
          })}

        </section>
      )}

      {/* Empty State */}
      {!loading && !error && contacts.length === 0 && (

        <div className="rounded-2xl border border-[var(--paper-line)] bg-white p-10 text-center">

          <Search className="w-8 h-8 mx-auto text-[var(--ink-text)]/40" />

          <h3 className="mt-4 font-display font-semibold text-lg text-[var(--ink)]">
            No official contacts found
          </h3>

          <p className="mt-2 text-sm text-[var(--ink-text)]/60">
            There are currently no verified records in this category.
          </p>

          <button
            type="button"
            onClick={() => handleCategoryChange('')}
            className="mt-4 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            View all contacts
          </button>

        </div>
      )}

      {/* Footer */}
      <footer className="rounded-[2rem] border border-[var(--paper-line)] bg-[var(--navy)] p-6 sm:p-8 text-white shadow-sm">

        <h2 className="font-display text-xl sm:text-2xl font-semibold flex items-center gap-2">

          <ShieldCheck className="w-6 h-6 text-[var(--saffron)]" />

          <span>Pause. Verify. Report.</span>

        </h2>

        <p className="mt-2 text-[var(--mist)] text-sm sm:text-base max-w-2xl leading-relaxed">
          If you experience a suspicious communication or financial
          fraud, preserve evidence and report it through the appropriate
          official channel.
        </p>

        <button
          type="button"
          onClick={() => setActiveView?.('portal')}
          className="mt-5 inline-flex items-center rounded-full bg-[var(--saffron)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
        >
          Open the verification portal
        </button>

      </footer>

    </div>
  );
}
