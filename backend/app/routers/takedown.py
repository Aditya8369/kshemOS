"""
FastAPI Router for Automated Registrar & Hosting Abuse Takedown Notice Generator.
Prefix: /api/takedown
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path

from app.models import (
    TakedownNoticeRecord,
    TakedownNoticeRequest,
    TakedownNoticeStatusUpdateRequest,
    TakedownStatsResponse,
)
from app.services import takedown_service

router = APIRouter(prefix="/api/takedown", tags=["Abuse Takedown Notice Generator"])


@router.post("/generate", response_model=TakedownNoticeRecord)
def generate_takedown_notice_endpoint(payload: TakedownNoticeRequest):
    """
    Resolves DNS/WHOIS records, correlates hosting providers and registrars,
    formats an RFC-compliant takedown notice with certified CERT-In references,
    and seals the package in the Evidence Vault.
    """
    try:
        return takedown_service.generate_takedown_notice(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Takedown generation error: {exc}")


@router.get("/notices", response_model=List[TakedownNoticeRecord])
def list_takedown_notices_endpoint(
    status: Optional[str] = None,
    limit: int = 50,
):
    """
    Returns history of takedown notices, optionally filtered by status (DISPATCHED, UNDER_REVIEW, etc.).
    """
    return takedown_service.list_takedown_notices(status=status, limit=limit)


@router.get("/notices/{notice_id}", response_model=TakedownNoticeRecord)
def get_takedown_notice_endpoint(
    notice_id: str = Path(..., description="Unique notice identifier e.g. ABUSE-2026-1001"),
):
    """
    Retrieve full details, RFC email body, DNS telemetry, and lifecycle events for a notice.
    """
    result = takedown_service.get_takedown_notice(notice_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Takedown notice {notice_id} not found.")
    return result


@router.post("/notices/{notice_id}/status", response_model=TakedownNoticeRecord)
def update_takedown_status_endpoint(
    notice_id: str = Path(..., description="Takedown notice identifier"),
    payload: TakedownNoticeStatusUpdateRequest = ...,
):
    """
    Update takedown notice lifecycle status (e.g. UNDER_REVIEW, DOMAIN_SUSPENDED, SLA_BREACHED).
    """
    updated = takedown_service.update_takedown_status(notice_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Takedown notice {notice_id} not found.")
    return updated


@router.post("/notices/{notice_id}/check-dns")
def check_domain_dns_endpoint(
    notice_id: str = Path(..., description="Takedown notice identifier"),
):
    """
    Probes DNS resolution and online status for the flagged domain.
    Notifies investigating officers if the domain went offline (NXDOMAIN) or nameservers churned.
    """
    probe_result = takedown_service.probe_domain_status(notice_id)
    if not probe_result:
        raise HTTPException(status_code=404, detail=f"Takedown notice {notice_id} not found.")
    return probe_result


@router.post("/{notice_id}/dispatch-api")
@router.post("/notices/{notice_id}/dispatch-api")
def dispatch_takedown_api_endpoint(
    notice_id: str = Path(..., description="Takedown notice identifier e.g. ABUSE-2026-1001"),
):
    """
    Automated Abuse Dispatch API Integration:
    Queries detected provider (Cloudflare, Safe Browsing, CERT-In) and dispatches
    API abuse reports and PGP-encrypted XML packages.
    """
    result = takedown_service.dispatch_takedown_api(notice_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Takedown notice {notice_id} not found.")
    return result


@router.post("/poll-all")
def poll_all_takedowns_endpoint():
    """
    Triggers an automated polling sweep across all active takedown notices,
    probing HTTP 404/403/NXDOMAIN states and updating suspended domains.
    """
    return takedown_service.poll_all_domains_once()


@router.get("/stats", response_model=TakedownStatsResponse)
def get_takedown_stats_endpoint():
    """
    Aggregated operational statistics: total notices dispatched, active under review,
    domains suspended, SLA breaches, and offline domains detected.
    """
    return takedown_service.get_takedown_stats()

