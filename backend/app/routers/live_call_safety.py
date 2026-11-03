from fastapi import APIRouter, HTTPException, status

from app.models import (
    LiveCallSession,
    CreateLiveCallSessionRequest,
    IngestSpeechChunkRequest,
    LiveCallRiskUpdateResponse,
)
from app.services import live_call_safety

router = APIRouter(prefix="/api/v1/live-call-safety", tags=["Live Call Safety Shield"])


@router.post("/sessions", response_model=LiveCallSession, status_code=status.HTTP_201_CREATED)
def create_session(payload: CreateLiveCallSessionRequest):
    """
    Initializes a consent-verified live call safety session.
    Requires user to have explicitly accepted microphone permissions,
    real-time transcription, and confirmed the zero-auto-recording policy.
    """
    try:
        session = live_call_safety.create_session(
            consent=payload.consent,
            caller_label=payload.caller_label,
        )
        return session
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/sessions/{session_id}", response_model=LiveCallSession)
def get_session(session_id: str):
    """
    Retrieves current state of a live call safety session.
    """
    try:
        return live_call_safety.get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")


@router.post("/sessions/{session_id}/chunk", response_model=LiveCallRiskUpdateResponse)
def ingest_chunk(session_id: str, payload: IngestSpeechChunkRequest):
    """
    Ingests an authorized incremental speech chunk from microphone or stream,
    updates transcript, highlights suspicious phrases, and updates real-time risk score.
    """
    try:
        return live_call_safety.ingest_chunk(
            session_id=session_id,
            text=payload.text,
            speaker=payload.speaker,
            audio_duration_ms=payload.audio_duration_ms,
            is_final=payload.is_final,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sessions/{session_id}/pause", response_model=LiveCallSession)
def pause_session(session_id: str):
    """
    Temporarily pauses microphone capture and risk analysis.
    """
    try:
        return live_call_safety.pause_session(session_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")


@router.post("/sessions/{session_id}/resume", response_model=LiveCallSession)
def resume_session(session_id: str):
    """
    Resumes a paused live call safety session.
    """
    try:
        return live_call_safety.resume_session(session_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")


@router.post("/sessions/{session_id}/stop", response_model=LiveCallSession)
def stop_session(session_id: str):
    """
    Stops the active call session, freezing transcript and risk calculations.
    """
    try:
        return live_call_safety.stop_session(session_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")


@router.delete("/sessions/{session_id}")
def purge_session(session_id: str):
    """
    Permanently wipes the session transcript, memory cache, and risk records.
    """
    return live_call_safety.purge_session(session_id)


@router.get("/helplines")
def get_helplines():
    """
    Lists official Indian law enforcement and financial fraud emergency verification helplines.
    """
    return {"helplines": live_call_safety.OFFICIAL_HELPLINES}

