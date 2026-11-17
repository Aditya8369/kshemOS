"""
FastAPI Router for Automated UPI Mule Account Freeze Dispatch via CFCFRMS / 1930 Protocol.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models import (
    DispatchFreezeRequest,
    FreezeEvaluationRequest,
    FreezeEvaluationResponse,
    FreezeRecordResponse,
    FreezeStatsResponse,
    ParseFinancialEntitiesRequest,
    ParseFinancialEntitiesResponse,
    RecordBankAcknowledgmentRequest,
    RevokeFreezeRequest,
)
from app.services import mule_freeze

router = APIRouter(prefix="/api/mule-freeze", tags=["UPI Mule Account Freeze (CFCFRMS / 1930)"])


@router.post("/parse", response_model=ParseFinancialEntitiesResponse)
def parse_entities(payload: ParseFinancialEntitiesRequest):
    """
    Extract UPI VPAs, UTR numbers, IFSC codes, and potential bank account numbers
    from unstructured citizen complaints, notes, or messages.
    """
    result = mule_freeze.parse_financial_entities(payload.text)
    return result


@router.post("/evaluate", response_model=FreezeEvaluationResponse)
def evaluate_freeze(payload: FreezeEvaluationRequest):
    """
    Evaluate fraud signals, compute fraud graph hop distance and transaction velocity,
    and determine the appropriate NPCI Priority Stop and debit freeze tier.
    """
    try:
        evaluation = mule_freeze.evaluate_freeze_priority(
            vpa=payload.vpa,
            account_number=payload.account_number,
            ifsc=payload.ifsc,
            utr_number=payload.utr_number,
            transaction_amount=payload.transaction_amount,
            transaction_timestamp_iso=payload.transaction_timestamp_iso,
            recent_transactions=payload.recent_transactions,
            is_digital_arrest=payload.is_digital_arrest,
        )
        return evaluation
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/dispatch", response_model=FreezeRecordResponse)
def dispatch_freeze(payload: DispatchFreezeRequest):
    """
    Officer-authorized dispatch: Generates statutory Section 91 & 102 CrPC notice
    and CFCFRMS payload, records genesis audit trail, and queues freeze mandate for bank transmission.
    """
    try:
        record = mule_freeze.dispatch_freeze_request(
            incident_id=payload.incident_id,
            suspect_vpa=payload.suspect_vpa,
            suspect_account=payload.suspect_account,
            suspect_ifsc=payload.suspect_ifsc,
            utr_number=payload.utr_number,
            transaction_amount=payload.transaction_amount,
            transaction_timestamp_iso=payload.transaction_timestamp_iso,
            recent_transactions=payload.recent_transactions,
            officer_name=payload.officer_name,
            officer_badge_id=payload.officer_badge_id,
            police_station=payload.police_station,
            is_digital_arrest=payload.is_digital_arrest,
            victim_details=payload.victim_details,
        )
        return record
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.get("/requests", response_model=List[FreezeRecordResponse])
def list_freezes(
    incident_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority_tier: Optional[str] = Query(None),
    vpa: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """List all dispatched provisional debit freeze requests with optional filters."""
    return mule_freeze.list_freeze_requests(
        incident_id=incident_id,
        status=status,
        priority_tier=priority_tier,
        vpa=vpa,
        limit=limit,
    )


@router.get("/requests/{freeze_id}", response_model=FreezeRecordResponse)
def get_freeze(freeze_id: str):
    """Retrieve full detail of a specific freeze request including legal text, CFCFRMS payload, and audit events."""
    record = mule_freeze.get_freeze_request(freeze_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Freeze request not found: {freeze_id}",
        )
    return record


@router.post("/requests/{freeze_id}/acknowledge", response_model=FreezeRecordResponse)
def acknowledge_freeze(freeze_id: str, payload: RecordBankAcknowledgmentRequest):
    """
    Record or simulate the bank nodal officer / NPCI automated acknowledgment response.
    Updates freeze status and response latency SLA.
    """
    try:
        updated = mule_freeze.record_bank_acknowledgment(
            freeze_id=freeze_id,
            bank_nodal_ref=payload.bank_nodal_ref,
            freeze_outcome=payload.freeze_outcome,
            notes=payload.notes,
        )
        return updated
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/requests/{freeze_id}/revoke", response_model=FreezeRecordResponse)
def revoke_freeze(freeze_id: str, payload: RevokeFreezeRequest):
    """Officer-initiated revocation / lifting of provisional debit freeze order."""
    try:
        updated = mule_freeze.revoke_freeze_request(
            freeze_id=freeze_id,
            revoking_officer_badge_id=payload.revoking_officer_badge_id,
            revocation_reason=payload.revocation_reason,
        )
        return updated
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/stats", response_model=FreezeStatsResponse)
def get_stats():
    """Retrieve aggregate statistics for the Mule Account Freeze Dashboard."""
    return mule_freeze.get_freeze_stats()

