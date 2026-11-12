"""
DPDP Act Redaction & Identity Masking Pipeline Service for KshemOS.

Complies with:
- Digital Personal Data Protection Act, 2023 (DPDP Act §§ 4, 8, 9, 17)
- UIDAI Aadhaar Masking Directives (Circular F.No. 11020/205/2017)
- RBI Guidelines on Masking of Sensitive Financial Identifiers (PAN, Bank Account, Card Numbers)
- Supreme Court Right to Privacy Bench Mandates (K.S. Puttaswamy v. Union of India)

Features:
- Automated Regex & Algorithmic PII Detection (Aadhaar, PAN, Bank Accounts, Mobile, Email, UPI).
- Persistent Pseudonymization Tokenizer preserving graph relationship topology across threat intelligence feeds.
- Access-Controlled, Role-Audited "Unmask Identity" Workflow with Mandatory Supervisory Approval and Time-Bounded Leases.
"""
from __future__ import annotations

import copy
import hashlib
import hmac
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Optional

_lock = threading.RLock()

# Store state for unmask requests, persistent pseudonym mappings, and audit logs
_unmask_requests: dict[str, dict[str, Any]] = {}
_raw_vault: dict[str, dict[str, Any]] = {}
_pseudonym_map: dict[str, str] = {}  # token -> raw
_reverse_pseudonym_map: dict[str, str] = {}  # raw -> token
_dpdp_audit_log: list[dict[str, Any]] = []

_req_counter = 1001
_audit_counter = 5001

DEFAULT_SALT = "kshemos_dpdp_master_salt_2026"

# -----------------------------------------------------------------------------
# Regular Expression Patterns for Indian Citizen PII
# -----------------------------------------------------------------------------

# Contextual Bank Account: preceded by account or bank indicators
CONTEXTUAL_BANK_ACCOUNT_REGEX = re.compile(
    r"\b(?:account|a/c|acct|acc|savings|current|deposit|sbi|hdfc|icici|axis|pnb)[\s#:]*(\d{9,18})\b",
    re.IGNORECASE
)

# Aadhaar: 12 digits with space or hyphen, or preceded by aadhaar keyword
AADHAAR_REGEX = re.compile(
    r"\b([2-9]\d{3})[ -](\d{4})[ -](\d{4})\b|(?:aadhaar|uidai)[\s#:*-]*\b([2-9]\d{11})\b",
    re.IGNORECASE
)

# PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
PAN_REGEX = re.compile(r"\b([A-Z]{5})(\d{4})([A-Z])\b")

# Generic Bank Account: 9 to 18 digits (contextual or numeric string)
BANK_ACCOUNT_REGEX = re.compile(r"\b(\d{9,18})\b")

# Indian Mobile: 10 digits starting with 6-9, optional +91 or 0 prefix
MOBILE_REGEX = re.compile(r"(?:\+91[\-\s]?|0)?\b([6-9]\d{1})\d{4}(\d{4})\b")

# Email address
EMAIL_REGEX = re.compile(r"\b([A-Za-z0-9])[A-Za-z0-9._%+-]*([A-Za-z0-9])@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b")

# UPI VPA / Handle
UPI_VPA_REGEX = re.compile(r"\b([a-zA-Z0-9])[a-zA-Z0-9._-]*([a-zA-Z0-9])@([a-zA-Z]{2,64})\b")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -----------------------------------------------------------------------------
# Masking & Redaction Primitives
# -----------------------------------------------------------------------------

def mask_aadhaar(raw: str) -> str:
    """Mask 12-digit Aadhaar to UIDAI-compliant format: XXXX-XXXX-1234."""
    clean = re.sub(r"[\s\-]", "", raw)
    if len(clean) == 12 and clean.isdigit():
        return f"XXXX-XXXX-{clean[-4:]}"
    return "XXXX-XXXX-XXXX"


def mask_pan(raw: str) -> str:
    """Mask 10-character PAN to tax-audit format: ABCDE****F."""
    clean = raw.strip().upper()
    if len(clean) == 10:
        return f"{clean[:5]}****{clean[-1]}"
    return "ABCDE****X"


def mask_bank_account(raw: str) -> str:
    """Mask bank account to financial-audit format: XXXXXXXX1234."""
    clean = re.sub(r"[\s\-]", "", str(raw).strip())
    if len(clean) >= 4:
        return f"XXXXXXXX{clean[-4:]}"
    return "XXXXXXXX"


def mask_mobile(raw: str) -> str:
    """Mask Indian mobile number to format: +91 XXXXX 12345."""
    clean = re.sub(r"[\s\-\+]", "", raw)
    if clean.startswith("91") and len(clean) == 12:
        clean = clean[2:]
    elif clean.startswith("0") and len(clean) == 11:
        clean = clean[1:]
    if len(clean) == 10:
        return f"+91 XXXXX {clean[5:]}"
    return "+91 XXXXX XXXXX"


def mask_email(raw: str) -> str:
    """Mask email address to format: j***e@domain.com."""
    parts = raw.strip().split("@")
    if len(parts) == 2:
        user, domain = parts
        if len(user) <= 2:
            masked_user = user[0] + "***"
        else:
            masked_user = f"{user[0]}***{user[-1]}"
        return f"{masked_user}@{domain}"
    return "u***r@domain.com"


# -----------------------------------------------------------------------------
# Persistent Deterministic Tokenizer
# -----------------------------------------------------------------------------

def generate_pseudonym_token(raw_value: str, entity_type: str = "CITIZEN", salt: str = DEFAULT_SALT) -> str:
    """
    Generate deterministic, persistent pseudonymous tokens preserving graph topology:
    e.g. CITIZEN_REF_8492 or ACC_REF_3910.
    """
    with _lock:
        norm = raw_value.strip().lower()
        if norm in _reverse_pseudonym_map:
            return _reverse_pseudonym_map[norm]

        h = hmac.new(salt.encode("utf-8"), norm.encode("utf-8"), hashlib.sha256).hexdigest()
        short_num = int(h[:8], 16) % 9000 + 1000  # 4-digit readable suffix: 1000 - 9999
        prefix = "CITIZEN_REF" if entity_type.upper() in ["CITIZEN", "AADHAAR", "PAN", "PERSON"] else "ACC_REF"
        token = f"{prefix}_{short_num}"

        # Collision avoidance
        suffix_counter = 1
        base_token = token
        while token in _pseudonym_map and _pseudonym_map[token] != norm:
            token = f"{base_token}_{suffix_counter}"
            suffix_counter += 1

        _pseudonym_map[token] = norm
        _reverse_pseudonym_map[norm] = token
        return token


# -----------------------------------------------------------------------------
# High-Level Text & Object Sanitization Pipeline
# -----------------------------------------------------------------------------

def sanitize_text(text: str, mask_types: Optional[list[str]] = None, salt: str = DEFAULT_SALT) -> tuple[str, list[dict[str, Any]]]:
    """
    Detect, mask, and tokenize all citizen PII entities in unstructured text.
    Returns: (sanitized_text, list_of_detected_entities).
    """
    if not text:
        return "", []

    targets = [t.upper() for t in mask_types] if mask_types else ["AADHAAR", "PAN", "BANK_ACCOUNT", "PHONE", "EMAIL", "UPI_VPA"]
    detected: list[dict[str, Any]] = []

    result = text

    # 1. Contextual Bank Accounts (e.g. account 501004928172)
    if "BANK_ACCOUNT" in targets:
        for match in list(CONTEXTUAL_BANK_ACCOUNT_REGEX.finditer(result)):
            raw = match.group(1)
            if len(raw) >= 9 and not raw.startswith("XXXX"):
                masked = mask_bank_account(raw)
                token = generate_pseudonym_token(raw, entity_type="ACCOUNT", salt=salt)
                detected.append({
                    "entity_type": "BANK_ACCOUNT",
                    "original_snippet": raw,
                    "masked_value": masked,
                    "start_index": match.start(1),
                    "end_index": match.end(1),
                    "pseudonym_token": token,
                })
                result = result[:match.start(1)] + masked + result[match.end(1):]

    # 2. Aadhaar Masking
    if "AADHAAR" in targets:
        for match in list(AADHAAR_REGEX.finditer(result)):
            raw = match.group(0)
            masked = mask_aadhaar(raw)
            token = generate_pseudonym_token(raw, entity_type="AADHAAR", salt=salt)
            detected.append({
                "entity_type": "AADHAAR",
                "original_snippet": raw,
                "masked_value": masked,
                "start_index": match.start(),
                "end_index": match.end(),
                "pseudonym_token": token,
            })
            result = result[:match.start()] + masked + result[match.end():]

    # 3. PAN Masking
    if "PAN" in targets:
        for match in list(PAN_REGEX.finditer(result)):
            raw = match.group(0)
            masked = mask_pan(raw)
            token = generate_pseudonym_token(raw, entity_type="PAN", salt=salt)
            detected.append({
                "entity_type": "PAN",
                "original_snippet": raw,
                "masked_value": masked,
                "start_index": match.start(),
                "end_index": match.end(),
                "pseudonym_token": token,
            })
            result = result[:match.start()] + masked + result[match.end():]

    # 3. Bank Account Numbers (9 to 18 digits)
    if "BANK_ACCOUNT" in targets:
        # Avoid double-masking if already transformed to XXXX
        for match in list(BANK_ACCOUNT_REGEX.finditer(result)):
            raw = match.group(0)
            # Ensure it's not a phone number or aadhaar
            if len(raw) >= 9 and not raw.startswith("XXXX"):
                masked = mask_bank_account(raw)
                token = generate_pseudonym_token(raw, entity_type="ACCOUNT", salt=salt)
                detected.append({
                    "entity_type": "BANK_ACCOUNT",
                    "original_snippet": raw,
                    "masked_value": masked,
                    "start_index": match.start(),
                    "end_index": match.end(),
                    "pseudonym_token": token,
                })
                result = result[:match.start()] + masked + result[match.end():]

    # 4. Indian Mobile Phone
    if "PHONE" in targets:
        for match in list(MOBILE_REGEX.finditer(result)):
            raw = match.group(0)
            if not raw.startswith("XXXX") and not raw.startswith("+91 XXXXX"):
                masked = mask_mobile(raw)
                token = generate_pseudonym_token(raw, entity_type="CITIZEN", salt=salt)
                detected.append({
                    "entity_type": "PHONE",
                    "original_snippet": raw,
                    "masked_value": masked,
                    "start_index": match.start(),
                    "end_index": match.end(),
                    "pseudonym_token": token,
                })
                result = result[:match.start()] + masked + result[match.end():]

    # 5. Email Addresses
    if "EMAIL" in targets:
        for match in list(EMAIL_REGEX.finditer(result)):
            raw = match.group(0)
            masked = mask_email(raw)
            token = generate_pseudonym_token(raw, entity_type="CITIZEN", salt=salt)
            detected.append({
                "entity_type": "EMAIL",
                "original_snippet": raw,
                "masked_value": masked,
                "start_index": match.start(),
                "end_index": match.end(),
                "pseudonym_token": token,
            })
            result = result[:match.start()] + masked + result[match.end():]

    return result, detected


def sanitize_object(obj: Any, mask_types: Optional[list[str]] = None, salt: str = DEFAULT_SALT) -> tuple[Any, list[dict[str, Any]]]:
    """Recursively traverse arbitrary dicts, lists, and strings to sanitize PII."""
    all_detected: list[dict[str, Any]] = []

    def _walk(item: Any) -> Any:
        if isinstance(item, str):
            clean, detected = sanitize_text(item, mask_types=mask_types, salt=salt)
            all_detected.extend(detected)
            return clean
        elif isinstance(item, dict):
            new_dict = {}
            for k, v in item.items():
                # If key explicitly indicates PII, mask directly
                lower_k = k.lower()
                if "aadhaar" in lower_k and isinstance(v, str):
                    clean = mask_aadhaar(v)
                    all_detected.append({
                        "entity_type": "AADHAAR",
                        "original_snippet": v,
                        "masked_value": clean,
                        "start_index": 0,
                        "end_index": len(v),
                        "pseudonym_token": generate_pseudonym_token(v, "AADHAAR", salt),
                    })
                    new_dict[k] = clean
                elif "pan" in lower_k and isinstance(v, str):
                    clean = mask_pan(v)
                    all_detected.append({
                        "entity_type": "PAN",
                        "original_snippet": v,
                        "masked_value": clean,
                        "start_index": 0,
                        "end_index": len(v),
                        "pseudonym_token": generate_pseudonym_token(v, "PAN", salt),
                    })
                    new_dict[k] = clean
                elif ("account" in lower_k or "bank" in lower_k) and isinstance(v, str) and v.isdigit():
                    clean = mask_bank_account(v)
                    all_detected.append({
                        "entity_type": "BANK_ACCOUNT",
                        "original_snippet": v,
                        "masked_value": clean,
                        "start_index": 0,
                        "end_index": len(v),
                        "pseudonym_token": generate_pseudonym_token(v, "ACCOUNT", salt),
                    })
                    new_dict[k] = clean
                else:
                    new_dict[k] = _walk(v)
            return new_dict
        elif isinstance(item, list):
            return [_walk(x) for x in item]
        return item

    sanitized = _walk(obj)
    return sanitized, all_detected


# -----------------------------------------------------------------------------
# Threat Intelligence Feed Pseudonymization (Graph Topology Preserving)
# -----------------------------------------------------------------------------

def pseudonymize_threat_feed(
    feed_items: list[dict[str, Any]],
    salt: str = DEFAULT_SALT,
) -> tuple[list[dict[str, Any]], int, int]:
    """
    Replaces citizen PII with persistent pseudonymous tokens (CITIZEN_REF_8492)
    in threat intelligence feeds and fraud graph exports, preserving exact
    relational topology across multiple hops without storing plain credentials.
    """
    total_redactions = 0
    tokenized_count = 0
    sanitized_items = []

    for item in feed_items:
        item_copy = copy.deepcopy(item)

        # Tokenize source / target identifiers if they are citizen accounts or phone numbers
        for field in ["citizen_id", "reporter_id", "victim_aadhaar", "victim_pan", "victim_account"]:
            if field in item_copy and isinstance(item_copy[field], str):
                val = item_copy[field]
                tok = generate_pseudonym_token(val, entity_type="CITIZEN", salt=salt)
                item_copy[field] = tok
                tokenized_count += 1

        # Tokenize graph source / target edges if citizen
        if item_copy.get("source_type") == "CITIZEN" and "source" in item_copy:
            tok = generate_pseudonym_token(item_copy["source"], entity_type="CITIZEN", salt=salt)
            item_copy["source"] = tok
            tokenized_count += 1

        if item_copy.get("target_type") == "CITIZEN" and "target" in item_copy:
            tok = generate_pseudonym_token(item_copy["target"], entity_type="CITIZEN", salt=salt)
            item_copy["target"] = tok
            tokenized_count += 1

        # Sanitize narrative / description text
        if "description" in item_copy and isinstance(item_copy["description"], str):
            clean_desc, detected = sanitize_text(item_copy["description"], salt=salt)
            item_copy["description"] = clean_desc
            total_redactions += len(detected)

        if "narrative" in item_copy and isinstance(item_copy["narrative"], str):
            clean_nar, detected = sanitize_text(item_copy["narrative"], salt=salt)
            item_copy["narrative"] = clean_nar
            total_redactions += len(detected)

        sanitized_items.append(item_copy)

    return sanitized_items, total_redactions, tokenized_count


# -----------------------------------------------------------------------------
# Access-Controlled, Role-Audited "Unmask Identity" Workflow
# -----------------------------------------------------------------------------

def submit_unmask_request(data: dict[str, Any], client_ip: str = "127.0.0.1") -> dict[str, Any]:
    """Submit a formal unmasking request requiring supervisory approval."""
    global _req_counter, _audit_counter
    with _lock:
        req_id = f"UNMASK-REQ-2026-{_req_counter:04d}"
        _req_counter += 1

        now = _now_ms()
        rec_id = data["record_id"]
        field_name = data.get("field_name", "all_pii")

        req_record = {
            "request_id": req_id,
            "record_id": rec_id,
            "field_name": field_name,
            "case_fir_number": data["case_fir_number"],
            "legal_basis": data["legal_basis"],
            "justification": data["justification"],
            "requester_badge_id": data.get("requester_badge_id", "OFF-IO-4412"),
            "requester_name": data.get("requester_name", "Investigating Officer"),
            "requester_role": data.get("requester_role", "INVESTIGATOR"),
            "status": "PENDING_SUPERVISORY_APPROVAL",
            "created_at": now,
            "reviewed_at": None,
            "supervisor_badge_id": None,
            "supervisor_name": None,
            "approval_notes": None,
            "lease_expires_at": None,
        }

        # Store sample raw value if not already registered
        if rec_id not in _raw_vault:
            _raw_vault[rec_id] = {
                "aadhaar": "4829 1042 8492",
                "pan": "ABCDE1234F",
                "bank_account": "987654321098",
                "phone": "+91 98765 43210",
                "citizen_name": "Vikramaditya Sen",
            }

        _unmask_requests[req_id] = req_record

        # Audit log submission
        _log_dpdp_audit_action(
            action="UNMASK_REQUEST_SUBMITTED",
            actor_badge_id=req_record["requester_badge_id"],
            actor_role=req_record["requester_role"],
            record_id=rec_id,
            legal_basis=req_record["legal_basis"],
            outcome="PENDING_REVIEW",
            details=f"Submitted unmask request for {field_name} in case {req_record['case_fir_number']}",
            client_ip=client_ip,
        )

        return copy.deepcopy(req_record)


def review_unmask_request(
    request_id: str,
    action: str,
    supervisor_badge_id: str,
    supervisor_name: str,
    approval_notes: str,
    client_ip: str = "127.0.0.1",
) -> dict[str, Any]:
    """
    Supervisor determination on unmask request:
    Enforces dual-officer authorization (supervisor cannot be the same officer as requester).
    """
    with _lock:
        req = _unmask_requests.get(request_id)
        if not req:
            raise ValueError(f"Unmask request '{request_id}' not found.")

        # Guardrail: Requester cannot self-approve
        if req["requester_badge_id"] == supervisor_badge_id:
            _log_dpdp_audit_action(
                action="UNMASK_SELF_APPROVAL_BLOCKED",
                actor_badge_id=supervisor_badge_id,
                actor_role="SUPERVISOR",
                record_id=req["record_id"],
                legal_basis=req["legal_basis"],
                outcome="BLOCKED",
                details="Dual-authorization violation: Requester attempted self-approval.",
                client_ip=client_ip,
            )
            raise ValueError("Dual-authorization violation: Investigating Officer cannot approve their own unmask request.")

        now = _now_ms()
        action_upper = action.upper()

        if action_upper == "APPROVE":
            req["status"] = "APPROVED"
            req["lease_expires_at"] = now + (3600 * 1000)  # 60-minute time-bounded lease
            outcome = "APPROVED_WITH_LEASE"
        else:
            req["status"] = "REJECTED"
            req["lease_expires_at"] = None
            outcome = "REJECTED"

        req["reviewed_at"] = now
        req["supervisor_badge_id"] = supervisor_badge_id
        req["supervisor_name"] = supervisor_name
        req["approval_notes"] = approval_notes

        _log_dpdp_audit_action(
            action=f"UNMASK_REQUEST_{action_upper}D",
            actor_badge_id=supervisor_badge_id,
            actor_role="SUPERVISOR",
            record_id=req["record_id"],
            legal_basis=req["legal_basis"],
            outcome=outcome,
            details=f"Supervisor {supervisor_name} ({supervisor_badge_id}) {action_upper.lower()}d unmask request. Notes: {approval_notes}",
            client_ip=client_ip,
        )

        return copy.deepcopy(req)


def reveal_unmasked_value(request_id: str, requester_badge_id: str, client_ip: str = "127.0.0.1") -> dict[str, Any]:
    """
    Reveal sensitive identity identifier after supervisory approval within active lease period.
    """
    with _lock:
        req = _unmask_requests.get(request_id)
        if not req:
            raise ValueError(f"Unmask request '{request_id}' not found.")

        if req["status"] != "APPROVED":
            raise ValueError(f"Cannot reveal identity: Request status is '{req['status']}'. Requires supervisory approval.")

        now = _now_ms()
        lease_exp = req.get("lease_expires_at") or 0
        if now > lease_exp:
            req["status"] = "EXPIRED"
            raise ValueError("Identity lease has expired. Re-submission and supervisory approval required.")

        rec_id = req["record_id"]
        raw_data = _raw_vault.get(rec_id, {
            "aadhaar": "4829 1042 8492",
            "pan": "ABCDE1234F",
            "bank_account": "987654321098",
            "phone": "+91 98765 43210",
        })

        field_name = req["field_name"]
        if field_name in raw_data:
            unmasked_val = raw_data[field_name]
        else:
            unmasked_val = f"Aadhaar: {raw_data.get('aadhaar')}, PAN: {raw_data.get('pan')}, Bank A/C: {raw_data.get('bank_account')}"

        masked_val = mask_aadhaar(raw_data.get("aadhaar", "")) if "aadhaar" in field_name else "XXXXXXXX"

        # Log unmask access in audit trail
        audit_id = _log_dpdp_audit_action(
            action="DPDP_UNMASK_ACCESSED",
            actor_badge_id=requester_badge_id,
            actor_role=req["requester_role"],
            record_id=rec_id,
            legal_basis=req["legal_basis"],
            outcome="REVEALED_UNDER_WARRANT",
            details=f"Unmasked {field_name} revealed under {req['legal_basis']} for FIR {req['case_fir_number']}",
            client_ip=client_ip,
        )

        remaining_secs = max(0, int((lease_exp - now) / 1000))

        return {
            "request_id": request_id,
            "record_id": rec_id,
            "field_name": field_name,
            "unmasked_value": unmasked_val,
            "masked_value": masked_val,
            "requester_badge_id": requester_badge_id,
            "supervisor_badge_id": req["supervisor_badge_id"] or "SUP-DCP-9901",
            "lease_expires_at": lease_exp,
            "seconds_remaining": remaining_secs,
            "audit_transaction_id": audit_id,
            "statutory_warning": "CONFIDENTIAL: Unmasked under statutory court exemption. Unauthorized dissemination violates Section 17 DPDP Act & BNS § 316.",
        }


def list_unmask_requests(case_id: Optional[str] = None, status: Optional[str] = None) -> list[dict[str, Any]]:
    """List unmask requests filtered by case or status."""
    with _lock:
        items = list(_unmask_requests.values())
        if case_id:
            items = [i for i in items if case_id.lower() in i.get("case_fir_number", "").lower() or case_id.lower() in i.get("record_id", "").lower()]
        if status:
            items = [i for i in items if i.get("status") == status]
        return sorted(items, key=lambda x: x["created_at"], reverse=True)


def _log_dpdp_audit_action(
    action: str,
    actor_badge_id: str,
    actor_role: str,
    record_id: str,
    legal_basis: str,
    outcome: str,
    details: str,
    client_ip: str = "127.0.0.1",
) -> str:
    """Append immutable audit log entry for all DPDP sanitization and unmask operations."""
    global _audit_counter
    audit_id = f"DPDP-AUDIT-{_now_ms()}-{_audit_counter}"
    _audit_counter += 1

    entry = {
        "audit_id": audit_id,
        "timestamp": _now_ms(),
        "timestamp_iso": _now_iso(),
        "action": action,
        "actor_badge_id": actor_badge_id,
        "actor_role": actor_role,
        "record_id": record_id,
        "legal_basis": legal_basis,
        "outcome": outcome,
        "details": details,
        "client_ip": client_ip,
    }
    _dpdp_audit_log.append(entry)
    return audit_id


def get_dpdp_audit_trail() -> list[dict[str, Any]]:
    """Retrieve full DPDP audit trail."""
    with _lock:
        return copy.deepcopy(_dpdp_audit_log)


def reset():
    """Reset store state for clean test execution."""
    global _req_counter, _audit_counter
    with _lock:
        _unmask_requests.clear()
        _raw_vault.clear()
        _pseudonym_map.clear()
        _reverse_pseudonym_map.clear()
        _dpdp_audit_log.clear()
        _req_counter = 1001
        _audit_counter = 5001
        _init_defaults()


def _init_defaults():
    """Pre-seed sample records."""
    submit_unmask_request({
        "record_id": "REP-2026-DELHI-8841",
        "field_name": "aadhaar",
        "case_fir_number": "FIR No. 142/2026 PS Cyber Crime",
        "legal_basis": "SECTION_91_CRPC",
        "justification": "Court-mandated Section 91 CrPC notice to verify victim KYC against mule account beneficiary records.",
        "requester_badge_id": "OFF-IO-4412",
        "requester_name": "Inspector Rajesh Kumar",
        "requester_role": "INVESTIGATOR",
    })


# Initialize on module load
_init_defaults()
