import { ArrowRight } from 'lucide-react';

const secondaryButtonClass =
  'inline-flex w-full items-center justify-center rounded-full border border-[var(--paper-line)] bg-white/90 px-4 py-2.5 text-sm font-medium text-[var(--ink)] shadow-sm transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-[var(--ink)]/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]/40 focus-visible:ring-offset-2 sm:w-auto';

export default function HomePage({ setActiveView }) {
  return (
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,198,77,0.25),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(24,41,75,0.15),_transparent_24%),linear-gradient(135deg,_#ffffff_0%,_#f7f7f3_100%)] px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-8%] top-[-10%] h-40 w-40 rounded-full bg-[var(--saffron)]/20 blur-3xl animate-float-soft" />
        <div className="absolute bottom-[-8%] right-[5%] h-56 w-56 rounded-full bg-[var(--navy)]/10 blur-3xl animate-drift-slow" />
        <div className="hidden sm:block absolute right-[8%] top-[6%] h-3.5 w-3.5 rounded-full bg-[var(--saffron)]/75 animate-glow-pulse" />
        <div className="hidden sm:block absolute right-[4%] bottom-[10%] h-3 w-3 rounded-full bg-[var(--navy)]/60 animate-glow-pulse delay-150" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
        <div className="space-y-6 sm:space-y-7 animate-fade-up">
          <div className="space-y-4">
            <div className="inline-flex max-w-full items-center rounded-2xl border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--saffron)] sm:rounded-full sm:py-1 sm:text-xs sm:tracking-[0.22em]">
              Trusted digital safety for every citizen
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-3xl font-semibold leading-[1.12] tracking-tight text-[var(--ink)] sm:text-5xl lg:text-[3.25rem]">
                Stop scams before they become losses.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[var(--ink-text)]/75 sm:text-lg">
                KshemOS combines awareness, calm verification, and quick support so people can respond confidently to suspicious calls, messages, and payment requests.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <div>
              <button
                type="button"
                onClick={() => setActiveView('portal')}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-[var(--ink)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[var(--ink)]/20 transition duration-200 motion-safe:hover:-translate-y-0.5 hover:bg-[var(--navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)] focus-visible:ring-offset-2 sm:w-auto sm:text-base"
              >
                <span>Try the verification demo</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => setActiveView('awareness')}
                className={secondaryButtonClass}
              >
                Learn the warning signs
              </button>
              <button
                type="button"
                onClick={() => setActiveView('rule-library')}
                className={secondaryButtonClass}
              >
                Explore rule library
              </button>
            </div>
          </div>

          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            {[
              ['01', 'Instant scam pattern checks'],
              ['02', 'Clear guidance for citizens'],
              ['03', 'Support for officers and reports'],
            ].map(([num, label]) => (
              <div
                key={num}
                className="rounded-2xl border border-[var(--paper-line)] bg-white/80 p-3.5 backdrop-blur transition duration-200 motion-safe:hover:-translate-y-1 animate-fade-up sm:p-4"
              >
                <div className="font-display text-lg font-semibold text-[var(--ink)]">{num}</div>
                <div className="mt-1 text-sm leading-snug text-[var(--ink-text)]/70">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-[var(--saffron)]/20 to-transparent blur-2xl" aria-hidden="true" />
          <div className="relative rounded-3xl border border-[var(--paper-line)] bg-[var(--navy)] p-5 text-white shadow-xl shadow-[var(--navy)]/20 animate-fade-up sm:p-6">
            <div className="pointer-events-none absolute right-4 top-4 h-10 w-10 rounded-full border border-white/10 bg-white/10" aria-hidden="true" />
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur sm:p-5">
              <p className="pr-8 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--saffron)] sm:pr-0 sm:tracking-[0.3em]">Live protection checklist</p>
              <ul className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-[var(--mist)]">
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--saffron)]" aria-hidden="true">●</span><span>Pause before sharing OTPs, Aadhaar, or payment details.</span></li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--saffron)]" aria-hidden="true">●</span><span>Verify calls through an official number or trusted channel.</span></li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--saffron)]" aria-hidden="true">●</span><span>Report suspicious activity early to reduce harm.</span></li>
              </ul>
              <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/15 to-white/5 px-4 py-3.5">
                <div className="text-base font-medium leading-snug text-white/95 sm:text-lg">“A calm check can save a life, a livelihood, and a family’s peace.”</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
