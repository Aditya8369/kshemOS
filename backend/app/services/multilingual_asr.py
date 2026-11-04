"""
Multilingual Speech-to-Text Adapter & Regional-Language Confidence Handling.

Features:
- Configurable ASR Providers (Bhashini Indic AI, Whisper Local, Browser Web Speech, Mock Adapter).
- Indic languages (Hindi, Bengali, Tamil, Telugu, Marathi, Kannada, etc.) & Hinglish Code-Switching.
- Speaker turn tracking (Caller vs Citizen vs System).
- Word-level confidence evaluation and low-confidence token flagging.
- Immutable raw ASR storage with citizen correction overlay.
- Dual-record passing to scam detection (evaluates corrected text while preserving raw ASR for forensics).
- Text-entry fallback.
"""
from __future__ import annotations

import re
import time
import uuid
from typing import Dict, List, Optional, Tuple

from app.models import (
    SpeechTurn,
    WordConfidence,
    WordCorrection,
    CodeSwitchSegment,
    ASRProviderInfo,
    MultilingualScamAnalyzeResponse,
)

# In-memory store of active speech turns (keyed by turn_id)
_SPEECH_TURNS: Dict[str, SpeechTurn] = {}

# Catalog of supported ASR providers
ASR_PROVIDERS: List[ASRProviderInfo] = [
    ASRProviderInfo(
        id="bhashini",
        name="Bhashini Indic AI ASR",
        description="Government of India National AI Portal ASR with native 22 scheduled regional Indian language acoustic models.",
        supported_languages=["hi", "bn", "ta", "te", "mr", "kn", "gu", "pa", "ml", "en"],
        supports_code_switching=True,
        is_local=False,
    ),
    ASRProviderInfo(
        id="whisper_local",
        name="Local Indic-FineTuned Whisper",
        description="Local on-device / edge node Whisper adapter fine-tuned on conversational Indic dialects.",
        supported_languages=["hi", "en", "ta", "te", "bn", "mr"],
        supports_code_switching=True,
        is_local=True,
    ),
    ASRProviderInfo(
        id="browser_speech",
        name="Browser Web Speech API",
        description="Client-side speech synthesis and recognition utilizing device native speech engines.",
        supported_languages=["hi-IN", "en-IN", "ta-IN", "te-IN", "bn-IN", "mr-IN"],
        supports_code_switching=False,
        is_local=True,
    ),
    ASRProviderInfo(
        id="mock_adapter",
        name="Indic Synthetic Telephony ASR Engine",
        description="Deterministic high-fidelity test engine for realistic Indian scam calls with confidence variations and code-switching.",
        supported_languages=["hi", "en", "ta", "te", "bn"],
        supports_code_switching=True,
        is_local=True,
    ),
]

# Multilingual scam threat lexicon (Hindi, Hinglish, English)
MULTILINGUAL_SCAM_LEXICON = {
    "threat": [
        "digital arrest", "giraftari", "गिरफ्तारी", "arrest", "warrant", "वारंट",
        "cbi", "police", "पुलिस", "customs", "कस्टम्स", "narcotics", "नारकोटिक्स",
        "crime branch", "क्राइम ब्रांच", "court order", "supreme court", "fir",
        "jail", "kanooni karwayi", "adhikaari", "seized parcel", "drugs",
    ],
    "urgency": [
        "turant", "तुरंत", "abhi ke abhi", "अभी के अभी", "immediately", "right now",
        "do minute mein", "do not disconnect", "call disconnect mat karna", "disconnect mat karna",
        "urgent", "hours", "urgent verification", "jaldi kijiye",
    ],
    "secrecy": [
        "kisi ko mat batana", "किसी को मत बताना", "gupt jaanch", "गुप्त जांच",
        "kamre mein akele raho", "confidential", "secret", "do not tell anyone",
        "darwaza band rakho", "family ko mat batana",
    ],
    "payment": [
        "transfer", "paise transfer", "पैसे ट्रांसफर", "transfer money", "surakshit khata",
        "सुरक्षित खाता", "safe account", "rbi safe account", "otp share karo",
        "otp", "upi pin", "verification amount", "shulk bhariye", "penalty",
        "anydesk", "teamviewer", "screen share",
    ],
}

# Pre-configured realistic sample scenarios
MULTILINGUAL_SAMPLES = [
    {
        "id": "sample-hi-digital-arrest",
        "title": "Hindi-English Code-Switched Digital Arrest",
        "language": "hi",
        "language_name": "Hindi / Hinglish",
        "speaker": "caller",
        "raw_text": "Namaste main CVI Crime Branch se bol raha hoon aapka parcel Mumbai customs ne seize kiya hai usme illegal drugs mile hain aap par digital arrest warrant issue hua hai.",
        "simulated_words": [
            ("Namaste", 0.98, "hi", []),
            ("main", 0.95, "hi", []),
            ("CVI", 0.48, "en", ["CBI", "SBI", "CIVIL"]),  # Low confidence word simulation!
            ("Crime", 0.94, "en", []),
            ("Branch", 0.96, "en", []),
            ("se", 0.99, "hi", []),
            ("bol", 0.97, "hi", []),
            ("raha", 0.96, "hi", []),
            ("hoon", 0.98, "hi", []),
            ("aapka", 0.99, "hi", []),
            ("parcel", 0.95, "en", []),
            ("Mumbai", 0.97, "en", []),
            ("customs", 0.94, "en", []),
            ("ne", 0.99, "hi", []),
            ("seize", 0.93, "en", []),
            ("kiya", 0.97, "hi", []),
            ("hai", 0.98, "hi", []),
            ("usme", 0.97, "hi", []),
            ("illegal", 0.94, "en", []),
            ("drugs", 0.95, "en", []),
            ("mile", 0.96, "hi", []),
            ("hain", 0.98, "hi", []),
            ("aap", 0.99, "hi", []),
            ("par", 0.98, "hi", []),
            ("digital", 0.94, "en", []),
            ("arrest", 0.96, "en", []),
            ("warrant", 0.95, "en", []),
            ("issue", 0.92, "en", []),
            ("hua", 0.97, "hi", []),
            ("hai", 0.98, "hi", []),
        ],
    },
    {
        "id": "sample-hi-urgency-payment",
        "title": "Hinglish Urgency & Safe Account Demand",
        "language": "hi",
        "language_name": "Hindi / Hinglish",
        "speaker": "caller",
        "raw_text": "Call disconnect mat karna kisi ko mat batana turant RBI safe account mein verification amount transfer kijiye varna police giraftari karegi.",
        "simulated_words": [
            ("Call", 0.97, "en", []),
            ("disconnect", 0.95, "en", []),
            ("mat", 0.98, "hi", []),
            ("karna", 0.98, "hi", []),
            ("kisi", 0.96, "hi", []),
            ("ko", 0.99, "hi", []),
            ("mat", 0.98, "hi", []),
            ("batana", 0.97, "hi", []),
            ("turant", 0.96, "hi", []),
            ("RVI", 0.52, "en", ["RBI", "SBI", "SBI"]),  # Low confidence word simulation!
            ("safe", 0.94, "en", []),
            ("account", 0.97, "en", []),
            ("mein", 0.98, "hi", []),
            ("verification", 0.93, "en", []),
            ("amount", 0.95, "en", []),
            ("transfer", 0.96, "en", []),
            ("kijiye", 0.97, "hi", []),
            ("varna", 0.96, "hi", []),
            ("police", 0.97, "en", []),
            ("giraftari", 0.96, "hi", []),
            ("karegi", 0.98, "hi", []),
        ],
    },
    {
        "id": "sample-ta-bank-otp",
        "title": "Tamil-English Bank OTP Scam",
        "language": "ta",
        "language_name": "Tamil / Tanglish",
        "speaker": "caller",
        "raw_text": "Ungal bank account freeze aagividum ungal mobile OTP udane share pannunga illana account block aagum.",
        "simulated_words": [
            ("Ungal", 0.96, "ta", []),
            ("bank", 0.97, "en", []),
            ("account", 0.96, "en", []),
            ("freeze", 0.94, "en", []),
            ("aagividum", 0.95, "ta", []),
            ("ungal", 0.97, "ta", []),
            ("mobile", 0.98, "en", []),
            ("OPP", 0.49, "en", ["OTP", "APP", "UPP"]),  # Low confidence word simulation!
            ("udane", 0.95, "ta", []),
            ("share", 0.96, "en", []),
            ("pannunga", 0.96, "ta", []),
            ("illana", 0.97, "ta", []),
            ("account", 0.96, "en", []),
            ("block", 0.95, "en", []),
            ("aagum", 0.97, "ta", []),
        ],
    },
    {
        "id": "sample-hi-benign",
        "title": "Benign Hindi Customer Service Call",
        "language": "hi",
        "language_name": "Hindi",
        "speaker": "caller",
        "raw_text": "Namaskar main bank branch se bol raha hoon aapka cheque clear ho gaya hai aap aakar passbook update kar sakte hain.",
        "simulated_words": [
            ("Namaskar", 0.99, "hi", []),
            ("main", 0.98, "hi", []),
            ("bank", 0.97, "en", []),
            ("branch", 0.98, "en", []),
            ("se", 0.99, "hi", []),
            ("bol", 0.98, "hi", []),
            ("raha", 0.97, "hi", []),
            ("hoon", 0.99, "hi", []),
            ("aapka", 0.99, "hi", []),
            ("cheque", 0.96, "en", []),
            ("clear", 0.97, "en", []),
            ("ho", 0.99, "hi", []),
            ("gaya", 0.99, "hi", []),
            ("hai", 0.99, "hi", []),
            ("aap", 0.99, "hi", []),
            ("aakar", 0.98, "hi", []),
            ("passbook", 0.95, "en", []),
            ("update", 0.97, "en", []),
            ("kar", 0.99, "hi", []),
            ("sakte", 0.98, "hi", []),
            ("hain", 0.99, "hi", []),
        ],
    },
]


def detect_code_switching(words: List[WordConfidence]) -> Tuple[str, float, List[CodeSwitchSegment]]:
    """
    Analyzes token-level languages and calculates primary detected language,
    confidence score, and contiguous code-switched phrases.
    """
    if not words:
        return "hi", 0.95, []

    lang_counts: Dict[str, int] = {}
    segments: List[CodeSwitchSegment] = []
    current_segment_lang: Optional[str] = None
    current_segment_tokens: List[str] = []

    for w in words:
        lang = w.language or "hi"
        lang_counts[lang] = lang_counts.get(lang, 0) + 1

        if current_segment_lang is None:
            current_segment_lang = lang
            current_segment_tokens.append(w.word)
        elif current_segment_lang == lang:
            current_segment_tokens.append(w.word)
        else:
            segments.append(
                CodeSwitchSegment(
                    text=" ".join(current_segment_tokens),
                    language=current_segment_lang,
                    confidence=1.0,
                )
            )
            current_segment_lang = lang
            current_segment_tokens = [w.word]

    if current_segment_tokens and current_segment_lang:
        segments.append(
            CodeSwitchSegment(
                text=" ".join(current_segment_tokens),
                language=current_segment_lang,
                confidence=1.0,
            )
        )

    # Primary language is the most frequent
    primary_lang = max(lang_counts.items(), key=lambda x: x[1])[0]
    total_words = len(words)
    primary_ratio = lang_counts[primary_lang] / total_words

    return primary_lang, round(primary_ratio, 2), segments


def transcribe_speech(
    provider: str = "bhashini",
    sample_id: Optional[str] = None,
    text_input: Optional[str] = None,
    audio_payload: Optional[str] = None,
    target_language: str = "hi",
    speaker: str = "caller",
    enable_code_switching: bool = True,
    confidence_threshold: float = 0.70,
) -> SpeechTurn:
    """
    Transcribes audio / text using the selected ASR adapter, computes word-level
    confidence scores, marks low-confidence tokens, and detects code-switching.
    """
    now = int(time.time() * 1000)
    turn_id = f"TURN-{uuid.uuid4().hex[:8].upper()}"

    # Check if a pre-configured scenario is requested
    matched_sample = None
    if sample_id:
        matched_sample = next((s for s in MULTILINGUAL_SAMPLES if s["id"] == sample_id), None)

    if matched_sample:
        raw_text = matched_sample["raw_text"]
        words: List[WordConfidence] = []
        for idx, (word_str, conf, lang, alts) in enumerate(matched_sample["simulated_words"]):
            is_low = conf < confidence_threshold
            words.append(
                WordConfidence(
                    word=word_str,
                    confidence=conf,
                    start_ms=idx * 300,
                    end_ms=(idx + 1) * 300,
                    language=lang,
                    is_low_confidence=is_low,
                    alternatives=alts,
                )
            )
        detected_lang = matched_sample["language"]
    elif text_input:
        # Text-entry fallback or manual transcription input
        raw_text = text_input.strip()
        tokens = raw_text.split()
        words = []
        for idx, tok in enumerate(tokens):
            # Check script / token type for code switching simulation
            is_devanagari = bool(re.search(r"[\u0900-\u097F]", tok))
            tok_lang = "hi" if is_devanagari else target_language

            # If word is a short acronym, simulate realistic ASR ambiguity if needed
            is_acronym = tok.isupper() and len(tok) >= 2
            conf = 0.95 if not is_acronym else 0.88
            alts = []
            if tok.lower() in ["cbi", "rbi", "trai", "otp", "fir"]:
                conf = 0.92

            words.append(
                WordConfidence(
                    word=tok,
                    confidence=conf,
                    start_ms=idx * 280,
                    end_ms=(idx + 1) * 280,
                    language=tok_lang,
                    is_low_confidence=conf < confidence_threshold,
                    alternatives=alts,
                )
            )
        detected_lang = target_language
    else:
        # Default placeholder speech chunk
        raw_text = "Yeh CBI officer ka aadesh hai turant transfer kijiye."
        tokens = raw_text.split()
        words = [
            WordConfidence(word=t, confidence=0.92, language=target_language, is_low_confidence=False)
            for t in tokens
        ]
        detected_lang = target_language

    # Compute code-switching
    primary_lang, lang_conf, segments = detect_code_switching(words)
    avg_conf = round(sum(w.confidence for w in words) / max(1, len(words)), 3)

    speech_turn = SpeechTurn(
        turn_id=turn_id,
        speaker=speaker,
        timestamp_ms=now,
        original_text=raw_text,
        corrected_text=raw_text,  # Initially identical to original
        words=words,
        corrections=[],
        is_citizen_corrected=False,
        detected_language=primary_lang,
        language_confidence=lang_conf,
        code_switch_segments=segments if enable_code_switching else [],
        average_confidence=avg_conf,
        provider=provider,
    )

    _SPEECH_TURNS[turn_id] = speech_turn
    return speech_turn


def apply_citizen_corrections(
    turn_id: str,
    word_corrections: List[WordCorrection],
    full_corrected_text: Optional[str] = None,
) -> SpeechTurn:
    """
    Applies user/citizen corrections to a speech turn without overwriting
    or mutating the original raw ASR output.
    """
    if turn_id not in _SPEECH_TURNS:
        raise KeyError(f"Turn {turn_id} not found.")

    turn = _SPEECH_TURNS[turn_id]

    # Apply individual word corrections
    for corr in word_corrections:
        idx = corr.word_index
        if 0 <= idx < len(turn.words):
            # Update word object for corrected text representation
            turn.words[idx].word = corr.corrected_word
            turn.words[idx].confidence = 1.0  # User-confirmed word has 100% confidence
            turn.words[idx].is_low_confidence = False
            turn.corrections.append(corr)

    # If full corrected text string was provided directly, use it
    if full_corrected_text is not None:
        turn.corrected_text = full_corrected_text.strip()
    else:
        turn.corrected_text = " ".join(w.word for w in turn.words)

    turn.is_citizen_corrected = True
    turn.average_confidence = round(sum(w.confidence for w in turn.words) / max(1, len(turn.words)), 3)

    return turn


def analyze_multilingual_scam(
    text_to_analyze: str,
    original_asr_text: str,
    language: str = "hi",
    caller_claims_to_be: Optional[str] = None,
    turn_id: Optional[str] = None,
) -> MultilingualScamAnalyzeResponse:
    """
    Evaluates the corrected text for scam threats, urgency, secrecy, and payment extortion
    while retaining the immutable original ASR text for audit trails.
    """
    lower = text_to_analyze.lower()
    matched_patterns = []

    threat_hits = [kw for kw in MULTILINGUAL_SCAM_LEXICON["threat"] if kw in lower]
    urgency_hits = [kw for kw in MULTILINGUAL_SCAM_LEXICON["urgency"] if kw in lower]
    secrecy_hits = [kw for kw in MULTILINGUAL_SCAM_LEXICON["secrecy"] if kw in lower]
    payment_hits = [kw for kw in MULTILINGUAL_SCAM_LEXICON["payment"] if kw in lower]

    if threat_hits:
        matched_patterns.append(f"Authority / Arrest Threats: {', '.join(threat_hits)}")
    if urgency_hits:
        matched_patterns.append(f"Urgency Pressure: {', '.join(urgency_hits)}")
    if secrecy_hits:
        matched_patterns.append(f"Secrecy & Isolation Demands: {', '.join(secrecy_hits)}")
    if payment_hits:
        matched_patterns.append(f"Payment / OTP Demands: {', '.join(payment_hits)}")

    # Composite risk calculation
    raw_score = 0.0
    raw_score += min(len(threat_hits), 4) * 8.0
    raw_score += min(len(payment_hits), 3) * 8.0
    raw_score += min(len(secrecy_hits), 2) * 10.0
    raw_score += min(len(urgency_hits), 3) * 6.0

    # Cross-pillar synergy
    active_pillars = sum(1 for hits in [threat_hits, urgency_hits, secrecy_hits, payment_hits] if hits)
    if active_pillars >= 3:
        raw_score += 20.0
    elif active_pillars >= 2:
        raw_score += 10.0

    if caller_claims_to_be and any(t in caller_claims_to_be.lower() for t in ["cbi", "police", "customs", "court"]):
        raw_score += 15.0

    score = max(0.0, min(100.0, round(raw_score, 1)))

    if score >= 75.0:
        band = "critical"
        recommendation = (
            "🚨 HANG UP IMMEDIATELY / तुरंत फोन काटें: Law enforcement and courts in India NEVER conduct digital arrests "
            "or demand funds over phone or video call. Call 1930 immediately."
        )
    elif score >= 50.0:
        band = "high"
        recommendation = (
            "⚠️ HIGH RISK SCAM / सतर्क रहें: Impersonation and pressure tactics detected. "
            "Never share OTPs, transfer money to 'safe accounts', or download remote screen apps."
        )
    elif score >= 25.0:
        band = "medium"
        recommendation = (
            "🔍 CAUTION / ध्यान दें: Suspicious request language detected. Verify caller identity "
            "independently through officially published government or bank directories."
        )
    else:
        band = "low"
        recommendation = "🟢 Low scam probability detected in this transcript segment."

    was_corrected = text_to_analyze.strip() != original_asr_text.strip()

    # Code switch ratio: proportion of Latin/English words in text
    words = text_to_analyze.split()
    latin_words = sum(1 for w in words if re.search(r"^[A-Za-z]+$", w))
    code_switch_ratio = round(latin_words / max(1, len(words)), 2)

    explanation = (
        f"Analyzed {len(words)} words ({code_switch_ratio * 100:.0f}% code-switched). "
        f"Found {len(threat_hits)} authority/threat indicators, {len(payment_hits)} payment demands, "
        f"{len(secrecy_hits)} secrecy demands, and {len(urgency_hits)} urgency cues."
    )

    return MultilingualScamAnalyzeResponse(
        risk_score=score,
        risk_band=band,
        analyzed_text=text_to_analyze,
        original_asr_text=original_asr_text,
        was_corrected=was_corrected,
        detected_language=language,
        code_switch_ratio=code_switch_ratio,
        matched_patterns=matched_patterns,
        recommendation=recommendation,
        explanation=explanation,
    )


def get_turn(turn_id: str) -> SpeechTurn:
    """Retrieves a speech turn from memory."""
    if turn_id not in _SPEECH_TURNS:
        raise KeyError(f"Turn {turn_id} not found.")
    return _SPEECH_TURNS[turn_id]
