from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import (
    IncidentNotificationPayload,
    NotificationAuditResponse,
    OfficerDirectoryEntry,
    RetryNotificationResponse,
    SendNotificationRequest,
    UpdateOfficerPreferencesRequest,
)
from app.services import incident_notifications
from app.services import incidents

router = APIRouter(prefix="/api/incident-notifications", tags=["Role-Aware Incident Notifications"])


@router.get("", response_model=NotificationAuditResponse)
def get_notifications(
    incident_id: Optional[str] = Query(None),
    recipient_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Retrieve audit log of role-aware email notifications dispatched for incident events."""
    items = incident_notifications.list_delivery_audit(
        incident_id=incident_id,
        recipient_id=recipient_id,
        role=role,
        event_type=event_type,
        status=status,
        limit=limit,
    )
    stats = incident_notifications.get_delivery_stats()
    return {
        "total": stats["total"],
        "delivered": stats["delivered"],
        "retrying": stats["retrying"],
        "failed": stats["failed"],
        "suppressed": stats["suppressed"],
        "notifications": items,
    }


@router.get("/stats")
def get_stats():
    """Retrieve high-level notification delivery outcome metrics."""
    return incident_notifications.get_delivery_stats()


@router.get("/directory", response_model=List[OfficerDirectoryEntry])
def get_directory():
    """List authorized responders, supervisors, and commanders with notification preferences."""
    return incident_notifications.list_officers()


@router.get("/preferences/{officer_id}")
def get_preferences(officer_id: str):
    """Get notification preferences and quiet hours for an officer."""
    officer = incident_notifications.get_officer(officer_id)
    if not officer:
        raise HTTPException(status_code=404, detail=f"Officer {officer_id} not found")
    return {"officer_id": officer_id, "preferences": officer.get("preferences", {})}


@router.put("/preferences/{officer_id}")
def update_preferences(officer_id: str, payload: UpdateOfficerPreferencesRequest):
    """Update officer email notification triggers and quiet hours windows."""
    try:
        updated = incident_notifications.update_officer_preferences(
            officer_id, payload.preferences.model_dump()
        )
        return updated
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/retry/{notification_id}", response_model=RetryNotificationResponse)
def retry_failed_notification(notification_id: str):
    """Re-attempt delivery of a failed or retrying notification outcome."""
    try:
        updated = incident_notifications.retry_notification(notification_id, force_success=True)
        return {
            "success": updated.get("delivery_status") == "delivered",
            "notification": updated,
            "message": "Notification delivery retry processed successfully.",
        }
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/dispatch")
def manual_dispatch(payload: SendNotificationRequest):
    """Manually dispatch a role-aware incident assignment or escalation notification."""
    with incidents._lock:
        inc = incidents._incidents.get(payload.incident_id)

    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {payload.incident_id} not found")

    dispatched = incident_notifications.dispatch_incident_notifications(
        inc,
        event_type=payload.event_type,
        actor_id=payload.actor_id,
    )
    return {"incident_id": payload.incident_id, "dispatched_count": len(dispatched), "outcomes": dispatched}

