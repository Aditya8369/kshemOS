"""
Unit tests for Automated Chain of Custody & Digital Evidence Vault in KshemOS.
Directly invokes service and router functions to avoid Starlette AnyIO blocking portal hangs on Windows Python 3.13.
"""
from __future__ import annotations

import pytest
from app.models import (
    CustodialActionRequest,
    EvidenceIngestRequest,
    LegalHoldToggleRequest,
)
from app.routers import evidence as router
from app.services import evidence as service


@pytest.fixture(autouse=True)
def clean_state():
    service.reset()
    yield
    service.reset()


def test_default_evidence_items():
    items = router.list_evidence()
    assert len(items) >= 4
    item_ids = [i["id"] for i in items]
    assert "EVID-2026-00101" in item_ids
    assert "EVID-2026-00102" in item_ids

    # Check item structure
    first = router.get_evidence("EVID-2026-00101")
    assert first is not None
    assert first["category"] == "digital_arrest"
    assert len(first["sha256_hash"]) == 64
    assert first["rfc3161_token"]["tsa_authority"].startswith("KshemOS-TSA")
    assert first["rfc3161_token"]["serial_number"].startswith("TSA-")

    # Check genesis custodial log
    ledger = router.get_custodial_ledger("EVID-2026-00101")
    assert len(ledger) >= 1
    assert ledger[0]["action"] == "INGESTION"
    assert ledger[0]["previous_hash"] == service.GENESIS_HASH


def test_ingest_evidence_and_fingerprinting():
    raw_payload = "WHATSAPP-CHAT-EXTRACT-VICTIM-98710: Suspect threatened arrest in 30 mins."
    expected_sha = service.compute_sha256(raw_payload)

    req = EvidenceIngestRequest(
        case_id="CASE-2026-EAST-04",
        title="WhatsApp Chat Transcript Threat Extraction",
        description="Exported forensic WhatsApp chat log between victim and impersonator.",
        evidence_type="chat_transcript",
        category="cyber_extortion",
        source="citizen_report",
        raw_content=raw_payload,
        file_name="whatsapp_chat_threat_extract.txt",
        officer_badge_id="OFF-CYBER-TASKFORCE",
        officer_name="Inspector Amit Sharma",
        legal_hold=False,
        tags=["whatsapp", "chat", "extortion"],
    )

    created = router.ingest_evidence(req)
    assert created["case_id"] == "CASE-2026-EAST-04"
    assert created["sha256_hash"] == expected_sha
    assert created["rfc3161_token"]["digest_value"] == expected_sha
    assert created["rfc3161_token"]["serial_number"].startswith("TSA-")

    # Check statutory retention calculation for cyber_extortion (1825 days / 5 years)
    assert created["retention_days"] == 1825
    assert created["retention_until"] > created["ingested_at"]


def test_immutable_custodial_ledger_chaining():
    # Ingest evidence
    req = EvidenceIngestRequest(
        case_id="CASE-2026-WEST-09",
        title="Mule UPI Transaction Screenshot",
        description="Screenshot of Google Pay UPI transfer confirmation of ₹1,00,000.",
        evidence_type="image_screenshot",
        category="financial_fraud",
        source="citizen_report",
        raw_content="PNG-MULE-UPI-CONFIRMATION-UTR-992182001",
        file_name="upi_tx_screenshot_100k.png",
        officer_badge_id="OFF-W1",
        officer_name="Sub-Inspector Neha",
    )
    created = router.ingest_evidence(req)
    ev_id = created["id"]

    # Log sequential custodial actions
    act1 = router.log_action(
        ev_id,
        CustodialActionRequest(
            action="VIEW",
            officer_badge_id="OFF-FORENSIC-01",
            officer_name="Forensic Analyst Kapoor",
            client_ip="192.168.1.45",
            details="Inspected optical compression and timestamp metadata.",
        ),
    )

    act2 = router.log_action(
        ev_id,
        CustodialActionRequest(
            action="ANNOTATE",
            officer_badge_id="OFF-FORENSIC-01",
            officer_name="Forensic Analyst Kapoor",
            client_ip="192.168.1.45",
            details="Added investigative tag: Mule Beneficiary UPI ID confirmed.",
        ),
    )

    act3 = router.log_action(
        ev_id,
        CustodialActionRequest(
            action="DOWNLOAD",
            officer_badge_id="OFF-PROSECUTOR-03",
            officer_name="Special Public Prosecutor Dave",
            client_ip="10.200.1.5",
            details="Downloaded copy for framing charges in District Court.",
        ),
    )

    ledger = router.get_custodial_ledger(ev_id)
    assert len(ledger) == 4  # INGESTION + VIEW + ANNOTATE + DOWNLOAD

    # Verify cryptographic hash chaining
    for i in range(1, len(ledger)):
        assert ledger[i]["previous_hash"] == ledger[i - 1]["integrity_hash"]

    # Integrity verification must pass
    ver = router.verify_integrity(ev_id)
    assert ver["verified"] is True
    assert ver["sha256_match"] is True
    assert ver["custodial_ledger_intact"] is True
    assert ver["ledger_entries_verified"] == 4


def test_tamper_detection():
    # Ingest clean evidence
    req = EvidenceIngestRequest(
        case_id="CASE-TAMPER-TEST",
        title="Original Digital Note",
        description="Authentic uncorrupted record.",
        evidence_type="document",
        category="financial_fraud",
        source="bank_slip",
        raw_content="AUTHENTIC-ORIGINAL-CONTENT-PAYLOAD",
        file_name="original_note.txt",
        officer_badge_id="OFF-ORIGIN",
    )
    created = router.ingest_evidence(req)
    ev_id = created["id"]

    # Initially verified
    init_ver = router.verify_integrity(ev_id)
    assert init_ver["verified"] is True

    # Tamper with the raw content
    service._raw_payloads[ev_id] = "MODIFIED-TAMPERED-CORRUPTED-CONTENT-PAYLOAD"

    # Integrity check must fail
    tampered_ver = router.verify_integrity(ev_id)
    assert tampered_ver["verified"] is False
    assert tampered_ver["sha256_match"] is False
    assert "FAILED" in tampered_ver["tamper_status"]


def test_legal_hold_and_retention_policy():
    policies = router.list_retention_policies()
    assert len(policies) >= 5
    categories = [p["category"] for p in policies]
    assert "digital_arrest" in categories
    assert "financial_fraud" in categories
    assert "counterfeit_currency" in categories

    ev_id = "EVID-2026-00103"
    orig = router.get_evidence(ev_id)
    assert orig["legal_hold"] is False

    # Apply legal hold
    hold_req = LegalHoldToggleRequest(
        legal_hold=True,
        reason="Preservation notice received from High Court Registrar in WP 102/2026",
        officer_badge_id="OFF-LEGAL-HEAD",
        officer_name="DCP Legal Ops",
    )
    updated = router.toggle_legal_hold(ev_id, hold_req)
    assert updated["legal_hold"] is True
    assert updated["legal_hold_reason"].startswith("Preservation notice")

    # Verify audit entry logged
    ledger = router.get_custodial_ledger(ev_id)
    hold_entries = [e for e in ledger if e["action"] == "LEGAL_HOLD_APPLIED"]
    assert len(hold_entries) >= 1

    # Release legal hold
    release_req = LegalHoldToggleRequest(
        legal_hold=False,
        reason="Litigation concluded; judgment pronounced.",
        officer_badge_id="OFF-LEGAL-HEAD",
        officer_name="DCP Legal Ops",
    )
    released = router.toggle_legal_hold(ev_id, release_req)
    assert released["legal_hold"] is False
    assert released["legal_hold_reason"] is None


def test_forensic_export_bundle_generation():
    case_id = "CASE-2026-DELHI-01"
    bundle = router.generate_forensic_bundle(
        case_id=case_id,
        officer_badge_id="OFF-FORENSIC-DIRECTOR",
    )

    assert bundle["bundle_id"].startswith("BUNDLE-CRIM-")
    assert bundle["case_id"] == case_id
    assert len(bundle["evidence_items"]) >= 2
    assert len(bundle["manifest_sha256"]) == 64
    assert bundle["tamper_verification_passed"] is True
    assert "Section 65B" in bundle["attestation_statement"]

    # Check that each evidence item in the bundle received an EXPORT_BUNDLE log entry
    for ev in bundle["evidence_items"]:
        ledger = router.get_custodial_ledger(ev["id"])
        export_logs = [e for e in ledger if e["action"] == "EXPORT_BUNDLE"]
        assert len(export_logs) >= 1


def run_all_tests():
    tests = [
        test_default_evidence_items,
        test_ingest_evidence_and_fingerprinting,
        test_immutable_custodial_ledger_chaining,
        test_tamper_detection,
        test_legal_hold_and_retention_policy,
        test_forensic_export_bundle_generation,
    ]
    for t in tests:
        service.reset()
        t()
        print(f"PASS: {t.__name__}")
    print(f"\nAll {len(tests)} digital evidence vault backend tests passed successfully!")


if __name__ == "__main__":
    run_all_tests()
