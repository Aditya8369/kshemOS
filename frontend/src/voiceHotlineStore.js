/**
 * Multilingual Automated Voice Safety Hotline Store.
 *
 * Implements client-and-server IVR state machine supporting 8 Indic languages:
 * - English (en)
 * - Hindi (hi)
 * - Tamil (ta)
 * - Telugu (te)
 * - Kannada (kn)
 * - Bengali (bn)
 * - Marathi (mr)
 * - Gujarati (gu)
 */

import { createIncident } from './incidentDashboard.js';

export const SUPPORTED_INDIC_LANGUAGES = [
  { code: 'en', name: 'English', native_name: 'English', dtmf_key: '1', tts_locale: 'en-IN' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', dtmf_key: '2', tts_locale: 'hi-IN' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', dtmf_key: '3', tts_locale: 'ta-IN' },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', dtmf_key: '4', tts_locale: 'te-IN' },
  { code: 'kn', name: 'Kannada', native_name: 'ಕನ್ನಡ', dtmf_key: '5', tts_locale: 'kn-IN' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', dtmf_key: '6', tts_locale: 'bn-IN' },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', dtmf_key: '7', tts_locale: 'mr-IN' },
  { code: 'gu', name: 'Gujarati', native_name: 'ગુજરાતી', dtmf_key: '8', tts_locale: 'gu-IN' },
];

export const DTMF_TO_LANG_CODE = {
  '1': 'en',
  '2': 'hi',
  '3': 'ta',
  '4': 'te',
  '5': 'kn',
  '6': 'bn',
  '7': 'mr',
  '8': 'gu',
};

export const INDIC_HOTLINE_CATALOG = {
  en: {
    welcome: 'Welcome to the KshemOS Cyber Safety Hotline. For English press 1, हिन्दी के लिए 2 दबाएं, தமிழுக்கு 3 அழுத்தவும், తెలుగు కోసం 4 నొక్కండి, ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿ, বাংলার জন্য 6 চাপুন, मराठीसाठी 7 दाबा, ગુજરાતી માટે 8 દબાવો.',
    prompt_authority: 'Did the caller claim to be customs or police? Press 1 for Yes, Press 2 for No.',
    prompt_extortion: 'Did they demand money to avoid arrest, demand a secret transfer, or threaten video digital arrest? Press 1 for Yes, Press 2 for No.',
    reassurance: 'Government agencies never demand online transfers or video arrest. Hang up immediately. You are safe. We have sent an emergency helpline summary via SMS.',
    sms_template: 'KshemOS Safety Alert: Official government agencies, courts, and police NEVER demand online money transfers or "digital arrest". If you transferred funds, immediately call National Cyber Helpline 1930 or visit https://cybercrime.gov.in. Nearest Cyber Desk: {nearest_desk}.',
  },
  hi: {
    welcome: 'क्षेमओएस साइबर सुरक्षा हेल्पलाइन में आपका स्वागत है। अंग्रेजी के लिए 1 दबाएं, हिन्दी के लिए 2 दबाएं...',
    prompt_authority: 'क्या फोन करने वाले ने खुद को कस्टम्स, पुलिस, सीबीआई या टेलीकॉम अधिकारी बताया? हाँ के लिए 1 दबाएं, नहीं के लिए 2 दबाएं।',
    prompt_extortion: 'क्या उन्होंने गिरफ्तारी से बचने के लिए पैसे, सीक्रेट ऑनलाइन ट्रांसफर की मांग की या डिजिटल अरेस्ट की धमकी दी? हाँ के लिए 1 दबाएं, नहीं के लिए 2 दबाएं।',
    reassurance: 'सरकारी एजेंसियां कभी भी ऑनलाइन ट्रांसफर या वीडियो अरेस्ट की मांग नहीं करती हैं। तुरंत फोन काट दें। आप सुरक्षित हैं। हमने आपके मोबाइल पर आपातकालीन हेल्पलाइन एसएमएस भेज दिया है।',
    sms_template: 'क्षेमओएस सुरक्षा चेतावनी: सरकारी एजेंसियां या पुलिस कभी भी ऑनलाइन पैसे ट्रांसफर या "डिजिटल अरेस्ट" की मांग नहीं करती हैं। तुरंत राष्ट्रीय साइबर हेल्पलाइन 1930 पर कॉल करें या cybercrime.gov.in पर जाएं। निकटतम साइबर डेस्क: {nearest_desk}.',
  },
  ta: {
    welcome: 'க்ஷேம்ஓஎஸ் சைபர் பாதுகாப்பு உதவி மையத்திற்கு வரவேற்கிறோம்.',
    prompt_authority: 'அழைப்பாளர் சுங்கத்துறை, காவல்துறை அல்லது சிபிஐ அதிகாரி என்று கூறினாரா? ஆம் என்றால் 1 ஐ அழுத்தவும், இல்லை என்றால் 2 ஐ அழுத்தவும்.',
    prompt_extortion: 'கைதைத் தவிர்க்க பணம், ரகசிய வங்கி பரிமாற்றம் கேட்டாரா அல்லது டிஜிட்டல் அரெஸ்ட் என மிரட்டினாரா? ஆம் என்றால் 1 ஐ அழுத்தவும், இல்லை என்றால் 2 ஐ அழுத்தவும்.',
    reassurance: 'அரசு அமைப்புகள் ஒருபோதும் ஆன்லைன் பணப்பரிமாற்றம் அல்லது வீடியோ கைது கோருவதில்லை. உடனடியாக அழைப்பைத் துண்டிக்கவும். நீங்கள் பாதுகாப்பாக உள்ளீர்கள். அவசர உதவி விவரங்கள் குறுஞ்செய்தியாக அனுப்பப்பட்டுள்ளன.',
    sms_template: 'KshemOS பாதுகாப்பு எச்சரிக்கை: அரசு அமைப்புகளோ காவல்துறையோ ஆன்லைன் பணப் பரிமாற்றம் கோருவதில்லை. உடனடியாக 1930 என்ற எண்ணை அழைக்கவும் அல்லது cybercrime.gov.in இணையதளத்தை அணுகவும். அருகிலுள்ள சைபர் மையம்: {nearest_desk}.',
  },
  te: {
    welcome: 'క్షేమ్‌ఓఎస్ సైబర్ సేఫ్టీ హెల్ప్‌లైన్‌కు స్వాగతం.',
    prompt_authority: 'కాలర్ కస్టమ్స్, పోలీస్ లేదా సీబీఐ అధికారి అని చెప్పారా? అవును అయితే 1 నొక్కండి, కాదు అయితే 2 నొక్కండి.',
    prompt_extortion: 'అరెస్ట్ కాకుండా ఉండటానికి డబ్బు, సీక్రెట్ ఆన్‌లైన్ బదిలీ డిమాండ్ చేశారా లేదా డిజిటల్ అరెస్ట్ చేస్తామని బెదిరించారా? అవును అయితే 1 నొక్కండి, కాదు అయితే 2 నొక్కండి.',
    reassurance: 'ప్రభుత్వ సంస్థలు ఎప్పుడూ ఆన్‌లైన్ నగదు బదిలీ లేదా వీడియో అరెస్టును డిమాండ్ చేయవు. వెంటనే ఫోన్ కట్ చేయండి. మీరు సురక్షితంగా ఉన్నారు. అత్యవసర సహాయ వివరాలు ఎస్ఎంఎస్ ద్వారా పంపబడ్డాయి.',
    sms_template: 'KshemOS భద్రతా హెచ్చరిక: ప్రభుత్వ సంస్థలు లేదా పోలీసులు ఎప్పుడూ ఆన్‌లైన్ నగదు బదిలీని కోరరు. వెంటనే 1930 హెల్ప్‌లైన్‌కు కాల్ చేయండి లేదా cybercrime.gov.in సందర్శించండి. సమీప సైబర్ డెస్క్: {nearest_desk}.',
  },
  kn: {
    welcome: 'ಕ್ಷೇಮ್‌ಓಎಸ್ ಸೈಬರ್ ಸುರಕ್ಷತಾ ಸಹಾಯವಾಣಿಗೆ ಸುಸ್ವಾಗತ.',
    prompt_authority: 'ಕರೆ ಮಾಡಿದವರು ಕಸ್ಟಮ್ಸ್, ಪೊಲೀಸ್ ಅಥವಾ ಸಿಬಿಐ ಅಧಿಕಾರಿ ಎಂದು ಹೇಳಿಕೊಂಡಿದ್ದಾರೆಯೇ? ಹೌದು ಎಂದಾದರೆ 1 ಒತ್ತಿ, ಇಲ್ಲ ಎಂದಾದರೆ 2 ಒತ್ತಿ.',
    prompt_extortion: 'ಬಂಧನ ತಪ್ಪಿಸಲು ಹಣ, ರಹಸ್ಯ ಆನ್‌ಲೈನ್ ವರ್ಗಾವಣೆಗೆ ಒತ್ತಾಯಿಸಿದರೇ ಅಥವಾ ಡಿಜಿಟಲ್ ಅರೆಸ್ಟ್ ಬೆದರಿಕೆ ಹಾಕಿದರೇ? ಹೌದು ಎಂದಾದರೆ 1 ಒತ್ತಿ, ಇಲ್ಲ ಎಂದಾದರೆ 2 ಒತ್ತಿ.',
    reassurance: 'ಸರ್ಕಾರಿ ಸಂಸ್ಥೆಗಳು ಎಂದಿಗೂ ಆನ್‌ಲೈನ್ ಹಣ ವರ್ಗಾವಣೆ ಅಥವಾ ವಿಡಿಯೋ ಬಂಧನಕ್ಕೆ ಒತ್ತಾಯಿಸುವುದಿಲ್ಲ. ತಕ್ಷಣ ಕರೆಯನ್ನು ಕಡಿತಗೊಳಿಸಿ. ನೀವು ಸುರಕ್ಷಿತವಾಗಿದ್ದೀರಿ. ತುರ್ತು ಸಹಾಯ ವಿವರಗಳನ್ನು ಎಸ್‌ಎಂಎಸ್ ಮೂಲಕ ಕಳುಹಿಸಲಾಗಿದೆ.',
    sms_template: 'KshemOS ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆ: ಸರ್ಕಾರಿ ಸಂಸ್ಥೆಗಳು ಎಂದಿಗೂ ಆನ್‌ಲೈನ್ ಹಣ ವರ್ಗಾವಣೆಯನ್ನು ಕೇಳುವುದಿಲ್ಲ. ತಕ್ಷಣ 1930 ಸಹಾಯವಾಣಿಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ cybercrime.gov.in ಗೆ ಭೇಟಿ ನೀಡಿ. ಹತ್ತಿರದ ಸೈಬರ್ ಡೆಸ್ಕ್: {nearest_desk}.',
  },
  bn: {
    welcome: 'ক্ষেমওএস সাইবার সুরক্ষা হেল্পলাইনে আপনাকে স্বাগতম।',
    prompt_authority: 'কলার কি নিজেকে কাস্টমস, পুলিশ বা সিবিআই কর্মকর্তা দাবি করেছে? হ্যাঁ হলে 1 চাপুন, না হলে 2 চাপুন।',
    prompt_extortion: 'গ্রেপ্তার এড়াতে কি টাকা বা গোপন অনলাইন ট্রান্সফার দাবি করেছে অথবা ডিজিটাল অ্যারেস্টের হুমকি দিয়েছে? হ্যাঁ হলে 1 চাপুন, না হলে 2 চাপুন।',
    reassurance: 'সরকারি দপ্তর বা পুলিশ কখনোই অনলাইনে টাকা দাবি করে না অথবা ভিডিওতে গ্রেপ্তার করে না। অবিলম্বে ফোন কেটে দিন। আপনি নিরাপদ। জরুরি তথ্য এসএমএস-এর মাধ্যমে পাঠানো হয়েছে।',
    sms_template: 'KshemOS সতর্কতা: সরকারি সংস্থা কখনো অনলাইন টাকা দাবি করে না। অবিলম্বে 1930 হেল্পলাইনে কল করুন বা cybercrime.gov.in দেখুন। নিকটস্থ সাইবার ডেস্ক: {nearest_desk}.',
  },
  mr: {
    welcome: 'क्षेमओएस सायबर सुरक्षा हेल्पलाईनमध्ये आपले स्वागत आहे.',
    prompt_authority: 'कॉल करणाऱ्याने स्वतःला कस्टम्स, पोलीस किंवा सीबीआय अधिकारी असल्याचे सांगितले का? होय साठी 1 दाबा, नाही साठी 2 दाबा.',
    prompt_extortion: 'अटक टाळण्यासाठी त्यांनी पैसे, गुप्त ऑनलाइन ट्रान्सफर मागितले किंवा डिजिटल अरेस्टची धमकी दिली का? होय साठी 1 दाबा, नाही साठी 2 दाबा.',
    reassurance: 'सरकारी यंत्रणा कधीही ऑनलाइन पैसे ट्रान्सफर किंवा व्हिडिओ अरेस्टची मागणी करत नाहीत. फोन त्वरित कट करा. आपण सुरक्षित आहात. आपत्कालीन हेल्पलाइन एसएमएस पाठवला आहे.',
    sms_template: 'KshemOS सुरक्षा इशारा: सरकारी यंत्रणा किंवा पोलीस कधीही ऑनलाइन पैसे ट्रान्सफर मागत नाहीत. त्वरित 1930 वर कॉल करा किंवा cybercrime.gov.in ला भेट द्या. जवळचे सायबर पोलीस स्टेशन: {nearest_desk}.',
  },
  gu: {
    welcome: 'ક્ષેમઓએસ સાયબર સુરક્ષા હેલ્પલાઇનમાં આપનું સ્વાગત છે.',
    prompt_authority: 'કૉલ કરનારે પોતાને કસ્ટમ્સ, પોલીસ કે સીબીઆઈ અધિકારી ગણાવ્યા? હા માટે 1 દબાવો, ના માટે 2 દબાવો.',
    prompt_extortion: 'ધરપકડ ટાળવા માટે તેમણે પૈસા, ગુપ્ત ઑનલાઇન ટ્રાન્સફરની માંગ કરી અથવા ડિજિટલ અરેસ્ટની ધમકી આપી? હા માટે 1 દબાવો, ના માટે 2 દબાવો.',
    reassurance: 'સરકારી એજન્સીઓ ક્યારેય ઑનલાઇન ટ્રાન્સફર કે વીડિયો અરેસ્ટની માંગ કરતી નથી. તરત જ ફોન કાપી નાખો. તમે સુરક્ષિત છો. કટોકટી હેલ્પલાઇન એસએમએસ મોકલેલ છે.',
    sms_template: 'KshemOS સુરક્ષા ચેતવણી: સરકારી એજન્સીઓ કે પોલીસ ક્યારેય ઑનલાઇન પૈસા ટ્રાન્સફર માંગતી નથી. તરત જ 1930 હેલ્પલાઇન પર કૉલ કરો અથવા cybercrime.gov.in ની મુલાકાત લો. નજીકનું સાયબર ડેસ્ક: {nearest_desk}.',
  },
};

export const REGIONAL_CYBER_DESKS = {
  Delhi: { desk: 'Cyber Crime Police Station, Rohini & Central Delhi (011-20892601)', region: 'North Zone' },
  Mumbai: { desk: 'BKC Cyber Police Station, Bandra Kurla Complex, Mumbai (022-26504008)', region: 'West Zone' },
  Maharashtra: { desk: 'Maharashtra State Cyber HQ & Pune Cyber Cell (020-25672222)', region: 'West Zone' },
  Karnataka: { desk: 'CID Cyber Crime Police Station, Carlton House, Bengaluru (080-22094493)', region: 'South Zone' },
  Bengaluru: { desk: 'CID Cyber Crime Police Station, Carlton House, Bengaluru (080-22094493)', region: 'South Zone' },
  'Tamil Nadu': { desk: 'Cyber Crime Wing, Police Headquarters, Chennai (044-28447701)', region: 'South Zone' },
  Chennai: { desk: 'Cyber Crime Wing, Police Headquarters, Chennai (044-28447701)', region: 'South Zone' },
  Telangana: { desk: 'Cyber Crime Police Station, Cyberabad, Hyderabad (040-27852412)', region: 'South Zone' },
  Hyderabad: { desk: 'Cyber Crime Police Station, Cyberabad, Hyderabad (040-27852412)', region: 'South Zone' },
  'West Bengal': { desk: 'Cyber Crime Police Station, Lalbazar, Kolkata (033-22143000)', region: 'East Zone' },
  Kolkata: { desk: 'Cyber Crime Police Station, Lalbazar, Kolkata (033-22143000)', region: 'East Zone' },
  Gujarat: { desk: 'Cyber Crime Police Station, Crime Branch, Ahmedabad (079-25633660)', region: 'West Zone' },
  Ahmedabad: { desk: 'Cyber Crime Police Station, Crime Branch, Ahmedabad (079-25633660)', region: 'West Zone' },
};

export const DEFAULT_CYBER_DESK = 'State Cyber Crime Police Desk & I4C National Command (Helpline: 1930)';
export const DEFAULT_REGION = 'Central Zone';

export function resolveDesk(circle = 'Delhi') {
  for (const [key, val] of Object.entries(REGIONAL_CYBER_DESKS)) {
    if (circle.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  return { desk: DEFAULT_CYBER_DESK, region: DEFAULT_REGION };
}

// -----------------------------------------------------------------------------
// Web Audio DTMF Tone Player (Dual-Tone Multi-Frequency)
// -----------------------------------------------------------------------------
const DTMF_FREQS = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

let _audioCtx = null;

export function playDtmfTone(digit, durationMs = 120) {
  if (typeof window === 'undefined') return;
  const freqs = DTMF_FREQS[digit];
  if (!freqs) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!_audioCtx) {
      _audioCtx = new AudioContextClass();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }

    const osc1 = _audioCtx.createOscillator();
    const osc2 = _audioCtx.createOscillator();
    const gainNode = _audioCtx.createGain();

    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];
    gainNode.gain.setValueAtTime(0.12, _audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + durationMs / 1000);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(_audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(_audioCtx.currentTime + durationMs / 1000);
    osc2.stop(_audioCtx.currentTime + durationMs / 1000);
  } catch {}
}

// -----------------------------------------------------------------------------
// Web Speech API Synthesis Helper
// -----------------------------------------------------------------------------
export function speakText(text, locale = 'en-IN') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

// -----------------------------------------------------------------------------
// Pure Local IVR State Machine Simulator (Offline Capable)
// -----------------------------------------------------------------------------
const _localSessions = new Map();
const STORAGE_KEY_HOTLINE_SESSIONS = 'kshemos_voice_hotline_sessions_v1';
const STORAGE_KEY_DISPATCHED_SMS = 'kshemos_voice_hotline_sms_v1';

function readStorage(key, fallback) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return fallback;
}

function writeStorage(key, val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(val));
    }
  } catch {}
}

export function maskPhoneLocally(phone) {
  if (!phone) return 'ANONYMOUS_CALLER';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length >= 4) {
    return `+91 XXXXX ${clean.slice(-4)}`;
  }
  return 'ANONYMOUS_CALLER';
}

export function startLocalVoiceHotlineCall({ caller_phone = '+91 98765 43210', initial_language = 'en', telecom_circle = 'Delhi' } = {}) {
  const sessionId = `HOTLINE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const lang = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === initial_language) ? initial_language : 'en';
  const { desk } = resolveDesk(telecom_circle);

  const session = {
    session_id: sessionId,
    caller_phone_masked: maskPhoneLocally(caller_phone),
    language: lang,
    telecom_circle: telecom_circle || 'Delhi',
    call_status: 'IN_PROGRESS',
    created_at: Date.now(),
    updated_at: Date.now(),
    current_step: 'WELCOME_LANG_SELECT',
    dtmf_history: [],
    claimed_authority: null,
    demanded_money: null,
    reassurance_delivered: false,
    sms_dispatched: false,
    sms_text: null,
    nearest_cyber_desk: desk,
    triage_incident_id: null,
  };

  _localSessions.set(sessionId, session);
  const existing = readStorage(STORAGE_KEY_HOTLINE_SESSIONS, []);
  writeStorage(STORAGE_KEY_HOTLINE_SESSIONS, [session, ...existing]);

  const catalog = INDIC_HOTLINE_CATALOG[lang] || INDIC_HOTLINE_CATALOG.en;
  const langInfo = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_INDIC_LANGUAGES[0];

  return {
    session_id: sessionId,
    current_step: 'WELCOME_LANG_SELECT',
    selected_language: lang,
    audio_text: catalog.welcome,
    audio_locale: langInfo.tts_locale,
    allowed_dtmf_keys: ['1', '2', '3', '4', '5', '6', '7', '8'],
    nearest_cyber_desk: desk,
    is_completed: false,
  };
}

export function processLocalVoiceHotlineInput({ session_id, dtmf_digit, speech_input = null }) {
  let session = _localSessions.get(session_id);
  if (!session) {
    const list = readStorage(STORAGE_KEY_HOTLINE_SESSIONS, []);
    session = list.find((s) => s.session_id === session_id);
    if (session) _localSessions.set(session_id, session);
  }
  if (!session) throw new Error(`Hotline session ${session_id} not found.`);

  const now = Date.now();
  session.updated_at = now;
  const digit = String(dtmf_digit || '').trim();

  session.dtmf_history.push({
    step: session.current_step,
    digit,
    speech: speech_input,
    timestamp: now,
  });

  let lang = session.language;
  const { desk, region } = resolveDesk(session.telecom_circle);

  // Step 0: Language Selection
  if (session.current_step === 'WELCOME_LANG_SELECT') {
    if (DTMF_TO_LANG_CODE[digit]) {
      lang = DTMF_TO_LANG_CODE[digit];
      session.language = lang;
    }
    session.current_step = 'PROMPT_AUTHORITY';
    const catalog = INDIC_HOTLINE_CATALOG[lang] || INDIC_HOTLINE_CATALOG.en;
    const langInfo = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_INDIC_LANGUAGES[0];

    saveSessionLocally(session);
    return {
      session_id: session.session_id,
      current_step: 'PROMPT_AUTHORITY',
      selected_language: lang,
      audio_text: catalog.prompt_authority,
      audio_locale: langInfo.tts_locale,
      allowed_dtmf_keys: ['1', '2'],
      nearest_cyber_desk: desk,
      is_completed: false,
    };
  }

  // Step 1: Authority Prompt
  if (session.current_step === 'PROMPT_AUTHORITY') {
    const claimedAuth = digit === '1';
    session.claimed_authority = claimedAuth;
    session.current_step = 'PROMPT_EXTORTION';

    const catalog = INDIC_HOTLINE_CATALOG[lang] || INDIC_HOTLINE_CATALOG.en;
    const langInfo = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_INDIC_LANGUAGES[0];

    saveSessionLocally(session);
    return {
      session_id: session.session_id,
      current_step: 'PROMPT_EXTORTION',
      selected_language: lang,
      audio_text: catalog.prompt_extortion,
      audio_locale: langInfo.tts_locale,
      allowed_dtmf_keys: ['1', '2'],
      claimed_authority: claimedAuth,
      nearest_cyber_desk: desk,
      is_completed: false,
    };
  }

  // Step 2: Extortion Prompt -> Reassurance & Automated Actions
  if (session.current_step === 'PROMPT_EXTORTION' || session.current_step === 'REASSURANCE') {
    const demandedMoney = digit === '1';
    session.demanded_money = demandedMoney;
    session.current_step = 'COMPLETED';
    session.call_status = 'COMPLETED';
    session.reassurance_delivered = true;

    const catalog = INDIC_HOTLINE_CATALOG[lang] || INDIC_HOTLINE_CATALOG.en;
    const langInfo = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_INDIC_LANGUAGES[0];
    const reassuranceText = catalog.reassurance;

    // Automated SMS dispatch
    const smsText = catalog.sms_template.replace('{nearest_desk}', desk);
    session.sms_dispatched = true;
    session.sms_text = smsText;

    const dispatchedList = readStorage(STORAGE_KEY_DISPATCHED_SMS, []);
    writeStorage(STORAGE_KEY_DISPATCHED_SMS, [
      {
        session_id: session.session_id,
        recipient_phone: session.caller_phone_masked,
        sms_text: smsText,
        dispatched_at: now,
      },
      ...dispatchedList,
    ]);

    // Automated anonymous incident entry into regional triage feed
    try {
      const authStr = session.claimed_authority ? 'Customs / Police / CBI impersonated' : 'Unknown caller claim';
      const extortStr = demandedMoney ? 'Money / Secret Transfer demanded' : 'No direct payment yet';
      const triageDesc = `Anonymous Voice Safety Hotline Deflection (${langInfo.name}): ${authStr}. ${extortStr}. Calm spoken reassurance delivered. Dispatched 1930 & ${desk}.`;

      const inc = createIncident(
        {
          category: 'digital_arrest',
          description: triageDesc,
          region,
          report_id: `HOTLINE-${session.session_id.slice(-6)}`,
          linked_account: 'N/A',
        },
        {
          id: `INC-HOTLINE-${session.session_id.slice(-6)}`,
          severity: session.claimed_authority && demandedMoney ? 'critical' : 'high',
          now,
        }
      );
      session.triage_incident_id = inc.id;
    } catch {
      session.triage_incident_id = `INC-HOTLINE-${session.session_id.slice(-6)}`;
    }

    saveSessionLocally(session);
    return {
      session_id: session.session_id,
      current_step: 'COMPLETED',
      selected_language: lang,
      audio_text: reassuranceText,
      audio_locale: langInfo.tts_locale,
      allowed_dtmf_keys: [],
      claimed_authority: session.claimed_authority,
      demanded_money: demandedMoney,
      reassurance_delivered: true,
      sms_dispatched: true,
      sms_summary: smsText,
      nearest_cyber_desk: desk,
      triage_incident_id: session.triage_incident_id,
      is_completed: true,
    };
  }

  // Already completed fallback
  const catalog = INDIC_HOTLINE_CATALOG[lang] || INDIC_HOTLINE_CATALOG.en;
  const langInfo = SUPPORTED_INDIC_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_INDIC_LANGUAGES[0];
  return {
    session_id: session.session_id,
    current_step: 'COMPLETED',
    selected_language: lang,
    audio_text: catalog.reassurance,
    audio_locale: langInfo.tts_locale,
    allowed_dtmf_keys: [],
    claimed_authority: session.claimed_authority,
    demanded_money: session.demanded_money,
    reassurance_delivered: true,
    sms_dispatched: session.sms_dispatched,
    sms_summary: session.sms_text,
    nearest_cyber_desk: desk,
    triage_incident_id: session.triage_incident_id,
    is_completed: true,
  };
}

function saveSessionLocally(session) {
  _localSessions.set(session.session_id, session);
  const list = readStorage(STORAGE_KEY_HOTLINE_SESSIONS, []);
  const idx = list.findIndex((s) => s.session_id === session.session_id);
  if (idx >= 0) {
    list[idx] = session;
  } else {
    list.unshift(session);
  }
  writeStorage(STORAGE_KEY_HOTLINE_SESSIONS, list);
}

export function listLocalVoiceHotlineSessions() {
  return readStorage(STORAGE_KEY_HOTLINE_SESSIONS, []);
}

export function getLocalDispatchedSms() {
  return readStorage(STORAGE_KEY_DISPATCHED_SMS, []);
}

// -----------------------------------------------------------------------------
// Backend API Connectors
// -----------------------------------------------------------------------------
const API_BASE = '/api/voice-hotline';

export async function fetchVoiceHotlineLanguagesApi() {
  const res = await fetch(`${API_BASE}/languages`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch hotline languages`);
  return await res.json();
}

export async function startVoiceHotlineCallApi(payload) {
  const res = await fetch(`${API_BASE}/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to start hotline call`);
  return await res.json();
}

export async function submitVoiceHotlineInputApi(payload) {
  const res = await fetch(`${API_BASE}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to submit hotline input`);
  return await res.json();
}

export async function listVoiceHotlineSessionsApi(status = null, language = null) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (language) params.set('language', language);
  const q = params.toString();
  const res = await fetch(`${API_BASE}/sessions${q ? `?${q}` : ''}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to list hotline sessions`);
  return await res.json();
}

export async function getVoiceHotlineStatsApi() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch hotline stats`);
  return await res.json();
}

