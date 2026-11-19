const THREAT_TERMS = [
  'cbi', 'police', 'customs', 'income tax', 'income-tax', 'trai', 'cyber cell', 'cybercell', 'court', 'official', 'government',
  'agency', 'fbi', 'interpol', 'enforcement', 'recovery officer', 'recovery team', 'legal team', 'cyber crime', 'investigation officer',
  'deputy commissioner', 'income-tax department', 'fraud investigation', 'special task force', 'crime branch', 'anti-fraud cell',
  'financial crime', 'economic offences', 'directorate', 'revenue department', 'central bureau', 'monitoring cell', 'surveillance team',
  'law enforcement', 'enforcement directorate', 'judicial officer', 'prosecutor', 'public prosecutor', 'tax authority', 'revenue authority',
];

// Evidence / entity extraction patterns (rule-based, no backend/ML)
const OTP_PATTERNS = [
  /\botp\b/gi,
  /one\s*time\s*password/gi,
  /verification\s*code/gi,
  /\bott\b/gi,
  /share\s+(your\s+)?otp/gi,
];

const AADHAAR_PATTERNS = [
  /\baadhaar\b/gi,
  /\badhar\b/gi,
  /\buid\b/gi,
  /\b12\s*-?\s*digit\s*\b/gi,
  /\b\d{4}\s*-?\s*\d{4}\s*-?\s*\d{4}\b/gi,
];

const UPI_PATTERNS = [
  /\bupi\b/gi,
  /upi\s*id/gi,
  /\bpaytm\b/gi,
  /\bphonepe\b/gi,
  /gpay|google\s*pay/gi,
];

const BANK_PATTERNS = [
  /\bbank\b/gi,
  /bank\s*account/gi,
  /account\s*number/gi,
  /ifsc/gi,
];

const CARD_PATTERNS = [
  /credit\s*card/gi,
  /debit\s*card/gi,
];

const AMOUNT_PATTERNS = [
  /(?:rs\.?|inr\.?|₹)\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/gi,
  /\bamount\b\s*[:=]?\s*(?:rs\.?|inr\.?|₹)?\s*\d+/gi,
  /\bfine\b\s*(?:rs\.?|inr\.?|₹)?\s*\d+/gi,
  /\bpenalty\b\s*(?:rs\.?|inr\.?|₹)?\s*\d+/gi,
  /\bsettlement\b\s*(?:rs\.?|inr\.?|₹)?\s*\d+/gi,
];

const ORG_PATTERNS = [
  // keep as regexes to catch minor variations
  /(cbi|central bureau of investigation)/gi,
  /(police|state police|local police)/gi,
  /(customs|customs department)/gi,
  /(income tax|income-tax)/gi,
  /(trai)/gi,
  /(cyber\s*cell|cybercell)/gi,
  /(revenue department)/gi,
  /(tax authority)/gi,
  /(court|court summons|summons)/gi,
];

const DATE_PATTERNS = [
  /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}[,\s]+\d{2,4}\b/gi,
];


const URGENCY_TERMS = [
  'immediately', 'now', 'today', 'right away', 'urgent', 'within minutes', 'do not disconnect', 'disconnect', 'hurry', 'quickly', 'asap',
  'without delay', 'today itself', 'before the call ends', 'in the next few minutes', 'within 10 minutes', 'this hour', 'at once',
  'without wasting time', 'right this moment', 'before the deadline', 'today before midnight', 'do it now', 'immediate action', 'within 5 minutes',
  'tonight', 'this instant', 'no time to waste', 'very urgent', 'emergency', 'critical', 'last chance', 'final warning', 'seconds', 'minutes',
];

const SECRECY_TERMS = [
  'confidential', 'secret', 'private', 'do not tell anyone', 'do not share', 'keep it confidential', 'digital arrest', 'under investigation',
  'warrant', 'under surveillance', 'sealed', 'off the record', 'only between us', 'not for anyone else', 'keep this between us',
  'strictly private', 'highly sensitive', 'do not speak to anyone', 'do not inform your family', 'do not discuss with anyone', 'silent operation',
  'classified', 'top secret', 'no one else should know', 'not to be disclosed', 'for your eyes only', 'internal matter', 'sensitive case',
];

const PAYMENT_TERMS = [
  'otp', 'one time password', 'aadhaar', 'bank details', 'transfer', 'payment', 'verification amount', 'pay', 'money', 'upi', 'cash', 'send',
  'refund', 'deposit', 'wallet', 'account top-up', 'fee', 'fine', 'settlement', 'transaction', 'credit', 'rebate', 'cash app', 'amazon gift card',
  'crypto', 'bitcoin', 'gift card', 'voucher', 'prepaid card', 'mobile recharge', 'recharge', 'rental', 'advance payment', 'security deposit',
];

const PHRASE_TERMS = [
  'digital arrest', 'do not disconnect', 'verification amount', 'parcel with your aadhaar', 'warrant will be issued', 'account will be frozen',
  'bank account will be frozen', 'under digital arrest', 'share your otp', 'seized your aadhaar', 'immediate action', 'arrest warrant',
  'court order', 'asset freeze', 'suspension', 'the call is being recorded', 'your phone is compromised', 'your account will be blocked',
  'your mobile will be suspended', 'legal notice will be served', 'you are being monitored', 'your sim will be blocked', 'your kyc will fail',
  'your aadhaar is linked to a crime', 'you are under surveillance', 'your case is being reviewed', 'share the code', 'verify the code',
  'pay the penalty', 'pay the fine', 'release the parcel', 'avoid arrest', 'avoid prosecution', 'avoid legal action', 'block your account',
  'freeze your account', 'caution notice', 'compliance check', 'criminal case', 'pending warrant', 'court summons', 'bail order', 'following legal procedure',
  'official verification', 'security clearance', 'case file has been opened', 'you have violated rules', 'non-compliance', 'immediate compliance', 'urgent compliance',
];

const GOVERNMENT_CLAIMS = ['cbi', 'police', 'customs', 'income tax', 'trai', 'court', 'cyber cell', 'cybercrime', 'crime branch', 'deputy commissioner', 'revenue department'];

const LIBRARY_AUTHORITIES = ['cbi', 'police', 'customs', 'income tax', 'cyber cell', 'court', 'crime branch', 'revenue department', 'financial crime unit', 'enforcement team', 'anti-fraud cell', 'revenue officer', 'tax authority', 'public prosecutor'];
const LIBRARY_TARGETS = ['aadhaar', 'otp', 'bank account', 'sim card', 'mobile number', 'parcel', 'passport', 'wallet', 'upi id', 'device', 'kyc', 'payment', 'transaction', 'account statement', 'credit card', 'debit card'];
const LIBRARY_ACTIONS = ['asked', 'requested', 'insisted', 'warned', 'claimed', 'reported', 'explained', 'mentioned', 'repeated', 'stated', 'confirmed', 'urged'];
const LIBRARY_MEDIUMS = ['call', 'text message', 'WhatsApp message', 'missed call alert', 'SMS', 'email', 'screenshot', 'app notification', 'voice message', 'document image', 'notification'];
const LIBRARY_ISSUES = ['blocked', 'frozen', 'suspended', 'sealed', 'flagged', 'monitored', 'investigated', 'scrutinized', 'arrested', 'reviewed', 'under digital arrest', 'linked to fraud', 'marked suspicious'];
const LIBRARY_ENDINGS = ['to avoid legal trouble', 'to protect your account', 'to prevent arrest', 'to avoid a court notice', 'to complete verification', 'to release the parcel', 'to keep the account active', 'to avoid a notice', 'to stop a fine', 'to prevent a suspension'];

function generateScenarioLibrary(size = 2200) {
  const library = [];

  for (let index = 0; index < size; index += 1) {
    const authority = LIBRARY_AUTHORITIES[index % LIBRARY_AUTHORITIES.length];
    const target = LIBRARY_TARGETS[(index * 3) % LIBRARY_TARGETS.length];
    const action = LIBRARY_ACTIONS[(index * 5 + 1) % LIBRARY_ACTIONS.length];
    const medium = LIBRARY_MEDIUMS[(index * 7 + 2) % LIBRARY_MEDIUMS.length];
    const urgency = URGENCY_TERMS[(index * 11 + 3) % URGENCY_TERMS.length];
    const issue = LIBRARY_ISSUES[(index * 13 + 4) % LIBRARY_ISSUES.length];
    const ending = LIBRARY_ENDINGS[(index * 17 + 5) % LIBRARY_ENDINGS.length];
    const payment = PAYMENT_TERMS[(index * 19 + 6) % PAYMENT_TERMS.length];
    const phrase = `A ${medium} claimed ${authority} ${action} that your ${target} is ${issue}, and you must ${payment} ${urgency} ${ending}.`;
    library.push({ phrase, authority, target, medium, action, urgency, issue, ending, payment });
  }

  return library;
}

const SCENARIO_LIBRARY = generateScenarioLibrary();

function normalize(text) {
  return (text || '').toLowerCase();
}

function containsPhrase(text, phrase) {
  return normalize(text).includes(phrase.toLowerCase());
}

function _extractMatches(regexes, text) {
  const matches = [];
  for (const re of regexes) {
    // reset lastIndex for global regex reuse
    re.lastIndex = 0;
    const found = text.match(re);
    if (found && found.length) {
      for (const m of found) matches.push(m);
    }
  }
  // de-dupe (case-insensitive)
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const key = normalize(m);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

function extractEntities(text) {
  const raw = text || '';

  const otp = _extractMatches(OTP_PATTERNS, raw).slice(0, 10);
  const aadhaar = _extractMatches(AADHAAR_PATTERNS, raw).slice(0, 10);
  const upi = _extractMatches(UPI_PATTERNS, raw).slice(0, 10);
  const bank = _extractMatches(BANK_PATTERNS, raw).slice(0, 10);
  const cards = _extractMatches(CARD_PATTERNS, raw).slice(0, 10);
  const amounts = _extractMatches(AMOUNT_PATTERNS, raw).slice(0, 12);
  const orgs = _extractMatches(ORG_PATTERNS, raw).slice(0, 10);
  const dates = _extractMatches(DATE_PATTERNS, raw).slice(0, 10);

  return {
    otp,
    aadhaar,
    upi,
    bank,
    cards,
    amounts,
    orgs,
    dates,
  };
}

function buildTimelineEvents(text) {
  // Very rough ordering based on presence of tactic buckets.
  const lowered = normalize(text);

  const has = (phr) => lowered.includes(phr);
  const events = [];

  const threatSignals = [
    'arrest',
    'warrant',
    'court',
    'legal notice',
    'income tax',
    'customs',
    'cyber cell',
    'seized',
    'illegal',
  ];

  const urgencySignals = [
    'immediately',
    'now',
    'urgent',
    'within minutes',
    'do not disconnect',
    'do not hang up',
    'asap',
    'last chance',
  ];

  const secrecySignals = [
    'do not tell',
    'confidential',
    'keep this between us',
    'only between us',
    'not for anyone else',
    'silent operation',
    'do not inform',
  ];

  const paymentSignals = [
    'pay',
    'transfer',
    'upi',
    'wallet',
    'otp',
    'verification amount',
    'fine',
    'settlement',
    'fee',
    'transaction',
  ];

  const addEvent = (type, label) => {
    if (!events.some((e) => e.type === type)) {
      events.push({ type, label });
    }
  };

  if (threatSignals.some((s) => has(s))) addEvent('threat', 'Legal threat / authority claim');
  if (urgencySignals.some((s) => has(s))) addEvent('urgency', 'Time pressure / escalation');
  if (secrecySignals.some((s) => has(s))) addEvent('secrecy', 'Isolation / secrecy request');
  if (paymentSignals.some((s) => has(s))) addEvent('payment', 'Payment / OTP / transfer demand');

  if (!events.length) {
    return [{ type: 'benign', label: 'No clear tactic sequence detected' }];
  }

  // Normalize order
  const order = ['threat', 'urgency', 'secrecy', 'payment', 'benign'];
  return events.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

function buildEvidenceSpans(text) {
  const raw = text || '';
  const spans = [];

  const BUCKETS = [
    { key: 'threat', keywords: THREAT_TERMS },
    { key: 'urgency', keywords: URGENCY_TERMS },
    { key: 'secrecy', keywords: SECRECY_TERMS },
    { key: 'payment', keywords: PAYMENT_TERMS },
  ];

  const getSnippet = (index, len) => {
    const start = Math.max(0, index - 45);
    const end = Math.min(raw.length, index + len + 45);
    const snippet = raw.slice(start, end).replace(/\s+/g, ' ').trim();
    return snippet;
  };

  for (const bucket of BUCKETS) {
    for (const kw of bucket.keywords) {
      const idx = raw.toLowerCase().indexOf(kw.toLowerCase());
      if (idx !== -1) {
        const snippet = getSnippet(idx, kw.length);
        spans.push({ category: bucket.key, keyword: kw, snippet });
      }
    }
  }

  // Also include phrase-based pattern strength signals
  for (const phrase of PHRASE_TERMS) {
    const idx = raw.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      const snippet = getSnippet(idx, phrase.length);
      spans.push({ category: 'pattern', keyword: phrase, snippet });
    }
  }

  // De-dupe and cap
  const seen = new Set();
  const out = [];
  for (const s of spans) {
    const k = `${s.category}:${normalize(s.keyword)}:${normalize(s.snippet)}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out.slice(0, 30);
}

function detectLanguageSignals(text) {

  const lowered = normalize(text);
  const matches = [];

  for (const phrase of PHRASE_TERMS) {
    if (containsPhrase(lowered, phrase)) {
      matches.push(phrase);
    }
  }

  return matches;
}

function scorePatternStrength(text) {
  const lowered = normalize(text);
  const signalScore = [
    ['digital arrest', 16],
    ['do not disconnect', 10],
    ['verification amount', 10],
    ['share your otp', 10],
    ['account will be frozen', 10],
    ['court order', 9],
    ['arrest warrant', 9],
    ['asset freeze', 9],
    ['pay the fine', 8],
    ['avoid arrest', 8],
    ['urgent compliance', 7],
    ['immediate action', 6],
  ].reduce((total, [phrase, weight]) => (containsPhrase(lowered, phrase) ? total + weight : total), 0);

  return signalScore;
}

function detectScamTypes(text) {
  const lowered = normalize(text);
  const types = [];

  if (/customs|parcel|courier|delivery|shipment|tracking number|consignment/i.test(lowered)) {
    types.push('courier/parcel scam');
  }
  if (/cbi|police|court|order|arrest warrant|legal notice|revenue|income tax|enforcement|tax authority/i.test(lowered)) {
    types.push('authority impersonation');
  }
  if (/otp|one time password|verification code|code/i.test(lowered)) {
    types.push('OTP capture');
  }
  if (/refund|refund amount|payment to release|advance payment|settlement|fine|penalty/i.test(lowered)) {
    types.push('payment/refund scam');
  }
  if (/loan|emi|interest|credit|quick loan|advance loan/i.test(lowered)) {
    types.push('loan scam');
  }
  if (/wallet|upi|bank account|account will be frozen|transfer|transaction/i.test(lowered)) {
    types.push('bank payment scam');
  }
  if (/investment|bitcoin|crypto|gift card|prize|lottery/i.test(lowered)) {
    types.push('investment/prize scam');
  }
  if (/support|tech support|device compromised|computer|software update|security update/i.test(lowered)) {
    types.push('tech support scam');
  }
  if (!types.length) {
    types.push('general scam pattern');
  }

  return [...new Set(types)];
}

// Rule-based plugins (no backend/ML)
import { runPlugins } from './scamRulePlugins.js';



function detectScamMotive(text) {
  const lowered = normalize(text);

  if (/otp|one time password|verification code|code/i.test(lowered)) {
    return 'Capture authentication details';
  }
  if (/pay|transfer|wallet|upi|account will be frozen|fine|penalty|settlement/i.test(lowered)) {
    return 'Force a payment or transfer';
  }
  if (/do not tell anyone|secret|private|keep this between us|not for anyone else/i.test(lowered)) {
    return 'Prevent the victim from verifying the claim';
  }
  if (/arrest|warrant|court|legal notice|investigation|under digital arrest/i.test(lowered)) {
    return 'Create fear and urgency through legal threat';
  }
  if (/parcel|customs|delivery|shipment|tracking number/i.test(lowered)) {
    return 'Exploit delivery or customs fear';
  }
  return 'Gather sensitive details or demand quick action';
}


export function analyzeScamTranscript(transcript, callerClaimsToBe) {
  const text = transcript || '';

  const threatHits = THREAT_TERMS.filter((term) => containsPhrase(text, term));
  const urgencyHits = URGENCY_TERMS.filter((term) => containsPhrase(text, term));
  const secrecyHits = SECRECY_TERMS.filter((term) => containsPhrase(text, term));
  const paymentHits = PAYMENT_TERMS.filter((term) => containsPhrase(text, term));
  const languageSignals = detectLanguageSignals(text);
  const patternStrength = scorePatternStrength(text);

  const entities = extractEntities(text);
  const timeline = buildTimelineEvents(text);
  const evidenceSpans = buildEvidenceSpans(text);
  const plugins = runPlugins(text);


  const bucketScores = {
    threat: Math.min(threatHits.length, 6) * 8,
    urgency: Math.min(urgencyHits.length, 5) * 6,
    secrecy: Math.min(secrecyHits.length, 4) * 7,
    payment: Math.min(paymentHits.length, 5) * 5,
    phrases: Math.min(languageSignals.length, 6) * 6,
    pattern_strength: patternStrength,
  };

  let score = 0;
  score += bucketScores.threat;
  score += bucketScores.urgency;
  score += bucketScores.secrecy;
  score += bucketScores.payment;
  score += bucketScores.phrases;
  score += bucketScores.pattern_strength;

  const strongSignalBonus = languageSignals.some((signal) => [
    'digital arrest',
    'do not disconnect',
    'verification amount',
    'share your otp',
    'account will be frozen',
    'court order',
    'arrest warrant',
  ].includes(signal))
    ? 12
    : 0;

  const authorityPaymentBonus = threatHits.length && paymentHits.length ? 10 : 0;
  const urgencySecrecyBonus = urgencyHits.length && secrecyHits.length ? 8 : 0;

  const callerGovernmentBonus = callerClaimsToBe
    ? GOVERNMENT_CLAIMS.some((term) => normalize(callerClaimsToBe).includes(term))
      ? 10
      : 0
    : 0;

  score += strongSignalBonus + authorityPaymentBonus + urgencySecrecyBonus + callerGovernmentBonus;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskBand = 'low';
  let recommendation = 'No strong scam indicators detected in this transcript.';

  if (score >= 75) {
    riskBand = 'critical';
    recommendation = 'Do not transfer money or share OTP/Aadhaar details. End the call and verify independently through an official channel.';
  } else if (score >= 48) {
    riskBand = 'high';
    recommendation = 'Treat this call with suspicion. Verify through an official channel before acting or sharing information.';
  } else if (score >= 22) {
    riskBand = 'medium';
    recommendation = 'Some risk indicators are present. Ask for written confirmation before proceeding.';
  }

  const scamTypes = [...new Set([...detectScamTypes(text), ...(plugins?.pluginCategories || [])])];
  const motive = detectScamMotive(text);


  const matchedPatterns = [];
  if (threatHits.length) {
    matchedPatterns.push(`Threat/authority language: ${threatHits.slice(0, 6).join(', ')}`);
  }
  if (urgencyHits.length) {
    matchedPatterns.push(`Urgency pressure: ${urgencyHits.slice(0, 6).join(', ')}`);
  }
  if (secrecyHits.length) {
    matchedPatterns.push(`Secrecy/isolation request: ${secrecyHits.slice(0, 4).join(', ')}`);
  }
  if (paymentHits.length) {
    matchedPatterns.push(`Payment/OTP request: ${paymentHits.slice(0, 6).join(', ')}`);
  }
  if (languageSignals.length) {
    matchedPatterns.push(`Known scam patterns: ${languageSignals.slice(0, 6).join(', ')}`);
  }

  return {
    risk_score: score,
    risk_band: riskBand,
    scam_types: scamTypes,
    motive,
    matched_patterns: matchedPatterns,
    matched_known_scam_similarity: 0,
    recommendation,
    explanation: `Frontend rule-based analysis detected ${threatHits.length} authority terms, ${urgencyHits.length} urgency terms, ${secrecyHits.length} secrecy terms, ${paymentHits.length} payment/OTP terms, and ${languageSignals.length} known scam phrases.`,

    // New rule-based outputs for richer scam analysis.
    entities,
    timeline,
    evidence_spans: evidenceSpans,
    plugin_signals: plugins,


    evidence: {
      threat_hits: threatHits.slice(0, 6),
      urgency_hits: urgencyHits.slice(0, 6),
      secrecy_hits: secrecyHits.slice(0, 4),
      payment_hits: paymentHits.slice(0, 6),
      pattern_strength: patternStrength,
      score_breakdown: {
        ...bucketScores,
        bonuses: {
          strong_signal_bonus: strongSignalBonus,
          authority_payment_bonus: authorityPaymentBonus,
          urgency_secrecy_bonus: urgencySecrecyBonus,
          caller_government_bonus: callerGovernmentBonus,
        },
      },
    },
  };
}


export function scanCurrencyImageLocally(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Please upload an image first.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            verdict: 'inconclusive',
            confidence: 0.5,
            reasons: ['The browser could not inspect the image directly.'],
          });
          return;
        }

        const width = Math.max(1, img.naturalWidth || img.width || 0);
        const height = Math.max(1, img.naturalHeight || img.height || 0);
        const scale = 220 / Math.max(width, height);
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let luminanceSum = 0;
        let luminanceVariance = 0;
        const samples = Math.min(data.length / 4, 4000);

        for (let i = 0; i < samples; i += 1) {
          const offset = i * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          luminanceSum += luminance;
        }

        const mean = luminanceSum / Math.max(samples, 1);
        let varianceSum = 0;
        for (let i = 0; i < samples; i += 1) {
          const offset = i * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          const delta = luminance - mean;
          varianceSum += delta * delta;
        }
        luminanceVariance = varianceSum / Math.max(samples, 1);

        const resolutionScore = Math.min(1, (width * height) / 1200000);
        const blurScore = Math.min(1, luminanceVariance * 3);
        const brightnessScore = Math.max(0, 1 - Math.abs(mean - 0.5) / 0.5);
        const qualityScore = (resolutionScore * 0.45 + brightnessScore * 0.25 + (1 - blurScore) * 0.3);

        let verdict = 'inconclusive';
        let confidence = 0.55;
        const reasons = [];

        if (qualityScore > 0.74) {
          verdict = 'likely_genuine';
          confidence = 0.9;
          reasons.push('The image is sharp, well lit, and of sufficient resolution.');
        } else if (qualityScore < 0.46) {
          verdict = 'suspicious';
          confidence = 0.84;
          reasons.push('The image looks too blurry, too dark, or too small to judge reliably.');
        } else {
          verdict = 'inconclusive';
          confidence = 0.63;
          reasons.push('The image is usable but does not meet the strongest quality thresholds.');
        }

        const fileName = (file.name || '').toLowerCase();
        const suspiciousImageKeywords = ['upi', 'payment', 'notice', 'bank', 'aadhaar', 'otp', 'invoice', 'fine', 'verification', 'scam', 'transaction', 'refund', 'offer', 'kiosk', 'receipt', 'discount'];
        const suspiciousFileName = suspiciousImageKeywords.some((keyword) => fileName.includes(keyword));
        const aspectRatio = width && height ? Math.max(width / height, height / width) : 1;
        const screenshotShape = aspectRatio > 1.8 || aspectRatio < 0.55;
        const contrastRatio = Math.min(1, Math.max(0, (luminanceVariance * 1.8)));
        const textLikePattern = contrastRatio > 0.42 && screenshotShape;

        if (suspiciousFileName) {
          reasons.push('The file name includes scam-related keywords, which is common in suspicious payment or verification screenshots.');
        }

        if (screenshotShape) {
          reasons.push('The image shape resembles a screenshot or embedded notice, a common format for photo-based scam attempts.');
        }

        if (textLikePattern) {
          reasons.push('The image has strong contrast and a screenshot-like form factor, which may indicate a scam notice or payment request screenshot.');
        }

        if ((suspiciousFileName || screenshotShape || textLikePattern) && verdict === 'likely_genuine') {
          verdict = 'suspicious';
          confidence = Math.max(confidence, 0.78);
        }

        if ((suspiciousFileName || textLikePattern) && qualityScore < 0.74) {
          verdict = 'suspicious';
          confidence = Math.max(confidence, 0.82);
        }

        reasons.push(`Resolution estimate: ${Math.round(width)}×${Math.round(height)} px.`);
        reasons.push(`Brightness and sharpness look ${mean > 0.55 ? 'bright' : 'moderate'} enough for a quick check.`);

        resolve({ verdict, confidence, reasons, suspicious_file_name: suspiciousFileName, screenshot_shape: screenshotShape, text_like_pattern: textLikePattern });
      };
      img.onerror = () => reject(new Error('Could not read the uploaded image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read the uploaded image.'));
    reader.readAsDataURL(file);
  });
}

export function askCitizenAssistantLocally(question, language) {
  const text = normalize(question || '');
  const locale = normalize(language || 'English');

  const scenarioMatch = SCENARIO_LIBRARY.find((scenario) => normalize(scenario.phrase).includes(text) || text.includes(normalize(scenario.phrase)) || text.includes(scenario.authority) || text.includes(scenario.target));
  if (scenarioMatch) {
    return `This resembles a scam pattern involving ${scenarioMatch.authority}. Do not share OTPs, Aadhaar, money, or personal details. Verify through an official channel and preserve any messages or screenshots.`;
  }

  const rules = [
    {
      matcher: (value) => /digital arrest|under arrest|not disconnect|warrant|court notice|legal notice|asset freeze|account will be frozen|parcel|customs|police|cbi/i.test(value),
      response: 'This sounds like a high-risk scam pattern. Do not share OTPs, Aadhaar, money, or personal data. Pause the interaction, verify through an official channel, and report it if needed.',
    },
    {
      matcher: (value) => /otp|one time password|verification code|code/i.test(value),
      response: 'Never share a one-time password or verification code with an unexpected caller. Legitimate institutions do not ask for these over a stressful or urgent call.',
    },
    {
      matcher: (value) => /counterfeit|currency|note|banknote|rupee|rupees/i.test(value),
      response: 'Inspect the note under good light, compare the print quality and edges, and avoid accepting a note if it feels blurry, uneven, or suspicious.',
    },
    {
      matcher: (value) => /fraud|transfer|upi|wallet|payment|refund/i.test(value),
      response: 'Treat payment or refund requests with caution. Verify the request through an official app or helpline before sending any money.',
    },
    {
      matcher: (value) => /hindi|bengali|tamil|telugu|marathi|kannada/i.test(value),
      response: 'सावधानी से जांच करें, किसी भी OTP या पैसे की जानकारी को साझा नहीं करें, और केवल आधिकारिक चैनल से पुष्टि करें।',
    },
  ];

  const matched = rules.find((rule) => rule.matcher(text));
  if (matched) return matched.response;

  if (locale.includes('hindi') || locale.includes('bengali') || locale.includes('tamil') || locale.includes('telugu') || locale.includes('marathi') || locale.includes('kannada')) {
    return 'सावधानी से जांच करें, किसी भी OTP या पैसे की जानकारी को साझा नहीं करें, और केवल आधिकारिक चैनल से पुष्टि करें.';
  }

  return 'A safe first step is to pause and verify through an official channel before sharing money, OTPs, or personal details.';
}

export function submitCitizenReportLocally(payload) {
  const category = payload?.category || 'other';
  const reportId = `RPT-${crypto.randomUUID().toUpperCase()}`;
  const description = payload?.description || 'No description supplied.';
  const reporter = payload?.reporter_name || 'Anonymous';
  const language = payload?.language || 'English';
  const acknowledgement = `Your ${category.replace('_', ' ')} report has been lodged and assigned for review by the local cyber-safety desk.`;
  const draftFir = [
    `Report ID: ${reportId}`,
    `Reporter: ${reporter}`,
    `Language: ${language}`,
    `Category: ${category}`,
    `Description: ${description}`,
    'Observation: The complainant reported a suspicious digital interaction and requested verification through an official channel. Evidence should be preserved, including screenshots, call logs, and account references.',
    'Recommended follow-up: notify the nearest cybercrime unit, preserve related communications, and confirm the account or payment activity through verified official channels.',
  ].join('\n');

  return {
    report_id: reportId,
    acknowledgement,
    draft_fir: draftFir,
    status: 'Filed for review',
    submitted_at: new Date().toLocaleString(),
  };
}

const FRAUD_RING_DATA = {
  'ACC-1001': {
    account_id: 'ACC-1001',
    connected_accounts: ['ACC-1002', 'ACC-1005', 'ACC-1012'],
    shared_signals: ['Repeated beneficiary pattern', 'Common device fingerprint', 'Rapid small transfers'],
    is_flagged: true,
    mule_probability: 0.91,
    ring_id: 'RNG-204',
  },
  'ACC-1002': {
    account_id: 'ACC-1002',
    connected_accounts: ['ACC-1001', 'ACC-1004', 'ACC-1009'],
    shared_signals: ['Repeated beneficiary pattern', 'Common device fingerprint', 'Small-value rapid transfers'],
    is_flagged: true,
    mule_probability: 0.89,
    ring_id: 'RNG-204',
  },
  'ACC-1003': {
    account_id: 'ACC-1003',
    connected_accounts: ['ACC-1004', 'ACC-1007', 'ACC-1010'],
    shared_signals: ['Suspicious wallet top-ups', 'Shell merchant links'],
    is_flagged: true,
    mule_probability: 0.78,
    ring_id: 'RNG-205',
  },
  'ACC-1004': {
    account_id: 'ACC-1004',
    connected_accounts: ['ACC-1003', 'ACC-1007', 'ACC-1011'],
    shared_signals: ['Suspicious wallet top-ups', 'Shared contact cluster'],
    is_flagged: false,
    mule_probability: 0.41,
    ring_id: 'RNG-301',
  },
  'ACC-1009': {
    account_id: 'ACC-1009',
    connected_accounts: ['ACC-1008', 'ACC-1010', 'ACC-1013'],
    shared_signals: ['Shared contact cluster', 'High-risk merchant links', 'Repeated cash-out pattern'],
    is_flagged: true,
    mule_probability: 0.81,
    ring_id: 'RNG-204',
  },
  'ACC-1012': {
    account_id: 'ACC-1012',
    connected_accounts: ['ACC-1001', 'ACC-1014'],
    shared_signals: ['Device mismatch', 'Cross-border transfer pattern'],
    is_flagged: true,
    mule_probability: 0.74,
    ring_id: 'RNG-206',
  },
};

export function getRuleLibrarySamplesLocally(limit = 30) {
  const sampleCases = SCENARIO_LIBRARY.slice(0, limit).map((example) => ({
    phrase: example.phrase,
    authority: example.authority,
    target: example.target,
    medium: example.medium,
    issue: example.issue,
  }));

  return {
    total_examples: SCENARIO_LIBRARY.length,
    total_authority_patterns: LIBRARY_AUTHORITIES.length,
    total_target_patterns: LIBRARY_TARGETS.length,
    total_medium_patterns: LIBRARY_MEDIUMS.length,
    total_urgency_patterns: URGENCY_TERMS.length,
    total_secrecy_patterns: SECRECY_TERMS.length,
    total_payment_patterns: PAYMENT_TERMS.length,
    sample_cases: sampleCases,
  };
}

export function lookupFraudRingLocally(accountId) {
  const normalized = (accountId || '').toUpperCase();
  return FRAUD_RING_DATA[normalized] || {
    account_id: normalized || 'UNKNOWN',
    connected_accounts: [],
    shared_signals: ['No linked pattern found in the local demo graph'],
    is_flagged: false,
    mule_probability: 0.15,
    ring_id: 'RNG-000',
  };
}

export function getCaseSummaryLocally(reportId, accountId) {
  const ring = lookupFraudRingLocally(accountId);
  const severity = ring.is_flagged ? 'High' : 'Medium';
  const summary = [
    `Report ${reportId || 'unknown'} was reviewed against the local fraud graph.`,
    `The linked account ${ring.account_id} shows ${ring.is_flagged ? 'multiple suspicious links' : 'limited suspicious activity'} and a mule probability of ${Math.round(ring.mule_probability * 100)}%.`,
    `The linked network includes ${ring.connected_accounts.length} accounts and ${ring.shared_signals.length} shared signals, indicating a pattern consistent with coordinated suspicious activity.`,
    'The case should be escalated to the cybercrime desk and flagged for follow-up with the linked beneficiary accounts.',
  ].join('\n');

  return {
    priority: severity,
    summary,
    suggested_next_steps: [
      'Verify the linked beneficiary accounts in the local graph.',
      'Preserve screenshots and call logs for evidence.',
      'Escalate the case to the cybercrime or financial crime unit.',
      'Cross-check recent transfers, device fingerprints, and merchant links for coordinated activity.',
    ],
  };
}
