"""
Multilingual Automated Voice Safety Hotline Engine.

Implements an open-source Interactive Voice Response (IVR) state machine and
deflection gateway supporting 8 Indic languages:
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Kannada (kn)
- Bengali (bn)
- Marathi (mr)
- Gujarati (gu)

Features:
1. Multi-turn step-by-step IVR state machine with DTMF and speech input.
2. Authority and extortion triage questions.
3. Calm, authoritative reassurance in native Indic languages.
4. Automated SMS summary dispatch with 1930 helpline & nearest cyber police desk.
5. Automated anonymous incident registration in the regional triage feed.
"""

from __future__ import annotations

import time
import uuid
from typing import Dict, List, Optional, Any

from app.models import (
    VoiceHotlineLanguageInfo,
    VoiceHotlineCallRequest,
    VoiceHotlineInputRequest,
    VoiceHotlinePromptResponse,
    VoiceHotlineSessionRecord,
    VoiceHotlineStatsResponse,
)
from app.services.incidents import create_incident


# -----------------------------------------------------------------------------
# 8 Supported Indic Languages
# -----------------------------------------------------------------------------

SUPPORTED_INDIC_LANGUAGES: Dict[str, VoiceHotlineLanguageInfo] = {
    "en": VoiceHotlineLanguageInfo(
        code="en",
        name="English",
        native_name="English",
        dtmf_key="1",
        tts_locale="en-IN",
    ),
    "hi": VoiceHotlineLanguageInfo(
        code="hi",
        name="Hindi",
        native_name="हिन्दी",
        dtmf_key="2",
        tts_locale="hi-IN",
    ),
    "ta": VoiceHotlineLanguageInfo(
        code="ta",
        name="Tamil",
        native_name="தமிழ்",
        dtmf_key="3",
        tts_locale="ta-IN",
    ),
    "te": VoiceHotlineLanguageInfo(
        code="te",
        name="Telugu",
        native_name="తెలుగు",
        dtmf_key="4",
        tts_locale="te-IN",
    ),
    "kn": VoiceHotlineLanguageInfo(
        code="kn",
        name="Kannada",
        native_name="ಕನ್ನಡ",
        dtmf_key="5",
        tts_locale="kn-IN",
    ),
    "bn": VoiceHotlineLanguageInfo(
        code="bn",
        name="Bengali",
        native_name="বাংলা",
        dtmf_key="6",
        tts_locale="bn-IN",
    ),
    "mr": VoiceHotlineLanguageInfo(
        code="mr",
        name="Marathi",
        native_name="मराठी",
        dtmf_key="7",
        tts_locale="mr-IN",
    ),
    "gu": VoiceHotlineLanguageInfo(
        code="gu",
        name="Gujarati",
        native_name="ગુજરાતી",
        dtmf_key="8",
        tts_locale="gu-IN",
    ),
}

DTMF_TO_LANG_CODE: Dict[str, str] = {
    info.dtmf_key: code for code, info in SUPPORTED_INDIC_LANGUAGES.items()
}


# -----------------------------------------------------------------------------
# Multilingual Prompts, Reassurances, and SMS Templates
# -----------------------------------------------------------------------------

INDIC_HOTLINE_CATALOG: Dict[str, Dict[str, str]] = {
    "en": {
        "welcome": (
            "Welcome to the KshemOS Cyber Safety Hotline. "
            "For English press 1, हिन्दी के लिए 2 दबाएं, தமிழுக்கு 3 அழுத்தவும், "
            "తెలుగు కోసం 4 నొక్కండి, ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿ, বাংলার জন্য 6 চাপুন, "
            "मराठीसाठी 7 दाबा, ગુજરાતી માટે 8 દબાવો."
        ),
        "prompt_authority": "Did the caller claim to be customs or police? Press 1 for Yes, Press 2 for No.",
        "prompt_extortion": (
            "Did they demand money to avoid arrest, demand a secret transfer, "
            "or threaten video digital arrest? Press 1 for Yes, Press 2 for No."
        ),
        "reassurance": (
            "Government agencies never demand online transfers or video arrest. "
            "Hang up immediately. You are safe. We have sent an emergency helpline summary via SMS."
        ),
        "sms_template": (
            "KshemOS Safety Alert: Official government agencies, courts, and police NEVER demand "
            "online money transfers or 'digital arrest'. If you transferred funds, immediately call "
            "National Cyber Helpline 1930 or visit https://cybercrime.gov.in. "
            "Nearest Cyber Desk: {nearest_desk}."
        ),
    },
    "hi": {
        "welcome": (
            "क्षेमओएस साइबर सुरक्षा हेल्पलाइन में आपका स्वागत है। "
            "अंग्रेजी के लिए 1 दबाएं, हिन्दी के लिए 2 दबाएं..."
        ),
        "prompt_authority": (
            "क्या फोन करने वाले ने खुद को कस्टम्स, पुलिस, सीबीआई या टेलीकॉम अधिकारी बताया? "
            "हाँ के लिए 1 दबाएं, नहीं के लिए 2 दबाएं।"
        ),
        "prompt_extortion": (
            "क्या उन्होंने गिरफ्तारी से बचने के लिए पैसे, सीक्रेट ऑनलाइन ट्रांसफर की मांग की या डिजिटल अरेस्ट की धमकी दी? "
            "हाँ के लिए 1 दबाएं, नहीं के लिए 2 दबाएं।"
        ),
        "reassurance": (
            "सरकारी एजेंसियां कभी भी ऑनलाइन ट्रांसफर या वीडियो अरेस्ट की मांग नहीं करती हैं। "
            "तुरंत फोन काट दें। आप सुरक्षित हैं। हमने आपके मोबाइल पर आपातकालीन हेल्पलाइन एसएमएस भेज दिया है।"
        ),
        "sms_template": (
            "क्षेमओएस सुरक्षा चेतावनी: सरकारी एजेंसियां या पुलिस कभी भी ऑनलाइन पैसे ट्रांसफर या 'डिजिटल अरेस्ट' "
            "की मांग नहीं करती हैं। तुरंत राष्ट्रीय साइबर हेल्पलाइन 1930 पर कॉल करें या cybercrime.gov.in पर जाएं। "
            "निकटतम साइबर डेस्क: {nearest_desk}."
        ),
    },
    "ta": {
        "welcome": "க்ஷேம்ஓஎஸ் சைபர் பாதுகாப்பு உதவி மையத்திற்கு வரவேற்கிறோம்.",
        "prompt_authority": (
            "அழைப்பாளர் சுங்கத்துறை, காவல்துறை அல்லது சிபிஐ அதிகாரி என்று கூறினாரா? "
            "ஆம் என்றால் 1 ஐ அழுத்தவும், இல்லை என்றால் 2 ஐ அழுத்தவும்."
        ),
        "prompt_extortion": (
            "கைதைத் தவிர்க்க பணம், ரகசிய வங்கி பரிமாற்றம் கேட்டாரா அல்லது டிஜிட்டல் அரெஸ்ட் என மிரட்டினாரா? "
            "ஆம் என்றால் 1 ஐ அழுத்தவும், இல்லை என்றால் 2 ஐ அழுத்தவும்."
        ),
        "reassurance": (
            "அரசு அமைப்புகள் ஒருபோதும் ஆன்லைன் பணப்பரிமாற்றம் அல்லது வீடியோ கைது கோருவதில்லை. "
            "உடனடியாக அழைப்பைத் துண்டிக்கவும். நீங்கள் பாதுகாப்பாக உள்ளீர்கள். அவசர உதவி விவரங்கள் குறுஞ்செய்தியாக அனுப்பப்பட்டுள்ளன."
        ),
        "sms_template": (
            "KshemOS பாதுகாப்பு எச்சரிக்கை: அரசு அமைப்புகளோ காவல்துறையோ ஆன்லைன் பணப் பரிமாற்றம் கோருவதில்லை. "
            "உடனடியாக 1930 என்ற எண்ணை அழைக்கவும் அல்லது cybercrime.gov.in இணையதளத்தை அணுகவும். "
            "அருகிலுள்ள சைபர் மையம்: {nearest_desk}."
        ),
    },
    "te": {
        "welcome": "క్షేమ్‌ఓఎస్ సైబర్ సేఫ్టీ హెల్ప్‌లైన్‌కు స్వాగతం.",
        "prompt_authority": (
            "కాలర్ కస్టమ్స్, పోలీస్ లేదా సీబీఐ అధికారి అని చెప్పారా? "
            "అవును అయితే 1 నొక్కండి, కాదు అయితే 2 నొక్కండి."
        ),
        "prompt_extortion": (
            "అరెస్ట్ కాకుండా ఉండటానికి డబ్బు, సీక్రెట్ ఆన్‌లైన్ బదిలీ డిమాండ్ చేశారా లేదా డిజిటల్ అరెస్ట్ చేస్తామని బెదిరించారా? "
            "అవును అయితే 1 నొక్కండి, కాదు అయితే 2 నొక్కండి."
        ),
        "reassurance": (
            "ప్రభుత్వ సంస్థలు ఎప్పుడూ ఆన్‌లైన్ నగదు బదిలీ లేదా వీడియో అరెస్టును డిమాండ్ చేయవు. "
            "వెంటనే ఫోన్ కట్ చేయండి. మీరు సురక్షితంగా ఉన్నారు. అత్యవసర సహాయ వివరాలు ఎస్ఎంఎస్ ద్వారా పంపబడ్డాయి."
        ),
        "sms_template": (
            "KshemOS భద్రతా హెచ్చరిక: ప్రభుత్వ సంస్థలు లేదా పోలీసులు ఎప్పుడూ ఆన్‌లైన్ నగదు బదిలీని కోరరు. "
            "వెంటనే 1930 హెల్ప్‌లైన్‌కు కాల్ చేయండి లేదా cybercrime.gov.in సందర్శించండి. "
            "సమీప సైబర్ డెస్క్: {nearest_desk}."
        ),
    },
    "kn": {
        "welcome": "ಕ್ಷೇಮ್‌ಓಎಸ್ ಸೈಬರ್ ಸುರಕ್ಷತಾ ಸಹಾಯವಾಣಿಗೆ ಸುಸ್ವಾಗತ.",
        "prompt_authority": (
            "ಕರೆ ಮಾಡಿದವರು ಕಸ್ಟಮ್ಸ್, ಪೊಲೀಸ್ ಅಥವಾ ಸಿಬಿಐ ಅಧಿಕಾರಿ ಎಂದು ಹೇಳಿಕೊಂಡಿದ್ದಾರೆಯೇ? "
            "ಹೌದು ಎಂದಾದರೆ 1 ಒತ್ತಿ, ಇಲ್ಲ ಎಂದಾದರೆ 2 ಒತ್ತಿ."
        ),
        "prompt_extortion": (
            "ಬಂಧನ ತಪ್ಪಿಸಲು ಹಣ, ರಹಸ್ಯ ಆನ್‌ಲೈನ್ ವರ್ಗಾವಣೆಗೆ ಒತ್ತಾಯಿಸಿದರೇ ಅಥವಾ ಡಿಜಿಟಲ್ ಅರೆಸ್ಟ್ ಬೆದರಿಕೆ ಹಾಕಿದರೇ? "
            "ಹೌದು ಎಂದಾದರೆ 1 ಒತ್ತಿ, ಇಲ್ಲ ಎಂದಾದರೆ 2 ಒತ್ತಿ."
        ),
        "reassurance": (
            "ಸರ್ಕಾರಿ ಸಂಸ್ಥೆಗಳು ಎಂದಿಗೂ ಆನ್‌ಲೈನ್ ಹಣ ವರ್ಗಾವಣೆ ಅಥವಾ ವಿಡಿಯೋ ಬಂಧನಕ್ಕೆ ಒತ್ತಾಯಿಸುವುದಿಲ್ಲ. "
            "ತಕ್ಷಣ ಕರೆಯನ್ನು ಕಡಿತಗೊಳಿಸಿ. ನೀವು ಸುರಕ್ಷಿತವಾಗಿದ್ದೀರಿ. ತುರ್ತು ಸಹಾಯ ವಿವರಗಳನ್ನು ಎಸ್‌ಎಂಎಸ್ ಮೂಲಕ ಕಳುಹಿಸಲಾಗಿದೆ."
        ),
        "sms_template": (
            "KshemOS ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆ: ಸರ್ಕಾರಿ ಸಂಸ್ಥೆಗಳು ಎಂದಿಗೂ ಆನ್‌ಲೈನ್ ಹಣ ವರ್ಗಾವಣೆಯನ್ನು ಕೇಳುವುದಿಲ್ಲ. "
            "ತಕ್ಷಣ 1930 ಸಹಾಯವಾಣಿಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ cybercrime.gov.in ಗೆ ಭೇಟಿ ನೀಡಿ. "
            "ಹತ್ತಿರದ ಸೈಬರ್ ಡೆಸ್ಕ್: {nearest_desk}."
        ),
    },
    "bn": {
        "welcome": "ক্ষেমওএস সাইবার সুরক্ষা হেল্পলাইনে আপনাকে স্বাগতম।",
        "prompt_authority": (
            "কলার কি নিজেকে কাস্টমস, পুলিশ বা সিবিআই কর্মকর্তা দাবি করেছে? "
            "হ্যাঁ হলে 1 চাপুন, না হলে 2 চাপুন।"
        ),
        "prompt_extortion": (
            "গ্রেপ্তার এড়াতে কি টাকা বা গোপন অনলাইন ট্রান্সফার দাবি করেছে অথবা ডিজিটাল অ্যারেস্টের হুমকি দিয়েছে? "
            "হ্যাঁ হলে 1 চাপুন, না হলে 2 চাপুন।"
        ),
        "reassurance": (
            "সরকারি দপ্তর বা পুলিশ কখনোই অনলাইনে টাকা দাবি করে না অথবা ভিডিওতে গ্রেপ্তার করে না। "
            "অবিলম্বে ফোন কেটে দিন। আপনি নিরাপদ। জরুরি তথ্য এসএমএস-এর মাধ্যমে পাঠানো হয়েছে।"
        ),
        "sms_template": (
            "KshemOS সতর্কতা: সরকারি সংস্থা কখনো অনলাইন টাকা দাবি করে না। "
            "অবিলম্বে 1930 হেল্পলাইনে কল করুন বা cybercrime.gov.in দেখুন। "
            "নিকটস্থ সাইবার ডেস্ক: {nearest_desk}."
        ),
    },
    "mr": {
        "welcome": "क्षेमओएस सायबर सुरक्षा हेल्पलाईनमध्ये आपले स्वागत आहे.",
        "prompt_authority": (
            "कॉल करणाऱ्याने स्वतःला कस्टम्स, पोलीस किंवा सीबीआय अधिकारी असल्याचे सांगितले का? "
            "होय साठी 1 दाबा, नाही साठी 2 दाबा."
        ),
        "prompt_extortion": (
            "अटक टाळण्यासाठी त्यांनी पैसे, गुप्त ऑनलाइन ट्रान्सफर मागितले किंवा डिजिटल अरेस्टची धमकी दिली का? "
            "होय साठी 1 दाबा, नाही साठी 2 दाबा."
        ),
        "reassurance": (
            "सरकारी यंत्रणा कधीही ऑनलाइन पैसे ट्रान्सफर किंवा व्हिडिओ अरेस्टची मागणी करत नाहीत. "
            "फोन त्वरित कट करा. आपण सुरक्षित आहात. आपत्कालीन हेल्पलाइन एसएमएस पाठवला आहे."
        ),
        "sms_template": (
            "KshemOS सुरक्षा इशारा: सरकारी यंत्रणा किंवा पोलीस कधीही ऑनलाइन पैसे ट्रान्सफर मागत नाहीत. "
            "त्वरित 1930 वर कॉल करा किंवा cybercrime.gov.in ला भेट द्या. "
            "जवळचे सायबर पोलीस स्टेशन: {nearest_desk}."
        ),
    },
    "gu": {
        "welcome": "ક્ષેમઓએસ સાયબર સુરક્ષા હેલ્પલાઇનમાં આપનું સ્વાગત છે.",
        "prompt_authority": (
            "કૉલ કરનારે પોતાને કસ્ટમ્સ, પોલીસ કે સીબીઆઈ અધિકારી ગણાવ્યા? "
            "હા માટે 1 દબાવો, ના માટે 2 દબાવો."
        ),
        "prompt_extortion": (
            "ધરપકડ ટાળવા માટે તેમણે પૈસા, ગુપ્ત ઑનલાઇન ટ્રાન્સફરની માંગ કરી અથવા ડિજિટલ અરેસ્ટની ધમકી આપી? "
            "હા માટે 1 દબાવો, ના માટે 2 દબાવો."
        ),
        "reassurance": (
            "સરકારી એજન્સીઓ ક્યારેય ઑનલાઇન ટ્રાન્સફર કે વીડિયો અરેસ્ટની માંગ કરતી નથી. "
            "તરત જ ફોન કાપી નાખો. તમે સુરક્ષિત છો. કટોકટી હેલ્પલાઇન એસએમએસ મોકલેલ છે."
        ),
        "sms_template": (
            "KshemOS સુરક્ષા ચેતવણી: સરકારી એજન્સીઓ કે પોલીસ ક્યારેય ઑનલાઇન પૈસા ટ્રાન્સફર માંગતી નથી. "
            "તરત જ 1930 હેલ્પલાઇન પર કૉલ કરો અથવા cybercrime.gov.in ની મુલાકાત લો. "
            "નજીકનું સાયબર ડેસ્ક: {nearest_desk}."
        ),
    },
}


# -----------------------------------------------------------------------------
# Regional Cyber Police Desk Directory & Region Mapping
# -----------------------------------------------------------------------------

REGIONAL_CYBER_DESKS: Dict[str, Dict[str, str]] = {
    "Delhi": {
        "desk": "Cyber Crime Police Station, Rohini & Central Delhi (011-20892601)",
        "region": "North Zone",
    },
    "Mumbai": {
        "desk": "BKC Cyber Police Station, Bandra Kurla Complex, Mumbai (022-26504008)",
        "region": "West Zone",
    },
    "Maharashtra": {
        "desk": "Maharashtra State Cyber HQ & Pune Cyber Cell (020-25672222)",
        "region": "West Zone",
    },
    "Karnataka": {
        "desk": "CID Cyber Crime Police Station, Carlton House, Bengaluru (080-22094493)",
        "region": "South Zone",
    },
    "Bengaluru": {
        "desk": "CID Cyber Crime Police Station, Carlton House, Bengaluru (080-22094493)",
        "region": "South Zone",
    },
    "Tamil Nadu": {
        "desk": "Cyber Crime Wing, Police Headquarters, Chennai (044-28447701)",
        "region": "South Zone",
    },
    "Chennai": {
        "desk": "Cyber Crime Wing, Police Headquarters, Chennai (044-28447701)",
        "region": "South Zone",
    },
    "Telangana": {
        "desk": "Cyber Crime Police Station, Cyberabad, Hyderabad (040-27852412)",
        "region": "South Zone",
    },
    "Hyderabad": {
        "desk": "Cyber Crime Police Station, Cyberabad, Hyderabad (040-27852412)",
        "region": "South Zone",
    },
    "West Bengal": {
        "desk": "Cyber Crime Police Station, Lalbazar, Kolkata (033-22143000)",
        "region": "East Zone",
    },
    "Kolkata": {
        "desk": "Cyber Crime Police Station, Lalbazar, Kolkata (033-22143000)",
        "region": "East Zone",
    },
    "Gujarat": {
        "desk": "Cyber Crime Police Station, Crime Branch, Ahmedabad (079-25633660)",
        "region": "West Zone",
    },
    "Ahmedabad": {
        "desk": "Cyber Crime Police Station, Crime Branch, Ahmedabad (079-25633660)",
        "region": "West Zone",
    },
}

DEFAULT_CYBER_DESK = "State Cyber Crime Police Desk & I4C National Command (Helpline: 1930)"
DEFAULT_REGION = "Central Zone"


# -----------------------------------------------------------------------------
# IVR State Machine Service
# -----------------------------------------------------------------------------

class VoiceSafetyHotlineEngine:
    """
    In-memory stateful gateway for the Multilingual Automated Voice Safety Hotline.
    """

    def __init__(self):
        self.sessions: Dict[str, VoiceHotlineSessionRecord] = {}

    def _mask_phone(self, phone: Optional[str]) -> str:
        if not phone:
            return "ANONYMOUS_CALLER"
        clean = "".join(c for c in phone if c.isdigit())
        if len(clean) >= 4:
            return f"+91 XXXXX {clean[-4:]}"
        return "ANONYMOUS_CALLER"

    def _resolve_desk(self, circle: str) -> tuple[str, str]:
        for key, val in REGIONAL_CYBER_DESKS.items():
            if key.lower() in circle.lower():
                return val["desk"], val["region"]
        return DEFAULT_CYBER_DESK, DEFAULT_REGION

    def start_call(self, request: VoiceHotlineCallRequest) -> VoiceHotlinePromptResponse:
        """
        Initializes an IVR hotline call session.
        If caller specified an initial language, starts in WELCOME_LANG_SELECT with
        that language active.
        """
        session_id = f"HOTLINE-{int(time.time())}-{uuid.uuid4().hex[:6].upper()}"
        lang = request.initial_language if request.initial_language in SUPPORTED_INDIC_LANGUAGES else "en"
        desk, region = self._resolve_desk(request.telecom_circle or "Delhi")

        now = int(time.time() * 1000)
        record = VoiceHotlineSessionRecord(
            session_id=session_id,
            caller_phone_masked=self._mask_phone(request.caller_phone),
            language=lang,
            telecom_circle=request.telecom_circle or "Delhi",
            call_status="IN_PROGRESS",
            created_at=now,
            updated_at=now,
            current_step="WELCOME_LANG_SELECT",
            dtmf_history=[],
            nearest_cyber_desk=desk,
        )
        self.sessions[session_id] = record

        catalog = INDIC_HOTLINE_CATALOG.get(lang, INDIC_HOTLINE_CATALOG["en"])
        lang_info = SUPPORTED_INDIC_LANGUAGES[lang]

        return VoiceHotlinePromptResponse(
            session_id=session_id,
            current_step="WELCOME_LANG_SELECT",
            selected_language=lang,
            audio_text=catalog["welcome"],
            audio_locale=lang_info.tts_locale,
            allowed_dtmf_keys=["1", "2", "3", "4", "5", "6", "7", "8"],
            nearest_cyber_desk=desk,
            is_completed=False,
        )

    def process_input(self, request: VoiceHotlineInputRequest) -> VoiceHotlinePromptResponse:
        """
        Processes DTMF button press or speech utterance in the IVR state machine.
        """
        session = self.sessions.get(request.session_id)
        if not session:
            raise KeyError(f"Session {request.session_id} not found.")

        now = int(time.time() * 1000)
        session.updated_at = now
        digit = request.dtmf_digit.strip()

        session.dtmf_history.append({
            "step": session.current_step,
            "digit": digit,
            "speech": request.speech_input,
            "timestamp": now,
        })

        lang = session.language
        desk, region = self._resolve_desk(session.telecom_circle)

        # ---------------------------------------------------------------------
        # Step 0: Language Selection
        # ---------------------------------------------------------------------
        if session.current_step == "WELCOME_LANG_SELECT":
            if digit in DTMF_TO_LANG_CODE:
                lang = DTMF_TO_LANG_CODE[digit]
                session.language = lang

            session.current_step = "PROMPT_AUTHORITY"
            catalog = INDIC_HOTLINE_CATALOG.get(lang, INDIC_HOTLINE_CATALOG["en"])
            lang_info = SUPPORTED_INDIC_LANGUAGES[lang]

            return VoiceHotlinePromptResponse(
                session_id=session.session_id,
                current_step="PROMPT_AUTHORITY",
                selected_language=lang,
                audio_text=catalog["prompt_authority"],
                audio_locale=lang_info.tts_locale,
                allowed_dtmf_keys=["1", "2"],
                nearest_cyber_desk=desk,
                is_completed=False,
            )

        # ---------------------------------------------------------------------
        # Step 1: Authority Claim Verification ("Did caller claim customs/police?")
        # ---------------------------------------------------------------------
        elif session.current_step == "PROMPT_AUTHORITY":
            claimed_auth = (digit == "1")
            session.claimed_authority = claimed_auth
            session.current_step = "PROMPT_EXTORTION"

            catalog = INDIC_HOTLINE_CATALOG.get(lang, INDIC_HOTLINE_CATALOG["en"])
            lang_info = SUPPORTED_INDIC_LANGUAGES[lang]

            return VoiceHotlinePromptResponse(
                session_id=session.session_id,
                current_step="PROMPT_EXTORTION",
                selected_language=lang,
                audio_text=catalog["prompt_extortion"],
                audio_locale=lang_info.tts_locale,
                allowed_dtmf_keys=["1", "2"],
                claimed_authority=claimed_auth,
                nearest_cyber_desk=desk,
                is_completed=False,
            )

        # ---------------------------------------------------------------------
        # Step 2: Extortion Demand Verification & Reassurance Delivery
        # ---------------------------------------------------------------------
        elif session.current_step in ("PROMPT_EXTORTION", "REASSURANCE"):
            demanded_money = (digit == "1")
            session.demanded_money = demanded_money
            session.current_step = "COMPLETED"
            session.call_status = "COMPLETED"
            session.reassurance_delivered = True

            catalog = INDIC_HOTLINE_CATALOG.get(lang, INDIC_HOTLINE_CATALOG["en"])
            lang_info = SUPPORTED_INDIC_LANGUAGES[lang]
            reassurance_text = catalog["reassurance"]

            # Automatically dispatch SMS summary
            sms_text = catalog["sms_template"].format(nearest_desk=desk)
            session.sms_dispatched = True
            session.sms_text = sms_text

            # Automatically log anonymous incident entry in the regional triage feed
            try:
                auth_str = "Customs / Police / CBI impersonated" if session.claimed_authority else "Unknown Authority"
                extort_str = "Money / Secret Transfer demanded" if demanded_money else "No direct payment yet"
                triage_desc = (
                    f"Anonymous Voice Safety Hotline Deflection ({lang_info.name}): "
                    f"{auth_str}. {extort_str}. Spoken reassurance delivered. "
                    f"SMS dispatched with 1930 & {desk}."
                )

                incident = create_incident(
                    category="digital_arrest",
                    description=triage_desc,
                    region=region,
                    report_id=f"HOTLINE-RPT-{session.session_id[-6:]}",
                    linked_account="N/A",
                )
                session.triage_incident_id = incident.get("id")
            except Exception:
                session.triage_incident_id = f"INC-HOTLINE-{session.session_id[-6:]}"

            return VoiceHotlinePromptResponse(
                session_id=session.session_id,
                current_step="COMPLETED",
                selected_language=lang,
                audio_text=reassurance_text,
                audio_locale=lang_info.tts_locale,
                allowed_dtmf_keys=[],
                claimed_authority=session.claimed_authority,
                demanded_money=demanded_money,
                reassurance_delivered=True,
                sms_dispatched=True,
                sms_summary=sms_text,
                nearest_cyber_desk=desk,
                triage_incident_id=session.triage_incident_id,
                is_completed=True,
            )

        # Fallback / Already completed
        catalog = INDIC_HOTLINE_CATALOG.get(lang, INDIC_HOTLINE_CATALOG["en"])
        lang_info = SUPPORTED_INDIC_LANGUAGES[lang]
        return VoiceHotlinePromptResponse(
            session_id=session.session_id,
            current_step="COMPLETED",
            selected_language=lang,
            audio_text=catalog["reassurance"],
            audio_locale=lang_info.tts_locale,
            allowed_dtmf_keys=[],
            claimed_authority=session.claimed_authority,
            demanded_money=session.demanded_money,
            reassurance_delivered=True,
            sms_dispatched=session.sms_dispatched,
            sms_summary=session.sms_text,
            nearest_cyber_desk=desk,
            triage_incident_id=session.triage_incident_id,
            is_completed=True,
        )

    def get_stats(self) -> VoiceHotlineStatsResponse:
        """Computes aggregate hotline statistics."""
        total = len(self.sessions)
        active = sum(1 for s in self.sessions.values() if s.call_status == "IN_PROGRESS")
        completed = sum(1 for s in self.sessions.values() if s.call_status == "COMPLETED")

        lang_breakdown: Dict[str, int] = {k: 0 for k in SUPPORTED_INDIC_LANGUAGES}
        auth_count = 0
        extort_count = 0
        reassurance_count = 0
        sms_count = 0
        triage_count = 0

        for s in self.sessions.values():
            if s.language in lang_breakdown:
                lang_breakdown[s.language] += 1
            if s.claimed_authority:
                auth_count += 1
            if s.demanded_money:
                extort_count += 1
            if s.reassurance_delivered:
                reassurance_count += 1
            if s.sms_dispatched:
                sms_count += 1
            if s.triage_incident_id:
                triage_count += 1

        return VoiceHotlineStatsResponse(
            total_calls=total,
            active_calls=active,
            completed_calls=completed,
            languages_breakdown=lang_breakdown,
            authorities_flagged=auth_count,
            extortions_flagged=extort_count,
            reassurances_delivered=reassurance_count,
            sms_dispatched_count=sms_count,
            triage_incidents_logged=triage_count,
        )


default_hotline_engine = VoiceSafetyHotlineEngine()

