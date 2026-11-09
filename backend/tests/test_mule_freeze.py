"""
Unit and Integration Tests for Automated UPI Mule Account Freeze Dispatch via CFCFRMS / 1930 Protocol.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import mule_freeze
from app.services.mule_freeze import (
    parse_financial_entities,
    validate_ifsc,
    validate_utr,
    validate_vpa,
    evaluate_freeze_priority,
    generate_section_102_crpc_notice,
    generate_cfcfrms_payload,
    dispatch_freeze_request,
    record_bank_acknowledgment,
    revoke_freeze_request,
    reset as reset_mule_freeze,
)


@pytest.fixture(autouse=True)
def clean_freeze_registry():
    reset_mule_freeze()
    yield
    reset_mule_freeze()


def test_vpa_validation():
    """Verify standard and phone-linked VPA parsing and validation."""
    # Standard valid VPAs
    res1 = validate_vpa("merchant.fastpay@okaxis")
    assert res1["is_valid"] is True
    assert res1["handle"] == "okaxis"
    assert res1["is_phone_linked"] is False

    # Phone-linked VPA
    res2 = validate_vpa("9876543210@paytm")
    assert res2["is_valid"] is True
    assert res2["is_phone_linked"] is True
    assert res2["handle"] == "paytm"

    # Invalid VPAs
    assert validate_vpa("not-an-email-or-vpa")["is_valid"] is False
    assert validate_vpa("@paytm")["is_valid"] is False
    assert validate_vpa("user@")["is_valid"] is False


def test_utr_and_ifsc_validation():
    """Verify 12-digit UTR and 11-char IFSC validation."""
    assert validate_utr("431209876543") is True
    assert validate_utr("12345") is False
    assert validate_utr("43120987654A") is False
    assert validate_utr("43120987654321") is False

    ifsc_valid = validate_ifsc("SBIN0001234")
    assert ifsc_valid["is_valid"] is True
    assert ifsc_valid["bank_code"] == "SBIN"

    ifsc_invalid = validate_ifsc("SBIN1234")
    assert ifsc_invalid["is_valid"] is False


def test_parse_financial_entities_from_text():
    """Verify extraction of financial indicators from unstructured citizen messages."""
    complaint = (
        "Caller coerced me on WhatsApp call. Transferred Rs 45,000 to cyberfraud.mule@ybl "
        "and another Rs 10,000 to 9123456789@paytm. Transaction reference UTR was 431209876543. "
        "Beneficiary account mentioned was 20491827401 with IFSC HDFC0000240."
    )
    extracted = parse_financial_entities(complaint)
    assert "cyberfraud.mule@ybl" in extracted["vpas"]
    assert "9123456789@paytm" in extracted["vpas"]
    assert "9123456789@paytm" in extracted["phone_linked_vpas"]
    assert "431209876543" in extracted["utrs"]
    assert "HDFC0000240" in extracted["ifsc_codes"]
    assert "20491827401" in extracted["account_numbers"]
    assert extracted["extracted_count"] >= 5


def test_fraud_graph_hop_and_velocity_evaluation():
    """Verify priority tier assignment based on KshemOS Fraud Graph and velocity."""
    # ACC-1002 is a known mule account in the Fraud Graph seed data
    eval_known_mule = evaluate_freeze_priority(
        vpa="mule@okaxis",
        account_number="ACC-1002",
        transaction_amount=60000.0,
    )
    assert eval_known_mule["graph_hop_distance"] == 0
    assert eval_known_mule["priority_tier"] == "TIER_1_IMMEDIATE_STOP"
    assert eval_known_mule["sla_minutes"] == 15

    # Rapid sequential transactions trigger high velocity score
    recent_txns = [
        {"timestamp": "2026-11-09T10:00:00Z", "amount": 25000},
        {"timestamp": "2026-11-09T10:15:00Z", "amount": 25000},
        {"timestamp": "2026-11-09T10:30:00Z", "amount": 25000},
    ]
    eval_velocity = evaluate_freeze_priority(
        vpa="layering.mule@upi",
        transaction_amount=30000.0,
        transaction_timestamp_iso="2026-11-09T10:45:00Z",
        recent_transactions=recent_txns,
    )
    assert eval_velocity["has_rapid_burst"] is True
    assert eval_velocity["velocity_score"] >= 0.70
    assert eval_velocity["priority_tier"] == "TIER_1_IMMEDIATE_STOP"


def test_statutory_section_102_notice_generation():
    """Verify Section 102 CrPC legal notice text and SHA-256 verification hash."""
    notice = generate_section_102_crpc_notice(
        freeze_id="FRZ-UPI-2026-9001",
        incident_id="INC-2026-DELHI-88",
        suspect_vpa="syndicate@ybl",
        suspect_account="98127391827",
        suspect_ifsc="PUNB0123400",
        utr_number="431209876543",
        transaction_amount=75000.0,
        officer_name="Inspector Rajesh Sharma",
        officer_badge_id="OFF-DELHI-101",
    )
    assert "SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE, 1973" in notice["legal_text"]
    assert "BHARATIYA NAGARIK SURAKSHA SANHITA" in notice["legal_text"]
    assert "syndicate@ybl" in notice["legal_text"]
    assert "431209876543" in notice["legal_text"]
    assert len(notice["content_hash"]) == 64  # Valid SHA-256


def test_cfcfrms_payload_schema():
    """Verify I4C / NPCI CFCFRMS JSON payload generation."""
    evaluation = evaluate_freeze_priority(
        vpa="mule@paytm",
        transaction_amount=50000.0,
        utr_number="431209876543",
    )
    payload = generate_cfcfrms_payload(
        freeze_id="FRZ-UPI-2026-9001",
        incident_id="INC-2026-88",
        eval_result=evaluation,
        officer_badge_id="OFF-DELHI-101",
        officer_name="Inspector Rajesh Sharma",
    )
    assert payload["cfcfrms_header"]["gateway_protocol"] == "I4C-NPCI-PRIORITY-FREEZE-v2.4"
    assert payload["transaction_mandate"]["utr_number"] == "431209876543"
    assert payload["suspect_beneficiary"]["vpa"] == "mule@paytm"
    assert payload["suspect_beneficiary"]["freeze_type"] == "PROVISIONAL_DEBIT_FREEZE"


def test_full_freeze_lifecycle_and_audit_trail():
    """Verify dispatch -> bank acknowledgment -> latency recording -> revocation flow."""
    # 1. Dispatch
    record = dispatch_freeze_request(
        incident_id="INC-2026-DELHI-101",
        suspect_vpa="extortion.mule@okaxis",
        suspect_account="ACC-1002",
        utr_number="431209876543",
        transaction_amount=85000.0,
        is_digital_arrest=True,
    )
    freeze_id = record["freeze_id"]
    assert record["status"] == "DISPATCHED"
    assert record["priority_tier"] == "TIER_1_IMMEDIATE_STOP"
    assert len(record["audit_events"]) == 2

    # 2. Record bank acknowledgment
    start_time = record["dispatched_at_ms"]
    ack_time = start_time + 4200  # 4.2 seconds later
    updated = record_bank_acknowledgment(
        freeze_id=freeze_id,
        bank_nodal_ref="AXIS-NODAL-FRZ-88912",
        freeze_outcome="FROZEN",
        notes="Account debit frozen; lien placed on Rs 85,000.",
        now_ms=ack_time,
    )
    assert updated["status"] == "FROZEN"
    assert updated["bank_nodal_ref"] == "AXIS-NODAL-FRZ-88912"
    assert updated["bank_response_time_ms"] == 4200
    assert len(updated["audit_events"]) == 3

    # 3. Revoke freeze with reason
    revoked = revoke_freeze_request(
        freeze_id=freeze_id,
        revoking_officer_badge_id="OFF-DELHI-101",
        revocation_reason="False positive complaint verified; legitimate merchant account.",
    )
    assert revoked["status"] == "REVOKED"
    assert len(revoked["audit_events"]) == 4


def test_mule_freeze_api_endpoints():
    """Verify end-to-end FastAPI endpoints for the freeze dispatch pipeline."""
    client = TestClient(app)

    # 1. Parse endpoint
    parse_resp = client.post(
        "/api/mule-freeze/parse",
        json={"text": "Please freeze beneficiary 9876543210@paytm and UTR 998877665544 IFSC SBIN0001234"},
    )
    assert parse_resp.status_code == 200
    p_data = parse_resp.json()
    assert "9876543210@paytm" in p_data["vpas"]
    assert "998877665544" in p_data["utrs"]
    assert "SBIN0001234" in p_data["ifsc_codes"]

    # 2. Evaluate endpoint
    eval_resp = client.post(
        "/api/mule-freeze/evaluate",
        json={
            "vpa": "suspect.mule@ybl",
            "transaction_amount": 55000.0,
            "utr_number": "998877665544",
            "is_digital_arrest": True,
        },
    )
    assert eval_resp.status_code == 200
    e_data = eval_resp.json()
    assert e_data["priority_tier"] == "TIER_1_IMMEDIATE_STOP"

    # 3. Dispatch endpoint
    dispatch_resp = client.post(
        "/api/mule-freeze/dispatch",
        json={
            "incident_id": "INC-TEST-001",
            "suspect_vpa": "suspect.mule@ybl",
            "utr_number": "998877665544",
            "transaction_amount": 55000.0,
            "officer_badge_id": "OFF-DELHI-101",
            "officer_name": "Inspector R. K. Sharma",
        },
    )
    assert dispatch_resp.status_code == 200
    d_data = dispatch_resp.json()
    freeze_id = d_data["freeze_id"]
    assert d_data["status"] == "DISPATCHED"

    # 4. List requests
    list_resp = client.get("/api/mule-freeze/requests")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 5. Get detail request
    get_resp = client.get(f"/api/mule-freeze/requests/{freeze_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["freeze_id"] == freeze_id
    assert "SECTION 102" in get_resp.json()["statutory_notice"]["legal_text"]

    # 6. Acknowledge request
    ack_resp = client.post(
        f"/api/mule-freeze/requests/{freeze_id}/acknowledge",
        json={
            "bank_nodal_ref": "BANK-ACK-1002",
            "freeze_outcome": "FROZEN",
            "notes": "Debit freeze active.",
        },
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "FROZEN"

    # 7. Stats endpoint
    stats_resp = client.get("/api/mule-freeze/stats")
    assert stats_resp.status_code == 200
    s_data = stats_resp.json()
    assert s_data["total_requests"] == 1
    assert s_data["frozen"] == 1
    assert s_data["total_amount_protected_inr"] == 55000.0
