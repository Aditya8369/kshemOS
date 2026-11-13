"""
Unit tests for DPDP Act Redaction & Identity Masking Pipeline.
Directly invokes service and router functions to avoid AnyIO portal cleanup delays on Windows.
"""
import sys
import time
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from app.models import (
    PiiSanitizationRequest,
    PseudonymizeFeedRequest,
    UnmaskApprovalRequest,
    UnmaskRequestCreate,
)
from app.routers import dpdp as dpdp_router
from app.services import dpdp_sanitization as dpdp_service


@pytest.fixture(autouse=True)
def clean_dpdp_state():
    """Reset DPDP service state before each test."""
    dpdp_service.reset()
    yield
    dpdp_service.reset()


def test_aadhaar_masking():
    """Verify 12-digit Aadhaar masking to UIDAI standard format: XXXX-XXXX-1234."""
    # Space separated
    res1 = dpdp_service.mask_aadhaar("4829 1042 8492")
    assert res1 == "XXXX-XXXX-8492"

    # Hyphen separated
    res2 = dpdp_service.mask_aadhaar("4829-1042-8492")
    assert res2 == "XXXX-XXXX-8492"

    # Continuous digits
    res3 = dpdp_service.mask_aadhaar("482910428492")
    assert res3 == "XXXX-XXXX-8492"

    # In text narrative
    text = "Citizen stated that caller demanded Aadhaar number 9842 1290 7741 for clearance."
    clean, detected = dpdp_service.sanitize_text(text)
    assert "XXXX-XXXX-7741" in clean
    assert "9842 1290 7741" not in clean
    assert any(d["entity_type"] == "AADHAAR" for d in detected)


def test_pan_masking():
    """Verify 10-character PAN masking to standard format: ABCDE****F."""
    res1 = dpdp_service.mask_pan("ABCDE1234F")
    assert res1 == "ABCDE****F"

    # In complaint narrative
    text = "Complainant shared income tax PAN card ABCDE9876Z under digital arrest duress."
    clean, detected = dpdp_service.sanitize_text(text)
    assert "ABCDE****Z" in clean
    assert "ABCDE9876Z" not in clean
    assert any(d["entity_type"] == "PAN" for d in detected)


def test_bank_account_masking():
    """Verify bank account number masking to format: XXXXXXXX1234."""
    res1 = dpdp_service.mask_bank_account("987654321098")
    assert res1 == "XXXXXXXX1098"

    text = "Victim was pressured to transfer funds from SBI account 501004928172 to mule account."
    clean, detected = dpdp_service.sanitize_text(text)
    assert "XXXXXXXX8172" in clean
    assert "501004928172" not in clean
    assert any(d["entity_type"] == "BANK_ACCOUNT" for d in detected)


def test_mobile_and_email_masking():
    """Verify Indian mobile phone and email address masking."""
    res_mob = dpdp_service.mask_mobile("+91 98765 43210")
    assert res_mob == "+91 XXXXX 43210"

    res_email = dpdp_service.mask_email("rajesh.kumar@delhipolice.gov.in")
    assert res_email == "r***r@delhipolice.gov.in"


def test_recursive_object_sanitization():
    """Verify deep JSON object sanitization across nested fields."""
    complaint_payload = {
        "complainant": {
            "name": "Vikramaditya Sen",
            "aadhaar": "8841 9920 1234",
            "pan": "BHYPK8492Q",
            "primary_account": "11009842109281",
        },
        "incident_details": {
            "narrative": "Scammer threatened me saying Aadhaar 8841 9920 1234 is linked to narcotics.",
            "caller_phone": "+91 98765 12345",
        },
    }

    req = PiiSanitizationRequest(object_payload=complaint_payload)
    res = dpdp_router.sanitize_pii_endpoint(req)

    clean_obj = res["sanitized_payload"]
    assert clean_obj["complainant"]["aadhaar"] == "XXXX-XXXX-1234"
    assert clean_obj["complainant"]["pan"] == "BHYPK****Q"
    assert clean_obj["complainant"]["primary_account"] == "XXXXXXXX9281"
    assert "XXXX-XXXX-1234" in clean_obj["incident_details"]["narrative"]
    assert "8841 9920 1234" not in clean_obj["incident_details"]["narrative"]
    assert res["redactions_count"] >= 3


def test_persistent_pseudonymization_preserves_topology():
    """
    Verify threat feed pseudonymization assigns persistent CITIZEN_REF tokens
    preserving graph relationships between shared entities without exposing credentials.
    """
    raw_citizen_id = "CITIZEN-AADHAAR-8841-9920"
    mule_account = "MULE-HDFC-9941"

    feed_items = [
        {
            "report_id": "REP-01",
            "citizen_id": raw_citizen_id,
            "source_type": "CITIZEN",
            "source": raw_citizen_id,
            "target": mule_account,
            "amount": 50000,
            "description": "Victim transfer from Aadhaar 8841 9920 1234 to mule.",
        },
        {
            "report_id": "REP-02",
            "citizen_id": raw_citizen_id,
            "source_type": "CITIZEN",
            "source": raw_citizen_id,
            "target": "MULE-AXIS-2210",
            "amount": 25000,
            "description": "Secondary hop from same citizen.",
        },
    ]

    req = PseudonymizeFeedRequest(feed_items=feed_items)
    res = dpdp_router.pseudonymize_threat_feed_endpoint(req)

    sanitized = res["sanitized_items"]
    assert len(sanitized) == 2

    token_1 = sanitized[0]["citizen_id"]
    token_2 = sanitized[1]["citizen_id"]

    # Must be deterministic: same citizen ID maps to the exact same persistent token
    assert token_1 == token_2
    assert token_1.startswith("CITIZEN_REF_")
    assert raw_citizen_id not in str(sanitized)

    # Graph edge relationship topology is preserved
    assert sanitized[0]["source"] == token_1
    assert sanitized[1]["source"] == token_1
    assert sanitized[0]["target"] == mule_account
    assert res["graph_topology_preserved"] is True


def test_unmask_workflow_dual_authorization_and_lease():
    """
    Verify access-controlled unmask workflow:
    - Submission enters PENDING_SUPERVISORY_APPROVAL
    - Self-approval by requester is strictly BLOCKED (dual authorization)
    - Independent supervisor approval grants 60-minute time-bounded lease
    - Reveal access returns unmasked identity and writes audit trail
    """
    # 1. Submit unmask request
    submit_req = UnmaskRequestCreate(
        record_id="CASE-RECORD-TEST-01",
        field_name="aadhaar",
        case_fir_number="FIR No. 201/2026 PS Cyber Crime",
        legal_basis="SECTION_91_CRPC",
        justification="Mandatory Section 91 CrPC judicial summons require verifying victim Aadhaar with nodal bank.",
        requester_badge_id="OFF-IO-7712",
        requester_name="Inspector Ankit Verma",
    )
    req_record = dpdp_service.submit_unmask_request(submit_req.model_dump())
    req_id = req_record["request_id"]
    assert req_record["status"] == "PENDING_SUPERVISORY_APPROVAL"

    # 2. Requester attempts self-approval -> MUST BE BLOCKED
    with pytest.raises(ValueError) as exc:
        dpdp_service.review_unmask_request(
            request_id=req_id,
            action="APPROVE",
            supervisor_badge_id="OFF-IO-7712",  # SAME BADGE ID
            supervisor_name="Inspector Ankit Verma",
            approval_notes="Attempted self approval",
        )
    assert "Dual-authorization violation" in str(exc.value)

    # 3. Independent supervisor approves
    reviewed = dpdp_service.review_unmask_request(
        request_id=req_id,
        action="APPROVE",
        supervisor_badge_id="SUP-DCP-9901",  # DIFFERENT SUPERVISOR BADGE
        supervisor_name="DCP Cyber Crime Ops",
        approval_notes="Approved pursuant to Section 91 CrPC notice in FIR 201/2026.",
    )
    assert reviewed["status"] == "APPROVED"
    assert reviewed["lease_expires_at"] > int(time.time() * 1000)

    # 4. Reveal unmasked value under active lease
    revealed = dpdp_service.reveal_unmasked_value(
        request_id=req_id,
        requester_badge_id="OFF-IO-7712",
    )
    assert revealed["unmasked_value"] == "4829 1042 8492"
    assert revealed["seconds_remaining"] > 3500
    assert "CONFIDENTIAL" in revealed["statutory_warning"]

    # 5. Verify audit trail entry logged
    audit_logs = dpdp_service.get_dpdp_audit_trail()
    unmask_entries = [e for e in audit_logs if e["action"] == "DPDP_UNMASK_ACCESSED"]
    assert len(unmask_entries) >= 1
    assert unmask_entries[0]["actor_badge_id"] == "OFF-IO-7712"
    assert unmask_entries[0]["record_id"] == "CASE-RECORD-TEST-01"


def test_list_unmask_requests_endpoint():
    """Verify listing unmask requests with case and status filtering."""
    requests = dpdp_router.list_unmask_requests_endpoint()
    assert len(requests) >= 1
    assert requests[0]["request_id"].startswith("UNMASK-REQ-")
