"""
FastAPI Router for Syndicate Group Parser and APK Triage.
Prefix: /api/syndicate-triage
"""

from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models import (
    ApkAnalyzeRequest,
    ApkAnalyzeResponse,
    SyndicateChatParseRequest,
    SyndicateChatParseResponse,
    SyndicateCorrelationResponse,
    SyndicateStatsResponse,
)
from app.services import syndicate_triage

router = APIRouter(prefix="/api/syndicate-triage", tags=["Syndicate & APK Triage"])


@router.post("/parse-chat", response_model=SyndicateChatParseResponse)
def parse_chat_endpoint(payload: SyndicateChatParseRequest):
    """
    Parse chat screenshots or export logs to extract syndicate invite links,
    admin phone numbers, crypto wallet addresses, and UPI payment handles.
    """
    try:
        result = syndicate_triage.parse_syndicate_chat(
            raw_text=payload.raw_text,
            incident_id=payload.incident_id,
            source_platform=payload.source_platform or "auto",
            officer_badge=payload.officer_badge or "OFFICER-SYS",
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat parsing error: {exc}")


@router.post("/analyze-apk", response_model=ApkAnalyzeResponse)
def analyze_apk_endpoint(payload: ApkAnalyzeRequest):
    """
    Safely perform static triage of an APK payload without bytecode execution.
    Inspects permissions, flags C2 endpoints, computes cryptographic hashes,
    and isolates the package in quarantine storage.
    """
    try:
        result = syndicate_triage.analyze_and_quarantine_apk(
            filename=payload.filename,
            file_bytes_base64=payload.file_bytes_base64,
            incident_id=payload.incident_id,
            officer_badge=payload.officer_badge or "OFFICER-SYS",
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"APK triage error: {exc}")


@router.post("/upload-apk", response_model=ApkAnalyzeResponse)
async def upload_apk_endpoint(
    file: UploadFile = File(...),
    incident_id: Optional[str] = Form(None),
    officer_badge: Optional[str] = Form("OFFICER-SYS"),
):
    """
    Direct file upload endpoint for APK binaries and test payloads.
    Performs safe static triage and isolates file in sandbox quarantine.
    """
    try:
        content = await file.read()
        result = syndicate_triage.analyze_and_quarantine_apk(
            filename=file.filename or "unknown.apk",
            raw_bytes=content,
            incident_id=incident_id,
            officer_badge=officer_badge or "OFFICER-SYS",
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"APK upload error: {exc}")


@router.get("/correlations", response_model=SyndicateCorrelationResponse)
def get_correlations_endpoint(
    indicator_type: Optional[str] = None,
    indicator_value: Optional[str] = None,
):
    """
    Retrieve linked syndicate clusters, cross-incident connections,
    and unified syndicate infrastructure mappings.
    """
    return syndicate_triage.get_syndicate_correlations(
        indicator_type=indicator_type,
        indicator_value=indicator_value,
    )


@router.get("/stats", response_model=SyndicateStatsResponse)
def get_stats_endpoint():
    """
    Summary counts of ingested chats, quarantined APKs, syndicate clusters,
    and tracked fraud infrastructure indicators.
    """
    return syndicate_triage.get_syndicate_stats()


@router.get("/artifacts/chats")
def list_chats_endpoint():
    """List all ingested syndicate chat artifacts."""
    return syndicate_triage.list_chat_artifacts()


@router.get("/artifacts/apks")
def list_apks_endpoint():
    """List all quarantined APK triage artifacts."""
    return syndicate_triage.list_apk_artifacts()


@router.get("/artifacts/{artifact_id}")
def get_artifact_endpoint(artifact_id: str):
    """Retrieve artifact details by artifact ID."""
    artifact = syndicate_triage.get_artifact(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact {artifact_id} not found.")
    return artifact

