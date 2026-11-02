from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services import jurisdiction as jurisdiction_service

router = APIRouter(prefix="/api/jurisdiction", tags=["Jurisdiction & Zone Configuration"])


class DispatchEvaluationRequest(BaseModel):
    category: str = Field(..., description="Incident category, e.g. digital_arrest")
    severity: str = Field(..., description="Incident severity: low, medium, high, critical")
    region: str = Field(..., description="Target region, e.g. Central Zone")


class ReviewProposalRequest(BaseModel):
    reviewer_code: str = Field(..., description="Reviewing commanding officer code")
    decision: str = Field(..., description="approved or rejected")
    reviewer_notes: str = Field(..., description="Review remarks and rationale")


class RestoreSnapshotRequest(BaseModel):
    restored_by: str = Field(default="OFFICER", description="Author initiating rollback")


# ---------- Jurisdictions ----------

@router.get("/jurisdictions")
def list_jurisdictions():
    return jurisdiction_service.list_jurisdictions()


@router.get("/jurisdictions/{jurisdiction_id}")
def get_jurisdiction(jurisdiction_id: str):
    j = jurisdiction_service.get_jurisdiction(jurisdiction_id)
    if not j:
        raise HTTPException(status_code=404, detail="Jurisdiction not found")
    return j


@router.post("/jurisdictions")
def create_jurisdiction(payload: dict[str, Any], author: str = "OFFICER"):
    return jurisdiction_service.create_jurisdiction(payload, author=author)


@router.put("/jurisdictions/{jurisdiction_id}")
def update_jurisdiction(jurisdiction_id: str, payload: dict[str, Any], author: str = "OFFICER"):
    j = jurisdiction_service.update_jurisdiction(jurisdiction_id, payload, author=author)
    if not j:
        raise HTTPException(status_code=404, detail="Jurisdiction not found")
    return j


# ---------- Service Areas ----------

@router.get("/service-areas")
def list_service_areas():
    return jurisdiction_service.list_service_areas()


@router.get("/service-areas/{service_area_id}")
def get_service_area(service_area_id: str):
    sa = jurisdiction_service.get_service_area(service_area_id)
    if not sa:
        raise HTTPException(status_code=404, detail="Service area not found")
    return sa


@router.post("/service-areas")
def save_service_area(
    payload: dict[str, Any],
    force_apply: bool = False,
    author: str = "OFFICER",
):
    res = jurisdiction_service.save_service_area(
        data=payload,
        author=author,
        force_apply=force_apply,
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@router.post("/validate-boundary")
def validate_boundary(payload: dict[str, Any], existing_id: Optional[str] = None):
    target_id = existing_id or payload.get("id")
    existing = jurisdiction_service.get_service_area(target_id) if target_id else None
    return jurisdiction_service.validate_service_area_update(existing, payload)


# ---------- Dispatch Rules ----------

@router.get("/dispatch-rules")
def list_dispatch_rules():
    return jurisdiction_service.list_dispatch_rules()


@router.post("/dispatch-rules")
def save_dispatch_rule(payload: dict[str, Any], author: str = "OFFICER"):
    return jurisdiction_service.save_dispatch_rule(payload, author=author)


@router.delete("/dispatch-rules/{rule_id}")
def delete_dispatch_rule(rule_id: str):
    deleted = jurisdiction_service.delete_dispatch_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dispatch rule not found")
    return {"status": "deleted", "rule_id": rule_id}


@router.post("/evaluate-dispatch")
def evaluate_dispatch(req: DispatchEvaluationRequest):
    rule = jurisdiction_service.match_dispatch_rule(
        category=req.category,
        severity=req.severity,
        region=req.region,
    )
    if not rule:
        return {"matched": False, "rule": None}
    return {"matched": True, "rule": rule}


# ---------- Change Proposals & Multi-Officer Review ----------

@router.get("/proposals")
def list_proposals(status: Optional[str] = None):
    # Protect against FastAPI Query object injection when called directly
    safe_status = status if isinstance(status, str) else None
    return jurisdiction_service.list_change_proposals(status=safe_status)


@router.post("/proposals/{proposal_id}/review")
def review_proposal(proposal_id: str, req: ReviewProposalRequest):
    if req.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")
    res = jurisdiction_service.review_change_proposal(
        proposal_id=proposal_id,
        reviewer_code=req.reviewer_code,
        decision=req.decision,
        reviewer_notes=req.reviewer_notes,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Change proposal not found")
    return res


# ---------- Configuration Snapshots & Audit Rollback ----------

@router.get("/snapshots")
def list_snapshots():
    return jurisdiction_service.list_snapshots()


@router.get("/snapshots/diff")
def diff_snapshots(
    snap_a: str = Query(..., description="First snapshot ID"),
    snap_b: str = Query(..., description="Second snapshot ID"),
):
    diff = jurisdiction_service.diff_snapshots(snap_a, snap_b)
    if not diff:
        raise HTTPException(status_code=404, detail="One or both snapshots not found")
    return diff


@router.get("/snapshots/{snapshot_id}")
def get_snapshot(snapshot_id: str):
    snap = jurisdiction_service.get_snapshot(snapshot_id)
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snap


@router.post("/snapshots/{snapshot_id}/restore")
def restore_snapshot(snapshot_id: str, req: Optional[RestoreSnapshotRequest] = None):
    restored_by = req.restored_by if req else "OFFICER"
    new_snap = jurisdiction_service.restore_snapshot(snapshot_id, restored_by=restored_by)
    if not new_snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {
        "status": "restored",
        "restored_snapshot_id": snapshot_id,
        "new_snapshot": new_snap,
    }

