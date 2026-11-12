/**
 * Officer Command Center Workspace & Hierarchy Data Model.
 *
 * Implements Issue #72 acceptance criteria:
 * 1. Group operational summary, active incidents, and investigation tools into clear sections.
 * 2. Make the most time-sensitive information visually prominent.
 * 3. Standardise section headings, spacing, and panel styles.
 * 4. Preserve all existing officer workflows and responsive behaviour.
 */

export const SAMPLE_ACCOUNTS = ['ACC-1002', 'ACC-1004', 'ACC-1009', 'ACC-1005'];

/**
 * Standardized 3-tier functional sections for Officer Command Center.
 * Fulfills Criterion 1: Group operational summary, active incidents, and investigation tools.
 */
export const WORKSPACE_SECTIONS = [
  {
    id: 'all',
    label: 'All Workspaces',
    shortLabel: 'All',
    count: 10,
    description: 'Unified command console containing all operational, fast-response, and forensic workspaces.',
  },
  {
    id: 'operations',
    label: 'Operational Summary & Feed',
    shortLabel: 'Operations',
    count: 2,
    description: 'Real-time intake volume, severity breakdown, region staffing coverage, and sector boundaries.',
    badge: 'Live Operations',
    tabs: ['incidents', 'jurisdiction'],
  },
  {
    id: 'incidents',
    label: 'Active Incidents & Fast Response',
    shortLabel: 'Fast Response',
    count: 2,
    description: 'Emergency stop protocols, 1930 priority debit freeze, and telecom spoof interception.',
    badge: 'Time Critical',
    tabs: ['freeze', 'cli-spoof'],
  },
  {
    id: 'investigation',
    label: 'Investigation & Forensic Tools',
    shortLabel: 'Investigation Tools',
    count: 6,
    description: 'Evidence-grounded copilot, fraud-ring graph tracing, case summaries, court-ready affidavits, and APK triage.',
    badge: 'Deep Forensics',
    tabs: ['copilot', 'tools', 'syndicate', 'evidence', 'affidavit', 'dpdp'],
  },
];

/**
 * Metadata for all 10 officer workspaces and desks.
 */
export const TABS = [
  {
    key: 'incidents',
    label: 'Incident dashboard',
    sectionId: 'operations',
    sectionName: 'Operational Summary & Feed',
    tag: 'Live Intake',
    urgent: false,
    description: 'Where incidents are piling up, what is escalating, and which desks are stretched.',
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction & Zones',
    sectionId: 'operations',
    sectionName: 'Operational Summary & Feed',
    tag: 'Sectors & Aid',
    urgent: false,
    description: 'Operational zone boundaries, service areas, automated dispatch routing, and multi-officer change review.',
  },
  {
    key: 'freeze',
    label: 'UPI Mule Freeze (1930)',
    sectionId: 'incidents',
    sectionName: 'Active Incidents & Fast Response',
    tag: 'Sec 102 CrPC',
    badge: 'Urgent',
    urgent: true,
    description: 'Automated Section 102 CrPC provisional debit freeze dispatch to bank nodal desks and CFCFRMS priority stop protocol.',
  },
  {
    key: 'cli-spoof',
    label: 'CLI Spoof & Telecom Triage',
    sectionId: 'incidents',
    sectionName: 'Active Incidents & Fast Response',
    tag: 'SIM Box Intercept',
    badge: 'Active Threat',
    urgent: true,
    description: 'Calling Line Identification (CLI) spoof detection, TRAI circle cross-referencing, and rogue GSM SIM Box ingress triage.',
  },
  {
    key: 'copilot',
    label: 'Officer Copilot (Grounded)',
    sectionId: 'investigation',
    sectionName: 'Investigation & Forensic Tools',
    tag: 'Statutory SOPs',
    urgent: false,
    description: 'Evidence-grounded investigative next steps with 4-tier separation, source citations, and human approval guardrails.',
  },
  {
    key: 'tools',
    label: 'Investigation tools',
    sectionId: 'investigation',
    sectionName: 'Investigation & Forensic Tools',
    tag: 'Graph & Summaries',
    urgent: false,
    description: 'Fraud-ring tracing and AI-drafted case summaries from a single account or report ID.',
  },
  {
    key: 'syndicate',
    label: 'Syndicate & APK Triage',
    sectionId: 'investigation',
    sectionName: 'Investigation & Forensic Tools',
    tag: 'Cambodia/Myanmar',
    urgent: false,
    description: 'Extract WhatsApp/Telegram syndicate recruitment groups, admin numbers, crypto wallets, and APK sandbox triage.',
  },
  {
    key: 'evidence',
    label: 'Evidence Vault',
    sectionId: 'investigation',
    sectionName: 'Investigation & Forensic Tools',
    tag: 'Sec 65B Forensics',
    urgent: false,
    description: 'Immutable chain of custody, Section 65B forensic bundles, and legal hold verification.',
  },
  {
    key: 'affidavit',
    label: 'Section 63 BSA Compiler',
    sectionId: 'investigation',
    sectionName: 'Investigation & Forensic Tools',
    tag: 'NTP Stratum 1',
    urgent: false,
    description: 'Sealed court-ready Section 63 BSA / 65B IEA certificates with Stratum 1 NTP records and dual-officer legal declarations.',
  },
  {
    key: 'dpdp',
    label: 'DPDP Redaction & Masking',
    sectionId: 'investigation',
    sectionName: 'Investigation & Forensic Tools',
    tag: 'Privacy Compliance',
    urgent: false,
    description: 'Redaction of sensitive PII, digital arrest transcript masking, and privacy-compliant regulatory disclosure.',
  },
];

/**
 * Filter tabs visible under a given functional section.
 * @param {string} sectionId
 * @returns {Array} List of tab objects
 */
export function getVisibleTabs(sectionId = 'all') {
  if (!sectionId || sectionId === 'all') {
    return TABS;
  }
  const section = WORKSPACE_SECTIONS.find((s) => s.id === sectionId);
  if (!section || !section.tabs) {
    return TABS;
  }
  return TABS.filter((t) => section.tabs.includes(t.key));
}

/**
 * Retrieve metadata for a specific tab key.
 * @param {string} tabKey
 * @returns {object} Tab metadata object
 */
export function getTabMeta(tabKey) {
  return (
    TABS.find((t) => t.key === tabKey) || {
      key: tabKey,
      label: tabKey,
      sectionId: 'operations',
      sectionName: 'Operational Summary & Feed',
      tag: 'General',
      urgent: false,
      description: 'Unified command console workspace.',
    }
  );
}

/**
 * Get all rapid-response time-sensitive tabs.
 * @returns {Array}
 */
export function getUrgentTabs() {
  return TABS.filter((t) => t.urgent);
}

