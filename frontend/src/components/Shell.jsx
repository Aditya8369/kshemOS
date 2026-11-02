function ShieldMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path
        d="M20 3 L34 9 V19 C34 28 28 34 20 37 C12 34 6 28 6 19 V9 Z"
        fill="var(--navy)"
      />
      <path d="M13 20 L18 25 L28 13" stroke="var(--saffron)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function Shell({ portal, setPortal, activeView, setActiveView, children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--paper-line)] bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldMark />
            <div>
              <div className="font-display font-semibold leading-none tracking-tight">KSHEM<span className="text-[var(--saffron)]">OS</span></div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-text)]/50">
                Digital public safety
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {[
                { key: 'home', label: 'Home' },
                { key: 'toolbox', label: 'Toolbox' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveView(item.key)}
                  className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
                    activeView === item.key ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--ink-text)]/60 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              <button
                onClick={() => {
                  setActiveView('portal');
                  setPortal('citizen');
                }}
                className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
                  activeView === 'portal' && portal === 'citizen' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--ink-text)]/60 hover:bg-white'
                }`}
              >
                Verify
              </button>
              <button
                onClick={() => {
                  setActiveView('officer');
                  setPortal('officer');
                }}
                className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
                  activeView === 'officer' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--ink-text)]/60 hover:bg-white'
                }`}
              >
                Officer
              </button>
<button
                onClick={() => setActiveView('meet')}
                className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
                  activeView === 'meet' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--ink-text)]/60 hover:bg-white'
                }`}
              >
                <button 
  onClick={() => setActiveView('advisory')} 
  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
    activeView === 'advisory' 
      ? 'bg-indigo-600 text-white' 
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`}
>
  Advisory Composer
</button>
<button
  onClick={() => setActiveView('evidence')}
  className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
    activeView === 'evidence' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--ink-text)]/60 hover:bg-white'
  }`}
>
  Evidence Vault
</button>
                Meet
              </button>
              <button
                onClick={() => setActiveView('contact')}
                className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
                  activeView === 'contact' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--ink-text)]/60 hover:bg-white'
                }`}
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-center text-xs text-[var(--ink-text)]/40 py-6 font-mono">
        KshemOS — stopping fraud before the money moves
      </footer>
    </div>
  );
}
