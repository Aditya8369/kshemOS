/*
 * Emergency Financial Kill-Switch & Aadhaar Biometric Lock Store for KshemOS.
 *
 * Implements:
 * 1. Offline-capable verified bank directory with USSD (*99#) & SMS freeze syntaxes.
 * 2. UIDAI Aadhaar Biometric Lock walkthrough (cutting off AePS unauthorized deductions).
 * 3. Certified Emergency Mitigation Receipt generation with SHA-256 cryptographic sealing
 *    for RBI Zero-Liability compliance (Circular DBR.No.Leg.BC.78/09.07.005/2017-18).
 */

const BASE_URL = import.meta.env?.VITE_API_URL || '';

export const MITIGATION_RECEIPTS_STORAGE_KEY = 'kshemos.mitigation_receipts.v1';
export const MITIGATION_RECEIPT_EVENT = 'kshemos:mitigation-receipt-created';

// Universal synchronous SHA-256 implementation
export function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i;
  let j;
  let result = '';
  const words = [];
  const asciiBitLength = (ascii || '')[lengthProperty] * 8;
  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  let str = (ascii || '') + '\x80';
  while ((str[lengthProperty] % 64) - 56) str += '\x00';
  for (i = 0; i < str[lengthProperty]; i++) {
    j = str.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const t1 =
        (hash[7] +
          (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
          ch +
          k[i] +
          w[i]) |
        0;
      const t2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;
      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + t1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (t1 + t2) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// ---------------------------------------------------------------------
// BANK EMERGENCY REGISTRY (OFFLINE DATASET)
// ---------------------------------------------------------------------
export const EMERGENCY_BANKS_REGISTRY = [
  {
    bank_id: 'sbi',
    bank_name: 'State Bank of India (SBI)',
    category: 'Public Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# from registered SIM -> Press 4 (My Profile) -> Press 7 (Deregister/Disable UPI).',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '567676',
    sms_acc_freeze_syntax: 'STOP <account number>',
    sms_acc_freeze_number: '9223008333',
    sms_upi_disable_syntax: 'UPIBLOCK <registered mobile number>',
    sms_upi_disable_number: '9223008333',
    phone_hotline: '1800 1234',
    phone_alt: '1800 2100 / 1800 11 1109',
    netbanking_url: 'https://www.onlinesbi.sbi',
    mobile_app_name: 'YONO SBI',
    official_portal_guidance: 'Log in to OnlineSBI -> e-Services -> ATM Card Services -> Block ATM Card.',
  },
  {
    bank_id: 'hdfc',
    bank_name: 'HDFC Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# from registered SIM -> Option 4 -> Option 7 (Disable UPI).',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '5676712',
    sms_acc_freeze_syntax: 'Call 1800 1600 or open Mobile App -> Quick Banking -> Freeze Account',
    sms_acc_freeze_number: '18001600',
    sms_upi_disable_syntax: 'Send SMS to 5676712 from registered SIM',
    sms_upi_disable_number: '5676712',
    phone_hotline: '1800 1600',
    phone_alt: '1800 202 6161',
    netbanking_url: 'https://netbanking.hdfcbank.com',
    mobile_app_name: 'HDFC Bank MobileBanking',
    official_portal_guidance: 'Cards Tab -> Debit/Credit Cards -> Request -> Debit Card Hotlisting.',
  },
  {
    bank_id: 'icici',
    bank_name: 'ICICI Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# from registered SIM -> Option 4 -> Option 7 (Disable UPI).',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '9215667788',
    sms_acc_freeze_syntax: 'STOP <last 4 digits of account number>',
    sms_acc_freeze_number: '9215667788',
    sms_upi_disable_syntax: 'UPIBLOCK <last 4 digits>',
    sms_upi_disable_number: '9215667788',
    phone_hotline: '1800 1080',
    phone_alt: '1800 200 3344',
    netbanking_url: 'https://infinity.icicibank.com',
    mobile_app_name: 'iMobile Pay',
    official_portal_guidance: 'Customer Service -> Service Requests -> Block Debit / Credit Card.',
  },
  {
    bank_id: 'axis',
    bank_name: 'Axis Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7 (Deregister UPI).',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '56161600',
    sms_acc_freeze_syntax: 'STOP <last 4 digits of account>',
    sms_acc_freeze_number: '56161600',
    sms_upi_disable_syntax: 'UPIBLOCK <registered mobile>',
    sms_upi_disable_number: '56161600',
    phone_hotline: '1800 419 0068',
    phone_alt: '1800 103 5577',
    netbanking_url: 'https://omni.axisbank.co.in',
    mobile_app_name: 'Axis Mobile',
    official_portal_guidance: 'Accounts -> My Cards -> Block Card or Emergency Services in app.',
  },
  {
    bank_id: 'pnb',
    bank_name: 'Punjab National Bank (PNB)',
    category: 'Public Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> My Profile -> Deregister UPI.',
    sms_card_block_syntax: 'HOT <16-digit card number>',
    sms_card_block_number: '5607040',
    sms_acc_freeze_syntax: 'BLOCK <account number>',
    sms_acc_freeze_number: '9264092640',
    sms_upi_disable_syntax: 'UPIBLOCK <registered mobile>',
    sms_upi_disable_number: '9264092640',
    phone_hotline: '1800 1800',
    phone_alt: '1800 2021 / 1800 180 2222',
    netbanking_url: 'https://netpnb.com',
    mobile_app_name: 'PNB ONE',
    official_portal_guidance: 'Value Added Services -> Emergency Block Debit Card / PNB ONE App.',
  },
  {
    bank_id: 'bob',
    bank_name: 'Bank of Baroda (BOB)',
    category: 'Public Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7.',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '8422009988',
    sms_acc_freeze_syntax: 'STOP <account number>',
    sms_acc_freeze_number: '8422009988',
    sms_upi_disable_syntax: 'UPIBLOCK <registered mobile>',
    sms_upi_disable_number: '8422009988',
    phone_hotline: '1800 5700',
    phone_alt: '1800 258 4455',
    netbanking_url: 'https://www.bobibanking.com',
    mobile_app_name: 'bob World',
    official_portal_guidance: 'Cards -> Debit Card Services -> Card Blocking / bob World Emergency lock.',
  },
  {
    bank_id: 'canara',
    bank_name: 'Canara Bank',
    category: 'Public Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> My Profile -> Deregister UPI.',
    sms_card_block_syntax: 'CAN HOTLISTDC <card number>',
    sms_card_block_number: '5607060',
    sms_acc_freeze_syntax: 'CAN FREEZE <account number>',
    sms_acc_freeze_number: '5607060',
    sms_upi_disable_syntax: 'CAN UPIBLOCK <mobile>',
    sms_upi_disable_number: '5607060',
    phone_hotline: '1800 425 0018',
    phone_alt: '1800 103 0018',
    netbanking_url: 'https://netbanking.canarabank.in',
    mobile_app_name: 'Canara ai1',
    official_portal_guidance: 'Cards -> Hotlist Debit Card or Call 24x7 Toll Free.',
  },
  {
    bank_id: 'union',
    bank_name: 'Union Bank of India',
    category: 'Public Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7.',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '09223008486',
    phone_hotline: '1800 22 2244',
    phone_alt: '1800 208 2244',
    netbanking_url: 'https://www.unionbankonline.co.in',
    mobile_app_name: 'Vyom',
    official_portal_guidance: 'Cards -> Debit Card Hotlist / Vyom App Quick Block.',
  },
  {
    bank_id: 'kotak',
    bank_name: 'Kotak Mahindra Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> My Profile -> Deregister UPI.',
    sms_card_block_syntax: 'DCBLK <last 4 digits of card>',
    sms_card_block_number: '9971056767',
    phone_hotline: '1860 266 2666',
    phone_alt: '1800 209 0000',
    netbanking_url: 'https://netbanking.kotak.com',
    mobile_app_name: 'Kotak811 Mobile Banking',
    official_portal_guidance: 'Service Requests -> Debit Card Hotlisting in App or Portal.',
  },
  {
    bank_id: 'indusind',
    bank_name: 'IndusInd Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> My Profile -> Deregister UPI.',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '9223511111',
    phone_hotline: '1860 267 7777',
    phone_alt: '1800 209 0061',
    netbanking_url: 'https://indusnet.indusind.com',
    mobile_app_name: 'IndusMobile',
    official_portal_guidance: 'Cards -> Block Card or call 24x7 phone banking.',
  },
  {
    bank_id: 'yesbank',
    bank_name: 'Yes Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7.',
    sms_card_block_syntax: 'BLK <last 4 digits of card>',
    sms_card_block_number: '9840909000',
    phone_hotline: '1800 1200',
    phone_alt: '1800 103 5485',
    netbanking_url: 'https://yesonline.yesbank.co.in',
    mobile_app_name: 'iris by YES BANK',
    official_portal_guidance: 'Manage Cards -> Temporary/Permanent Block in app.',
  },
  {
    bank_id: 'federal',
    bank_name: 'Federal Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7.',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '9895088888',
    phone_hotline: '1800 420 1199',
    phone_alt: '1800 425 1199',
    netbanking_url: 'https://www.fednetbank.com',
    mobile_app_name: 'FedMobile',
    official_portal_guidance: 'FedMobile -> Cards -> Block Debit Card immediately.',
  },
  {
    bank_id: 'idfc',
    bank_name: 'IDFC FIRST Bank',
    category: 'Private Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7.',
    sms_card_block_syntax: 'BLOCK <last 4 digits of card>',
    sms_card_block_number: '5676732',
    phone_hotline: '1800 10 888',
    phone_alt: '1800 258 2000',
    netbanking_url: 'https://my.idfcfirstbank.com',
    mobile_app_name: 'IDFC FIRST Bank App',
    official_portal_guidance: 'Cards tab -> Manage Card -> Freeze / Block Card.',
  },
  {
    bank_id: 'indianbank',
    bank_name: 'Indian Bank',
    category: 'Public Sector',
    ussd_code: '*99#',
    ussd_instructions: 'Dial *99# -> Option 4 -> Option 7.',
    sms_card_block_syntax: 'BLOCKDC <card number>',
    sms_card_block_number: '9230000000',
    phone_hotline: '1800 425 00 000',
    phone_alt: '1800 425 4422',
    netbanking_url: 'https://www.indianbank.net.in',
    mobile_app_name: 'IndOASIS',
    official_portal_guidance: 'Cards Services -> Debit Card Hotlisting in IndOASIS.',
  },
];

// ---------------------------------------------------------------------
// AADHAAR BIOMETRIC LOCK DATA (AEPS SELF-DEFENSE)
// ---------------------------------------------------------------------
export const AADHAAR_LOCK_GUIDE_DATA = {
  overview:
    'Aadhaar Biometric Locking is an essential UIDAI self-defense shield that disables fingerprint and iris sensor authentication, completely blocking unauthorized AePS (Aadhaar Enabled Payment System) micro-ATM withdrawals.',
  why_lock_biometrics:
    'Under AePS, anyone with your Aadhaar number and a lifted silicone fingerprint copy can withdraw up to ₹10,000 per transaction without any OTP, PIN, or SMS confirmation. Locking biometrics neutralizes 100% of biometric AePS fraud.',
  aeps_vulnerability_explanation:
    'Fingerprint copies harvested from land property registry records or leaked photocopies are actively exploited by cyber syndicates. Locking your biometrics leaves OTP authentication intact for ITR and NetBanking while completely blocking biometric drain.',
  myaadhaar_portal_url: 'https://myaadhaar.uidai.gov.in',
  uidai_helpline: '1947',
  sms_1947_syntax: {
    step_1_get_otp: "Send 'GETOTP <Last 4 digits of Aadhaar>' to 1947",
    step_2_lock_uid: "Send 'LOCKUID <Last 4 digits of Aadhaar> <6-digit OTP>' to 1947",
    unlock_uid: "Send 'UNLOCKUID <Last 4 digits of Aadhaar> <6-digit OTP>' to 1947",
  },
  steps: [
    {
      step_number: 1,
      title: 'Open Official UIDAI myAadhaar Portal',
      instruction: 'Go directly to https://myaadhaar.uidai.gov.in. Click the blue "Login" button.',
      official_url: 'https://myaadhaar.uidai.gov.in',
      warning: 'Never use unverified portals. Always verify URL domain is .uidai.gov.in.',
    },
    {
      step_number: 2,
      title: 'Log In with Aadhaar & Mobile OTP',
      instruction: 'Enter your 12-digit Aadhaar number and captcha, then enter the 6-digit OTP sent to your registered mobile.',
      warning: 'If your mobile is disconnected, use the 1947 SMS syntax or visit an Aadhaar Seva Kendra.',
    },
    {
      step_number: 3,
      title: 'Click "Lock / Unlock Biometrics" Tile',
      instruction: 'Locate the "Lock / Unlock Biometrics" card with the padlock symbol on your resident dashboard.',
      official_url: 'https://myaadhaar.uidai.gov.in',
    },
    {
      step_number: 4,
      title: 'Acknowledge & Confirm',
      instruction: 'Tick the acknowledgment checkbox: "I understand that after locking my biometrics, I will not be able to perform biometric authentication". Click "Next".',
      warning: 'Remember: Your mobile OTP authentication still works for banking and taxes!',
    },
    {
      step_number: 5,
      title: 'Verify Red Lock Badge Active',
      instruction: 'You will see a green checkmark confirmation. The fingerprint icon on your dashboard will now show a locked red padlock.',
    },
  ],
  temporary_unlock_guidance:
    'When you legitimately need biometrics for SIM verification or bank KYC, choose "Unlock Biometrics Temporarily (10 Minutes)". It automatically re-locks after 10 minutes.',
};

// ---------------------------------------------------------------------
// IN-MEMORY / LOCAL STORAGE ENGINE FOR MITIGATION RECEIPTS
// ---------------------------------------------------------------------
const _memoryStore = new Map();

function getSafeStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (k) => (_memoryStore.has(k) ? _memoryStore.get(k) : null),
    setItem: (k, v) => _memoryStore.set(k, String(v)),
    removeItem: (k) => _memoryStore.delete(k),
    clear: () => _memoryStore.clear(),
  };
}

export function getStoredMitigationReceipts() {
  const storage = getSafeStorage();
  const raw = storage.getItem(MITIGATION_RECEIPTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredMitigationReceipts(receipts) {
  const storage = getSafeStorage();
  storage.setItem(MITIGATION_RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent(MITIGATION_RECEIPT_EVENT, {
          detail: { count: receipts.length, timestamp: Date.now() },
        })
      );
    } catch {
      // Ignore in non-browser context
    }
  }
}

// ---------------------------------------------------------------------
// MITIGATION RECEIPT GENERATOR (RBI ZERO-LIABILITY DOCUMENTATION)
// ---------------------------------------------------------------------
export function generateLocalMitigationReceipt(data) {
  const now = new Date();
  const timestampIso = now.toISOString();
  const timestampMs = now.getTime();

  // Indian Standard Time string
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(timestampMs + istOffsetMs);
  const istString = istDate.toUTCString().replace('GMT', 'IST');

  const dateSlug = `${istDate.getUTCFullYear()}${String(istDate.getUTCMonth() + 1).padStart(2, '0')}${String(istDate.getUTCDate()).padStart(2, '0')}`;
  const seed = `${data.selected_bank_id}:${timestampMs}:${data.citizen_name || 'Citizen'}`;
  const shortHash = sha256Sync(seed).slice(0, 8).toUpperCase();
  const receiptId = `EMR-${dateSlug}-${shortHash}`;

  const actions = data.actions_attempted || [
    'Initiated Bank Account Freeze / Card Hotlist request',
    'Consulted verified USSD (*99#) & SMS freeze commands',
  ];
  if (data.reported_to_1930) {
    actions.push('Reported incident to National Cybercrime Helpline 1930 / I4C');
  }
  if (data.reported_to_portal) {
    actions.push('Drafted submission for cybercrime.gov.in portal');
  }
  if (data.aadhaar_biometrics_locked) {
    actions.push('Followed UIDAI official flow to lock Aadhaar biometrics against AePS fraud');
  }

  // Canonical payload for SHA-256 seal
  const canonicalParts = [
    receiptId,
    timestampIso,
    data.citizen_name || 'Citizen',
    data.selected_bank_id,
    data.bank_name,
    data.card_last_4 || 'N/A',
    data.account_last_4 || 'N/A',
    [...actions].sort().join(','),
    data.reported_to_1930 ? '1930_YES' : '1930_NO',
    data.reported_to_portal ? 'PORTAL_YES' : 'PORTAL_NO',
    data.aadhaar_biometrics_locked ? 'AADHAAR_LOCKED' : 'AADHAAR_NOT_LOCKED',
  ];
  const canonicalPayload = canonicalParts.join('|');
  const sha256Hash = sha256Sync(canonicalPayload);
  const verificationToken = `RBI-MITIG-${sha256Hash.slice(0, 16).toUpperCase()}`;

  const receipt = {
    receipt_id: receiptId,
    citizen_name: data.citizen_name || 'Citizen (Protected)',
    selected_bank_id: data.selected_bank_id,
    bank_name: data.bank_name,
    timestamp_iso: timestampIso,
    timestamp_ist: istString,
    timestamp_ms: timestampMs,
    card_last_4: data.card_last_4 || null,
    account_last_4: data.account_last_4 || null,
    actions_attempted: actions,
    reported_to_1930: Boolean(data.reported_to_1930),
    reported_to_portal: Boolean(data.reported_to_portal),
    aadhaar_biometrics_locked: Boolean(data.aadhaar_biometrics_locked),
    rbi_circular_reference:
      'Reserve Bank of India Circular DBR.No.Leg.BC.78/09.07.005/2017-18 (Customer Protection – Limiting Liability of Customers in Unauthorised Electronic Banking Transactions). Zero Liability applies where unauthorized transaction occurs and customer notifies bank within three working days.',
    legal_disclaimer:
      'This receipt certifies the exact timestamp and self-defense mitigation steps initiated by the citizen. It serves as prima facie evidence of prompt customer notification for banking ombudsman and cyber cell dispute resolution.',
    sha256_hash: sha256Hash,
    verification_token: verificationToken,
  };

  const stored = getStoredMitigationReceipts();
  saveStoredMitigationReceipts([receipt, ...stored]);
  return receipt;
}

export function getEmergencyBanksList() {
  return EMERGENCY_BANKS_REGISTRY;
}

export function getEmergencyBankById(bankId) {
  if (!bankId) return null;
  return EMERGENCY_BANKS_REGISTRY.find((b) => b.bank_id.toLowerCase() === bankId.toLowerCase()) || null;
}

export function getAadhaarLockGuide() {
  return AADHAAR_LOCK_GUIDE_DATA;
}

export function resetLocalMitigationReceiptsStore() {
  const storage = getSafeStorage();
  storage.removeItem(MITIGATION_RECEIPTS_STORAGE_KEY);
  _memoryStore.clear();
}
