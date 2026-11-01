from fastapi import APIRouter, HTTPException

from app.models import (
    Incident,
    IncidentCreateRequest,
    IncidentFeedResponse,
    IncidentUpdateRequest,
    RegionStaffing,
    StaffingUpdateRequest,
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
    incident = incidents.update_incident(incident_id, changes)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.put("/staffing/{region}", response_model=RegionStaffing)
def update_staffing(region: str, payload: StaffingUpdateRequest):
    if not incidents.set_staffing(region, payload.officers_on_duty):
        raise HTTPException(status_code=404, detail="Unknown region")
    return {"region": region, "officers_on_duty": payload.officers_on_duty}
