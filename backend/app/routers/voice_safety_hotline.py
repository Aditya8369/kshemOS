"""
FastAPI Router for Multilingual Automated Voice Safety Hotline.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import (
    VoiceHotlineCallRequest,
    VoiceHotlineInputRequest,
    VoiceHotlinePromptResponse,
    VoiceHotlineSessionRecord,
    VoiceHotlineLanguageInfo,
    VoiceHotlineStatsResponse,
)
from app.services.voice_safety_hotline import (
    default_hotline_engine,
    SUPPORTED_INDIC_LANGUAGES,
)

router = APIRouter(prefix="/api/voice-hotline", tags=["Voice Safety Hotline"])


@router.get("/languages", response_model=List[VoiceHotlineLanguageInfo])
def get_supported_languages():
    """Returns the 8 supported Indic languages with native autonyms and DTMF mappings."""
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
