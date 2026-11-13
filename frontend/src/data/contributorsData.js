/**
 * Community Contributors & Maintainers Data for KshemOS Open Source Hub.
 * Entries reflect actual git history and merged pull requests without fabricated rankings, totals, or badges.
 */

export const CONTRIBUTION_CATEGORIES = [
  {
    id: 'all',
    label: 'All Categories',
    description: 'Browse listed maintainers and community contributors across all contribution areas.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/issues',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    description: 'Citizen tools, responsive interfaces, visual hierarchy, and operational UI dashboards.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3AUI',
  },
  {
    id: 'backend',
    label: 'Backend',
    description: 'FastAPI services, audit logging, triage engines, and graph or spatial APIs.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3Abackend',
  },
  {
    id: 'ai-research',
    label: 'AI / Research',
    description: 'Scam heuristics, explainable risk scoring, threat intelligence, and fraud analysis.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity',
  },
  {
    id: 'documentation',
    label: 'Documentation',
    description: 'Architecture blueprints, contributor guides, threat briefs, and onboarding docs.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md',
  },
  {
    id: 'testing',
    label: 'Testing',
    description: 'Unit tests, edge-case suites, deduplication checks, and regression coverage.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Keyboard navigation, screen reader semantics, contrast, and mobile ergonomics.',
    issuesUrl: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3AUI',
  },
];

export const CONTRIBUTION_CATEGORY_MAP = Object.fromEntries(
  CONTRIBUTION_CATEGORIES.map((category) => [category.id, category])
);

export const CORE_TEAM = [
  {
    id: 'esha-jha',
    name: 'Esha Jha',
    github: 'GoldRay19',
    role: 'Full Stack Developer & Cybersecurity Researcher',
    type: 'core',
    typeLabel: 'Core Maintainer',
    bio: 'Building end-to-end cyber safety tools with a focus on rule-based scam detection, threat intelligence, and user protection systems. Passionate about making digital safety accessible to everyone.',
    area: 'System Architecture, Scam Detection Engine, Platform Core & Threat Intelligence',
    highlights: ['Platform Core Architecture', 'Rule-Based Scam Detection', 'Threat Intelligence Framework', 'System Integration'],
    initials: 'EJ',
    color: '#ff7a1a', // var(--saffron)
    githubUrl: 'https://github.com/GoldRay19',
    domain: 'Core Architecture',
    categories: ['frontend', 'backend', 'ai-research'],
  },
  {
    id: 'eshita-jha',
    name: 'Eshita Jha',
    github: 'Eshitajha19',
    role: 'ML Engineer & Cybersecurity Researcher',
    type: 'core',
    typeLabel: 'Core Maintainer',
    bio: 'Engineering intelligent rule-based systems for phishing, impersonation, and financial fraud detection. Focused on creating scalable, explainable, and privacy-first safety solutions.',
    area: 'AI Scam Intelligence, Explainable Heuristics & Cyber Defense Modules',
    highlights: ['Cyber Safety Modules', 'Phishing & Impersonation Heuristics', 'AI Security Models', 'System Blueprint'],
    initials: 'EJ',
    color: '#3f8f6b', // var(--safe)
    githubUrl: 'https://github.com/Eshitajha19',
    domain: 'AI & Security Research',
    categories: ['ai-research'],
  },
];

export const COMMUNITY_CONTRIBUTORS = [
  {
    id: 'aditya-mahajan',
    name: 'Aditya Mahajan',
    github: 'Aditya8369',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Engineered critical operational infrastructure including predictive spatial threat maps, AI telephony honeypots, role-based escalation alerts, and calibrated multi-signal risk models.',
    area: 'Spatial Intelligence, Telephony Honeypot, Officer Copilot & Multi-Signal Risk Engine',
    highlights: ['Predictive Spatial Intelligence', 'AI Telephony Honeypot', 'Officer Copilot Recommendations', 'Calibrated Risk Model', 'Chain-of-Custody Evidence Links'],
    initials: 'AM',
    color: '#2563eb', // Royal Blue
    githubUrl: 'https://github.com/Aditya8369',
    domain: 'Spatial & AI Systems',
    categories: ['frontend', 'backend', 'ai-research'],
  },
  {
    id: 'khushi-agarwal',
    name: 'Khushi Agarwal',
    github: 'Khushi-agarwal1401',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Enhanced project accessibility and user experience across the global footer, citizen helpline touchpoints, and mobile responsive interactions.',
    area: 'Global Navigation Footer, Official Helpline Actions & Mobile UX Optimization',
    highlights: ['Global Safety Footer Expansion', 'Helpline Click-to-Call Actions', 'Mobile Touchpoint Optimization'],
    initials: 'KA',
    color: '#db2777', // Rose Pink
    githubUrl: 'https://github.com/Khushi-agarwal1401',
    domain: 'Frontend & UX',
    categories: ['frontend', 'accessibility'],
  },
  {
    id: 'bhavesh-patil',
    name: 'Bhavesh Patil',
    github: 'bhavesh-patil2007',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Built compliance infrastructure including centralized immutable audit logging and command drill simulation engines for incident response preparedness.',
    area: 'Centralized Audit Logging, Statutory Compliance APIs & Command Drill Simulation',
    highlights: ['Centralized Audit Trail Engine', 'Statutory Compliance APIs', 'Command Drill Simulation Router'],
    initials: 'BP',
    color: '#7c3aed', // Violet
    githubUrl: 'https://github.com/bhavesh-patil2007',
    domain: 'Audit & Compliance',
    categories: ['backend'],
  },
  {
    id: 'venkatasai',
    name: 'Venkatasai',
    github: 'Venkatasai200628',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Developed explainable fraud graph visualization and review systems to uncover coordinated cybercrime syndicates and financial fraud rings.',
    area: 'Fraud Graph Visualization, Network Intelligence & Syndicate Review APIs',
    highlights: ['Interactive Fraud Graph UI', 'Syndicate Entity Association', 'Graph Review System APIs'],
    initials: 'VS',
    color: '#059669', // Emerald
    githubUrl: 'https://github.com/Venkatasai200628',
    domain: 'Fraud Graph & Intelligence',
    categories: ['frontend', 'backend', 'ai-research'],
  },
  {
    id: 'he-ruoxin',
    name: 'He Ruoxin',
    github: 'Roxyh-code',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Implemented baseline incident similarity algorithms and comprehensive edge-case testing for duplicate incident detection and cross-referencing.',
    area: 'Incident Similarity Matching, Deduplication Logic & Edge-Case Testing',
    highlights: ['Incident Similarity Matching', 'Duplicate Detection Heuristics', 'Edge-Case Test Suites'],
    initials: 'HR',
    color: '#d97706', // Amber
    githubUrl: 'https://github.com/Roxyh-code',
    domain: 'Incident Intelligence',
    categories: ['ai-research', 'testing'],
  },
  {
    id: 'soham-gonbhare',
    name: 'Soham Gonbhare',
    github: 'CoderSoham345',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Architected the automated triage engine, supervisor overrides, dynamic alert dispatch with hash deduplication, public advisory bulletins, and digital evidence vaulting.',
    area: 'Automated Triage Engine, Alert Dispatch, Public Advisories & Evidence Vault',
    highlights: ['Automated Triage Engine', 'Supervisor Override Flow', 'Alert Dispatch Deduplication', 'Public Advisory Composer', 'Secure Digital Evidence Vault'],
    initials: 'SG',
    color: '#0891b2', // Cyan
    githubUrl: 'https://github.com/CoderSoham345',
    domain: 'Triage & Incident Response',
    categories: ['frontend', 'backend'],
  },
  {
    id: 'kartik-manral',
    name: 'Kartik Manral',
    github: 'KartikManral092006',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Designed and built the operational incident dashboard for field officers, enabling rapid response monitoring and operational visibility.',
    area: 'Operational Incident Dashboard & Real-Time Monitoring for Field Officers',
    highlights: ['Real-Time Incident Dashboard', 'Officer Operational Console', 'Response Target Tracking'],
    initials: 'KM',
    color: '#4f46e5', // Indigo
    githubUrl: 'https://github.com/KartikManral092006',
    domain: 'Officer Operations',
    categories: ['frontend'],
  },
  {
    id: 'purnima-sukhija',
    name: 'Purnima Sukhija',
    github: 'sukhijapurnima888',
    role: 'Open Source Contributor',
    type: 'community',
    typeLabel: 'Community Contributor',
    bio: 'Developed the dynamic response team assignment matrix, establishing rule-based personnel routing for specialized cybercrime incident dispatch.',
    area: 'Response Team Assignment Matrix & Specialized Dispatch Coordination',
    highlights: ['Response Team Matrix Engine', 'Specialized Unit Routing', 'Dynamic Team Reassignment'],
    initials: 'PS',
    color: '#0d9488', // Teal
    githubUrl: 'https://github.com/sukhijapurnima888',
    domain: 'Dispatch & Operations',
    categories: ['frontend', 'backend'],
  },
];

export const ALL_CONTRIBUTORS = [...CORE_TEAM, ...COMMUNITY_CONTRIBUTORS];

export const CONTRIBUTION_DOMAINS = [
  'All Domains',
  'Core Architecture',
  'AI & Security Research',
  'Spatial & AI Systems',
  'Frontend & UX',
  'Audit & Compliance',
  'Fraud Graph & Intelligence',
  'Incident Intelligence',
  'Triage & Incident Response',
  'Officer Operations',
  'Dispatch & Operations',
];

export const CONTRIBUTION_AREAS_GUIDE = [
  {
    title: 'Frontend & UI Components',
    tech: 'React 19, Tailwind CSS v4, Lucide Icons',
    description: 'Create intuitive public safety calculators, citizen awareness widgets, and responsive interfaces.',
    link: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3AUI',
  },
  {
    title: 'Backend Services & APIs',
    tech: 'Python, FastAPI, NetworkX, Asynchronous Stores',
    description: 'Build robust incident ingestion, evidence hashing, spatial geo-routing, and forensic logging endpoints.',
    link: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3Abackend',
  },
  {
    title: 'AI, Research & Rule Heuristics',
    tech: 'JavaScript Heuristics, Pattern Matching, Indic NLP',
    description: 'Expand scam patterns targeting UPI, digital arrest scams, impersonation fraud, and regional language variations.',
    link: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity',
  },
  {
    title: 'Documentation & Guides',
    tech: 'Markdown, Architecture Notes, Citizen Education',
    description: 'Document standard operating procedures, threat analysis briefs, setup steps, and citizen education materials.',
    link: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md',
  },
  {
    title: 'Testing & Quality Assurance',
    tech: 'Node.js Tests, Pytest, Edge-Case Verification',
    description: 'Write reproducible unit tests, validate edge-case heuristics, and guard against UI and API regressions.',
    link: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen',
  },
  {
    title: 'Accessibility & Mobile Ergonomics',
    tech: 'WCAG Semantics, Keyboard Focus, Responsive Layout',
    description: 'Improve screen reader clarity, touch targets, color contrast, and reduced-motion ergonomics across devices.',
    link: 'https://github.com/GoldRay19/kshemOS/issues?q=is%3Aissue+is%3Aopen+label%3AUI',
  },
];

/**
 * Look up contribution category metadata by id, falling back to 'all'.
 */
export function getContributionCategory(categoryId = 'all') {
  return CONTRIBUTION_CATEGORY_MAP[categoryId] || CONTRIBUTION_CATEGORIES[0];
}

/**
 * Filter contributors by type, contribution category, legacy domain, and text query.
 */
export function filterContributors(
  contributors,
  { type = 'all', category = 'all', domain = 'All Domains', query = '' } = {}
) {
  return contributors.filter((c) => {
    // Filter by type (core vs community)
    if (type !== 'all' && c.type !== type) {
      return false;
    }

    // Filter by contribution category
    if (category && category !== 'all') {
      if (!Array.isArray(c.categories) || !c.categories.includes(category)) {
        return false;
      }
    }

    // Filter by domain
    if (domain !== 'All Domains' && c.domain !== domain) {
      return false;
    }

    // Filter by query (name, github handle, area, bio, highlights, categories)
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const matchesName = c.name.toLowerCase().includes(q);
      const matchesGithub = c.github.toLowerCase().includes(q);
      const matchesArea = c.area.toLowerCase().includes(q);
      const matchesBio = (c.bio || '').toLowerCase().includes(q);
      const matchesHighlights = (c.highlights || []).some((h) => h.toLowerCase().includes(q));
      const matchesCategories = (c.categories || []).some((catId) => {
        const label = CONTRIBUTION_CATEGORY_MAP[catId]?.label || catId;
        return catId.toLowerCase().includes(q) || label.toLowerCase().includes(q);
      });

      if (
        !matchesName &&
        !matchesGithub &&
        !matchesArea &&
        !matchesBio &&
        !matchesHighlights &&
        !matchesCategories
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get GitHub avatar URL for a contributor
 */
export function getContributorAvatarUrl(githubHandle, size = 120) {
  if (!githubHandle) return null;
  return `https://github.com/${githubHandle}.png?size=${size}`;
}

