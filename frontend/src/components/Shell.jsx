import { useState, useRef, useEffect } from 'react';
import EmergencyPortalBanner from './EmergencyPortalBanner';
import Footer from './Footer';

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
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);
  const menuButtonRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const isFirstRender = useRef(true);

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Move focus into the mobile menu when it opens, and back to the
  // menu control when it closes, so keyboard users are never stranded.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (mobileMenuOpen) {
      mobileMenuRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  // Close the mobile menu on Escape or a click/tap outside the menu panel.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        closeMobileMenu();
      }
    }
    function handleClickOutside(e) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target)
      ) {
        closeMobileMenu();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  const navigateTo = (view, portalMode = null) => {
    if (portalMode) {
      setPortal(portalMode);
    }
    setActiveView(view);
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  };

  const navButton = (key, label, onClick, extraClass = '', isDirectActive = false) => {
    const isActive =
      isDirectActive ||
      activeView === key ||
      (key === 'contributors' && activeView === 'meet') ||
      (key === 'meet' && activeView === 'contributors');

    const buttonClass = [
      'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer',
      isActive
        ? 'bg-[var(--ink)] text-white shadow-sm'
        : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)] hover:bg-white',
      extraClass,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={key}
        type="button"
        onClick={onClick}
        className={buttonClass}
      >
        {label}
      </button>
    );
  };

  const dropdownMenu = (menuId, label, items) => {
    const isOpen = openDropdown === menuId;
    const hasActiveChild = items.some(
      (item) =>
        activeView === item.key ||
        (item.key === 'contributors' && activeView === 'meet') ||
        (item.key === 'meet' && activeView === 'contributors')
    );

    return (
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={label}
          onClick={() => setOpenDropdown(isOpen ? null : menuId)}
          className={[
            'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer',
            hasActiveChild
              ? 'bg-[var(--ink)] text-white shadow-sm'
              : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)] hover:bg-white',
          ].join(' ')}
        >
          <span>{label}</span>
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            role="menu"
            className="absolute left-0 mt-2 w-56 rounded-2xl bg-white border border-[var(--paper-line)] shadow-xl shadow-[var(--ink)]/10 p-1.5 z-30 animate-fade-up"
          >
            {items.map((item) => {
              const isItemActive =
                activeView === item.key ||
                (item.key === 'contributors' && activeView === 'meet') ||
                (item.key === 'meet' && activeView === 'contributors');

              return (
                <button
                  key={item.key}
                  role="menuitem"
                  type="button"
                  onClick={() => navigateTo(item.key, item.portal)}
                  className={[
                    'w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer',
                    isItemActive
                      ? 'bg-[var(--ink)] text-white font-semibold'
                      : 'text-[var(--ink-text)]/80 hover:bg-[var(--paper)] hover:text-[var(--ink)]',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-1.5">
                    {item.dotColor && (
                      <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor}`} />
                    )}
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-text)]/60 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Destinations exposed by the compact mobile navigation menu, grouped
  // so screen reader users can skip between sections with headings.
  const mobileMenuSections = [
    {
      label: 'Quick actions',
      items: [
        { key: 'home', label: 'Home' },
        { key: 'portal', label: 'Citizen Verification Portal', portal: 'citizen', active: 'portal' },
        { key: 'live-call-safety', label: 'Live Call Shield' },
      ],
    },
    {
      label: 'Citizen tools',
      items: [
        { key: 'regional-threat-mesh', label: 'Regional Threat Mesh', dotColor: 'bg-emerald-600' },
        { key: 'takedown-generator', label: 'Domain Abuse Takedown', dotColor: 'bg-blue-600' },
        { key: 'field-seizure', label: 'Field Seizure Companion', dotColor: 'bg-emerald-600' },
        { key: 'emergency-killswitch', label: 'Emergency Kill-Switch', dotColor: 'bg-red-600' },
        { key: 'voice-deepfake', label: 'Voice Deepfake Detector', dotColor: 'bg-indigo-600' },
        { key: 'multilingual-speech', label: 'Indic Speech ASR', dotColor: 'bg-purple-600' },
        { key: 'incident-notifications', label: 'Incident Notifications', dotColor: 'bg-indigo-500' },
        { key: 'toolbox', label: 'Cyber Toolbox' },
      ],
    },
    {
      label: 'Officer operations',
      items: [
        { key: 'officer', label: 'Officer Command Center', active: 'officer' },
        { key: 'mule-freeze', label: 'Mule Account Freeze' },
        { key: 'money-trail', label: 'Money Trail & Hop Reconstructor' },
        { key: 'triage', label: 'Triage Engine' },
        { key: 'evidence-affidavit-compiler', label: 'Section 63 BSA Affidavit' },
        { key: 'cli-spoof-detector', label: 'CLI Spoof & Telecom Triage' },
        { key: 'syndicate-triage', label: 'Syndicate & APK Triage' },
        { key: 'advisory', label: 'Advisory Composer' },
        { key: 'evidence', label: 'Evidence Vault' },
        { key: 'alerts', label: 'Alert Dispatch' },
        { key: 'jurisdiction', label: 'Jurisdiction Config' },
        { key: 'dpdp-redaction', label: 'DPDP Redaction & Masking' },
        { key: 'stage-inspector', label: 'Stage & Uniform Inspector' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { key: 'awareness', label: 'Awareness Hub' },
        { key: 'safety-tips', label: 'Safety Tips' },
        { key: 'scam-examples', label: 'Scam Examples' },
        { key: 'rule-library', label: 'Threat Library' },
      ],
    },
    {
      label: 'Project',
      items: [
        { key: 'about', label: 'About KshemOS' },
        { key: 'how-it-works', label: 'How It Works' },
        { key: 'meet', label: 'Contributors & Team', active: 'contributors' },
        { key: 'contact', label: 'Contact' },
      ],
    },
  ];

  const isMobileItemActive = (item) => {
    if (item.active) {
      return activeView === item.active;
    }
    return (
      activeView === item.key ||
      (item.key === 'contributors' && activeView === 'meet') ||
      (item.key === 'meet' && activeView === 'contributors') ||
      (item.key === 'officer' && activeView === 'portal' && portal === 'officer') ||
      (item.key === 'portal' && activeView === 'portal' && portal === 'citizen')
    );
  };

  return (
    <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
      {/* Skip to Main Content Link for Keyboard & Screen Reader Users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--ink)] focus:text-white focus:rounded-full focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] font-semibold text-xs"
      >
        Skip to main content
      </a>

      {/* Emergency Banner */}
      <EmergencyPortalBanner
        onOpenAdvisory={() => navigateTo('advisory')}
      />

      {/* Header */}
      <header className="border-b border-[var(--paper-line)] bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">

          {/* Brand */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2 shrink-0 text-left cursor-pointer min-h-[44px] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--saffron)] focus-visible:outline-offset-2 rounded-lg"
          >
            <ShieldMark />
            <div>
              <div className="font-display font-semibold leading-none tracking-tight">
                KSHEM<span className="text-[var(--saffron)]">OS</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-text)]/50">
                Digital public safety
              </div>
            </div>
          </button>

          {/* Compact mobile menu control: clearly labelled, shown at small widths only */}
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={toggleMobileMenu}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMobileMenu();
              }
            }}
            className={[
              'flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer shrink-0',
              'min-h-[44px] min-w-[44px] rounded-full border border-[var(--paper-line)] bg-[var(--paper)] text-[var(--ink-text)]/90',
              'hover:bg-[var(--ink)] hover:text-white',
              'focus-visible:outline-2 focus-visible:outline-[var(--saffron)] focus-visible:outline-offset-2',
              'flex sm:hidden',
            ].join(' ')}
          >
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
            <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
          </button>

          {/* Grouped Navigation (desktop and tablet) */}
          <nav
            ref={navRef}
            aria-label="Main navigation"
            className="hidden sm:flex flex-wrap items-center gap-2"
          >
            {/* Group 1: Home */}
            <div className="flex items-center bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {navButton('home', 'Home', () => navigateTo('home'))}
            </div>

            {/* Group 2: Citizen Safety (High-Priority Direct Actions + Tools Menu) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {/* Citizen Verify */}
              {navButton(
                'portal',
                'Verify',
                () => navigateTo('portal', 'citizen'),
                '',
                activeView === 'portal' && portal === 'citizen'
              )}

              {/* Live Call Shield */}
              <button
                type="button"
                onClick={() => navigateTo('live-call-safety')}
                className={[
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer',
                  activeView === 'live-call-safety'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-red-700 bg-red-50 hover:bg-red-100',
                ].join(' ')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Live Call Shield
              </button>

              {/* Citizen Tools Dropdown */}
              {dropdownMenu('citizen-tools', 'Citizen Tools', [
                {
                  key: 'regional-threat-mesh',
                  label: 'Regional Threat Mesh',
                  dotColor: 'bg-emerald-600',
                },
                {
                  key: 'takedown-generator',
                  label: 'Domain Abuse Takedown',
                  dotColor: 'bg-blue-600',
                },
                {
                  key: 'field-seizure',
                  label: 'Field Seizure Companion',
                  dotColor: 'bg-emerald-600',
                },
                {
                  key: 'emergency-killswitch',
                  label: 'Emergency Kill-Switch',
                  dotColor: 'bg-red-600',
                },
                {
                  key: 'voice-deepfake',
                  label: 'Voice Deepfake Detector',
                  dotColor: 'bg-indigo-600',
                },
                {
                  key: 'multilingual-speech',
                  label: 'Indic Speech ASR',
                  dotColor: 'bg-purple-600',
                },
                {
                  key: 'incident-notifications',
                  label: 'Incident Notifications',
                  dotColor: 'bg-indigo-500',
                },
                {
                  key: 'advisory-subscriptions',
                  label: 'Advisory Subscriptions',
                  dotColor: 'bg-amber-600',
                },
                {
                  key: 'toolbox',
                  label: 'Cyber Toolbox',
                },
              ])}
            </div>

            {/* Group 3: Officer Operations */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {/* Officer Command Center */}
              {navButton(
                'officer',
                'Officer',
                () => navigateTo('officer', 'officer'),
                '',
                activeView === 'officer' || (activeView === 'portal' && portal === 'officer')
              )}

              {/* Operations Dropdown */}
              {dropdownMenu('officer-operations', 'Operations', [
                { key: 'regional-threat-mesh', label: 'Regional Threat Mesh' },
                { key: 'takedown-generator', label: 'Abuse Takedown Notice' },
                { key: 'field-seizure', label: 'Field Seizure Companion' },
                { key: 'voice-deepfake', label: 'Voice Deepfake Detector' },
                { key: 'mule-freeze', label: 'Mule Account Freeze' },
                { key: 'money-trail', label: 'Money Trail & Hop Reconstructor' },
                { key: 'triage', label: 'Triage Engine' },
                { key: 'evidence-affidavit-compiler', label: 'Section 63 BSA Affidavit' },
                { key: 'cli-spoof-detector', label: 'CLI Spoof & Telecom Triage' },
                { key: 'syndicate-triage', label: 'Syndicate & APK Triage' },
                { key: 'advisory', label: 'Advisory Composer' },
                { key: 'evidence', label: 'Evidence Vault' },
                { key: 'alerts', label: 'Alert Dispatch' },
                { key: 'jurisdiction', label: 'Jurisdiction Config' },
                { key: 'dpdp-redaction', label: 'DPDP Redaction & Masking' },
                { key: 'stage-inspector', label: 'Stage & Uniform Inspector' },
              ])}
            </div>

            {/* Group 4: Resources */}
            <div className="flex items-center bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {dropdownMenu('resources', 'Resources', [
                { key: 'awareness', label: 'Awareness' },
                { key: 'safety-tips', label: 'Safety Tips' },
                { key: 'scam-examples', label: 'Scam Examples' },
                { key: 'rule-library', label: 'Threat Library' },
              ])}
            </div>

            {/* Group 5: Project */}
            <div className="flex items-center bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-sm">
              {dropdownMenu('project', 'Project', [
                { key: 'about', label: 'About KshemOS' },
                { key: 'how-it-works', label: 'How It Works' },
                { key: 'meet', label: 'Contributors & Team' },
                { key: 'contact', label: 'Contact' },
              ])}
            </div>
          </nav>

          {/* Compact mobile navigation panel: opens below the header, scoped to small widths */}
          {mobileMenuOpen && (
            <div
              ref={mobileMenuRef}
              id="mobile-menu"
              role="navigation"
              aria-label="Mobile navigation"
              tabIndex="-1"
              className="absolute top-full left-0 right-0 mt-1 z-30 max-h-[60vh] overflow-y-auto rounded-b-2xl border border-[var(--paper-line)] border-t-0 bg-white/95 backdrop-blur-md shadow-xl shadow-[var(--ink)]/10 p-2 animate-fade-up sm:hidden"
            >
              {mobileMenuSections.map((section) => (
                <div key={section.label} className="space-y-1">
                  <h2 className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--ink-text)]/40">
                    {section.label}
                  </h2>
                  {section.items.map((item) => {
                    const isActive = isMobileItemActive(item);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => navigateTo(item.key, item.portal)}
                        className={[
                          'w-full text-left px-3 py-3 rounded-xl text-base font-medium transition-colors min-h-[44px]',
                          isActive
                            ? 'bg-[var(--ink)] text-white font-semibold'
                            : 'text-[var(--ink-text)]/85 hover:bg-[var(--paper)] hover:text-[var(--ink)]',
                          'focus-visible:outline-2 focus-visible:outline-[var(--saffron)] focus-visible:outline-offset-2',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-1.5">
                          {item.dotColor && (
                            <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor}`} />
                          )}
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex="-1" className="flex-1 focus:outline-none w-full overflow-x-hidden">
        {children}
      </main>

      {/* Global Footer */}
      <Footer setActiveView={setActiveView} />
    </div>
  );
}
