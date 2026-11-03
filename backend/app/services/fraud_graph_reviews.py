"""
Fraud graph analyst review service.

Maintains append-only, hash-chained review events for graph relationships.
The in-memory store is suitable for the current demo, not durable production
audit storage.
"""

from __future__ import annotations

import copy
import hashlib
import itertools
import json
import threading

from datetime import datetime, timezone
from typing import Any

from app.services.fraud_graph import get_graph


GENESIS_HASH = "0" * 64

_EVENT_HASH_FIELDS = (
    "event_id",
    "edge_id",
    "event_type",
    "decision",
    "reason",
    "analyst_id",
    "created_at",
    "reverses_event_id",
    "previous_hash",
)

_lock = threading.RLock()
_review_events: dict[str, list[dict[str, Any]]] = {}
_event_counter = itertools.count(1)


def _now() -> str:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_reason(reason: str) -> str:
    reason = reason.strip()

    if not reason:
        raise ValueError("A review reason is required")

    if len(reason) > 2000:
        raise ValueError("Review reason cannot exceed 2000 characters")

    return reason


def _validate_analyst_id(analyst_id: str) -> str:
    analyst_id = analyst_id.strip()

    if not analyst_id:
        raise ValueError("An authenticated analyst identity is required")

    if len(analyst_id) > 128:
        raise ValueError("Analyst identity cannot exceed 128 characters")

    return analyst_id


def _get_edge_metadata(edge_id: str) -> dict[str, Any]:
    """Find a graph edge using its stable edge ID."""
    graph = get_graph()

    matches = [
        dict(data)
        for _, _, data in graph.edges(data=True)
        if data.get("edge_id") == edge_id
    ]

    if not matches:
        raise KeyError(f"Unknown graph edge: {edge_id}")

    if len(matches) > 1:
        raise RuntimeError(f"Duplicate graph edge ID: {edge_id}")

    return matches[0]


def _calculate_integrity_hash(event: dict[str, Any]) -> str:
    """Calculate a SHA-256 hash over the complete event payload."""
    payload = {
        field: event[field]
        for field in _EVENT_HASH_FIELDS
    }

    canonical_payload = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )

    return hashlib.sha256(
        canonical_payload.encode("utf-8")
    ).hexdigest()


def _append_event(
    edge_id: str,
    event_type: str,
    decision: str | None,
    reason: str,
    analyst_id: str,
    reverses_event_id: str | None = None,
) -> dict[str, Any]:
    """Append one event to an edge's hash chain."""
    ledger = _review_events.setdefault(edge_id, [])

    previous_hash = (
        ledger[-1]["integrity_hash"]
        if ledger
        else GENESIS_HASH
    )

    event = {
        "event_id": f"GRV-{next(_event_counter):06d}",
        "edge_id": edge_id,
        "event_type": event_type,
        "decision": decision,
        "reason": reason,
        "analyst_id": analyst_id,
        "created_at": _now(),
        "reverses_event_id": reverses_event_id,
        "previous_hash": previous_hash,
    }

    event["integrity_hash"] = _calculate_integrity_hash(event)

    ledger.append(event)

    return copy.deepcopy(event)


def _get_active_decision(
    events: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """
    Return the latest decision that has not been reversed.

    Reversal events do not delete or modify their target decision.
    """
    reversed_event_ids = {
        event["reverses_event_id"]
        for event in events
        if event["event_type"] == "reversal"
    }

    active_decisions = [
        event
        for event in events
        if (
            event["event_type"] == "decision"
            and event["event_id"] not in reversed_event_ids
        )
    ]

    return active_decisions[-1] if active_decisions else None


def create_review(
    edge_id: str,
    decision: str,
    reason: str,
    analyst_id: str,
) -> dict[str, Any]:
    """Record a Confirm, Dispute, or Reject decision."""
    if decision not in {"confirm", "dispute", "reject"}:
        raise ValueError("Decision must be confirm, dispute, or reject")

    reason = _validate_reason(reason)
    analyst_id = _validate_analyst_id(analyst_id)

    _get_edge_metadata(edge_id)

    with _lock:
        return _append_event(
            edge_id=edge_id,
            event_type="decision",
            decision=decision,
            reason=reason,
            analyst_id=analyst_id,
        )


def reverse_review(
    edge_id: str,
    event_id: str,
    reason: str,
    analyst_id: str,
) -> dict[str, Any]:
    """
    Reverse an existing decision by appending a new event.

    The original decision remains in the ledger.
    """
    reason = _validate_reason(reason)
    analyst_id = _validate_analyst_id(analyst_id)

    _get_edge_metadata(edge_id)

    with _lock:
        ledger = _review_events.get(edge_id, [])

        target = next(
            (
                event
                for event in ledger
                if event["event_id"] == event_id
            ),
            None,
        )

        if target is None:
            raise LookupError("Review event not found for this edge")

        if target["event_type"] != "decision":
            raise ValueError("Only decision events can be reversed")

        already_reversed = any(
            event["event_type"] == "reversal"
            and event["reverses_event_id"] == event_id
            for event in ledger
        )

        if already_reversed:
            raise ValueError("This decision has already been reversed")

        return _append_event(
            edge_id=edge_id,
            event_type="reversal",
            decision=None,
            reason=reason,
            analyst_id=analyst_id,
            reverses_event_id=event_id,
        )


def get_review_history(edge_id: str) -> dict[str, Any]:
    """Return the complete review history and current active decision."""
    _get_edge_metadata(edge_id)

    with _lock:
        events = copy.deepcopy(_review_events.get(edge_id, []))
        current = _get_active_decision(events)

    return {
        "edge_id": edge_id,
        "events": events,
        "current_decision": (
            current["decision"] if current else None
        ),
    }


def verify_review_history(edge_id: str) -> dict[str, Any]:
    """Verify the complete hash chain for a graph edge."""
    _get_edge_metadata(edge_id)

    with _lock:
        events = copy.deepcopy(_review_events.get(edge_id, []))

    expected_previous_hash = GENESIS_HASH

    for index, event in enumerate(events):
        if event["previous_hash"] != expected_previous_hash:
            return {
                "edge_id": edge_id,
                "verified": False,
                "event_count": len(events),
                "broken_event_id": event["event_id"],
            }

        calculated_hash = _calculate_integrity_hash(event)

        if calculated_hash != event["integrity_hash"]:
            return {
                "edge_id": edge_id,
                "verified": False,
                "event_count": len(events),
                "broken_event_id": event["event_id"],
            }

        expected_previous_hash = event["integrity_hash"]

    return {
        "edge_id": edge_id,
        "verified": True,
        "event_count": len(events),
        "broken_event_id": None,
    }


def export_evaluation_records() -> dict[str, Any]:
    """
    Export current reviewed outcomes for offline evaluation.

    Confirm maps to positive and Reject maps to negative.
    Disputed relationships have no binary label.
    Synthetic relationships are retained for transparency but are
    excluded from binary evaluation eligibility.
    """
    graph = get_graph()

    edges_by_id = {
        data["edge_id"]: dict(data)
        for _, _, data in graph.edges(data=True)
    }

    with _lock:
        events_by_edge = copy.deepcopy(_review_events)

    records = []

    for edge_id in sorted(events_by_edge):
        edge = edges_by_id.get(edge_id)

        if edge is None:
            continue

        active_event = _get_active_decision(events_by_edge[edge_id])

        if active_event is None:
            continue

        decision = active_event["decision"]
        provenance = edge["provenance"]

        eligible = (
            decision in {"confirm", "reject"}
            and provenance != "synthetic"
        )

        evaluation_label = None

        if eligible:
            evaluation_label = (
                "positive" if decision == "confirm" else "negative"
            )

        records.append({
            "edge_id": edge_id,
            "review_event_id": active_event["event_id"],
            "relationship_type": edge["relationship_type"],
            "provenance": provenance,
            "decision": decision,
            "evaluation_label": evaluation_label,
            "eligible_for_binary_evaluation": eligible,
            "reviewed_at": active_event["created_at"],
        })

    return {
        "generated_at": _now(),
        "total": len(records),
        "records": records,
    }


def reset_review_store() -> None:
    """Reset review events for isolated tests."""
    global _event_counter

    with _lock:
        _review_events.clear()
        _event_counter = itertools.count(1)