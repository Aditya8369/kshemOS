import { ExternalLink, AlertTriangle, Phone, Heart } from 'lucide-react';

function ShieldMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 3 L34 9 V19 C34 28 28 34 20 37 C12 34 6 28 6 19 V9 Z"
        fill="var(--navy)"
      />
      <path
        d="M13 20 L18 25 L28 13"
        stroke="var(--saffron)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function Footer({ setActiveView = () => {} }) {
  const linkClass =
    'text-left text-sm text-[var(--ink-text)]/80 hover:text-[var(--saffron)] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:ring-offset-2 rounded py-1 inline-flex items-center gap-1.5 cursor-pointer';

  return (
    <footer
      className="w-full border-t border-[var(--paper-line)] bg-white text-[var(--ink-text)] mt-auto"
      role="contentinfo"
      aria-label="Global footer"
    >
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">

          {/* Group 1: Brand & Purpose */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="flex items-center gap-2 shrink-0 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:ring-offset-2 rounded"
              title="Return to home"
            >
              <ShieldMark size={28} />

              <div>
                <div className="font-display font-semibold leading-none tracking-tight text-[var(--ink)]">
                  KSHEM<span className="text-[var(--saffron)]">OS</span>
                </div>

                <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-text)]/50 mt-1">
                  Digital public safety
                </div>
              </div>
            </button>

            <p className="text-xs text-[var(--ink-text)]/80 leading-relaxed">
              Stopping fraud before the money moves. A public-safety operating system uniting citizens and responders with verifiable threat intelligence.
            </p>

            <div className="pt-1">
              <span className="inline-flex items-center text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-[var(--paper)] border border-[var(--paper-line)] text-[var(--ink-text)]/75">
                Open Source & Community Driven
              </span>
            </div>
          </div>

          {/* Group 2: Project & Community */}
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)] mb-3">
              Project & Community
            </h3>
            <ul className="space-y-1 flex flex-col">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('about')}
                  className={linkClass}
                >
                  About KshemOS
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('meet')}
                  className={linkClass}
                >
                  Contributors & Team
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('how-it-works')}
                  className={linkClass}
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('contact')}
                  className={linkClass}
                >
                  Contact
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/GoldRay19/kshemOS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <span>Source Repository</span>
                  <ExternalLink size={13} className="opacity-75" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          {/* Group 3: Safety & Verification */}
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)] mb-3">
              Safety & Verification
            </h3>
            <ul className="space-y-1 flex flex-col">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('safety-tips')}
                  className={linkClass}
                >
                  Safety Tips
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('awareness')}
                  className={linkClass}
                >
                  Awareness Hub
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('scam-examples')}
                  className={linkClass}
                >
                  Scam Examples
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('toolbox')}
                  className={linkClass}
                >
                  Cyber Toolbox
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveView('portal')}
                  className={linkClass}
                >
                  Citizen Verification Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Group 4: Emergency Safety Reminder */}
          <div className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper)] p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                  Safety Reminder
                </h3>
              </div>
              <p className="text-xs text-[var(--ink-text)]/85 leading-relaxed">
                KshemOS is a preventive education and verification platform — <strong>not an emergency response service</strong>.
              </p>
            </div>

            <div className="border-t border-[var(--paper-line)] pt-3 space-y-2 text-xs">
              <p className="text-[11px] font-semibold text-[var(--ink-text)]/70 uppercase tracking-wider">
                Official Helplines (India)
              </p>
              <div className="flex items-center justify-between text-[var(--ink-text)]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Phone size={12} className="text-[var(--saffron)]" aria-hidden="true" />
                  Cybercrime:
                </span>
                <a
                  href="tel:1930"
                  className="font-mono font-bold hover:text-[var(--saffron)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)] rounded px-1"
                >
                  1930
                </a>
              </div>
              <div className="flex items-center justify-between text-[var(--ink-text)]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Phone size={12} className="text-[var(--saffron)]" aria-hidden="true" />
                  National Emergency:
                </span>
                <a
                  href="tel:112"
                  className="font-mono font-bold hover:text-[var(--saffron)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)] rounded px-1"
                >
                  112
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-4 border-t border-[var(--paper-line)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--ink-text)]/75">
          <p className="font-mono text-center sm:text-left">
            KshemOS — stopping fraud before the money moves
          </p>
          <p className="flex items-center gap-1.5 font-medium">
            <span>Built with</span>
            <Heart size={13} className="text-red-500 fill-red-500" aria-hidden="true" />
            <span>for digital public safety</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

