/**
 * Consent-Based Live Scam-Call Transcription & Risk Alerts Store
 * 
 * Ethical Public Safety Principles:
 * 1. Opt-in only: User explicitly authorizes microphone/stream and data processing.
 * 2. Zero auto-recording: Audio is transcribed ephemerally; raw audio files are never saved to disk.
 * 3. Never contacts scammers: Passive guardian listener mode only.
 * 4. User sovereignty: Full control to pause, resume, stop, and permanently purge session data.
 */

export const SCAM_LEXICON = [
  // Category: threat
  { phrase: 'digital arrest', category: 'threat', weight: 30.0 },
  { phrase: 'arrest warrant', category: 'threat', weight: 28.0 },
  { phrase: 'cbi officer', category: 'threat', weight: 25.0 },
  { phrase: 'cbi', category: 'threat', weight: 20.0 },
  { phrase: 'police custody', category: 'threat', weight: 24.0 },
  { phrase: 'crime branch', category: 'threat', weight: 22.0 },
  { phrase: 'enforcement directorate', category: 'threat', weight: 24.0 },
  { phrase: 'ed officer', category: 'threat', weight: 22.0 },
  { phrase: 'customs department', category: 'threat', weight: 20.0 },
  { phrase: 'customs seizure', category: 'threat', weight: 22.0 },
  { phrase: 'narcotics', category: 'threat', weight: 24.0 },
  { phrase: 'drugs found', category: 'threat', weight: 25.0 },
  { phrase: 'money laundering', category: 'threat', weight: 26.0 },
  { phrase: 'supreme court order', category: 'threat', weight: 22.0 },
  { phrase: 'non-bailable warrant', category: 'threat', weight: 28.0 },
  { phrase: 'fir registered', category: 'threat', weight: 20.0 },
  { phrase: 'sim card blocked', category: 'threat', weight: 18.0 },
  { phrase: 'bank account frozen', category: 'threat', weight: 22.0 },
  { phrase: 'passport cancelled', category: 'threat', weight: 20.0 },
  { phrase: 'illegal parcel', category: 'threat', weight: 20.0 },

  // Category: urgency
  { phrase: 'immediately', category: 'urgency', weight: 12.0 },
  { phrase: 'right now', category: 'urgency', weight: 12.0 },
  { phrase: 'within 15 minutes', category: 'urgency', weight: 16.0 },
  { phrase: 'within 30 minutes', category: 'urgency', weight: 14.0 },
  { phrase: 'do not delay', category: 'urgency', weight: 12.0 },
  { phrase: 'urgent verification', category: 'urgency', weight: 14.0 },
  { phrase: 'call will disconnect', category: 'urgency', weight: 15.0 },
  { phrase: 'act fast', category: 'urgency', weight: 10.0 },
  { phrase: 'final notice', category: 'urgency', weight: 14.0 },

  // Category: secrecy
  { phrase: 'do not disconnect', category: 'secrecy', weight: 22.0 },
  { phrase: 'stay on this call', category: 'secrecy', weight: 18.0 },
  { phrase: 'do not tell anyone', category: 'secrecy', weight: 24.0 },
  { phrase: 'keep this confidential', category: 'secrecy', weight: 20.0 },
  { phrase: 'isolated place', category: 'secrecy', weight: 20.0 },
  { phrase: 'quiet room', category: 'secrecy', weight: 18.0 },
  { phrase: 'do not inform family', category: 'secrecy', weight: 25.0 },
  { phrase: 'confidential investigation', category: 'secrecy', weight: 22.0 },
  { phrase: 'official secrets act', category: 'secrecy', weight: 24.0 },

  // Category: payment
  { phrase: 'transfer money', category: 'payment', weight: 25.0 },
  { phrase: 'transfer funds', category: 'payment', weight: 25.0 },
  { phrase: 'safe account', category: 'payment', weight: 30.0 },
  { phrase: 'rbi safe account', category: 'payment', weight: 32.0 },
  { phrase: 'security deposit', category: 'payment', weight: 22.0 },
  { phrase: 'verification amount', category: 'payment', weight: 25.0 },
  { phrase: 'share otp', category: 'payment', weight: 28.0 },
  { phrase: 'one time password', category: 'payment', weight: 20.0 },
  { phrase: 'upi pin', category: 'payment', weight: 28.0 },
  { phrase: 'clearance fee', category: 'payment', weight: 22.0 },
  { phrase: 'penalty fee', category: 'payment', weight: 18.0 },
  { phrase: 'anydesk', category: 'payment', weight: 26.0 },
  { phrase: 'rustdesk', category: 'payment', weight: 26.0 },
  { phrase: 'teamviewer', category: 'payment', weight: 26.0 },
  { phrase: 'screen share', category: 'payment', weight: 22.0 },

  // Category: coercion
  { phrase: 'video call', category: 'coercion', weight: 14.0 },
  { phrase: 'skype call', category: 'coercion', weight: 18.0 },
  { phrase: 'turn on camera', category: 'coercion', weight: 16.0 },
  { phrase: 'look at my uniform', category: 'coercion', weight: 20.0 },
  { phrase: 'police badge', category: 'coercion', weight: 18.0 },
  { phrase: 'dsp badge', category: 'coercion', weight: 18.0 },
];

export const OFFICIAL_HELPLINES = [
  {
    name: 'National Cyber Crime Helpline',
    number: '1930',
    description: 'Ministry of Home Affairs 24x7 reporting helpline for cyber fraud and immediate bank account freezing.',
    url: 'https://cybercrime.gov.in',
  },
  {
    name: 'RBI Sachet Fraud Reporting Portal',
    number: '14440',
    description: 'Reserve Bank of India awareness and banking entity verification hotline.',
    url: 'https://sachet.rbi.org.in',
  },
  {
    name: 'DoT Sanchar Saathi (Chakshu)',
    number: '1963',
    description: 'Department of Telecommunications portal to report suspicious fraud calls and WhatsApp numbers.',
    url: 'https://sancharsaathi.gov.in',
  },
  {
    name: 'National Emergency Police Helpline',
    number: '112',
    description: 'Immediate local police and emergency intervention.',
    url: 'https://112.gov.in',
  },
];

export const SAMPLE_CALL_SIMULATIONS = [
  {
    id: 'sim-digital-arrest',
    title: 'Digital Arrest - CBI Narcotics Threat',
    caller: 'Suspected CBI Officer (+91 98765 43210)',
    scenarioDescription: 'Simulates a high-pressure impersonation scam claiming illegal narcotics in a seized parcel.',
    chunks: [
      'Hello, this is Inspector Sharma from Crime Branch headquarters.',
      'A parcel with your Aadhaar and passport details has been seized by Customs with narcotics and drugs found inside.',
      'A non-bailable arrest warrant and Supreme Court order have been issued against you.',
      'You are placed under digital arrest right now. Do not disconnect this call, stay in a quiet room, and do not tell anyone.',
      'To clear your name and unfreeze your bank account, you must transfer money to the RBI safe account immediately for verification.',
    ],
  },
  {
    id: 'sim-customs-courier',
    title: 'Customs Parcel & Courier Drugs Trap',
    caller: 'FedEx Customs Clearance Desk (+91 88123 45678)',
    scenarioDescription: 'Simulates extortion over an alleged international shipment containing fake passports.',
    chunks: [
      'Good morning. This is the Customs Department clearance desk regarding your parcel.',
      'Customs seizure inspection detected illegal parcel contents with 5 foreign passports.',
      'Police custody proceedings will begin in 1 hour if you do not comply.',
      'You must pay the clearance fee and verification amount right now or face an FIR registered.',
    ],
  },
  {
    id: 'sim-electricity-apk',
    title: 'Urgent Electricity Bill Disconnection',
    caller: 'State Electricity Department (+91 77000 11223)',
    scenarioDescription: 'Simulates fake utility bill disconnection pressure requesting screen-sharing software.',
    chunks: [
      'Urgent electricity notice: Your power supply will be disconnected tonight at 9:30 PM due to pending bill update.',
      'Call back right now or your power connection is cancelled.',
      'Download AnyDesk or RustDesk on your phone for urgent verification.',
      'Share OTP sent to your phone to complete bill verification.',
    ],
  },
  {
    id: 'sim-benign-appointment',
    title: 'Benign Bank Appointment Confirmation',
    caller: 'HDFC Bank Customer Desk (+91 22 6600 0000)',
    scenarioDescription: 'Normal customer service interaction with zero scam or threat language.',
    chunks: [
      'Good afternoon, I am calling from your local bank branch regarding your scheduled locker appointment.',
      'We just wanted to confirm if tomorrow at 2 PM is convenient for you to visit our branch.',
      'Please remember to bring your original photo ID passbook when you visit the counter. Have a wonderful day.',
    ],
  },
];

/**
 * Detects suspicious phrases in a given text segment.
 */
export function detectSuspiciousPhrases(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matches = [];
  const seen = new Set();

  for (const item of SCAM_LEXICON) {
    if (seen.has(item.phrase)) continue;

    let isMatch = false;
    if (item.phrase.includes(' ')) {
      if (lower.includes(item.phrase)) isMatch = true;
    } else {
      const regex = new RegExp(`\\b${item.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) isMatch = true;
    }

    if (isMatch) {
      seen.add(item.phrase);
      const idx = lower.indexOf(item.phrase);
      const start = Math.max(0, idx - 20);
      const end = Math.min(text.length, idx + item.phrase.length + 20);
      const snippet = (start > 0 ? '...' : '') + text.slice(start, end).trim() + (end < text.length ? '...' : '');

      matches.push({
        phrase: item.phrase,
        category: item.category,
        severity_weight: item.weight,
        context_snippet: snippet,
      });
    }
  }

  return matches;
}

/**
 * Calculates cumulative risk score, band, prompts, and tactical breakdown.
 */
export function calculateRiskAssessment(allPhrases) {
  const totals = { threat: 0, urgency: 0, secrecy: 0, payment: 0, coercion: 0 };
  const counts = { threat: 0, urgency: 0, secrecy: 0, payment: 0, coercion: 0 };

  for (const p of allPhrases) {
    if (totals[p.category] !== undefined) {
      totals[p.category] += p.severity_weight;
      counts[p.category] += 1;
    }
  }

  const threatComp = Math.min(35.0, totals.threat * 0.9);
  const paymentComp = Math.min(30.0, totals.payment * 0.9);
  const secrecyComp = Math.min(20.0, totals.secrecy * 0.8);
  const urgencyComp = Math.min(15.0, totals.urgency * 0.8);
  const coercionComp = Math.min(15.0, totals.coercion * 0.8);

  let rawScore = threatComp + paymentComp + secrecyComp + urgencyComp + coercionComp;

  const activePillars = Object.values(counts).filter(c => c > 0).length;
  if (activePillars >= 3) {
    rawScore += 15.0;
  } else if (activePillars >= 2) {
    rawScore += 8.0;
  }

  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  let band = 'low';
  if (score >= 75) band = 'critical';
  else if (score >= 50) band = 'high';
  else if (score >= 25) band = 'medium';

  const prompts = [];
  if (band === 'critical') {
    prompts.push('🚨 HANG UP IMMEDIATELY: Law enforcement in India (CBI, Police, Customs, ED, Courts) NEVER conduct investigations, trials, or digital arrests over video or phone calls.');
    prompts.push('⛔ DO NOT TRANSFER MONEY: The RBI and government have NO "safe verification accounts". Any demand to move money is 100% fraudulent.');
    prompts.push('📞 VERIFY VIA 1930: Immediately call the National Cyber Crime Helpline at 1930 or visit cybercrime.gov.in.');
    prompts.push('🔒 DO NOT SHARE ANY CODES: Never share OTPs, Aadhaar numbers, or bank passwords under any circumstances.');
  } else if (band === 'high') {
    prompts.push('⚠️ HIGH SCAM PROBABILITY: The caller is utilizing high-pressure urgency and authority impersonation tactics.');
    prompts.push('🛑 END THE CALL: Tell the caller you will independently contact their department official headquarters.');
    prompts.push('🚫 NEVER DOWNLOAD SCREEN APPS: Do not install AnyDesk, RustDesk, or TeamViewer if requested.');
    prompts.push('📞 CALL OFFICIAL DIRECTORY: Contact the relevant agency via officially published website numbers only.');
  } else if (band === 'medium') {
    prompts.push('🔍 SUSPICIOUS BEHAVIOUR DETECTED: Caller is attempting to create urgency or demand sensitive confirmation.');
    prompts.push('💬 ASK FOR WRITTEN NOTICE: Demand a formal written notice sent via official postal or registered email.');
    prompts.push('⏸️ PAUSE AND VERIFY: Take a breath, consult a trusted family member, and do not make rushed decisions.');
  } else {
    prompts.push('🟢 NO THREAT DETECTED YET: Continue speaking with normal caution.');
    prompts.push('🛡️ REMINDER: Never share OTPs, PINs, or banking passwords on incoming phone calls.');
  }

  const tactics = {
    threat: Math.round(Math.min(100, (totals.threat / 35.0) * 100) * 10) / 10,
    urgency: Math.round(Math.min(100, (totals.urgency / 20.0) * 100) * 10) / 10,
    secrecy: Math.round(Math.min(100, (totals.secrecy / 25.0) * 100) * 10) / 10,
    payment: Math.round(Math.min(100, (totals.payment / 30.0) * 100) * 10) / 10,
    coercion: Math.round(Math.min(100, (totals.coercion / 20.0) * 100) * 10) / 10,
  };

  return { score, band, prompts, tactics };
}

/**
 * In-memory fallback session container for offline resilience.
 */
export class InMemoryLiveCallManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(consent, callerLabel = 'Incoming Call') {
    if (!consent || !consent.user_acknowledged || !consent.mic_permission_granted ||
        !consent.data_processing_accepted || !consent.no_auto_record_acknowledged) {
      throw new Error('All consent permissions must be explicitly granted before activating live call safety.');
    }

    const sessionId = `CALL-SAFE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = Date.now();

    const session = {
      session_id: sessionId,
      status: 'active',
      consent,
      started_at: now,
      updated_at: now,
      caller_label: callerLabel,
      full_transcript: '',
      utterances: [],
      current_risk_score: 0.0,
      current_risk_band: 'low',
      detected_categories: [],
      highlighted_phrases: [],
      actionable_safety_prompts: [
        'Listening for suspicious patterns... Stay calm and do not share sensitive financial information.',
        'Genuine public officials will never threaten immediate arrest over a phone call.',
      ],
      official_helpline_recommendations: OFFICIAL_HELPLINES,
      tactics_breakdown: { threat: 0, urgency: 0, secrecy: 0, payment: 0, coercion: 0 },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  ingestChunk(sessionId, text, speaker = 'caller') {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);
    if (session.status === 'purged') throw new Error('Session has been purged.');
    if (session.status === 'stopped') throw new Error('Session is stopped.');
    if (session.status === 'paused') {
      return {
        session_id: session.session_id,
        status: session.status,
        new_utterance: null,
        full_transcript: session.full_transcript,
        current_risk_score: session.current_risk_score,
        current_risk_band: session.current_risk_band,
        highlighted_phrases: session.highlighted_phrases,
        actionable_safety_prompts: session.actionable_safety_prompts,
        tactics_breakdown: session.tactics_breakdown,
        official_helpline_recommendations: session.official_helpline_recommendations,
      };
    }

    const cleaned = (text || '').trim();
    if (!cleaned) return session;

    const detected = detectSuspiciousPhrases(cleaned);
    const now = Date.now();

    const utterance = {
      utterance_id: `UTT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp_ms: now,
      speaker,
      text: cleaned,
      suspicious_phrases: detected,
      incremental_risk: detected.reduce((sum, d) => sum + d.severity_weight, 0),
    };

    session.full_transcript = session.full_transcript ? `${session.full_transcript} ${cleaned}` : cleaned;
    session.utterances.push(utterance);
    session.updated_at = now;

    // Merge unique phrases
    const existing = new Set(session.highlighted_phrases.map(p => p.phrase));
    for (const d of detected) {
      if (!existing.has(d.phrase)) {
        session.highlighted_phrases.push(d);
        existing.add(d.phrase);
      }
    }

    session.detected_categories = Array.from(new Set(session.highlighted_phrases.map(p => p.category))).sort();

    const assessment = calculateRiskAssessment(session.highlighted_phrases);
    session.current_risk_score = assessment.score;
    session.current_risk_band = assessment.band;
    session.actionable_safety_prompts = assessment.prompts;
    session.tactics_breakdown = assessment.tactics;

    return {
      session_id: session.session_id,
      status: session.status,
      new_utterance: utterance,
      full_transcript: session.full_transcript,
      current_risk_score: session.current_risk_score,
      current_risk_band: session.current_risk_band,
      highlighted_phrases: session.highlighted_phrases,
      actionable_safety_prompts: session.actionable_safety_prompts,
      tactics_breakdown: session.tactics_breakdown,
      official_helpline_recommendations: session.official_helpline_recommendations,
    };
  }

  pauseSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);
    session.status = 'paused';
    session.updated_at = Date.now();
    return session;
  }

  resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);
    session.status = 'active';
    session.updated_at = Date.now();
    return session;
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);
    session.status = 'stopped';
    session.stopped_at = Date.now();
    session.updated_at = session.stopped_at;
    return session;
  }

  purgeSession(sessionId) {
    this.sessions.delete(sessionId);
    return {
      purged: true,
      session_id: sessionId,
      message: 'Session transcript, audio references, and risk cache permanently wiped.',
    };
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);
    return session;
  }
}

export const localLiveCallManager = new InMemoryLiveCallManager();

/**
 * Public Async API wrapper with seamless REST + Local fallback
 */
export async function createLiveCallSession(consent, callerLabel) {
  try {
    const res = await fetch('/api/v1/live-call-safety/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent, caller_label: callerLabel }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    // Fallback to local offline manager
  }
  return localLiveCallManager.createSession(consent, callerLabel);
}

export async function ingestLiveCallChunk(sessionId, text, speaker = 'caller') {
  try {
    const res = await fetch(`/api/v1/live-call-safety/sessions/${sessionId}/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    // Fallback
  }
  return localLiveCallManager.ingestChunk(sessionId, text, speaker);
}

export async function pauseLiveCallSession(sessionId) {
  try {
    const res = await fetch(`/api/v1/live-call-safety/sessions/${sessionId}/pause`, { method: 'POST' });
    if (res.ok) return await res.json();
  } catch (err) {
    // Fallback
  }
  return localLiveCallManager.pauseSession(sessionId);
}

export async function resumeLiveCallSession(sessionId) {
  try {
    const res = await fetch(`/api/v1/live-call-safety/sessions/${sessionId}/resume`, { method: 'POST' });
    if (res.ok) return await res.json();
  } catch (err) {
    // Fallback
  }
  return localLiveCallManager.resumeSession(sessionId);
}

export async function stopLiveCallSession(sessionId) {
  try {
    const res = await fetch(`/api/v1/live-call-safety/sessions/${sessionId}/stop`, { method: 'POST' });
    if (res.ok) return await res.json();
  } catch (err) {
    // Fallback
  }
  return localLiveCallManager.stopSession(sessionId);
}

export async function purgeLiveCallSession(sessionId) {
  try {
    const res = await fetch(`/api/v1/live-call-safety/sessions/${sessionId}`, { method: 'DELETE' });
    if (res.ok) return await res.json();
  } catch (err) {
    // Fallback
  }
  return localLiveCallManager.purgeSession(sessionId);
}
