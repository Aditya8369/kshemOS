"""
Consent-Based Live Scam-Call Transcription and Real-Time Risk Alerts Service.

Guarantees:
- Strict opt-in: Requires user consent for mic/audio and data processing before activation.
- Zero auto-recording: Ephemeral processing only, no continuous permanent audio disk storage.
- Never contacts scammer: Listener/guardian mode only.
- User retains full sovereignty: Pause, resume, stop, and completely delete/purge session data.
"""
from __future__ import annotations

import re
import time
import uuid
from typing import Optional, Dict, List, Tuple

from app.models import (
    LiveCallConsent,
    SuspiciousPhrase,
    SpeechUtterance,
    LiveCallSession,
    LiveCallRiskUpdateResponse,
)

# In-memory session store (keyed by session_id)
_LIVE_SESSIONS: Dict[str, LiveCallSession] = {}

# Comprehensive lexicon of scam threat, urgency, secrecy, payment, and coercion patterns
SCAM_LEXICON: List[Tuple[str, str, float]] = [
    # Category: threat
    ("digital arrest", "threat", 30.0),
    ("arrest warrant", "threat", 28.0),
    ("cbi officer", "threat", 25.0),
    ("cbi", "threat", 20.0),
    ("police custody", "threat", 24.0),
    ("crime branch", "threat", 22.0),
    ("enforcement directorate", "threat", 24.0),
    ("ed officer", "threat", 22.0),
    ("customs department", "threat", 20.0),
    ("customs seizure", "threat", 22.0),
    ("narcotics", "threat", 24.0),
    ("drugs found", "threat", 25.0),
    ("money laundering", "threat", 26.0),
    ("supreme court order", "threat", 22.0),
    ("non-bailable warrant", "threat", 28.0),
    ("fir registered", "threat", 20.0),
    ("sim card blocked", "threat", 18.0),
    ("bank account frozen", "threat", 22.0),
    ("passport cancelled", "threat", 20.0),
    ("illegal parcel", "threat", 20.0),

    # Category: urgency
    ("immediately", "urgency", 12.0),
    ("right now", "urgency", 12.0),
    ("within 15 minutes", "urgency", 16.0),
    ("within 30 minutes", "urgency", 14.0),
    ("do not delay", "urgency", 12.0),
    ("urgent verification", "urgency", 14.0),
    ("call will disconnect", "urgency", 15.0),
    ("act fast", "urgency", 10.0),
    ("final notice", "urgency", 14.0),

    # Category: secrecy
    ("do not disconnect", "secrecy", 22.0),
    ("stay on this call", "secrecy", 18.0),
    ("do not tell anyone", "secrecy", 24.0),
    ("keep this confidential", "secrecy", 20.0),
    ("isolated place", "secrecy", 20.0),
    ("quiet room", "secrecy", 18.0),
    ("do not inform family", "secrecy", 25.0),
    ("confidential investigation", "secrecy", 22.0),
    ("official secrets act", "secrecy", 24.0),

    # Category: payment
    ("transfer money", "payment", 25.0),
    ("transfer funds", "payment", 25.0),
    ("safe account", "payment", 30.0),
    ("rbi safe account", "payment", 32.0),
    ("security deposit", "payment", 22.0),
    ("verification amount", "payment", 25.0),
    ("share otp", "payment", 28.0),
    ("one time password", "payment", 20.0),
    ("upi pin", "payment", 28.0),
    ("clearance fee", "payment", 22.0),
    ("penalty fee", "payment", 18.0),
    ("anydesk", "payment", 26.0),
    ("rustdesk", "payment", 26.0),
    ("teamviewer", "payment", 26.0),
    ("screen share", "payment", 22.0),

    # Category: coercion
    ("video call", "coercion", 14.0),
    ("skype call", "coercion", 18.0),
    ("turn on camera", "coercion", 16.0),
    ("look at my uniform", "coercion", 20.0),
    ("police badge", "coercion", 18.0),
    ("dsp badge", "coercion", 18.0),
]

OFFICIAL_HELPLINES = [
    {
        "name": "National Cyber Crime Helpline",
        "number": "1930",
        "description": "Ministry of Home Affairs 24x7 reporting helpline for cyber fraud and immediate bank transaction freezing.",
        "url": "https://cybercrime.gov.in",
    },
    {
        "name": "RBI Sachet Fraud Reporting Portal",
        "number": "14440",
        "description": "Reserve Bank of India awareness and financial entity verification helpline.",
        "url": "https://sachet.rbi.org.in",
    },
    {
        "name": "DoT Sanchar Saathi (Chakshu)",
        "number": "1963",
        "description": "Department of Telecommunications portal to report suspicious fraud calls and WhatsApp numbers.",
        "url": "https://sancharsaathi.gov.in",
    },
    {
        "name": "National Emergency Service",
        "number": "112",
        "description": "Immediate local police and emergency intervention.",
        "url": "https://112.gov.in",
    },
]


def create_session(consent: LiveCallConsent, caller_label: Optional[str] = None) -> LiveCallSession:
    """
    Initializes a new live call safety session once user consent is verified.
    """
    if not (consent.user_acknowledged and consent.mic_permission_granted and 
            consent.data_processing_accepted and consent.no_auto_record_acknowledged):
        raise ValueError("Cannot initialize live call safety session: All consent permissions must be explicitly granted.")

    now = int(time.time() * 1000)
    session_id = f"CALL-SAFE-{uuid.uuid4().hex[:8].upper()}"

    session = LiveCallSession(
        session_id=session_id,
        status="active",
        consent=consent,
        started_at=now,
        updated_at=now,
        caller_label=caller_label or "Incoming Call",
        full_transcript="",
        utterances=[],
        current_risk_score=0.0,
        current_risk_band="low",
        detected_categories=[],
        highlighted_phrases=[],
        actionable_safety_prompts=[
            "Listening for suspicious patterns... Stay calm and do not share sensitive financial information.",
            "Genuine public officials will never threaten immediate arrest over a phone call.",
        ],
        official_helpline_recommendations=OFFICIAL_HELPLINES,
        tactics_breakdown={
            "threat": 0.0,
            "urgency": 0.0,
            "secrecy": 0.0,
            "payment": 0.0,
            "coercion": 0.0,
        },
    )
    _LIVE_SESSIONS[session_id] = session
    return session


def detect_suspicious_phrases(text: str) -> List[SuspiciousPhrase]:
    """
    Scans a given text segment for known scam words and phrases.
    """
    lower_text = text.lower()
    matches: List[SuspiciousPhrase] = []
    seen = set()

    for phrase, category, weight in SCAM_LEXICON:
        if phrase in seen:
            continue
        
        # Word boundary match for single words, substring for multi-word phrases
        matched = False
        if " " in phrase:
            if phrase in lower_text:
                matched = True
        else:
            if re.search(rf"\b{re.escape(phrase)}\b", lower_text):
                matched = True

        if matched:
            seen.add(phrase)
            # Find context snippet around the phrase
            idx = lower_text.find(phrase)
            start = max(0, idx - 25)
            end = min(len(text), idx + len(phrase) + 25)
            snippet = ("..." if start > 0 else "") + text[start:end].strip() + ("..." if end < len(text) else "")
            
            matches.append(
                SuspiciousPhrase(
                    phrase=phrase,
                    category=category,
                    severity_weight=weight,
                    context_snippet=snippet,
                )
            )

    return matches


def compute_risk_assessment(session: LiveCallSession) -> Tuple[float, str, List[str], Dict[str, float]]:
    """
    Calculates overall cumulative risk score (0-100), risk band, actionable prompts,
    and category breakdowns from all detected phrases across the session.
    """
    all_phrases = session.highlighted_phrases
    
    tactic_totals = {
        "threat": 0.0,
        "urgency": 0.0,
        "secrecy": 0.0,
        "payment": 0.0,
        "coercion": 0.0,
    }

    category_counts = {
        "threat": 0,
        "urgency": 0,
        "secrecy": 0,
        "payment": 0,
        "coercion": 0,
    }

    for p in all_phrases:
        if p.category in tactic_totals:
            tactic_totals[p.category] += p.severity_weight
            category_counts[p.category] += 1

    # Weighted composite score formula
    threat_component = min(35.0, tactic_totals["threat"] * 0.9)
    payment_component = min(30.0, tactic_totals["payment"] * 0.9)
    secrecy_component = min(20.0, tactic_totals["secrecy"] * 0.8)
    urgency_component = min(15.0, tactic_totals["urgency"] * 0.8)
    coercion_component = min(15.0, tactic_totals["coercion"] * 0.8)

    raw_score = threat_component + payment_component + secrecy_component + urgency_component + coercion_component
    
    # Synergy bonus if caller combines multiple scam pillars (e.g. Threat + Payment + Secrecy = Digital Arrest)
    active_pillars = sum(1 for c, count in category_counts.items() if count > 0)
    if active_pillars >= 3:
        raw_score += 15.0
    elif active_pillars >= 2:
        raw_score += 8.0

    score = max(0.0, min(100.0, round(raw_score, 1)))

    # Determine risk band
    if score >= 75.0:
        band = "critical"
    elif score >= 50.0:
        band = "high"
    elif score >= 25.0:
        band = "medium"
    else:
        band = "low"

    # Actionable safety prompts
    prompts: List[str] = []
    if band == "critical":
        prompts.append("🚨 HANG UP IMMEDIATELY: Law enforcement in India (CBI, Police, Customs, ED, Courts) NEVER conduct investigations, trials, or digital arrests over video or phone calls.")
        prompts.append("⛔ DO NOT TRANSFER MONEY: The RBI and government have NO 'safe verification accounts'. Any demand to move money is 100% fraudulent.")
        prompts.append("📞 VERIFY VIA 1930: Immediately call the National Cyber Crime Helpline at 1930 or visit cybercrime.gov.in.")
        prompts.append("🔒 DO NOT SHARE ANY CODES: Never share OTPs, Aadhaar numbers, or bank passwords under any circumstances.")
    elif band == "high":
        prompts.append("⚠️ HIGH SCAM PROBABILITY: The caller is utilizing high-pressure urgency and authority impersonation tactics.")
        prompts.append("🛑 END THE CALL: Tell the caller you will independently contact their department's official headquarters.")
        prompts.append("🚫 NEVER DOWNLOAD SCREEN APPS: Do not install AnyDesk, RustDesk, or TeamViewer if requested.")
        prompts.append("📞 CALL OFFICIAL DIRECTORY: Contact the relevant agency via officially published website numbers only.")
    elif band == "medium":
        prompts.append("🔍 SUSPICIOUS BEHAVIOUR DETECTED: Caller is attempting to create urgency or demand sensitive confirmation.")
        prompts.append("💬 ASK FOR WRITTEN NOTICE: Demand a formal written notice sent via official postal or registered email.")
        prompts.append("⏸️ PAUSE AND VERIFY: Take a breath, consult a trusted family member, and do not make rushed decisions.")
    else:
        prompts.append("🟢 NO THREAT DETECTED YET: Continue speaking with normal caution.")
        prompts.append("🛡️ REMINDER: Never share OTPs, PINs, or banking passwords on incoming phone calls.")

    # Normalize tactical percentages for radar/meters
    tactics_breakdown = {
        "threat": round(min(100.0, (tactic_totals["threat"] / 35.0) * 100.0), 1),
        "urgency": round(min(100.0, (tactic_totals["urgency"] / 20.0) * 100.0), 1),
        "secrecy": round(min(100.0, (tactic_totals["secrecy"] / 25.0) * 100.0), 1),
        "payment": round(min(100.0, (tactic_totals["payment"] / 30.0) * 100.0), 1),
        "coercion": round(min(100.0, (tactic_totals["coercion"] / 20.0) * 100.0), 1),
    }

    return score, band, prompts, tactics_breakdown


def ingest_chunk(
    session_id: str,
    text: str,
    speaker: str = "caller",
    audio_duration_ms: Optional[int] = None,
    is_final: bool = True,
) -> LiveCallRiskUpdateResponse:
    """
    Ingests an incremental speech text chunk from the user-authorized live stream,
    updates transcription, highlights suspicious keywords, recalculates risk,
    and returns immediate safety alerts.
    """
    if session_id not in _LIVE_SESSIONS:
        raise KeyError(f"Session {session_id} not found.")

    session = _LIVE_SESSIONS[session_id]

    if session.status == "purged":
        raise ValueError("Cannot ingest speech: Session has been purged.")
    if session.status == "stopped":
        raise ValueError("Cannot ingest speech: Session is stopped.")
    if session.status == "paused":
        # While paused, do not process or record incoming text
        return LiveCallRiskUpdateResponse(
            session_id=session.session_id,
            status=session.status,
            new_utterance=None,
            full_transcript=session.full_transcript,
            current_risk_score=session.current_risk_score,
            current_risk_band=session.current_risk_band,
            highlighted_phrases=session.highlighted_phrases,
            actionable_safety_prompts=session.actionable_safety_prompts,
            tactics_breakdown=session.tactics_breakdown,
            official_helpline_recommendations=session.official_helpline_recommendations,
        )

    now = int(time.time() * 1000)
    cleaned_text = text.strip()
    if not cleaned_text:
        return LiveCallRiskUpdateResponse(
            session_id=session.session_id,
            status=session.status,
            new_utterance=None,
            full_transcript=session.full_transcript,
            current_risk_score=session.current_risk_score,
            current_risk_band=session.current_risk_band,
            highlighted_phrases=session.highlighted_phrases,
            actionable_safety_prompts=session.actionable_safety_prompts,
            tactics_breakdown=session.tactics_breakdown,
            official_helpline_recommendations=session.official_helpline_recommendations,
        )

    # Detect suspicious phrases in the new chunk
    detected = detect_suspicious_phrases(cleaned_text)

    utterance = SpeechUtterance(
        utterance_id=f"UTT-{uuid.uuid4().hex[:6]}",
        timestamp_ms=now,
        speaker=speaker,
        text=cleaned_text,
        suspicious_phrases=detected,
        incremental_risk=sum(p.severity_weight for p in detected),
    )

    # Append to transcript
    if session.full_transcript:
        session.full_transcript += f" {cleaned_text}"
    else:
        session.full_transcript = cleaned_text

    session.utterances.append(utterance)
    session.updated_at = now

    # Merge unique suspicious phrases
    existing_phrases = {p.phrase: p for p in session.highlighted_phrases}
    for p in detected:
        if p.phrase not in existing_phrases:
            session.highlighted_phrases.append(p)
            existing_phrases[p.phrase] = p

    # Update detected categories
    session.detected_categories = sorted(list(set(p.category for p in session.highlighted_phrases)))

    # Re-evaluate risk and actionable prompts
    score, band, prompts, tactics = compute_risk_assessment(session)
    session.current_risk_score = score
    session.current_risk_band = band
    session.actionable_safety_prompts = prompts
    session.tactics_breakdown = tactics

    return LiveCallRiskUpdateResponse(
        session_id=session.session_id,
        status=session.status,
        new_utterance=utterance,
        full_transcript=session.full_transcript,
        current_risk_score=session.current_risk_score,
        current_risk_band=session.current_risk_band,
        highlighted_phrases=session.highlighted_phrases,
        actionable_safety_prompts=session.actionable_safety_prompts,
        tactics_breakdown=session.tactics_breakdown,
        official_helpline_recommendations=session.official_helpline_recommendations,
    )


def pause_session(session_id: str) -> LiveCallSession:
    """Pauses live microphone analysis."""
    if session_id not in _LIVE_SESSIONS:
        raise KeyError(f"Session {session_id} not found.")
    session = _LIVE_SESSIONS[session_id]
    session.status = "paused"
    session.updated_at = int(time.time() * 1000)
    return session


def resume_session(session_id: str) -> LiveCallSession:
    """Resumes paused live microphone analysis."""
    if session_id not in _LIVE_SESSIONS:
        raise KeyError(f"Session {session_id} not found.")
    session = _LIVE_SESSIONS[session_id]
    session.status = "active"
    session.updated_at = int(time.time() * 1000)
    return session


def stop_session(session_id: str) -> LiveCallSession:
    """Stops the live call safety session."""
    if session_id not in _LIVE_SESSIONS:
        raise KeyError(f"Session {session_id} not found.")
    session = _LIVE_SESSIONS[session_id]
    session.status = "stopped"
    session.stopped_at = int(time.time() * 1000)
    session.updated_at = session.stopped_at
    return session


def purge_session(session_id: str) -> dict:
    """
    Completely deletes and purges all live session data, audio memory,
    and transcripts from memory, honoring the user's deletion right.
    """
    if session_id in _LIVE_SESSIONS:
        del _LIVE_SESSIONS[session_id]
    return {
        "purged": True,
        "session_id": session_id,
        "message": "Session transcript, audio references, and risk cache have been permanently wiped.",
    }


def get_session(session_id: str) -> LiveCallSession:
    """Returns the current state of a live session."""
    if session_id not in _LIVE_SESSIONS:
        raise KeyError(f"Session {session_id} not found.")
    return _LIVE_SESSIONS[session_id]

