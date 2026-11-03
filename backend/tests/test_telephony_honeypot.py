"""
Unit tests for AI Telephony Honeypot & Call-Pattern Triangulation.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models import (
    CallForwardRequest,
    CallTurnRequest,
    MuleFreezeRequest,
)
from app.services.telephony_honeypot import (
    TelephonyHoneypotEngine,
    PERSONAS,
)
from app.services.fraud_graph import get_ring_info


def test_personas_catalog():
    """Verifies that all three specialized deflection personas are configured."""
    assert "PERSONA-SHASTRI-68" in PERSONAS
    assert "PERSONA-AGARWAL-52" in PERSONAS
    assert "PERSONA-NAIR-27" in PERSONAS

    shastri = PERSONAS["PERSONA-SHASTRI-68"]
    assert shastri.age == 68
    assert "retired" in shastri.profile.lower()
    assert "spectacles" in shastri.prolongation_tactic.lower()
    print("test_personas_catalog PASSED")


def test_autonomous_deflection_dialogue():
    """Verifies persona conversational tactics prolong calls and coax credentials."""
    engine = TelephonyHoneypotEngine()
    shastri = PERSONAS["PERSONA-SHASTRI-68"]
    sunita = PERSONAS["PERSONA-AGARWAL-52"]

    # Prompt with arrest threat
    reply1 = engine.generate_persona_reply(shastri, "You are under digital arrest by CBI! Do not disconnect!", 1)
    assert "bhagwan" in reply1.lower() or "teacher" in reply1.lower()
    assert "cooperate" in reply1.lower()

    # Prompt with payment demand
    reply2 = engine.generate_persona_reply(shastri, "Transfer the verification fee to our clearance account immediately.", 2)
    assert "account number" in reply2.lower()
    assert "ifsc" in reply2.lower()

    # Sunita Agarwal feigning GPay limit
    reply_sunita = engine.generate_persona_reply(sunita, "Send ₹1,50,000 right now.", 3)
    assert "upi" in reply_sunita.lower() or "account" in reply_sunita.lower()
    print("test_autonomous_deflection_dialogue PASSED")


def test_mule_credential_harvesting():
    """Verifies regex and NER extraction of bank accounts, IFSC, UPI VPAs, and URLs."""
    engine = TelephonyHoneypotEngine()

    transcript = (
        "Transfer ₹1,80,000 immediately to State Bank of India account 919876543210, "
        "IFSC code SBIN0004521, beneficiary Sunil Kumar Meena. Alternatively pay via UPI "
        "to cbi.warrant.clearance@okaxis or visit https://rbi-clearance-portal.online/pay."
    )

    harvested = engine.extract_mule_credentials(transcript)
    assert len(harvested) >= 3

    types = {h.credential_type for h in harvested}
    assert "bank_account" in types
    assert "upi_vpa" in types
    assert "payment_url" in types

    bank_cred = next(h for h in harvested if h.credential_type == "bank_account")
    assert "919876543210" in bank_cred.value
    assert bank_cred.ifsc_code == "SBIN0004521"
    assert bank_cred.beneficiary_name == "Sunil Kumar Meena"

    upi_cred = next(h for h in harvested if h.credential_type == "upi_vpa")
    assert upi_cred.value == "cbi.warrant.clearance@okaxis"

    url_cred = next(h for h in harvested if h.credential_type == "payment_url")
    assert "https://rbi-clearance-portal.online/pay" in url_cred.value
    print("test_mule_credential_harvesting PASSED")


def test_acoustic_and_script_triangulation():
    """Verifies acoustic and script matching against syndicate signatures."""
    engine = TelephonyHoneypotEngine()

    mewat_call = (
        "This is CBI Inspector from Mumbai customs. A package containing MDMA contraband was seized with your Aadhaar. "
        "You are under 24-hour digital arrest by Supreme Court order. Transfer security deposit to RBI holding account."
    )

    acoustic, triangulation = engine.triangulate_call_patterns(mewat_call)

    assert triangulation.matched_syndicate_id == "SYND-MEWAT-08"
    assert "Mewat" in triangulation.matched_syndicate_name
    assert triangulation.script_similarity_pct >= 85.0
    assert acoustic.ambient_cross_talk_score >= 0.70
    assert acoustic.voip_codec_jitter_ms > 30.0
    print("test_acoustic_and_script_triangulation PASSED")


def test_fraud_graph_pipeline_and_freeze_recommendation():
    """Verifies that harvested mule accounts are piped into the Fraud Graph with elevated mule probability and freeze status."""
    engine = TelephonyHoneypotEngine()

    # Process turn with new mule account
    session_id = "HP-CALL-8841"
    utterance = "Send the money to HDFC bank account 309100201948 IFSC HDFC0001245 beneficiary Rohan Das."
    updated_session = engine.process_turn(session_id, utterance)

    # Check that mule account was harvested
    assert any("309100201948" in cr.value for cr in updated_session.harvested_credentials)

    # Check Fraud Graph Engine linkage
    graph_info = get_ring_info("ACC-309100201948")
    assert graph_info["is_flagged"] is True
    assert graph_info["mule_probability"] >= 0.95
    assert graph_info["harvested_by_honeypot"] is True

    # Execute statutory freeze
    target_cred = next(cr for cr in updated_session.harvested_credentials if "309100201948" in cr.value)
    frozen = engine.freeze_credential(
        session_id,
        MuleFreezeRequest(
            credential_id=target_cred.credential_id,
            officer_badge="OFF-CYBER-901",
            statutory_section="Section 102 CrPC",
        )
    )
    assert frozen.freeze_status == "frozen"
    print("test_fraud_graph_pipeline_and_freeze_recommendation PASSED")


def test_citizen_call_forwarding():
    """Verifies one-tap citizen call handoff initiates deflection session with selected persona."""
    engine = TelephonyHoneypotEngine()

    req = CallForwardRequest(
        caller_phone="+91-99887-76655",
        caller_claims_to_be="Delhi Police Cyber Cell ACP Verma",
        citizen_name="Vikas Anand",
        initial_transcript="You have 10 minutes to pay the fine or we arrest you.",
        preferred_persona_id="PERSONA-SHASTRI-68",
    )

    session = engine.forward_call(req)
    assert session.session_id.startswith("HP-CALL-")
    assert session.caller_phone == "+91-99887-76655"
    assert session.persona.name == "Prof. Rameshwar Shastri"
    assert session.call_status == "active"
    assert len(session.transcript_turns) == 2
    assert session.transcript_turns[1]["speaker"] == "PERSONA"
    print("test_citizen_call_forwarding PASSED")


def run_all_tests():
    test_personas_catalog()
    test_autonomous_deflection_dialogue()
    test_mule_credential_harvesting()
    test_acoustic_and_script_triangulation()
    test_fraud_graph_pipeline_and_freeze_recommendation()
    test_citizen_call_forwarding()
    print("ALL 6 TELEPHONY HONEYPOT BACKEND TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_all_tests()

