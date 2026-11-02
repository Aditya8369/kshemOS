from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import (
    GeofenceAlert,
    GeofenceBoundary,
    GeofenceRule,
    LocationPingRequest,
    LocationPingResponse,
)
from app.services import geofence

router = APIRouter(prefix="/api/geofence", tags=["Geofencing & Tactical Map"])


# ---------- Boundaries ----------

@router.get("/boundaries", response_model=list[GeofenceBoundary])
def list_boundaries():
    return geofence.get_all_boundaries()


@router.post("/boundaries", response_model=GeofenceBoundary, status_code=201)
def create_boundary(payload: GeofenceBoundary):
    return geofence.create_boundary(payload.model_dump())


@router.put("/boundaries/{boundary_id}", response_model=GeofenceBoundary)
def update_boundary(boundary_id: str, payload: dict):
    updated = geofence.update_boundary(boundary_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Boundary not found")
    return updated


@router.delete("/boundaries/{boundary_id}", status_code=204)
def delete_boundary(boundary_id: str):
    if not geofence.delete_boundary(boundary_id):
        raise HTTPException(status_code=404, detail="Boundary not found")
    return None


# ---------- Rules ----------

@router.get("/rules", response_model=list[GeofenceRule])
def list_rules():
    return geofence.get_all_rules()


@router.post("/rules", response_model=GeofenceRule, status_code=201)
def create_rule(payload: GeofenceRule):
    return geofence.create_rule(payload.model_dump())


@router.put("/rules/{rule_id}", response_model=GeofenceRule)
def update_rule(rule_id: str, payload: dict):
    updated = geofence.update_rule(rule_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str):
    if not geofence.delete_rule(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")
    return None


# ---------- Alerts ----------

@router.get("/alerts", response_model=list[GeofenceAlert])
def list_alerts(
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    acknowledged: Optional[bool] = None,
):
    sev = severity if isinstance(severity, str) else None
    evt = event_type if isinstance(event_type, str) else None
    ack = acknowledged if isinstance(acknowledged, bool) else None
    return geofence.get_alerts(
        severity=sev,
        event_type=evt,
        acknowledged=ack,
    )


@router.post("/alerts/{alert_id}/acknowledge", response_model=dict)
def acknowledge_alert(alert_id: str):
    if not geofence.acknowledge_alert(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"id": alert_id, "acknowledged": True}


@router.delete("/alerts", response_model=dict)
def clear_alerts():
    count = geofence.clear_alerts()
    return {"cleared_count": count}


# ---------- Telemetry / Location Ping ----------

@router.post("/ping", response_model=LocationPingResponse)
def location_ping(payload: LocationPingRequest):
    """Update location for a tracked field unit and evaluate geofence events."""
    return geofence.process_location_ping(
        entity_id=payload.entity_id,
        team=payload.team,
        lat=payload.lat,
        lng=payload.lng,
        timestamp=payload.timestamp,
    )
