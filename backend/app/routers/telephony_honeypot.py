"""
FastAPI Router for AI Telephony Honeypot & Call-Pattern Triangulation.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any

from app.models import (
    HoneypotPersona,
    HoneypotCallSession,
    HarvestedMuleCredential,
    CallForwardRequest,
    CallTurnRequest,
    MuleFreezeRequest,
)
from app.services.telephony_honeypot import (
    default_honeypot_engine,
    PERSONAS,
)

router = APIRouter(prefix="/api/honeypot", tags=["AI Telephony Honeypot"])


@router.get("/personas", response_model=List[HoneypotPersona])
def get_personas():
    """Returns available virtual citizen honeypot deflection personas."""
    return list(PERSONAS.values())


@router.get("/sessions", response_model=List[HoneypotCallSession])
def list_sessions(status: Optional[str] = None):
    """Lists all active and completed honeypot call sessions."""
    sessions = list(default_honeypot_engine.sessions.values())
    if status:
        sessions = [s for s in sessions if s.call_status == status]
    sessions.sort(key=lambda s: s.created_at, reverse=True)
    return sessions


@router.get("/sessions/{session_id}", response_model=HoneypotCallSession)
def get_session(session_id: str):
    """Retrieves full transcript, acoustic triangulation, and harvested mules for a session."""
    if session_id not in default_honeypot_engine.sessions:
        raise HTTPException(status_code=404, detail="Honeypot session not found")
    return default_honeypot_engine.sessions[session_id]


@router.post("/forward-call", response_model=HoneypotCallSession)
def forward_call_to_honeypot(payload: CallForwardRequest):
    """Citizen Call-Forwarding Mode: Immediately transfers an active suspicious call to AI Honeypot."""
    return default_honeypot_engine.forward_call(payload)


@router.post("/sessions/{session_id}/turn", response_model=HoneypotCallSession)
def process_call_turn(session_id: str, payload: CallTurnRequest):
    """Processes a scammer conversational turn, harvesting credentials and prolonging call."""
    if session_id not in default_honeypot_engine.sessions:
        raise HTTPException(status_code=404, detail="Honeypot session not found")
    return default_honeypot_engine.process_turn(session_id, payload.caller_utterance)


@router.post("/sessions/{session_id}/freeze-account", response_model=HarvestedMuleCredential)
def freeze_harvested_mule(session_id: str, payload: MuleFreezeRequest):
    """Executes statutory Section 102 CrPC freeze action on a harvested mule account."""
    if session_id not in default_honeypot_engine.sessions:
        raise HTTPException(status_code=404, detail="Honeypot session not found")
    try:
        return default_honeypot_engine.freeze_credential(session_id, payload)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/harvested-mules", response_model=List[HarvestedMuleCredential])
def get_all_harvested_mules():
    """Lists all harvested bank accounts, UPI VPAs, and payment URLs across sessions."""
    all_mules: List[HarvestedMuleCredential] = []
    seen = set()
    for session in default_honeypot_engine.sessions.values():
        for mule in session.harvested_credentials:
            if mule.credential_id not in seen:
                all_mules.append(mule)
                seen.add(mule.credential_id)
    return all_mules
