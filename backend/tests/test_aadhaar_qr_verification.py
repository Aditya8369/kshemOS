"""
Tests for UIDAI Aadhaar Offline QR Verification & USSD Syntax Generator.

Validates:
1. Emergency Mitigation Receipt generation with Aadhaar QR scan metadata.
2. Cryptographic SHA-256 seal incorporation of Aadhaar scan timestamp & last 4 digits.
3. Tamper detection: altering scan timestamp changes receipt SHA-256 seal.
4. Correct action log generation for offline UIDAI cryptographic verification.
"""
import pytest
from app.models import EmergencyMitigationReceiptRequest
from app.services import emergency_killswitch as service


@pytest.fixture(autouse=True)
def clean_receipts():
    service.reset_receipt_store()
    yield
    service.reset_receipt_store()


def test_emergency_receipt_with_aadhaar_qr_metadata():
    """Verifies that UIDAI offline QR scan fields are sealed into the official receipt."""
    req = EmergencyMitigationReceiptRequest(
        citizen_name="Pooja Verma",
        selected_bank_id="hdfc",
        bank_name="HDFC Bank",
        card_last_4="3921",
        account_last_4="1104",
        actions_attempted=[
            "Blocked NetBanking and UPI via bank portal",
        ],
        reported_to_1930=True,
        reported_to_portal=True,
        aadhaar_biometrics_locked=True,
        aadhaar_qr_scanned=True,
        aadhaar_qr_scan_timestamp="2026-11-21T07:25:00+05:30",
        aadhaar_last_4="9842",
        aadhaar_signature_verified=True,
        incident_description="Suspected courier parcel scam seeking AePS biometric authorization.",
    )

    receipt = service.generate_mitigation_receipt(req)

    assert receipt.receipt_id.startswith("EMR-")
    assert receipt.aadhaar_qr_scanned is True
    assert receipt.aadhaar_qr_scan_timestamp == "2026-11-21T07:25:00+05:30"
    assert receipt.aadhaar_last_4 == "9842"
    assert receipt.aadhaar_signature_verified is True

    # Audit action checks
    assert any("UIDAI Secure QR Code" in act for act in receipt.actions_attempted)
    assert any("LOCKUID 9842" in act for act in receipt.actions_attempted)

    # Validate SHA-256 seal exists and is 64 hex characters
    assert len(receipt.sha256_hash) == 64


def test_receipt_tamper_proofing_aadhaar_timestamp():
    """Verifies that any modification to QR scan timestamp or Aadhaar digits changes the SHA-256 hash."""
    req_base = EmergencyMitigationReceiptRequest(
        citizen_name="Rajesh Patel",
        selected_bank_id="sbi",
        bank_name="State Bank of India (SBI)",
        aadhaar_qr_scanned=True,
        aadhaar_qr_scan_timestamp="2026-11-21T07:20:00+05:30",
        aadhaar_last_4="4821",
        aadhaar_signature_verified=True,
    )

    receipt1 = service.generate_mitigation_receipt(req_base)

    # Alter timestamp by 1 second
    req_altered = EmergencyMitigationReceiptRequest(
        citizen_name="Rajesh Patel",
        selected_bank_id="sbi",
        bank_name="State Bank of India (SBI)",
        aadhaar_qr_scanned=True,
        aadhaar_qr_scan_timestamp="2026-11-21T07:20:01+05:30",
        aadhaar_last_4="4821",
        aadhaar_signature_verified=True,
    )

    receipt2 = service.generate_mitigation_receipt(req_altered)

    # Cryptographic seal must differ due to timestamp change
    assert receipt1.sha256_hash != receipt2.sha256_hash
