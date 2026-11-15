"""
Unit tests for Offline-First Field Seizure & Device Triage Companion.

Validates:
1. Generation of canonical SHA-256 genesis receipt for seized hardware on-scene.
2. RFC 3161 cryptographic timestamping with Stratum 1 GNSS clock record.
3. Automatic sync with central Evidence Vault resolving conflicts via immutable timestamp order.
4. Central intake physical verification and high-visibility tamper detection flagging.
5. Aggregate dashboard stats and status filters.
"""
import pytest
from app.models import (
    CentralIntakeVerificationRequest,
    FieldSeizureCreateRequest,
    FieldSeizureRecord,
    FieldSeizureSyncRequest,
)
from app.routers import field_seizure as router
from app.services import field_seizure as service


@pytest.fixture(autouse=True)
def clean_store():
    """Resets field seizure store before each test."""
    service.reset_field_seizure_store()
    yield
    service.reset_field_seizure_store()


def test_genesis_receipt_sha256_generation_and_rfc3161():
    """Tests on-scene hardware capture, canonical SHA-256 hash, and genesis receipt."""
    req = FieldSeizureCreateRequest(
        case_id="CASE-2026-MUMBAI-01",
        officer_badge="INSP-PATIL-104",
        officer_name="Inspector Sachin Patil",
        police_station="BKC Cyber Police Station, Mumbai",
        device_category="crypto_hardware_wallet",
        make_model="Ledger Stax Hardware Wallet",
        serial_number="LEDGER-STAX-9944",
        mac_address="B0:4E:26:88:99:11",
        seizure_bag_barcode="BAG-MUM-4401-X",
        faraday_bag_sealed=True,
        power_state_at_seizure="powered_off",
        sim_card_status="no_sim",
        seizure_location={
            "latitude": 19.0657,
            "longitude": 72.8686,
            "landmark": "Bandra Kurla Complex, Tower 4, Flat 1002",
            "police_circle": "BKC Cyber Desk",
        },
        photo_hashes=["b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90123456789abcde"],
        offline_timestamp_ms=1770010000000,
    )

    record = service.create_field_seizure_record(req)

    assert record.seizure_id.startswith("SEIZ-2026-DEL-")
    assert record.case_id == "CASE-2026-MUMBAI-01"
    assert record.make_model == "Ledger Stax Hardware Wallet"
    assert record.seizure_bag_barcode == "BAG-MUM-4401-X"
    assert record.faraday_bag_sealed is True
    assert record.sync_status == "queued_offline"
    assert record.tamper_flag is False

    # Verify SHA-256 Genesis Hash calculation
    assert len(record.on_site_genesis_hash) == 64
    expected_hash = service.compute_canonical_genesis_hash(record.model_dump())
    assert record.on_site_genesis_hash == expected_hash

    # Verify RFC 3161 Token
    assert record.rfc3161_token["digest_algorithm"] == "SHA-256"
    assert record.rfc3161_token["digest_value"] == record.on_site_genesis_hash
    assert record.rfc3161_token["clock_stratum"] == 1
    assert record.rfc3161_token["tamper_evident"] is True

    # Verify Genesis Receipt structure
    receipt = record.genesis_receipt
    assert receipt["receipt_number"] == f"RCV-{record.seizure_id}"
    assert receipt["genesis_hash"] == record.on_site_genesis_hash
    assert "Section 105" in receipt["statutory_declaration"]
    assert "ESIGN::INSP-PATIL-104::" in receipt["officer_esign_placeholder"]


def test_offline_sync_and_immutable_timestamp_order():
    """
    Tests syncing offline-captured records.
    Verifies conflict resolution strictly enforces immutable timestamp order:
    the earlier on-scene genesis capture takes precedence.
    """
    # 1. Capture record on field device A at T = 1000
    t_early = 1770001000000
    r_field_dict = {
        "seizure_id": "SEIZ-OFFLINE-TEST-01",
        "case_id": "CASE-2026-DELHI-01",
        "incident_id": "INC-01",
        "officer_badge": "SI-GUPTA-99",
        "officer_name": "SI Gupta",
        "police_station": "Special Cyber Cell",
        "device_category": "smartphone",
        "make_model": "Google Pixel 8 Pro",
        "imei1": "351122334455667",
        "imei2": None,
        "mac_address": "AA:BB:CC:11:22:33",
        "serial_number": "PIX8-991122",
        "seizure_bag_barcode": "BAG-EARLY-01",
        "faraday_bag_sealed": True,
        "power_state_at_seizure": "powered_off",
        "sim_card_status": "removed_and_bagged",
        "seizure_location": {"landmark": "CP Metro Gate 2"},
        "photo_hashes": [],
        "photo_thumbnails": [],
        "offline_timestamp_ms": t_early,
        "offline_timestamp_iso": "2026-02-02T10:00:00Z",
    }
    h_early = service.compute_canonical_genesis_hash(r_field_dict)
    r_field_dict["on_site_genesis_hash"] = h_early
    r_field_dict["rfc3161_token"] = service.generate_rfc3161_token(h_early, t_early)
    r_field_dict["genesis_receipt"] = service.generate_genesis_receipt(r_field_dict, h_early)
    r_field_dict["sync_status"] = "queued_offline"
    r_field_dict["chain_of_custody_events"] = []

    # Sync fresh record into vault
    sync_req = FieldSeizureSyncRequest(
        records=[FieldSeizureRecord(**r_field_dict)],
        sync_source="kshemos_pwa_field_unit",
        synced_by_badge="SI-GUPTA-99",
    )
    sync_res = service.sync_field_seizures(sync_req)
    assert sync_res.synced_count == 1
    assert sync_res.conflict_count == 0
    synced_rec = service.get_field_seizure_record("SEIZ-OFFLINE-TEST-01")
    assert synced_rec is not None
    assert synced_rec.sync_status == "synced_verified"

    # 2. Simulate later conflicting update at T = 2000 trying to overwrite hardware serial
    t_later = 1770002000000
    r_later_dict = dict(r_field_dict)
    r_later_dict["serial_number"] = "PIX8-MODIFIED-TAMPER"
    r_later_dict["offline_timestamp_ms"] = t_later
    r_later_dict["offline_timestamp_iso"] = "2026-02-02T10:16:40Z"
    h_later = service.compute_canonical_genesis_hash(r_later_dict)
    r_later_dict["on_site_genesis_hash"] = h_later

    sync_conflict_req = FieldSeizureSyncRequest(
        records=[FieldSeizureRecord(**r_later_dict)],
        sync_source="kshemos_pwa_conflicting_unit",
        synced_by_badge="OFF-ROGUE-00",
    )
    sync_conflict_res = service.sync_field_seizures(sync_conflict_req)
    assert sync_conflict_res.conflict_count == 1

    # Earlier timestamp record must be preserved
    vault_rec = service.get_field_seizure_record("SEIZ-OFFLINE-TEST-01")
    assert vault_rec.serial_number == "PIX8-991122"  # original preserved
    assert vault_rec.offline_timestamp_ms == t_early


def test_tamper_flag_when_intake_hash_differs():
    """
    Tests central intake physical verification.
    If bag barcode is altered, serial number mismatch, or tamper tape broken,
    system must flag record immediately as synced_tamper_flagged.
    """
    # Create valid record
    req = FieldSeizureCreateRequest(
        case_id="CASE-2026-DELHI-03",
        officer_badge="INSP-KUMAR-771",
        officer_name="Inspector Kumar",
        device_category="hard_drive",
        make_model="Seagate IronWolf Pro 8TB",
        serial_number="WMC2098441",
        seizure_bag_barcode="BAG-SEALED-TRUE-99",
        faraday_bag_sealed=True,
    )
    rec = service.create_field_seizure_record(req)
    assert rec.tamper_flag is False

    # Central intake officer inspects arriving bag: bag arrived with swapped barcode BAG-TAMPER-00
    intake_req = CentralIntakeVerificationRequest(
        seizure_id=rec.seizure_id,
        verified_by_badge="LAB-TECH-VERMA-01",
        received_bag_barcode="BAG-TAMPER-00",  # Mismatch!
        verified_serial="WMC2098441",
        bag_seal_intact=False,  # Broken seal!
        intake_notes="Evidence bag arrived torn at bottom seam.",
    )

    verified_rec = service.verify_central_intake(intake_req)
    assert verified_rec.tamper_flag is True
    assert verified_rec.sync_status == "synced_tamper_flagged"
    assert "INTEGRITY_TAMPER_FLAGGED" in verified_rec.tamper_reason
    assert "Bag barcode mismatch" in verified_rec.tamper_reason
    assert "Evidence bag tamper-evident tape or seal arrived broken/torn" in verified_rec.tamper_reason

    # Verify event in custodial ledger
    last_event = verified_rec.chain_of_custody_events[-1]
    assert last_event["action"] == "CENTRAL_INTAKE_TAMPER_FLAGGED"
    assert last_event["badge"] == "LAB-TECH-VERMA-01"


def test_clean_central_intake_verification():
    """Tests physical intake verification when all barcodes, serials, and seals match."""
    rec = service.get_field_seizure_record("SEIZ-2026-DEL-02")
    assert rec is not None
    assert rec.sync_status == "queued_offline"

    intake_req = CentralIntakeVerificationRequest(
        seizure_id=rec.seizure_id,
        verified_by_badge="LAB-INSPECTOR-SEN-44",
        received_bag_barcode="BAG-DEL-7783-B",  # Exact match
        verified_serial="C02G90XXMD6M",  # Exact match
        bag_seal_intact=True,
        intake_notes="Seal verified under UV lamp. Hardware clean.",
    )

    verified_rec = service.verify_central_intake(intake_req)
    assert verified_rec.tamper_flag is False
    assert verified_rec.sync_status == "synced_verified"
    assert verified_rec.central_intake_hash == verified_rec.on_site_genesis_hash
    assert verified_rec.tamper_reason is None

    last_event = verified_rec.chain_of_custody_events[-1]
    assert last_event["action"] == "CENTRAL_INTAKE_VERIFIED_VALID"


def test_field_seizure_stats_and_filtering():
    """Tests stats computation and query filters."""
    stats = service.get_field_seizure_stats()
    assert stats.total_seizures >= 3
    assert stats.tamper_flagged >= 1
    assert stats.faraday_sealed_percent > 0

    # Filter by Case ID
    delhi_01 = service.get_field_seizure_records(case_id="CASE-2026-DELHI-01")
    assert len(delhi_01) >= 2
    for r in delhi_01:
        assert r.case_id == "CASE-2026-DELHI-01"

    # Filter by tamper flag
    tampered = service.get_field_seizure_records(tamper_flag=True)
    assert len(tampered) >= 1
    assert all(r.tamper_flag is True for r in tampered)


def test_router_endpoints_directly():
    """Directly invokes router endpoint functions to avoid Starlette AnyIO loop hangs."""
    records = router.list_seizure_records(case_id=None, sync_status=None, tamper_flag=None)
    assert len(records) >= 3

    r1 = router.get_seizure_record("SEIZ-2026-DEL-01")
    assert r1.seizure_id == "SEIZ-2026-DEL-01"

    stats = router.get_seizure_stats()
    assert stats.total_seizures == len(records)

    reset_res = router.reset_store()
    assert reset_res["status"] == "reset_successful"

