"""HTTP endpoints for command drill simulations."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services import drills as drill_service
from app.services.drills import (
    DrillConflictError,
    DrillNotFoundError,
    DrillValidationError,
)

router = APIRouter(prefix="/api/drills", tags=["Command Drill Simulation"])


class DrillCreateRequest(BaseModel):
    scenario_id: str = Field(..., min_length=1, max_length=80)
    name: str | None = Field(None, min_length=3, max_length=100)

    @field_validator("scenario_id")
    @classmethod
    def normalize_scenario_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("scenario_id cannot be blank")
        return value

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if len(value) < 3:
            raise ValueError("name must contain at least 3 non-whitespace characters")
        return value


class DrillDecisionRequest(BaseModel):
    team: str = Field(..., min_length=1, max_length=80)
    objective_id: str = Field(..., min_length=1, max_length=80)
    action: str = Field(..., min_length=1, max_length=80)
    notes: str | None = Field(None, max_length=1000)

    @field_validator("team", "objective_id", "action")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value


class ResourceMovementRequest(BaseModel):
    resource_type: str = Field(..., min_length=1, max_length=60)
    quantity: int = Field(..., gt=0, le=1000)
    from_team: str = Field(..., min_length=1, max_length=80)
    to_team: str = Field(..., min_length=1, max_length=80)

    @field_validator("resource_type", "from_team", "to_team")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value


def _translate_error(exc: Exception) -> HTTPException:
    if isinstance(exc, DrillNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, DrillConflictError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, DrillValidationError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=500, detail="Unexpected drill service error")


@router.get("/scenarios")
def scenarios():
    """List available scenarios and their objectives without scoring keys."""
    return {"scenarios": drill_service.list_scenarios()}


@router.post("", status_code=201)
def start_drill(payload: DrillCreateRequest):
    try:
        return drill_service.create_drill(payload.scenario_id, payload.name)
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc


@router.get("")
def list_drills():
    return {"drills": drill_service.list_drills()}


@router.get("/{drill_id}")
def get_drill(drill_id: str):
    try:
        return drill_service.get_drill(drill_id)
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc


@router.post("/{drill_id}/advance")
def advance_drill(drill_id: str):
    """Release the next event in the scenario's deterministic event script."""
    try:
        return drill_service.advance_drill(drill_id)
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc


@router.post("/{drill_id}/decisions")
def record_decision(drill_id: str, payload: DrillDecisionRequest):
    try:
        return drill_service.record_decision(drill_id, **payload.model_dump())
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc


@router.post("/{drill_id}/resources/move")
def move_resources(drill_id: str, payload: ResourceMovementRequest):
    try:
        return drill_service.move_resources(drill_id, **payload.model_dump())
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc


@router.post("/{drill_id}/complete")
def complete_drill(drill_id: str):
    try:
        return drill_service.complete_drill(drill_id)
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc


@router.get("/{drill_id}/report")
def after_action_report(drill_id: str):
    try:
        return drill_service.get_after_action_report(drill_id)
    except (DrillNotFoundError, DrillConflictError, DrillValidationError) as exc:
        raise _translate_error(exc) from exc
