import { useState } from 'react';
import {
  PhoneCall,
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  LifeBuoy,
  Phone,
  Radio,
  ShieldCheck,
} from 'lucide-react';

export default function ContactPage({ setActiveView }) {
  const [copiedNumber, setCopiedNumber] = useState(null);

  const handleCopy = (number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(number).catch(() => {});
    }
    setCopiedNumber(number);
    setTimeout(() => {
      setCopiedNumber(null);
    }, 2000);
  };

  const helplines = [
    {
      id: 'cybercrime',
      name: 'Cybercrime Helpline',
      number: '1930',
      category: 'Cyber Fraud & Financial Scams',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      purpose:
        'Immediate reporting of unauthorized UPI/bank transfers, investment fraud, loan app harassment, and digital arrest threats. Critical in the "Golden Hour" to freeze defrauded accounts.',
      portal: 'https://cybercrime.gov.in',
      portalLabel: 'cybercrime.gov.in',
      icon: ShieldAlert,
    },
    {
      id: 'erss',
      name: 'National Emergency (ERSS)',
      number: '112',
      category: 'Unified Emergency (Police · Fire · Medical)',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      purpose:
        'All-in-one national emergency response system for immediate life safety distress, physical danger, fire emergencies, and urgent medical ambulance dispatch across India.',
      portal: 'https://112.gov.in',
      portalLabel: '112.gov.in',
      icon: LifeBuoy,
    },
    {
      id: 'police',
      name: 'Police Emergency Dispatch',
      number: '100',
      category: 'Direct Law Enforcement',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      purpose:
        'Direct connection to local police control rooms for urgent on-ground criminal incidents, in-progress theft, physical harassment, or precinct police dispatch.',
      portal: null,
      portalLabel: null,
      icon: Phone,
    },
    {
      id: 'sancharsaathi',
      name: 'DoT Chakshu / Sanchar Saathi',
      number: '1963',
      category: 'Telecom & SMS Fraud',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      purpose:
        'Department of Telecommunications helpline and portal to report suspected fraudulent calls, fake SMS headers, cloned numbers, and stolen mobile devices.',
      portal: 'https://sancharsaathi.gov.in',
      portalLabel: 'sancharsaathi.gov.in',
      icon: Radio,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header section */}
      <header className="rounded-[2rem] border border-[var(--paper-line)] bg-white p-6 sm:p-8 shadow-xs">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--saffron)] font-semibold">
          Contact & Official Helplines
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2 text-[var(--ink)]">
          Need help fast? Reach out through verified channels.
        </h1>
        <p className="mt-3 text-[var(--ink-text)]/70 max-w-2xl text-sm sm:text-base leading-relaxed">
          If a call, message, or notice feels suspicious, do not panic or send funds.
          Use the verified official helplines below matching your specific emergency.
        </p>
      </header>

      {/* Official Channel Verification Advisory */}
      <section
        role="alert"
        aria-labelledby="advisory-title"
        className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-amber-950 shadow-xs"
      >
        <div className="flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1.5 text-sm">
            <h2 id="advisory-title" className="font-display font-semibold text-amber-900 text-base">
              Official Channel Verification Reminder
            </h2>
            <p className="text-amber-900/90 leading-relaxed text-xs sm:text-sm">
              <strong>Always verify contact numbers directly via official government websites (.gov.in).</strong>
              {' '}Do not trust search engine sponsored ads, unsanctioned directory listings, or numbers received in unsolicited messages.
            </p>
            <p className="text-amber-900/90 leading-relaxed text-xs sm:text-sm">
              Legitimate police officers, cyber investigators, banks, and courts will <strong>never</strong> demand money transfers to &ldquo;clear charges&rdquo;, request secret OTPs/PINs, or place citizens under &ldquo;digital arrest&rdquo; over WhatsApp or video calls.
            </p>
          </div>
        </div>
      </section>

      {/* Categorized Helplines Section */}
      <section aria-label="Official helpline directory">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {helplines.map((item) => {
            const Icon = item.icon;
            const isCopied = copiedNumber === item.number;

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs hover:border-[var(--saffron)]/40 transition-colors"
              >
                <div>
                  {/* Category Badge & Icon */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${item.badgeClass}`}>
                      {item.category}
                    </span>
                    <Icon className="w-5 h-5 text-[var(--ink-text)]/50 shrink-0" aria-hidden="true" />
                  </div>

                  {/* Helpline Title & Number */}
                  <h3 className="font-display font-semibold text-lg text-[var(--ink)]">
                    {item.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-[var(--ink)] tracking-tight">
                      {item.number}
                    </span>
                  </div>

                  {/* Purpose & Description */}
                  <p className="mt-3 text-xs sm:text-sm text-[var(--ink-text)]/75 leading-relaxed">
                    {item.purpose}
                  </p>

                  {item.portal && (
                    <div className="mt-3 pt-3 border-t border-[var(--paper-line)]/60">
                      <a
                        href={item.portal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--navy)] hover:text-[var(--saffron)] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--saffron)] rounded"
                      >
                        <span>Official portal: {item.portalLabel}</span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions: Tap-to-call & Copy */}
                <div className="mt-6 pt-4 border-t border-[var(--paper-line)] flex items-center gap-2">
                  <a
                    href={`tel:${item.number}`}
                    aria-label={`Call ${item.name} at ${item.number}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--navy)] active:scale-[0.98] transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <PhoneCall className="w-4 h-4 text-[var(--saffron)]" aria-hidden="true" />
                    <span>Call {item.number}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.number)}
                    aria-label={`Copy ${item.name} number ${item.number}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper)] px-3.5 py-2.5 text-xs font-medium text-[var(--ink-text)] hover:bg-neutral-100 active:scale-[0.98] transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span className="text-emerald-700 font-semibold" aria-live="polite">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-neutral-500" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Verification Portal Action Card */}
      <footer className="rounded-[2rem] border border-[var(--paper-line)] bg-[var(--navy)] p-6 sm:p-8 text-white shadow-sm">
        <h2 className="font-display text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[var(--saffron)]" aria-hidden="true" />
          <span>Remember: pause, verify, report.</span>
        </h2>
        <p className="mt-2 text-[var(--mist)] text-sm sm:text-base max-w-2xl leading-relaxed">
          The fastest response is often a calm one. If you are experiencing a suspicious communication or threat, verify the caller and preserve evidence through our citizen portal.
        </p>
        <button
          type="button"
          onClick={() => setActiveView?.('portal')}
          className="mt-5 inline-flex items-center rounded-full bg-[var(--saffron)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Open the verification portal
        </button>
      </footer>
    </div>
  );
}
