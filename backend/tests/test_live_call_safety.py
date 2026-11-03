import time
import pytest
from app.models import LiveCallConsent
from app.services import live_call_safety


def test_consent_gate_enforcement():
    # Attempting to start without full consent must fail
    invalid_consent = LiveCallConsent(
        user_acknowledged=True,
        mic_permission_granted=False,  # Mic not granted
        data_processing_accepted=True,
        no_auto_record_acknowledged=True,
        timestamp=int(time.time() * 1000),
    )
    with pytest.raises(ValueError, match="All consent permissions must be explicitly granted"):
        live_call_safety.create_session(invalid_consent)

    # Valid consent succeeds
    valid_consent = LiveCallConsent(
        user_acknowledged=True,
        mic_permission_granted=True,
        data_processing_accepted=True,
        no_auto_record_acknowledged=True,
        timestamp=int(time.time() * 1000),
    )
    session = live_call_safety.create_session(valid_consent, caller_label="Suspected CBI Caller")
    assert session.session_id.startswith("CALL-SAFE-")
    assert session.status == "active"
    assert session.current_risk_score == 0.0
    assert session.current_risk_band == "low"
    assert len(session.utterances) == 0


def test_incremental_speech_ingestion_and_transcription():
    consent = LiveCallConsent(
        user_acknowledged=True,
        mic_permission_granted=True,
        data_processing_accepted=True,
        no_auto_record_acknowledged=True,
        timestamp=int(time.time() * 1000),
    )
    session = live_call_safety.create_session(consent)

    # Ingest chunk 1
    res1 = live_call_safety.ingest_chunk(
        session_id=session.session_id,
        text="Hello, this is Inspector Sharma from Crime Branch.",
        speaker="caller",
    )
    assert res1.full_transcript == "Hello, this is Inspector Sharma from Crime Branch."
    assert res1.new_utterance is not None
    assert len(res1.highlighted_phrases) >= 1
    assert any(p.phrase == "crime branch" for p in res1.highlighted_phrases)

    # Ingest chunk 2
    res2 = live_call_safety.ingest_chunk(
        session_id=session.session_id,
        text="Your Aadhaar was linked to a seized parcel with drugs found inside.",
        speaker="caller",
    )
    assert "drugs found" in res2.full_transcript
    assert len(res2.highlighted_phrases) >= 2


def test_risk_score_escalation_and_actionable_prompts():
    consent = LiveCallConsent(
        user_acknowledged=True,
        mic_permission_granted=True,
        data_processing_accepted=True,
        no_auto_record_acknowledged=True,
        timestamp=int(time.time() * 1000),
    )
    session = live_call_safety.create_session(consent)

    # Heavy digital-arrest scam monologue
    scam_chunks = [
        "You are under digital arrest right now.",
        "A non-bailable warrant and Supreme Court order have been issued.",
        "Do not disconnect this call, stay in a quiet room, and do not tell anyone.",
        "To clear your name, transfer money to the RBI safe account immediately or you will be arrested.",
    ]

    latest_res = None
    for chunk in scam_chunks:
        latest_res = live_call_safety.ingest_chunk(session_id=session.session_id, text=chunk)

    assert latest_res is not None
    # Risk score must be in critical tier
    assert latest_res.current_risk_score >= 75.0
    assert latest_res.current_risk_band == "critical"

    # Actionable safety prompts must include urgent hang up & 1930 helpline
    prompt_text = " ".join(latest_res.actionable_safety_prompts)
    assert "HANG UP IMMEDIATELY" in prompt_text
    assert "DO NOT TRANSFER MONEY" in prompt_text
    assert "1930" in prompt_text

    # Tactics breakdown must capture multiple vectors
    tactics = latest_res.tactics_breakdown
    assert tactics["threat"] > 50.0
    assert tactics["payment"] > 50.0
    assert tactics["secrecy"] > 50.0


def test_pause_resume_and_stop_lifecycle():
    consent = LiveCallConsent(
        user_acknowledged=True,
        mic_permission_granted=True,
        data_processing_accepted=True,
        no_auto_record_acknowledged=True,
        timestamp=int(time.time() * 1000),
    )
    session = live_call_safety.create_session(consent)

    # Ingest initial speech
    live_call_safety.ingest_chunk(session.session_id, text="Can you hear me?")

    # Pause session
    paused_session = live_call_safety.pause_session(session.session_id)
    assert paused_session.status == "paused"

    # Ingestion during pause should NOT modify transcript
    res_paused = live_call_safety.ingest_chunk(
        session_id=session.session_id,
        text="Private family conversation during pause.",
    )
    assert "Private family conversation" not in res_paused.full_transcript

    # Resume session
    resumed_session = live_call_safety.resume_session(session.session_id)
    assert resumed_session.status == "active"

    # Ingest again
    res_resumed = live_call_safety.ingest_chunk(
        session_id=session.session_id,
        text="Caller resumes speaking.",
    )
    assert "Caller resumes speaking" in res_resumed.full_transcript

    # Stop session
    stopped_session = live_call_safety.stop_session(session.session_id)
    assert stopped_session.status == "stopped"

    # Further ingestion on stopped session should raise error
    with pytest.raises(ValueError, match="Session is stopped"):
        live_call_safety.ingest_chunk(session.session_id, text="Further words")


def test_purge_session_wipes_all_data():
    consent = LiveCallConsent(
        user_acknowledged=True,
        mic_permission_granted=True,
        data_processing_accepted=True,
        no_auto_record_acknowledged=True,
        timestamp=int(time.time() * 1000),
    )
    session = live_call_safety.create_session(consent)
    live_call_safety.ingest_chunk(session.session_id, text="Sensitive scam call audio transcript.")

    # Verify session exists
    assert live_call_safety.get_session(session.session_id) is not None

    # Purge session
    purge_result = live_call_safety.purge_session(session.session_id)
    assert purge_result["purged"] is True

    # Subsequent access must fail
    with pytest.raises(KeyError):
        live_call_safety.get_session(session.session_id)


def run_all_tests():
    print("Running backend Live Call Safety tests...")
    test_consent_gate_enforcement()
    print("test_consent_gate_enforcement PASSED")
    test_incremental_speech_ingestion_and_transcription()
    print("test_incremental_speech_ingestion_and_transcription PASSED")
    test_risk_score_escalation_and_actionable_prompts()
    print("test_risk_score_escalation_and_actionable_prompts PASSED")
    test_pause_resume_and_stop_lifecycle()
    print("test_pause_resume_and_stop_lifecycle PASSED")
    test_purge_session_wipes_all_data()
    print("test_purge_session_wipes_all_data PASSED")
    print("ALL 5 LIVE CALL SAFETY BACKEND TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_all_tests()

