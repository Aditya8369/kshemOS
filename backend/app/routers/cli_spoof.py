"""
FastAPI Router for SIM Box & Spoofed Calling Line Identification (CLI) Detection Engine.
Prefix: /api/cli-spoof
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException, Path

from app.models import (
    TelecomTriageIncident,
    TelecomTriageSummary,
    TelephonyRouteVerificationRequest,
    TelephonyRouteVerificationResponse,
)
from app.services import cli_spoof_detection

router = APIRouter(prefix="/api/cli-spoof", tags=["CLI Spoof & SIM Box Detection"])


@router.post("/verify", response_model=TelephonyRouteVerificationResponse)
def verify_cli_route_endpoint(payload: TelephonyRouteVerificationRequest):
    """
    Verify incoming caller ID metadata, cross-referencing telecom circle numbering
    plans (TRAI), SIP trunk headers, latency/jitter telemetry, and rogue VoIP gateways.
    Surfaces the mandatory law enforcement advisory warning banner and forwards
    identified grey carrier ingress points to the officer telecom triage dashboard.
    """
    try:
        return cli_spoof_detection.verify_telephony_route(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Telephony verification error: {exc}")


@router.get("/telecom-triage", response_model=List[TelecomTriageIncident])
def get_telecom_triage_feed_endpoint():
    """
    Retrieve live feed of rogue carrier ingress points and spoofed CLI incidents
    forwarded to the Officer Telecom Triage Dashboard for telco blocking.
    """
    return cli_spoof_detection.get_telecom_triage_feed()


@router.post("/telecom-triage/{triage_id}/action")
def update_triage_incident_action_endpoint(
    triage_id: str = Path(..., description="Telecom triage incident identifier"),
    action: str = Body(..., embed=True, description="New status: BLOCKED_AT_GATEWAY, RESOLVED, etc."),
):
    """
    Update officer operational triage status on an identified carrier ingress point.
    """
    updated = cli_spoof_detection.update_triage_incident_status(triage_id, action)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Triage incident {triage_id} not found.")
    return {"status": "success", "incident": updated}


@router.get("/summary", response_model=TelecomTriageSummary)
def get_telecom_triage_summary_endpoint():
    """
    Summary counts of inspected calls, spoofed calls intercepted, SIM boxes isolated,
    and high-risk ingress IPs for the officer command dashboard.
    """
    return cli_spoof_detection.get_telecom_triage_summary()


@router.get("/trai-directory")
def get_trai_directory_endpoint():
    """
    Reference metadata covering TRAI STD telecom circles and verified official
    Indian law enforcement numbers.
    """
    return cli_spoof_detection.get_trai_reference_directory()

