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
    get_current_principal,
    has_permission,
    redact_incident,
    require_create_scope,
    require_incident_scope,
    require_region_access,
)

router = APIRouter(
    prefix="/api/incidents",
    tags=["Operational Incident Dashboard"],
)


def _require_action(principal: Principal, action: str) -> None:
    if not has_permission(principal, "incidents", action):
        raise HTTPException(status_code=403, detail="Access forbidden")


def _incident_for_principal(incident_id: str, principal: Principal) -> dict:
    incident = next(
        (
            item
            for item in incidents.get_feed().get("incidents", [])
            if item.get("id") == incident_id
        ),
        None,
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    require_incident_scope(principal, incident)
    return incident


def _validate_create(payload: IncidentCreateRequest, principal: Principal) -> None:
    region = (
        payload.region
        if payload.region in incidents.REGIONS
        else incidents.UNSPECIFIED_REGION
    )
    require_create_scope(principal, region)


def _validate_update(
    changes: dict,
    incident: dict,
    principal: Principal,
    force: bool,
) -> None:
    if force and principal.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Forced version overrides are not permitted",
        )

    if principal.role == "responder":
        if incident.get("assigned_to") != principal.officer_id:
            raise HTTPException(
                status_code=403,
                detail="Responders may update only incidents assigned to them",
            )
        forbidden = set(changes) - {"status"}
        if forbidden:
            raise HTTPException(
                status_code=403,
                detail="Responders may only update incident status",
            )


def _visible_regions(principal: Principal, regions: list[str]) -> list[str]:
    if principal.role == "admin":
        return regions

    visible = []
    for region in regions:
        try:
            require_region_access(region, principal)
        except HTTPException:
            continue
        visible.append(region)
    return visible


@router.get("", response_model=IncidentFeedResponse)
def feed(principal: Principal = Depends(get_current_principal)):
    _require_action(principal, "read")
    result = incidents.get_feed()

    visible_incidents = []
    for incident in result.get("incidents", []):
        try:
            require_incident_scope(principal, incident)
        except HTTPException:
            continue
        visible_incidents.append(redact_incident(incident, principal))

    visible_regions = set(_visible_regions(principal, result.get("regions", [])))
    result["incidents"] = visible_incidents
    result["regions"] = [
        region for region in result.get("regions", [])
        if region in visible_regions
    ]
    result["staffing"] = [
        item for item in result.get("staffing", [])
        if item.get("region") in visible_regions
    ]
    return result


@router.post("", response_model=Incident, status_code=201)
def create(
    payload: IncidentCreateRequest,
    principal: Principal = Depends(get_current_principal),
):
    _require_action(principal, "create")
    _validate_create(payload, principal)
    data = payload.model_dump()
    operation_id = data.pop("operation_id", None)
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
    principal: Principal = Depends(get_current_principal),
):
    _require_action(principal, "update")
    current = _incident_for_principal(incident_id, principal)

    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    operation_id = changes.pop("operation_id", None)
    changes.pop("expected_version", None)
    changes.pop("force", None)
    force = payload.force
    _validate_update(changes, current, principal, force)

    result = incidents.update_incident_idempotent(
        incident_id,
        changes,
        subject=principal.subject,
        operation_id=operation_id,
        expected_version=payload.expected_version,
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
    principal: Principal = Depends(get_current_principal),
):
    _require_action(principal, "sync")
    authorised_items = []

    for item in payload.items:
        item_data = item.model_dump()

        if item.action == "create":
            if item.create_payload is None:
                raise HTTPException(
                    status_code=400,
                    detail="Sync create item requires create_payload",
                )
            if not has_permission(principal, "incidents", "create"):
                item_data["action"] = "unauthorized"
            else:
                try:
                    _validate_create(item.create_payload, principal)
                except HTTPException:
                    item_data["action"] = "unauthorized"

        elif item.action == "update":
            if not item.incident_id or item.changes is None:
                raise HTTPException(
                    status_code=400,
                    detail="Sync update item requires incident_id and changes",
                )

            current = next(
                (
                    incident
                    for incident in incidents.get_feed().get("incidents", [])
                    if incident.get("id") == item.incident_id
                ),
                None,
            )
            if current is not None:
                try:
                    require_incident_scope(principal, current)
                    changes = item.changes.model_dump(
                        exclude_unset=True,
                        exclude_none=True,
                    )
                    changes.pop("operation_id", None)
                    changes.pop("expected_version", None)
                    changes.pop("force", None)
                    _validate_update(
                        changes,
                        current,
                        principal,
                        item.force or item.changes.force,
                    )
                except HTTPException:
                    item_data["incident_id"] = "UNAUTHORIZED"

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
    principal: Principal = Depends(get_current_principal),
):
    _require_action(principal, "manage_staffing")
    require_region_access(region, principal)
    if not incidents.set_staffing(region, payload.officers_on_duty):
        raise HTTPException(status_code=404, detail="Unknown region")
    return {"region": region, "officers_on_duty": payload.officers_on_duty}
