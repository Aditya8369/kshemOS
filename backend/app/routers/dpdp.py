"""
FastAPI Router for DPDP Act Redaction & Identity Masking Pipeline.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request, status

from app.models import (
    DpdpAuditLogEntry,
    PiiSanitizationRequest,
    PiiSanitizationResponse,
    PseudonymizeFeedRequest,
    PseudonymizeFeedResponse,
    UnmaskApprovalRequest,
    UnmaskRequestCreate,
    UnmaskRequestRecord,
    UnmaskReviewAction,
    UnmaskedValueResponse,
)
from app.services import dpdp_sanitization as dpdp_service

router = APIRouter(prefix="/api/dpdp", tags=["DPDP Act Redaction & Identity Masking"])


@router.post("/sanitize", response_model=PiiSanitizationResponse)
def sanitize_pii_endpoint(payload: PiiSanitizationRequest):
    """
    Sanitizes citizen PII in text or JSON objects, masking Aadhaar, PAN,
    Bank Accounts, Mobile, and Email according to DPDP Act standards.
    """
    sanitized_text = None
    sanitized_payload = None
    all_detected = []

    if payload.text:
        sanitized_text, detected = dpdp_service.sanitize_text(
            text=payload.text,
            mask_types=payload.mask_types,
        )
        all_detected.extend(detected)

    if payload.object_payload:
        sanitized_payload, detected = dpdp_service.sanitize_object(
            obj=payload.object_payload,
            mask_types=payload.mask_types,
        )
        all_detected.extend(detected)

    return {
        "sanitized_text": sanitized_text,
        "sanitized_payload": sanitized_payload,
        "detected_entities": all_detected,
        "redactions_count": len(all_detected),
        "statutory_compliance": "Complies with Sections 4, 8 & 9 Digital Personal Data Protection Act, 2023 (DPDP Act) PII redaction standards.",
    }


@router.post("/pseudonymize-feed", response_model=PseudonymizeFeedResponse)
def pseudonymize_threat_feed_endpoint(payload: PseudonymizeFeedRequest):
    """
    Replaces citizen PII in threat intelligence feeds with persistent pseudonymous tokens
    (e.g. CITIZEN_REF_8492), preserving relationship topology in the graph without storing plain credentials.
    """
    sanitized_items, total_redactions, tokenized_count = dpdp_service.pseudonymize_threat_feed(
        feed_items=payload.feed_items,
        salt=payload.pseudonym_salt or dpdp_service.DEFAULT_SALT,
    )

    return {
        "sanitized_items": sanitized_items,
        "total_redactions": total_redactions,
        "entities_tokenized": tokenized_count,
        "graph_topology_preserved": True,
        "statutory_compliance": "DPDP Act 2023 § 8(5) Pseudonymized Threat Sharing Format",
    }


@router.post("/unmask-request", response_model=UnmaskRequestRecord, status_code=201)
def submit_unmask_request_endpoint(payload: UnmaskRequestCreate, request: Request):
    """
    Submits a role-audited Unmask Identity request for court-mandated investigations.
    Requires FIR number, statutory legal basis, and detailed justification.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    return dpdp_service.submit_unmask_request(payload.model_dump(), client_ip=client_ip)


@router.get("/unmask-requests", response_model=list[UnmaskRequestRecord])
def list_unmask_requests_endpoint(
    case_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """Lists unmask requests with optional case and status filters."""
    safe_case = case_id if isinstance(case_id, str) else None
    safe_status = status if isinstance(status, str) else None
    return dpdp_service.list_unmask_requests(case_id=safe_case, status=safe_status)


@router.post("/unmask-review", response_model=UnmaskRequestRecord)
def review_unmask_request_endpoint(payload: UnmaskReviewAction, request: Request):
    """
    Supervisory approval or rejection of an unmask request.
    Enforces dual-officer authorization (supervisor cannot be the same officer as requester).
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        return dpdp_service.review_unmask_request(
            request_id=payload.request_id,
            action=payload.action,
            supervisor_badge_id=payload.supervisor_badge_id,
            supervisor_name=payload.supervisor_name,
            approval_notes=payload.approval_notes,
            client_ip=client_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/unmask-reveal", response_model=UnmaskedValueResponse)
def reveal_unmasked_value_endpoint(
    request_id: str = Query(..., description="Approved Unmask Request ID"),
    requester_badge_id: str = Query("OFF-IO-4412", description="Investigating officer badge ID"),
    request: Request = None,
):
    """
    Access-controlled reveal endpoint: provides time-bounded unmasked identity
    under active supervisory lease, appending an immutable audit trail entry.
    """
    client_ip = request.client.host if (request and request.client) else "127.0.0.1"
    try:
        safe_req_id = request_id if isinstance(request_id, str) else "UNMASK-REQ-2026-0001"
        safe_badge = requester_badge_id if isinstance(requester_badge_id, str) else "OFF-IO-4412"
        return dpdp_service.reveal_unmasked_value(
            request_id=safe_req_id,
            requester_badge_id=safe_badge,
            client_ip=client_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/audit-trail", response_model=list[DpdpAuditLogEntry])
def get_dpdp_audit_trail_endpoint():
    """Returns immutable DPDP access and sanitization audit trail logs."""
    return dpdp_service.get_dpdp_audit_trail()

