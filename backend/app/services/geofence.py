"""
Geofencing and Tactical Map Alerts Service for KshemOS.

Defines spatial geofences (circular and polygonal operational boundaries),
evaluates entity trajectories to detect entry, exit, and dwell events,
and triggers configurable alerts based on team assignment and location rules.
"""
from __future__ import annotations

import itertools
import math
import threading
import time
from typing import Any

_lock = threading.Lock()
_alert_counter = itertools.count(1001)

# In-memory storage for geofences, rules, alerts, and entity states
_boundaries: dict[str, dict[str, Any]] = {}
_rules: dict[str, dict[str, Any]] = {}
_alerts: list[dict[str, Any]] = []
_entity_state: dict[str, dict[str, Any]] = {}


def _now_ms() -> int:
    return int(time.time() * 1000)


# ---------- Spatial Mathematics ----------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def is_point_in_polygon(lat: float, lng: float, polygon: list[dict[str, float]]) -> bool:
    """Ray-casting algorithm to test whether point (lat, lng) is inside polygon."""
    n = len(polygon)
    if n < 3:
        return False

    inside = False
    p1 = polygon[0]
    for i in range(1, n + 1):
        p2 = polygon[i % n]
        if min(p1["lng"], p2["lng"]) < lng <= max(p1["lng"], p2["lng"]):
            if lat <= max(p1["lat"], p2["lat"]):
                if p1["lng"] != p2["lng"]:
                    xinters = (lng - p1["lng"]) * (p2["lat"] - p1["lat"]) / (p2["lng"] - p1["lng"]) + p1["lat"]
                else:
                    xinters = p1["lat"]
                if p1["lat"] == p2["lat"] or lat <= xinters:
                    inside = not inside
        p1 = p2
    return inside


def is_point_in_boundary(lat: float, lng: float, boundary: dict[str, Any]) -> bool:
    """Check if point is within circle or polygon boundary."""
    if not boundary.get("is_active", True):
        return False

    b_type = boundary.get("type", "circle")
    if b_type == "circle":
        center = boundary.get("center") or {}
        radius = boundary.get("radius_meters", 1000)
        c_lat = center.get("lat", 0.0)
        c_lng = center.get("lng", 0.0)
        dist = haversine_distance(lat, lng, c_lat, c_lng)
        return dist <= radius
    elif b_type == "polygon":
        coords = boundary.get("coordinates") or []
        return is_point_in_polygon(lat, lng, coords)
    return False


# ---------- Seed Default Geofences & Rules ----------

DEFAULT_BOUNDARIES = [
    {
        "id": "GEO-CENTRAL",
        "name": "Central Zone HQ",
        "type": "circle",
        "category": "operational_sector",
        "color": "#3b82f6",
        "center": {"lat": 28.6139, "lng": 77.2090},
        "radius_meters": 2000.0,
        "coordinates": None,
        "assigned_teams": ["TEAM-ALPHA", "COMMAND-HQ"],
        "is_active": True,
    },
    {
        "id": "GEO-FIN-01",
        "name": "Financial & Banking Corridor",
        "type": "polygon",
        "category": "high_risk",
        "color": "#ef4444",
        "center": {"lat": 28.6300, "lng": 77.2180},
        "radius_meters": None,
        "coordinates": [
            {"lat": 28.6350, "lng": 77.2100},
            {"lat": 28.6370, "lng": 77.2250},
            {"lat": 28.6250, "lng": 77.2280},
            {"lat": 28.6230, "lng": 77.2120},
        ],
        "assigned_teams": ["CYBER-PATROL", "TEAM-ALPHA"],
        "is_active": True,
    },
    {
        "id": "GEO-TECH-02",
        "name": "Cyber Hub & Data Parks",
        "type": "circle",
        "category": "critical_infra",
        "color": "#8b5cf6",
        "center": {"lat": 28.5350, "lng": 77.2250},
        "radius_meters": 1800.0,
        "coordinates": None,
        "assigned_teams": ["CYBER-PATROL", "TEAM-BRAVO"],
        "is_active": True,
    },
    {
        "id": "GEO-RESTRICT-03",
        "name": "Diplomatic & Government Enclave",
        "type": "polygon",
        "category": "restricted",
        "color": "#dc2626",
        "center": {"lat": 28.6000, "lng": 77.1900},
        "radius_meters": None,
        "coordinates": [
            {"lat": 28.6080, "lng": 77.1800},
            {"lat": 28.6100, "lng": 77.2000},
            {"lat": 28.5920, "lng": 77.2020},
            {"lat": 28.5900, "lng": 77.1820},
        ],
        "assigned_teams": ["VIP-ESCORT", "COMMAND-HQ"],
        "is_active": True,
    },
    {
        "id": "GEO-TRANS-04",
        "name": "Transit Hub & Airport Checkpoint",
        "type": "circle",
        "category": "transit_checkpoint",
        "color": "#f59e0b",
        "center": {"lat": 28.5600, "lng": 77.1000},
        "radius_meters": 2500.0,
        "coordinates": None,
        "assigned_teams": ["FIELD-UNIT-1", "TEAM-BRAVO"],
        "is_active": True,
    },
]

DEFAULT_RULES = [
    {
        "id": "RULE-RESTRICTED-ENTRY",
        "name": "Critical Alert on Entry to Restricted Diplomatic Enclave",
        "geofence_id": "GEO-RESTRICT-03",
        "team": "*",
        "event_types": ["entry"],
        "dwell_threshold_seconds": 0,
        "alert_severity": "critical",
        "enabled": True,
    },
    {
        "id": "RULE-FIN-DWELL",
        "name": "Dwell Alert in High-Risk Financial Corridor (>30s)",
        "geofence_id": "GEO-FIN-01",
        "team": "*",
        "event_types": ["dwell"],
        "dwell_threshold_seconds": 30,
        "alert_severity": "warning",
        "enabled": True,
    },
    {
        "id": "RULE-PATROL-EXIT",
        "name": "Boundary Exit Alert for Patrol Teams",
        "geofence_id": "*",
        "team": "CYBER-PATROL",
        "event_types": ["exit"],
        "dwell_threshold_seconds": 0,
        "alert_severity": "info",
        "enabled": True,
    },
]


def init_defaults():
    with _lock:
        if not _boundaries:
            for b in DEFAULT_BOUNDARIES:
                _boundaries[b["id"]] = dict(b)
        if not _rules:
            for r in DEFAULT_RULES:
                _rules[r["id"]] = dict(r)


# Initialize on import
init_defaults()


# ---------- Geofence CRUD ----------

def get_all_boundaries() -> list[dict[str, Any]]:
    with _lock:
        return [dict(b) for b in _boundaries.values()]


def get_boundary(boundary_id: str) -> dict[str, Any] | None:
    with _lock:
        b = _boundaries.get(boundary_id)
        return dict(b) if b else None


def create_boundary(boundary_data: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        b_id = boundary_data.get("id") or f"GEO-CUSTOM-{len(_boundaries) + 1}"
        boundary = dict(boundary_data)
        boundary["id"] = b_id
        if "is_active" not in boundary:
            boundary["is_active"] = True
        _boundaries[b_id] = boundary
        return dict(boundary)


def update_boundary(boundary_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        b = _boundaries.get(boundary_id)
        if not b:
            return None
        b.update({k: v for k, v in updates.items() if v is not None})
        return dict(b)


def delete_boundary(boundary_id: str) -> bool:
    with _lock:
        if boundary_id in _boundaries:
            del _boundaries[boundary_id]
            return True
        return False


# ---------- Geofence Rules CRUD ----------

def get_all_rules() -> list[dict[str, Any]]:
    with _lock:
        return [dict(r) for r in _rules.values()]


def create_rule(rule_data: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        r_id = rule_data.get("id") or f"RULE-{len(_rules) + 1:02d}"
        rule = dict(rule_data)
        rule["id"] = r_id
        if "enabled" not in rule:
            rule["enabled"] = True
        _rules[r_id] = rule
        return dict(rule)


def update_rule(rule_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        r = _rules.get(rule_id)
        if not r:
            return None
        r.update({k: v for k, v in updates.items() if v is not None})
        return dict(r)


def delete_rule(rule_id: str) -> bool:
    with _lock:
        if rule_id in _rules:
            del _rules[rule_id]
            return True
        return False


# ---------- Alerts Feed ----------

def get_alerts(
    severity: str | None = None,
    event_type: str | None = None,
    acknowledged: bool | None = None,
) -> list[dict[str, Any]]:
    with _lock:
        res = list(_alerts)
        if severity:
            res = [a for a in res if a["severity"] == severity]
        if event_type:
            res = [a for a in res if a["event_type"] == event_type]
        if acknowledged is not None:
            res = [a for a in res if a["acknowledged"] == acknowledged]
        # Return newest first
        res.sort(key=lambda a: a["timestamp"], reverse=True)
        return res


def acknowledge_alert(alert_id: str) -> bool:
    with _lock:
        for a in _alerts:
            if a["id"] == alert_id:
                a["acknowledged"] = True
                return True
        return False


def clear_alerts() -> int:
    with _lock:
        count = len(_alerts)
        _alerts.clear()
        return count


# ---------- Location Evaluation & Event Trigger Engine ----------

def process_location_ping(
    entity_id: str,
    team: str,
    lat: float,
    lng: float,
    timestamp: int | None = None,
) -> dict[str, Any]:
    """Process unit coordinates, check boundaries, and trigger entry/exit/dwell alerts."""
    now = timestamp if timestamp is not None else _now_ms()

    with _lock:
        # Determine which boundaries currently contain this location
        matching_boundaries: list[dict[str, Any]] = []
        for b in _boundaries.values():
            if is_point_in_boundary(lat, lng, b):
                matching_boundaries.append(b)

        current_geo_ids = {b["id"] for b in matching_boundaries}

        # Retrieve previous state of entity
        prev_state = _entity_state.get(entity_id)
        prev_geo_ids = set(prev_state.get("active_geofences", {}).keys()) if prev_state else set()
        prev_entries = dict(prev_state.get("active_geofences", {})) if prev_state else {}
        dwell_fired = set(prev_state.get("dwell_fired", [])) if prev_state else set()

        events_to_fire: list[tuple[str, str, str, str]] = []  # (event_type, geofence_id, geofence_name, desc)

        # 1. Entry Events: in current, but not in previous
        for b in matching_boundaries:
            if b["id"] not in prev_geo_ids:
                prev_entries[b["id"]] = now
                events_to_fire.append((
                    "entry",
                    b["id"],
                    b["name"],
                    f"Unit {entity_id} ({team}) entered {b['name']}",
                ))

        # 2. Exit Events: in previous, but not in current
        for g_id in prev_geo_ids:
            if g_id not in current_geo_ids:
                b_name = _boundaries.get(g_id, {}).get("name", g_id)
                prev_entries.pop(g_id, None)
                dwell_fired.discard(g_id)
                events_to_fire.append((
                    "exit",
                    g_id,
                    b_name,
                    f"Unit {entity_id} ({team}) exited {b_name}",
                ))

        # 3. Dwell Events: continuously inside for >= threshold
        for b in matching_boundaries:
            entry_time = prev_entries.get(b["id"], now)
            dwell_seconds = (now - entry_time) / 1000.0

            # Check if any rule demands dwell check for this geofence
            for rule in _rules.values():
                if not rule.get("enabled", True):
                    continue
                if rule.get("geofence_id") not in ("*", b["id"]):
                    continue
                if rule.get("team") not in ("*", team):
                    continue
                if "dwell" not in rule.get("event_types", []):
                    continue

                threshold = rule.get("dwell_threshold_seconds", 60)
                dwell_key = f"{b['id']}_{rule['id']}"
                if dwell_seconds >= threshold and dwell_key not in dwell_fired:
                    dwell_fired.add(dwell_key)
                    events_to_fire.append((
                        "dwell",
                        b["id"],
                        b["name"],
                        f"Unit {entity_id} ({team}) dwelling in {b['name']} for {int(dwell_seconds)}s (threshold: {threshold}s)",
                    ))

        # Evaluate matching rules for each event and build alerts
        new_alerts: list[dict[str, Any]] = []

        for event_type, g_id, g_name, description in events_to_fire:
            # Find matching rules
            matching_rules = []
            for rule in _rules.values():
                if not rule.get("enabled", True):
                    continue
                if rule.get("geofence_id") not in ("*", g_id):
                    continue
                if rule.get("team") not in ("*", team):
                    continue
                if event_type in rule.get("event_types", []):
                    matching_rules.append(rule)

            # If rules match, generate alert for each rule
            if matching_rules:
                for rule in matching_rules:
                    alert_id = f"ALT-{next(_alert_counter)}"
                    alert = {
                        "id": alert_id,
                        "rule_id": rule["id"],
                        "geofence_id": g_id,
                        "geofence_name": g_name,
                        "entity_id": entity_id,
                        "team": team,
                        "event_type": event_type,
                        "severity": rule.get("alert_severity", "warning"),
                        "message": f"[{rule['name']}] {description}",
                        "timestamp": now,
                        "lat": lat,
                        "lng": lng,
                        "acknowledged": False,
                    }
                    _alerts.append(alert)
                    new_alerts.append(alert)
            else:
                # Default informational alert if no specific rule matched
                alert_id = f"ALT-{next(_alert_counter)}"
                alert = {
                    "id": alert_id,
                    "rule_id": "DEFAULT",
                    "geofence_id": g_id,
                    "geofence_name": g_name,
                    "entity_id": entity_id,
                    "team": team,
                    "event_type": event_type,
                    "severity": "info",
                    "message": description,
                    "timestamp": now,
                    "lat": lat,
                    "lng": lng,
                    "acknowledged": False,
                }
                _alerts.append(alert)
                new_alerts.append(alert)

        # Update entity state
        _entity_state[entity_id] = {
            "entity_id": entity_id,
            "team": team,
            "lat": lat,
            "lng": lng,
            "active_geofences": prev_entries,
            "dwell_fired": list(dwell_fired),
            "last_ping": now,
        }

        # Keep alerts bounded to last 200
        if len(_alerts) > 200:
            del _alerts[:-200]

        return {
            "entity_id": entity_id,
            "team": team,
            "current_geofences": list(current_geo_ids),
            "triggered_alerts": new_alerts,
            "timestamp": now,
        }


def reset():
    """Reset service state for tests."""
    with _lock:
        _boundaries.clear()
        _rules.clear()
        _alerts.clear()
        _entity_state.clear()
        for b in DEFAULT_BOUNDARIES:
            _boundaries[b["id"]] = dict(b)
        for r in DEFAULT_RULES:
            _rules[r["id"]] = dict(r)

