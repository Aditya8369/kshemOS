from fastapi import APIRouter, HTTPException

from app.models import (
    Incident,
    IncidentCreateRequest,
    IncidentFeedResponse,
    IncidentUpdateRequest,
    RegionStaffing,
    StaffingUpdateRequest,
    SyncBatchRequest,
    SyncBatchResponse,
)
from app.services import incidents

router = APIRouter(prefix="/api/incidents", tags=["Operational Incident Dashboard"])


@router.get("", response_model=IncidentFeedResponse)
def feed():
    return incidents.get_feed()


@router.post("", response_model=Incident, status_code=201)
def create(payload: IncidentCreateRequest):
    return incidents.create_incident(**payload.model_dump())


@router.patch("/{incident_id}", response_model=Incident)
def update(incident_id: str, payload: IncidentUpdateRequest):
    # Only fields the client actually sent are applied, so `null` is never
    # mistaken for "clear this field" — clients send "" to clear instead.
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    expected_version = payload.expected_version
    force = payload.force or False
    result = incidents.update_incident(
        incident_id,
        changes,
        expected_version=expected_version,
        force=force,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if isinstance(result, dict) and result.get("conflict"):
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Conflict detected: incident was modified on server",
                "conflict": True,
                "server_incident": result["server_incident"],
                "expected_version": result["expected_version"],
                "current_version": result["current_version"],
                "conflicting_fields": result["conflicting_fields"],
            },
        )
    return result


@router.post("/sync", response_model=SyncBatchResponse)
def sync_batch(payload: SyncBatchRequest):
    """Mobile offline sync endpoint for field units.

    Applies queued status updates, incident logs, and new reports created while
    offline. Evaluates concurrency versions to detect conflicts with HQ updates.
    """
    return incidents.sync_queue_items([item.model_dump() for item in payload.items])


@router.put("/staffing/{region}", response_model=RegionStaffing)
def update_staffing(region: str, payload: StaffingUpdateRequest):
    if not incidents.set_staffing(region, payload.officers_on_duty):
        raise HTTPException(status_code=404, detail="Unknown region")
    return {"region": region, "officers_on_duty": payload.officers_on_duty}
