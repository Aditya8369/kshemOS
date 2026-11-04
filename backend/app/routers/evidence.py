"""
FastAPI Router for Automated Chain of Custody, Digital Evidence Vault,
and Secure Evidence Upload Links with Expiry & Custodial Metadata.
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
    CreateUploadLinkRequest,
    RevokeUploadLinkRequest,
    UploadEvidenceViaLinkRequest,
    UploadReceipt,
    SecureUploadLink,
    UploadLinkValidationResponse,
)
from app.services import evidence as evidence_service
from app.services import evidence_upload_link as upload_link_service

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


# ======================================================
# SECURE EVIDENCE UPLOAD LINKS ENDPOINTS
# ======================================================

@router.post("/upload-links", response_model=SecureUploadLink, status_code=201)
def create_upload_link(payload: CreateUploadLinkRequest):
    """
    Generates a single-purpose, case-scoped evidence upload link with expiry
    bound to specific allowed MIME types.
    """
    return upload_link_service.create_upload_link(payload.model_dump())


@router.get("/upload-links", response_model=list[SecureUploadLink])
def list_upload_links(
    report_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """Lists upload links filtered by report/incident ID or status."""
    r_id = report_id if isinstance(report_id, str) else None
    st = status if isinstance(status, str) else None
    return upload_link_service.list_upload_links(report_id=r_id, status=st)


@router.get("/upload-links/{link_id}", response_model=SecureUploadLink)
def get_upload_link(link_id: str):
    """Retrieves upload link details."""
    link = upload_link_service.get_upload_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Upload link not found")
    return link


@router.post("/upload-links/{link_id}/revoke", response_model=SecureUploadLink)
def revoke_upload_link(link_id: str, payload: RevokeUploadLinkRequest):
    """Allows authorised officers to revoke active upload links."""
    try:
        return upload_link_service.revoke_upload_link(
            link_id=link_id,
            revoked_by_badge=payload.revoked_by_badge,
            officer_name=payload.officer_name,
            revocation_reason=payload.revocation_reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/upload/validate", response_model=UploadLinkValidationResponse)
def validate_upload_token(token: str, passcode: Optional[str] = None):
    """
    Public validation endpoint for citizens accessing an upload link.
    Validates token, expiry, and optional verification passcode.
    """
    p_code = passcode if isinstance(passcode, str) else None
    res = upload_link_service.validate_upload_token(token=token, passcode=p_code)
    return res


@router.post("/upload/fulfill")
def fulfill_evidence_upload(payload: UploadEvidenceViaLinkRequest):
    """
    Citizen upload fulfillment:
    Ingests file into Evidence Vault, computes SHA-256 fingerprint,
    appends chain-of-custody ledger entry, seals the single-purpose link,
    and returns an immutable digital receipt.
    """
    try:
        result = upload_link_service.upload_evidence_via_link(
            token=payload.token,
            upload_data=payload.model_dump(),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
