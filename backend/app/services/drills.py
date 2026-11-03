"""Backend engine for isolated, scenario-based command drills.

Drills use their own in-memory state and never create or mutate live incidents.
The store follows the current prototype convention used by other backend
services; it can be replaced with persistent storage without changing the API.
"""
from __future__ import annotations

import copy
import itertools
import threading
import time
from typing import Any


class DrillError(Exception):
    """Base exception for expected drill-domain errors."""


class DrillNotFoundError(DrillError):
    """Raised when a drill or scenario does not exist."""


class DrillConflictError(DrillError):
    """Raised when an operation is invalid for the drill's current state."""


class DrillValidationError(DrillError):
    """Raised when a drill-domain value is invalid."""


# The action names below are deliberately stored only in the service. The API
# exposes objective descriptions and weights, not the expected answers, so a
# participant cannot read the scoring key before making decisions.
_SCENARIOS: dict[str, dict[str, Any]] = {
    "coordinated-digital-arrest": {
        "id": "coordinated-digital-arrest",
        "name": "Coordinated Digital Arrest Response",
        "description": (
            "A multi-team exercise involving an impersonation campaign, an "
            "at-risk financial transfer, and evidence preservation."
        ),
        "teams": ["Dispatch", "Cyber Cell", "Field Response"],
        "resources": {
            "Dispatch": {"call_handlers": 2, "response_units": 2},
            "Cyber Cell": {"investigators": 3, "forensic_kits": 2},
            "Field Response": {"response_units": 4, "medical_teams": 1},
        },
        "events": [
            {
                "id": "DA-001",
                "title": "Suspicious authority-impersonation call reported",
                "description": (
                    "A citizen reports a video call from people claiming to be "
                    "law-enforcement officers and demanding secrecy."
                ),
                "severity": "high",
            },
            {
                "id": "DA-002",
                "title": "Additional victims report the same operation",
                "description": (
                    "Two more reports contain matching caller details and a "
                    "request to transfer funds to a verification account."
                ),
                "severity": "critical",
            },
            {
                "id": "DA-003",
                "title": "A transfer is reported as pending",
                "description": (
                    "A bank contact reports that a victim's high-value transfer "
                    "may still be pending and relevant call evidence is available."
                ),
                "severity": "critical",
            },
        ],
        "objectives": [
            {
                "id": "verify-authority",
                "title": "Independently verify the claimed authority",
                "description": "Use an independently sourced official contact channel before treating the caller as legitimate.",
                "weight": 25,
                "accepted_actions": ["independent_verification", "verify_official_identity"],
            },
            {
                "id": "protect-funds",
                "title": "Coordinate financial harm prevention",
                "description": "Escalate through the appropriate bank or financial-response channel to attempt to stop the transfer.",
                "weight": 30,
                "accepted_actions": ["contact_bank", "request_transaction_hold", "freeze_transaction"],
            },
            {
                "id": "preserve-evidence",
                "title": "Preserve relevant evidence",
                "description": "Secure call details, messages, transaction references, and original evidence with traceability.",
                "weight": 20,
                "accepted_actions": ["preserve_evidence", "collect_evidence", "secure_call_records"],
            },
            {
                "id": "coordinate-teams",
                "title": "Coordinate a cross-team response",
                "description": "Assign the appropriate operational teams and communicate a shared response plan.",
                "weight": 25,
                "accepted_actions": ["assign_response_team", "coordinate_teams", "establish_command_channel"],
            },
        ],
    },
    "multi-region-fraud-ring": {
        "id": "multi-region-fraud-ring",
        "name": "Multi-Region Fraud Ring Response",
        "description": (
            "A cross-jurisdiction exercise involving linked reports, limited "
            "investigative capacity, and coordinated resource deployment."
        ),
        "teams": ["Central Command", "Financial Intelligence", "North Unit", "South Unit"],
        "resources": {
            "Central Command": {"command_officers": 2},
            "Financial Intelligence": {"analysts": 3, "forensic_kits": 1},
            "North Unit": {"field_units": 3, "investigators": 1},
            "South Unit": {"field_units": 2, "investigators": 2},
        },
        "events": [
            {
                "id": "FR-001",
                "title": "Linked suspicious accounts detected",
                "description": "Several reports reference accounts sharing phone and device signals.",
                "severity": "high",
            },
            {
                "id": "FR-002",
                "title": "Activity spans two operational regions",
                "description": "New reports connect the suspected network to activity in both North and South regions.",
                "severity": "critical",
            },
            {
                "id": "FR-003",
                "title": "Investigative capacity becomes constrained",
                "description": "Both regional units request additional analytical support while preserving local coverage.",
                "severity": "high",
            },
        ],
        "objectives": [
            {
                "id": "correlate-reports",
                "title": "Correlate related reports and entities",
                "description": "Validate shared indicators and establish the scope of the suspected network.",
                "weight": 25,
                "accepted_actions": ["correlate_entities", "validate_shared_indicators", "map_linked_reports"],
            },
            {
                "id": "notify-jurisdictions",
                "title": "Notify affected jurisdictions",
                "description": "Share verified information with the relevant command and regional contacts.",
                "weight": 25,
                "accepted_actions": ["notify_jurisdictions", "share_intelligence", "open_joint_coordination"],
            },
            {
                "id": "allocate-resources",
                "title": "Allocate resources based on operational need",
                "description": "Move available analytical or field resources without exceeding team capacity.",
                "weight": 25,
                "accepted_actions": ["rebalance_resources", "allocate_units", "deploy_analysts"],
            },
            {
                "id": "preserve-chain",
                "title": "Preserve investigative traceability",
                "description": "Record decisions and retain the source and handling history of relevant evidence.",
                "weight": 25,
                "accepted_actions": ["preserve_evidence", "record_chain_of_custody", "document_decisions"],
            },
        ],
    },
}

_lock = threading.RLock()
_drill_id_counter = itertools.count(1)
_drills: dict[str, dict[str, Any]] = {}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _public_scenario(scenario: dict[str, Any]) -> dict[str, Any]:
    """Return scenario metadata without exposing its scoring answer key."""
    return {
        "id": scenario["id"],
        "name": scenario["name"],
        "description": scenario["description"],
        "teams": copy.deepcopy(scenario["teams"]),
        "initial_resources": copy.deepcopy(scenario["resources"]),
        "event_count": len(scenario["events"]),
        "objectives": [
            {
                "id": objective["id"],
                "title": objective["title"],
                "description": objective["description"],
                "weight": objective["weight"],
            }
            for objective in scenario["objectives"]
        ],
    }


def list_scenarios() -> list[dict[str, Any]]:
    """List available drill templates without revealing expected actions."""
    return [_public_scenario(scenario) for scenario in _SCENARIOS.values()]


def _public_drill(drill: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(drill)
    result.pop("event_script", None)
    result.pop("next_event_index", None)
    for objective in result["objectives"]:
        objective.pop("accepted_actions", None)
    result["total_events"] = len(drill["event_script"])
    result["events_remaining"] = len(drill["event_script"]) - drill["next_event_index"]
    result["score"] = sum(
        objective["weight"] for objective in drill["objectives"] if objective["completed"]
    )
    result["max_score"] = sum(objective["weight"] for objective in drill["objectives"])
    return result


def _get_drill_or_raise(drill_id: str) -> dict[str, Any]:
    drill = _drills.get(drill_id)
    if drill is None:
        raise DrillNotFoundError(f"Drill {drill_id} not found")
    return drill


def _ensure_active(drill: dict[str, Any]) -> None:
    if drill["status"] != "active":
        raise DrillConflictError("This operation is only available while the drill is active")


def create_drill(scenario_id: str, name: str | None = None, now: int | None = None) -> dict[str, Any]:
    """Create an isolated drill session from a predefined scenario."""
    scenario_id = scenario_id.strip()
    scenario = _SCENARIOS.get(scenario_id)
    if scenario is None:
        raise DrillNotFoundError(f"Scenario {scenario_id} not found")

    if name is not None:
        name = name.strip()
        if len(name) < 3:
            raise DrillValidationError("Drill name must contain at least 3 non-whitespace characters")

    timestamp = now if now is not None else _now_ms()
    with _lock:
        drill_id = f"DRL-{next(_drill_id_counter):04d}"
        drill = {
            "id": drill_id,
            "scenario_id": scenario_id,
            "scenario_name": scenario["name"],
            "name": (name or scenario["name"]).strip(),
            "description": scenario["description"],
            "status": "active",
            "teams": copy.deepcopy(scenario["teams"]),
            "resources": copy.deepcopy(scenario["resources"]),
            "objectives": [
                {
                    **copy.deepcopy(objective),
                    "completed": False,
                    "completed_at": None,
                    "completed_by_decision_id": None,
                }
                for objective in scenario["objectives"]
            ],
            "event_script": copy.deepcopy(scenario["events"]),
            "next_event_index": 0,
            "current_event": None,
            "event_history": [],
            "decisions": [],
            "resource_movements": [],
            "timeline": [
                {
                    "sequence": 1,
                    "type": "drill_started",
                    "timestamp": timestamp,
                    "summary": f"Drill '{(name or scenario['name']).strip()}' started",
                }
            ],
            "started_at": timestamp,
            "completed_at": None,
        }
        _drills[drill_id] = drill
        return _public_drill(drill)


def list_drills() -> list[dict[str, Any]]:
    with _lock:
        return [_public_drill(drill) for drill in reversed(list(_drills.values()))]


def get_drill(drill_id: str) -> dict[str, Any]:
    with _lock:
        return _public_drill(_get_drill_or_raise(drill_id))


def advance_drill(drill_id: str, now: int | None = None) -> dict[str, Any]:
    """Inject the next scripted event into a running simulation."""
    timestamp = now if now is not None else _now_ms()
    with _lock:
        drill = _get_drill_or_raise(drill_id)
        _ensure_active(drill)
        index = drill["next_event_index"]
        if index >= len(drill["event_script"]):
            raise DrillConflictError("All scenario events have already been released")

        event = {
            **copy.deepcopy(drill["event_script"][index]),
            "sequence": index + 1,
            "triggered_at": timestamp,
        }
        drill["next_event_index"] += 1
        drill["current_event"] = event
        drill["event_history"].append(event)
        drill["timeline"].append(
            {
                "sequence": len(drill["timeline"]) + 1,
                "type": "event_released",
                "timestamp": timestamp,
                "summary": f"Scenario event released: {event['title']}",
                "event_id": event["id"],
            }
        )
        return _public_drill(drill)


def record_decision(
    drill_id: str,
    *,
    team: str,
    objective_id: str,
    action: str,
    notes: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    """Record a team decision and evaluate it against one drill objective."""
    timestamp = now if now is not None else _now_ms()
    with _lock:
        drill = _get_drill_or_raise(drill_id)
        _ensure_active(drill)
        if team not in drill["teams"]:
            raise DrillValidationError(f"Unknown team '{team}' for this drill")

        objective = next((item for item in drill["objectives"] if item["id"] == objective_id), None)
        if objective is None:
            raise DrillValidationError(f"Unknown objective '{objective_id}' for this drill")

        normalized_action = action.strip().lower()
        if not normalized_action:
            raise DrillValidationError("Decision action cannot be blank")
        objective_met = normalized_action in objective["accepted_actions"]
        decision_id = f"{drill_id}-DEC-{len(drill['decisions']) + 1:04d}"
        decision = {
            "id": decision_id,
            "team": team,
            "objective_id": objective_id,
            "action": normalized_action,
            "notes": notes.strip() if notes else None,
            "objective_met": objective_met,
            "timestamp": timestamp,
        }
        drill["decisions"].append(decision)

        if objective_met and not objective["completed"]:
            objective["completed"] = True
            objective["completed_at"] = timestamp
            objective["completed_by_decision_id"] = decision_id

        drill["timeline"].append(
            {
                "sequence": len(drill["timeline"]) + 1,
                "type": "decision_recorded",
                "timestamp": timestamp,
                "summary": f"{team} recorded action '{normalized_action}'",
                "decision_id": decision_id,
            }
        )
        return _public_drill(drill)


def move_resources(
    drill_id: str,
    *,
    resource_type: str,
    quantity: int,
    from_team: str,
    to_team: str,
    now: int | None = None,
) -> dict[str, Any]:
    """Transfer available simulated resources between participating teams."""
    timestamp = now if now is not None else _now_ms()
    with _lock:
        drill = _get_drill_or_raise(drill_id)
        _ensure_active(drill)

        resource_type = resource_type.strip()
        from_team = from_team.strip()
        to_team = to_team.strip()
        if not resource_type:
            raise DrillValidationError("Resource type cannot be blank")
        if from_team not in drill["teams"] or to_team not in drill["teams"]:
            raise DrillValidationError("Both source and destination must be participating teams")
        if from_team == to_team:
            raise DrillValidationError("Source and destination teams must be different")
        if quantity <= 0:
            raise DrillValidationError("Resource quantity must be greater than zero")

        source_resources = drill["resources"].setdefault(from_team, {})
        destination_resources = drill["resources"].setdefault(to_team, {})
        available = source_resources.get(resource_type, 0)
        if available < quantity:
            raise DrillConflictError(
                f"Insufficient {resource_type} at {from_team}: {available} available, {quantity} requested"
            )

        source_resources[resource_type] = available - quantity
        destination_resources[resource_type] = destination_resources.get(resource_type, 0) + quantity
        movement_id = f"{drill_id}-MOV-{len(drill['resource_movements']) + 1:04d}"
        movement = {
            "id": movement_id,
            "resource_type": resource_type,
            "quantity": quantity,
            "from_team": from_team,
            "to_team": to_team,
            "timestamp": timestamp,
        }
        drill["resource_movements"].append(movement)
        drill["timeline"].append(
            {
                "sequence": len(drill["timeline"]) + 1,
                "type": "resource_moved",
                "timestamp": timestamp,
                "summary": f"Moved {quantity} {resource_type} from {from_team} to {to_team}",
                "movement_id": movement_id,
            }
        )
        return _public_drill(drill)


def complete_drill(drill_id: str, now: int | None = None) -> dict[str, Any]:
    timestamp = now if now is not None else _now_ms()
    with _lock:
        drill = _get_drill_or_raise(drill_id)
        _ensure_active(drill)
        drill["status"] = "completed"
        drill["completed_at"] = timestamp
        drill["timeline"].append(
            {
                "sequence": len(drill["timeline"]) + 1,
                "type": "drill_completed",
                "timestamp": timestamp,
                "summary": "Drill completed",
            }
        )
        return _public_drill(drill)


def get_after_action_report(drill_id: str) -> dict[str, Any]:
    """Build a deterministic after-action report for a completed drill."""
    with _lock:
        drill = _get_drill_or_raise(drill_id)
        if drill["status"] != "completed":
            raise DrillConflictError("Complete the drill before requesting its after-action report")

        objectives = [
            {
                "id": item["id"],
                "title": item["title"],
                "weight": item["weight"],
                "completed": item["completed"],
                "completed_at": item["completed_at"],
                "completed_by_decision_id": item["completed_by_decision_id"],
            }
            for item in drill["objectives"]
        ]
        score = sum(item["weight"] for item in objectives if item["completed"])
        max_score = sum(item["weight"] for item in objectives)
        completed_objectives = sum(1 for item in objectives if item["completed"])

        return {
            "drill_id": drill["id"],
            "scenario_id": drill["scenario_id"],
            "name": drill["name"],
            "status": drill["status"],
            "started_at": drill["started_at"],
            "completed_at": drill["completed_at"],
            "score": score,
            "max_score": max_score,
            "objective_completion_rate": round((completed_objectives / len(objectives)) * 100, 2) if objectives else 0,
            "objectives_completed": completed_objectives,
            "objectives_total": len(objectives),
            "events_released": len(drill["event_history"]),
            "decisions_recorded": len(drill["decisions"]),
            "resource_movements_recorded": len(drill["resource_movements"]),
            "objectives": objectives,
            "event_history": copy.deepcopy(drill["event_history"]),
            "decisions": copy.deepcopy(drill["decisions"]),
            "resource_movements": copy.deepcopy(drill["resource_movements"]),
            "final_resource_balances": copy.deepcopy(drill["resources"]),
            "timeline": copy.deepcopy(drill["timeline"]),
        }


def reset() -> None:
    """Clear drill sessions and reset IDs. Intended for isolated tests."""
    global _drill_id_counter
    with _lock:
        _drills.clear()
        _drill_id_counter = itertools.count(1)
