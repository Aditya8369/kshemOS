"""REST API endpoints for centralized audit logging."""

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from app.audit_models import (
    AuditEventListResponse,
    AuditIntegrityResponse,
)

from app.services import audit


router = APIRouter(
    prefix="/api/audit",
    tags=["Audit & Compliance"],
)


@router.get(
    "/events",
    response_model=AuditEventListResponse,
)
def search_audit_events(
    actor_id: Optional[str] = Query(None, max_length=128),
    action: Optional[str] = Query(None, max_length=160),
    resource_type: Optional[str] = Query(None, max_length=80),
    resource_id: Optional[str] = Query(None, max_length=256),
    outcome: Optional[Literal["success", "failure", "denied"]] = None,
    sensitive: Optional[bool] = None,
    unusual: Optional[bool] = None,
    from_ms: Optional[int] = Query(None, ge=0),
    to_ms: Optional[int] = Query(None, ge=0),
    search: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """
    Search and filter audit events.

    Results are returned newest first.
    """

    if from_ms is not None and to_ms is not None:
        if from_ms > to_ms:
            raise HTTPException(
                status_code=422,
                detail="from_ms cannot be greater than to_ms.",
            )

    return audit.list_events(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        sensitive=sensitive,
        unusual=unusual,
        from_ms=from_ms,
        to_ms=to_ms,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/integrity",
    response_model=AuditIntegrityResponse,
)
def verify_audit_integrity():
    """
    Verify the SHA-256 hash chain.

    Detects modified events and broken hash links.
    """

    return audit.verify_integrity()
