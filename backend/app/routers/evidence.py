"""
FastAPI Router for Automated Chain of Custody & Digital Evidence Vault.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request

from app.models import (
    CustodialActionRequest,
    EvidenceIngestRequest,
    EvidenceItem,
    ForensicExportBundle,
    LegalHoldToggleRequest,
)
from app.services import evidence as evidence_service

router = APIRouter(prefix="/api/evidence", tags=["Digital Evidence Vault & Custody"])


@router.get("/items", response_model=list[EvidenceItem])
def list_evidence(
    case_id: Optional[str] = None,
    category: Optional[str] = None,
    legal_hold: Optional[bool] = None,
):
    # Guard against FastAPI Query object evaluation during direct python invocation
    c_id = case_id if isinstance(case_id, str) else None
    cat = category if isinstance(category, str) else None
    lh = legal_hold if isinstance(legal_hold, bool) else None
    return evidence_service.list_evidence(case_id=c_id, category=cat, legal_hold=lh)


@router.get("/items/{evidence_id}")
def get_evidence(
    evidence_id: str,
    log_view: bool = False,
    officer_badge_id: str = "OFF-INSPECT",
):
    item = evidence_service.get_evidence(
        evidence_id=evidence_id,
        log_view=log_view,
        officer_badge_id=officer_badge_id,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found in vault")
    return item


@router.post("/ingest", response_model=EvidenceItem, status_code=201)
def ingest_evidence(payload: EvidenceIngestRequest):
    data = payload.model_dump()
    return evidence_service.ingest_evidence(data)


@router.get("/items/{evidence_id}/custody-ledger")
def get_custodial_ledger(evidence_id: str):
    item = evidence_service.get_evidence(evidence_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    return evidence_service.get_custodial_ledger(evidence_id)


@router.post("/items/{evidence_id}/log-action")
def log_action(evidence_id: str, payload: CustodialActionRequest):
    entry = evidence_service.log_custodial_action(
        evidence_id=evidence_id,
        action=payload.action,
        officer_badge_id=payload.officer_badge_id,
        officer_name=payload.officer_name,
        client_ip=payload.client_ip,
        details=payload.details,
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    return entry


@router.post("/items/{evidence_id}/legal-hold")
def toggle_legal_hold(evidence_id: str, payload: LegalHoldToggleRequest):
    item = evidence_service.toggle_legal_hold(
        evidence_id=evidence_id,
        legal_hold=payload.legal_hold,
        reason=payload.reason,
        officer_badge_id=payload.officer_badge_id,
        officer_name=payload.officer_name,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    return item


@router.post("/items/{evidence_id}/verify")
def verify_integrity(evidence_id: str):
    res = evidence_service.verify_evidence_integrity(evidence_id)
    if not res.get("verified") and res.get("error"):
        raise HTTPException(status_code=404, detail=res["error"])
    return res


@router.get("/forensic-bundle", response_model=ForensicExportBundle)
def generate_forensic_bundle(
    case_id: str = Query(..., description="Target Case or Incident ID"),
    officer_badge_id: str = Query("OFF-FORENSIC-LEAD", description="Authorizing officer badge"),
):
    safe_case_id = case_id if isinstance(case_id, str) else "CASE-2026-DELHI-01"
    safe_officer = officer_badge_id if isinstance(officer_badge_id, str) else "OFF-FORENSIC-LEAD"
    bundle = evidence_service.generate_forensic_export_bundle(
        case_id=safe_case_id,
        generated_by=safe_officer,
    )
    if not bundle:
        raise HTTPException(status_code=404, detail="Could not generate forensic bundle for case")
    return bundle


@router.get("/retention-policies")
def list_retention_policies():
    return evidence_service.list_retention_policies()
