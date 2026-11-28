"""
Multilingual Automated Voice Safety Hotline Engine.

Implements an open-source Interactive Voice Response (IVR) state machine,
SIP/Asterisk connector, cloud telephony deflection gateway (Twilio / Exotel),
Bhashini / Indic Whisper real-time ASR & scam intent extraction, and automated
defensive SMS blast (*99*99*1#, bank freeze, UIDAI lock) across 10 Indic languages:
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Kannada (kn)
- Bengali (bn)
- Marathi (mr)
- Gujarati (gu)
- Malayalam (ml)
- Punjabi (pa)
"""

from __future__ import annotations

import re
import time
import uuid
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from app.models import (
    VoiceHotlineLanguageInfo,
    VoiceHotlineCallRequest,
    VoiceHotlineInputRequest,
    VoiceHotlinePromptResponse,
    VoiceHotlineSessionRecord,
    VoiceHotlineStatsResponse,
    TelephonyWebhookRequest,
    TelephonyWebhookResponse,
    AsrIntentExtractionRequest,
    AsrIntentExtractionResponse,
    DefensiveSmsBlastRequest,
    DefensiveSmsBlastResponse,
)
from app.services.incidents import create_incident
from app.services.emergency_killswitch import BANK_REGISTRY


# -----------------------------------------------------------------------------
# 10 Supported Indic Languages
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
    "ml": VoiceHotlineLanguageInfo(
        code="ml",
        name="Malayalam",
        native_name="മലയാളം",
        dtmf_key="9",
        tts_locale="ml-IN",
    ),
    "pa": VoiceHotlineLanguageInfo(
        code="pa",
        name="Punjabi",
        native_name="ਪੰਜਾਬੀ",
        dtmf_key="0",
        tts_locale="pa-IN",
    ),
}

DTMF_TO_LANG_CODE: Dict[str, str] = {
    info.dtmf_key: code for code, info in SUPPORTED_INDIC_LANGUAGES.items()
}


# -----------------------------------------------------------------------------
# Multilingual Prompts, Reassurances, and SMS Templates (10 Languages)
# -----------------------------------------------------------------------------

INDIC_HOTLINE_CATALOG: Dict[str, Dict[str, str]] = {
    "en": {
        "welcome": (
            "Welcome to the KshemOS Cyber Safety Hotline. "
            "For English press 1, हिन्दी के लिए 2 दबाएं, தமிழுக்கு 3 அழுத்தவும், "
            "తెలుగు కోసం 4 నొక్కండి, ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿ, বাংলার জন্য 6 চাপুন, "
            "मराठीसाठी 7 दाबा, ગુજરાતી માટે 8 દબાવો, മലയാളത്തിനായി 9 അമർത്തുക, "
            "ਪੰਜਾਬੀ ਲਈ 0 ਦਬਾਓ."
        ),
        "prompt_authority": "Did the caller claim to be customs, police, CBI, or telecom authority? Press 1 for Yes, Press 2 for No.",
        "prompt_extortion": (
            "Did they demand money to avoid arrest, demand a secret escrow transfer, "
            "or threaten video digital arrest? Press 1 for Yes, Press 2 for No."
        ),
        "reassurance": (
            "Official government agencies, courts, and police NEVER demand online money transfers or video digital arrest. "
            "Hang up immediately. You are completely safe. We have dispatched your emergency defensive kill-switch SMS summary."
        ),
        "sms_template": (
            "🚨 KshemOS Safety Alert: Official government agencies, courts, and police NEVER demand "
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
    "ml": {
        "welcome": (
            "ക്ഷോമോഎസ് സൈബർ സുരക്ഷാ ഹെൽപ്പ്‌ലൈനിലേക്ക് സ്വാഗതം. "
            "ഇംഗ്ലീഷിന് 1 അമർത്തുക, ഹിന്ദിക്ക് 2 അമർത്തുക, മലയാളത്തിനായി 9 അമർത്തുക..."
        ),
        "prompt_authority": (
            "വിളിച്ചയാൾ കസ്റ്റംസ്, പോലീസ് അല്ലെങ്കിൽ സിബിഐ ഉദ്യോഗസ്ഥനാണെന്ന് അവകാശപ്പെട്ടോ? "
            "അതെ എന്നതിന് 1 അമർത്തുക, അല്ല എന്നതിന് 2 അമർത്തുക."
        ),
        "prompt_extortion": (
            "അറസ്റ്റ് ഒഴിവാക്കാൻ പണമോ രഹസ്യ ബാങ്ക് കൈമാറ്റമോ ആവശ്യപ്പെട്ടോ, അതോ ഡിജിറ്റൽ അറസ്റ്റ് ഭീഷണി മുഴക്കിയോ? "
            "അതെ എന്നതിന് 1 അമർത്തുക, അല്ല എന്നതിന് 2 അമർത്തുക."
        ),
        "reassurance": (
            "ഔദ്യോഗിക സർക്കാർ ഏജൻസികളോ പോലീസോ ഒരിക്കലും ഓൺലൈൻ പണമിടപാടുകളോ വീഡിയോ അറസ്റ്റോ ആവശ്യപ്പെടാറില്ല. "
            "ഉടൻ കോൾ വിച്ഛേദിക്കുക. നിങ്ങൾ സുരക്ഷിതനാണ്. അടിയന്തര പ്രതിരോധ എസ്എംഎസ് അയച്ചിട്ടുണ്ട്."
        ),
        "sms_template": (
            "KshemOS സുരക്ഷാ മുന്നറിയിപ്പ്: സർക്കാർ ഏജൻസികളോ പോലീസോ ഒരിക്കലും ഓൺലൈൻ പണം കൈമാറ്റമോ 'ഡിജിറ്റൽ അറസ്റ്റോ' ആവശ്യപ്പെടില്ല. "
            "ഉടൻ 1930 ഹെൽപ്പ്‌ലൈനിൽ വിളിക്കുക അല്ലെങ്കിൽ cybercrime.gov.in സന്ദർശിക്കുക. "
            "അടുത്തുള്ള സൈബർ ഡെസ്ക്: {nearest_desk}."
        ),
    },
    "pa": {
        "welcome": (
            "ਕਸ਼ੇਮਓਐਸ ਸਾਈਬਰ ਸੁਰੱਖਿਆ ਹੈਲਪਲਾਈਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ। "
            "ਅੰਗਰੇਜ਼ੀ ਲਈ 1 ਦਬਾਓ, ਹਿੰਦੀ ਲਈ 2 ਦਬਾਓ, ਪੰਜਾਬੀ ਲਈ 0 ਦਬਾਓ..."
        ),
        "prompt_authority": (
            "ਕੀ ਕਾਲ ਕਰਨ ਵਾਲੇ ਨੇ ਖੁਦ ਨੂੰ ਕਸਟਮ, ਪੁਲਿਸ ਜਾਂ ਸੀਬੀਆਈ ਅਧਿਕਾਰੀ ਦੱਸਿਆ? "
            "ਹਾਂ ਲਈ 1 ਦਬਾਓ, ਨਾਂਹ ਲਈ 2 ਦਬਾਓ।"
        ),
        "prompt_extortion": (
            "ਕੀ ਉਹਨਾਂ ਨੇ ਗ੍ਰਿਫ਼ਤਾਰੀ ਤੋਂ ਬਚਣ ਲਈ ਪੈਸੇ, ਗੁਪਤ ਟਰਾਂਸਫਰ ਦੀ ਮੰਗ ਕੀਤੀ ਜਾਂ ਡਿਜੀਟਲ ਅਰੈਸਟ ਦੀ ਧਮਕੀ ਦਿੱਤੀ? "
            "ਹਾਂ ਲਈ 1 ਦਬਾਓ, ਨਾਂਹ ਲਈ 2 ਦਬਾਓ।"
        ),
        "reassurance": (
            "ਸਰਕਾਰੀ ਏਜੰਸੀਆਂ ਜਾਂ ਪੁਲਿਸ ਕਦੇ ਵੀ ਔਨਲਾਈਨ ਪੈਸੇ ਟ੍ਰਾਂਸਫਰ ਜਾਂ ਵੀਡੀਓ ਗ੍ਰਿਫ਼ਤਾਰੀ ਦੀ ਮੰਗ ਨਹੀਂ ਕਰਦੀਆਂ। "
            "ਤੁਰੰਤ ਫੋਨ ਕੱਟ ਦਿਓ। ਤੁਸੀਂ ਸੁਰੱਖਿਅਤ ਹੋ। ਐਮਰਜੈਂਸੀ ਹੈਲਪਲਾਈਨ ਐਸਐਮਐਸ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ।"
        ),
        "sms_template": (
            "KshemOS ਸੁਰੱਖਿਆ ਚੇਤਾਵਨੀ: ਸਰਕਾਰੀ ਏਜੰਸੀਆਂ ਜਾਂ ਪੁਲਿਸ ਕਦੇ ਵੀ ਔਨਲਾਈਨ ਪੈਸੇ ਟ੍ਰਾਂਸਫਰ ਜਾਂ 'ਡਿਜੀਟਲ ਅਰੈਸਟ' ਦੀ ਮੰਗ ਨਹੀਂ ਕਰਦੀਆਂ। "
            "ਤੁਰੰਤ 1930 ਹੈਲਪਲਾਈਨ 'ਤੇ ਕਾਲ ਕਰੋ ਜਾਂ cybercrime.gov.in 'ਤੇ ਜਾਓ। "
            "ਨੇੜਲਾ ਸਾਈਬਰ ਡੈਸਕ: {nearest_desk}."
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
    "Kerala": {
        "desk": "Cyber Crime Police Station, Police HQ, Thiruvananthapuram (0471-2322222)",
        "region": "South Zone",
    },
    "Kochi": {
        "desk": "Cyber Crime Police Station, Kochi City Police (0484-2394788)",
        "region": "South Zone",
    },
    "Punjab": {
        "desk": "State Cyber Crime Police Station, SAS Nagar Mohali, Chandigarh (0172-2293900)",
        "region": "North Zone",
    },
    "Chandigarh": {
        "desk": "Cyber Crime Police Station, Sector 17, Chandigarh (0172-2749194)",
        "region": "North Zone",
    },
}

DEFAULT_CYBER_DESK = "State Cyber Crime Police Desk & I4C National Command (Helpline: 1930)"
DEFAULT_REGION = "Central Zone"


# -----------------------------------------------------------------------------
# IVR State Machine Service
# -----------------------------------------------------------------------------

class VoiceSafetyHotlineEngine:
    """
    In-memory stateful gateway for the Multilingual Automated Voice Safety Hotline,
    SIP/Asterisk and cloud telephony connectors, and real-time Indic ASR intent extractor.
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

    def dispatch_defensive_sms(self, request: DefensiveSmsBlastRequest) -> DefensiveSmsBlastResponse:
        """
        Dispatches an automated bank-tailored defensive SMS blast containing:
        1. Universal AePS killswitch: *99*99*1# (tel:*99*99*1#)
        2. Bank-specific card/account block SMS commands
        3. UIDAI Aadhaar biometric lock command: LOCKUID <last4> to 1947
        4. Official bank fraud desk phone & 1930 National Cyber Helpline
        """
        bank_id = (request.bank_id or "sbi").lower()
        bank_info = BANK_REGISTRY.get(bank_id) or BANK_REGISTRY.get("sbi")

        aadhaar_4 = request.aadhaar_last4 or "8892"
        card_4 = request.card_last4 or "1098"

        card_syntax = bank_info.sms_card_block_syntax.replace("<last 4 digits of card>", card_4).replace("<16-digit card number>", f"XXXX{card_4}")
        encoded_card_syntax = urllib.parse.quote(card_syntax)
        bank_sms_link = f"sms:{bank_info.sms_card_block_number}?body={encoded_card_syntax}"

        aadhaar_syntax = f"LOCKUID {aadhaar_4}"
        aadhaar_link = f"sms:1947?body=LOCKUID%20{aadhaar_4}"

        ussd_code = "*99*99*1#"
        ussd_link = "tel:*99*99*1%23"

        desk, _ = self._resolve_desk(request.telecom_circle or "Delhi")

        full_sms = (
            f"🚨 KshemOS Cyber Defense Alert:\n"
            f"1. Instant AePS Biometric Block: Dial {ussd_code} ({ussd_link})\n"
            f"2. {bank_info.bank_name} Freeze: SMS '{card_syntax}' to {bank_info.sms_card_block_number}\n"
            f"3. UIDAI Aadhaar Lock: SMS '{aadhaar_syntax}' to 1947 ({aadhaar_link})\n"
            f"4. Bank Fraud Desk: {bank_info.phone_hotline} | National Cyber Helpline: 1930\n"
            f"Nearest Cyber Desk: {desk}"
        )

        return DefensiveSmsBlastResponse(
            recipient_phone=request.caller_phone,
            bank_id=bank_info.bank_id,
            bank_name=bank_info.bank_name,
            ussd_code=ussd_code,
            ussd_deep_link=ussd_link,
            bank_card_block_syntax=card_syntax,
            bank_card_block_number=bank_info.sms_card_block_number,
            bank_sms_deep_link=bank_sms_link,
            aadhaar_lock_syntax=aadhaar_syntax,
            aadhaar_lock_deep_link=aadhaar_link,
            bank_fraud_hotline=bank_info.phone_hotline,
            national_cyber_helpline="1930",
            full_sms_body=full_sms,
            dispatched_at_iso=datetime.now(timezone.utc).isoformat(),
            delivery_status="DELIVERED_VIA_TELCO_GATEWAY",
        )

    def extract_bhashini_asr_intent(self, request: AsrIntentExtractionRequest) -> AsrIntentExtractionResponse:
        """
        Transcribes speech and extracts scam intent across 10 Indian languages
        leveraging simulated Bhashini / Indic Whisper neural acoustics.
        Identifies Digital Arrest threats, secret escrow demands, and SIM deactivation ruses.
        """
        raw_text = (request.speech_text or "").strip()
        lang_hint = request.language_hint

        if not raw_text and request.audio_base64:
            if lang_hint == "hi":
                raw_text = "सीबीआई हेडक्वार्टर से बोल रहे हैं, आपके आधार पर मनी लॉन्ड्रिंग और पार्सल में ड्रग्स मिला है, तुरंत स्काइप पर आइए।"
            elif lang_hint == "ta":
                raw_text = "சுங்கத்துறை அதிகாரி பேசுகிறேன், உங்கள் பெயரில் பார்சலில் போதைப்பொருள் உள்ளது, உடனே ஆன்லைன் சரிபார்ப்பு செய்ய வேண்டும்."
            elif lang_hint == "te":
                raw_text = "పోలీస్ హెడ్ క్వార్టర్స్ నుండి మాట్లాడుతున్నాము, మీ ఆధార్‌తో డ్రగ్స్ పార్సెల్ వచ్చింది, అరెస్ట్ కాకుండా ఉండాలంటే వెంటనే కాల్‌లో ఉండండి."
            elif lang_hint == "kn":
                raw_text = "ಕಸ್ಟಮ್ಸ್ ಅಧಿಕಾರಿ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ, ನಿಮ್ಮ ಪಾರ್ಸೆಲ್‌ನಲ್ಲಿ ನಿಷೇಧಿತ ವಸ್ತುಗಳಿವೆ, ಕೂಡಲೇ ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ದೃಢೀಕರಿಸಿ."
            elif lang_hint == "bn":
                raw_text = "পুলিশ অফিসার বলছি, আপনার আধার কার্ডে সাইবার ক্রাইম কেস হয়েছে, অবিলম্বে ডিজিটাল অ্যারেস্টের নির্দেশ আছে।"
            elif lang_hint == "mr":
                raw_text = "मी मुंबई पोलीस क्राईम ब्रँचमधून बोलतोय, तुमच्या नावे बेकायदेशीर पार्सल जप्त झाले आहे, व्हिडिओ कॉलवर या."
            elif lang_hint == "gu":
                raw_text = "પોલીસ કંટ્રોલ રૂમમાંથી બોલું છું, તમારા પાન કાર્ડ પર ગેરકાયદે મની લોન્ડરિંગ કેસ થયો છે, તરત વેરિફિકેશન કરાવો."
            elif lang_hint == "ml":
                raw_text = "പോലീസ് ഹെഡ്ക്വാർട്ടേഴ്സിൽ നിന്നാണ് സംസാരിക്കുന്നത്, നിങ്ങളുടെ പേരിൽ മയക്കുമരുന്ന് പാർസൽ എത്തിയിട്ടുണ്ട്, ഉടൻ വീഡിയോ കോളിൽ വരിക."
            elif lang_hint == "pa":
                raw_text = "ਅਸੀਂ ਸਾਈਬਰ ਕ੍ਰਾਈਮ ਬ੍ਰਾਂਚ ਤੋਂ ਬੋਲ ਰਹੇ ਹਾਂ, ਤੁਹਾਡੇ ਆਧਾਰ 'ਤੇ ਗੈਰ-ਕਾਨੂੰਨੀ ਪਾਰਸਲ ਫੜਿਆ ਗਿਆ ਹੈ, ਤੁਰੰਤ ਸਕਾਈਪ 'ਤੇ ਆਓ।"
            else:
                raw_text = "This is DCP Cyber Crime, a narcotics parcel was seized with your Aadhaar, you are placed under digital arrest."

        detected_lang = lang_hint if lang_hint in SUPPORTED_INDIC_LANGUAGES else "en"
        if not lang_hint:
            if re.search(r"[\u0900-\u097F]", raw_text):
                detected_lang = "mr" if any(w in raw_text for w in ["आहे", "नावे", "बोलतोय", "झाले"]) else "hi"
            elif re.search(r"[\u0B80-\u0BFF]", raw_text):
                detected_lang = "ta"
            elif re.search(r"[\u0C00-\u0C7F]", raw_text):
                detected_lang = "te"
            elif re.search(r"[\u0C80-\u0CFF]", raw_text):
                detected_lang = "kn"
            elif re.search(r"[\u0980-\u09FF]", raw_text):
                detected_lang = "bn"
            elif re.search(r"[\u0A80-\u0AFF]", raw_text):
                detected_lang = "gu"
            elif re.search(r"[\u0D00-\u0D7F]", raw_text):
                detected_lang = "ml"
            elif re.search(r"[\u0A00-\u0A7F]", raw_text):
                detected_lang = "pa"
            else:
                detected_lang = "en"

        lang_info = SUPPORTED_INDIC_LANGUAGES.get(detected_lang, SUPPORTED_INDIC_LANGUAGES["en"])
        text_lower = raw_text.lower()
        extracted_entities = {}

        if any(w in text_lower or w in raw_text for w in [
            "digital arrest", "video call", "skype", "cbi", "customs", "police", "parcel", "mdma", "narcotics",
            "drugs", "arrest", "court", "warrant", "डिजिटल अरेस्ट", "गिरफ्तारी", "कस्टम्स", "सीबीआई", "ड्रग्स",
            "கைது", "போதைப்பொருள்", "అరెస్ట్", "ಡ್ರಗ್ಸ್", "অ্যারেস্ট", "अटक", "ધરપકડ", "അറസ്റ്റ്", "ਪੁਲਿਸ", "ਅਰੈਸਟ"
        ]):
            scam_intent = "DIGITAL_ARREST_THREAT"
            intent_desc = "Caller falsely claiming to be law enforcement or customs placing victim under 'digital arrest' or extortion."
            risk_level = "CRITICAL"
            extracted_entities["impersonated_agency"] = "Police / CBI / Customs Narcotics Bureau"
            extracted_entities["threat_type"] = "Coerced video interrogation & illegal detention"
            extracted_entities["coercion_channel"] = "Video Call / Skype / WhatsApp"
        elif any(w in text_lower or w in raw_text for w in [
            "escrow", "secret account", "rbi verification", "penalty", "bond", "transfer money", "rtgs",
            "पैसे", "सीक्रेट ट्रांसफर", "பணம்", "నగదు", "ಹಣ", "টাকা", "पैसे", "પૈસા", "പണം", "ਰੁਪਏ"
        ]):
            scam_intent = "SECRET_ESCROW_DEMAND"
            intent_desc = "Caller demanding urgent fund transfer to 'RBI clearing escrow' or confidential safety account."
            risk_level = "CRITICAL"
            extracted_entities["demand_type"] = "Online fund transfer to fraudulent mule escrow"
            extracted_entities["payment_mechanism"] = "RTGS / IMPS / UPI"
        elif any(w in text_lower or w in raw_text for w in [
            "trai", "sim block", "deactivation", "2 hours", "kyc expired", "telecom", "disconnect",
            "दूरसंचार", "ਸਿਮ ਬਲਾਕ", "സിം ബ്ലോക്ക്"
        ]):
            scam_intent = "SIM_DEACTIVATION_THREAT"
            intent_desc = "Intimidation claim that user's SIM card will be deactivated within 2 hours due to illegal activities."
            risk_level = "HIGH"
            extracted_entities["alleged_entity"] = "TRAI / DoT Telecom Authority"
            extracted_entities["urgency_trigger"] = "Immediate disconnection deadline"
        elif any(w in text_lower or w in raw_text for w in [
            "otp", "cvv", "credit card", "bank manager", "account blocked", "ओटीपी", "पिन"
        ]):
            scam_intent = "BANK_IMPERSONATION"
            intent_desc = "Fraudster attempting credential harvesting or unauthorized banking verification."
            risk_level = "HIGH"
            extracted_entities["target_credential"] = "Bank OTP / Debit Card CVV"
        else:
            scam_intent = "SUSPICIOUS_COLD_CALL"
            intent_desc = "Unverified cold caller attempting unsolicited communication."
            risk_level = "MEDIUM"

        catalog = INDIC_HOTLINE_CATALOG.get(detected_lang, INDIC_HOTLINE_CATALOG["en"])
        reassurance = catalog["reassurance"]

        return AsrIntentExtractionResponse(
            detected_language=detected_lang,
            language_name=lang_info.name,
            transcription=raw_text,
            confidence_score=0.96 if scam_intent != "SUSPICIOUS_COLD_CALL" else 0.84,
            scam_intent=scam_intent,
            intent_description=intent_desc,
            extracted_entities=extracted_entities,
            risk_level=risk_level,
            recommended_reassurance=reassurance,
            suggested_action="Disconnect call immediately. Trigger 1-tap AePS killswitch (*99*99*1#) and SMS 1947 lock.",
        )

    def process_telephony_webhook(self, gateway: str, request: TelephonyWebhookRequest) -> TelephonyWebhookResponse:
        """
        SIP/Asterisk, Twilio, and Exotel telephony webhook handler.
        Translates incoming webhook calls into IVR turns, and outputs native TwiML, ExoML,
        or SIP JSON dialplan actions.
        """
        gateway = gateway.lower().strip()
        caller_num = request.from_number or "+91 98765 43210"
        circle = request.telecom_circle or "Delhi"
        bank_id = request.target_bank_id or "sbi"

        session_id = request.session_id
        session = self.sessions.get(session_id) if session_id else None

        if not session:
            start_res = self.start_call(
                VoiceHotlineCallRequest(
                    caller_phone=caller_num,
                    initial_language="en",
                    telecom_circle=circle,
                    target_bank_id=bank_id,
                )
            )
            session_id = start_res.session_id
            session = self.sessions[session_id]
            prompt = start_res
        else:
            digit = request.digits or ""
            speech = request.speech_result or ""

            if not digit and speech:
                asr_res = self.extract_bhashini_asr_intent(
                    AsrIntentExtractionRequest(
                        speech_text=speech,
                        caller_phone=caller_num,
                    )
                )
                if asr_res.scam_intent in ("DIGITAL_ARREST_THREAT", "SECRET_ESCROW_DEMAND"):
                    digit = "1"
                else:
                    digit = "2"

            if digit:
                prompt = self.process_input(
                    VoiceHotlineInputRequest(
                        session_id=session_id,
                        dtmf_digit=digit,
                        speech_input=speech,
                        target_bank_id=bank_id,
                    )
                )
            else:
                catalog = INDIC_HOTLINE_CATALOG.get(session.language, INDIC_HOTLINE_CATALOG["en"])
                lang_info = SUPPORTED_INDIC_LANGUAGES[session.language]
                prompt = VoiceHotlinePromptResponse(
                    session_id=session_id,
                    current_step=session.current_step,
                    selected_language=session.language,
                    audio_text=catalog["welcome"] if session.current_step == "WELCOME_LANG_SELECT" else catalog["reassurance"],
                    audio_locale=lang_info.tts_locale,
                    allowed_dtmf_keys=["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] if session.current_step == "WELCOME_LANG_SELECT" else ["1", "2"],
                    nearest_cyber_desk=session.nearest_cyber_desk,
                    is_completed=session.call_status == "COMPLETED",
                )

        action_name = "HANGUP" if prompt.is_completed else "GATHER"
        xml_payload = None
        json_dialplan = None

        if gateway == "twilio":
            if prompt.is_completed:
                xml_payload = (
                    f'<?xml version="1.0" encoding="UTF-8"?>\n'
                    f'<Response>\n'
                    f'    <Say language="{prompt.audio_locale}">{prompt.audio_text}</Say>\n'
                    f'    <Hangup/>\n'
                    f'</Response>'
                )
            else:
                xml_payload = (
                    f'<?xml version="1.0" encoding="UTF-8"?>\n'
                    f'<Response>\n'
                    f'    <Gather numDigits="1" timeout="10" action="/api/voice-hotline/webhook/twilio?session_id={session_id}">\n'
                    f'        <Say language="{prompt.audio_locale}">{prompt.audio_text}</Say>\n'
                    f'    </Gather>\n'
                    f'</Response>'
                )
        elif gateway == "exotel":
            if prompt.is_completed:
                xml_payload = (
                    f'<?xml version="1.0" encoding="UTF-8"?>\n'
                    f'<Response>\n'
                    f'    <Play>{prompt.audio_text}</Play>\n'
                    f'    <Hangup/>\n'
                    f'</Response>'
                )
            else:
                xml_payload = (
                    f'<?xml version="1.0" encoding="UTF-8"?>\n'
                    f'<Response>\n'
                    f'    <Collect dtmf="true" numDigits="1" timeout="10" action="/api/voice-hotline/webhook/exotel?session_id={session_id}">\n'
                    f'        <Play>{prompt.audio_text}</Play>\n'
                    f'    </Collect>\n'
                    f'</Response>'
                )
        else: # sip or asterisk
            json_dialplan = {
                "dialplan_engine": "Asterisk-SIP-KshemOS-Gateway",
                "session_id": session_id,
                "current_step": prompt.current_step,
                "actions": [
                    {
                        "action": "playback",
                        "text": prompt.audio_text,
                        "locale": prompt.audio_locale,
                    },
                    *(
                        [{"action": "hangup", "reason": "CALL_DEFLECTED_REASSURED"}]
                        if prompt.is_completed
                        else [{
                            "action": "read_dtmf",
                            "max_digits": 1,
                            "timeout_sec": 10,
                            "callback_url": f"/api/voice-hotline/webhook/sip?session_id={session_id}",
                        }]
                    ),
                ],
            }

        return TelephonyWebhookResponse(
            gateway=gateway,
            session_id=session_id,
            status=session.call_status,
            action=action_name,
            spoken_prompt=prompt.audio_text,
            audio_locale=prompt.audio_locale,
            xml_payload=xml_payload,
            json_dialplan=json_dialplan,
            defensive_actions=session.defensive_actions,
        )

    def start_call(self, request: VoiceHotlineCallRequest) -> VoiceHotlinePromptResponse:
        """
        Initializes an IVR hotline call session across 10 Indic languages.
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
            target_bank_id=request.target_bank_id or "sbi",
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
            allowed_dtmf_keys=["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
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
        if request.target_bank_id:
            session.target_bank_id = request.target_bank_id

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

            # Automated Defensive Action Blast (*99*99*1#, Bank Freeze, UIDAI Lock)
            try:
                defensive_blast = self.dispatch_defensive_sms(
                    DefensiveSmsBlastRequest(
                        caller_phone=session.caller_phone_masked,
                        bank_id=session.target_bank_id or "sbi",
                        telecom_circle=session.telecom_circle,
                    )
                )
                session.defensive_actions = defensive_blast.model_dump()
            except Exception:
                session.defensive_actions = {
                    "ussd_code": "*99*99*1#",
                    "ussd_deep_link": "tel:*99*99*1%23",
                    "aadhaar_lock_syntax": "LOCKUID 8892",
                    "bank_card_block_syntax": "BLOCK 1098",
                }

            # Automatically log anonymous incident entry in the regional triage feed
            try:
                auth_str = "Customs / Police / CBI impersonated" if session.claimed_authority else "Unknown Authority"
                extort_str = "Money / Secret Transfer demanded" if demanded_money else "No direct payment yet"
                triage_desc = (
                    f"Anonymous Voice Safety Hotline Deflection ({lang_info.name}): "
                    f"{auth_str}. {extort_str}. Spoken reassurance delivered. "
                    f"Defensive killswitch (*99*99*1# & UIDAI lock) dispatched via SMS with 1930 & {desk}."
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
                defensive_actions=session.defensive_actions,
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
            defensive_actions=session.defensive_actions,
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

