"""
Unit and Integration Tests for Multilingual Automated Voice Safety Hotline.
Directly invokes service and router functions to avoid AnyIO portal cleanup delays on Windows.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from app.routers import voice_safety_hotline as hotline_router
from app.services.voice_safety_hotline import (
    default_hotline_engine,
    VoiceSafetyHotlineEngine,
    SUPPORTED_INDIC_LANGUAGES,
    INDIC_HOTLINE_CATALOG,
)
from app.models import (
    VoiceHotlineCallRequest,
    VoiceHotlineInputRequest,
)


@pytest.fixture(autouse=True)
def clean_hotline_state():
    default_hotline_engine.sessions.clear()
    yield
    default_hotline_engine.sessions.clear()


def test_supported_languages_list():
    langs = hotline_router.get_supported_languages()
    assert len(langs) == 8

    codes = [l.code for l in langs]
    expected_codes = ["en", "hi", "ta", "te", "kn", "bn", "mr", "gu"]
    for code in expected_codes:
        assert code in codes

    # Verify native autonyms
    hi = next(l for l in langs if l.code == "hi")
    assert hi.native_name == "हिन्दी"
    assert hi.dtmf_key == "2"

    ta = next(l for l in langs if l.code == "ta")
    assert ta.native_name == "தமிழ்"
    assert ta.dtmf_key == "3"

    kn = next(l for l in langs if l.code == "kn")
    assert kn.native_name == "ಕನ್ನಡ"
    assert kn.dtmf_key == "5"


def test_start_hotline_call():
    req = VoiceHotlineCallRequest(
        caller_phone="+91 98765 43210",
        initial_language="en",
        telecom_circle="Delhi",
        is_forwarded_call=False,
    )
    res = hotline_router.start_hotline_call(req)

    assert res.session_id.startswith("HOTLINE-")
    assert res.current_step == "WELCOME_LANG_SELECT"
    assert res.selected_language == "en"
    assert "Welcome to the KshemOS Cyber Safety Hotline" in res.audio_text
    assert "1" in res.allowed_dtmf_keys
    assert "2" in res.allowed_dtmf_keys
    assert "Rohini" in res.nearest_cyber_desk
    assert res.is_completed is False


def test_full_ivr_conversation_in_hindi():
    engine = VoiceSafetyHotlineEngine()

    # 1. Start call
    prompt0 = engine.start_call(VoiceHotlineCallRequest(
        caller_phone="+91 91234 56789",
        initial_language="en",
        telecom_circle="Delhi",
    ))
    session_id = prompt0.session_id

    # 2. Citizen presses '2' on keypad for Hindi
    prompt1 = engine.process_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="2",
    ))
    assert prompt1.current_step == "PROMPT_AUTHORITY"
    assert prompt1.selected_language == "hi"
    assert "कस्टम्स, पुलिस, सीबीआई" in prompt1.audio_text
    assert prompt1.allowed_dtmf_keys == ["1", "2"]

    # 3. Citizen presses '1' (Yes, caller claimed to be police)
    prompt2 = engine.process_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="1",
    ))
    assert prompt2.current_step == "PROMPT_EXTORTION"
    assert prompt2.claimed_authority is True
    assert "गिरफ्तारी से बचने के लिए पैसे" in prompt2.audio_text

    # 4. Citizen presses '1' (Yes, demanded money / video digital arrest)
    prompt3 = engine.process_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="1",
    ))
    assert prompt3.current_step == "COMPLETED"
    assert prompt3.demanded_money is True
    assert prompt3.reassurance_delivered is True
    # Calm authoritative reassurance in Hindi
    assert "सरकारी एजेंसियां कभी भी ऑनलाइन ट्रांसफर या वीडियो अरेस्ट की मांग नहीं करती हैं" in prompt3.audio_text
    assert "तुरंत फोन काट दें" in prompt3.audio_text

    # SMS dispatch validation
    assert prompt3.sms_dispatched is True
    assert "1930" in prompt3.sms_summary
    assert "cybercrime.gov.in" in prompt3.sms_summary
    assert prompt3.triage_incident_id is not None
    assert prompt3.is_completed is True


def test_ivr_flow_in_tamil_via_router():
    # 1. Start call
    req = VoiceHotlineCallRequest(
        caller_phone="+91 94440 12345",
        initial_language="en",
        telecom_circle="Chennai",
    )
    prompt0 = hotline_router.start_hotline_call(req)
    session_id = prompt0.session_id

    # 2. Select Tamil (DTMF 3)
    prompt1 = hotline_router.submit_call_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="3",
    ))
    assert prompt1.selected_language == "ta"
    assert "சுங்கத்துறை, காவல்துறை" in prompt1.audio_text

    # 3. Step 1: Authority Claimed (DTMF 1)
    prompt2 = hotline_router.submit_call_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="1",
    ))
    assert prompt2.claimed_authority is True
    assert "கைதைத் தவிர்க்க பணம்" in prompt2.audio_text

    # 4. Step 2: Extortion Demanded (DTMF 1) -> Spoken Reassurance & SMS
    prompt3 = hotline_router.submit_call_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="1",
    ))
    assert prompt3.reassurance_delivered is True
    assert "அரசு அமைப்புகள் ஒருபோதும் ஆன்லைன் பணப்பரிமாற்றம்" in prompt3.audio_text
    assert "உடனடியாக அழைப்பைத் துண்டிக்கவும்" in prompt3.audio_text
    assert prompt3.sms_dispatched is True
    assert "1930" in prompt3.sms_summary
    assert "Chennai" in prompt3.nearest_cyber_desk or "Tamil Nadu" in prompt3.nearest_cyber_desk


def test_ivr_flow_in_marathi_mumbai_circle():
    engine = VoiceSafetyHotlineEngine()

    prompt0 = engine.start_call(VoiceHotlineCallRequest(
        caller_phone="+91 98200 55443",
        initial_language="mr",
        telecom_circle="Mumbai",
    ))
    session_id = prompt0.session_id

    # Select Marathi (DTMF 7)
    prompt1 = engine.process_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="7",
    ))
    assert prompt1.selected_language == "mr"
    assert "कस्टम्स, पोलीस" in prompt1.audio_text

    # Answer Step 1: Yes (1)
    prompt2 = engine.process_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="1",
    ))
    assert prompt2.claimed_authority is True
    assert "अटक टाळण्यासाठी त्यांनी पैसे" in prompt2.audio_text

    # Answer Step 2: Yes (1)
    prompt3 = engine.process_input(VoiceHotlineInputRequest(
        session_id=session_id,
        dtmf_digit="1",
    ))
    assert prompt3.reassurance_delivered is True
    assert "सरकारी यंत्रणा कधीही ऑनलाइन पैसे ट्रान्सफर किंवा व्हिडिओ अरेस्टची मागणी करत नाहीत" in prompt3.audio_text
    assert "BKC Cyber Police Station" in prompt3.nearest_cyber_desk
    assert prompt3.sms_dispatched is True
    assert prompt3.triage_incident_id is not None


def test_anonymous_caller_phone_masking():
    engine = VoiceSafetyHotlineEngine()
    prompt0 = engine.start_call(VoiceHotlineCallRequest(
        caller_phone="+91 98765 43210",
        telecom_circle="Delhi",
    ))
    record = engine.sessions[prompt0.session_id]
    # Check that plain phone number is masked
    assert record.caller_phone_masked == "+91 XXXXX 3210"
    assert "+91 98765" not in record.caller_phone_masked


def test_hotline_sessions_list_and_stats():
    # Start two calls in default engine
    r1 = hotline_router.start_hotline_call(VoiceHotlineCallRequest(caller_phone="+91 98111 22222", initial_language="hi"))
    hotline_router.submit_call_input(VoiceHotlineInputRequest(session_id=r1.session_id, dtmf_digit="2"))
    hotline_router.submit_call_input(VoiceHotlineInputRequest(session_id=r1.session_id, dtmf_digit="1"))
    hotline_router.submit_call_input(VoiceHotlineInputRequest(session_id=r1.session_id, dtmf_digit="1"))

    # Fetch session list
    sessions = hotline_router.list_hotline_sessions()
    assert len(sessions) >= 1
    s_detail = hotline_router.get_hotline_session(r1.session_id)
    assert s_detail.session_id == r1.session_id
    assert s_detail.sms_dispatched is True

    # Fetch stats
    stats = hotline_router.get_hotline_statistics()
    assert stats.total_calls >= 1
    assert stats.authorities_flagged >= 1
    assert stats.reassurances_delivered >= 1
    assert stats.sms_dispatched_count >= 1


def test_invalid_session_raises_exception():
    with pytest.raises(Exception):
        hotline_router.submit_call_input(VoiceHotlineInputRequest(
            session_id="HOTLINE-NON-EXISTENT",
            dtmf_digit="1",
        ))
