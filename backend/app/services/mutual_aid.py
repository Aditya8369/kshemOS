"""
Cross-Jurisdiction Mutual Aid & Dynamic Resource Rebalancing Service for KshemOS.

Features:
- Mutual Aid Declarations: Automated triggers when an operational sector's workload exceeds 150%
  of its capacity points, allowing commanders to request cross-zone reinforcement.
- Temporary Guest Unit Access: Time-bounded dispatch delegation allowing officers from adjacent
  jurisdictions (JUR-NCR-SOUTH <-> JUR-DELHI-METRO) to triage, respond, and log actions in borrowed
  zones without altering permanent rosters.
- Joint Taskforce Workspaces: Shared incident dashboards aggregating signals from multiple operational
  zones for cross-precinct syndicate takedowns.
- Auto-Revocation & Sunset Audits: Automatic access de-escalation once caseload drops below threshold,
  with all guest actions stamped in the master audit log.
- Integration: Builds directly on top of Jurisdiction & Zone Configuration and IncidentDashboardView.
"""
from __future__ import annotations

import copy
import itertools
import threading
import time
from typing import Any, Optional

from app.services import incidents as incident_service
from app.services import jurisdiction as jurisdiction_service

_lock = threading.RLock()
_declaration_counter = itertools.count(101)
_delegation_counter = itertools.count(201)
_taskforce_counter = itertools.count(301)
_audit_counter = itertools.count(401)

# In-memory stores
_declarations: dict[str, dict[str, Any]] = {}
_guest_delegations: dict[str, dict[str, Any]] = {}
_joint_taskforces: dict[str, dict[str, Any]] = {}
_guest_action_audit_log: list[dict[str, Any]] = []
_sunset_audit_log: list[dict[str, Any]] = []

# Workload weights matching Incident Dashboard
SEVERITY_WEIGHTS = {
    "critical": 3.0,
    "high": 2.0,
    "medium": 1.0,
    "low": 0.5,
}

ACTIVE_STATUSES = {"new", "triaged", "in_progress", "escalated"}

# Adjacency map for NCR and Delhi metropolitan security perimeters
ADJACENT_JURISDICTIONS = {
    "JUR-DELHI-METRO": ["JUR-NCR-SOUTH"],
    "JUR-NCR-SOUTH": ["JUR-DELHI-METRO"],
}


def _now_ms() -> int:
    return int(time.time() * 1000)


def init_defaults():
    with _lock:
        now = _now_ms()
        # Seed default Joint Taskforce for interstate cyber crime
        if not _joint_taskforces:
            jtf_id = "JTF-NCR-METRO-01"
            _joint_taskforces[jtf_id] = {
                "id": jtf_id,
                "name": "Delhi-Gurugram Interstate Cyber Syndicate Taskforce",
                "lead_jurisdiction_id": "JUR-DELHI-METRO",
                "participating_jurisdiction_ids": ["JUR-DELHI-METRO", "JUR-NCR-SOUTH"],
                "monitored_regions": ["Central Zone", "South Zone"],
                "active_taskforce_officers": ["OFF-DIR-01", "OFF-S1", "OFF-C1", "CYBER-SPECIAL"],
                "target_syndicate_tags": ["digital_arrest", "mule_network", "telecom_spoof"],
                "status": "active",
                "created_at": now - 86400000,
                "created_by": "OFF-DIR-01",
                "notes": "Unified command hub coordinating rapid freeze orders across Delhi-NCR financial and telecom gateways.",
            }

        # Seed baseline Mutual Aid declaration for demonstration
        if not _declarations:
            dec_id = "MAD-2026-00101"
            _declarations[dec_id] = {
                "id": dec_id,
                "requesting_jurisdiction_id": "JUR-DELHI-METRO",
                "service_area_id": "SA-CENTRAL-01",
                "region": "Central Zone",
                "declared_by": "OFF-DIR-01",
                "trigger_type": "automatic_threshold",
                "workload_points": 48.0,
                "capacity_limit_points": 30.0,
                "workload_ratio": 1.60,
                "target_neighbor_jurisdictions": ["JUR-NCR-SOUTH"],
                "requested_units_count": 2,
                "status": "active",
                "declared_at": now - 7200000,
                "deescalated_at": None,
                "notes": "Central Secretariat workload at 160% of capacity points due to multi-caller digital arrest surge.",
            }

        # Seed initial guest delegation
        if not _guest_delegations:
            del_id = "GUEST-DEL-201"
            _guest_delegations[del_id] = {
                "delegation_id": del_id,
                "declaration_id": "MAD-2026-00101",
                "guest_officer_id": "OFF-S1",
                "home_jurisdiction_id": "JUR-NCR-SOUTH",
                "home_service_area_id": "SA-SOUTH-01",
                "borrowing_jurisdiction_id": "JUR-DELHI-METRO",
                "borrowing_service_area_id": "SA-CENTRAL-01",
                "target_region": "Central Zone",
                "authorized_by": "OFF-DIR-01",
                "authorized_at": now - 3600000,
                "valid_from": now - 3600000,
                "valid_until": now + (7 * 3600000),  # 8-hour window
                "permissions": ["triage", "respond", "log_action", "reassign"],
                "status": "active",
                "revocation_reason": None,
                "revoked_at": None,
                "revoked_by": None,
            }

            # Seed initial audit action
            _guest_action_audit_log.append({
                "id": "AUDIT-001",
                "delegation_id": del_id,
                "guest_officer_id": "OFF-S1",
                "home_jurisdiction_id": "JUR-NCR-SOUTH",
                "borrowed_jurisdiction_id": "JUR-DELHI-METRO",
                "incident_id": "INC-0001",
                "action_type": "triage",
                "details": "Cross-zone guest officer OFF-S1 triaged digital arrest report and flagged linked mule account ACC-9941.",
                "timestamp": now - 1800000,
            })


# ---------- Sector Capacity & Workload Evaluation ----------

def compute_sector_workload(region: str) -> tuple[float, int]:
    """Compute weighted workload points and active incident count for a region."""
    feed = incident_service.get_feed()
    incidents = feed.get("incidents", [])
    active_incidents = [
        i for i in incidents
        if i.get("region") == region and i.get("status") in ACTIVE_STATUSES
    ]
    total_load = sum(SEVERITY_WEIGHTS.get(i.get("severity", "low"), 0.5) for i in active_incidents)
    return float(total_load), len(active_incidents)


def analyze_sectors() -> list[dict[str, Any]]:
    """Analyze all service areas for capacity pressure, overload (>150%), and surplus capacity."""
    service_areas = jurisdiction_service.list_service_areas()
    analyses = []

    for sa in service_areas:
        sa_id = sa.get("id")
        region = sa.get("region", "Central Zone")
        cap_limit = float(sa.get("capacity_limit_points", 24))
        load_pts, active_count = compute_sector_workload(region)

        # Count active guest units deployed to this service area
        active_guests = [
            g for g in _guest_delegations.values()
            if g.get("borrowing_service_area_id") == sa_id and g.get("status") == "active"
        ]

        # Effective capacity points (base capacity + 6 points per guest officer)
        effective_capacity = cap_limit + (len(active_guests) * 6.0)
        ratio = round(load_pts / max(cap_limit, 1.0), 3)

        analyses.append({
            "service_area_id": sa_id,
            "service_area_name": sa.get("name", sa_id),
            "region": region,
            "jurisdiction_id": sa.get("jurisdiction_id", "JUR-DELHI-METRO"),
            "capacity_limit_points": cap_limit,
            "effective_capacity_points": effective_capacity,
            "workload_points": load_pts,
            "workload_ratio": ratio,
            "active_incidents_count": active_count,
            "is_overloaded_150": ratio >= 1.50,
            "has_surplus_capacity": ratio < 0.70,
            "guest_units_count": len(active_guests),
        })

    return analyses


# ---------- Mutual Aid Declarations Engine ----------

def check_workload_and_trigger_mutual_aid() -> list[dict[str, Any]]:
    """Scan sectors and automatically trigger Mutual Aid Declarations when workload >= 150%."""
    with _lock:
        sectors = analyze_sectors()
        triggered: list[dict[str, Any]] = []
        now = _now_ms()

        for s in sectors:
            if s["is_overloaded_150"]:
                sa_id = s["service_area_id"]
                # Check if there is already an active declaration for this service area
                existing = [
                    d for d in _declarations.values()
                    if d.get("service_area_id") == sa_id and d.get("status") in ("active", "partially_fulfilled")
                ]
                if not existing:
                    dec_id = f"MAD-{time.strftime('%Y', time.gmtime(now / 1000))}-{next(_declaration_counter):05d}"
                    parent_jur = s["jurisdiction_id"]
                    adjacent = ADJACENT_JURISDICTIONS.get(parent_jur, ["JUR-NCR-SOUTH" if parent_jur != "JUR-NCR-SOUTH" else "JUR-DELHI-METRO"])

                    # Units needed to bring workload down to 100% capacity: (load - cap) / 6 pts per unit
                    needed = max(1, int((s["workload_points"] - s["capacity_limit_points"]) / 6.0) + 1)

                    declaration = {
                        "id": dec_id,
                        "requesting_jurisdiction_id": parent_jur,
                        "service_area_id": sa_id,
                        "region": s["region"],
                        "declared_by": "SYSTEM_AUTOTRIGGER",
                        "trigger_type": "automatic_threshold",
                        "workload_points": s["workload_points"],
                        "capacity_limit_points": s["capacity_limit_points"],
                        "workload_ratio": s["workload_ratio"],
                        "target_neighbor_jurisdictions": adjacent,
                        "requested_units_count": needed,
                        "status": "active",
                        "declared_at": now,
                        "deescalated_at": None,
                        "notes": f"Automated trigger: {s['service_area_name']} workload reached {int(s['workload_ratio'] * 100)}% of capacity threshold.",
                    }
                    _declarations[dec_id] = declaration
                    triggered.append(copy.deepcopy(declaration))

        return triggered


def declare_mutual_aid(
    service_area_id: str,
    declared_by: str = "COMMANDING_OFFICER",
    requested_units_count: int = 2,
    target_neighbor_jurisdictions: Optional[list[str]] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    with _lock:
        sa = jurisdiction_service.get_service_area(service_area_id)
        if not sa:
            raise ValueError(f"Service area {service_area_id} not found")

        now = _now_ms()
        region = sa.get("region", "Central Zone")
        load_pts, _ = compute_sector_workload(region)
        cap_limit = float(sa.get("capacity_limit_points", 24))
        ratio = round(load_pts / max(cap_limit, 1.0), 3)

        parent_jur = sa.get("jurisdiction_id", "JUR-DELHI-METRO")
        adjacent = target_neighbor_jurisdictions or ADJACENT_JURISDICTIONS.get(
            parent_jur, ["JUR-NCR-SOUTH" if parent_jur != "JUR-NCR-SOUTH" else "JUR-DELHI-METRO"]
        )

        dec_id = f"MAD-{time.strftime('%Y', time.gmtime(now / 1000))}-{next(_declaration_counter):05d}"
        declaration = {
            "id": dec_id,
            "requesting_jurisdiction_id": parent_jur,
            "service_area_id": service_area_id,
            "region": region,
            "declared_by": declared_by,
            "trigger_type": "commander_manual",
            "workload_points": load_pts,
            "capacity_limit_points": cap_limit,
            "workload_ratio": ratio,
            "target_neighbor_jurisdictions": adjacent,
            "requested_units_count": requested_units_count,
            "status": "active",
            "declared_at": now,
            "deescalated_at": None,
            "notes": notes or f"Commander manual declaration: Requesting reinforcement for {sa.get('name')}.",
        }
        _declarations[dec_id] = declaration
        return copy.deepcopy(declaration)


def list_declarations(status: Optional[str] = None) -> list[dict[str, Any]]:
    with _lock:
        # Check automatic triggers on poll
        check_workload_and_trigger_mutual_aid()
        res = list(_declarations.values())
        if status:
            res = [d for d in res if d.get("status") == status]
        res.sort(key=lambda d: d.get("declared_at", 0), reverse=True)
        return [copy.deepcopy(d) for d in res]


def deescalate_declaration(declaration_id: str, reason: str = "Workload normalized below threshold") -> dict[str, Any]:
    with _lock:
        dec = _declarations.get(declaration_id)
        if not dec:
            raise ValueError(f"Declaration {declaration_id} not found")

        now = _now_ms()
        dec["status"] = "de_escalated"
        dec["deescalated_at"] = now
        dec["notes"] = f"{dec.get('notes', '')} | De-escalated: {reason}".strip()

        # Trigger sunset on linked guest delegations
        revoked_count = 0
        for del_id, deleg in _guest_delegations.items():
            if deleg.get("declaration_id") == declaration_id and deleg.get("status") == "active":
                deleg["status"] = "revoked"
                deleg["revoked_at"] = now
                deleg["revoked_by"] = "AUTO_SUNSET_SYSTEM"
                deleg["revocation_reason"] = f"Mutual aid declaration {declaration_id} de-escalated: {reason}"
                revoked_count += 1

                _sunset_audit_log.append({
                    "audit_id": f"SUNSET-{next(_audit_counter)}",
                    "delegation_id": del_id,
                    "guest_officer_id": deleg.get("guest_officer_id"),
                    "home_jurisdiction_id": deleg.get("home_jurisdiction_id"),
                    "borrowing_jurisdiction_id": deleg.get("borrowing_jurisdiction_id"),
                    "target_region": deleg.get("target_region"),
                    "sunset_reason": "WORKLOAD_NORMALIZED_BELOW_THRESHOLD",
                    "details": f"Caseload normalized; guest delegation sunset and access decommissioned.",
                    "timestamp": now,
                })

        return {
            "declaration": copy.deepcopy(dec),
            "sunset_delegations_count": revoked_count,
        }


# ---------- Temporary Guest Unit Access Delegation ----------

def delegate_guest_unit(
    guest_officer_id: str,
    home_jurisdiction_id: str,
    borrowing_jurisdiction_id: str,
    target_service_area_id: str,
    authorized_by: str = "COMMANDING_OFFICER",
    duration_hours: float = 8.0,
    permissions: Optional[list[str]] = None,
    declaration_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Grant time-bounded guest unit dispatch access without altering permanent rosters."""
    with _lock:
        sa = jurisdiction_service.get_service_area(target_service_area_id)
        if not sa:
            raise ValueError(f"Target service area {target_service_area_id} not found")

        # Check if officer is already on active guest duty
        existing = [
            g for g in _guest_delegations.values()
            if g.get("guest_officer_id") == guest_officer_id and g.get("status") == "active"
        ]
        if existing:
            raise ValueError(f"Officer {guest_officer_id} is already deployed on active guest delegation {existing[0]['delegation_id']}.")

        now = _now_ms()
        valid_until = now + int(duration_hours * 3600 * 1000)
        del_id = f"GUEST-DEL-{next(_delegation_counter):04d}"

        delegation = {
            "delegation_id": del_id,
            "declaration_id": declaration_id,
            "guest_officer_id": guest_officer_id,
            "home_jurisdiction_id": home_jurisdiction_id,
            "home_service_area_id": "SA-SOUTH-01" if home_jurisdiction_id == "JUR-NCR-SOUTH" else "SA-CENTRAL-01",
            "borrowing_jurisdiction_id": borrowing_jurisdiction_id,
            "borrowing_service_area_id": target_service_area_id,
            "target_region": sa.get("region", "Central Zone"),
            "authorized_by": authorized_by,
            "authorized_at": now,
            "valid_from": now,
            "valid_until": valid_until,
            "permissions": permissions or ["triage", "respond", "log_action", "reassign"],
            "status": "active",
            "revocation_reason": None,
            "revoked_at": None,
            "revoked_by": None,
        }

        _guest_delegations[del_id] = delegation

        # If linked to declaration, update declaration status
        if declaration_id and declaration_id in _declarations:
            dec = _declarations[declaration_id]
            linked_active = [
                d for d in _guest_delegations.values()
                if d.get("declaration_id") == declaration_id and d.get("status") == "active"
            ]
            if len(linked_active) >= dec.get("requested_units_count", 1):
                dec["status"] = "fulfilled"
            else:
                dec["status"] = "partially_fulfilled"

        # Log authorization event
        _sunset_audit_log.append({
            "audit_id": f"AUTH-{next(_audit_counter)}",
            "delegation_id": del_id,
            "guest_officer_id": guest_officer_id,
            "home_jurisdiction_id": home_jurisdiction_id,
            "borrowing_jurisdiction_id": borrowing_jurisdiction_id,
            "target_region": sa.get("region"),
            "sunset_reason": "DISPATCH_AUTHORIZED",
            "details": f"Temporary access granted for {duration_hours}h. Permanent roster maintained at {home_jurisdiction_id}.",
            "timestamp": now,
        })

        return copy.deepcopy(delegation)


def revoke_guest_delegation(
    delegation_id: str,
    revoked_by: str = "COMMANDING_OFFICER",
    reason: str = "Manual command revocation",
) -> dict[str, Any]:
    with _lock:
        deleg = _guest_delegations.get(delegation_id)
        if not deleg:
            raise ValueError(f"Delegation {delegation_id} not found")

        now = _now_ms()
        deleg["status"] = "revoked"
        deleg["revoked_at"] = now
        deleg["revoked_by"] = revoked_by
        deleg["revocation_reason"] = reason

        _sunset_audit_log.append({
            "audit_id": f"SUNSET-{next(_audit_counter)}",
            "delegation_id": delegation_id,
            "guest_officer_id": deleg.get("guest_officer_id"),
            "home_jurisdiction_id": deleg.get("home_jurisdiction_id"),
            "borrowing_jurisdiction_id": deleg.get("borrowing_jurisdiction_id"),
            "target_region": deleg.get("target_region"),
            "sunset_reason": "COMMAND_REVOCATION",
            "details": reason,
            "timestamp": now,
        })

        return copy.deepcopy(deleg)


def list_guest_delegations(status: Optional[str] = None) -> list[dict[str, Any]]:
    with _lock:
        check_auto_revocation()
        res = list(_guest_delegations.values())
        if status:
            res = [d for d in res if d.get("status") == status]
        res.sort(key=lambda d: d.get("authorized_at", 0), reverse=True)
        return [copy.deepcopy(d) for d in res]


def check_auto_revocation() -> list[dict[str, Any]]:
    """Automatically revoke expired guest delegations or those where workload normalized below capacity."""
    with _lock:
        now = _now_ms()
        revoked_items: list[dict[str, Any]] = []

        for del_id, deleg in _guest_delegations.items():
            if deleg.get("status") != "active":
                continue

            # 1. Check time-bounded expiry
            if now >= deleg.get("valid_until", 0):
                deleg["status"] = "expired"
                deleg["revoked_at"] = now
                deleg["revoked_by"] = "AUTO_SUNSET_CLOCK"
                deleg["revocation_reason"] = "Time-bounded guest window expired"
                revoked_items.append(copy.deepcopy(deleg))

                _sunset_audit_log.append({
                    "audit_id": f"SUNSET-{next(_audit_counter)}",
                    "delegation_id": del_id,
                    "guest_officer_id": deleg.get("guest_officer_id"),
                    "home_jurisdiction_id": deleg.get("home_jurisdiction_id"),
                    "borrowing_jurisdiction_id": deleg.get("borrowing_jurisdiction_id"),
                    "target_region": deleg.get("target_region"),
                    "sunset_reason": "DELEGATION_TIMED_EXPIRY",
                    "details": "Time-bounded delegation duration completed; session automatically sunset.",
                    "timestamp": now,
                })
                continue

            # 2. Check workload normalization in borrowing sector
            target_region = deleg.get("target_region")
            load_pts, _ = compute_sector_workload(target_region)
            sa = jurisdiction_service.get_service_area(deleg.get("borrowing_service_area_id"))
            cap_limit = float(sa.get("capacity_limit_points", 24)) if sa else 24.0

            # If workload is <= 90% of capacity and delegation has been active for at least 15 minutes
            if load_pts <= (cap_limit * 0.90) and (now - deleg.get("authorized_at", 0)) > 900000:
                deleg["status"] = "revoked"
                deleg["revoked_at"] = now
                deleg["revoked_by"] = "AUTO_SUNSET_NORMALIZATION"
                deleg["revocation_reason"] = f"Workload in {target_region} dropped to {int((load_pts/cap_limit)*100)}% of capacity points."
                revoked_items.append(copy.deepcopy(deleg))

                _sunset_audit_log.append({
                    "audit_id": f"SUNSET-{next(_audit_counter)}",
                    "delegation_id": del_id,
                    "guest_officer_id": deleg.get("guest_officer_id"),
                    "home_jurisdiction_id": deleg.get("home_jurisdiction_id"),
                    "borrowing_jurisdiction_id": deleg.get("borrowing_jurisdiction_id"),
                    "target_region": target_region,
                    "sunset_reason": "WORKLOAD_NORMALIZED_BELOW_THRESHOLD",
                    "details": f"Caseload dropped below operational capacity ({load_pts:.1f} / {cap_limit:.1f} pts). Access automatically returned to home jurisdiction.",
                    "timestamp": now,
                })

        return revoked_items


# ---------- Master Audit Log for Guest Actions ----------

def log_guest_action(
    guest_officer_id: str,
    incident_id: str,
    action_type: str,
    details: str,
) -> dict[str, Any]:
    """Record guest unit action stamped with guest officer badge, home jurisdiction, and incident ID."""
    with _lock:
        # Find active delegation for this officer
        deleg = None
        for d in _guest_delegations.values():
            if d.get("guest_officer_id") == guest_officer_id and d.get("status") == "active":
                deleg = d
                break

        now = _now_ms()
        audit_entry = {
            "id": f"AUDIT-{next(_audit_counter):05d}",
            "delegation_id": deleg["delegation_id"] if deleg else "DIRECT_ASSIGNMENT",
            "guest_officer_id": guest_officer_id,
            "home_jurisdiction_id": deleg["home_jurisdiction_id"] if deleg else "JUR-NCR-SOUTH",
            "borrowed_jurisdiction_id": deleg["borrowing_jurisdiction_id"] if deleg else "JUR-DELHI-METRO",
            "incident_id": incident_id,
            "action_type": action_type,
            "details": details,
            "timestamp": now,
        }
        _guest_action_audit_log.append(audit_entry)
        return copy.deepcopy(audit_entry)


def get_guest_action_audit_log(guest_officer_id: Optional[str] = None) -> list[dict[str, Any]]:
    with _lock:
        res = list(_guest_action_audit_log)
        if guest_officer_id:
            res = [a for a in res if a.get("guest_officer_id") == guest_officer_id]
        res.sort(key=lambda a: a.get("timestamp", 0), reverse=True)
        return [copy.deepcopy(a) for a in res]


def get_sunset_audit_log() -> list[dict[str, Any]]:
    with _lock:
        res = list(_sunset_audit_log)
        res.sort(key=lambda s: s.get("timestamp", 0), reverse=True)
        return [copy.deepcopy(s) for s in res]


# ---------- Joint Taskforce Workspaces ----------

def create_joint_taskforce(
    name: str,
    lead_jurisdiction_id: str,
    participating_jurisdiction_ids: list[str],
    monitored_regions: list[str],
    active_taskforce_officers: list[str],
    target_syndicate_tags: Optional[list[str]] = None,
    created_by: str = "COMMANDING_OFFICER",
    notes: Optional[str] = None,
) -> dict[str, Any]:
    with _lock:
        now = _now_ms()
        jtf_id = f"JTF-{next(_taskforce_counter):03d}"
        taskforce = {
            "id": jtf_id,
            "name": name,
            "lead_jurisdiction_id": lead_jurisdiction_id,
            "participating_jurisdiction_ids": participating_jurisdiction_ids,
            "monitored_regions": monitored_regions,
            "active_taskforce_officers": active_taskforce_officers,
            "target_syndicate_tags": target_syndicate_tags or ["digital_arrest", "mule_network"],
            "status": "active",
            "created_at": now,
            "created_by": created_by,
            "notes": notes,
        }
        _joint_taskforces[jtf_id] = taskforce
        return copy.deepcopy(taskforce)


def list_joint_taskforces() -> list[dict[str, Any]]:
    with _lock:
        res = list(_joint_taskforces.values())
        res.sort(key=lambda t: t.get("created_at", 0), reverse=True)
        return [copy.deepcopy(t) for t in res]


def get_joint_taskforce_workspace(taskforce_id: str) -> dict[str, Any]:
    """Aggregate multi-zone incidents, cross-zone syndicate links, and shared telemetry."""
    with _lock:
        jtf = _joint_taskforces.get(taskforce_id)
        if not jtf:
            raise ValueError(f"Joint Taskforce {taskforce_id} not found")

        regions = jtf.get("monitored_regions", [])
        feed = incident_service.get_feed()
        all_incidents = feed.get("incidents", [])

        # Filter incidents belonging to any monitored region
        taskforce_incidents = [
            i for i in all_incidents
            if i.get("region") in regions
        ]

        # Detect cross-zone syndicate account links
        account_counts: dict[str, set[str]] = {}
        for inc in taskforce_incidents:
            acc = inc.get("linked_account")
            if acc:
                if acc not in account_counts:
                    account_counts[acc] = set()
                account_counts[acc].add(inc.get("region"))

        cross_zone_syndicate_accounts = [
            {"account_id": acc, "regions": list(regs), "incident_count": sum(1 for i in taskforce_incidents if i.get("linked_account") == acc)}
            for acc, regs in account_counts.items()
            if len(regs) > 1
        ]

        # Aggregate metrics
        active_count = sum(1 for i in taskforce_incidents if i.get("status") in ACTIVE_STATUSES)
        critical_count = sum(1 for i in taskforce_incidents if i.get("severity") == "critical" and i.get("status") in ACTIVE_STATUSES)
        total_workload = sum(SEVERITY_WEIGHTS.get(i.get("severity", "low"), 0.5) for i in taskforce_incidents if i.get("status") in ACTIVE_STATUSES)

        return {
            "taskforce": copy.deepcopy(jtf),
            "aggregated_metrics": {
                "monitored_regions_count": len(regions),
                "total_incidents": len(taskforce_incidents),
                "active_incidents": active_count,
                "critical_incidents": critical_count,
                "combined_workload_points": round(total_workload, 1),
                "cross_zone_syndicates_detected": len(cross_zone_syndicate_accounts),
                "active_guest_units_in_regions": sum(
                    1 for g in _guest_delegations.values()
                    if g.get("target_region") in regions and g.get("status") == "active"
                ),
            },
            "cross_zone_syndicate_accounts": cross_zone_syndicate_accounts,
            "incidents": copy.deepcopy(taskforce_incidents),
        }


# ---------- Dynamic Resource Rebalancing Evaluator ----------

def evaluate_dynamic_rebalancing() -> dict[str, Any]:
    """Scan all sectors, detect >150% overload, find surplus capacity donors, and recommend rebalancing."""
    with _lock:
        auto_triggered = check_workload_and_trigger_mutual_aid()
        check_auto_revocation()

        sectors = analyze_sectors()
        overloaded = [s for s in sectors if s["is_overloaded_150"]]
        surplus = [s for s in sectors if s["has_surplus_capacity"]]

        recommendations = []
        rec_counter = 1

        for o in overloaded:
            # Find donor service area in an adjacent or partner jurisdiction
            o_jur = o["jurisdiction_id"]
            eligible_donors = [
                d for d in surplus
                if d["jurisdiction_id"] != o_jur or d["service_area_id"] != o["service_area_id"]
            ]

            # Sort by lowest workload ratio
            eligible_donors.sort(key=lambda d: d["workload_ratio"])

            if eligible_donors:
                donor = eligible_donors[0]
                units_needed = max(1, int((o["workload_points"] - o["capacity_limit_points"]) / 6.0) + 1)
                projected_cap = o["capacity_limit_points"] + (units_needed * 6.0)
                projected_ratio = round(o["workload_points"] / projected_cap, 2)

                recommendations.append({
                    "recommendation_id": f"REC-REBAL-{rec_counter:03d}",
                    "overloaded_service_area_id": o["service_area_id"],
                    "overloaded_region": o["region"],
                    "donor_jurisdiction_id": donor["jurisdiction_id"],
                    "donor_service_area_id": donor["service_area_id"],
                    "recommended_units": units_needed,
                    "projected_workload_ratio_after": projected_ratio,
                    "rationales": [
                        f"{o['service_area_name']} is operating at {int(o['workload_ratio'] * 100)}% capacity ({o['workload_points']:.1f} / {o['capacity_limit_points']:.1f} points).",
                        f"Donor {donor['service_area_name']} has surplus capacity at {int(donor['workload_ratio'] * 100)}% load ratio.",
                        f"Deploying {units_needed} guest units will stabilize target sector workload to {int(projected_ratio * 100)}% without changing permanent rosters.",
                    ],
                })
                rec_counter += 1

        now = _now_ms()
        return {
            "timestamp": now,
            "sectors": sectors,
            "overloaded_sectors_count": len(overloaded),
            "active_declarations_count": sum(1 for d in _declarations.values() if d.get("status") in ("active", "partially_fulfilled")),
            "active_guest_delegations_count": sum(1 for g in _guest_delegations.values() if g.get("status") == "active"),
            "recommendations": recommendations,
            "auto_declarations_triggered": auto_triggered,
        }


def reset():
    """Reset service for clean unit test runs."""
    with _lock:
        _declarations.clear()
        _guest_delegations.clear()
        _joint_taskforces.clear()
        _guest_action_audit_log.clear()
        _sunset_audit_log.clear()
        init_defaults()


# Initialize on module import
init_defaults()

