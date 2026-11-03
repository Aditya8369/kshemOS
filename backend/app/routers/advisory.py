from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from app.models import (
    AdvisoryCreate,
    AdvisoryStatusUpdate,
    AdvisoryResponse,
    AuthorizeBroadcastRequest,
    EstimateAudienceRequest,
    PerimeterTargeting,
    DeliveryTelemetry,
)
from app.services.emergency_broadcast import (
    default_broadcast_engine,
    TEMPLATES,
    SERVICE_AREAS_REGISTRY,
)

router = APIRouter(prefix="/api/advisory", tags=["Advisory"])


@router.get("/templates")
def get_templates():
    """Returns official emergency bulletin templates."""
    return {"templates": TEMPLATES}


@router.get("/service-areas")
def get_service_areas():
    """Returns metropolitan service area registry with boundary definitions and demographic baselines."""
    return {"service_areas": list(SERVICE_AREAS_REGISTRY.values())}


@router.post("/estimate-audience", response_model=PerimeterTargeting)
def estimate_audience(payload: EstimateAudienceRequest):
    """Reverse-geocodes service area boundary or custom perimeter coordinates into audience demographics."""
    return default_broadcast_engine.estimate_audience(payload)


@router.post("/create", response_model=AdvisoryResponse)
def create_advisory(payload: AdvisoryCreate):
    """Creates a new emergency advisory draft, evaluating commander guardrails."""
    return default_broadcast_engine.create_broadcast(payload)


@router.get("/list", response_model=List[AdvisoryResponse])
def list_advisories(status: Optional[str] = None):
    """Lists all advisories in reverse chronological order, optionally filtered by status."""
    items = list(default_broadcast_engine.advisories.values())
    if status:
        items = [i for i in items if i["status"] == status]
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return [AdvisoryResponse(**i) for i in items]


@router.get("/active-banner")
def get_active_portal_banner():
    """Returns the highest priority published emergency bulletin for the citizen portal banner."""
    banner = default_broadcast_engine.get_active_banner()
    return {"banner": banner}


@router.get("/{advisory_id}", response_model=AdvisoryResponse)
def get_advisory(advisory_id: str):
    """Fetches full advisory details including geo-targeting and multi-channel telemetry."""
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")
    return AdvisoryResponse(**default_broadcast_engine.advisories[advisory_id])


@router.post("/{advisory_id}/authorize", response_model=AdvisoryResponse)
def authorize_advisory(advisory_id: str, payload: AuthorizeBroadcastRequest):
    """Executes commander dual-authorization sign-off."""
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")
    try:
        return default_broadcast_engine.authorize_broadcast(advisory_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{advisory_id}/dispatch", response_model=AdvisoryResponse)
def dispatch_advisory(advisory_id: str):
    """Dispatches approved emergency siren across SMS, WhatsApp, Push & Portal Banner."""
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")
    try:
        return default_broadcast_engine.dispatch_broadcast(advisory_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.patch("/{advisory_id}/status", response_model=AdvisoryResponse)
def update_advisory_status(advisory_id: str, payload: AdvisoryStatusUpdate):
    """Updates advisory status (supports legacy workflow and direct transition)."""
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")

    adv = default_broadcast_engine.advisories[advisory_id]
    now = datetime.now(timezone.utc).isoformat()
    old_status = adv["status"]

    if payload.status == "published":
        try:
            return default_broadcast_engine.dispatch_broadcast(advisory_id)
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))

    adv["status"] = payload.status
    adv["updated_at"] = now
    adv["audit_trail"].append({
        "action": f"STATUS_CHANGE_TO_{payload.status.upper()}",
        "timestamp": now,
        "details": payload.reviewer_notes or f"Status transitioned from {old_status} to {payload.status}.",
    })
    return AdvisoryResponse(**adv)


@router.get("/{advisory_id}/telemetry", response_model=DeliveryTelemetry)
def get_advisory_telemetry(advisory_id: str):
    """Retrieves real-time delivery and acknowledgment telemetry."""
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")
    adv = default_broadcast_engine.advisories[advisory_id]
    return DeliveryTelemetry(**adv["telemetry"])


@router.post("/{advisory_id}/advance-telemetry", response_model=DeliveryTelemetry)
def advance_advisory_telemetry(advisory_id: str, acks: int = Query(150, ge=1)):
    """Simulates live incoming acknowledgments and linked citizen reports."""
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")
    return default_broadcast_engine.advance_telemetry(advisory_id, acks)
