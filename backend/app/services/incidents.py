"""Incident lifecycle with in-memory and PostgreSQL persistence."""

from __future__ import annotations

import itertools
import threading
import time
from typing import Any

from sqlalchemy import select, delete

from app.services.scam_detection import analyze_transcript
from app.services.incident_notifications import dispatch_incident_notifications
from app.services import idempotency
from app.services.persistence import (
    IncidentRecord,
    StaffingRecord,
    SyncOperationRecord,
    get_session,
    next_id,
    persistence_backend,
)

REGIONS = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"]
UNSPECIFIED_REGION = "Unspecified"

SEVERITIES = ["critical", "high", "medium", "low"]
STATUSES = ["new", "triaged", "in_progress", "escalated", "resolved"]

TITLE_MAX_LENGTH = 80

_lock = threading.Lock()
_incident_id_counter = itertools.count(1)
_incidents: dict[str, dict[str, Any]] = {}
_staffing: dict[str, int] = {region: 0 for region in REGIONS}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _is_postgres() -> bool:
    return persistence_backend() == "postgres"


def _get_incident(incident_id: str) -> dict[str, Any] | None:
    if _is_postgres():
        with get_session() as session:
            record = session.get(IncidentRecord, incident_id)
            return dict(record.payload) if record else None

    return _incidents.get(incident_id)


def derive_title(description: str) -> str:
    text = " ".join(description.split())
    first_sentence = text.split(". ")[0]

    if len(first_sentence) <= TITLE_MAX_LENGTH:
        return first_sentence or "Untitled report"

    return first_sentence[:TITLE_MAX_LENGTH - 1].rstrip() + "…"


def create_incident(
    *,
    category: str,
    description: str,
    region: str | None = None,
    report_id: str | None = None,
    linked_account: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:

    global _incident_id_counter

    now = now if now is not None else _now_ms()

    risk_band = analyze_transcript(description)["risk_band"]
    severity = risk_band if risk_band in SEVERITIES else "low"

    incident = None

    if _is_postgres():
        incident_id = next_id("incident", "INC")

        incident = {
            "id": incident_id,
            "report_id": report_id,
            "title": derive_title(description),
            "description": description,
            "category": category,
            "severity": severity,
            "previous_severity": None,
            "region": region if region in REGIONS else UNSPECIFIED_REGION,
            "status": "new",
            "assigned_to": None,
            "linked_account": linked_account or None,
            "opened_at": now,
            "first_response_at": None,
            "resolved_at": None,
            "updated_at": now,
            "version": 1,
            "notes": [],
        }

        with get_session() as session:
            session.add(
                IncidentRecord(
                    id=incident_id,
                    report_id=report_id,
                    payload=incident,
                    opened_at=now,
                    updated_at=now,
                )
            )
            session.commit()

    else:
        with _lock:
            incident_id = f"INC-{next(_incident_id_counter):04d}"

            incident = {
                "id": incident_id,
                "report_id": report_id,
                "title": derive_title(description),
                "description": description,
                "category": category,
                "severity": severity,
                "previous_severity": None,
                "region": region if region in REGIONS else UNSPECIFIED_REGION,
                "status": "new",
                "assigned_to": None,
                "linked_account": linked_account or None,
                "opened_at": now,
                "first_response_at": None,
                "resolved_at": None,
                "updated_at": now,
                "version": 1,
                "notes": [],
            }

            _incidents[incident_id] = incident

    if severity == "critical":
        try:
            dispatch_incident_notifications(
                incident, "escalation", now=now
            )
        except Exception:
            pass

    return dict(incident)


def apply_update(
    incident: dict[str, Any],
    changes: dict[str, Any],
    now: int,
) -> dict[str, Any]:

    updated = dict(incident)

    if "severity" in changes and changes["severity"] != incident["severity"]:
        updated["previous_severity"] = incident["severity"]
        updated["severity"] = changes["severity"]

    if "assigned_to" in changes:
        updated["assigned_to"] = (
            (changes["assigned_to"] or "").strip() or None
        )

    if "linked_account" in changes:
        updated["linked_account"] = (
            (changes["linked_account"] or "").strip().upper() or None
        )

    if "status" in changes:
        updated["status"] = changes["status"]
        updated["resolved_at"] = (
            incident["resolved_at"] or now
            if changes["status"] == "resolved"
            else None
        )

    if "notes" in changes and changes["notes"]:
        note_text = str(changes["notes"]).strip()

        if note_text:
            existing = list(incident.get("notes") or [])
            existing.append(note_text)
            updated["notes"] = existing

    if updated["first_response_at"] is None and (
        updated["assigned_to"] or updated["status"] != "new"
    ):
        updated["first_response_at"] = now

    updated["version"] = incident.get("version", 1) + 1
    updated["updated_at"] = now

    return updated


def _version_conflict(
    incident: dict[str, Any],
    changes: dict[str, Any],
    expected_version: int,
) -> dict[str, Any]:

    conflicting_fields = [
        key
        for key, value in changes.items()
        if key not in ("expected_version", "force", "notes")
        and key in incident
        and incident[key] != value
    ]

    return {
        "conflict": True,
        "server_incident": dict(incident),
        "expected_version": expected_version,
        "current_version": incident.get("version", 1),
        "conflicting_fields": conflicting_fields,
    }


def _dispatch_update_notifications(
    old_incident: dict[str, Any],
    updated_incident: dict[str, Any],
    now: int,
) -> None:

    old_assigned = old_incident.get("assigned_to")
    old_status = old_incident.get("status")
    old_severity = old_incident.get("severity")

    new_assigned = updated_incident.get("assigned_to")
    new_status = updated_incident.get("status")
    new_severity = updated_incident.get("severity")

    try:
        if new_assigned and new_assigned != old_assigned:
            if not old_assigned:
                dispatch_incident_notifications(
                    updated_incident, "assignment", now=now
                )
            else:
                dispatch_incident_notifications(
                    updated_incident,
                    "reassignment",
                    previous_assigned_to=old_assigned,
                    now=now,
                )

        if new_status == "escalated" and old_status != "escalated":
            dispatch_incident_notifications(
                updated_incident, "escalation", now=now
            )

        if new_severity == "critical" and old_severity != "critical":
            dispatch_incident_notifications(
                updated_incident, "supervisor_review", now=now
            )

    except Exception:
        pass


def update_incident(
    incident_id: str,
    changes: dict[str, Any],
    now: int | None = None,
    expected_version: int | None = None,
    force: bool = False,
) -> dict[str, Any] | None:

    now = now if now is not None else _now_ms()

    cleaned_changes = {
        key: value
        for key, value in changes.items()
        if key not in ("expected_version", "force")
    }

    if _is_postgres():
        with get_session() as session:
            record = session.execute(
                select(IncidentRecord)
                .where(IncidentRecord.id == incident_id)
                .with_for_update()
            ).scalar_one_or_none()

            if record is None:
                return None

            incident = dict(record.payload)
            current_version = incident.get("version", 1)

            if (
                expected_version is not None
                and not force
                and current_version != expected_version
            ):
                return _version_conflict(
                    incident, changes, expected_version
                )

            updated = apply_update(incident, cleaned_changes, now)

            record.payload = updated
            record.updated_at = now
            session.commit()

    else:
        with _lock:
            incident = _incidents.get(incident_id)

            if incident is None:
                return None

            current_version = incident.get("version", 1)

            if (
                expected_version is not None
                and not force
                and current_version != expected_version
            ):
                return _version_conflict(
                    incident, changes, expected_version
                )

            updated = apply_update(incident, cleaned_changes, now)
            _incidents[incident_id] = updated

    _dispatch_update_notifications(incident, updated, now)

    return dict(updated)


def create_incident_idempotent(
    payload: dict[str, Any],
    subject: str | None = None,
    operation_id: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    """Create an incident once per (subject, operation_id).

    Retries after an ambiguous timeout return the original confirmation
    instead of creating a duplicate incident.
    """

    with idempotency.operation_lock(subject, operation_id):
        stored = idempotency.get_result(subject, operation_id)
        if stored is not None:
            return {**stored, "replayed": True}

        create_payload = dict(payload)
        create_payload.pop("operation_id", None)

        incident = create_incident(**create_payload, now=now)

        result = {
            "status": "applied",
            "incident": incident,
            "server_incident": None,
            "conflicting_fields": None,
            "error": None,
        }

        idempotency.record_result(subject, operation_id, result)
        return {**result, "replayed": False}


def update_incident_idempotent(
    incident_id: str,
    changes: dict[str, Any],
    subject: str | None = None,
    operation_id: str | None = None,
    expected_version: int | None = None,
    force: bool = False,
    now: int | None = None,
) -> dict[str, Any]:
    """Apply an incident update once per (subject, operation_id)."""

    with idempotency.operation_lock(subject, operation_id):
        stored = idempotency.get_result(subject, operation_id)
        if stored is not None:
            return {**stored, "replayed": True}

        result_raw = update_incident(
            incident_id,
            changes,
            now=now,
            expected_version=expected_version,
            force=force,
        )

        if result_raw is None:
            # Transient failures are not cached: a later retry may succeed once
            # the incident exists (for example a create that has just synced).
            return {
                "status": "failed",
                "incident": None,
                "server_incident": None,
                "conflicting_fields": None,
                "error": f"Incident {incident_id} not found on server",
                "replayed": False,
            }

        if result_raw.get("conflict"):
            result = {
                "status": "conflict",
                "incident": None,
                "server_incident": result_raw["server_incident"],
                "conflicting_fields": result_raw["conflicting_fields"],
                "expected_version": result_raw["expected_version"],
                "current_version": result_raw["current_version"],
                "error": (
                    f"Server has newer version "
                    f"(v{result_raw['current_version']}) than field expected "
                    f"(v{result_raw['expected_version']})"
                ),
            }
        else:
            result = {
                "status": "applied",
                "incident": result_raw,
                "server_incident": None,
                "conflicting_fields": None,
                "error": None,
            }

        idempotency.record_result(subject, operation_id, result)
        return {**result, "replayed": False}


def _item_sort_key(indexed_item: tuple[int, dict[str, Any]]) -> tuple[float, int]:
    index, item = indexed_item
    timestamp = item.get("client_timestamp")
    return (
        float(timestamp) if timestamp is not None else float("inf"),
        index,
    )


def sync_queue_items(
    items: list[dict[str, Any]],
    subject: str | None = None,
) -> dict[str, Any]:
    """Apply an offline batch in field-authoring order.

    Items are ordered by their client timestamp (stable on ties) so a queued
    edit is never applied before the draft it depends on. Creates are tracked
    by their temporary offline ID so dependent updates can address them.
    """

    now = _now_ms()
    results = []
    applied = 0
    conflicts = 0
    failed = 0
    replayed = 0

    local_to_server: dict[str, str] = {}

    ordered_items = [
        item
        for _, item in sorted(
            list(enumerate(items)),
            key=_item_sort_key,
        )
    ]

    for item in ordered_items:
        queue_id = item.get("queue_id", "")
        operation_id = item.get("operation_id") or queue_id or None
        action = item.get("action")

        if action == "create":
            payload = item.get("create_payload") or {}

            if not isinstance(payload, dict):
                payload = payload.model_dump()

            local_id = item.get("local_incident_id") or payload.get(
                "local_incident_id"
            )

            result = create_incident_idempotent(
                payload,
                subject=subject,
                operation_id=operation_id,
                now=now,
            )

            if result["status"] == "applied" and local_id:
                local_to_server[local_id] = result["incident"]["id"]

            results.append(
                {
                    "queue_id": queue_id,
                    "operation_id": operation_id,
                    "replayed": result.get("replayed", False),
                    **result,
                }
            )

            if result["status"] == "applied":
                applied += 1
                if result.get("replayed"):
                    replayed += 1
            else:
                failed += 1

        elif action == "update":
            incident_id = item.get("incident_id")
            resolved_id = local_to_server.get(incident_id, incident_id)

            changes = item.get("changes") or {}

            if not isinstance(changes, dict):
                changes = changes.model_dump(
                    exclude_unset=True,
                    exclude_none=True,
                )

            changes = {
                key: value
                for key, value in changes.items()
                if value is not None
                and key not in ("operation_id", "expected_version", "force")
            }

            result = update_incident_idempotent(
                resolved_id,
                changes,
                subject=subject,
                operation_id=operation_id,
                expected_version=item.get("expected_version"),
                force=item.get("force", False),
                now=now,
            )

            results.append(
                {
                    "queue_id": queue_id,
                    "operation_id": operation_id,
                    "incident_id": resolved_id,
                    "replayed": result.get("replayed", False),
                    **result,
                }
            )

            if result["status"] == "applied":
                applied += 1
                if result.get("replayed"):
                    replayed += 1
            elif result["status"] == "conflict":
                conflicts += 1
            else:
                failed += 1

        else:
            results.append(
                {
                    "queue_id": queue_id,
                    "operation_id": operation_id,
                    "status": "failed",
                    "incident": None,
                    "server_incident": None,
                    "conflicting_fields": None,
                    "error": f"Unknown sync action: {action}",
                    "replayed": False,
                }
            )
            failed += 1

    return {
        "results": results,
        "applied_count": applied,
        "conflict_count": conflicts,
        "failed_count": failed,
        "replayed_count": replayed,
        "server_time": now,
    }



def set_staffing(region: str, officers_on_duty: int) -> bool:

    if region not in REGIONS:
        return False

    if _is_postgres():
        with get_session() as session:
            record = session.get(StaffingRecord, region)

            if record is None:
                record = StaffingRecord(
                    region=region,
                    officers_on_duty=officers_on_duty,
                )
                session.add(record)
            else:
                record.officers_on_duty = officers_on_duty

            session.commit()

    else:
        with _lock:
            _staffing[region] = officers_on_duty

    return True


def get_feed() -> dict[str, Any]:

    if _is_postgres():
        with get_session() as session:
            records = session.execute(
                select(IncidentRecord).order_by(IncidentRecord.opened_at)
            ).scalars().all()

            staffing_records = session.execute(
                select(StaffingRecord)
            ).scalars().all()

            staffing_map = {
                record.region: record.officers_on_duty
                for record in staffing_records
            }

            incidents = [
                dict(record.payload) for record in records
            ]

        return {
            "regions": list(REGIONS),
            "staffing": [
                {
                    "region": region,
                    "officers_on_duty": staffing_map.get(region, 0),
                }
                for region in REGIONS
            ],
            "incidents": incidents,
        }

    with _lock:
        return {
            "regions": list(REGIONS),
            "staffing": [
                {
                    "region": region,
                    "officers_on_duty": _staffing[region],
                }
                for region in REGIONS
            ],
            "incidents": [
                dict(incident) for incident in _incidents.values()
            ],
        }


def reset() -> None:
    """Clear incident and staffing data. Intended for tests."""

    global _incident_id_counter

    idempotency.reset()

    if _is_postgres():
        with get_session() as session:
            session.execute(delete(IncidentRecord))
            session.execute(delete(StaffingRecord))
            session.execute(delete(SyncOperationRecord))
            session.execute(
                delete(
                    __import__(
                        "app.services.persistence",
                        fromlist=["IDCounter"],
                    ).IDCounter
                ).where(
                    __import__(
                        "app.services.persistence",
                        fromlist=["IDCounter"],
                    ).IDCounter.name == "incident"
                )
            )
            session.commit()

        return

    with _lock:
        _incidents.clear()
        _staffing.update({region: 0 for region in REGIONS})
        _incident_id_counter = itertools.count(1)