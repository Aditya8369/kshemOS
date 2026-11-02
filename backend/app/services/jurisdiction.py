"""
Jurisdiction and Zone Configuration Service for KshemOS.

Defines:
- Jurisdiction and service area records
- Dispatch boundaries and assignment rules
- High-impact validation & multi-officer review workflows
- Historical configuration snapshots with full audit trails & rollback capability
"""
from __future__ import annotations

import copy
import itertools
import threading
import time
from typing import Any

from app.services import incidents as incident_service

_lock = threading.RLock()
_version_counter = itertools.count(1)
_proposal_counter = itertools.count(101)

# In-memory stores
_jurisdictions: dict[str, dict[str, Any]] = {}
_service_areas: dict[str, dict[str, Any]] = {}
_dispatch_rules: dict[str, dict[str, Any]] = {}
_change_proposals: dict[str, dict[str, Any]] = {}
_snapshots: list[dict[str, Any]] = []


def _now_ms() -> int:
    return int(time.time() * 1000)


# ---------- Seed Default Jurisdictions, Zones & Rules ----------

DEFAULT_JURISDICTIONS = [
    {
        "id": "JUR-DELHI-METRO",
        "name": "Delhi Metropolitan Cyber Command",
        "code": "DL-CYBER",
        "status": "active",
        "headquarters": "Central Zone Police HQ, Barakhamba Road",
        "contact_officer": "OFF-DIR-01",
        "region_scope": ["Central Zone", "North Zone", "East Zone"],
        "description": "Primary metropolitan cyber public safety and fraud response jurisdiction.",
        "created_at": 1700000000000,
        "updated_at": 1700000000000,
        "version": 1,
    },
    {
        "id": "JUR-NCR-SOUTH",
        "name": "NCR Cyber Security & Financial Corridor Command",
        "code": "NCR-FIN-CYBER",
        "status": "active",
        "headquarters": "Cyber Park Police Complex, Sector 29",
        "contact_officer": "OFF-CMD-SOUTH",
        "region_scope": ["South Zone", "West Zone"],
        "description": "Specialized high-density financial fraud, ATM security, and fintech fraud response.",
        "created_at": 1700000000000,
        "updated_at": 1700000000000,
        "version": 1,
    },
]

DEFAULT_SERVICE_AREAS = [
    {
        "id": "SA-CENTRAL-01",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "name": "Central Secretariat & Government Cyber Desk",
        "region": "Central Zone",
        "primary_station": "Central Cyber Cell",
        "boundary_type": "circle",
        "center_lat": 28.6139,
        "center_lng": 77.2090,
        "radius_km": 4.5,
        "polygon_coordinates": None,
        "authorized_units": ["OFF-C1", "OFF-C2", "UNIT-CENTRAL-ALPHA"],
        "capacity_limit_points": 30,
        "risk_level": "high",
        "status": "active",
        "version": 1,
        "updated_at": 1700000000000,
    },
    {
        "id": "SA-NORTH-01",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "name": "North University & Transit Sector",
        "region": "North Zone",
        "primary_station": "North District Cyber Station",
        "boundary_type": "circle",
        "center_lat": 28.6800,
        "center_lng": 77.2100,
        "radius_km": 5.0,
        "polygon_coordinates": None,
        "authorized_units": ["OFF-N1", "OFF-N2", "UNIT-NORTH-PATROL"],
        "capacity_limit_points": 24,
        "risk_level": "moderate",
        "status": "active",
        "version": 1,
        "updated_at": 1700000000000,
    },
    {
        "id": "SA-SOUTH-01",
        "jurisdiction_id": "JUR-NCR-SOUTH",
        "name": "South Cyber Hub & Financial Corridor",
        "region": "South Zone",
        "primary_station": "South Tech Police Division",
        "boundary_type": "circle",
        "center_lat": 28.5300,
        "center_lng": 77.2200,
        "radius_km": 6.5,
        "polygon_coordinates": None,
        "authorized_units": ["OFF-S1", "OFF-S2", "UNIT-SOUTH-PATROL", "CYBER-SPECIAL"],
        "capacity_limit_points": 36,
        "risk_level": "critical",
        "status": "active",
        "version": 1,
        "updated_at": 1700000000000,
    },
    {
        "id": "SA-EAST-01",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "name": "East Trans-Yamuna Safety Sector",
        "region": "East Zone",
        "primary_station": "East Precinct Cyber Unit",
        "boundary_type": "circle",
        "center_lat": 28.6200,
        "center_lng": 77.3000,
        "radius_km": 5.5,
        "polygon_coordinates": None,
        "authorized_units": ["OFF-E1", "OFF-E2"],
        "capacity_limit_points": 20,
        "risk_level": "moderate",
        "status": "active",
        "version": 1,
        "updated_at": 1700000000000,
    },
    {
        "id": "SA-WEST-01",
        "jurisdiction_id": "JUR-NCR-SOUTH",
        "name": "West Commercial & Industrial Division",
        "region": "West Zone",
        "primary_station": "West District Cyber Desk",
        "boundary_type": "circle",
        "center_lat": 28.6300,
        "center_lng": 77.1100,
        "radius_km": 5.0,
        "polygon_coordinates": None,
        "authorized_units": ["OFF-W1", "OFF-W2"],
        "capacity_limit_points": 24,
        "risk_level": "high",
        "status": "active",
        "version": 1,
        "updated_at": 1700000000000,
    },
]

DEFAULT_DISPATCH_RULES = [
    {
        "id": "DISP-RULE-DIGITAL-ARREST",
        "name": "Critical Digital Arrest Priority Dispatch",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "service_area_id": "SA-CENTRAL-01",
        "categories": ["scam_call"],
        "min_severity": "critical",
        "target_desk": "OFF-SPEC-DIGITAL-ARREST",
        "overflow_service_area_id": "SA-SOUTH-01",
        "priority": 1,
        "enabled": True,
        "updated_at": 1700000000000,
    },
    {
        "id": "DISP-RULE-FIN-FRAUD-SOUTH",
        "name": "South Zone Financial Scam & UPI Overflow Dispatch",
        "jurisdiction_id": "JUR-NCR-SOUTH",
        "service_area_id": "SA-SOUTH-01",
        "categories": ["fraud_tx"],
        "min_severity": "high",
        "target_desk": "OFF-S1",
        "overflow_service_area_id": "SA-WEST-01",
        "priority": 2,
        "enabled": True,
        "updated_at": 1700000000000,
    },
    {
        "id": "DISP-RULE-GENERAL-NORTH",
        "name": "North Sector General Cyber Intake",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "service_area_id": "SA-NORTH-01",
        "categories": ["*"],
        "min_severity": "low",
        "target_desk": "OFF-N1",
        "overflow_service_area_id": "SA-CENTRAL-01",
        "priority": 3,
        "enabled": True,
        "updated_at": 1700000000000,
    },
    {
        "id": "DISP-RULE-CURRENCY-WEST",
        "name": "West Sector Counterfeit Currency & Field Operations",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "service_area_id": "SA-WEST-01",
        "categories": ["fake_currency", "counterfeit_currency"],
        "min_severity": "medium",
        "target_desk": "OFF-W1",
        "overflow_service_area_id": "SA-CENTRAL-01",
        "priority": 4,
        "enabled": True,
        "updated_at": 1700000000000,
    },
]


def init_defaults():
    with _lock:
        if not _jurisdictions:
            for j in DEFAULT_JURISDICTIONS:
                _jurisdictions[j["id"]] = copy.deepcopy(j)
        if not _service_areas:
            for sa in DEFAULT_SERVICE_AREAS:
                _service_areas[sa["id"]] = copy.deepcopy(sa)
        if not _dispatch_rules:
            for dr in DEFAULT_DISPATCH_RULES:
                _dispatch_rules[dr["id"]] = copy.deepcopy(dr)
        if not _snapshots:
            _take_snapshot_internal(
                author="SYSTEM_INITIALIZER",
                summary="Initial baseline jurisdiction and service area configuration",
                impact_level="standard",
            )


# ---------- Snapshot Engine ----------

def _take_snapshot_internal(author: str, summary: str, impact_level: str) -> dict[str, Any]:
    v = next(_version_counter)
    now = _now_ms()
    snap_id = f"SNAP-{time.strftime('%Y%m%d', time.gmtime(now / 1000))}-v{v:03d}"

    snapshot = {
        "snapshot_id": snap_id,
        "version": v,
        "timestamp": now,
        "author": author,
        "change_summary": summary,
        "impact_level": impact_level,
        "jurisdictions": copy.deepcopy(list(_jurisdictions.values())),
        "service_areas": copy.deepcopy(list(_service_areas.values())),
        "dispatch_rules": copy.deepcopy(list(_dispatch_rules.values())),
    }
    _snapshots.append(snapshot)
    if len(_snapshots) > 100:
        del _snapshots[:-100]
    return snapshot


def list_snapshots() -> list[dict[str, Any]]:
    with _lock:
        # Return summary of snapshots, newest first
        res = [
            {
                "snapshot_id": s["snapshot_id"],
                "version": s["version"],
                "timestamp": s["timestamp"],
                "author": s["author"],
                "change_summary": s["change_summary"],
                "impact_level": s["impact_level"],
                "jurisdiction_count": len(s["jurisdictions"]),
                "service_area_count": len(s["service_areas"]),
                "dispatch_rule_count": len(s["dispatch_rules"]),
            }
            for s in _snapshots
        ]
        res.sort(key=lambda s: s["version"], reverse=True)
        return res


def get_snapshot(snapshot_id: str) -> dict[str, Any] | None:
    with _lock:
        for s in _snapshots:
            if s["snapshot_id"] == snapshot_id:
                return copy.deepcopy(s)
        return None


def restore_snapshot(snapshot_id: str, restored_by: str) -> dict[str, Any] | None:
    with _lock:
        target = None
        for s in _snapshots:
            if s["snapshot_id"] == snapshot_id:
                target = s
                break

        if not target:
            return None

        # Restore collections
        _jurisdictions.clear()
        for j in target["jurisdictions"]:
            _jurisdictions[j["id"]] = copy.deepcopy(j)

        _service_areas.clear()
        for sa in target["service_areas"]:
            _service_areas[sa["id"]] = copy.deepcopy(sa)

        _dispatch_rules.clear()
        for dr in target["dispatch_rules"]:
            _dispatch_rules[dr["id"]] = copy.deepcopy(dr)

        # Record restoration snapshot
        new_snap = _take_snapshot_internal(
            author=restored_by,
            summary=f"Rolled back configuration to snapshot {snapshot_id} (v{target['version']})",
            impact_level="high",
        )
        return new_snap


def diff_snapshots(snap_id_a: str, snap_id_b: str) -> dict[str, Any] | None:
    with _lock:
        snap_a = get_snapshot(snap_id_a)
        snap_b = get_snapshot(snap_id_b)

        if not snap_a or not snap_b:
            return None

        # Compare service areas
        sa_a_ids = {sa["id"]: sa for sa in snap_a["service_areas"]}
        sa_b_ids = {sa["id"]: sa for sa in snap_b["service_areas"]}

        added_sa = [sa_b_ids[i] for i in sa_b_ids if i not in sa_a_ids]
        removed_sa = [sa_a_ids[i] for i in sa_a_ids if i not in sa_b_ids]
        modified_sa = []
        for i in sa_a_ids:
            if i in sa_b_ids and sa_a_ids[i] != sa_b_ids[i]:
                modified_sa.append({"id": i, "before": sa_a_ids[i], "after": sa_b_ids[i]})

        # Compare dispatch rules
        dr_a_ids = {dr["id"]: dr for dr in snap_a["dispatch_rules"]}
        dr_b_ids = {dr["id"]: dr for dr in snap_b["dispatch_rules"]}

        added_dr = [dr_b_ids[i] for i in dr_b_ids if i not in dr_a_ids]
        removed_dr = [dr_a_ids[i] for i in dr_a_ids if i not in dr_b_ids]

        return {
            "snapshot_a": snap_id_a,
            "snapshot_b": snap_id_b,
            "service_areas": {
                "added": added_sa,
                "removed": removed_sa,
                "modified": modified_sa,
            },
            "dispatch_rules": {
                "added": added_dr,
                "removed": removed_dr,
            },
        }


# ---------- Validation & Impact Analysis ----------

def validate_service_area_update(
    existing: dict[str, Any] | None,
    proposed: dict[str, Any],
) -> dict[str, Any]:
    """Validate boundary changes and determine whether change is high-impact."""
    warnings: list[str] = []
    impact_level = "standard"
    requires_review = False
    affected_active_incidents = 0
    coverage_gap_detected = False
    overlap_conflicts: list[str] = []

    target_region = proposed.get("region") or (existing.get("region") if existing else "")

    # Query active incidents in this region
    feed = incident_service.get_feed()
    active_in_region = [
        i for i in feed.get("incidents", [])
        if i.get("region") == target_region and i.get("status") != "resolved"
    ]
    affected_active_incidents = len(active_in_region)

    # 1. Check if deactivating an active service area with open cases
    if existing and existing.get("status") == "active" and proposed.get("status") in ("inactive", "maintenance"):
        if affected_active_incidents > 0:
            warnings.append(
                f"Deactivating service area in {target_region} impacts {affected_active_incidents} active incident(s)."
            )
            impact_level = "high"
            requires_review = True

    # 2. Check radius reduction (>25% shrink)
    if existing and existing.get("radius_km") and proposed.get("radius_km"):
        old_r = float(existing["radius_km"])
        new_r = float(proposed["radius_km"])
        if new_r < old_r * 0.75:
            warnings.append(
                f"Boundary radius shrunk by >25% (from {old_r}km to {new_r}km). Potential perimeter coverage gap."
            )
            coverage_gap_detected = True
            impact_level = "high"
            requires_review = True

    # 3. Check capacity points reduction below active load
    new_capacity = proposed.get("capacity_limit_points")
    if new_capacity is not None and new_capacity < 12 and affected_active_incidents > 3:
        warnings.append(
            f"Capacity limit reduced to {new_capacity} points while region carries {affected_active_incidents} active cases."
        )
        impact_level = "high"
        requires_review = True

    # 4. Check coordinate presence
    if proposed.get("boundary_type") == "circle":
        if proposed.get("center_lat") is None or proposed.get("center_lng") is None or proposed.get("radius_km") is None:
            return {
                "is_valid": False,
                "impact_level": impact_level,
                "warnings": ["Center coordinates and radius_km are required for circular boundary."],
                "affected_active_incidents": affected_active_incidents,
                "coverage_gap_detected": False,
                "overlap_conflicts": [],
                "requires_review": False,
            }

    # 5. Overlap detection with other service areas in different jurisdictions
    for sa_id, sa in _service_areas.items():
        if existing and sa_id == existing.get("id"):
            continue
        if sa.get("region") == target_region and sa.get("jurisdiction_id") != proposed.get("jurisdiction_id"):
            conflict_msg = f"Potential jurisdictional conflict with {sa['name']} ({sa_id}) in {target_region}."
            overlap_conflicts.append(conflict_msg)
            warnings.append(conflict_msg)
            impact_level = "high"
            requires_review = True

    return {
        "is_valid": True,
        "impact_level": impact_level,
        "warnings": warnings,
        "affected_active_incidents": affected_active_incidents,
        "coverage_gap_detected": coverage_gap_detected,
        "overlap_conflicts": overlap_conflicts,
        "requires_review": requires_review,
    }


# ---------- Jurisdictions CRUD ----------

def list_jurisdictions() -> list[dict[str, Any]]:
    with _lock:
        return [copy.deepcopy(j) for j in _jurisdictions.values()]


def get_jurisdiction(jurisdiction_id: str) -> dict[str, Any] | None:
    with _lock:
        j = _jurisdictions.get(jurisdiction_id)
        return copy.deepcopy(j) if j else None


def create_jurisdiction(data: dict[str, Any], author: str = "OFFICER") -> dict[str, Any]:
    with _lock:
        now = _now_ms()
        j_id = data.get("id") or f"JUR-{len(_jurisdictions) + 1:02d}"
        jur = dict(data)
        jur["id"] = j_id
        jur["created_at"] = now
        jur["updated_at"] = now
        jur["version"] = 1
        _jurisdictions[j_id] = jur

        _take_snapshot_internal(
            author=author,
            summary=f"Created jurisdiction {jur.get('name', j_id)}",
            impact_level="standard",
        )
        return copy.deepcopy(jur)


def update_jurisdiction(jurisdiction_id: str, updates: dict[str, Any], author: str = "OFFICER") -> dict[str, Any] | None:
    with _lock:
        j = _jurisdictions.get(jurisdiction_id)
        if not j:
            return None
        j.update({k: v for k, v in updates.items() if v is not None})
        j["updated_at"] = _now_ms()
        j["version"] = j.get("version", 1) + 1

        _take_snapshot_internal(
            author=author,
            summary=f"Updated jurisdiction {j.get('name', jurisdiction_id)} (v{j['version']})",
            impact_level="standard",
        )
        return copy.deepcopy(j)


# ---------- Service Areas CRUD & Change Review ----------

def list_service_areas() -> list[dict[str, Any]]:
    with _lock:
        return [copy.deepcopy(sa) for sa in _service_areas.values()]


def get_service_area(service_area_id: str) -> dict[str, Any] | None:
    with _lock:
        sa = _service_areas.get(service_area_id)
        return copy.deepcopy(sa) if sa else None


def save_service_area(
    data: dict[str, Any],
    author: str = "OFFICER",
    force_apply: bool = False,
) -> dict[str, Any]:
    """Save service area. If high-impact and not force_applied, creates a ChangeProposal."""
    with _lock:
        sa_id = data.get("id")
        existing = _service_areas.get(sa_id) if sa_id else None

        validation = validate_service_area_update(existing, data)

        if not validation["is_valid"]:
            return {"error": validation["warnings"][0], "validation": validation}

        # If high-impact and requires review, create proposal
        if validation["requires_review"] and not force_apply:
            prop_id = f"PROP-{next(_proposal_counter)}"
            now = _now_ms()
            proposal = {
                "id": prop_id,
                "entity_type": "service_area",
                "entity_id": sa_id or "NEW_SERVICE_AREA",
                "proposed_by": author,
                "change_summary": f"Service area boundary/status modification for {data.get('name', sa_id)}",
                "impact_level": "high",
                "status": "pending",
                "validation": validation,
                "proposed_payload": copy.deepcopy(data),
                "original_payload": copy.deepcopy(existing) if existing else None,
                "created_at": now,
                "reviewed_by": None,
                "reviewed_at": None,
                "reviewer_notes": None,
            }
            _change_proposals[prop_id] = proposal
            return {
                "requires_review": True,
                "proposal_id": prop_id,
                "validation": validation,
                "message": "High-impact boundary change detected. Proposal staged for commanding officer review.",
            }

        # Direct apply
        now = _now_ms()
        new_id = sa_id or f"SA-{len(_service_areas) + 1:02d}"
        sa = dict(data)
        sa["id"] = new_id
        sa["updated_at"] = now
        sa["version"] = (existing.get("version", 0) + 1) if existing else 1
        _service_areas[new_id] = sa

        _take_snapshot_internal(
            author=author,
            summary=f"Saved service area {sa.get('name', new_id)} (v{sa['version']})",
            impact_level=validation["impact_level"],
        )
        return {
            "requires_review": False,
            "service_area": copy.deepcopy(sa),
            "validation": validation,
        }


# ---------- Dispatch Rules CRUD ----------

def list_dispatch_rules() -> list[dict[str, Any]]:
    with _lock:
        res = list(_dispatch_rules.values())
        res.sort(key=lambda r: r.get("priority", 999))
        return [copy.deepcopy(r) for r in res]


def save_dispatch_rule(data: dict[str, Any], author: str = "OFFICER") -> dict[str, Any]:
    with _lock:
        r_id = data.get("id") or f"DISP-{len(_dispatch_rules) + 1:02d}"
        rule = dict(data)
        rule["id"] = r_id
        rule["updated_at"] = _now_ms()
        _dispatch_rules[r_id] = rule

        _take_snapshot_internal(
            author=author,
            summary=f"Saved dispatch rule {rule.get('name', r_id)}",
            impact_level="standard",
        )
        return copy.deepcopy(rule)


def delete_dispatch_rule(rule_id: str) -> bool:
    with _lock:
        if rule_id in _dispatch_rules:
            del _dispatch_rules[rule_id]
            _take_snapshot_internal(
                author="OFFICER",
                summary=f"Deleted dispatch rule {rule_id}",
                impact_level="standard",
            )
            return True
        return False


# ---------- Change Proposal & Review Workflow ----------

def list_change_proposals(status: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        res = list(_change_proposals.values())
        if status:
            res = [p for p in res if p.get("status") == status]
        res.sort(key=lambda p: p.get("created_at", 0), reverse=True)
        return [copy.deepcopy(p) for p in res]


def review_change_proposal(
    proposal_id: str,
    reviewer_code: str,
    decision: str,
    reviewer_notes: str,
) -> dict[str, Any] | None:
    with _lock:
        prop = _change_proposals.get(proposal_id)
        if not prop:
            return None

        now = _now_ms()
        prop["status"] = decision
        prop["reviewed_by"] = reviewer_code
        prop["reviewed_at"] = now
        prop["reviewer_notes"] = reviewer_notes

        applied_entity = None
        if decision == "approved":
            # Apply approved change
            payload = prop["proposed_payload"]
            entity_type = prop["entity_type"]

            if entity_type == "service_area":
                sa_id = payload.get("id") or prop["entity_id"]
                existing = _service_areas.get(sa_id)
                sa = dict(payload)
                sa["id"] = sa_id
                sa["updated_at"] = now
                sa["version"] = (existing.get("version", 0) + 1) if existing else 1
                _service_areas[sa_id] = sa
                applied_entity = copy.deepcopy(sa)

                _take_snapshot_internal(
                    author=f"{reviewer_code} (Approved {prop['proposed_by']})",
                    summary=f"Approved high-impact change: {prop['change_summary']}",
                    impact_level="high",
                )

        return {
            "proposal": copy.deepcopy(prop),
            "applied_entity": applied_entity,
        }


# ---------- Dispatch Evaluator Helper ----------

def match_dispatch_rule(category: str, severity: str, region: str) -> dict[str, Any] | None:
    """Find matching dispatch rule and target desk for an incoming incident."""
    sev_rank = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    incident_rank = sev_rank.get(severity, 0)

    rules = list_dispatch_rules()
    for rule in rules:
        if not rule.get("enabled", True):
            continue

        # Check category match
        cats = rule.get("categories", [])
        if "*" not in cats and category not in cats:
            continue

        # Check severity threshold
        min_sev = rule.get("min_severity", "low")
        if incident_rank < sev_rank.get(min_sev, 0):
            continue

        # Check if service area matches this region
        sa = get_service_area(rule.get("service_area_id", ""))
        if sa and sa.get("region") != region:
            continue

        return rule
    return None


def reset():
    """Reset service for clean test execution."""
    with _lock:
        _jurisdictions.clear()
        _service_areas.clear()
        _dispatch_rules.clear()
        _change_proposals.clear()
        _snapshots.clear()
        init_defaults()


# Initialize on import
init_defaults()
