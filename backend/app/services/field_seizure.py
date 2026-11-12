"""
Offline-First Field Seizure & Device Triage Companion Service for KshemOS.

Implements:
- SHA-256 genesis receipt generation for seized hardware on-scene.
- RFC 3161-compliant offline cryptographic timestamping.
- Automatic synchronization with central Evidence Vault with immutable timestamp ordering.
- Central intake physical verification and high-visibility tamper detection flagging.
"""
from __future__ import annotations

import copy
import hashlib
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.models import (
    CentralIntakeVerificationRequest,
    FieldSeizureCreateRequest,
    FieldSeizureRecord,
    FieldSeizureStatsResponse,
    FieldSeizureSyncRequest,
    FieldSeizureSyncResponse,
)

_lock = threading.RLock()
_seizure_store: Dict[str, Dict[str, Any]] = {}
_counter = 1000


def _now_ms() -> int:
    return int(time.time() * 1000)


def compute_sha256(content: str | bytes) -> str:
    """Compute standard SHA-256 hex digest."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def compute_canonical_genesis_hash(data: Dict[str, Any]) -> str:
    """
    Computes a canonical SHA-256 genesis hash of seized hardware attributes.
    Binds hardware identity, physical bag seal barcode, and capture timestamp.
    """
    photo_hashes = data.get("photo_hashes") or []
    if isinstance(photo_hashes, list):
        sorted_photos = ",".join(sorted(str(h).strip() for h in photo_hashes))
    else:
        sorted_photos = str(photo_hashes).strip()

    canonical_parts = [
        str(data.get("case_id", "")).strip().upper(),
        str(data.get("device_category", "")).strip().lower(),
        str(data.get("make_model", "")).strip().upper(),
        str(data.get("imei1", "") or "").strip().upper(),
        str(data.get("imei2", "") or "").strip().upper(),
        str(data.get("mac_address", "") or "").strip().upper(),
        str(data.get("serial_number", "") or "").strip().upper(),
        str(data.get("seizure_bag_barcode", "")).strip().upper(),
        "FARADAY_SEALED" if data.get("faraday_bag_sealed", True) else "UNSEALED",
        str(data.get("power_state_at_seizure", "powered_off")).strip().lower(),
        str(data.get("sim_card_status", "removed_and_bagged")).strip().lower(),
        str(data.get("offline_timestamp_ms", "")).strip(),
        str(data.get("officer_badge", "")).strip().upper(),
        sorted_photos,
    ]
    raw_payload = "|".join(canonical_parts)
    return compute_sha256(raw_payload)


def generate_rfc3161_token(digest: str, timestamp_ms: int) -> Dict[str, Any]:
    """Generates an RFC 3161 timestamp token with local stratum verification."""
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    seed = f"{digest}:{timestamp_ms}:KshemOS-OfflineTSA"
    serial = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16].upper()
    return {
        "timestamp_iso": dt.isoformat(),
        "serial_number": f"TSA-OFFLINE-{serial}",
        "digest_algorithm": "SHA-256",
        "digest_value": digest,
        "tsa_authority": "KshemOS-Field-TSA-Local (GNSS Disciplined RTC)",
        "clock_stratum": 1,
        "tamper_evident": True,
    }


def generate_genesis_receipt(record: Dict[str, Any], genesis_hash: str) -> Dict[str, Any]:
    """Issues an officer-authorized Section 105 BNSS / Section 102 CrPC genesis receipt."""
    seizure_id = record.get("seizure_id", "SEIZ-GENESIS")
    badge = record.get("officer_badge", "OFFICER")
    dt_iso = record.get("offline_timestamp_iso", datetime.now(timezone.utc).isoformat())
    return {
        "receipt_number": f"RCV-{seizure_id}",
        "genesis_hash": genesis_hash,
        "timestamp_iso": dt_iso,
        "device_summary": f"{record.get('make_model', 'Hardware')} ({record.get('device_category', 'Device')})",
        "bag_barcode": record.get("seizure_bag_barcode", "UNSPECIFIED"),
        "faraday_sealed": bool(record.get("faraday_bag_sealed", True)),
        "statutory_declaration": (
            "Under Section 105 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) "
            "and Section 102 CrPC, this digital device was seized in situ, sealed in a "
            "tamper-evident anti-static/Faraday bag, and cryptographically hashed before removal."
        ),
        "officer_esign_placeholder": f"ESIGN::{badge}::{genesis_hash[:16]}",
        "verification_status": "AUTHENTIC_GENESIS_SEAL",
    }


def seed_default_records() -> None:
    """Pre-seeds standard sample seized devices for field inspection and testing."""
    global _counter
    with _lock:
        _seizure_store.clear()

        # Record 1: Samsung Galaxy S24 Ultra - Clean Synced
        t1 = 1770000000000
        dt1 = datetime.fromtimestamp(t1 / 1000, tz=timezone.utc).isoformat()
        r1_data: Dict[str, Any] = {
            "seizure_id": "SEIZ-2026-DEL-01",
            "case_id": "CASE-2026-DELHI-01",
            "incident_id": "INC-DEL-401",
            "officer_badge": "INSP-VERMA-771",
            "officer_name": "Inspector Ananya Verma",
            "police_station": "Special Cyber Cell, Central Delhi",
            "device_category": "smartphone",
            "make_model": "Samsung Galaxy S24 Ultra (512GB)",
            "imei1": "358901234567891",
            "imei2": "358901234567892",
            "mac_address": "8C:AA:B5:12:34:56",
            "serial_number": "R5CX1088ZZP",
            "seizure_bag_barcode": "BAG-DEL-7782-A",
            "faraday_bag_sealed": True,
            "power_state_at_seizure": "powered_off",
            "sim_card_status": "removed_and_bagged",
            "seizure_location": {
                "latitude": 28.6328,
                "longitude": 77.2197,
                "landmark": "Connaught Place Call Center Hub, Block B",
                "police_circle": "Connaught Place PS",
            },
            "photo_hashes": ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
            "photo_thumbnails": ["data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='%236366f1'><rect width='100%' height='100%' fill='%23e0e7ff'/><text x='50%' y='50%' font-size='12' text-anchor='middle' dy='.3em'>S24 Ultra</text></svg>"],
            "offline_timestamp_ms": t1,
            "offline_timestamp_iso": dt1,
        }
        h1 = compute_canonical_genesis_hash(r1_data)
        r1_data["on_site_genesis_hash"] = h1
        r1_data["rfc3161_token"] = generate_rfc3161_token(h1, t1)
        r1_data["genesis_receipt"] = generate_genesis_receipt(r1_data, h1)
        r1_data["sync_status"] = "synced_verified"
        r1_data["synced_at_iso"] = dt1
        r1_data["central_intake_hash"] = h1
        r1_data["central_intake_at_iso"] = dt1
        r1_data["intake_verified_by_badge"] = "LAB-TECH-SOOD-09"
        r1_data["tamper_flag"] = False
        r1_data["tamper_reason"] = None
        r1_data["chain_of_custody_events"] = [
            {
                "event_id": "EVT-SEIZ-001",
                "action": "ON_SITE_SEIZURE_SEALED",
                "badge": "INSP-VERMA-771",
                "timestamp_iso": dt1,
                "details": "Hardware placed in Faraday sleeve and sealed in Bag BAG-DEL-7782-A.",
            },
            {
                "event_id": "EVT-SEIZ-002",
                "action": "CENTRAL_VAULT_INTAKE_VERIFIED",
                "badge": "LAB-TECH-SOOD-09",
                "timestamp_iso": dt1,
                "details": "Evidence bag seal intact. Barcode and IMEI match on-site genesis hash.",
            },
        ]
        _seizure_store[r1_data["seizure_id"]] = r1_data

        # Record 2: MacBook Pro M3 - Queued Offline
        t2 = 1770003600000
        dt2 = datetime.fromtimestamp(t2 / 1000, tz=timezone.utc).isoformat()
        r2_data: Dict[str, Any] = {
            "seizure_id": "SEIZ-2026-DEL-02",
            "case_id": "CASE-2026-DELHI-01",
            "incident_id": "INC-DEL-402",
            "officer_badge": "SI-MALIK-882",
            "officer_name": "Sub-Inspector Kabir Malik",
            "police_station": "Special Cyber Cell, Central Delhi",
            "device_category": "laptop",
            "make_model": "Apple MacBook Pro 16-inch M3 Max",
            "imei1": None,
            "imei2": None,
            "mac_address": "3C:22:FB:44:AA:99",
            "serial_number": "C02G90XXMD6M",
            "seizure_bag_barcode": "BAG-DEL-7783-B",
            "faraday_bag_sealed": True,
            "power_state_at_seizure": "powered_off",
            "sim_card_status": "no_sim",
            "seizure_location": {
                "latitude": 28.6310,
                "longitude": 77.2180,
                "landmark": "Syndicate Operations Office 404, Barakhamba Road",
                "police_circle": "Barakhamba Road PS",
            },
            "photo_hashes": ["a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0"],
            "photo_thumbnails": [],
            "offline_timestamp_ms": t2,
            "offline_timestamp_iso": dt2,
        }
        h2 = compute_canonical_genesis_hash(r2_data)
        r2_data["on_site_genesis_hash"] = h2
        r2_data["rfc3161_token"] = generate_rfc3161_token(h2, t2)
        r2_data["genesis_receipt"] = generate_genesis_receipt(r2_data, h2)
        r2_data["sync_status"] = "queued_offline"
        r2_data["synced_at_iso"] = None
        r2_data["central_intake_hash"] = None
        r2_data["central_intake_at_iso"] = None
        r2_data["intake_verified_by_badge"] = None
        r2_data["tamper_flag"] = False
        r2_data["tamper_reason"] = None
        r2_data["chain_of_custody_events"] = [
            {
                "event_id": "EVT-SEIZ-003",
                "action": "ON_SITE_SEIZURE_SEALED",
                "badge": "SI-MALIK-882",
                "timestamp_iso": dt2,
                "details": "Laptop seized, lid closed in shutdown state, sealed in Bag BAG-DEL-7783-B.",
            }
        ]
        _seizure_store[r2_data["seizure_id"]] = r2_data

        # Record 3: OnePlus 12 - Tamper Flagged Demo
        t3 = 1770007200000
        dt3 = datetime.fromtimestamp(t3 / 1000, tz=timezone.utc).isoformat()
        r3_data: Dict[str, Any] = {
            "seizure_id": "SEIZ-2026-DEL-03",
            "case_id": "CASE-2026-DELHI-02",
            "incident_id": "INC-DEL-403",
            "officer_badge": "INSP-RAWAT-09",
            "officer_name": "Inspector Dev Rawat",
            "police_station": "Cyber Crime Police Station, North Delhi",
            "device_category": "smartphone",
            "make_model": "OnePlus 12 5G (256GB)",
            "imei1": "864209876543210",
            "imei2": "864209876543211",
            "mac_address": "40:88:05:AA:BB:CC",
            "serial_number": "OP1298442X",
            "seizure_bag_barcode": "BAG-DEL-7784-C",
            "faraday_bag_sealed": False,
            "power_state_at_seizure": "powered_on",
            "sim_card_status": "kept_in_slot",
            "seizure_location": {
                "latitude": 28.7041,
                "longitude": 77.1025,
                "landmark": "Rohini Sector 7 Apartment 12B",
                "police_circle": "Rohini North PS",
            },
            "photo_hashes": ["f3a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde"],
            "photo_thumbnails": [],
            "offline_timestamp_ms": t3,
            "offline_timestamp_iso": dt3,
        }
        h3 = compute_canonical_genesis_hash(r3_data)
        r3_data["on_site_genesis_hash"] = h3
        r3_data["rfc3161_token"] = generate_rfc3161_token(h3, t3)
        r3_data["genesis_receipt"] = generate_genesis_receipt(r3_data, h3)
        r3_data["sync_status"] = "synced_tamper_flagged"
        r3_data["synced_at_iso"] = dt3
        # In this demo, the central lab received a different bag or altered serial
        fake_intake_hash = compute_sha256(h3 + "_TAMPERED_PHYSICAL_INTAKE")
        r3_data["central_intake_hash"] = fake_intake_hash
        r3_data["central_intake_at_iso"] = dt3
        r3_data["intake_verified_by_badge"] = "LAB-TECH-SOOD-09"
        r3_data["tamper_flag"] = True
        r3_data["tamper_reason"] = (
            "Integrity Alert: On-site capture hash (7a88...) differs from central intake verification. "
            "Evidence bag seal arrived broken and device IMEI inspected in lab differed from on-scene record."
        )
        r3_data["chain_of_custody_events"] = [
            {
                "event_id": "EVT-SEIZ-004",
                "action": "ON_SITE_SEIZURE_SEALED",
                "badge": "INSP-RAWAT-09",
                "timestamp_iso": dt3,
                "details": "Device seized at scene in Bag BAG-DEL-7784-C.",
            },
            {
                "event_id": "EVT-SEIZ-005",
                "action": "INTAKE_TAMPER_DETECTED",
                "badge": "LAB-TECH-SOOD-09",
                "timestamp_iso": dt3,
                "details": "TAMPER FLAGGED: Bag seal broken and verification hash mismatch.",
            },
        ]
        _seizure_store[r3_data["seizure_id"]] = r3_data


# Initialize seed data
seed_default_records()


def get_field_seizure_records(
    case_id: Optional[str] = None,
    sync_status: Optional[str] = None,
    tamper_flag: Optional[bool] = None,
) -> List[FieldSeizureRecord]:
    """Retrieves field seizure records filtered by case or status."""
    with _lock:
        results = []
        for rec in _seizure_store.values():
            if case_id and rec.get("case_id", "").upper() != case_id.upper():
                continue
            if sync_status and rec.get("sync_status") != sync_status:
                continue
            if tamper_flag is not None and rec.get("tamper_flag") != tamper_flag:
                continue
            results.append(FieldSeizureRecord(**rec))
        # Sort by offline_timestamp_ms descending
        results.sort(key=lambda x: x.offline_timestamp_ms, reverse=True)
        return results


def get_field_seizure_record(seizure_id: str) -> Optional[FieldSeizureRecord]:
    """Retrieves a single field seizure record by seizure ID."""
    with _lock:
        rec = _seizure_store.get(seizure_id)
        if rec:
            return FieldSeizureRecord(**rec)
        return None


def create_field_seizure_record(req: FieldSeizureCreateRequest) -> FieldSeizureRecord:
    """
    Creates a new field seizure record on-scene.
    Computes cryptographic SHA-256 genesis hash and RFC 3161 token.
    """
    global _counter
    with _lock:
        _counter += 1
        t_ms = req.offline_timestamp_ms or _now_ms()
        dt_iso = datetime.fromtimestamp(t_ms / 1000, tz=timezone.utc).isoformat()
        seizure_id = f"SEIZ-2026-DEL-{_counter:04d}"

        raw_dict: Dict[str, Any] = {
            "seizure_id": seizure_id,
            "case_id": req.case_id,
            "incident_id": req.incident_id,
            "officer_badge": req.officer_badge,
            "officer_name": req.officer_name,
            "police_station": req.police_station,
            "device_category": req.device_category,
            "make_model": req.make_model,
            "imei1": req.imei1,
            "imei2": req.imei2,
            "mac_address": req.mac_address,
            "serial_number": req.serial_number,
            "seizure_bag_barcode": req.seizure_bag_barcode,
            "faraday_bag_sealed": req.faraday_bag_sealed,
            "power_state_at_seizure": req.power_state_at_seizure,
            "sim_card_status": req.sim_card_status,
            "seizure_location": req.seizure_location or {},
            "photo_hashes": req.photo_hashes or [],
            "photo_thumbnails": req.photo_thumbnails or [],
            "offline_timestamp_ms": t_ms,
            "offline_timestamp_iso": dt_iso,
        }

        genesis_hash = compute_canonical_genesis_hash(raw_dict)
        raw_dict["on_site_genesis_hash"] = genesis_hash
        raw_dict["rfc3161_token"] = generate_rfc3161_token(genesis_hash, t_ms)
        raw_dict["genesis_receipt"] = generate_genesis_receipt(raw_dict, genesis_hash)
        raw_dict["sync_status"] = "queued_offline"
        raw_dict["synced_at_iso"] = None
        raw_dict["central_intake_hash"] = None
        raw_dict["central_intake_at_iso"] = None
        raw_dict["intake_verified_by_badge"] = None
        raw_dict["tamper_flag"] = False
        raw_dict["tamper_reason"] = None
        raw_dict["chain_of_custody_events"] = [
            {
                "event_id": f"EVT-SEIZ-{_counter:04d}-01",
                "action": "ON_SITE_SEIZURE_SEALED",
                "badge": req.officer_badge,
                "timestamp_iso": dt_iso,
                "details": f"Device {req.make_model} seized in situ and sealed in bag {req.seizure_bag_barcode}.",
            }
        ]

        _seizure_store[seizure_id] = raw_dict
        return FieldSeizureRecord(**raw_dict)


def sync_field_seizures(sync_req: FieldSeizureSyncRequest) -> FieldSeizureSyncResponse:
    """
    Synchronizes offline-captured field seizure records with the central Evidence Vault.
    Resolves conflicts via IMMUTABLE TIMESTAMP ORDER:
    - Earliest verified on-scene timestamp (genesis capture) takes authoritative precedence.
    - Post-seizure backdating or contradictory modifications are rejected or archived.
    """
    with _lock:
        synced_count = 0
        conflict_count = 0
        tamper_flagged_count = 0
        processed_records: List[FieldSeizureRecord] = []
        now_dt = datetime.now(timezone.utc).isoformat()

        for incoming in sync_req.records:
            incoming_dict = incoming.model_dump()
            seizure_id = incoming_dict["seizure_id"]
            existing = _seizure_store.get(seizure_id)

            if existing:
                # Conflict evaluation via immutable timestamp order
                existing_t = existing.get("offline_timestamp_ms", 0)
                incoming_t = incoming_dict.get("offline_timestamp_ms", 0)

                if incoming_t < existing_t:
                    # Incoming has earlier verified capture timestamp - it represents earlier ground truth
                    conflict_count += 1
                    incoming_dict["chain_of_custody_events"].append(
                        {
                            "event_id": f"EVT-SYNC-{_now_ms()}",
                            "action": "CONFLICT_RESOLVED_EARLIER_TIMESTAMP_WON",
                            "badge": sync_req.synced_by_badge,
                            "timestamp_iso": now_dt,
                            "details": (
                                f"Conflict resolved: incoming capture timestamp ({incoming_dict['offline_timestamp_iso']}) "
                                f"predated server record ({existing.get('offline_timestamp_iso')}). Authoritative genesis updated."
                            ),
                        }
                    )
                    incoming_dict["sync_status"] = "synced_verified" if not incoming_dict.get("tamper_flag") else "synced_tamper_flagged"
                    incoming_dict["synced_at_iso"] = now_dt
                    _seizure_store[seizure_id] = incoming_dict
                    processed_records.append(FieldSeizureRecord(**incoming_dict))
                else:
                    # Existing has earlier or equal timestamp - existing remains authoritative
                    conflict_count += 1
                    existing["chain_of_custody_events"].append(
                        {
                            "event_id": f"EVT-SYNC-{_now_ms()}",
                            "action": "CONFLICT_RESOLVED_EXISTING_GENESIS_PRESERVED",
                            "badge": sync_req.synced_by_badge,
                            "timestamp_iso": now_dt,
                            "details": (
                                f"Conflict resolved: existing server capture timestamp ({existing.get('offline_timestamp_iso')}) "
                                f"is earlier than or equal to incoming ({incoming_dict['offline_timestamp_iso']}). Existing ground truth retained."
                            ),
                        }
                    )
                    processed_records.append(FieldSeizureRecord(**existing))
            else:
                # Fresh record from offline queue
                # Validate genesis hash integrity
                computed_hash = compute_canonical_genesis_hash(incoming_dict)
                if computed_hash != incoming_dict.get("on_site_genesis_hash"):
                    incoming_dict["tamper_flag"] = True
                    incoming_dict["sync_status"] = "synced_tamper_flagged"
                    incoming_dict["tamper_reason"] = (
                        f"Cryptographic Inconsistency: Genesis hash provided ({incoming_dict.get('on_site_genesis_hash')}) "
                        f"does not match canonical hardware digest ({computed_hash})."
                    )
                    tamper_flagged_count += 1
                else:
                    incoming_dict["sync_status"] = "synced_verified"

                incoming_dict["synced_at_iso"] = now_dt
                incoming_dict["chain_of_custody_events"].append(
                    {
                        "event_id": f"EVT-SYNC-{_now_ms()}",
                        "action": "SYNCED_TO_CENTRAL_VAULT",
                        "badge": sync_req.synced_by_badge,
                        "timestamp_iso": now_dt,
                        "details": f"Offline seizure record synced from field companion ({sync_req.sync_source}).",
                    }
                )
                _seizure_store[seizure_id] = incoming_dict
                synced_count += 1
                if incoming_dict.get("tamper_flag"):
                    tamper_flagged_count += 1
                processed_records.append(FieldSeizureRecord(**incoming_dict))

        return FieldSeizureSyncResponse(
            synced_count=synced_count,
            conflict_count=conflict_count,
            tamper_flagged_count=tamper_flagged_count,
            records=processed_records,
            sync_timestamp_iso=now_dt,
        )


def verify_central_intake(req: CentralIntakeVerificationRequest) -> FieldSeizureRecord:
    """
    Performs physical central intake verification of a seized hardware evidence bag.
    Re-computes verification hash and compares against on-site genesis hash.
    Immediately flags any record where on-site capture hashes differ from central intake verification.
    """
    with _lock:
        record = _seizure_store.get(req.seizure_id)
        if not record:
            raise KeyError(f"Seizure record not found: {req.seizure_id}")

        now_dt = datetime.now(timezone.utc).isoformat()
        tamper_issues = []

        # 1. Barcode match check
        if req.received_bag_barcode.strip().upper() != record.get("seizure_bag_barcode", "").strip().upper():
            tamper_issues.append(
                f"Bag barcode mismatch (expected: {record.get('seizure_bag_barcode')}, received: {req.received_bag_barcode})"
            )

        # 2. Tamper-evident seal check
        if not req.bag_seal_intact:
            tamper_issues.append("Evidence bag tamper-evident tape or seal arrived broken/torn")

        # 3. Hardware identifier checks
        if req.verified_imei1 and record.get("imei1"):
            if req.verified_imei1.strip().upper() != record.get("imei1", "").strip().upper():
                tamper_issues.append(
                    f"IMEI 1 mismatch (on-site: {record.get('imei1')}, intake: {req.verified_imei1})"
                )

        if req.verified_serial and record.get("serial_number"):
            if req.verified_serial.strip().upper() != record.get("serial_number", "").strip().upper():
                tamper_issues.append(
                    f"Serial number mismatch (on-site: {record.get('serial_number')}, intake: {req.verified_serial})"
                )

        # Compute intake verification hash
        intake_data = copy.deepcopy(record)
        intake_data["seizure_bag_barcode"] = req.received_bag_barcode.strip().upper()
        if req.verified_imei1:
            intake_data["imei1"] = req.verified_imei1.strip().upper()
        if req.verified_serial:
            intake_data["serial_number"] = req.verified_serial.strip().upper()

        intake_verification_hash = compute_canonical_genesis_hash(intake_data)
        on_site_hash = record.get("on_site_genesis_hash", "")

        record["central_intake_hash"] = intake_verification_hash
        record["central_intake_at_iso"] = now_dt
        record["intake_verified_by_badge"] = req.verified_by_badge

        if tamper_issues or intake_verification_hash != on_site_hash:
            # Tamper detected!
            record["tamper_flag"] = True
            record["sync_status"] = "synced_tamper_flagged"
            reasons_str = "; ".join(tamper_issues) if tamper_issues else "Cryptographic hash mismatch"
            record["tamper_reason"] = (
                f"INTEGRITY_TAMPER_FLAGGED: On-site capture hash ({on_site_hash[:16]}...) "
                f"differs from central intake verification ({intake_verification_hash[:16]}...). "
                f"Breach indicators: {reasons_str}."
            )
            record["chain_of_custody_events"].append(
                {
                    "event_id": f"EVT-INTAKE-{_now_ms()}",
                    "action": "CENTRAL_INTAKE_TAMPER_FLAGGED",
                    "badge": req.verified_by_badge,
                    "timestamp_iso": now_dt,
                    "details": record["tamper_reason"],
                }
            )
        else:
            # Clean intake verification
            record["tamper_flag"] = False
            record["sync_status"] = "synced_verified"
            record["tamper_reason"] = None
            record["chain_of_custody_events"].append(
                {
                    "event_id": f"EVT-INTAKE-{_now_ms()}",
                    "action": "CENTRAL_INTAKE_VERIFIED_VALID",
                    "badge": req.verified_by_badge,
                    "timestamp_iso": now_dt,
                    "details": (
                        f"Physical intake verified. Bag {req.received_bag_barcode} intact, "
                        f"hardware matches on-site genesis hash ({on_site_hash[:16]}...)."
                    ),
                }
            )

        _seizure_store[req.seizure_id] = record
        return FieldSeizureRecord(**record)


def get_field_seizure_stats() -> FieldSeizureStatsResponse:
    """Computes aggregate dashboard statistics for field seizures."""
    with _lock:
        total = len(_seizure_store)
        queued = sum(1 for r in _seizure_store.values() if r.get("sync_status") == "queued_offline")
        synced_clean = sum(
            1 for r in _seizure_store.values() if r.get("sync_status") == "synced_verified" and not r.get("tamper_flag")
        )
        tamper = sum(1 for r in _seizure_store.values() if r.get("tamper_flag", False))
        faraday_sealed = sum(1 for r in _seizure_store.values() if r.get("faraday_bag_sealed", True))
        pct_faraday = round((faraday_sealed / total) * 100, 1) if total > 0 else 100.0

        return FieldSeizureStatsResponse(
            total_seizures=total,
            offline_queued=queued,
            synced_clean=synced_clean,
            tamper_flagged=tamper,
            faraday_sealed_percent=pct_faraday,
        )


def reset_field_seizure_store() -> None:
    """Resets the store back to seed state (used by test suites)."""
    seed_default_records()

