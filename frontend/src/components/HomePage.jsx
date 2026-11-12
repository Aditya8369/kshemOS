export default function HomePage({ setActiveView }) {
  return (
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,198,77,0.25),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(24,41,75,0.15),_transparent_24%),linear-gradient(135deg,_#ffffff_0%,_#f7f7f3_100%)] px-4 py-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-8%] top-[-10%] h-40 w-40 rounded-full bg-[var(--saffron)]/20 blur-3xl animate-float-soft" />
        <div className="absolute bottom-[-8%] right-[5%] h-56 w-56 rounded-full bg-[var(--navy)]/10 blur-3xl animate-drift-slow" />
        <div className="absolute left-[45%] top-[15%] h-4 w-4 rounded-full bg-[var(--saffron)]/80 animate-glow-pulse" />
        <div className="absolute right-[15%] top-[25%] h-3 w-3 rounded-full bg-[var(--navy)]/70 animate-glow-pulse delay-150" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 animate-fade-up">
          <div className="inline-flex items-center rounded-full border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 px-3 py-1 text-xs font-mono uppercase tracking-[0.25em] text-[var(--saffron)]">
            Trusted digital safety for every citizen
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
              Stop scams before they become losses.
            </h1>
            <p className="max-w-2xl text-lg text-[var(--ink-text)]/75">
              KshemOS combines awareness, calm verification, and quick support so people can respond confidently to suspicious calls, messages, and payment requests.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveView('portal')}
              className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--ink)]/15 transition duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none animate-float-soft"
            >
              Try the verification demo
            </button>
            <button
              onClick={() => setActiveView('awareness')}
              className="rounded-full border border-[var(--paper-line)] bg-white/90 px-5 py-3 text-sm font-semibold text-[var(--ink)] shadow-sm transition duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              Learn the warning signs
            </button>
            <button
              onClick={() => setActiveView('rule-library')}
              className="rounded-full border border-[var(--paper-line)] bg-white/90 px-5 py-3 text-sm font-semibold text-[var(--ink-text)] shadow-sm transition duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              Explore rule library
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'Instant scam pattern checks'],
              ['02', 'Clear guidance for citizens'],
              ['03', 'Support for officers and reports'],
            ].map(([num, label]) => (
              <div key={num} className="rounded-2xl border border-[var(--paper-line)] bg-white/80 p-4 backdrop-blur transition duration-200 motion-safe:hover:-translate-y-1 motion-reduce:transition-none animate-fade-up">
                <div className="font-display text-xl font-semibold">{num}</div>
                <div className="mt-1 text-sm text-[var(--ink-text)]/70">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[var(--saffron)]/20 to-transparent blur-2xl" />
          <div className="relative rounded-[2rem] border border-[var(--paper-line)] bg-[var(--navy)] p-6 text-white shadow-2xl shadow-[var(--navy)]/25 animate-fade-up">
            <div className="absolute right-4 top-4 h-12 w-12 rounded-full border border-white/10 bg-white/10" />
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--saffron)]">Live protection checklist</p>
              <ul className="mt-4 space-y-3 text-sm text-[var(--mist)]">
                <li className="flex items-start gap-2"><span className="mt-1 text-[var(--saffron)]">●</span>Pause before sharing OTPs, Aadhaar, or payment details.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-[var(--saffron)]">●</span>Verify calls through an official number or trusted channel.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-[var(--saffron)]">●</span>Report suspicious activity early to reduce harm.</li>
              </ul>
              <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/20 to-white/5 p-4">
                <div className="text-xl font-semibold">“A calm check can save a life, a livelihood, and a family’s peace.”</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
