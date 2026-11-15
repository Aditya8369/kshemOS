from fastapi import APIRouter, Depends, HTTPException

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
from app.security import (
    Principal,
    has_permission,
    redact_incident,
    require_create_scope,
    require_incident_scope,
    require_permission,
)

router = APIRouter(
    prefix="/api/incidents",
    tags=["Operational Incident Dashboard"],
)


@router.get("", response_model=IncidentFeedResponse)
def feed(
    principal: Principal = Depends(require_permission("incidents", "read")),
):
    result = incidents.get_feed()

    visible_incidents = []
    for incident in result.get("incidents", []):
        try:
            require_incident_scope(principal, incident)
        except HTTPException:
            continue

        visible_incidents.append(redact_incident(incident, principal))

    result["incidents"] = visible_incidents
    return result


@router.post("", response_model=Incident, status_code=201)
def create(
    payload: IncidentCreateRequest,
    principal: Principal = Depends(require_permission("incidents", "create")),
):
    data = payload.model_dump()
    operation_id = data.pop("operation_id", None)

    require_create_scope(principal, data.get("region"))

    result = incidents.create_incident_idempotent(
        data,
        subject=principal.subject,
        operation_id=operation_id,
    )

    return redact_incident(result["incident"], principal)


@router.patch("/{incident_id}", response_model=Incident)
def update(
    incident_id: str,
    payload: IncidentUpdateRequest,
    principal: Principal = Depends(require_permission("incidents", "update")),
):
    current = next(
        (
            item
            for item in incidents.get_feed().get("incidents", [])
            if item.get("id") == incident_id
        ),
        None,
    )

    if current is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    require_incident_scope(principal, current)

    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    operation_id = changes.pop("operation_id", None)
    expected_version = payload.expected_version
    force = payload.force or False

    result = incidents.update_incident_idempotent(
        incident_id,
        changes,
        subject=principal.subject,
        operation_id=operation_id,
        expected_version=expected_version,
        force=force,
    )

    if result["status"] == "failed":
        raise HTTPException(status_code=404, detail="Incident not found")

    if result["status"] == "conflict":
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Conflict detected: incident was modified on server",
                "conflict": True,
                "operation_id": operation_id,
                "replayed": result.get("replayed", False),
                "server_incident": redact_incident(
                    result["server_incident"], principal
                ),
                "expected_version": result["expected_version"],
                "current_version": result["current_version"],
                "conflicting_fields": result["conflicting_fields"],
            },
        )

    return redact_incident(result["incident"], principal)


@router.post("/sync", response_model=SyncBatchResponse)
def sync_batch(
    payload: SyncBatchRequest,
    principal: Principal = Depends(require_permission("incidents", "sync")),
):
    authorised_items = []

    for item in payload.items:
        item_data = item.model_dump()

        if item.action == "update":
            current = next(
                (
                    incident
                    for incident in incidents.get_feed().get("incidents", [])
                    if incident.get("id") == item.incident_id
                ),
                None,
            )

            if current is None:
                # A queued update may target an incident created earlier in the
                # same batch. Keep the item; the service resolves temporary
                # offline IDs and reports a failure if it still cannot.
                item_data["incident_id"] = item.incident_id
            else:
                try:
                    require_incident_scope(principal, current)
                except HTTPException:
                    item_data["incident_id"] = "UNAUTHORIZED"

        elif item.action == "create":
            if not has_permission(principal, "incidents", "create"):
                item_data["action"] = "unauthorized"
            else:
                create_region = (item.create_payload.region if item.create_payload else None)
                try:
                    require_create_scope(principal, create_region)
                except HTTPException:
                    item_data["action"] = "unauthorized"

        authorised_items.append(item_data)

    response = incidents.sync_queue_items(
        authorised_items,
        subject=principal.subject,
    )

    for result in response["results"]:
        if result.get("incident"):
            result["incident"] = redact_incident(
                result["incident"], principal
            )

        if result.get("server_incident"):
            result["server_incident"] = redact_incident(
                result["server_incident"], principal
            )

    return response


@router.put("/staffing/{region}", response_model=RegionStaffing)
def update_staffing(
    region: str,
    payload: StaffingUpdateRequest,
    principal: Principal = Depends(
        require_permission("incidents", "manage_staffing")
    ),
):
    if principal.role != "admin" and region not in principal.jurisdictions:
        raise HTTPException(status_code=404, detail="Region not found")

    if not incidents.set_staffing(region, payload.officers_on_duty):
        raise HTTPException(status_code=404, detail="Unknown region")

    return {"region": region, "officers_on_duty": payload.officers_on_duty}
