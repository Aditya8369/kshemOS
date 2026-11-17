/**
 * Educational resources dataset for KshemOS Digital Awareness.
 * Supports grouping by Topic and by Target Audience with consistent card schemas:
 * title, summary, topic, audience, format, readTime, actionLabel, targetView, isAvailable.
 */

export const TOPICS = [
  'All Topics',
  'Digital Arrest & Impersonation',
  'Banking & UPI Safety',
  'Phishing & Malicious APKs',
  'Identity & Credentials',
  'Employment & Investments'
];

export const AUDIENCES = [
  'All Audiences',
  'Seniors & Elders',
  'Students & Job Seekers',
  'Online Shoppers & Merchants',
  'Families & Guardians',
  'General Citizens'
];

export const AWARENESS_RESOURCES = [
  {
    id: 'res-digital-arrest-playbook',
    title: 'Digital Arrest Defense Playbook',
    summary: 'A step-by-step citizen guide dissecting video-call extortion, fake courtrooms, forged CBI warrants, and how to safely disconnect without panic.',
    topic: 'Digital Arrest & Impersonation',
    audience: 'Seniors & Elders',
    format: 'Field Guide',
    readTime: '4 min read',
    actionType: 'internal_view',
    targetView: 'scam-examples',
    actionLabel: 'Compare Scam Scripts',
    isAvailable: true,
    keyTakeaways: [
      'Indian courts and police never conduct trials or arrests via Skype/WhatsApp.',
      'Judicial warrants are delivered in person by local police, never as WhatsApp PDFs.',
      'Disconnecting a fraudulent video call carries zero legal penalty.'
    ]
  },
  {
    id: 'res-senior-shield',
    title: 'Senior Citizen Cyber Defense Protocol',
    summary: 'Tailored safety measures for retirees and elderly citizens protecting pension balances, managing caregiver device access, and screening high-pressure callers.',
    topic: 'Digital Arrest & Impersonation',
    audience: 'Seniors & Elders',
    format: 'Interactive Tool',
    readTime: 'Interactive Tool',
    actionType: 'internal_view',
    targetView: 'senior-protection-mode',
    actionLabel: 'Launch Senior Shield',
    isAvailable: true,
    keyTakeaways: [
      'Enable family notification rules for unexpected large fund transfers.',
      'Lock Aadhaar biometrics via mAadhaar when not attending government verification.',
      'Set up trusted emergency contacts before answering unknown international calls.'
    ]
  },
  {
    id: 'res-upi-reverse-qr',
    title: 'UPI PIN & Reverse QR Protection Guide',
    summary: 'Master the immutable mechanics of UPI payments: why entering your PIN always debits funds, and how scammers exploit marketplace refunds.',
    topic: 'Banking & UPI Safety',
    audience: 'Online Shoppers & Merchants',
    format: 'Interactive Tool',
    readTime: 'Interactive Tool',
    actionType: 'internal_view',
    targetView: 'upi-fraud-shield',
    actionLabel: 'Open UPI Fraud Shield',
    isAvailable: true,
    keyTakeaways: [
      'Receiving money never requires entering a UPI PIN or scanning a QR code.',
      'Scammers send "Collect Requests" masquerading as refund acknowledgements.',
      'Set conservative daily transfer limits on your primary UPI handle.'
    ]
  },
  {
    id: 'res-student-job-radar',
    title: 'Work-From-Home & Task Scam Radar',
    summary: 'Expose fraudulent part-time job offers paying ₹5,000/day for YouTube likes, rating hotels, or clicking crypto tasks that trap college students in advance fee spirals.',
    topic: 'Employment & Investments',
    audience: 'Students & Job Seekers',
    format: 'Interactive Tool',
    readTime: 'Interactive Tool',
    actionType: 'internal_view',
    targetView: 'job-scam-radar',
    actionLabel: 'Check Job Legitimacy',
    isAvailable: true,
    keyTakeaways: [
      'Legitimate corporate employers never demand registration fees or security deposits.',
      'Prepaid task groups on Telegram use staged testimonials to engineer FOMO.',
      'Never allow your student bank account to be used as a third-party fund routing mule.'
    ]
  },
  {
    id: 'res-investment-pump-scan',
    title: 'High-Yield Investment & Stock Tip Analyzer',
    summary: 'Learn how organized syndicates use WhatsApp stock recommendation groups, fake SEBI certifications, and rigged trading apps to steal life savings.',
    topic: 'Employment & Investments',
    audience: 'General Citizens',
    format: 'Interactive Tool',
    readTime: 'Interactive Tool',
    actionType: 'internal_view',
    targetView: 'invest-scan',
    actionLabel: 'Scan Investment Offer',
    isAvailable: true,
    keyTakeaways: [
      'Guaranteed daily returns of 20%–40% are mathematically impossible and illegal.',
      'Always verify broker registration codes directly on sebi.gov.in.',
      'Refuse demands to deposit funds into individual savings accounts.'
    ]
  },
  {
    id: 'res-apk-malware-inspection',
    title: 'Malicious APK & Phishing Inspection Kit',
    summary: 'How to recognize weaponized Android APK packages sent over WhatsApp (e.g. "PM_Kisan_Bonus.apk", "SBI_KYC.apk") that intercept your SMS OTPs.',
    topic: 'Phishing & Malicious APKs',
    audience: 'General Citizens',
    format: 'Defense Checklist',
    readTime: '5 min read',
    actionType: 'internal_view',
    targetView: 'link-shield',
    actionLabel: 'Inspect Suspicious Links',
    isAvailable: true,
    keyTakeaways: [
      'Banks never distribute security patches or KYC tools as WhatsApp files.',
      'Malicious APKs request SMS and Accessibility permissions to forward OTPs.',
      'Only download applications through the official Google Play Store.'
    ]
  },
  {
    id: 'res-identity-exposure-audit',
    title: 'Digital Identity & Aadhaar Exposure Audit',
    summary: 'Actionable steps to discover where your PAN, Aadhaar, and phone number are exposed online, and how to activate UIDAI biometric lock defenses.',
    topic: 'Identity & Credentials',
    audience: 'Families & Guardians',
    format: 'Interactive Tool',
    readTime: 'Interactive Tool',
    actionType: 'internal_view',
    targetView: 'id-shield',
    actionLabel: 'Launch ID Shield',
    isAvailable: true,
    keyTakeaways: [
      'Mask your Aadhaar number (use VID or Masked Aadhaar) on public forms.',
      'Check active telecom SIM cards registered against your identity on Sanchar Saathi.',
      'Use passkeys or hardware 2FA for your primary account recovery email.'
    ]
  },
  {
    id: 'res-family-cyber-guard',
    title: 'Family Cyber Safety & Shared Device Rules',
    summary: 'Practical family protocols to protect shared tablets, home Wi-Fi networks, and minor children from social engineering and remote screen sharing scams.',
    topic: 'Identity & Credentials',
    audience: 'Families & Guardians',
    format: 'Defense Checklist',
    readTime: '4 min read',
    actionType: 'internal_view',
    targetView: 'family-cyber-safety',
    actionLabel: 'Open Family Safety Guide',
    isAvailable: true,
    keyTakeaways: [
      'Disable remote desktop applications (AnyDesk, TeamViewer) when not in use.',
      'Separate children gaming accounts from parent payment methods.',
      'Establish a family "safe word" to verify unexpected emergency distress calls.'
    ]
  },
  {
    id: 'res-e-commerce-delivery-fraud',
    title: 'E-Commerce Delivery & Parcel Scam Guide',
    summary: 'Recognize fake courier address update messages demanding ₹5 charges that drain credit cards via unauthorized automated recurring subscriptions.',
    topic: 'Banking & UPI Safety',
    audience: 'Online Shoppers & Merchants',
    format: 'Field Guide',
    readTime: '3 min read',
    actionType: 'internal_view',
    targetView: 'courier-guard',
    actionLabel: 'Launch Courier Guard',
    isAvailable: true,
    keyTakeaways: [
      'Logistics partners do not cancel deliveries over unpaid ₹5 re-delivery fees.',
      'Verify tracking numbers directly on courier mobile apps, not SMS links.',
      'Never input full card details or CVV for nominal token verification payments.'
    ]
  },
  {
    id: 'res-corporate-whistleblower-vault',
    title: 'Whistleblower & Syndicate Evidence Vault',
    summary: 'Specialized toolkit for gathering forensic-grade evidence on organized call-center operations, mule networks, and corporate financial breaches.',
    topic: 'Digital Arrest & Impersonation',
    audience: 'General Citizens',
    format: 'Evidence Vault',
    readTime: 'In Review',
    actionType: 'internal_view',
    targetView: 'evidence',
    actionLabel: 'Access Evidence Vault',
    isAvailable: false, // Explicitly marked unavailable to demonstrate unavailable resource feedback
    keyTakeaways: [
      'Requires verified law enforcement liaison token for chain-of-custody sealing.',
      'Includes RFC 3161 digital timestamping and Section 65B certificate generation.',
      'Public access currently scheduled for subsequent phase release.'
    ]
  }
];

/**
 * Filter educational resources by topic, audience, and search query.
 */
export function filterAwarenessResources(
  resources = AWARENESS_RESOURCES,
  { topic = 'All Topics', audience = 'All Audiences', searchQuery = '' } = {}
) {
  const q = (searchQuery || '').trim().toLowerCase();

  return resources.filter((item) => {
    // Topic filter
    if (topic !== 'All Topics' && item.topic !== topic) {
      return false;
    }

    // Audience filter
    if (audience !== 'All Audiences' && item.audience !== audience) {
      return false;
    }

    // Search query match
    if (q) {
      const match = [
        item.title,
        item.summary,
        item.topic,
        item.audience,
        item.format,
        ...(item.keyTakeaways || [])
      ].some((field) => String(field || '').toLowerCase().includes(q));

      if (!match) return false;
    }

    return true;
  });
}

/**
 * Group filtered resources by either Topic or Audience.
 */
export function groupResourcesBy(resources, groupBy = 'topic') {
  const groups = {};

  for (const item of resources) {
    const key = groupBy === 'audience' ? item.audience : item.topic;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return groups;
}

