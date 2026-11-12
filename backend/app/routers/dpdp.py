"""
FastAPI Router for DPDP Act Redaction & Identity Masking Pipeline.
All sensitive operations require server-authenticated identities.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.models import (
    DpdpAuditLogEntry,
    PiiSanitizationRequest,
    PiiSanitizationResponse,
    PseudonymizeFeedRequest,
    PseudonymizeFeedResponse,
    UnmaskApprovalRequest,
    UnmaskRequestCreate,
    UnmaskRequestRecord,
    UnmaskedValueResponse,
)
from app.security import Principal, require_permission
from app.services import dpdp_sanitization as dpdp_service

router = APIRouter(
    prefix="/api/dpdp",
    tags=["DPDP Act Redaction & Identity Masking"],
)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "127.0.0.1"


def _get_scoped_request(request_id: str, principal: Principal) -> dict:
    """Find a request without revealing records outside the caller's scope."""
    records = dpdp_service.list_unmask_requests()
    record = next(
        (item for item in records if item["request_id"] == request_id),
        None,
    )

    if record is None:
        raise HTTPException(status_code=404, detail="Request not found")

    if principal.role != "admin":
        allowed_cases = principal.case_ids
        if (
            record.get("record_id") not in allowed_cases
            and record.get("case_fir_number") not in allowed_cases
        ):
            raise HTTPException(status_code=404, detail="Request not found")

    return record


@router.post("/sanitize", response_model=PiiSanitizationResponse)
def sanitize_pii_endpoint(
    payload: PiiSanitizationRequest,
    principal: Principal = Depends(require_permission("dpdp", "sanitize")),
):
    """Sanitize citizen PII for an authenticated permitted role."""
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
        "statutory_compliance": (
            "Complies with Sections 4, 8 & 9 Digital Personal Data "
            "Protection Act, 2023 (DPDP Act) PII redaction standards."
        ),
    }


@router.post("/pseudonymize-feed", response_model=PseudonymizeFeedResponse)
def pseudonymize_threat_feed_endpoint(
    payload: PseudonymizeFeedRequest,
    principal: Principal = Depends(
        require_permission("dpdp", "pseudonymize")
    ),
):
    """Pseudonymize threat-feed data for an authenticated permitted role."""
    sanitized_items, total_redactions, tokenized_count = (
        dpdp_service.pseudonymize_threat_feed(
            feed_items=payload.feed_items,
            salt=payload.pseudonym_salt or dpdp_service.DEFAULT_SALT,
        )
    )

    return {
        "sanitized_items": sanitized_items,
        "total_redactions": total_redactions,
        "entities_tokenized": tokenized_count,
        "graph_topology_preserved": True,
        "statutory_compliance": (
            "DPDP Act 2023 § 8(5) Pseudonymized Threat Sharing Format"
        ),
    }


@router.post(
    "/unmask-request",
    response_model=UnmaskRequestRecord,
    status_code=status.HTTP_201_CREATED,
)
def submit_unmask_request_endpoint(
    payload: UnmaskRequestCreate,
    request: Request,
    principal: Principal = Depends(
        require_permission("dpdp", "request_unmask")
    ),
):
    """Submit an unmask request using the authenticated officer identity."""

    if principal.role != "admin":
        if (
            payload.record_id not in principal.case_ids
            and payload.case_fir_number not in principal.case_ids
        ):
            raise HTTPException(status_code=404, detail="Case not found")

    # Never trust badge IDs, names, or roles supplied by the client.
    request_data = payload.model_dump()
    request_data.update(
        requester_badge_id=principal.subject,
        requester_name=principal.subject,
        requester_role=principal.role.upper(),
    )

    return dpdp_service.submit_unmask_request(
        request_data,
        client_ip=_client_ip(request),
    )


@router.get(
    "/unmask-requests",
    response_model=list[UnmaskRequestRecord],
)
def list_unmask_requests_endpoint(
    case_id: Optional[str] = None,
    request_status: Optional[str] = Query(default=None, alias="status"),
    principal: Principal = Depends(
        require_permission("dpdp", "list_unmask")
    ),
):
    """List only unmask requests within the authenticated user's scope."""

    records = dpdp_service.list_unmask_requests(
        case_id=case_id,
        status=request_status,
    )

    if principal.role == "admin":
        return records

    return [
        record
        for record in records
        if (
            record.get("record_id") in principal.case_ids
            or record.get("case_fir_number") in principal.case_ids
        )
    ]


@router.post("/unmask-review", response_model=UnmaskRequestRecord)
def review_unmask_request_endpoint(
    payload: UnmaskApprovalRequest,
    request: Request,
    principal: Principal = Depends(
        require_permission("dpdp", "review_unmask")
    ),
):
    """Allow an authorised supervisor to review an in-scope request."""

    _get_scoped_request(payload.request_id, principal)

    try:
        return dpdp_service.review_unmask_request(
            request_id=payload.request_id,
            action=payload.action,
            # Authenticated identity replaces client-supplied identity.
            supervisor_badge_id=principal.subject,
            supervisor_name=principal.subject,
            approval_notes=payload.approval_notes,
            client_ip=_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/unmask-reveal", response_model=UnmaskedValueResponse)
def reveal_unmasked_value_endpoint(
    request_id: str = Query(..., description="Approved Unmask Request ID"),
    request: Request = None,
    principal: Principal = Depends(
        require_permission("dpdp", "reveal")
    ),
):
    """Reveal an approved value using the authenticated requester identity."""

    _get_scoped_request(request_id, principal)

    try:
        return dpdp_service.reveal_unmasked_value(
            request_id=request_id,
            requester_badge_id=principal.subject,
            client_ip=_client_ip(request) if request else "127.0.0.1",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


@router.get(
    "/audit-trail",
    response_model=list[DpdpAuditLogEntry],
)
def get_dpdp_audit_trail_endpoint(
    principal: Principal = Depends(
        require_permission("dpdp", "read_audit")
    ),
):
    """Return audit events restricted to the authenticated user's scope."""

    records = dpdp_service.get_dpdp_audit_trail()

    if principal.role == "admin":
        return records

    return [
        record
        for record in records
        if record.get("record_id") in principal.case_ids
    ]