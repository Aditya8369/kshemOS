"""
FastAPI Router for Cross-Jurisdiction Mutual Aid & Dynamic Resource Rebalancing.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import (
    CreateJointTaskforceRequest,
    DeclareMutualAidRequest,
    DelegateGuestUnitRequest,
    LogGuestActionRequest,
    MutualAidDeclaration,
    RebalanceEvaluationResponse,
    RevokeGuestUnitRequest,
)
from app.services import mutual_aid as mutual_aid_service

router = APIRouter(prefix="/api/mutual-aid", tags=["Cross-Jurisdiction Mutual Aid & Rebalancing"])


# ---------- Mutual Aid Declarations ----------

@router.get("/declarations")
def list_declarations(status: Optional[str] = None):
    return mutual_aid_service.list_declarations(status=status)


@router.post("/declarations", status_code=201)
def declare_mutual_aid(req: DeclareMutualAidRequest):
    try:
        return mutual_aid_service.declare_mutual_aid(
            service_area_id=req.service_area_id,
            declared_by=req.declared_by,
            requested_units_count=req.requested_units_count,
            target_neighbor_jurisdictions=req.target_neighbor_jurisdictions,
            notes=req.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/declarations/{declaration_id}/deescalate")
def deescalate_declaration(declaration_id: str, reason: str = Query("Workload normalized below threshold")):
    try:
        return mutual_aid_service.deescalate_declaration(declaration_id=declaration_id, reason=reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------- Temporary Guest Unit Access Delegation ----------

@router.get("/guest-delegations")
def list_guest_delegations(status: Optional[str] = None):
    return mutual_aid_service.list_guest_delegations(status=status)


@router.post("/guest-delegations", status_code=201)
def delegate_guest_unit(req: DelegateGuestUnitRequest):
    try:
        return mutual_aid_service.delegate_guest_unit(
            guest_officer_id=req.guest_officer_id,
            home_jurisdiction_id=req.home_jurisdiction_id,
            borrowing_jurisdiction_id=req.borrowing_jurisdiction_id,
            target_service_area_id=req.target_service_area_id,
            authorized_by=req.authorized_by,
            duration_hours=req.duration_hours,
            permissions=req.permissions,
            declaration_id=req.declaration_id,
            notes=req.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/guest-delegations/{delegation_id}/revoke")
def revoke_guest_delegation(delegation_id: str, req: RevokeGuestUnitRequest):
    try:
        return mutual_aid_service.revoke_guest_delegation(
            delegation_id=delegation_id,
            revoked_by=req.revoked_by,
            reason=req.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------- Master Audit Trail & Guest Actions ----------

@router.post("/guest-action", status_code=201)
def log_guest_action(req: LogGuestActionRequest):
    return mutual_aid_service.log_guest_action(
        guest_officer_id=req.guest_officer_id,
        incident_id=req.incident_id,
        action_type=req.action_type,
        details=req.details,
    )


@router.get("/guest-action-audit")
def get_guest_action_audit(officer_id: Optional[str] = None):
    return mutual_aid_service.get_guest_action_audit_log(guest_officer_id=officer_id)


@router.get("/sunset-audit")
def get_sunset_audit():
    return mutual_aid_service.get_sunset_audit_log()


# ---------- Joint Taskforce Workspaces ----------

@router.get("/joint-taskforces")
def list_joint_taskforces():
    return mutual_aid_service.list_joint_taskforces()


@router.post("/joint-taskforces", status_code=201)
def create_joint_taskforce(req: CreateJointTaskforceRequest):
    return mutual_aid_service.create_joint_taskforce(
        name=req.name,
        lead_jurisdiction_id=req.lead_jurisdiction_id,
        participating_jurisdiction_ids=req.participating_jurisdiction_ids,
        monitored_regions=req.monitored_regions,
        active_taskforce_officers=req.active_taskforce_officers,
        target_syndicate_tags=req.target_syndicate_tags,
        created_by=req.created_by,
        notes=req.notes,
    )


@router.get("/joint-taskforces/{taskforce_id}/workspace")
def get_joint_taskforce_workspace(taskforce_id: str):
    try:
        return mutual_aid_service.get_joint_taskforce_workspace(taskforce_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------- Dynamic Resource Rebalancing Evaluator ----------

@router.get("/rebalance-evaluation", response_model=RebalanceEvaluationResponse)
def evaluate_dynamic_rebalancing():
    return mutual_aid_service.evaluate_dynamic_rebalancing()

