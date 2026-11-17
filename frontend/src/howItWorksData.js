/**
 * Process Walkthrough Data for How It Works.
 * Sequences user actions and behind-the-scenes system processing
 * with accessible numbering, responsive connectors, and clear non-guarantee advisories.
 */

export const WALKTHROUGH_STEPS = [
  {
    stepNumber: 1,
    stepLabel: '01',
    actorType: 'user_action',
    actorLabel: 'Citizen Action',
    actorBadge: 'What You Do',
    title: 'Input Message or Share Call Details',
    subtitle: 'Provide the suspicious text snippet or caller claims',
    shortDescription: 'Paste what you remember from the call, SMS, or WhatsApp notice. You can also specify who the caller claimed to be (e.g. CBI, Police, Customs, Courier, or Bank Officer).',
    systemOrUserDetail: 'Zero sensitive data needed: never enter real passwords, NetBanking PINs, or full debit card numbers.',
    exampleSnippet: 'Input: "This is CBI officer Rao. A parcel with MDMA has been seized with your Aadhaar. Stay on video call and transfer verification fee."',
    keyPoints: [
      'Takes 30 seconds: works with rough transcript notes, SMS text, or call recollections.',
      'No account registration or personal credentials required to analyze.',
      'All analysis runs with strict privacy: zero audio recording and zero secret storage.'
    ]
  },
  {
    stepNumber: 2,
    stepLabel: '02',
    actorType: 'system_processing',
    actorLabel: 'KshemOS Engine',
    actorBadge: 'Behind the Scenes',
    title: 'Multi-Signal Pattern Extraction',
    subtitle: 'Automated scanning for psychological coercion and known signatures',
    shortDescription: 'The engine scans the text across four key coercion pillars: Authority Impersonation, Urgency Triggers, Secrecy Orders, and Financial Demands.',
    systemOrUserDetail: 'Extracts syndicate script markers, fake statutory sections (e.g., Section 102 CrPC abuse), and compares language with genuine institutional notices.',
    exampleSnippet: 'Signals Detected: [Authority: CBI Officer (High)] + [Urgency: Non-bailable arrest (Critical)] + [Payment: Transfer verification fee (High)]',
    keyPoints: [
      'Scans for coercive tactics: threats of arrest, orders not to disconnect, and remote app downloads.',
      'Compares against verified benign samples to avoid false alarms on normal business calls.',
      'Cross-checks extracted accounts or UPI IDs against known mule syndicate networks.'
    ]
  },
  {
    stepNumber: 3,
    stepLabel: '03',
    actorType: 'system_processing',
    actorLabel: 'KshemOS Engine',
    actorBadge: 'Behind the Scenes',
    title: 'Calibrated Risk Evaluation & Confidence',
    subtitle: 'Advisory scoring with explicit uncertainty handling',
    shortDescription: 'Individual signal weights are combined through a calibrated risk model into an advisory risk level: Low, Medium, High, or Critical, accompanied by contributing factors.',
    systemOrUserDetail: 'Transparent advisory score: if input is sparse or ambiguous, the model marks the case as Inconclusive rather than guessing.',
    exampleSnippet: 'Assessment: Risk Score 88/100 (Critical) | Confidence: 94% | 4 Contributing Coercion Signals',
    keyPoints: [
      'Clear risk bands: Low (routine communication), Medium (caution advised), High, or Critical.',
      'Inconclusive safeguard: ambiguous or sparse utterances return inconclusive rather than false alarms.',
      'Transparent explanations: shows exactly which phrases caused the elevated risk score.'
    ]
  },
  {
    stepNumber: 4,
    stepLabel: '04',
    actorType: 'user_action',
    actorLabel: 'Citizen Action',
    actorBadge: 'What You Do',
    title: 'Review Guidance & Take Safe Action',
    subtitle: 'Actionable steps to pause, independently verify, and protect funds',
    shortDescription: 'Receive concrete safety steps: immediate guidance to hang up, official toll-free verification numbers, emergency bank blocking hotlines, and a pre-formatted draft FIR statement.',
    systemOrUserDetail: 'Empowers you with verified facts so you never make panic decisions or transfer funds on impulse.',
    exampleSnippet: 'Safe Action: Disconnect immediately. Do not transfer funds. Report to National Cyber Helpline 1930.',
    keyPoints: [
      'Actionable safety prompts: immediate phone disconnection, official switchboard verification numbers.',
      'Zero-click FIR generation: draft formal complaint ready for the National Cybercrime Portal (cybercrime.gov.in).',
      'Optional evidence sealing: deposit screenshots directly into the tamper-proof Evidence Vault.'
    ]
  }
];

export const SYSTEM_DISCLAIMERS = {
  title: 'Advisory Guidance, Not an Automated Legal Verdict',
  summary: 'KshemOS provides calibrated advisory assessments based on language patterns, known scam scripts, and pressure signals. It is an educational and decision-support tool, not an absolute guarantee.',
  points: [
    'Automated assessments indicate risk patterns; they do not constitute formal judicial verdicts or criminal proof.',
    'Sparse, brief, or greeting-only messages will return an Inconclusive result because evidence is insufficient.',
    'Scammers continuously evolve their language; always exercise personal vigilance and verify unexpected calls independently.',
    'Official banking and law enforcement procedures must be followed for actual fund disputes and FIR registrations.'
  ]
};

export const COMPARISON_TRACKS = [
  {
    pillar: 'Input & Initiation',
    userAction: 'You provide the call transcript, SMS, or caller claim.',
    systemProcessing: 'Engine normalizes text, strips accidental PII, and identifies language/code-switching.'
  },
  {
    pillar: 'Pattern Analysis',
    userAction: 'You observe which words or demands made you feel pressured or uncomfortable.',
    systemProcessing: 'Engine triangulates authority claims, urgency markers, and payment coercion algorithms.'
  },
  {
    pillar: 'Scoring & Assessment',
    userAction: 'You review the risk band, contributing factors, and confidence level.',
    systemProcessing: 'Engine calibrates multi-signal scores and marks ambiguous evidence as inconclusive.'
  },
  {
    pillar: 'Response & Containment',
    userAction: 'You hang up, dial official bank numbers, or file an emergency 1930 complaint.',
    systemProcessing: 'Engine generates a pre-formatted draft FIR and provides verified institutional directory links.'
  }
];

/**
 * Filter walkthrough steps by actor type: 'all', 'user_action', 'system_processing'.
 */
export function filterWalkthroughSteps(steps = WALKTHROUGH_STEPS, actorFilter = 'all') {
  if (actorFilter === 'all') return steps;
  return steps.filter((s) => s.actorType === actorFilter);
}

