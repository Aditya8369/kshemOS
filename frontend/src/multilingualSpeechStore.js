/**
 * Multilingual Speech Recognition & Regional-Language Confidence Store
 * 
 * Supports:
 * - Configurable ASR Providers (Bhashini Indic AI, Local Whisper, Browser Web Speech, Mock Indic)
 * - Regional Indian languages (Hindi, Tamil, Telugu, Bengali, Marathi, etc.)
 * - Natural conversational Code-Switching (Hinglish, Tanglish)
 * - Speaker Turn Diarization (Caller vs Citizen)
 * - Word-level confidence scoring and low-confidence visual marking
 * - Citizen correction without overwriting raw ASR output
 * - Dual-layer audit record passed to scam analysis
 * - Text-entry fallback
 */

export const ASR_PROVIDERS = [
  {
    id: 'bhashini',
    name: 'Bhashini Indic AI ASR',
    description: 'Government of India National AI Portal ASR with native 22 scheduled regional Indian language acoustic models.',
    supportedLanguages: ['hi', 'bn', 'ta', 'te', 'mr', 'kn', 'gu', 'pa', 'ml', 'en'],
    supportsCodeSwitching: true,
    isLocal: false,
  },
  {
    id: 'whisper_local',
    name: 'Local Indic-FineTuned Whisper',
    description: 'Local on-device / edge node Whisper adapter fine-tuned on conversational Indic dialects.',
    supportedLanguages: ['hi', 'en', 'ta', 'te', 'bn', 'mr'],
    supportsCodeSwitching: true,
    isLocal: true,
  },
  {
    id: 'browser_speech',
    name: 'Browser Web Speech API',
    description: 'Client-side speech synthesis and recognition utilizing device native speech engines.',
    supportedLanguages: ['hi-IN', 'en-IN', 'ta-IN', 'te-IN', 'bn-IN', 'mr-IN'],
    supportsCodeSwitching: false,
    isLocal: true,
  },
  {
    id: 'mock_adapter',
    name: 'Indic Synthetic Telephony ASR Engine',
    description: 'Deterministic high-fidelity test engine for realistic Indian scam calls with confidence variations and code-switching.',
    supportedLanguages: ['hi', 'en', 'ta', 'te', 'bn'],
    supportsCodeSwitching: true,
    isLocal: true,
  },
];

export const REGIONAL_LANGUAGES = [
  { code: 'hi', label: 'Hindi (हिंदी)', script: 'Devanagari', locale: 'hi-IN' },
  { code: 'en', label: 'English (Indian)', script: 'Latin', locale: 'en-IN' },
  { code: 'ta', label: 'Tamil (தமிழ்)', script: 'Tamil', locale: 'ta-IN' },
  { code: 'te', label: 'Telugu (తెలుగు)', script: 'Telugu', locale: 'te-IN' },
  { code: 'bn', label: 'Bengali (বাংলা)', script: 'Bengali', locale: 'bn-IN' },
  { code: 'mr', label: 'Marathi (मराठी)', script: 'Devanagari', locale: 'mr-IN' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)', script: 'Kannada', locale: 'kn-IN' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)', script: 'Gujarati', locale: 'gu-IN' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)', script: 'Gurmukhi', locale: 'pa-IN' },
];

export const MULTILINGUAL_SCAM_LEXICON = {
  threat: [
    'digital arrest', 'giraftari', 'गिरफ्तारी', 'arrest', 'warrant', 'वारंट',
    'cbi', 'police', 'पुलिस', 'customs', 'कस्टम्स', 'narcotics', 'नारकोटिक्स',
    'crime branch', 'क्राइम ब्रांच', 'court order', 'supreme court', 'fir',
    'jail', 'kanooni karwayi', 'adhikaari', 'seized parcel', 'drugs',
  ],
  urgency: [
    'turant', 'तुरंत', 'abhi ke abhi', 'अभी के अभी', 'immediately', 'right now',
    'do minute mein', 'do not disconnect', 'call disconnect mat karna', 'disconnect mat karna',
    'urgent', 'hours', 'urgent verification', 'jaldi kijiye',
  ],
  secrecy: [
    'kisi ko mat batana', 'किसी को मत बताना', 'gupt jaanch', 'गुप्त जांच',
    'kamre mein akele raho', 'confidential', 'secret', 'do not tell anyone',
    'darwaza band rakho', 'family ko mat batana',
  ],
  payment: [
    'transfer', 'paise transfer', 'पैसे ट्रांसफर', 'transfer money', 'surakshit khata',
    'सुरक्षित खाता', 'safe account', 'rbi safe account', 'otp share karo',
    'otp', 'upi pin', 'verification amount', 'shulk bhariye', 'penalty',
    'anydesk', 'teamviewer', 'screen share',
  ],
};

export const MULTILINGUAL_SAMPLES = [
  {
    id: 'sample-hi-digital-arrest',
    title: 'Hindi-English Code-Switched Digital Arrest',
    language: 'hi',
    languageName: 'Hindi / Hinglish',
    speaker: 'caller',
    rawText: 'Namaste main CVI Crime Branch se bol raha hoon aapka parcel Mumbai customs ne seize kiya hai usme illegal drugs mile hain aap par digital arrest warrant issue hua hai.',
    simulatedWords: [
      { word: 'Namaste', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'main', confidence: 0.95, language: 'hi', alternatives: [] },
      { word: 'CVI', confidence: 0.48, language: 'en', alternatives: ['CBI', 'SBI', 'CIVIL'] }, // Low confidence token!
      { word: 'Crime', confidence: 0.94, language: 'en', alternatives: [] },
      { word: 'Branch', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'se', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'bol', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'raha', confidence: 0.96, language: 'hi', alternatives: [] },
      { word: 'hoon', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'aapka', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'parcel', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'Mumbai', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'customs', confidence: 0.94, language: 'en', alternatives: [] },
      { word: 'ne', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'seize', confidence: 0.93, language: 'en', alternatives: [] },
      { word: 'kiya', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'hai', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'usme', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'illegal', confidence: 0.94, language: 'en', alternatives: [] },
      { word: 'drugs', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'mile', confidence: 0.96, language: 'hi', alternatives: [] },
      { word: 'hain', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'aap', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'par', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'digital', confidence: 0.94, language: 'en', alternatives: [] },
      { word: 'arrest', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'warrant', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'issue', confidence: 0.92, language: 'en', alternatives: [] },
      { word: 'hua', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'hai', confidence: 0.98, language: 'hi', alternatives: [] },
    ],
  },
  {
    id: 'sample-hi-urgency-payment',
    title: 'Hinglish Urgency & Safe Account Demand',
    language: 'hi',
    languageName: 'Hindi / Hinglish',
    speaker: 'caller',
    rawText: 'Call disconnect mat karna kisi ko mat batana turant RVI safe account mein verification amount transfer kijiye varna police giraftari karegi.',
    simulatedWords: [
      { word: 'Call', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'disconnect', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'mat', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'karna', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'kisi', confidence: 0.96, language: 'hi', alternatives: [] },
      { word: 'ko', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'mat', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'batana', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'turant', confidence: 0.96, language: 'hi', alternatives: [] },
      { word: 'RVI', confidence: 0.52, language: 'en', alternatives: ['RBI', 'SBI', 'UPI'] }, // Low confidence token!
      { word: 'safe', confidence: 0.94, language: 'en', alternatives: [] },
      { word: 'account', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'mein', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'verification', confidence: 0.93, language: 'en', alternatives: [] },
      { word: 'amount', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'transfer', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'kijiye', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'varna', confidence: 0.96, language: 'hi', alternatives: [] },
      { word: 'police', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'giraftari', confidence: 0.96, language: 'hi', alternatives: [] },
      { word: 'karegi', confidence: 0.98, language: 'hi', alternatives: [] },
    ],
  },
  {
    id: 'sample-ta-bank-otp',
    title: 'Tamil-English Bank OTP Scam',
    language: 'ta',
    languageName: 'Tamil / Tanglish',
    speaker: 'caller',
    rawText: 'Ungal bank account freeze aagividum ungal mobile OPP udane share pannunga illana account block aagum.',
    simulatedWords: [
      { word: 'Ungal', confidence: 0.96, language: 'ta', alternatives: [] },
      { word: 'bank', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'account', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'freeze', confidence: 0.94, language: 'en', alternatives: [] },
      { word: 'aagividum', confidence: 0.95, language: 'ta', alternatives: [] },
      { word: 'ungal', confidence: 0.97, language: 'ta', alternatives: [] },
      { word: 'mobile', confidence: 0.98, language: 'en', alternatives: [] },
      { word: 'OPP', confidence: 0.49, language: 'en', alternatives: ['OTP', 'APP', 'UPP'] }, // Low confidence token!
      { word: 'udane', confidence: 0.95, language: 'ta', alternatives: [] },
      { word: 'share', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'pannunga', confidence: 0.96, language: 'ta', alternatives: [] },
      { word: 'illana', confidence: 0.97, language: 'ta', alternatives: [] },
      { word: 'account', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'block', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'aagum', confidence: 0.97, language: 'ta', alternatives: [] },
    ],
  },
  {
    id: 'sample-hi-benign',
    title: 'Benign Hindi Customer Service Call',
    language: 'hi',
    languageName: 'Hindi',
    speaker: 'caller',
    rawText: 'Namaskar main bank branch se bol raha hoon aapka cheque clear ho gaya hai aap aakar passbook update kar sakte hain.',
    simulatedWords: [
      { word: 'Namaskar', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'main', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'bank', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'branch', confidence: 0.98, language: 'en', alternatives: [] },
      { word: 'se', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'bol', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'raha', confidence: 0.97, language: 'hi', alternatives: [] },
      { word: 'hoon', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'aapka', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'cheque', confidence: 0.96, language: 'en', alternatives: [] },
      { word: 'clear', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'ho', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'gaya', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'hai', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'aap', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'aakar', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'passbook', confidence: 0.95, language: 'en', alternatives: [] },
      { word: 'update', confidence: 0.97, language: 'en', alternatives: [] },
      { word: 'kar', confidence: 0.99, language: 'hi', alternatives: [] },
      { word: 'sakte', confidence: 0.98, language: 'hi', alternatives: [] },
      { word: 'hain', confidence: 0.99, language: 'hi', alternatives: [] },
    ],
  },
];

/**
 * Detects code switching segments and ratios.
 */
export function detectCodeSwitching(words) {
  if (!words || words.length === 0) {
    return { primaryLanguage: 'hi', primaryRatio: 1.0, segments: [] };
  }

  const langCounts = {};
  const segments = [];
  let currentLang = null;
  let currentTokens = [];

  for (const w of words) {
    const lang = w.language || 'hi';
    langCounts[lang] = (langCounts[lang] || 0) + 1;

    if (currentLang === null) {
      currentLang = lang;
      currentTokens.push(w.word);
    } else if (currentLang === lang) {
      currentTokens.push(w.word);
    } else {
      segments.push({
        text: currentTokens.join(' '),
        language: currentLang,
        confidence: 1.0,
      });
      currentLang = lang;
      currentTokens = [w.word];
    }
  }

  if (currentTokens.length > 0 && currentLang) {
    segments.push({
      text: currentTokens.join(' '),
      language: currentLang,
      confidence: 1.0,
    });
  }

  let primaryLanguage = 'hi';
  let maxCount = 0;
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryLanguage = lang;
    }
  }

  const primaryRatio = Math.round((maxCount / words.length) * 100) / 100;
  return { primaryLanguage, primaryRatio, segments };
}

/**
 * In-Memory Local Manager for Offline Resilience
 */
export class InMemoryMultilingualASRManager {
  constructor() {
    this.turns = new Map();
  }

  transcribe({
    provider = 'bhashini',
    sampleId = null,
    textInput = null,
    targetLanguage = 'hi',
    speaker = 'caller',
    enableCodeSwitching = true,
    confidenceThreshold = 0.70,
  }) {
    const turnId = `TURN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = Date.now();

    const sample = sampleId ? MULTILINGUAL_SAMPLES.find(s => s.id === sampleId) : null;
    let rawText = '';
    let words = [];
    let detectedLang = targetLanguage;

    if (sample) {
      rawText = sample.rawText;
      words = sample.simulatedWords.map((sw, idx) => ({
        word: sw.word,
        confidence: sw.confidence !== undefined ? sw.confidence : 0.95,
        start_ms: idx * 280,
        end_ms: (idx + 1) * 280,
        language: sw.language || sample.language,
        is_low_confidence: (sw.confidence !== undefined ? sw.confidence : 0.95) < confidenceThreshold,
        alternatives: sw.alternatives || [],
      }));
      detectedLang = sample.language;
    } else if (textInput) {
      rawText = textInput.trim();
      const tokens = rawText.split(/\s+/);
      words = tokens.map((tok, idx) => {
        const isDevanagari = /[\u0900-\u097F]/.test(tok);
        const lang = isDevanagari ? 'hi' : targetLanguage;
        const isAcronym = tok.length >= 2 && tok === tok.toUpperCase();
        const conf = isAcronym ? 0.88 : 0.96;
        return {
          word: tok,
          confidence: conf,
          start_ms: idx * 280,
          end_ms: (idx + 1) * 280,
          language: lang,
          is_low_confidence: conf < confidenceThreshold,
          alternatives: [],
        };
      });
      detectedLang = targetLanguage;
    } else {
      rawText = 'Yeh CBI officer ka notice hai turant paise transfer kijiye.';
      const tokens = rawText.split(/\s+/);
      words = tokens.map((tok, idx) => ({
        word: tok,
        confidence: 0.94,
        start_ms: idx * 280,
        end_ms: (idx + 1) * 280,
        language: targetLanguage,
        is_low_confidence: false,
        alternatives: [],
      }));
    }

    const { primaryLanguage, primaryRatio, segments } = detectCodeSwitching(words);
    const avgConf = Math.round((words.reduce((sum, w) => sum + w.confidence, 0) / Math.max(1, words.length)) * 1000) / 1000;

    const speechTurn = {
      turn_id: turnId,
      speaker,
      timestamp_ms: now,
      original_text: rawText,
      corrected_text: rawText,
      words,
      corrections: [],
      is_citizen_corrected: false,
      detected_language: primaryLanguage,
      language_confidence: primaryRatio,
      code_switch_segments: enableCodeSwitching ? segments : [],
      average_confidence: avgConf,
      provider,
    };

    this.turns.set(turnId, speechTurn);
    return speechTurn;
  }

  applyCorrections(turnId, wordCorrections = [], fullCorrectedText = null) {
    const turn = this.turns.get(turnId);
    if (!turn) throw new Error(`Turn ${turnId} not found.`);

    for (const corr of wordCorrections) {
      const idx = corr.word_index;
      if (idx >= 0 && idx < turn.words.length) {
        turn.words[idx].word = corr.corrected_word;
        turn.words[idx].confidence = 1.0;
        turn.words[idx].is_low_confidence = false;
        turn.corrections.push(corr);
      }
    }

    if (fullCorrectedText !== null && fullCorrectedText !== undefined) {
      turn.corrected_text = fullCorrectedText.trim();
    } else {
      turn.corrected_text = turn.words.map(w => w.word).join(' ');
    }

    turn.is_citizen_corrected = true;
    turn.average_confidence = Math.round((turn.words.reduce((sum, w) => sum + w.confidence, 0) / Math.max(1, turn.words.length)) * 1000) / 1000;
    return turn;
  }

  analyzeScam(textToAnalyze, originalAsrText, language = 'hi', callerClaimsToBe = null) {
    const lower = textToAnalyze.toLowerCase();
    const matchedPatterns = [];

    const threatHits = MULTILINGUAL_SCAM_LEXICON.threat.filter(kw => lower.includes(kw.toLowerCase()));
    const urgencyHits = MULTILINGUAL_SCAM_LEXICON.urgency.filter(kw => lower.includes(kw.toLowerCase()));
    const secrecyHits = MULTILINGUAL_SCAM_LEXICON.secrecy.filter(kw => lower.includes(kw.toLowerCase()));
    const paymentHits = MULTILINGUAL_SCAM_LEXICON.payment.filter(kw => lower.includes(kw.toLowerCase()));

    if (threatHits.length > 0) matchedPatterns.push(`Authority / Arrest Threats: ${threatHits.join(', ')}`);
    if (urgencyHits.length > 0) matchedPatterns.push(`Urgency Pressure: ${urgencyHits.join(', ')}`);
    if (secrecyHits.length > 0) matchedPatterns.push(`Secrecy & Isolation Demands: ${secrecyHits.join(', ')}`);
    if (paymentHits.length > 0) matchedPatterns.push(`Payment / OTP Demands: ${paymentHits.join(', ')}`);

    let rawScore = 0.0;
    rawScore += Math.min(threatHits.length, 4) * 8.0;
    rawScore += Math.min(paymentHits.length, 3) * 8.0;
    rawScore += Math.min(secrecyHits.length, 2) * 10.0;
    rawScore += Math.min(urgencyHits.length, 3) * 6.0;

    const activePillars = [threatHits, urgencyHits, secrecyHits, paymentHits].filter(h => h.length > 0).length;
    if (activePillars >= 3) rawScore += 20.0;
    else if (activePillars >= 2) rawScore += 10.0;

    if (callerClaimsToBe && ['cbi', 'police', 'customs', 'court'].some(t => callerClaimsToBe.toLowerCase().includes(t))) {
      rawScore += 15.0;
    }

    const score = Math.max(0.0, Math.min(100.0, Math.round(rawScore * 10) / 10));

    let band = 'low';
    let recommendation = '🟢 Low scam probability detected in this transcript segment.';
    if (score >= 75.0) {
      band = 'critical';
      recommendation = '🚨 HANG UP IMMEDIATELY / तुरंत फोन काटें: Law enforcement and courts in India NEVER conduct digital arrests or demand funds over phone or video call. Call 1930 immediately.';
    } else if (score >= 50.0) {
      band = 'high';
      recommendation = '⚠️ HIGH RISK SCAM / सतर्क रहें: Impersonation and pressure tactics detected. Never share OTPs, transfer money to "safe accounts", or download remote screen apps.';
    } else if (score >= 25.0) {
      band = 'medium';
      recommendation = '🔍 CAUTION / ध्यान दें: Suspicious request language detected. Verify caller identity independently through officially published government or bank directories.';
    }

    const wasCorrected = textToAnalyze.trim() !== originalAsrText.trim();
    const words = textToAnalyze.split(/\s+/);
    const latinWords = words.filter(w => /^[A-Za-z]+$/.test(w)).length;
    const codeSwitchRatio = Math.round((latinWords / Math.max(1, words.length)) * 100) / 100;

    const explanation = `Analyzed ${words.length} words (${Math.round(codeSwitchRatio * 100)}% code-switched). Found ${threatHits.length} authority/threat indicators, ${paymentHits.length} payment demands, ${secrecyHits.length} secrecy demands, and ${urgencyHits.length} urgency cues.`;

    return {
      risk_score: score,
      risk_band: band,
      analyzed_text: textToAnalyze,
      original_asr_text: originalAsrText,
      was_corrected: wasCorrected,
      detected_language: language,
      code_switch_ratio: codeSwitchRatio,
      matched_patterns: matchedPatterns,
      recommendation,
      explanation,
    };
  }
}

export const localMultilingualASRManager = new InMemoryMultilingualASRManager();

/**
 * Public API wrapper functions
 */
export async function fetchAsrProviders() {
  try {
    const res = await fetch('/api/v1/asr/providers');
    if (res.ok) return await res.json();
  } catch (err) {}
  return ASR_PROVIDERS;
}

export async function fetchAsrSamples() {
  try {
    const res = await fetch('/api/v1/asr/samples');
    if (res.ok) {
      const data = await res.json();
      return data.samples || MULTILINGUAL_SAMPLES;
    }
  } catch (err) {}
  return MULTILINGUAL_SAMPLES;
}

export async function transcribeSpeechApi(options) {
  try {
    const res = await fetch('/api/v1/asr/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: options.provider || 'bhashini',
        sample_id: options.sampleId,
        text_input: options.textInput,
        target_language: options.targetLanguage || 'hi',
        speaker: options.speaker || 'caller',
        enable_code_switching: options.enableCodeSwitching !== false,
        confidence_threshold: options.confidenceThreshold !== undefined ? options.confidenceThreshold : 0.70,
      }),
    });
    if (res.ok) return await res.json();
  } catch (err) {}
  return localMultilingualASRManager.transcribe(options);
}

export async function correctTurnApi(turnId, wordCorrections = [], fullCorrectedText = null) {
  try {
    const res = await fetch('/api/v1/asr/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        turn_id: turnId,
        word_corrections: wordCorrections,
        full_corrected_text: fullCorrectedText,
      }),
    });
    if (res.ok) return await res.json();
  } catch (err) {}
  return localMultilingualASRManager.applyCorrections(turnId, wordCorrections, fullCorrectedText);
}

export async function analyzeMultilingualScamApi(textToAnalyze, originalAsrText, language = 'hi', callerClaimsToBe = null, turnId = null) {
  try {
    const res = await fetch('/api/v1/asr/analyze-scam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        turn_id: turnId,
        text_to_analyze: textToAnalyze,
        original_asr_text: originalAsrText,
        language,
        caller_claims_to_be: callerClaimsToBe,
      }),
    });
    if (res.ok) return await res.json();
  } catch (err) {}
  return localMultilingualASRManager.analyzeScam(textToAnalyze, originalAsrText, language, callerClaimsToBe);
}
