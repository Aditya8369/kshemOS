/**
 * Standardized Page Layout Conventions for KshemOS.
 * Establishes consistent container widths, vertical spacing rhythms,
 * eyebrow labels, titles, and descriptions across citizen public pages,
 * focused tool pages, and officer tactical workspaces.
 */

export const CONTAINER_VARIANTS = {
  // Public Information & Browsing Pages (About, How It Works, Scam Examples, Safety Tips, Awareness, Threat Library, Contact, Meet)
  public: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12 w-full',

  // Focused Citizen Tool Pages (QR Guardian, Link Shield, SMS Analyzer, UPI Fraud Shield, Job Scam Radar, etc.)
  tool: 'max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8 w-full',

  // Officer Tactical Command Workspaces (Incident Dashboard, Jurisdiction, Officer Copilot, Fraud Graph)
  officer: 'max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 w-full text-white',

  // Narrow Form Workspaces (Single-purpose forms, Citizen Intake Form)
  narrow: 'max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 w-full'
};

export const HEADER_TYPOGRAPHY = {
  // Reusable visual conventions for eyebrow labels
  eyebrow: 'font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]',
  eyebrowOfficer: 'font-mono text-xs uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]',

  // Page titles
  title: 'font-display text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)] leading-tight',
  titleHero: 'font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight',
  titleTool: 'font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]',
  titleOfficer: 'font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight',

  // Descriptions
  description: 'text-sm sm:text-base text-[var(--ink-text)]/75 max-w-2xl leading-relaxed',
  descriptionHero: 'text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed',
  descriptionOfficer: 'text-sm text-[var(--mist)] max-w-2xl leading-relaxed',
  descriptionTool: 'text-xs sm:text-sm text-[var(--ink-text)]/70 max-w-2xl leading-relaxed'
};

export const CARD_SURFACES = {
  // Standard citizen card surface
  standard: 'rounded-2xl border border-[var(--paper-line)] bg-white p-5 sm:p-6 shadow-xs',
  
  // Hero banner surface
  hero: 'rounded-3xl border border-[var(--paper-line)] bg-gradient-to-br from-[var(--navy)] via-[#0d213b] to-[var(--ink)] text-white p-6 sm:p-10 shadow-md relative overflow-hidden',
  
  // Officer panel surface (preserving dark tactical aesthetic)
  officerPanel: 'rounded-2xl border border-[var(--navy-line)] bg-[var(--navy)] p-5 sm:p-6 shadow-xs'
};

