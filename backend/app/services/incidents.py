"""
Incident lifecycle for the Operational Incident Dashboard.

Every citizen report becomes an incident. Severity starts from the Digital
Arrest Agent's transcript risk band and officers can change it; status,
assignment, and staffing are updated by officers from the dashboard.

Mirrors `frontend/src/incidentDashboard.js` (`createIncident`,
`applyIncidentUpdate`), which the frontend uses when this backend is offline.
Keep the two in step.
"""
from __future__ import annotations

import itertools
import threading
import time
from typing import Any

from app.services.scam_detection import analyze_transcript

REGIONS = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"]
UNSPECIFIED_REGION = "Unspecified"
SEVERITIES = ["critical", "high", "medium", "low"]
STATUSES = ["new", "triaged", "in_progress", "escalated", "resolved"]

TITLE_MAX_LENGTH = 80

# In-memory, like `store.py` — swap for Postgres tables when moving beyond a
# single-process demo. Data resets when the server restarts.
_lock = threading.Lock()
_incident_id_counter = itertools.count(1)
_incidents: dict[str, dict[str, Any]] = {}
_staffing: dict[str, int] = {region: 0 for region in REGIONS}


def _now_ms() -> int:
    return int(time.time() * 1000)


def derive_title(description: str) -> str:
    text = " ".join(description.split())
    first_sentence = text.split(". ")[0]
    if len(first_sentence) <= TITLE_MAX_LENGTH:
        return first_sentence or "Untitled report"
    return first_sentence[: TITLE_MAX_LENGTH - 1].rstrip() + "…"


def create_incident(
    *,
    category: str,
    description: str,
    region: str | None = None,
    report_id: str | None = None,
    linked_account: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    now = now if now is not None else _now_ms()
    severity = analyze_transcript(description)["risk_band"]

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
        }
        _incidents[incident_id] = incident
        return dict(incident)


def apply_update(incident: dict[str, Any], changes: dict[str, Any], now: int) -> dict[str, Any]:
    """Return a copy of `incident` with officer `changes` applied.

    The first officer action — assigning someone or moving the status off
    "new" — counts as the first response for response-target tracking.
    """
    updated = dict(incident)

    if "severity" in changes and changes["severity"] != incident["severity"]:
        updated["previous_severity"] = incident["severity"]
        updated["severity"] = changes["severity"]

    if "assigned_to" in changes:
        updated["assigned_to"] = (changes["assigned_to"] or "").strip() or None

    if "linked_account" in changes:
        updated["linked_account"] = (changes["linked_account"] or "").strip().upper() or None

    if "status" in changes:
        updated["status"] = changes["status"]
        updated["resolved_at"] = (incident["resolved_at"] or now) if changes["status"] == "resolved" else None

    if updated["first_response_at"] is None and (updated["assigned_to"] or updated["status"] != "new"):
        updated["first_response_at"] = now

    return updated


def update_incident(incident_id: str, changes: dict[str, Any], now: int | None = None) -> dict[str, Any] | None:
    now = now if now is not None else _now_ms()
    with _lock:
        incident = _incidents.get(incident_id)
        if incident is None:
            return None
        _incidents[incident_id] = apply_update(incident, changes, now)
        return dict(_incidents[incident_id])


def set_staffing(region: str, officers_on_duty: int) -> bool:
    if region not in REGIONS:
        return False
    with _lock:
        _staffing[region] = officers_on_duty
    return True


def get_feed() -> dict[str, Any]:
    with _lock:
        return {
            "regions": list(REGIONS),
            "staffing": [{"region": r, "officers_on_duty": _staffing[r]} for r in REGIONS],
            "incidents": [dict(i) for i in _incidents.values()],
        }


def reset() -> None:
    """Clear all incidents and staffing. Used by tests."""
    global _incident_id_counter
    with _lock:
        _incidents.clear()
        _staffing.update({region: 0 for region in REGIONS})
        _incident_id_counter = itertools.count(1)
