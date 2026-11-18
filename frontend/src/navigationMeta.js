/**
 * Navigation Metadata & Active State Resolver for KshemOS
 *
 * Provides authoritative mapping between view keys, human-readable labels,
 * parent navigation sections, active portal state (Citizen vs Officer vs Public),
 * and dropdown parent contexts.
 */

export const PORTALS = {
  CITIZEN: 'citizen',
  OFFICER: 'officer',
  PUBLIC: 'public',
};

export const SECTIONS = {
  HOME: 'home',
  CITIZEN_SAFETY: 'citizen-safety',
  CITIZEN_TOOLS: 'citizen-tools',
  OFFICER_OPERATIONS: 'officer-operations',
  RESOURCES: 'resources',
  PROJECT: 'project',
};

export const SECTION_LABELS = {
  [SECTIONS.HOME]: 'Home',
  [SECTIONS.CITIZEN_SAFETY]: 'Citizen Safety',
  [SECTIONS.CITIZEN_TOOLS]: 'Citizen Tools',
  [SECTIONS.OFFICER_OPERATIONS]: 'Officer Operations',
  [SECTIONS.RESOURCES]: 'Resources',
  [SECTIONS.PROJECT]: 'Project',
};

export const PORTAL_LABELS = {
  [PORTALS.CITIZEN]: 'Citizen Safety Portal',
  [PORTALS.OFFICER]: 'Officer Command Console',
  [PORTALS.PUBLIC]: 'Public Safety Information',
};

/**
 * Registry of all known views and their navigation hierarchy.
 */
export const VIEW_REGISTRY = {
  // Home
  home: {
    label: 'Home',
    section: SECTIONS.HOME,
    portal: PORTALS.PUBLIC,
    dropdown: null,
  },

  // Citizen Direct Actions
  portal: {
    label: 'Citizen Verification Portal',
    section: SECTIONS.CITIZEN_SAFETY,
    portal: PORTALS.CITIZEN,
    dropdown: null,
  },
  'live-call-safety': {
    label: 'Live Call Shield',
    section: SECTIONS.CITIZEN_SAFETY,
    portal: PORTALS.CITIZEN,
    dropdown: null,
  },

  // Citizen Tools
  'regional-threat-mesh': {
    label: 'Regional Threat Mesh',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'takedown-generator': {
    label: 'Domain Abuse Takedown',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'field-seizure': {
    label: 'Field Seizure Companion',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'emergency-killswitch': {
    label: 'Emergency Kill-Switch',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'voice-deepfake': {
    label: 'Voice Deepfake Detector',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'multilingual-speech': {
    label: 'Indic Speech ASR',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'incident-notifications': {
    label: 'Incident Notifications',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'advisory-subscriptions': {
    label: 'Advisory Subscriptions',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  toolbox: {
    label: 'Cyber Toolbox',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },
  'evidence-upload': {
    label: 'Citizen Evidence Upload',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  },

  // Officer Operations
  officer: {
    label: 'Officer Command Center',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: null,
  },
  'mule-freeze': {
    label: 'Mule Account Freeze',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'money-trail': {
    label: 'Money Trail & Hop Reconstructor',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  triage: {
    label: 'Triage Engine',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'evidence-affidavit-compiler': {
    label: 'Section 63 BSA Affidavit',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'cli-spoof-detector': {
    label: 'CLI Spoof & Telecom Triage',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'syndicate-triage': {
    label: 'Syndicate & APK Triage',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  advisory: {
    label: 'Advisory Composer',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  evidence: {
    label: 'Evidence Vault',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  alerts: {
    label: 'Alert Dispatch',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  jurisdiction: {
    label: 'Jurisdiction Config',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'dpdp-redaction': {
    label: 'DPDP Redaction & Masking',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'stage-inspector': {
    label: 'Stage & Uniform Inspector',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },
  'online-reputation-safety': {
    label: 'Online Reputation Safety',
    section: SECTIONS.OFFICER_OPERATIONS,
    portal: PORTALS.OFFICER,
    dropdown: 'officer-operations',
  },

  // Resources
  awareness: {
    label: 'Awareness Hub',
    section: SECTIONS.RESOURCES,
    portal: PORTALS.PUBLIC,
    dropdown: 'resources',
  },
  'safety-tips': {
    label: 'Safety Tips',
    section: SECTIONS.RESOURCES,
    portal: PORTALS.PUBLIC,
    dropdown: 'resources',
  },
  'scam-examples': {
    label: 'Scam Examples',
    section: SECTIONS.RESOURCES,
    portal: PORTALS.PUBLIC,
    dropdown: 'resources',
  },
  'rule-library': {
    label: 'Threat Library',
    section: SECTIONS.RESOURCES,
    portal: PORTALS.PUBLIC,
    dropdown: 'resources',
  },
  intelligence: {
    label: 'Scam Intelligence',
    section: SECTIONS.RESOURCES,
    portal: PORTALS.PUBLIC,
    dropdown: 'resources',
  },

  // Project
  about: {
    label: 'About KshemOS',
    section: SECTIONS.PROJECT,
    portal: PORTALS.PUBLIC,
    dropdown: 'project',
  },
  'how-it-works': {
    label: 'How It Works',
    section: SECTIONS.PROJECT,
    portal: PORTALS.PUBLIC,
    dropdown: 'project',
  },
  meet: {
    label: 'Contributors & Team',
    section: SECTIONS.PROJECT,
    portal: PORTALS.PUBLIC,
    dropdown: 'project',
  },
  contributors: {
    label: 'Contributors & Team',
    section: SECTIONS.PROJECT,
    portal: PORTALS.PUBLIC,
    dropdown: 'project',
  },
  contact: {
    label: 'Contact',
    section: SECTIONS.PROJECT,
    portal: PORTALS.PUBLIC,
    dropdown: 'project',
  },
  motivation: {
    label: 'Motivation & Ethics',
    section: SECTIONS.PROJECT,
    portal: PORTALS.PUBLIC,
    dropdown: 'project',
  },
};

// Known Officer Views set for quick lookup
export const OFFICER_VIEWS = new Set([
  'officer',
  'mule-freeze',
  'money-trail',
  'triage',
  'evidence-affidavit-compiler',
  'cli-spoof-detector',
  'syndicate-triage',
  'advisory',
  'evidence',
  'alerts',
  'jurisdiction',
  'dpdp-redaction',
  'stage-inspector',
  'online-reputation-safety',
]);

// Known Citizen Views set for quick lookup
export const CITIZEN_VIEWS = new Set([
  'portal',
  'live-call-safety',
  'regional-threat-mesh',
  'takedown-generator',
  'field-seizure',
  'emergency-killswitch',
  'voice-deepfake',
  'multilingual-speech',
  'incident-notifications',
  'advisory-subscriptions',
  'toolbox',
  'evidence-upload',
]);

/**
 * Resolves metadata for any activeView string (including sub-features).
 */
export function getViewMeta(viewKey, portalMode = 'citizen') {
  if (viewKey === 'portal' && portalMode === 'officer') {
    return {
      label: 'Officer Command Center',
      section: SECTIONS.OFFICER_OPERATIONS,
      portal: PORTALS.OFFICER,
      dropdown: null,
    };
  }

  if (VIEW_REGISTRY[viewKey]) {
    return VIEW_REGISTRY[viewKey];
  }

  // Fallback for 40+ cyber feature sub-views opened from Cyber Toolbox
  // They all belong to Citizen Tools
  const formatted = (viewKey || '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    label: formatted || 'Specialist View',
    section: SECTIONS.CITIZEN_TOOLS,
    portal: PORTALS.CITIZEN,
    dropdown: 'citizen-tools',
  };
}

/**
 * Resolves complete navigation and active portal context for the current view and portal state.
 */
export function getNavigationContext(viewKey, portalMode = 'citizen') {
  const meta = getViewMeta(viewKey, portalMode);

  let effectivePortal = meta.portal;
  if (meta.portal === PORTALS.PUBLIC) {
    // If on a public page (e.g. Home, About), reflect current portal mode preference
    effectivePortal = portalMode === 'officer' ? PORTALS.OFFICER : PORTALS.CITIZEN;
  }

  const isOfficerView = OFFICER_VIEWS.has(viewKey) || (viewKey === 'portal' && portalMode === 'officer');
  const isCitizenView = !isOfficerView && (CITIZEN_VIEWS.has(viewKey) || meta.portal === PORTALS.CITIZEN);

  return {
    viewKey,
    destinationLabel: meta.label,
    parentSectionKey: meta.section,
    parentSectionLabel: SECTION_LABELS[meta.section] || 'Operations',
    activeDropdownKey: meta.dropdown,
    effectivePortal,
    portalLabel: PORTAL_LABELS[effectivePortal] || 'KshemOS',
    isOfficerView,
    isCitizenView,
  };
}
