"""
Centralized audit logging service for KshemOS.

Features:
- Append-only audit event storage.
- Actor, action, resource and timestamp metadata.
- Sensitive metadata redaction.
- Sensitive and unusual event classification.
- Search, filtering and pagination.
- SHA-256 hash chaining and integrity verification.

Storage:
Process-local in-memory storage for the current prototype.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
import threading
import time
import uuid

from typing import Any, Literal, Optional


GENESIS_HASH = "0" * 64

Outcome = Literal["success", "failure", "denied"]

_lock = threading.RLock()
_events: list[dict[str, Any]] = []


_SENSITIVE_KEY_MARKERS = (
    "password", "passwd", "secret", "token", "api_key",
    "private_key", "authorization", "cookie", "otp", "pin",
    "cvv", "card_number", "bank_account", "account_number",
    "aadhaar", "pan", "phone", "email", "transcript",
    "raw_payload", "reporter_name", "address",
)

_SENSITIVE_RESOURCE_TYPES = {
    "evidence", "citizen", "reports", "accounts", "users",
    "auth", "audit",
}

_SENSITIVE_ACTION_MARKERS = (
    "read", "view", "download", "export", "delete",
    "permission", "role", "credential", "login", "auth",
)

_UNUSUAL_ACTION_MARKERS = (
    "denied", "unauthorized", "forbidden", "override",
    "bypass", "failed", "revoke", "delete",
    "permission_change", "role_change",
)


def _clean_string(value: Any, default: str, max_length: int) -> str:
    """Normalize and limit a metadata string."""
    if value is None:
        return default

    cleaned = str(value).strip()
    return cleaned[:max_length] if cleaned else default


def _sanitize_value(value: Any, key: str = "", depth: int = 0) -> Any:
    """Recursively sanitize event metadata."""
    normalized_key = key.lower().replace("-", "_")

    if any(marker in normalized_key for marker in _SENSITIVE_KEY_MARKERS):
        return "[REDACTED]"

    if depth > 6:
        return "[TRUNCATED]"

    if isinstance(value, dict):
        return {
            str(child_key)[:80]: _sanitize_value(
                child_value,
                key=str(child_key)[:80],
                depth=depth + 1,
            )
            for child_key, child_value in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            _sanitize_value(item, depth=depth + 1)
            for item in value[:100]
        ]

    if isinstance(value, str):
        return value[:1000]

    if isinstance(value, (int, float, bool)) or value is None:
        return value

    return str(value)[:1000]


def sanitize_metadata(metadata: Optional[dict[str, Any]]) -> dict[str, Any]:
    """Return safe, size-limited event metadata."""
    if not metadata:
        return {}

    sanitized = _sanitize_value(metadata)

    try:
        serialized = json.dumps(
            sanitized,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )

        if len(serialized.encode("utf-8")) > 16_000:
            return {
                "_metadata_truncated": True,
                "_reason": "Metadata exceeded the 16 KB audit limit.",
            }

    except (TypeError, ValueError):
        return {
            "_metadata_error": "Metadata could not be serialized safely."
        }

    return sanitized


def _classify_event(
    action: str,
    resource_type: str,
    outcome: Outcome,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """Determine whether an event is sensitive or unusual."""
    action_lower = action.lower()
    resource_lower = resource_type.lower()

    is_sensitive = (
        resource_lower in _SENSITIVE_RESOURCE_TYPES
        or any(marker in action_lower for marker in _SENSITIVE_ACTION_MARKERS)
    )

    is_unusual = (
        outcome == "denied"
        or any(marker in action_lower for marker in _UNUSUAL_ACTION_MARKERS)
    )

    http_status = metadata.get("http_status", 0)

    try:
        http_status = int(http_status)
    except (TypeError, ValueError):
        http_status = 0

    is_unusual = (
        is_unusual
        or http_status in (401, 403, 429)
        or http_status >= 500
    )

    risk_level = (
        "high" if is_unusual
        else "medium" if is_sensitive
        else "low"
    )

    return {
        "is_sensitive": is_sensitive,
        "is_unusual": is_unusual,
        "risk_level": risk_level,
    }


def _calculate_hash(event: dict[str, Any]) -> str:
    """Calculate SHA-256 digest of a canonical event representation."""
    serialized = json.dumps(
        event,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )

    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def record_event(
    *,
    actor_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    actor_role: str = "unknown",
    outcome: Outcome = "success",
    metadata: Optional[dict[str, Any]] = None,
    source: str = "api",
    occurred_at: Optional[int] = None,
) -> dict[str, Any]:
    """Append a new audit event. Historical events are never updated."""
    if outcome not in ("success", "failure", "denied"):
        raise ValueError("Invalid audit event outcome.")

    safe_metadata = sanitize_metadata(metadata)

    classification = _classify_event(
        action=action,
        resource_type=resource_type,
        outcome=outcome,
        metadata=safe_metadata,
    )

    timestamp = (
        int(occurred_at)
        if occurred_at is not None
        else int(time.time() * 1000)
    )

    event = {
        "event_id": str(uuid.uuid4()),
        "actor_id": _clean_string(actor_id, "anonymous", 128),
        "actor_role": _clean_string(actor_role, "unknown", 64),
        "action": _clean_string(action, "UNKNOWN_ACTION", 160),
        "resource_type": _clean_string(resource_type, "unknown", 80),
        "resource_id": (
            _clean_string(resource_id, "", 256)
            if resource_id is not None
            else None
        ),
        "outcome": outcome,
        "occurred_at": timestamp,
        "source": _clean_string(source, "api", 80),
        "metadata": safe_metadata,
        **classification,
    }

    with _lock:
        previous_hash = (
            _events[-1]["event_hash"] if _events else GENESIS_HASH
        )

        event["previous_hash"] = previous_hash
        event["event_hash"] = _calculate_hash(event)

        _events.append(event)

        return copy.deepcopy(event)


def list_events(
    *,
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    outcome: Optional[Outcome] = None,
    sensitive: Optional[bool] = None,
    unusual: Optional[bool] = None,
    from_ms: Optional[int] = None,
    to_ms: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Search audit events with filters and pagination."""
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 100))

    with _lock:
        items = copy.deepcopy(_events)

    if actor_id:
        actor_filter = actor_id.casefold()
        items = [
            item for item in items
            if item["actor_id"].casefold() == actor_filter
        ]

    if action:
        action_filter = action.casefold()
        items = [
            item for item in items
            if action_filter in item["action"].casefold()
        ]

    if resource_type:
        resource_filter = resource_type.casefold()
        items = [
            item for item in items
            if item["resource_type"].casefold() == resource_filter
        ]

    if resource_id:
        items = [
            item for item in items
            if item["resource_id"] == resource_id
        ]

    if outcome:
        items = [
            item for item in items
            if item["outcome"] == outcome
        ]

    if sensitive is not None:
        items = [
            item for item in items
            if item["is_sensitive"] is sensitive
        ]

    if unusual is not None:
        items = [
            item for item in items
            if item["is_unusual"] is unusual
        ]

    if from_ms is not None:
        items = [
            item for item in items
            if item["occurred_at"] >= from_ms
        ]

    if to_ms is not None:
        items = [
            item for item in items
            if item["occurred_at"] <= to_ms
        ]

    if search:
        query = search.casefold()

        def matches_query(item: dict[str, Any]) -> bool:
            searchable = [
                item["event_id"],
                item["actor_id"],
                item["actor_role"],
                item["action"],
                item["resource_type"],
                item["resource_id"] or "",
                item["source"],
                json.dumps(item["metadata"], ensure_ascii=False),
            ]

            return any(
                query in value.casefold()
                for value in searchable
            )

        items = [
            item for item in items
            if matches_query(item)
        ]

    items.sort(
        key=lambda item: (item["occurred_at"], item["event_id"]),
        reverse=True,
    )

    total = len(items)
    start = (page - 1) * page_size

    return {
        "items": items[start:start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }


def verify_integrity() -> dict[str, Any]:
    """Verify the complete audit hash chain."""
    with _lock:
        events = copy.deepcopy(_events)

    expected_previous_hash = GENESIS_HASH

    for event in events:
        if event.get("previous_hash") != expected_previous_hash:
            return {
                "valid": False,
                "event_count": len(events),
                "invalid_event_id": event.get("event_id"),
                "latest_hash": expected_previous_hash,
            }

        event_without_hash = {
            key: value
            for key, value in event.items()
            if key != "event_hash"
        }

        expected_hash = _calculate_hash(event_without_hash)

        if event.get("event_hash") != expected_hash:
            return {
                "valid": False,
                "event_count": len(events),
                "invalid_event_id": event.get("event_id"),
                "latest_hash": expected_previous_hash,
            }

        expected_previous_hash = event["event_hash"]

    return {
        "valid": True,
        "event_count": len(events),
        "invalid_event_id": None,
        "latest_hash": expected_previous_hash,
    }


def reset() -> None:
    """Clear the in-memory store. Intended exclusively for automated tests."""
    with _lock:
        _events.clear()
