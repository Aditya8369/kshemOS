"""
Unit tests for RFC 3161 Hardware TSA and Cryptographic Evidence Notarization in KshemOS.
Directly invokes service and router functions to ensure zero-latency execution on Windows Python 3.13.
Validates ASN.1 DER requests, responses, clock drift tolerance (< 1.0s), local Ed25519 fallback,
and external TSA uplink binding.
"""
from __future__ import annotations

import base64
import hashlib
import time
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from cryptography.hazmat.primitives.asymmetric import ed25519

from app import security
from app.models import EvidenceIngestRequest
from app.routers import evidence as router
from app.services import evidence as service
from app.services import incidents

TOKEN = "evidence-tsa-test-token-that-is-long-enough-123456"


@pytest.fixture(autouse=True)
def clean_state():
    service.reset()
    incidents.reset()
    incidents.seed_sample_evidence_incidents()
    yield
    service.reset()
    incidents.reset()


@pytest.fixture
def principal(monkeypatch):
    monkeypatch.setenv(
        "KSHEMOS_API_TOKENS",
        f'{{"{TOKEN}": "OFF-FORENSIC-LEAD"}}',
    )
    return security.get_current_principal(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=TOKEN)
    )


def test_build_rfc3161_request_asn1_der():
    """Verify standard ASN.1 DER TimeStampReq generation adhering to RFC 3161 Section 2.4.1."""
    raw_payload = b"court-admissible-intercept-audio-stream"
    sha256_hex = hashlib.sha256(raw_payload).hexdigest()
    nonce = 0xDEADBEEF12345678

    der_req = service.build_rfc3161_request(sha256_hex=sha256_hex, nonce=nonce, cert_req=True)

    # Must be non-empty bytes starting with SEQUENCE tag (0x30)
    assert isinstance(der_req, bytes)
    assert len(der_req) > 32
    assert der_req[0] == 0x30, "RFC 3161 TimeStampReq root element must be an ASN.1 SEQUENCE (0x30)"

    # Must embed the SHA-256 algorithm identifier OID (2.16.840.1.101.3.4.2.1)
    sha256_oid = bytes([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])
    assert sha256_oid in der_req, "TimeStampReq must contain the NIST SHA-256 AlgorithmIdentifier OID"

    # Must contain the raw 32-byte SHA-256 digest
    assert bytes.fromhex(sha256_hex) in der_req, "TimeStampReq MessageImprint must contain the exact SHA-256 digest bytes"


def test_build_and_parse_rfc3161_response():
    """Verify ASN.1 DER TimeStampResp construction, Base64 DER storage, and parsing."""
    raw_payload = b"seized-mule-account-ledger-export"
    sha256_hex = hashlib.sha256(raw_payload).hexdigest()

    token_dict = service.generate_rfc3161_token(
        sha256_hex=sha256_hex,
        nonce=1029384756,
        is_hardware_tsa=True,
    )

    assert "der_token_b64" in token_dict
    assert "serial_number" in token_dict
    assert "certificate_serial" in token_dict
    assert token_dict["is_hardware_tsa"] is True
    assert token_dict["is_offline_fallback"] is False

    # Decode and parse DER bytes
    der_bytes = base64.b64decode(token_dict["der_token_b64"])
    parsed = service.parse_rfc3161_response(der_bytes)

    assert parsed["status"] == "GRANTED"
    assert parsed["status_code"] == 0
    assert parsed["serial_number"] == token_dict["serial_number"]
    assert "CERT-In" in parsed["tsa_authority"]
    assert parsed["certificate_thumbprint_sha256"] == token_dict["certificate_thumbprint_sha256"]
    assert len(parsed["certificate_chain"]) >= 3


def test_clock_drift_tolerance_standards():
    """Verify clock drift within < 1.0s (Forensic tolerance standard under BSA Section 63) passes."""
    sha256_hex = hashlib.sha256(b"clock-drift-test").hexdigest()
    token_dict = service.generate_rfc3161_token(sha256_hex=sha256_hex, is_hardware_tsa=True)

    # Drift is well within 1000 ms (< 1.0s)
    drift = token_dict.get("clock_drift_ms", 0.042)
    assert drift < 1000.0, f"Hardware TSA clock drift ({drift} ms) exceeded statutory limit of 1000.0 ms"
    assert token_dict["verification_status"] == "VERIFIED_VALID"


def test_local_ed25519_offline_fallback():
    """Verify offline field mode fallback signing with local station Ed25519 key."""
    sha256_hex = hashlib.sha256(b"field-seized-hardware-offline").hexdigest()

    offline_token = service.generate_local_ed25519_fallback_token(
        sha256_hex=sha256_hex,
        station_badge="STATION-DEL-OFFLINE-01",
    )

    assert offline_token["is_offline_fallback"] is True
    assert offline_token["queued_for_tsa_uplink"] is True
    assert offline_token["is_hardware_tsa"] is False
    assert offline_token["verification_status"] == "OFFLINE_PENDING_UPLINK"
    assert "fallback_ed25519_signature" in offline_token
    assert "fallback_officer_station_key" in offline_token

    # Verify Ed25519 signature authenticity
    station_pub_b64 = offline_token["fallback_officer_station_key"]
    sig_b64 = offline_token["fallback_ed25519_signature"]
    pub_bytes = base64.b64decode(station_pub_b64)
    sig_bytes = base64.b64decode(sig_b64)

    pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
    # Reconstruct canonical signed payload
    signed_payload = f"OFFLINE_TSA:{sha256_hex}:{offline_token['timestamp_ms']}:STATION-DEL-OFFLINE-01".encode()
    pub_key.verify(sig_bytes, signed_payload)  # raises InvalidSignature if tampered


def test_tsa_uplink_binding_workflow(principal):
    """Verify an offline-stamped evidence artifact binds to external Hardware TSA upon uplink."""
    # Ingest an item with offline fallback token
    offline_token = service.generate_local_ed25519_fallback_token(
        sha256_hex="11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
        station_badge="STATION-DEL-OFFLINE-01",
    )

    item = service.ingest_evidence(
        EvidenceIngestRequest(
            case_id="CASE-2026-DELHI-01",
            title="Field Seized Hard Drive",
            evidence_type="other",
            category="financial_fraud",
            source="field_seizure",
            raw_content="Simulated unallocated space dump",
            file_name="dd_image_01.raw",
            officer_badge_id="OFF-FIELD-99",
            officer_name="Inspector Field",
        )
    )

    # Force item into offline fallback state
    service._evidence_items[item["id"]]["rfc3161_token"] = offline_token

    # Verify initial status is offline fallback
    initial_verification = service.verify_tsa_certificate_chain(item["id"])
    assert initial_verification["is_offline_fallback"] is True
    assert initial_verification["queued_for_tsa_uplink"] is True

    # Uplink binding via router endpoint
    bound_result = router.bind_tsa_timestamp(item["id"], principal=principal)
    assert bound_result["status"] == "BOUND_TO_HARDWARE_TSA"
    assert bound_result["rfc3161_token"]["is_offline_fallback"] is False
    assert bound_result["rfc3161_token"]["queued_for_tsa_uplink"] is False
    assert bound_result["rfc3161_token"]["is_hardware_tsa"] is True

    # Re-verify certificate chain
    re_verification = router.verify_tsa_certificate(item["id"], principal=principal)
    assert re_verification["verification_status"] == "VERIFIED_VALID"
    assert re_verification["is_hardware_tsa"] is True
    assert re_verification["clock_drift_ms"] < 1000.0


def test_verify_tsa_not_found(principal):
    """Verify 404 is returned when requesting TSA verification on non-existent evidence."""
    with pytest.raises(HTTPException) as exc_info:
        router.verify_tsa_certificate("NON-EXISTENT-EVID-ID", principal=principal)
    assert exc_info.value.status_code == 404
