"""
Automated UPI Mule Account Freeze Dispatch via CFCFRMS / 1930 Protocol.

Implements:
1. Extraction & validation of UPI VPAs, UTRs, IFSCs, and bank accounts.
2. Hop score & velocity calculation grounded in KshemOS Fraud Graph.
3. Statutory Section 91 & 102 CrPC (Section 94 & 106 BNSS 2023) provisional debit freeze notice.
4. Standardized I4C CFCFRMS / NPCI Priority Stop JSON payload generator.
5. Complete audit trail with bank nodal acknowledgment lifecycle.
"""
from __future__ import annotations

import hashlib
import itertools
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import networkx as nx

from app.data.seed_graph import (
    ACCOUNTS,
    FLAGGED_ACCOUNTS,
    KNOWN_MULE_ACCOUNTS,
)
from app.services.fraud_graph import (
    HARVESTED_HONEYPOT_ACCOUNTS,
    get_graph,
    get_ring_info,
)

# Standard Regex Patterns for Indian Financial Cyber Infrastructure
VPA_REGEX = re.compile(r"\b([a-zA-Z0-9.\-_]{2,256})@([a-zA-Z]{2,64})\b")
PHONE_VPA_REGEX = re.compile(r"^[6-9]\d{9}@[a-zA-Z]{2,64}$")
UTR_REGEX = re.compile(r"\b(\d{12})\b")
IFSC_REGEX = re.compile(r"\b([A-Z]{4}0[A-Z0-9]{6})\b")
ACCOUNT_NUM_REGEX = re.compile(r"\b([0-9]{9,18})\b")

# Well-known PSP / Bank Handles in Indian UPI Ecosystem
COMMON_BANK_HANDLES = {
    "okhdfcbank", "oksbi", "okaxis", "okicici", "ybl", "ibl", "axl", "apl",
    "paytm", "upi", "sbi", "hdfc", "icici", "axis", "kotak", "yesbank",
    "pnb", "barodampay", "federal", "indus", "idfcfirst", "airtel", "jio"
}

# Known Merchant Aggregators
KNOWN_MERCHANT_PREFIXES = {
    "billdesk", "razorpay", "cashfree", "payu", "ccavenue", "swiggy",
    "zomato", "uber", "ola", "flipkart", "amazon", "irctc"
}

_lock = threading.RLock()
_freeze_counter = itertools.count(1001)

# Persistent in-memory registry of dispatched freeze mandates and audit events
_FREEZE_REGISTRY: dict[str, dict[str, Any]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_ms() -> int:
    return int(time.time() * 1000)


def reset():
    """Reset the freeze registry for testing."""
    with _lock:
        global _FREEZE_REGISTRY
        _FREEZE_REGISTRY = {}


def validate_vpa(vpa: str) -> dict[str, Any]:
    """Validate a Virtual Payment Address (VPA) according to NPCI specifications."""
    normalized = (vpa or "").strip().lower()
    match = VPA_REGEX.match(normalized)
    if not match:
        return {
            "vpa": vpa,
            "is_valid": False,
            "username": None,
            "handle": None,
            "is_phone_linked": False,
            "is_merchant": False,
            "error": "Invalid VPA format. Must match username@handle.",
        }

    username, handle = match.groups()
    is_phone_linked = bool(PHONE_VPA_REGEX.match(normalized))
    is_merchant = any(normalized.startswith(prefix) for prefix in KNOWN_MERCHANT_PREFIXES)

    return {
        "vpa": normalized,
        "is_valid": True,
        "username": username,
        "handle": handle,
        "is_phone_linked": is_phone_linked,
        "is_merchant": is_merchant,
        "is_recognized_handle": handle in COMMON_BANK_HANDLES,
        "error": None,
    }


def validate_utr(utr: str) -> bool:
    """Validate a 12-digit Unique Transaction Reference (UTR) number."""
    cleaned = (utr or "").strip()
    return bool(UTR_REGEX.fullmatch(cleaned))


def validate_ifsc(ifsc: str) -> dict[str, Any]:
    """Validate an 11-character Indian Financial System Code (IFSC)."""
    cleaned = (ifsc or "").strip().upper()
    is_valid = bool(IFSC_REGEX.fullmatch(cleaned))
    return {
        "ifsc": cleaned,
        "is_valid": is_valid,
        "bank_code": cleaned[:4] if is_valid else None,
        "branch_code": cleaned[5:] if is_valid else None,
        "error": None if is_valid else "Invalid IFSC. Must be 4 letters, '0', then 6 alphanumeric characters.",
    }


def validate_account_number(acc: str) -> bool:
    """Validate Indian bank account number (9 to 18 digits)."""
    cleaned = (acc or "").strip()
    return bool(ACCOUNT_NUM_REGEX.fullmatch(cleaned))


def parse_financial_entities(text: str) -> dict[str, Any]:
    """
    Extract all UPI VPAs, UTRs, IFSCs, and potential bank account numbers from free-form text.
    Filters out false positives and categorizes phone-linked handles.
    """
    if not text:
        return {
            "vpas": [],
            "phone_linked_vpas": [],
            "utrs": [],
            "ifsc_codes": [],
            "account_numbers": [],
            "extracted_count": 0,
        }

    raw_vpas = [match[0] for match in VPA_REGEX.findall(text)]
    validated_vpas = []
    phone_vpas = []
    for raw in raw_vpas:
        val = validate_vpa(raw)
        if val["is_valid"]:
            validated_vpas.append(val["vpa"])
            if val["is_phone_linked"]:
                phone_vpas.append(val["vpa"])

    # Unique and preserved
    unique_vpas = sorted(list(set(validated_vpas)))
    unique_phone_vpas = sorted(list(set(phone_vpas)))

    # Extract UTRs (12 digits)
    all_12_digits = UTR_REGEX.findall(text)
    # Filter out numbers that are part of longer digit sequences
    unique_utrs = sorted(list(set(all_12_digits)))

    # Extract IFSC
    all_ifscs = IFSC_REGEX.findall(text.upper())
    unique_ifscs = sorted(list(set(all_ifscs)))

    # Extract Account Numbers (9 to 18 digits, excluding already matched 12-digit UTRs)
    raw_accs = ACCOUNT_NUM_REGEX.findall(text)
    candidate_accs = [acc for acc in raw_accs if acc not in unique_utrs and len(acc) != 10]
    unique_accs = sorted(list(set(candidate_accs)))

    return {
        "vpas": unique_vpas,
        "phone_linked_vpas": unique_phone_vpas,
        "utrs": unique_utrs,
        "ifsc_codes": unique_ifscs,
        "account_numbers": unique_accs,
        "extracted_count": len(unique_vpas) + len(unique_utrs) + len(unique_ifscs) + len(unique_accs),
    }


def compute_graph_hop_distance(graph: nx.Graph, target_node: str) -> tuple[int, list[str]]:
    """
    Compute the minimum network hop distance from target_node to any known mule or flagged account.
    Returns (min_hops, shortest_path).
    """
    if target_node not in graph:
        return 999, []

    # Known bad endpoints in Fraud Graph
    bad_targets = FLAGGED_ACCOUNTS.union(KNOWN_MULE_ACCOUNTS).union(HARVESTED_HONEYPOT_ACCOUNTS)
    if target_node in bad_targets:
        return 0, [target_node]

    min_distance = 999
    best_path: list[str] = []

    for bad in bad_targets:
        if bad in graph:
            try:
                path = nx.shortest_path(graph, source=target_node, target=bad)
                distance = len(path) - 1
                if distance < min_distance:
                    min_distance = distance
                    best_path = path
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

    return min_distance, best_path


def evaluate_freeze_priority(
    vpa: str,
    account_number: Optional[str] = None,
    ifsc: Optional[str] = None,
    utr_number: Optional[str] = None,
    transaction_amount: float = 0.0,
    transaction_timestamp_iso: Optional[str] = None,
    recent_transactions: Optional[List[Dict[str, Any]]] = None,
    is_digital_arrest: bool = False,
) -> dict[str, Any]:
    """
    Evaluate financial fraud signals, compute fraud graph hop distance and transaction velocity,
    and determine the appropriate NPCI priority stop and debit freeze tier.
    """
    vpa_val = validate_vpa(vpa)
    if not vpa_val["is_valid"]:
        raise ValueError(f"Invalid VPA format: {vpa}")

    graph = get_graph()
    lookup_id = account_number or vpa
    hop_distance, shortest_path = compute_graph_hop_distance(graph, lookup_id)

    # Check ring info if present
    ring_info = get_ring_info(lookup_id) if lookup_id in graph else None
    mule_prob = ring_info.get("mule_probability", 0.0) if ring_info else 0.0

    # If VPA or account was harvested by telephony honeypot
    if lookup_id in HARVESTED_HONEYPOT_ACCOUNTS or vpa in HARVESTED_HONEYPOT_ACCOUNTS:
        hop_distance = 0
        mule_prob = 0.98

    # Velocity scoring: compute transactions per hour / amount burst
    recent_txns = recent_transactions or []
    txn_count = len(recent_txns) + 1  # current transaction counts as 1
    total_amount = transaction_amount + sum(float(t.get("amount", 0.0)) for t in recent_txns)

    # Calculate rapid sequence / layering indicators
    has_rapid_burst = False
    if recent_txns:
        timestamps = []
        for t in recent_txns:
            ts_str = t.get("timestamp")
            if ts_str:
                try:
                    timestamps.append(datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp())
                except Exception:
                    pass
        if transaction_timestamp_iso:
            try:
                timestamps.append(datetime.fromisoformat(transaction_timestamp_iso.replace("Z", "+00:00")).timestamp())
            except Exception:
                pass
        if len(timestamps) >= 2:
            time_span_minutes = (max(timestamps) - min(timestamps)) / 60.0
            if time_span_minutes <= 60 and txn_count >= 3:
                has_rapid_burst = True

    # Base velocity score (0.0 to 1.0)
    velocity_score = min(1.0, (txn_count * 0.15) + (0.35 if has_rapid_burst else 0.0) + (0.2 if transaction_amount >= 50000 else 0.0))
    velocity_score = round(velocity_score, 2)

    # Determine Priority Stop Tier
    # Tier 1 (Immediate Stop - SLA < 15m): Hop <= 1 OR High Velocity OR Digital Arrest OR Honeypot Harvest OR Amount >= 50k
    # Tier 2 (Provisional Freeze - SLA < 2h): Hop == 2 OR Velocity >= 0.4 OR Amount >= 10k
    # Tier 3 (Account Monitoring - SLA < 24h): Routine monitoring
    if (
        hop_distance <= 1
        or mule_prob >= 0.70
        or is_digital_arrest
        or transaction_amount >= 50000
        or has_rapid_burst
    ):
        priority_tier = "TIER_1_IMMEDIATE_STOP"
        sla_minutes = 15
        action_directive = "IMMEDIATE_DEBIT_FREEZE_AND_HOTLIST"
        rationale = (
            f"High-priority threat: Hop distance {hop_distance} to syndicate, "
            f"mule probability {mule_prob}, amount ₹{transaction_amount:,.2f}, rapid layering flags."
        )
    elif hop_distance == 2 or mule_prob >= 0.40 or transaction_amount >= 10000 or velocity_score >= 0.4:
        priority_tier = "TIER_2_PROVISIONAL_FREEZE"
        sla_minutes = 120
        action_directive = "PROVISIONAL_DEBIT_FREEZE_AND_LIEN"
        rationale = (
            f"Elevated risk: Second-hop relationship to flagged ring, "
            f"velocity score {velocity_score}, provisional lien recommended."
        )
    else:
        priority_tier = "TIER_3_MONITOR"
        sla_minutes = 1440
        action_directive = "MONITOR_AND_KYC_VERIFICATION"
        rationale = "Low graph connectivity. Account surveillance and KYC re-verification recommended."

    return {
        "vpa": vpa,
        "account_number": account_number,
        "ifsc": ifsc,
        "utr_number": utr_number,
        "transaction_amount": transaction_amount,
        "priority_tier": priority_tier,
        "sla_minutes": sla_minutes,
        "action_directive": action_directive,
        "graph_hop_distance": hop_distance if hop_distance != 999 else None,
        "shortest_syndicate_path": shortest_path,
        "mule_probability": mule_prob,
        "velocity_score": velocity_score,
        "has_rapid_burst": has_rapid_burst,
        "total_volume": total_amount,
        "evaluation_rationale": rationale,
        "evaluated_at": _now_iso(),
    }


def generate_section_102_crpc_notice(
    freeze_id: str,
    incident_id: str,
    suspect_vpa: str,
    suspect_account: Optional[str],
    suspect_ifsc: Optional[str],
    utr_number: Optional[str],
    transaction_amount: float,
    officer_name: str,
    officer_badge_id: str,
    police_station: str = "Cyber Crime Police Station, Delhi Metro",
    victim_name: str = "Complaining Citizen",
    now_iso: Optional[str] = None,
) -> dict[str, Any]:
    """
    Generate an official, court-admissible notice under Section 91 & 102 Code of Criminal Procedure, 1973
    (and corresponding Section 94 & 106 Bharatiya Nagarik Suraksha Sanhita, 2023).
    """
    timestamp = now_iso or _now_iso()
    notice_text = (
        f"STATUTORY PROVISIONAL DEBIT FREEZE NOTICE\n"
        f"UNDER SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE, 1973\n"
        f"(READ WITH SECTION 91 Cr.P.C. & SECTION 106 BHARATIYA NAGARIK SURAKSHA SANHITA, 2023)\n"
        f"--------------------------------------------------------------------------------\n"
        f"NOTICE REFERENCE NO: {freeze_id}\n"
        f"POLICE STATION: {police_station}\n"
        f"CYBER CRIME INCIDENT/FIR REF: {incident_id}\n"
        f"DATE OF ISSUE: {timestamp}\n\n"
        f"TO:\n"
        f"The Nodal Officer / Fraud Risk Management Team / Legal Cell,\n"
        f"Beneficiary Bank / Payment Service Provider / NPCI Central Switch.\n\n"
        f"SUBJECT: URGENT PROVISIONAL DEBIT FREEZE ORDER ON MULE/BENEFICIARY ACCOUNT / VPA\n"
        f"IN RE: CYBERCRIME FINANCIAL FRAUD INVESTIGATION.\n\n"
        f"WHEREAS, an urgent cyber financial crime report has been registered at {police_station} "
        f"wherein fraudulent debit of Rs. {transaction_amount:,.2f} was executed against the victim "
        f"({victim_name}) under transaction reference UTR: {utr_number or 'UNDER_TRACING'}.\n\n"
        f"AND WHEREAS, investigation and network fraud graph telemetry reveal that the funds have been "
        f"credited into the following beneficiary/mule account channel:\n"
        f"  • Suspect UPI VPA: {suspect_vpa}\n"
        f"  • Suspect Bank Account No: {suspect_account or 'VPA-LINKED'}\n"
        f"  • Suspect Bank IFSC: {suspect_ifsc or 'TO BE PROVIDED BY PSP'}\n\n"
        f"NOW THEREFORE, by virtue of statutory powers conferred under Section 102 Cr.P.C., "
        f"YOU ARE HEREBY DIRECTED TO IMMEDIATELY EXECUTE A PROVISIONAL DEBIT FREEZE / LIEN MARK "
        f"on the aforesaid account/VPA to prevent further layering and siphon of proceeds of crime.\n\n"
        f"FURTHER, under Section 91 Cr.P.C., you are requisitioned to furnish within 24 hours:\n"
        f"1. Complete account opening KYC records, mobile number, and IP address logs.\n"
        f"2. Certified statement of accounts from credit date to present timestamp.\n"
        f"3. Inward and outward transaction trail with destination VPAs/accounts.\n\n"
        f"Failure to comply with this statutory order invites penal consequences under Section 188 IPC / "
        f"Section 223 BNS and relevant sections of the Information Technology Act, 2000.\n\n"
        f"ISSUED UNDER OFFICIAL SEAL AND SIGNATURE:\n"
        f"Investigating Officer: {officer_name}\n"
        f"Badge/Rank ID: {officer_badge_id}\n"
        f"Cyber Operations Desk: KshemOS National Financial Fraud Triage Unit\n"
    )

    content_hash = hashlib.sha256(notice_text.encode("utf-8")).hexdigest()

    return {
        "notice_id": f"NOT-{freeze_id}",
        "freeze_id": freeze_id,
        "incident_id": incident_id,
        "statutory_authority": "Section 102 CrPC / Section 106 BNSS 2023",
        "issued_by": {
            "officer_name": officer_name,
            "badge_id": officer_badge_id,
            "police_station": police_station,
        },
        "target_suspect": {
            "vpa": suspect_vpa,
            "account_number": suspect_account,
            "ifsc": suspect_ifsc,
            "utr_number": utr_number,
            "freeze_amount": transaction_amount,
        },
        "issued_at": timestamp,
        "content_hash": content_hash,
        "legal_text": notice_text,
    }


def generate_cfcfrms_payload(
    freeze_id: str,
    incident_id: str,
    eval_result: dict[str, Any],
    officer_badge_id: str,
    officer_name: str,
    victim_details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Generate an I4C (Indian Cyber Crime Coordination Centre) CFCFRMS
    and NPCI Priority Stop compliant machine-readable JSON payload.
    """
    victim = victim_details or {
        "masked_account": "XXXX-XXXX-4921",
        "bank_name": "State Bank of India",
        "complaint_ref": incident_id,
    }

    cfcfrms_id = f"CFCFRMS-1930-{freeze_id.replace('FRZ-', '')}"

    return {
        "cfcfrms_header": {
            "portal": "Citizen Financial Cyber Fraud Reporting and Management System (CFCFRMS)",
            "gateway_protocol": "I4C-NPCI-PRIORITY-FREEZE-v2.4",
            "cfcfrms_ticket_id": cfcfrms_id,
            "originating_system": "KshemOS Digital Public Safety Platform",
            "dispatch_timestamp": _now_iso(),
            "priority_tier": eval_result["priority_tier"],
            "sla_minutes": eval_result["sla_minutes"],
        },
        "transaction_mandate": {
            "utr_number": eval_result.get("utr_number") or "N/A",
            "amount": eval_result.get("transaction_amount", 0.0),
            "currency": "INR",
            "transaction_type": "UPI",
            "layer_hop_level": 1 if eval_result.get("graph_hop_distance") in (0, 1) else 2,
        },
        "suspect_beneficiary": {
            "vpa": eval_result["vpa"],
            "account_number": eval_result.get("account_number"),
            "ifsc": eval_result.get("ifsc"),
            "freeze_type": "PROVISIONAL_DEBIT_FREEZE",
            "action_directive": eval_result["action_directive"],
        },
        "victim_context": victim,
        "telemetry_and_provenance": {
            "fraud_graph_hops": eval_result.get("graph_hop_distance"),
            "mule_probability": eval_result.get("mule_probability"),
            "velocity_score": eval_result.get("velocity_score"),
            "is_rapid_burst": eval_result.get("has_rapid_burst"),
        },
        "authorizing_authority": {
            "officer_name": officer_name,
            "badge_id": officer_badge_id,
            "statutory_act": "Section 102 CrPC / Section 106 BNSS 2023",
        },
    }


def dispatch_freeze_request(
    incident_id: str,
    suspect_vpa: str,
    suspect_account: Optional[str] = None,
    suspect_ifsc: Optional[str] = None,
    utr_number: Optional[str] = None,
    transaction_amount: float = 0.0,
    transaction_timestamp_iso: Optional[str] = None,
    recent_transactions: Optional[List[Dict[str, Any]]] = None,
    officer_name: str = "Inspector R. K. Sharma",
    officer_badge_id: str = "OFF-DELHI-101",
    police_station: str = "Cyber Crime Police Station, Central Delhi",
    is_digital_arrest: bool = False,
    victim_details: Optional[Dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Main entry point: Evaluate financial telemetry, assemble statutory notice and CFCFRMS payload,
    dispatch the debit freeze order, and log genesis audit trail.
    """
    with _lock:
        freeze_seq = next(_freeze_counter)
        freeze_id = f"FRZ-UPI-2026-{freeze_seq}"

        # 1. Evaluate fraud signals and hop distance
        evaluation = evaluate_freeze_priority(
            vpa=suspect_vpa,
            account_number=suspect_account,
            ifsc=suspect_ifsc,
            utr_number=utr_number,
            transaction_amount=transaction_amount,
            transaction_timestamp_iso=transaction_timestamp_iso,
            recent_transactions=recent_transactions,
            is_digital_arrest=is_digital_arrest,
        )

        now_str = _now_iso()
        now_epoch = _now_ms()

        # 2. Generate Statutory Section 91 & 102 CrPC notice
        statutory_notice = generate_section_102_crpc_notice(
            freeze_id=freeze_id,
            incident_id=incident_id,
            suspect_vpa=suspect_vpa,
            suspect_account=suspect_account,
            suspect_ifsc=suspect_ifsc,
            utr_number=utr_number,
            transaction_amount=transaction_amount,
            officer_name=officer_name,
            officer_badge_id=officer_badge_id,
            police_station=police_station,
            now_iso=now_str,
        )

        # 3. Generate Machine-readable CFCFRMS / NPCI Payload
        cfcfrms_payload = generate_cfcfrms_payload(
            freeze_id=freeze_id,
            incident_id=incident_id,
            eval_result=evaluation,
            officer_badge_id=officer_badge_id,
            officer_name=officer_name,
            victim_details=victim_details,
        )

        # 4. Construct Audit Record
        audit_events = [
            {
                "event_id": f"EVT-{freeze_id}-GENESIS",
                "event_type": "FREEZE_ORDER_CREATED",
                "timestamp": now_str,
                "actor_id": officer_badge_id,
                "details": f"Provisional debit freeze authorized for VPA {suspect_vpa} under Section 102 CrPC.",
            },
            {
                "event_id": f"EVT-{freeze_id}-DISPATCH",
                "event_type": "CFCFRMS_DISPATCHED",
                "timestamp": now_str,
                "actor_id": "SYSTEM_NPCI_GATEWAY",
                "details": f"Dispatched via CFCFRMS Priority Gateway (Tier: {evaluation['priority_tier']}).",
            },
        ]

        record = {
            "freeze_id": freeze_id,
            "incident_id": incident_id,
            "suspect_vpa": suspect_vpa,
            "suspect_account": suspect_account,
            "suspect_ifsc": suspect_ifsc,
            "utr_number": utr_number,
            "transaction_amount": transaction_amount,
            "status": "DISPATCHED",
            "priority_tier": evaluation["priority_tier"],
            "sla_minutes": evaluation["sla_minutes"],
            "action_directive": evaluation["action_directive"],
            "officer_badge_id": officer_badge_id,
            "officer_name": officer_name,
            "police_station": police_station,
            "dispatched_at": now_str,
            "dispatched_at_ms": now_epoch,
            "acknowledged_at": None,
            "acknowledged_at_ms": None,
            "bank_nodal_ref": None,
            "bank_response_time_ms": None,
            "evaluation": evaluation,
            "statutory_notice": statutory_notice,
            "cfcfrms_payload": cfcfrms_payload,
            "audit_events": audit_events,
        }

        _FREEZE_REGISTRY[freeze_id] = record
        return record


def record_bank_acknowledgment(
    freeze_id: str,
    bank_nodal_ref: str,
    freeze_outcome: Literal["FROZEN", "LIEN_MARKED", "REJECTED_INSUFFICIENT_FUNDS", "REJECTED_INVALID_ACCOUNT"] = "FROZEN",
    notes: Optional[str] = None,
    now_ms: Optional[int] = None,
) -> dict[str, Any]:
    """
    Record or simulate the bank nodal officer / NPCI automated acknowledgment response.
    Updates freeze status, computes response SLA latency, and logs audit trail.
    """
    with _lock:
        if freeze_id not in _FREEZE_REGISTRY:
            raise KeyError(f"Freeze request not found: {freeze_id}")

        record = _FREEZE_REGISTRY[freeze_id]
        current_time_ms = now_ms or _now_ms()
        dispatched_time_ms = record["dispatched_at_ms"]
        elapsed_latency_ms = max(0, current_time_ms - dispatched_time_ms)
        timestamp_str = _now_iso()

        record["status"] = freeze_outcome
        record["acknowledged_at"] = timestamp_str
        record["acknowledged_at_ms"] = current_time_ms
        record["bank_nodal_ref"] = bank_nodal_ref
        record["bank_response_time_ms"] = elapsed_latency_ms

        audit_entry = {
            "event_id": f"EVT-{freeze_id}-ACK",
            "event_type": f"BANK_ACKNOWLEDGMENT_{freeze_outcome}",
            "timestamp": timestamp_str,
            "actor_id": "BANK_NODAL_DESK",
            "details": (
                f"Bank acknowledged reference {bank_nodal_ref} with status {freeze_outcome} "
                f"in {elapsed_latency_ms}ms. Notes: {notes or 'Provisional debit freeze executed.'}"
            ),
        }
        record["audit_events"].append(audit_entry)
        return record


def revoke_freeze_request(
    freeze_id: str,
    revoking_officer_badge_id: str,
    revocation_reason: str,
) -> dict[str, Any]:
    """
    Officer-initiated revocation / lifting of provisional debit freeze order.
    Requires statutory revocation rationale and logs complete audit record.
    """
    with _lock:
        if freeze_id not in _FREEZE_REGISTRY:
            raise KeyError(f"Freeze request not found: {freeze_id}")

        record = _FREEZE_REGISTRY[freeze_id]
        timestamp_str = _now_iso()

        record["status"] = "REVOKED"
        audit_entry = {
            "event_id": f"EVT-{freeze_id}-REVOKE",
            "event_type": "FREEZE_REVOKED",
            "timestamp": timestamp_str,
            "actor_id": revoking_officer_badge_id,
            "details": f"Provisional debit freeze revoked by {revoking_officer_badge_id}. Reason: {revocation_reason}",
        }
        record["audit_events"].append(audit_entry)
        return record


def list_freeze_requests(
    incident_id: Optional[str] = None,
    status: Optional[str] = None,
    priority_tier: Optional[str] = None,
    vpa: Optional[str] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List and filter freeze requests from registry."""
    with _lock:
        results = []
        for record in reversed(list(_FREEZE_REGISTRY.values())):
            if incident_id and record["incident_id"] != incident_id:
                continue
            if status and record["status"].upper() != status.upper():
                continue
            if priority_tier and record["priority_tier"].upper() != priority_tier.upper():
                continue
            if vpa and vpa.lower() not in record["suspect_vpa"].lower():
                continue
            results.append(record)
            if len(results) >= limit:
                break
        return results


def get_freeze_request(freeze_id: str) -> Optional[dict[str, Any]]:
    """Retrieve full freeze record by freeze_id."""
    with _lock:
        return _FREEZE_REGISTRY.get(freeze_id)


def get_freeze_stats() -> dict[str, Any]:
    """Compute aggregate statistics for the Mule Account Freeze Dashboard."""
    with _lock:
        total = len(_FREEZE_REGISTRY)
        dispatched = sum(1 for r in _FREEZE_REGISTRY.values() if r["status"] == "DISPATCHED")
        frozen = sum(1 for r in _FREEZE_REGISTRY.values() if r["status"] in ("FROZEN", "LIEN_MARKED"))
        rejected = sum(1 for r in _FREEZE_REGISTRY.values() if "REJECTED" in r["status"])
        revoked = sum(1 for r in _FREEZE_REGISTRY.values() if r["status"] == "REVOKED")

        tier1 = sum(1 for r in _FREEZE_REGISTRY.values() if r["priority_tier"] == "TIER_1_IMMEDIATE_STOP")
        tier2 = sum(1 for r in _FREEZE_REGISTRY.values() if r["priority_tier"] == "TIER_2_PROVISIONAL_FREEZE")
        tier3 = sum(1 for r in _FREEZE_REGISTRY.values() if r["priority_tier"] == "TIER_3_MONITOR")

        latencies = [
            r["bank_response_time_ms"]
            for r in _FREEZE_REGISTRY.values()
            if r["bank_response_time_ms"] is not None
        ]
        avg_latency_ms = round(sum(latencies) / len(latencies), 1) if latencies else 0.0
        total_amount_saved = sum(
            r["transaction_amount"]
            for r in _FREEZE_REGISTRY.values()
            if r["status"] in ("FROZEN", "LIEN_MARKED")
        )

        return {
            "total_requests": total,
            "dispatched": dispatched,
            "frozen": frozen,
            "rejected": rejected,
            "revoked": revoked,
            "tier1_immediate_stop": tier1,
            "tier2_provisional_freeze": tier2,
            "tier3_monitor": tier3,
            "average_bank_latency_ms": avg_latency_ms,
            "total_amount_protected_inr": total_amount_saved,
        }

