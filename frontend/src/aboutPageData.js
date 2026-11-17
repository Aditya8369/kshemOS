/**
 * Structured content and metadata for the KshemOS About Page.
 * Organised into:
 *  - Mission & Genesis
 *  - Intended Users & Stakeholders
 *  - Core Implemented Capabilities
 *  - Prototype Scope & Limitations
 *  - Project, Contributor, and Repository Links
 */

export const PROJECT_MISSION = {
  headline: 'Stopping Fraud Before the Money Moves',
  originStory: 'KshemOS was conceived to combat the explosive rise of organized cyber syndicates exploiting psychological coercion—such as fictitious "Digital Arrests", customs drug parcel extortion, and lightning-fast mule account fund routing. By the time victims realize they have been deceived, funds have often passed through 4 or 5 intermediary bank layers.',
  corePurpose: 'Our mission is to construct an open, explainable digital public safety layer. KshemOS equips everyday citizens with real-time intuition training and sanity checks, while arming cyber desk responders with graph triage, evidence-grounded copilot recommendations, and tamper-proof custodial chains.'
};

export const INTENDED_USERS = [
  {
    id: 'citizens',
    role: 'Everyday Citizens & Families',
    summary: 'Individuals facing urgent phone calls, SMS notices, or payment requests who need an immediate, pressure-free sanity check without exposing private credentials.',
    keyBenefits: [
      'Zero-credential assessment with zero mandatory account sign-up.',
      'Actionable advice: when to disconnect, verify, or contact local authorities.',
      'One-tap draft FIR statement generation.'
    ]
  },
  {
    id: 'seniors',
    role: 'Seniors & Vulnerable Targets',
    summary: 'Elderly citizens and retirees frequently singled out by high-pressure extortion callers threatening bank account locks or arrest warrants.',
    keyBenefits: [
      'Senior Protection Mode with large readable typography and audio readouts.',
      'Family safety notifications and verification pause protocols.',
      'Guidance on locking Aadhaar biometrics against unauthorized access.'
    ]
  },
  {
    id: 'officers',
    role: 'Cyber Desk Officers & Responders',
    summary: 'Law enforcement investigators and cyber precinct teams receiving citizen reports, managing evidence, and tracking interconnected mule accounts.',
    keyBenefits: [
      'Officer Copilot citing approved SOPs and statutory provisions.',
      'Immutable evidence vault with Section 65B court certificate exports.',
      'Mule account freeze recommendations under Section 102 CrPC.'
    ]
  },
  {
    id: 'advocates',
    role: 'Digital Literacy Advocates & Educators',
    summary: 'Trainers, NGO workers, and community leaders conducting cybersecurity awareness workshops in schools, banks, and senior centers.',
    keyBenefits: [
      'Side-by-side comparison tools contrasting scam scripts with legitimate notices.',
      'Transparent rule library demonstrating how language patterns trigger risk scores.',
      'Interactive sandbox simulations for classroom practice.'
    ]
  }
];

export const CORE_CAPABILITIES = [
  {
    id: 'risk-model',
    title: 'Calibrated Multi-Signal Risk Model',
    category: 'Detection & Analysis',
    description: 'Evaluates transcripts across 4 psychological coercion pillars (Authority, Urgency, Secrecy, Payments) combining calibrated feature weights with a rule engine fallback.',
    implementedStatus: 'Implemented & Benchmark-Verified',
    targetView: 'portal'
  },
  {
    id: 'live-call-safety',
    title: 'Consent-Based Live Call Safety',
    category: 'Real-Time Protection',
    description: 'Opt-in microphone transcription stream that analyzes incremental speech risk during active calls, provides immediate safety alerts, and enforces zero secret recording.',
    implementedStatus: 'Implemented & Tested',
    targetView: 'live-call-safety'
  },
  {
    id: 'multilingual-asr',
    title: 'Indic Speech Recognition & Correction',
    category: 'Accessibility & Localization',
    description: 'Speech-to-text adapter supporting Hindi and regional languages with code-switching detection, word-level confidence flags, and citizen correction workflows.',
    implementedStatus: 'Implemented & Tested',
    targetView: 'multilingual-speech'
  },
  {
    id: 'fraud-graph',
    title: 'Fraud Graph Engine & Mule Harvesting',
    category: 'Syndicate Intelligence',
    description: 'Triangulates bank accounts, IFSC codes, and UPI VPAs across reported incidents to identify syndicate clusters and recommend proactive freezes under Section 102 CrPC.',
    implementedStatus: 'Implemented & Tested',
    targetView: 'officer'
  },
  {
    id: 'evidence-vault',
    title: 'Cryptographic Evidence Vault & Upload Links',
    category: 'Forensics & Legal Chain of Custody',
    description: 'SHA-256 hash-chained custodial ledgers, RFC 3161 timestamps, legal hold controls, Section 65B certificates, and single-purpose citizen upload links with token expiry.',
    implementedStatus: 'Implemented & Tested',
    targetView: 'evidence'
  },
  {
    id: 'spatial-sirens',
    title: 'Spatial Intelligence & Emergency Broadcasts',
    category: 'Tactical Coordination',
    description: 'Hotspot clustering and migration tracking paired with multi-channel geo-targeted sirens requiring commander dual-authorization before dispatch.',
    implementedStatus: 'Implemented & Tested',
    targetView: 'advisory'
  }
];

export const PROTOTYPE_LIMITATIONS = [
  {
    id: 'decision-support',
    title: 'Advisory Decision Support, Not Judicial Proof',
    detail: 'KshemOS assessments are designed to assist human judgment and encourage independent verification. Automated risk scores do not constitute formal judicial verdicts or criminal proof.'
  },
  {
    id: 'telephony-environment',
    title: 'Simulated Telecom Interconnects',
    detail: 'Current honeypot telephony and live-call audio streams operate via software adapters and browser audio APIs for prototype demonstration. Commercial deployment requires telecom carrier interconnect agreements.'
  },
  {
    id: 'inconclusive-safety',
    title: 'Inconclusive Result Policy',
    detail: 'When text or speech input is too brief or ambiguous (e.g. short greetings), KshemOS returns an Inconclusive score rather than guessing or causing false alarm.'
  },
  {
    id: 'privacy-non-custodial',
    title: 'Non-Custodial Architecture',
    detail: 'KshemOS stores no unhashed citizen credentials, audio recordings, or payment card numbers. All evaluation data remains strictly scoped to citizen-initiated sessions.'
  }
];

export const PROJECT_LINKS = {
  sourceRepo: 'https://github.com/GoldRay19/kshemOS',
  issues: 'https://github.com/GoldRay19/kshemOS/issues',
  pulls: 'https://github.com/GoldRay19/kshemOS/pulls',
  license: 'https://github.com/GoldRay19/kshemOS/blob/main/LICENSE',
  contributing: 'https://github.com/GoldRay19/kshemOS/blob/main/CONTRIBUTING.md'
};

