"""
Jurisdiction and Zone Configuration Service for KshemOS.

Defines:
- Jurisdiction and service area records
- Dispatch boundaries and assignment rules
- High-impact validation & multi-officer review workflows
- Historical configuration snapshots with full audit trails & rollback capability
"""
from __future__ import annotations

import base64
import copy
import hashlib
import io
import itertools
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget

from app.services import incidents as incident_service

_lock = threading.RLock()
_version_counter = itertools.count(1)
_proposal_counter = itertools.count(101)
_zero_fir_counter = itertools.count(1001)
_requisition_counter = itertools.count(5001)

# In-memory stores
_jurisdictions: dict[str, dict[str, Any]] = {}
_service_areas: dict[str, dict[str, Any]] = {}
_dispatch_rules: dict[str, dict[str, Any]] = {}
_change_proposals: dict[str, dict[str, Any]] = {}
_snapshots: list[dict[str, Any]] = []

# Automated Inter-State Cybercrime Zero-FIR & Mutual Aid stores
_zero_fir_dossiers: dict[str, dict[str, Any]] = {}
_zero_fir_pdf_store: dict[str, bytes] = {}
_interstate_requisitions: dict[str, dict[str, Any]] = {}
_interstate_pdf_store: dict[str, bytes] = {}


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


# =============================================================================
# AUTOMATED INTER-STATE CYBERCRIME ZERO-FIR & SPATIAL JURISDICTION ENGINE
# [Section 173 BNSS, 2023 & Sections 78/79 Information Technology Act, 2000]
# =============================================================================

STATE_NODAL_CYBER_POLICE_STATIONS: dict[str, dict[str, Any]] = {
    "Delhi": {
        "station_name": "Special Cell Cyber Crime Police Station (IFSO), New Delhi",
        "state": "Delhi",
        "nodal_officer": "DCP (IFSO / Cyber Crime Unit)",
        "email": "cybercell-specialcell@delhipolice.gov.in",
        "phone": "+91-11-20892633",
        "address": "Special Cell Cyber Crime PS, Sector 17, Dwarka, New Delhi - 110078",
        "court_jurisdiction": "Chief Metropolitan Magistrate, Patiala House Courts, New Delhi",
        "station_code": "DL-IFSO-01",
    },
    "Haryana": {
        "station_name": "State Cyber Crime Police Station, Sector 23, Panchkula / Gurugram",
        "state": "Haryana",
        "nodal_officer": "Superintendent of Police (Cyber Crime State Branch)",
        "email": "cybercrime-hry@nic.in",
        "phone": "+91-172-2587522",
        "address": "State Crime Branch, Police Complex, Sector 23, Panchkula, Haryana - 134109",
        "court_jurisdiction": "Special Judicial Magistrate (Cyber), Gurugram / Panchkula",
        "station_code": "HR-CYBER-01",
    },
    "Gujarat": {
        "station_name": "State Cyber Crime Cell, CID Crime, Gandhinagar",
        "state": "Gujarat",
        "nodal_officer": "DIGP (CID Crime & Cyber Branch)",
        "email": "cc-cid@gujarat.gov.in",
        "phone": "+91-79-23254385",
        "address": "CID Crime Headquarters, Police Bhavan, Sector 18, Gandhinagar - 382018",
        "court_jurisdiction": "Chief Judicial Magistrate, Ahmedabad / Gandhinagar",
        "station_code": "GJ-CID-CYBER",
    },
    "Maharashtra": {
        "station_name": "Maharashtra State Cyber Security Headquarters, Mumbai",
        "state": "Maharashtra",
        "nodal_officer": "Special Inspector General of Police (Cyber)",
        "email": "ig.cyber-mah@gov.in",
        "phone": "+91-22-22160080",
        "address": "32nd Floor, Centre-1, World Trade Centre, Cuffe Parade, Mumbai - 400005",
        "court_jurisdiction": "Additional Chief Metropolitan Magistrate (37th Court), Esplanade, Mumbai",
        "station_code": "MH-CYBER-HQ",
    },
    "Karnataka": {
        "station_name": "Cyber Economic and Narcotics (CEN) Police Station, CID Bengaluru",
        "state": "Karnataka",
        "nodal_officer": "Superintendent of Police (Cyber Crime CID)",
        "email": "sp-cyber-cid@ksp.gov.in",
        "phone": "+91-80-22094498",
        "address": "CID Annex Building, Carlton House, Palace Road, Bengaluru - 560001",
        "court_jurisdiction": "1st Additional Chief Metropolitan Magistrate Court, Bengaluru",
        "station_code": "KA-CEN-CID",
    },
    "Telangana": {
        "station_name": "Telangana State Cyber Security Bureau (TSCSB), Hyderabad",
        "state": "Telangana",
        "nodal_officer": "Director, TSCSB / Inspector General of Police",
        "email": "director-tscsb@tspolice.gov.in",
        "phone": "+91-40-27852333",
        "address": "TSCSB Headquarters, DGP Office Complex, Lakdikapool, Hyderabad - 500004",
        "court_jurisdiction": "Chief Metropolitan Magistrate, Nampally Criminal Courts, Hyderabad",
        "station_code": "TS-CSB-01",
    },
    "West Bengal": {
        "station_name": "Cyber Crime Police Station, CID West Bengal, Kolkata",
        "state": "West Bengal",
        "nodal_officer": "Special Superintendent of Police (Cyber CID)",
        "email": "wbcybercrime@cidwestbengal.gov.in",
        "phone": "+91-33-24506100",
        "address": "Bhabani Bhaban, Alipore, Kolkata - 700027",
        "court_jurisdiction": "Chief Judicial Magistrate, Alipore Court, Kolkata",
        "station_code": "WB-CID-CYBER",
    },
    "Jharkhand": {
        "station_name": "State Cyber Crime Police Station, CID Ranchi",
        "state": "Jharkhand",
        "nodal_officer": "Superintendent of Police (Cyber Crime)",
        "email": "cyberps@jhpolice.gov.in",
        "phone": "+91-651-2490046",
        "address": "Cyber Crime PS, Doranda, Ranchi, Jharkhand - 834002",
        "court_jurisdiction": "Special Judicial Magistrate (Cyber Crime), Ranchi",
        "station_code": "JH-CYBER-01",
    },
    "Rajasthan": {
        "station_name": "State Cyber Crime Police Station, Jaipur",
        "state": "Rajasthan",
        "nodal_officer": "Superintendent of Police (Cyber Crime Branch)",
        "email": "ccps-raj@gov.in",
        "phone": "+91-141-2601955",
        "address": "Cyber Crime Police Station, Ghat Gate, Jaipur, Rajasthan - 302003",
        "court_jurisdiction": "Chief Judicial Magistrate, Metropolitan Court, Jaipur",
        "station_code": "RJ-CYBER-01",
    },
    "Uttar Pradesh": {
        "station_name": "State Cyber Crime Police Station, Lucknow",
        "state": "Uttar Pradesh",
        "nodal_officer": "Superintendent of Police (Cyber Crime Hqrs)",
        "email": "sp-cyber.lu@up.gov.in",
        "phone": "+91-522-2287253",
        "address": "Cyber Crime Police Station, Vibhuti Khand, Gomti Nagar, Lucknow - 226010",
        "court_jurisdiction": "Special Judicial Magistrate (CBI/Cyber), Lucknow",
        "station_code": "UP-CYBER-LKO",
    },
}

# Bank IFSC prefix to Parent Bank and Branch State resolution map
IFSC_BRANCH_STATE_MAP: dict[str, tuple[str, str, str]] = {
    "SBIN": ("State Bank of India", "Delhi", "New Delhi Main Branch"),
    "HDFC": ("HDFC Bank", "Maharashtra", "Kanjurmarg / Fort Branch, Mumbai"),
    "ICIC": ("ICICI Bank", "Gujarat", "Gandhinagar Financial Center"),
    "UTIB": ("Axis Bank", "Karnataka", "MG Road Branch, Bengaluru"),
    "PUNB": ("Punjab National Bank", "Haryana", "Sector 14 Branch, Gurugram"),
    "BARB": ("Bank of Baroda", "Gujarat", "Alkapuri Branch, Vadodara"),
    "CNRB": ("Canara Bank", "Karnataka", "Town Hall Branch, Bengaluru"),
    "UBIN": ("Union Bank of India", "Maharashtra", "Nariman Point Branch, Mumbai"),
    "IDIB": ("Indian Bank", "Tamil Nadu", "Rajaji Salai Branch, Chennai"),
    "KKBK": ("Kotak Mahindra Bank", "Maharashtra", "BKC Branch, Mumbai"),
    "YESB": ("Yes Bank", "Maharashtra", "Indiabulls Finance Centre, Mumbai"),
    "INDB": ("IndusInd Bank", "Maharashtra", "Opera House Branch, Mumbai"),
}

TELECOM_CIRCLE_STATE_MAP: dict[str, str] = {
    "Delhi": "Delhi",
    "NCR": "Delhi",
    "Haryana": "Haryana",
    "Punjab": "Punjab",
    "Gujarat": "Gujarat",
    "Maharashtra": "Maharashtra",
    "Mumbai": "Maharashtra",
    "Karnataka": "Karnataka",
    "Telangana": "Telangana",
    "Andhra Pradesh": "Telangana",
    "West Bengal": "West Bengal",
    "Kolkata": "West Bengal",
    "Jharkhand": "Jharkhand",
    "Bihar": "Jharkhand",
    "Rajasthan": "Rajasthan",
    "Uttar Pradesh": "Uttar Pradesh",
    "UP East": "Uttar Pradesh",
    "UP West": "Uttar Pradesh",
}


def _get_nodal_station(state_name: str) -> dict[str, Any]:
    """Retrieve verified State Nodal Cyber Station, defaulting to Delhi IFSO if unlisted."""
    for s_key, s_data in STATE_NODAL_CYBER_POLICE_STATIONS.items():
        if s_key.lower() in state_name.lower() or state_name.lower() in s_key.lower():
            return copy.deepcopy(s_data)
    # Default fallback
    return copy.deepcopy(STATE_NODAL_CYBER_POLICE_STATIONS["Delhi"])


def resolve_spatial_jurisdiction(data: dict[str, Any]) -> dict[str, Any]:
    """
    Spatial Jurisdiction Resolver:
    Resolves multi-state cybercrime jurisdictions based on:
    1. Victim location (where the citizen was defrauded / reports).
    2. Beneficiary bank branch IFSC (where mule accounts hold the looted funds).
    3. Suspect cell tower / calling origin coordinates (where the syndicate operates).
    """
    v_loc = data.get("victim_location") or {}
    victim_state = v_loc.get("state") or "Delhi"
    beneficiary_ifsc = (data.get("beneficiary_ifsc") or "SBIN0001234").upper().strip()

    # Resolve Beneficiary Bank State
    ifsc_prefix = beneficiary_ifsc[:4]
    bank_info = IFSC_BRANCH_STATE_MAP.get(ifsc_prefix, ("Scheduled Commercial Bank", "Maharashtra", "Central Clearing Branch"))
    bank_name, beneficiary_state, branch_name = bank_info

    # If specific IFSC override is provided
    if "GJ" in beneficiary_ifsc or "GUJ" in beneficiary_ifsc:
        beneficiary_state = "Gujarat"
    elif "DL" in beneficiary_ifsc or "DEL" in beneficiary_ifsc:
        beneficiary_state = "Delhi"
    elif "HR" in beneficiary_ifsc:
        beneficiary_state = "Haryana"

    # Resolve Suspect Telecom State
    suspect_tower = data.get("suspect_cell_tower")
    suspect_state = None
    if suspect_tower:
        circle = suspect_tower.get("telecom_circle") or ""
        suspect_state = suspect_tower.get("state") or TELECOM_CIRCLE_STATE_MAP.get(circle, "Haryana")

    victim_station = _get_nodal_station(victim_state)
    beneficiary_station = _get_nodal_station(beneficiary_state)
    suspect_station = _get_nodal_station(suspect_state) if suspect_state else None

    # Determine Cross-Border Status
    is_cross_border = (
        victim_station["state"].lower() != beneficiary_station["state"].lower()
        or (suspect_station and victim_station["state"].lower() != suspect_station["state"].lower())
    )

    # Recipient station for Zero-FIR transfer:
    # Priority is given to beneficiary bank jurisdiction where resting balances are held for Section 106 BNSS freeze
    target_transfer_station = beneficiary_station if is_cross_border else victim_station

    conflict_status = (
        "INTER_STATE_CROSS_JURISDICTION_DETECTED"
        if is_cross_border
        else "INTRA_STATE_LOCAL_JURISDICTION"
    )

    statutory_mandate = (
        "Under Section 173 of the Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023, every police station "
        "is legally obligated to register a Zero-FIR irrespective of territorial jurisdiction or locus delicti. "
        "Inter-state investigation and asset freeze orders are coordinated under Section 106 BNSS read with "
        "Sections 78 & 79 of the Information Technology Act, 2000."
    )

    recommended_action = (
        f"1. Instantly register Zero-FIR at {victim_station['station_name']}.\n"
        f"2. Serve Section 106 BNSS / 102 CrPC immediate freeze requisition on {bank_name} ({beneficiary_ifsc}).\n"
        f"3. Issue Section 78/79 IT Act Mutual Aid Requisition to {target_transfer_station['station_name']} for local mule apprehension."
    )

    return {
        "is_cross_border_interstate": is_cross_border,
        "victim_reporting_jurisdiction": victim_station,
        "beneficiary_bank_jurisdiction": beneficiary_station,
        "suspect_telecom_jurisdiction": suspect_station,
        "target_transfer_jurisdiction": target_transfer_station,
        "jurisdictional_conflict_status": conflict_status,
        "statutory_mandate": statutory_mandate,
        "recommended_action": recommended_action,
    }


def _build_zero_fir_pdf_bytes(dossier_data: dict[str, Any]) -> bytes:
    """Generate official Section 173 BNSS Zero-FIR vector PDF using ReportLab."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    header_title_style = ParagraphStyle(
        "ZeroFirHeader",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        alignment=1,  # Center
        textColor=colors.HexColor("#0f172a"),
    )
    header_sub_style = ParagraphStyle(
        "ZeroFirSubHeader",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#b91c1c"),  # Crimson
    )
    section_title_style = ParagraphStyle(
        "ZeroFirSection",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#1e3a8a"),  # Deep Navy
        spaceBefore=6,
        spaceAfter=2,
    )
    body_style = ParagraphStyle(
        "ZeroFirBody",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1f2937"),
    )
    bold_label_style = ParagraphStyle(
        "ZeroFirLabel",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#111827"),
    )
    mono_style = ParagraphStyle(
        "ZeroFirMono",
        fontName="Courier",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#111827"),
    )
    legal_italic_style = ParagraphStyle(
        "ZeroFirLegal",
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#4b5563"),
        alignment=1,
    )

    story = []

    # 1. State Police & Statutory Header
    origin_station = dossier_data.get("originating_police_station", {})
    transferred_station = dossier_data.get("transferred_to_police_station", {})

    story.append(Paragraph("POLICE DEPARTMENT - STATE CYBER CRIME INVESTIGATION DIVISION", header_title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph(origin_station.get("station_name", "Cyber Crime Police Station"), header_title_style))
    story.append(Spacer(1, 3))
    story.append(
        Paragraph("FORM 1: ZERO FIRST INFORMATION REPORT (ZERO-FIR)", header_sub_style)
    )
    story.append(
        Paragraph("[Mandatory Registration under Section 173, Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023]", legal_italic_style)
    )
    story.append(
        Paragraph("(To be transmitted to Jurisdictional Police Station without territorial locus delicti bar)", legal_italic_style)
    )
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#b91c1c"), spaceAfter=6))

    # 2. Metadata Grid Table
    meta_table_data = [
        [
            Paragraph("Zero-FIR Number:", bold_label_style),
            Paragraph(f"<b>{dossier_data.get('zero_fir_number')}</b>", mono_style),
            Paragraph("Registration Date & Time (IST):", bold_label_style),
            Paragraph(dossier_data.get("registration_timestamp_ist", ""), body_style),
        ],
        [
            Paragraph("Originating Station:", bold_label_style),
            Paragraph(origin_station.get("station_code", "DL-CYBER"), body_style),
            Paragraph("Transferred Police Station:", bold_label_style),
            Paragraph(f"<b>{transferred_station.get('station_name', '')}</b>", body_style),
        ],
        [
            Paragraph("Offense Classifications:", bold_label_style),
            Paragraph(", ".join(dossier_data.get("sections_invoked", [])), bold_label_style),
            Paragraph("Designated Investigating Officer:", bold_label_style),
            Paragraph(f"{dossier_data.get('reporting_officer_name')} ({dossier_data.get('reporting_officer_rank')})", body_style),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[110, 160, 120, 150])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6))

    # 3. Complainant / Informant Details
    story.append(Paragraph("1. COMPLAINANT / INFORMANT PARTICULARS", section_title_style))
    victim_loc = dossier_data.get("victim_location", {})
    comp_data = [
        [
            Paragraph("Complainant Name:", bold_label_style),
            Paragraph(dossier_data.get("victim_name", "Redacted"), body_style),
            Paragraph("Contact Phone:", bold_label_style),
            Paragraph(dossier_data.get("victim_phone", "•••• ••••"), mono_style),
        ],
        [
            Paragraph("Complainant Address:", bold_label_style),
            Paragraph(f"{victim_loc.get('address', '')}, {victim_loc.get('city', '')}, {victim_loc.get('state', '')} - {victim_loc.get('pincode', '')}", body_style),
            Paragraph("Jurisdictional Circle:", bold_label_style),
            Paragraph(origin_station.get("court_jurisdiction", ""), body_style),
        ],
    ]
    comp_table = Table(comp_data, colWidths=[110, 160, 120, 150])
    comp_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 6))

    # 4. Complaint Narrative / Statement
    story.append(Paragraph("2. SUBSTANCE OF INFORMATION / OCCURRENCE NARRATIVE", section_title_style))
    narrative_text = dossier_data.get("complaint_narrative", "Cyber fraud incident reported.")
    story.append(Paragraph(narrative_text, body_style))
    story.append(Spacer(1, 6))

    # 5. Financial Transaction & Money-Trail Audit Log Table
    story.append(Paragraph("3. FINANCIAL TRANSACTIONS & UTR MONEY-TRAIL AUDIT LOG", section_title_style))
    tx_headers = [
        Paragraph("<b>UTR / Ref No.</b>", bold_label_style),
        Paragraph("<b>Timestamp (IST)</b>", bold_label_style),
        Paragraph("<b>Amount (INR)</b>", bold_label_style),
        Paragraph("<b>Beneficiary IFSC</b>", bold_label_style),
        Paragraph("<b>Beneficiary A/C No.</b>", bold_label_style),
        Paragraph("<b>Target Bank</b>", bold_label_style),
    ]
    tx_rows = [tx_headers]
    for tx in dossier_data.get("financial_transactions", []):
        tx_rows.append([
            Paragraph(tx.get("utr_number", "N/A"), mono_style),
            Paragraph(tx.get("timestamp_ist", "N/A"), body_style),
            Paragraph(f"₹ {tx.get('amount_inr', 0):,.2f}", bold_label_style),
            Paragraph(tx.get("beneficiary_ifsc", "N/A"), mono_style),
            Paragraph(tx.get("beneficiary_account", "N/A"), mono_style),
            Paragraph(tx.get("beneficiary_bank_name", "Indian Bank"), body_style),
        ])
    if len(tx_rows) == 1:
        tx_rows.append([Paragraph("No financial UTRs submitted.", body_style)] * 6)

    tx_table = Table(tx_rows, colWidths=[95, 85, 80, 80, 95, 105])
    tx_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    story.append(tx_table)
    story.append(Spacer(1, 6))

    # 6. Digital Evidence Hashes Table (Section 63 BSA Compliance)
    story.append(Paragraph("4. DIGITAL EVIDENCE LEDGER [SECTION 63 BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023]", section_title_style))
    ev_headers = [
        Paragraph("<b>Item ID</b>", bold_label_style),
        Paragraph("<b>Evidence Type & File Name</b>", bold_label_style),
        Paragraph("<b>SHA-256 Genesis Hash (Section 63 BSA)</b>", bold_label_style),
        Paragraph("<b>File Size</b>", bold_label_style),
        Paragraph("<b>Integrity Status</b>", bold_label_style),
    ]
    ev_rows = [ev_headers]
    for ev in dossier_data.get("digital_evidence_hashes", []):
        ev_rows.append([
            Paragraph(ev.get("item_id", "EV-01"), mono_style),
            Paragraph(f"{ev.get('evidence_type')}: {ev.get('file_name')}", body_style),
            Paragraph(ev.get("sha256_hash", "0" * 64), mono_style),
            Paragraph(f"{ev.get('file_size_bytes', 0):,} B", body_style),
            Paragraph(ev.get("verification_status", "VERIFIED"), bold_label_style),
        ])
    if len(ev_rows) == 1:
        ev_rows.append([Paragraph("No digital evidence files attached.", body_style)] * 5)

    ev_table = Table(ev_rows, colWidths=[55, 130, 220, 65, 70])
    ev_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(ev_table)
    story.append(Spacer(1, 6))

    # 7. Suspect Telecom, Cell Tower & IP Cyber Intelligence
    story.append(Paragraph("5. SUSPECT TELECOM & CYBER INFRASTRUCTURE ATTRIBUTION", section_title_style))
    suspect_phones = ", ".join(dossier_data.get("suspect_phone_numbers", [])) or "Identified via Call Records"
    suspect_ips = ", ".join(dossier_data.get("suspect_ip_addresses", [])) or "Under IPDR Preservation"
    suspect_twr = dossier_data.get("suspect_cell_tower") or {}
    twr_desc = (
        f"{suspect_twr.get('telecom_circle', 'State Circle')} - District: {suspect_twr.get('district', 'Nuh/Mewat')} (Lat/Lng: {suspect_twr.get('lat', 'N/A')}, {suspect_twr.get('lng', 'N/A')})"
        if suspect_twr else "Under Cellular Triangulation"
    )

    intel_data = [
        [Paragraph("Suspect Phone Numbers:", bold_label_style), Paragraph(suspect_phones, mono_style)],
        [Paragraph("Cell Tower Origin:", bold_label_style), Paragraph(twr_desc, body_style)],
        [Paragraph("Suspect IP / VPN:", bold_label_style), Paragraph(suspect_ips, mono_style)],
    ]
    intel_table = Table(intel_data, colWidths=[130, 410])
    intel_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(intel_table)
    story.append(Spacer(1, 6))

    # 8. Statutory Inter-State Transfer Endorsement & Signature Box
    endorsement_text = (
        f"<b>TRANSFER ENDORSEMENT UNDER SECTION 173(1) BNSS:</b> This Zero-FIR is hereby registered at "
        f"{origin_station.get('station_name')}. In accordance with Section 173(1) of the Bharatiya Nagarik "
        f"Suraksha Sanhita (BNSS), 2023, the original information, digital evidence hashes, and case files "
        f"are hereby transferred to <b>{transferred_station.get('station_name')} ({transferred_station.get('state')})</b> "
        f"for regular registration, territorial investigation, and physical asset recovery."
    )
    story.append(Paragraph(endorsement_text, body_style))
    story.append(Spacer(1, 8))

    # QR Code & IO Seal block
    qr_drawing = Drawing(70, 70)
    qr_payload = f"0-FIR:{dossier_data.get('zero_fir_number')}|SEAL:{dossier_data.get('sha256_dossier_seal')[:16]}|STATION:{origin_station.get('station_code')}|DATE:{dossier_data.get('registration_timestamp_ist')}"
    qr_widget = QrCodeWidget(qr_payload)
    qr_widget.barWidth = 70
    qr_widget.barHeight = 70
    qr_drawing.add(qr_widget)

    sign_data = [
        [
            qr_drawing,
            Paragraph(
                f"<b>Digitally Sealed & Registered by:</b><br/>"
                f"<b>{dossier_data.get('reporting_officer_name')}</b><br/>"
                f"{dossier_data.get('reporting_officer_rank')}<br/>"
                f"Badge ID: {dossier_data.get('reporting_officer_badge')}<br/>"
                f"{origin_station.get('station_name')}<br/>"
                f"SHA-256 Digest: <font name='Courier' size='6'>{dossier_data.get('sha256_dossier_seal')}</font>",
                body_style,
            ),
        ]
    ]
    sign_table = Table(sign_data, colWidths=[80, 460])
    sign_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#1e3a8a")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sign_table)

    doc.build(story)
    return buf.getvalue()


def compile_zero_fir_dossier(data: dict[str, Any]) -> dict[str, Any]:
    """
    Zero-FIR Dossier Compiler:
    Generates an official Section 173 BNSS Zero-FIR dossier PDF containing:
    1. Victim complaint narrative
    2. Digital evidence hashes (Section 63 BSA compliant)
    3. UTR transaction audit logs
    4. Suspect telecom & IP coordinates
    5. Inter-state transfer endorsement
    """
    with _lock:
        seq = next(_zero_fir_counter)
        origin_code = data.get("originating_station_code") or "DL-IFSO-01"
        zero_fir_num = f"0-FIR/2026/{origin_code}/{seq:05d}"
        now_dt = datetime.now(timezone.utc)
        ist_timestamp = now_dt.strftime("%Y-%m-%d %H:%M:%S IST")

        # Resolve spatial jurisdiction
        spatial = resolve_spatial_jurisdiction(data)
        origin_station = spatial["victim_reporting_jurisdiction"]
        target_override = data.get("target_state_override")
        if target_override and target_override in STATE_NODAL_CYBER_POLICE_STATIONS:
            target_station = STATE_NODAL_CYBER_POLICE_STATIONS[target_override]
        else:
            target_station = spatial["target_transfer_jurisdiction"]

        # Calculate Total Disputed Amount
        transactions = data.get("financial_transactions") or []
        total_amount = sum(float(tx.get("amount_inr", 0)) for tx in transactions)

        # Offense sections
        sections = data.get("bns_sections", ["Section 318(4) BNS", "Section 319(2) BNS", "Section 336(3) BNS"])
        it_sections = data.get("it_act_sections", ["Section 66C IT Act", "Section 66D IT Act", "Section 78 IT Act"])
        all_sections = sorted(list(set(sections + it_sections)))

        # DPDP name redaction
        victim_name = data.get("victim_name", "Protected Citizen")
        victim_name_redacted = victim_name[0] + "•" * (len(victim_name) - 2) + victim_name[-1] if len(victim_name) > 2 else "Complainant"

        # Canonical SHA-256 seal computation
        canonical_raw = f"{zero_fir_num}|{ist_timestamp}|{victim_name}|{total_amount:.2f}|{origin_code}|{target_station.get('station_code')}"
        sha256_seal = hashlib.sha256(canonical_raw.encode("utf-8")).hexdigest()

        dossier_record = {
            "zero_fir_number": zero_fir_num,
            "registration_timestamp_ist": ist_timestamp,
            "statutory_citation": "Section 173 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023",
            "originating_police_station": origin_station,
            "transferred_to_police_station": target_station,
            "victim_name": victim_name,
            "victim_name_redacted": victim_name_redacted,
            "victim_phone": data.get("victim_phone", ""),
            "victim_email": data.get("victim_email"),
            "victim_location": data.get("victim_location") or {},
            "complaint_narrative": data.get("complaint_narrative", ""),
            "total_disputed_amount_inr": total_amount,
            "sections_invoked": all_sections,
            "financial_transactions": transactions,
            "digital_evidence_hashes": data.get("digital_evidence_hashes") or [],
            "evidence_count": len(data.get("digital_evidence_hashes") or []),
            "suspect_phone_numbers": data.get("suspect_phone_numbers") or [],
            "suspect_cell_tower": data.get("suspect_cell_tower"),
            "suspect_ip_addresses": data.get("suspect_ip_addresses") or [],
            "reporting_officer_badge": data.get("reporting_officer_badge", "IO-CYBER-88"),
            "reporting_officer_name": data.get("reporting_officer_name", "Inspector Rajesh Kumar"),
            "reporting_officer_rank": data.get("reporting_officer_rank", "Inspector of Police"),
            "sha256_dossier_seal": sha256_seal,
            "status": "REGISTERED_PENDING_TRANSFER",
        }

        # Build PDF
        pdf_bytes = _build_zero_fir_pdf_bytes(dossier_record)
        _zero_fir_pdf_store[zero_fir_num] = pdf_bytes
        _zero_fir_dossiers[zero_fir_num] = dossier_record

        pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

        return {
            "zero_fir_number": zero_fir_num,
            "registration_timestamp_ist": ist_timestamp,
            "statutory_citation": "Section 173 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023",
            "originating_police_station": origin_station,
            "transferred_to_police_station": target_station,
            "victim_name_redacted": victim_name_redacted,
            "total_disputed_amount_inr": total_amount,
            "sections_invoked": all_sections,
            "evidence_count": len(dossier_record["digital_evidence_hashes"]),
            "sha256_dossier_seal": sha256_seal,
            "pdf_base64": pdf_b64,
            "pdf_download_url": f"/api/jurisdiction/zero-fir/{zero_fir_num}/pdf",
            "status": "REGISTERED_PENDING_TRANSFER",
        }


def _build_interstate_requisition_pdf_bytes(req_data: dict[str, Any]) -> bytes:
    """Generate official Section 78/79 IT Act Mutual Aid Requisition PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        "ReqHeader",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        alignment=1,
        textColor=colors.HexColor("#0f172a"),
    )
    sub_style = ParagraphStyle(
        "ReqSub",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#1e3a8a"),
    )
    body_style = ParagraphStyle(
        "ReqBody",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1f2937"),
    )
    bold_style = ParagraphStyle(
        "ReqBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#111827"),
    )
    mono_style = ParagraphStyle(
        "ReqMono",
        fontName="Courier",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#111827"),
    )

    story = []
    orig = req_data.get("originating_station", {})
    target = req_data.get("target_nodal_station", {})

    story.append(Paragraph("CYBER CRIME POLICE INVESTIGATION BRANCH", header_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("FORM OF INTER-STATE MUTUAL INVESTIGATIVE ASSISTANCE REQUISITION", sub_style))
    story.append(
        Paragraph("[Under Section 78 & 79 Information Technology Act, 2000 read with Section 94 & 106 BNSS, 2023]", ParagraphStyle("SubItal", fontName="Helvetica-Oblique", fontSize=7, leading=9, alignment=1, textColor=colors.HexColor("#4b5563")))
    )
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1e3a8a"), spaceAfter=8))

    # Requisition Metadata
    meta_rows = [
        [
            Paragraph("Requisition Ref ID:", bold_style),
            Paragraph(f"<b>{req_data.get('requisition_id')}</b>", mono_style),
            Paragraph("Zero-FIR Reference:", bold_style),
            Paragraph(f"<b>{req_data.get('zero_fir_number')}</b>", mono_style),
        ],
        [
            Paragraph("Dispatch Date & Time:", bold_style),
            Paragraph(req_data.get("dispatched_timestamp_ist", ""), body_style),
            Paragraph("Urgency Classification:", bold_style),
            Paragraph(f"<b><font color='#b91c1c'>{req_data.get('urgency_level')}</font></b>", bold_style),
        ],
        [
            Paragraph("From (Originating Agency):", bold_style),
            Paragraph(f"{req_data.get('investigating_officer_name')} ({req_data.get('investigating_officer_rank')})<br/>{orig.get('station_name')}", body_style),
            Paragraph("To (Recipient Agency):", bold_style),
            Paragraph(f"<b>{target.get('nodal_officer')}</b><br/>{target.get('station_name')}<br/>{target.get('address')}", body_style),
        ],
    ]
    t = Table(meta_rows, colWidths=[120, 150, 110, 160])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # Statutory Requisition Narrative
    story.append(Paragraph("<b>MANDATE FOR INTER-STATE COOPERATION:</b>", bold_style))
    p1 = (
        "Whereas an offense punishable under Section 318(4) & 319(2) BNS, 2023 and Section 66C & 66D IT Act, 2000 "
        "has been committed against a resident of this jurisdiction, and the proceeds of crime have been traced to "
        "financial and telecommunication infrastructure situated within your territorial jurisdiction. Under Section 78 "
        "of the Information Technology Act, 2000, the undersigned Investigating Officer requests your immediate statutory "
        "inter-state assistance in executing the following actions:"
    )
    story.append(Paragraph(p1, body_style))
    story.append(Spacer(1, 6))

    # Required Actions Checklist
    story.append(Paragraph("<b>REQUIRED ACTIONS REQUESTED:</b>", bold_style))
    for idx, act in enumerate(req_data.get("required_actions", []), 1):
        story.append(Paragraph(f"<b>[{idx}]</b> {act}", body_style))
    story.append(Spacer(1, 6))

    # Target Entities Table
    story.append(Paragraph("<b>TARGET INTER-STATE ENTITIES TO BE SERVED:</b>", bold_style))
    target_data = [
        [Paragraph("Beneficiary Account(s):", bold_style), Paragraph(", ".join(req_data.get("beneficiary_accounts", [])) or "Specified in Zero-FIR", mono_style)],
        [Paragraph("Beneficiary Branch IFSC:", bold_style), Paragraph(req_data.get("beneficiary_ifsc", "N/A"), mono_style)],
        [Paragraph("Suspect Contact Numbers:", bold_style), Paragraph(", ".join(req_data.get("suspect_numbers", [])) or "Identified via CDR Dump", mono_style)],
    ]
    tt = Table(target_data, colWidths=[150, 390])
    tt.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    story.append(tt)
    story.append(Spacer(1, 10))

    # Signoff Block
    sign_text = (
        f"<b>Dispatched under Official Seal by:</b><br/>"
        f"<b>{req_data.get('investigating_officer_name')}</b> ({req_data.get('investigating_officer_rank')})<br/>"
        f"Badge ID: {req_data.get('investigating_officer_badge')}<br/>"
        f"Transmission Token: <font name='Courier'>{req_data.get('transmission_token')}</font><br/>"
        f"SHA-256 Digest: <font name='Courier' size='6'>{req_data.get('sha256_requisition_seal')}</font>"
    )
    story.append(Paragraph(sign_text, body_style))

    doc.build(story)
    return buf.getvalue()


def generate_interstate_mutual_aid_requisition(data: dict[str, Any]) -> dict[str, Any]:
    """
    Pre-fill and dispatch Section 78/79 IT Act Mutual Assistance Forms
    to the designated State Nodal Cyber Police Station of the recipient state.
    """
    with _lock:
        seq = next(_requisition_counter)
        req_id = f"REQ-IT78-79/2026/{seq:05d}"
        now_dt = datetime.now(timezone.utc)
        ist_timestamp = now_dt.strftime("%Y-%m-%d %H:%M:%S IST")

        orig_code = data.get("originating_station_code") or "DL-IFSO-01"
        origin_station = _get_nodal_station("Delhi")
        target_state = data.get("target_state") or "Maharashtra"
        target_station = _get_nodal_station(target_state)

        zero_fir_num = data.get("zero_fir_number") or f"0-FIR/2026/{orig_code}/99999"
        transmission_token = f"TOKEN-MUTUAL-{hashlib.sha256(f'{req_id}:{ist_timestamp}'.encode()).hexdigest()[:12].upper()}"

        canonical_str = f"{req_id}|{zero_fir_num}|{target_state}|{transmission_token}|{ist_timestamp}"
        sha256_seal = hashlib.sha256(canonical_str.encode()).hexdigest()

        req_record = {
            "requisition_id": req_id,
            "zero_fir_number": zero_fir_num,
            "statutory_reference": "Section 78 & 79 Information Technology Act, 2000 read with Section 94 & 106 BNSS, 2023",
            "originating_station": origin_station,
            "target_nodal_station": target_station,
            "dispatched_timestamp_ist": ist_timestamp,
            "urgency_level": data.get("urgency_level", "IMMEDIATE_ASSET_FLIGHT_RISK"),
            "investigating_officer_name": data.get("investigating_officer_name", "Inspector Rajesh Kumar"),
            "investigating_officer_badge": data.get("investigating_officer_badge", "IO-CYBER-88"),
            "investigating_officer_rank": data.get("investigating_officer_rank", "Inspector of Police"),
            "required_actions": data.get("required_actions", [
                "Freeze beneficiary mule accounts under Section 106 BNSS / Section 102 CrPC",
                "Requisition bank KYC & branch CCTV footage under Section 94 BNSS",
                "Requisition CDR & subscriber identity data from local telecom provider under Section 79 IT Act",
                "Physical verification and search of suspect mule operator premises",
            ]),
            "beneficiary_accounts": data.get("beneficiary_accounts", []),
            "beneficiary_ifsc": data.get("beneficiary_ifsc"),
            "suspect_numbers": data.get("suspect_numbers", []),
            "transmission_token": transmission_token,
            "sha256_requisition_seal": sha256_seal,
            "status": "DISPATCHED_TO_NODAL_CYBER_DESK",
        }

        pdf_bytes = _build_interstate_requisition_pdf_bytes(req_record)
        _interstate_pdf_store[req_id] = pdf_bytes
        _interstate_requisitions[req_id] = req_record

        pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

        return {
            "requisition_id": req_id,
            "zero_fir_number": zero_fir_num,
            "statutory_reference": "Section 78 & 79 Information Technology Act, 2000 read with Section 94 & 106 BNSS, 2023",
            "originating_station": origin_station,
            "target_nodal_station": target_station,
            "dispatched_timestamp_ist": ist_timestamp,
            "urgency_level": req_record["urgency_level"],
            "transmission_token": transmission_token,
            "sha256_requisition_seal": sha256_seal,
            "pdf_base64": pdf_b64,
            "pdf_download_url": f"/api/jurisdiction/mutual-aid/requisition/{req_id}/pdf",
            "status": "DISPATCHED_TO_NODAL_CYBER_DESK",
        }


def get_zero_fir_pdf(zero_fir_number: str) -> bytes | None:
    """Retrieve raw PDF bytes for a generated Section 173 BNSS Zero-FIR dossier."""
    with _lock:
        return _zero_fir_pdf_store.get(zero_fir_number)


def get_interstate_requisition_pdf(requisition_id: str) -> bytes | None:
    """Retrieve raw PDF bytes for an Inter-State Mutual Aid Requisition."""
    with _lock:
        return _interstate_pdf_store.get(requisition_id)


def list_state_nodal_directory() -> list[dict[str, Any]]:
    """Return verified directory of all Indian State Nodal Cyber Police Stations."""
    with _lock:
        return [copy.deepcopy(st) for st in STATE_NODAL_CYBER_POLICE_STATIONS.values()]


def reset():
    """Reset service for clean test execution."""
    with _lock:
        _jurisdictions.clear()
        _service_areas.clear()
        _dispatch_rules.clear()
        _change_proposals.clear()
        _snapshots.clear()
        _zero_fir_dossiers.clear()
        _zero_fir_pdf_store.clear()
        _interstate_requisitions.clear()
        _interstate_pdf_store.clear()
        init_defaults()


# Initialize on import
init_defaults()
