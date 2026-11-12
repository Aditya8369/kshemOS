"""
Unit tests for Emergency Financial Kill-Switch & Aadhaar Biometric Lock.

Validates:
1. Bank emergency directory (verified USSD codes, SMS block commands, and hotlines).
2. Aadhaar biometric locking guide & AePS defense walkthrough.
3. Generation of SHA-256 sealed Emergency Mitigation Receipts for RBI Zero-Liability compliance.
4. Router endpoint response codes and data models.
"""
import pytest
from fastapi import HTTPException

from app.models import EmergencyMitigationReceiptRequest
from app.routers import emergency_killswitch as router
from app.services import emergency_killswitch as service


@pytest.fixture(autouse=True)
def clean_receipts():
    """Resets the receipts store before and after each test."""
    service.reset_receipt_store()
    yield
    service.reset_receipt_store()


def test_get_all_banks_directory():
    """Verifies all major Indian banks are loaded with verified emergency codes."""
    banks = service.get_all_banks()
    assert len(banks) >= 12

    bank_ids = {b.bank_id for b in banks}
    assert "sbi" in bank_ids
    assert "hdfc" in bank_ids
    assert "icici" in bank_ids
    assert "axis" in bank_ids
    assert "pnb" in bank_ids
    assert "bob" in bank_ids

    # Validate mandatory fields
    for b in banks:
        assert b.bank_name
        assert b.ussd_code.startswith("*99")
        assert b.sms_card_block_syntax
        assert b.sms_card_block_number
        assert b.phone_hotline
        assert b.netbanking_url.startswith("https://")


def test_get_bank_by_id():
    """Tests looking up specific bank freeze details and 404 for invalid bank."""
    sbi = service.get_bank_by_id("sbi")
    assert sbi is not None
    assert sbi.bank_name == "State Bank of India (SBI)"
    assert "BLOCK" in sbi.sms_card_block_syntax
    assert sbi.sms_card_block_number == "567676"
    assert "1800 1234" in sbi.phone_hotline

    unknown = service.get_bank_by_id("non_existent_bank")
    assert unknown is None

    # Router 404 check
    with pytest.raises(HTTPException) as exc_info:
        router.get_bank_details("unknown_xyz")
    assert exc_info.value.status_code == 404


def test_get_aadhaar_biometric_lock_guide():
    """Validates Aadhaar biometric lock guidance and AePS defense details."""
    guide = service.get_aadhaar_guide()
    assert guide.myaadhaar_portal_url == "https://myaadhaar.uidai.gov.in"
    assert guide.uidai_helpline == "1947"
    assert "AePS" in guide.why_lock_biometrics
    assert "micro-ATMs" in guide.why_lock_biometrics
    assert len(guide.steps) == 5

    # Check 1947 SMS syntax
    assert "GETOTP" in guide.sms_1947_syntax["step_1_get_otp"]
    assert "LOCKUID" in guide.sms_1947_syntax["step_2_lock_uid"]


def test_generate_emergency_mitigation_receipt_sha256():
    """
    Tests generating a certified Emergency Mitigation Receipt.
    Verifies SHA-256 seal, RBI circular citation, and IST timestamp.
    """
    req = EmergencyMitigationReceiptRequest(
        citizen_name="Rahul Sharma",
        selected_bank_id="sbi",
        bank_name="State Bank of India (SBI)",
        card_last_4="4412",
        account_last_4="8819",
        actions_attempted=[
            "Sent SMS BLOCK 4412 to 567676",
            "Dialed *99# to disable UPI",
        ],
        reported_to_1930=True,
        reported_to_portal=True,
        aadhaar_biometrics_locked=True,
        incident_description="Suspected digital arrest extortion call attempting NetBanking drain.",
    )

    receipt = service.generate_mitigation_receipt(req)

    assert receipt.receipt_id.startswith("EMR-")
    assert receipt.citizen_name == "Rahul Sharma"
    assert receipt.bank_name == "State Bank of India (SBI)"
    assert receipt.card_last_4 == "4412"
    assert receipt.reported_to_1930 is True
    assert receipt.aadhaar_biometrics_locked is True

    # Validate timestamping
    assert "IST" in receipt.timestamp_ist
    assert receipt.timestamp_ms > 0

    # Validate statutory RBI reference
    assert "DBR.No.Leg.BC.78/09.07.005/2017-18" in receipt.rbi_circular_reference
    assert "Zero Liability" in receipt.rbi_circular_reference

    # Validate cryptographic hash
    assert len(receipt.sha256_hash) == 64
    assert receipt.verification_token.startswith("RBI-MITIG-")


def test_receipt_retrieval_and_reset():
    """Tests saving and retrieving a receipt from the store, and resetting."""
    req = EmergencyMitigationReceiptRequest(
        selected_bank_id="hdfc",
        bank_name="HDFC Bank",
        card_last_4="9901",
    )
    receipt = service.generate_mitigation_receipt(req)

    fetched = service.get_receipt_by_id(receipt.receipt_id)
    assert fetched is not None
    assert fetched.receipt_id == receipt.receipt_id
    assert fetched.bank_name == "HDFC Bank"

    # Reset
    service.reset_receipt_store()
    assert service.get_receipt_by_id(receipt.receipt_id) is None


def test_router_endpoints_directly():
    """Invokes router endpoint functions directly to verify API responses."""
    banks = router.list_banks()
    assert len(banks) >= 12

    sbi = router.get_bank_details("sbi")
    assert sbi.bank_id == "sbi"

    guide = router.get_aadhaar_guide()
    assert guide.uidai_helpline == "1947"

    req = EmergencyMitigationReceiptRequest(
        selected_bank_id="icici",
        bank_name="ICICI Bank",
        reported_to_1930=True,
    )
    res = router.generate_receipt(req)
    assert res.receipt_id.startswith("EMR-")

    retrieved = router.get_receipt(res.receipt_id)
    assert retrieved.receipt_id == res.receipt_id

    reset_res = router.reset_receipts()
    assert reset_res["status"] == "reset_successful"
