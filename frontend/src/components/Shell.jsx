```jsx
import EmergencyPortalBanner from './EmergencyPortalBanner';

function ShieldMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
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

export default function Shell({
  portal,
  setPortal,
  activeView,
  setActiveView,
  children,
}) {
  const navButton = (key, label, onClick, extraClass = '') => (
    <button
      key={key}
      onClick={onClick}
      className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
        activeView === key
          ? 'bg-[var(--ink)] text-white shadow-sm'
          : 'text-[var(--ink-text)]/60 hover:bg-white'
      } ${extraClass}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <EmergencyPortalBanner
        onOpenAdvisory={() => setActiveView('advisory')}
      />

      <header className="border-b border-[var(--paper-line)] bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">

          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <ShieldMark />
            <div>
              <div className="font-display font-semibold leading-none tracking-tight">
                KSHEM<span className="text-[var(--saffron)]">OS</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-text)]/50">
                Digital public safety
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Main Navigation */}
            <div className="flex flex-wrap items-center gap-2 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {[
                { key: 'home', label: 'Home' },
                { key: 'toolbox', label: 'Toolbox' },
              ].map((item) =>
                navButton(
                  item.key,
                  item.label,
                  () => setActiveView(item.key)
                )
              )}
            </div>

            {/* Feature Navigation */}
            <div className="flex flex-wrap items-center gap-2 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">

              {navButton(
                'portal',
                'Verify',
                () => {
                  setActiveView('portal');
                  setPortal('citizen');
                }
              )}

              <button
                onClick={() => setActiveView('multilingual-speech')}
                className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeView === 'multilingual-speech'
                    ? 'bg-[var(--ink)] text-white shadow-sm'
                    : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                Indic Speech ASR
              </button>

              <button
                onClick={() => setActiveView('live-call-safety')}
                className={`px-3 py-1 rounded-full font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeView === 'live-call-safety'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-red-700 bg-red-50 hover:bg-red-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                Live Call Shield
              </button>

              {navButton(
                'officer',
                'Officer',
                () => {
                  setActiveView('officer');
                  setPortal('officer');
                }
              )}

              {navButton(
                'triage',
                'Triage Engine',
                () => setActiveView('triage')
              )}

              {navButton(
                'meet',
                'Meet',
                () => setActiveView('meet')
              )}

              {navButton(
                'advisory',
                'Advisory Composer',
                () => setActiveView('advisory')
              )}

              {navButton(
                'evidence',
                'Evidence Vault',
                () => setActiveView('evidence')
              )}

              {navButton(
                'alerts',
                'Alert Dispatch',
                () => setActiveView('alerts')
              )}

              {navButton(
                'contact',
                'Contact',
                () => setActiveView('contact')
              )}

            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-[var(--ink-text)]/40 py-6 font-mono">
        KshemOS — stopping fraud before the money moves
      </footer>
    </div>
  );
}
```
