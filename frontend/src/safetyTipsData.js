/**
 * Comprehensive dataset for KshemOS Safety Tips.
 * Designed for rapid scanning under stress and small-screen accessibility.
 * Organised into:
 *  - Immediate Emergency Actions ("If under active threat right now")
 *  - Categorised guidance: Calls, Messages, Payments, Accounts, Reporting
 *  - Trusted Reporting Directory & Bank Fraud Hotlines
 */

export const EMERGENCY_ACTIONS = [
  {
    id: 'disconnect-now',
    stepNumber: '01',
    urgency: 'critical',
    title: 'Disconnect the Call Immediately',
    actionVerb: 'HANG UP',
    description: 'Terminate the call right now. Indian courts, police, and CBI have zero legal authority to arrest anyone over Skype, WhatsApp, or phone calls.',
    actionGuidance: 'Do not ask for permission to hang up. Scammers use psychological momentum—breaking the connection breaks their control.',
    timeframe: 'Do this right now (0 min)',
    badgeText: 'Immediate Action'
  },
  {
    id: 'never-enter-pin',
    stepNumber: '02',
    urgency: 'critical',
    title: 'Never Enter Your UPI PIN to Receive Funds',
    actionVerb: 'DO NOT ENTER PIN',
    description: 'Entering your UPI PIN or scanning a QR code ALWAYS deducts money from your account. Receiving payments never requires a PIN or password.',
    actionGuidance: 'If someone sends a QR code or payment request claiming it is an "escrow refund" or "verification fee", decline it immediately.',
    timeframe: 'Critical Rule',
    badgeText: 'Zero-Exception Rule'
  },
  {
    id: 'block-and-freeze',
    stepNumber: '03',
    urgency: 'high',
    title: 'Freeze Bank Cards & NetBanking if Details Shared',
    actionVerb: 'FREEZE ACCOUNTS',
    description: 'If you revealed your card number, CVV, NetBanking password, or installed remote apps (AnyDesk/QuickSupport), block your account instantly.',
    actionGuidance: 'Open your bank app to turn off international/online transactions, or call your bank’s 24/7 emergency debit card blocking number.',
    timeframe: 'Within 5 minutes',
    badgeText: 'Containment'
  },
  {
    id: 'call-1930',
    stepNumber: '04',
    urgency: 'critical',
    title: 'Dial 1930 Within the Golden Hour',
    actionVerb: 'CALL 1930',
    description: 'If funds were debited, dial 1930 immediately. National cyber police can freeze the fraudster’s mule account before money is withdrawn at an ATM.',
    actionGuidance: 'Have your 12-digit transaction UTR number, your bank name, and the beneficiary account or UPI ID ready when you dial.',
    timeframe: 'Golden Hour (within 2-3 hrs)',
    badgeText: 'Fund Recovery'
  },
  {
    id: 'preserve-evidence',
    stepNumber: '05',
    urgency: 'high',
    title: 'Preserve Screenshots & Digital Evidence',
    actionVerb: 'SAVE SCREENSHOTS',
    description: 'Take full-screen screenshots of fraudulent chats, phone numbers, payment receipts, and fake official seals before scammers delete them.',
    actionGuidance: 'Do not delete chat threads or clear call logs. Digital timestamps and UTR numbers are required for Section 65B court evidence.',
    timeframe: 'Before closing apps',
    badgeText: 'Evidence Vault'
  }
];

export const SAFETY_CATEGORIES = {
  calls: {
    id: 'calls',
    name: 'Calls & Phone Safety',
    shortName: 'Calls',
    iconName: 'PhoneCall',
    summary: 'Defend against digital arrest extortion, fake customs parcel IVRs, and police impersonation.',
    immediateActions: [
      {
        rule: 'Hang up immediately on any caller claiming "digital arrest" or ordering you to stay on a video call.',
        why: 'Indian law has no concept of digital arrest or trials conducted over WhatsApp/Skype.'
      },
      {
        rule: 'Never confirm or state your Aadhaar number, PAN, or date of birth to an inbound caller.',
        why: 'Scammers use partial leaked data to sound legitimate and trick you into revealing the rest.'
      }
    ],
    preventionTips: [
      'Remember that genuine CBI, Customs, and Police officers never accept fines or bail over UPI or bank transfers.',
      'Caller ID numbers can be spoofed over VoIP; an incoming call displaying your local police station number may be completely fake.',
      'If an automated IVR claims an illegal courier package has been intercepted in your name, disconnect and verify with the carrier directly.',
      'Enable spam call filtering on your mobile operating system and report suspicious numbers to DoT Chakshu.'
    ]
  },
  messages: {
    id: 'messages',
    name: 'Messages & Links Safety',
    shortName: 'Messages',
    iconName: 'MessageSquare',
    summary: 'Detect phishing SMS, APK malware downloads, electricity disconnection notices, and fake lottery alerts.',
    immediateActions: [
      {
        rule: 'Never click shortened links (e.g., bit.ly, tinyurl) in text messages claiming your account or electricity will be blocked.',
        why: 'Scammers engineer fake login screens that harvest your NetBanking passwords and OTPs in real time.'
      },
      {
        rule: 'Never install .apk files received via WhatsApp, Telegram, or SMS.',
        why: 'Malicious APKs install keyloggers and SMS forwarders that intercept bank OTPs automatically.'
      }
    ],
    preventionTips: [
      'Inspect the SMS sender header: legitimate Indian banks and power utilities use verified alphabetic headers (e.g. VM-SBIINB, AD-HDFCBK), never personal 10-digit mobile numbers.',
      'Verify URLs carefully: check the true top-level domain (e.g., `onlinesbi.sbi` vs fake `sbi-kyc-update-portal.com`).',
      'Ignore unsolicited WhatsApp job offers paying ₹3,000–₹8,000 daily for liking YouTube videos or Google reviews; these lead to prepaid task scams.',
      'Forward cyber fraud SMS messages to 1909 (TRAI DND) or report them on the Chakshu portal at sancharsaathi.gov.in.'
    ]
  },
  payments: {
    id: 'payments',
    name: 'Payments & UPI Safety',
    shortName: 'Payments',
    iconName: 'CreditCard',
    summary: 'Protect against reverse QR scams, fake escrow accounts, and unauthorized screen sharing transfers.',
    immediateActions: [
      {
        rule: 'Never enter your UPI PIN to receive money or collect a refund.',
        why: 'Entering your UPI PIN is exclusively used for authorizing debits from your bank account.'
      },
      {
        rule: 'Never share your mobile screen via AnyDesk, TeamViewer, or Google Meet during any payment or banking activity.',
        why: 'Screen sharing tools permit scammers to view your incoming SMS OTPs and recorded PIN numbers.'
      }
    ],
    preventionTips: [
      'Check the beneficiary recipient name displayed in your UPI app before completing any transaction to ensure it matches the official merchant.',
      'Never send funds to personal savings accounts claiming to be "government clearance escrow" or "reserve verification accounts".',
      'Configure lower daily UPI transaction limits (e.g. ₹5,000 to ₹10,000) on your bank app to limit potential exposure.',
      'Be cautious on peer-to-peer marketplaces (OLX, Facebook Marketplace); scammers frequently send fake "payment pending" QR codes.'
    ]
  },
  accounts: {
    id: 'accounts',
    name: 'Accounts & Credentials Safety',
    shortName: 'Accounts',
    iconName: 'Lock',
    summary: 'Harden passwords, secure NetBanking, prevent SIM swap hijacking, and configure multi-factor auth.',
    immediateActions: [
      {
        rule: 'Never share an OTP with anyone under any circumstances, even if they claim to be a bank branch manager.',
        why: 'Bank systems never require employees to ask for one-time passwords from customers.'
      },
      {
        rule: 'If your mobile handset suddenly loses network reception without reason, immediately contact your telecom operator.',
        why: 'Unexpected loss of service may indicate an active SIM swap attack to intercept your banking OTPs.'
      }
    ],
    preventionTips: [
      'Enable two-factor authentication (2FA) using authenticator apps (TOTP) instead of SMS whenever supported.',
      'Use strong, unique passwords for each banking and email account; never reuse personal passwords across shopping sites.',
      'Lock your Aadhaar biometrics via the official mAadhaar application or UIDAI portal when not in active use.',
      'Set up biometric or PIN locks on your mobile SIM card (SIM PIN) to prevent misuse if your handset is stolen.'
    ]
  },
  reporting: {
    id: 'reporting',
    name: 'Reporting & Emergency Recovery',
    shortName: 'Reporting',
    iconName: 'FileText',
    summary: 'National Helpline 1930, cybercrime.gov.in, RBI Zero Liability, and evidence preservation guidelines.',
    immediateActions: [
      {
        rule: 'Dial 1930 immediately if money has been deducted to invoke inter-bank account freeze.',
        why: 'The Indian Citizen Financial Cyber Fraud Reporting System operates 24/7 across participating banks to halt fund routing.'
      },
      {
        rule: 'File an official complaint on cybercrime.gov.in to secure a formal National Acknowledgement Number.',
        why: 'This formal acknowledgement is legally required by your bank to process fraud refunds under RBI guidelines.'
      }
    ],
    preventionTips: [
      'Notify your bank branch in writing within 3 days of unauthorized debit to qualify for maximum protection under RBI Zero Liability circular.',
      'Keep copies of the 12-digit transaction UTR number, beneficiary account details, and full call logs.',
      'Upload your evidence bundle to the KshemOS Evidence Vault to maintain an unbroken cryptographic chain of custody.',
      'Report harassing or threatening callers on the Department of Telecommunications Chakshu portal to initiate handset blocking.'
    ]
  }
};

export const TRUSTED_REPORTING_DIRECTORY = [
  {
    id: 'helpline-1930',
    title: 'National Cyber Crime Helpline (1930)',
    organization: 'Ministry of Home Affairs & Indian Cybercrime Coordination Centre (I4C)',
    contact: '1930',
    isPhone: true,
    timing: '24 Hours / 7 Days a week',
    badge: 'Primary Emergency Hotline',
    description: 'Operates the Citizen Financial Cyber Fraud Reporting System (CFCFRMS). Bridges law enforcement and 50+ public and private banks to freeze scammer mule accounts within the Golden Hour.',
    actionLabel: 'Call 1930 Now',
    actionHref: 'tel:1930'
  },
  {
    id: 'portal-cybercrime',
    title: 'National Cybercrime Reporting Portal',
    organization: 'Government of India',
    contact: 'cybercrime.gov.in',
    isUrl: true,
    timing: 'Online 24/7 Portal',
    badge: 'Official FIR Portal',
    description: 'Official national portal to lodge complaints for financial fraud, digital arrest extortion, identity theft, and cyber crimes against women/children. Issues formal Acknowledgement Numbers.',
    actionLabel: 'Visit cybercrime.gov.in',
    actionHref: 'https://cybercrime.gov.in'
  },
  {
    id: 'chakshu-sancharsaathi',
    title: 'Chakshu & Sanchar Saathi Portal',
    organization: 'Department of Telecommunications (DoT)',
    contact: 'sancharsaathi.gov.in',
    isUrl: true,
    timing: 'Online 24/7 Portal',
    badge: 'Telecom Fraud Desk',
    description: 'Citizens can report suspected fraudulent callers, fake SMS headers, and WhatsApp extortion numbers for pan-India telecom disconnection, and block lost or stolen mobile handsets (CEIR).',
    actionLabel: 'Report on Chakshu',
    actionHref: 'https://sancharsaathi.gov.in'
  },
  {
    id: 'rbi-sachet',
    title: 'RBI Sachet Portal',
    organization: 'Reserve Bank of India',
    contact: 'sachet.rbi.org.in',
    isUrl: true,
    timing: 'Regulatory Portal',
    badge: 'Illegal Deposits & Apps',
    description: 'Report unregistered financial entities, illegal lending loan apps, fraudulent investment schemes, and unauthorized high-yield trading platforms directly to RBI regulators.',
    actionLabel: 'Visit RBI Sachet',
    actionHref: 'https://sachet.rbi.org.in'
  },
  {
    id: 'police-112',
    title: 'National Emergency Response System (112)',
    organization: 'Ministry of Home Affairs',
    contact: '112',
    isPhone: true,
    timing: '24/7 All-India Emergency',
    badge: 'Physical Police Dispatch',
    description: 'For immediate in-person law enforcement intervention, physical harassment, threats to life, or ongoing syndicate physical coercion.',
    actionLabel: 'Call 112',
    actionHref: 'tel:112'
  }
];

export const MAJOR_BANKS_HOTLINES = [
  { bank: 'State Bank of India (SBI)', phone: '1800 11 1109 / 1800 1234', blockSms: 'SMS BLOCK <last 4 digits> to 567676' },
  { bank: 'HDFC Bank', phone: '1800 1600 / 1800 202 6161', blockSms: 'Call 1800 1600 immediately' },
  { bank: 'ICICI Bank', phone: '1800 1080', blockSms: 'SMS BLOCK <last 4 digits> to 9215667788' },
  { bank: 'Axis Bank', phone: '1800 419 0068 / 1800 103 5577', blockSms: 'Call 1800 419 0068 immediately' },
  { bank: 'Punjab National Bank (PNB)', phone: '1800 1800 / 1800 2021', blockSms: 'SMS HOTLIST <card number> to 5607040' },
  { bank: 'Bank of Baroda (BOB)', phone: '1800 5700 / 1800 258 4455', blockSms: 'Call 1800 5700 immediately' }
];

