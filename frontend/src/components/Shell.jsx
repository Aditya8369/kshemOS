import { useState, useRef, useEffect } from 'react';
import EmergencyPortalBanner from './EmergencyPortalBanner';
import Footer from './Footer';
import { getNavigationContext, PORTALS, SECTIONS } from '../navigationMeta';

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

  // Compute full navigation context and active portal state
  const navContext = getNavigationContext(activeView, portal);

  // Synchronize portal state when navigating into a specialized view
  useEffect(() => {
    if (navContext.isOfficerView && portal !== PORTALS.OFFICER) {
      setPortal(PORTALS.OFFICER);
    } else if (navContext.isCitizenView && portal !== PORTALS.CITIZEN) {
      setPortal(PORTALS.CITIZEN);
    }
  }, [navContext.isOfficerView, navContext.isCitizenView, portal, setPortal]);

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
    const targetMeta = getNavigationContext(view, portalMode || portal);
    if (portalMode) {
      setPortal(portalMode);
    } else if (targetMeta.isOfficerView) {
      setPortal(PORTALS.OFFICER);
    } else if (targetMeta.isCitizenView) {
      setPortal(PORTALS.CITIZEN);
    }
    setActiveView(view);
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  };

  const navButton = (key, label, onClick, extraClass = '', isDirectActive = false) => {
    const isDirectMatch =
      isDirectActive ||
      activeView === key ||
      (key === 'contributors' && activeView === 'meet') ||
      (key === 'meet' && activeView === 'contributors') ||
      (key === 'officer' && activeView === 'portal' && portal === 'officer') ||
      (key === 'portal' && activeView === 'portal' && portal === 'citizen');

    // Determine if this button represents the parent portal/context of an active specialist view
    const isParentContext =
      (key === 'officer' && navContext.isOfficerView && activeView !== 'officer' && (activeView !== 'portal' || portal !== 'officer')) ||
      (key === 'portal' && navContext.isCitizenView && activeView !== 'portal' && activeView !== 'live-call-safety');

    const buttonClass = [
      'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 min-h-[36px]',
      isDirectMatch
        ? 'bg-[var(--ink)] text-white shadow-sm ring-2 ring-[var(--saffron)] font-bold'
        : isParentContext
        ? 'bg-amber-50/70 text-[var(--ink)] border border-[var(--saffron)]/70 font-semibold'
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
        aria-current={isDirectMatch ? 'page' : isParentContext ? 'location' : undefined}
        className={buttonClass}
      >
        {isDirectMatch ? (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs ring-1 ring-white/50"
            aria-hidden="true"
          />
        ) : isParentContext ? (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)]/80 shrink-0"
            aria-hidden="true"
          />
        ) : null}
        <span>{label}</span>
        {isDirectMatch && <span className="sr-only"> (current page)</span>}
        {!isDirectMatch && isParentContext && <span className="sr-only"> (active portal context)</span>}
      </button>
    );
  };

  const dropdownMenu = (menuId, label, items) => {
    const isOpen = openDropdown === menuId;
    const hasActiveChild =
      navContext.activeDropdownKey === menuId ||
      items.some(
        (item) =>
          activeView === item.key ||
          (item.key === 'contributors' && activeView === 'meet') ||
          (item.key === 'meet' && activeView === 'contributors')
      );

    const activeChildItem = items.find(
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
          aria-current={hasActiveChild ? 'true' : undefined}
          aria-label={hasActiveChild && activeChildItem ? `${label} (active: ${activeChildItem.label})` : label}
          onClick={() => setOpenDropdown(isOpen ? null : menuId)}
          className={[
            'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer min-h-[36px]',
            hasActiveChild
              ? 'bg-[var(--ink)] text-white shadow-sm ring-2 ring-[var(--saffron)] font-bold'
              : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)] hover:bg-white',
          ].join(' ')}
        >
          {hasActiveChild && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs ring-1 ring-white/50"
              aria-hidden="true"
            />
          )}
          <span>{label}</span>
          {hasActiveChild && <span className="sr-only"> (contains active page)</span>}
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
            aria-label={label}
            className="absolute left-0 mt-2 w-60 rounded-2xl bg-white border border-[var(--paper-line)] shadow-xl shadow-[var(--ink)]/10 p-1.5 z-30 animate-fade-up max-h-[70vh] overflow-y-auto"
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
                  aria-current={isItemActive ? 'page' : undefined}
                  onClick={() => navigateTo(item.key, item.portal)}
                  className={[
                    'w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer',
                    isItemActive
                      ? 'bg-[var(--ink)] text-white font-bold ring-1 ring-[var(--saffron)]'
                      : 'text-[var(--ink-text)]/80 hover:bg-[var(--paper)] hover:text-[var(--ink)]',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2 truncate">
                    {isItemActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 ring-1 ring-white/50" aria-hidden="true" />
                    ) : item.dotColor ? (
                      <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor} shrink-0`} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-transparent shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{item.label}</span>
                    {isItemActive && <span className="sr-only"> (current page)</span>}
                  </span>
                  {isItemActive ? (
                    <svg
                      className="w-3.5 h-3.5 text-[var(--saffron)] shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : item.badge ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-text)]/60 font-mono shrink-0">
                      {item.badge}
                    </span>
                  ) : null}
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
        { key: 'regional-threat-mesh', label: 'Regional Threat Mesh', dotColor: 'bg-emerald-600', portal: 'citizen' },
        { key: 'takedown-generator', label: 'Domain Abuse Takedown', dotColor: 'bg-blue-600', portal: 'citizen' },
        { key: 'field-seizure', label: 'Field Seizure Companion', dotColor: 'bg-emerald-600', portal: 'citizen' },
        { key: 'emergency-killswitch', label: 'Emergency Kill-Switch', dotColor: 'bg-red-600', portal: 'citizen' },
        { key: 'voice-deepfake', label: 'Voice Deepfake Detector', dotColor: 'bg-indigo-600', portal: 'citizen' },
        { key: 'multilingual-speech', label: 'Indic Speech ASR', dotColor: 'bg-purple-600', portal: 'citizen' },
        { key: 'incident-notifications', label: 'Incident Notifications', dotColor: 'bg-indigo-500', portal: 'citizen' },
        { key: 'advisory-subscriptions', label: 'Advisory Subscriptions', dotColor: 'bg-amber-600', portal: 'citizen' },
        { key: 'toolbox', label: 'Cyber Toolbox', portal: 'citizen' },
      ],
    },
    {
      label: 'Officer operations',
      items: [
        { key: 'officer', label: 'Officer Command Center', active: 'officer', portal: 'officer' },
        { key: 'mule-freeze', label: 'Mule Account Freeze', portal: 'officer' },
        { key: 'money-trail', label: 'Money Trail & Hop Reconstructor', portal: 'officer' },
        { key: 'triage', label: 'Triage Engine', portal: 'officer' },
        { key: 'evidence-affidavit-compiler', label: 'Section 63 BSA Affidavit', portal: 'officer' },
        { key: 'cli-spoof-detector', label: 'CLI Spoof & Telecom Triage', portal: 'officer' },
        { key: 'syndicate-triage', label: 'Syndicate & APK Triage', portal: 'officer' },
        { key: 'advisory', label: 'Advisory Composer', portal: 'officer' },
        { key: 'evidence', label: 'Evidence Vault', portal: 'officer' },
        { key: 'alerts', label: 'Alert Dispatch', portal: 'officer' },
        { key: 'jurisdiction', label: 'Jurisdiction Config', portal: 'officer' },
        { key: 'dpdp-redaction', label: 'DPDP Redaction & Masking', portal: 'officer' },
        { key: 'stage-inspector', label: 'Stage & Uniform Inspector', portal: 'officer' },
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
      if (item.active === 'portal') return activeView === 'portal' && portal === 'citizen';
      if (item.active === 'officer') return activeView === 'officer' || (activeView === 'portal' && portal === 'officer');
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

          {/* Active Portal State & Switcher Control */}
          <div
            className="hidden md:flex items-center bg-[var(--paper)] border border-[var(--paper-line)] rounded-full p-1 text-xs"
            role="group"
            aria-label="Portal Selection"
          >
            <button
              type="button"
              onClick={() => navigateTo('portal', 'citizen')}
              aria-current={navContext.effectivePortal === PORTALS.CITIZEN ? 'true' : undefined}
              className={[
                'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]',
                navContext.effectivePortal === PORTALS.CITIZEN
                  ? 'bg-[var(--ink)] text-white shadow-xs ring-2 ring-[var(--saffron)] font-bold'
                  : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)] hover:bg-white',
              ].join(' ')}
            >
              {navContext.effectivePortal === PORTALS.CITIZEN ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs ring-1 ring-white/50" aria-hidden="true" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400/50 shrink-0" aria-hidden="true" />
              )}
              <span>Citizen Portal</span>
              {navContext.effectivePortal === PORTALS.CITIZEN && (
                <span className="sr-only"> (active portal)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('officer', 'officer')}
              aria-current={navContext.effectivePortal === PORTALS.OFFICER ? 'true' : undefined}
              className={[
                'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]',
                navContext.effectivePortal === PORTALS.OFFICER
                  ? 'bg-[var(--ink)] text-white shadow-xs ring-2 ring-[var(--saffron)] font-bold'
                  : 'text-[var(--ink-text)]/70 hover:text-[var(--ink)] hover:bg-white',
              ].join(' ')}
            >
              {navContext.effectivePortal === PORTALS.OFFICER ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs ring-1 ring-white/50" aria-hidden="true" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400/50 shrink-0" aria-hidden="true" />
              )}
              <span>Officer Console</span>
              {navContext.effectivePortal === PORTALS.OFFICER && (
                <span className="sr-only"> (active portal)</span>
              )}
            </button>
          </div>

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
            <div
              className={`flex flex-wrap items-center gap-1.5 bg-[var(--paper)] border rounded-full p-1 text-sm transition-all ${
                navContext.parentSectionKey === SECTIONS.CITIZEN_SAFETY || navContext.parentSectionKey === SECTIONS.CITIZEN_TOOLS
                  ? 'border-[var(--saffron)]/70 shadow-xs'
                  : 'border-[var(--paper-line)]'
              }`}
            >
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
                onClick={() => navigateTo('live-call-safety', 'citizen')}
                aria-current={activeView === 'live-call-safety' ? 'page' : undefined}
                className={[
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer min-h-[36px]',
                  activeView === 'live-call-safety'
                    ? 'bg-red-600 text-white shadow-sm ring-2 ring-[var(--saffron)] font-bold'
                    : 'text-red-700 bg-red-50 hover:bg-red-100',
                ].join(' ')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
                <span>Live Call Shield</span>
                {activeView === 'live-call-safety' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shadow-xs shrink-0 ring-1 ring-white/50" aria-hidden="true" />
                    <span className="sr-only"> (current page)</span>
                  </>
                )}
              </button>

              {/* Citizen Tools Dropdown */}
              {dropdownMenu('citizen-tools', 'Citizen Tools', [
                {
                  key: 'regional-threat-mesh',
                  label: 'Regional Threat Mesh',
                  dotColor: 'bg-emerald-600',
                  portal: 'citizen',
                },
                {
                  key: 'takedown-generator',
                  label: 'Domain Abuse Takedown',
                  dotColor: 'bg-blue-600',
                  portal: 'citizen',
                },
                {
                  key: 'field-seizure',
                  label: 'Field Seizure Companion',
                  dotColor: 'bg-emerald-600',
                  portal: 'citizen',
                },
                {
                  key: 'emergency-killswitch',
                  label: 'Emergency Kill-Switch',
                  dotColor: 'bg-red-600',
                  portal: 'citizen',
                },
                {
                  key: 'voice-deepfake',
                  label: 'Voice Deepfake Detector',
                  dotColor: 'bg-indigo-600',
                  portal: 'citizen',
                },
                {
                  key: 'multilingual-speech',
                  label: 'Indic Speech ASR',
                  dotColor: 'bg-purple-600',
                  portal: 'citizen',
                },
                {
                  key: 'incident-notifications',
                  label: 'Incident Notifications',
                  dotColor: 'bg-indigo-500',
                  portal: 'citizen',
                },
                {
                  key: 'advisory-subscriptions',
                  label: 'Advisory Subscriptions',
                  dotColor: 'bg-amber-600',
                  portal: 'citizen',
                },
                {
                  key: 'toolbox',
                  label: 'Cyber Toolbox',
                  portal: 'citizen',
                },
              ])}
            </div>

            {/* Group 3: Officer Operations */}
            <div
              className={`flex flex-wrap items-center gap-1.5 bg-[var(--paper)] border rounded-full p-1 text-sm transition-all ${
                navContext.parentSectionKey === SECTIONS.OFFICER_OPERATIONS
                  ? 'border-[var(--saffron)]/70 shadow-xs'
                  : 'border-[var(--paper-line)]'
              }`}
            >
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
                { key: 'mule-freeze', label: 'Mule Account Freeze', portal: 'officer' },
                { key: 'money-trail', label: 'Money Trail & Hop Reconstructor', portal: 'officer' },
                { key: 'triage', label: 'Triage Engine', portal: 'officer' },
                { key: 'evidence-affidavit-compiler', label: 'Section 63 BSA Affidavit', portal: 'officer' },
                { key: 'cli-spoof-detector', label: 'CLI Spoof & Telecom Triage', portal: 'officer' },
                { key: 'syndicate-triage', label: 'Syndicate & APK Triage', portal: 'officer' },
                { key: 'advisory', label: 'Advisory Composer', portal: 'officer' },
                { key: 'evidence', label: 'Evidence Vault', portal: 'officer' },
                { key: 'alerts', label: 'Alert Dispatch', portal: 'officer' },
                { key: 'jurisdiction', label: 'Jurisdiction Config', portal: 'officer' },
                { key: 'dpdp-redaction', label: 'DPDP Redaction & Masking', portal: 'officer' },
                { key: 'stage-inspector', label: 'Stage & Uniform Inspector', portal: 'officer' },
                { key: 'regional-threat-mesh', label: 'Regional Threat Mesh', portal: 'officer' },
                { key: 'takedown-generator', label: 'Abuse Takedown Notice', portal: 'officer' },
                { key: 'field-seizure', label: 'Field Seizure Companion', portal: 'officer' },
                { key: 'voice-deepfake', label: 'Voice Deepfake Detector', portal: 'officer' },
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
              className="absolute top-full left-0 right-0 mt-1 z-30 max-h-[70vh] overflow-y-auto rounded-b-2xl border border-[var(--paper-line)] border-t-0 bg-white/95 backdrop-blur-md shadow-xl shadow-[var(--ink)]/10 p-2 animate-fade-up sm:hidden"
            >
              {/* Mobile Active Portal Switcher */}
              <div className="p-2 mb-2 bg-[var(--paper)] rounded-xl border border-[var(--paper-line)]">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink-text)]/50 mb-1.5 px-1">
                  Active Portal
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigateTo('portal', 'citizen')}
                    aria-current={navContext.effectivePortal === PORTALS.CITIZEN ? 'true' : undefined}
                    className={[
                      'px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px] transition-all',
                      navContext.effectivePortal === PORTALS.CITIZEN
                        ? 'bg-[var(--ink)] text-white shadow-xs ring-2 ring-[var(--saffron)] font-bold'
                        : 'bg-white text-[var(--ink-text)] hover:text-[var(--ink)] border border-[var(--paper-line)]',
                    ].join(' ')}
                  >
                    <span className={`w-2 h-2 rounded-full ${navContext.effectivePortal === PORTALS.CITIZEN ? 'bg-[var(--saffron)]' : 'bg-slate-300'}`} aria-hidden="true" />
                    <span>Citizen Portal</span>
                    {navContext.effectivePortal === PORTALS.CITIZEN && <span className="sr-only"> (active portal)</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('officer', 'officer')}
                    aria-current={navContext.effectivePortal === PORTALS.OFFICER ? 'true' : undefined}
                    className={[
                      'px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px] transition-all',
                      navContext.effectivePortal === PORTALS.OFFICER
                        ? 'bg-[var(--ink)] text-white shadow-xs ring-2 ring-[var(--saffron)] font-bold'
                        : 'bg-white text-[var(--ink-text)] hover:text-[var(--ink)] border border-[var(--paper-line)]',
                    ].join(' ')}
                  >
                    <span className={`w-2 h-2 rounded-full ${navContext.effectivePortal === PORTALS.OFFICER ? 'bg-[var(--saffron)]' : 'bg-slate-300'}`} aria-hidden="true" />
                    <span>Officer Console</span>
                    {navContext.effectivePortal === PORTALS.OFFICER && <span className="sr-only"> (active portal)</span>}
                  </button>
                </div>
              </div>

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
                        aria-current={isActive ? 'page' : undefined}
                        className={[
                          'w-full text-left px-3 py-3 rounded-xl text-base font-medium transition-colors min-h-[44px] flex items-center justify-between',
                          isActive
                            ? 'bg-[var(--ink)] text-white font-bold ring-2 ring-[var(--saffron)] shadow-xs'
                            : 'text-[var(--ink-text)]/85 hover:bg-[var(--paper)] hover:text-[var(--ink)]',
                          'focus-visible:outline-2 focus-visible:outline-[var(--saffron)] focus-visible:outline-offset-2',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-2">
                          {isActive ? (
                            <span className="w-2 h-2 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs ring-1 ring-white/50" aria-hidden="true" />
                          ) : item.dotColor ? (
                            <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0`} />
                          ) : null}
                          <span>{item.label}</span>
                          {isActive && <span className="sr-only"> (current page)</span>}
                        </span>
                        {isActive && (
                          <svg className="w-4 h-4 text-[var(--saffron)] shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Active Destination & Parent Context Breadcrumb Navigation Bar */}
      <nav
        aria-label="Breadcrumb navigation"
        className="border-b border-[var(--paper-line)] bg-white/70 backdrop-blur-xs text-xs px-4 sm:px-6 lg:px-8 py-2"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
          <ol className="flex items-center gap-1.5 text-xs text-[var(--ink-text)]/70 shrink-0 whitespace-nowrap">
            <li>
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className="hover:text-[var(--ink)] underline-offset-2 hover:underline cursor-pointer flex items-center gap-1 font-medium min-h-[28px]"
              >
                <span>Home</span>
              </button>
            </li>
            {navContext.parentSectionKey !== SECTIONS.HOME && (
              <>
                <li aria-hidden="true" className="text-[var(--ink-text)]/40 font-mono">/</li>
                <li className="font-semibold text-[var(--ink-text)]/85 flex items-center gap-1">
                  <span>{navContext.parentSectionLabel}</span>
                </li>
              </>
            )}
            <li aria-hidden="true" className="text-[var(--ink-text)]/40 font-mono">/</li>
            <li className="font-bold text-[var(--ink)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs" aria-hidden="true" />
              <span aria-current="page">{navContext.destinationLabel}</span>
            </li>
          </ol>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-text)]/50">
              Active Portal:
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                navContext.effectivePortal === PORTALS.OFFICER
                  ? 'bg-[var(--navy)] text-white border-[var(--navy-line)]'
                  : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--paper-line)]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--saffron)] shrink-0 shadow-xs" aria-hidden="true" />
              <span>{navContext.portalLabel}</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" tabIndex="-1" className="flex-1 focus:outline-none w-full overflow-x-hidden">
        {children}
      </main>

      {/* Global Footer */}
      <Footer setActiveView={setActiveView} />
    </div>
  );
}
