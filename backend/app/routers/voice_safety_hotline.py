"""
FastAPI Router for Multilingual Automated Voice Safety Hotline.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response

from app.models import (
    VoiceHotlineCallRequest,
    VoiceHotlineInputRequest,
    VoiceHotlinePromptResponse,
    VoiceHotlineSessionRecord,
    VoiceHotlineLanguageInfo,
    VoiceHotlineStatsResponse,
    TelephonyWebhookRequest,
    TelephonyWebhookResponse,
    AsrIntentExtractionRequest,
    AsrIntentExtractionResponse,
    DefensiveSmsBlastRequest,
    DefensiveSmsBlastResponse,
)
from app.services.voice_safety_hotline import (
    default_hotline_engine,
    SUPPORTED_INDIC_LANGUAGES,
)

router = APIRouter(prefix="/api/voice-hotline", tags=["Voice Safety Hotline"])


@router.get("/languages", response_model=List[VoiceHotlineLanguageInfo])
def get_supported_languages():
    """Returns the 10 supported Indic languages with native autonyms and DTMF mappings."""
    return list(SUPPORTED_INDIC_LANGUAGES.values())


@router.post("/call", response_model=VoiceHotlinePromptResponse)
def start_hotline_call(request: VoiceHotlineCallRequest):
    """
    Initiates a new voice hotline call session, playing the multilingual greeting
    and presenting the language selection prompt.
    """
    return default_hotline_engine.start_call(request)


@router.post("/input", response_model=VoiceHotlinePromptResponse)
def submit_call_input(request: VoiceHotlineInputRequest):
    """
    Processes a DTMF keypress or speech utterance in the IVR state machine,
    advancing through authority verification, extortion triage, and reassurance delivery.
    """
    try:
        return default_hotline_engine.process_input(request)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/webhook/{gateway}", response_model=TelephonyWebhookResponse)
def handle_telephony_webhook(
    gateway: str,
    request: Optional[TelephonyWebhookRequest] = None,
    session_id: Optional[str] = Query(default=None),
    digits: Optional[str] = Query(default=None, alias="Digits"),
    speech_result: Optional[str] = Query(default=None, alias="SpeechResult"),
    from_number: Optional[str] = Query(default=None, alias="From"),
    to_number: Optional[str] = Query(default=None, alias="To"),
    call_sid: Optional[str] = Query(default=None, alias="CallSid"),
    as_xml: bool = Query(default=False, description="Whether to return raw application/xml"),
):
    """
    Telephony gateway connector supporting SIP/Asterisk, Twilio, and Exotel.
    Processes inbound DTMF or transcribed speech and returns standard TwiML, ExoML,
    or SIP JSON dialplan actions.
    """
    payload = request or TelephonyWebhookRequest(
        gateway=gateway,
        session_id=session_id,
        digits=digits,
        speech_result=speech_result,
        from_number=from_number or "+91 98765 43210",
        to_number=to_number or "+91 1800 57436",
        call_sid=call_sid or "CALL-DEFAULT",
    )

    if session_id and not payload.session_id:
        payload.session_id = session_id
    if digits and not payload.digits:
        payload.digits = digits
    if speech_result and not payload.speech_result:
        payload.speech_result = speech_result

    res = default_hotline_engine.process_telephony_webhook(gateway, payload)
    if as_xml and res.xml_payload:
        return Response(content=res.xml_payload, media_type="application/xml")
    return res


@router.post("/asr/transcribe-intent", response_model=AsrIntentExtractionResponse)
def transcribe_speech_intent(request: AsrIntentExtractionRequest):
    """
    Real-time speech-to-text & scam intent extraction across 10 Indian languages
    using Bhashini / Indic Whisper model heuristics.
    Detects Digital Arrest intimidation, fake narcotics parcels, and secret escrow demands.
    """
    return default_hotline_engine.extract_bhashini_asr_intent(request)


@router.post("/defensive-sms/blast", response_model=DefensiveSmsBlastResponse)
def dispatch_defensive_sms_blast(request: DefensiveSmsBlastRequest):
    """
    Instantly dispatches bank-tailored defensive killswitch SMS containing:
    1. One-tap USSD code (*99*99*1#) to cut off AePS biometric transactions
    2. Bank-specific card/account freeze syntax & deep link
    3. UIDAI Aadhaar biometric lock command (LOCKUID <Last4> to 1947)
    4. Bank fraud desk phone and National Cyber Helpline 1930
    """
    return default_hotline_engine.dispatch_defensive_sms(request)


@router.get("/sessions", response_model=List[VoiceHotlineSessionRecord])
def list_hotline_sessions(
    status: Optional[str] = None,
    language: Optional[str] = None,
):
    """Lists recent hotline calls with anonymous caller tracking."""
    sessions = list(default_hotline_engine.sessions.values())
    if status:
        sessions = [s for s in sessions if s.call_status == status]
    if language:
        sessions = [s for s in sessions if s.language == language]
    sessions.sort(key=lambda s: s.created_at, reverse=True)
    return sessions


@router.get("/sessions/{session_id}", response_model=VoiceHotlineSessionRecord)
def get_hotline_session(session_id: str):
    """Retrieves full session history including DTMF turns, SMS record, and triage incident ID."""
    session = default_hotline_engine.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Hotline session '{session_id}' not found")
    return session


@router.get("/stats", response_model=VoiceHotlineStatsResponse)
def get_hotline_statistics():
    """Returns aggregated deflection metrics, language breakdown, and SMS dispatches."""
    return default_hotline_engine.get_stats()
