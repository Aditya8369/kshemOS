"""
FastAPI Router for Section 63 BSA / 65B IEA Electronic Evidence Affidavit Compiler.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse

from app.models import (
    NtpSynchronizationRecord,
    Section63AffidavitRequest,
    Section63AffidavitResponse,
)
from app.services import evidence_affidavit as affidavit_service

router = APIRouter(prefix="/api/evidence-affidavit", tags=["Section 63 BSA / 65B IEA Affidavit Compiler"])


@router.post("/compile", response_model=Section63AffidavitResponse, status_code=201)
def compile_section63_affidavit_endpoint(payload: Section63AffidavitRequest):
    """
    Compiles a court-ready Section 63 BSA / 65B IEA Electronic Evidence Certificate.

    CRITICAL GATE:
    Verifies every artifact in the target bundle. If ANY artifact fails SHA-256
    integrity or custodial ledger hash chain validation, generation is BLOCKED
    and returns HTTP 422 Unprocessable Entity with tamper diagnostics.
    """
    try:
        result = affidavit_service.compile_section63_affidavit(
            case_id=payload.case_id,
            evidence_ids=payload.evidence_ids,
            investigating_officer=payload.investigating_officer,
            system_incharge=payload.system_incharge,
            court_name=payload.court_name,
            fir_crime_number=payload.fir_crime_number,
            affix_digital_signature=payload.affix_digital_signature,
        )
        return result
    except affidavit_service.TamperChainValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "COMPILATION_BLOCKED_TAMPER_DETECTED",
                "message": str(e),
                "failed_artifact_id": e.failed_artifact_id,
                "reason": e.reason,
                "statutory_note": "Under BSA § 63 and Arjun Panditrao Khotkar (2020), no certificate can be issued for compromised electronic records.",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/ntp-status", response_model=NtpSynchronizationRecord)
def get_ntp_status_endpoint():
    """Returns server clock Stratum 1 NTP synchronization verification record."""
    return affidavit_service.get_server_ntp_status()


@router.get("/hardware-profiles")
def get_hardware_profiles_endpoint():
    """Returns hardware signature profiles catalog for forensic acquisition modalities."""
    return affidavit_service.HARDWARE_SIGNATURE_CATALOG


@router.get("/preview-html/{case_id}", response_class=HTMLResponse)
def get_affidavit_preview_html(
    case_id: str,
    fir: Optional[str] = None,
    court: Optional[str] = None,
    affix_dsc: bool = False,
):
    """Returns court-ready printable HTML document directly for PDF/A print preview."""
    try:
        affidavit = affidavit_service.compile_section63_affidavit(
            case_id=case_id,
            fir_crime_number=fir,
            court_name=court,
            affix_digital_signature=affix_dsc,
        )
        return HTMLResponse(content=affidavit["court_printable_html"], status_code=200)
    except affidavit_service.TamperChainValidationError as e:
        error_html = f"""<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 40px; color: #b91c1c; background: #fef2f2;">
        <h2>⚠️ COMPILATION BLOCKED: TAMPER DETECTED</h2>
        <p><b>Artifact ID:</b> {e.failed_artifact_id}</p>
        <p><b>Reason:</b> {e.reason}</p>
        <p style="color: #6b7280; font-size: 12px;">Certificate compilation halted pursuant to Section 63 BSA & Supreme Court directives.</p>
        </body></html>"""
        return HTMLResponse(content=error_html, status_code=422)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

