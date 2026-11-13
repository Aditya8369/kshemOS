"""
FastAPI Router for Emergency Financial Kill-Switch & Aadhaar Biometric Lock.

Endpoints:
- GET /api/emergency-killswitch/banks: List all supported Indian banks with emergency syntaxes.
- GET /api/emergency-killswitch/banks/{bank_id}: Get detailed kill-switch details for a bank.
- GET /api/emergency-killswitch/aadhaar-guide: Official walkthrough and SMS codes for Aadhaar biometric lock.
- POST /api/emergency-killswitch/generate-receipt: Generate certified RBI Zero-Liability mitigation receipt.
- GET /api/emergency-killswitch/receipts/{receipt_id}: Retrieve an existing mitigation receipt.
- POST /api/emergency-killswitch/reset: Reset receipt store (for tests).
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from app.models import (
    AadhaarBiometricLockGuide,
    EmergencyKillSwitchBankInfo,
    EmergencyMitigationReceipt,
    EmergencyMitigationReceiptRequest,
)
from app.services import emergency_killswitch as service

router = APIRouter(prefix="/api/emergency-killswitch", tags=["Emergency Kill-Switch"])


@router.get("/banks", response_model=List[EmergencyKillSwitchBankInfo])
def list_banks():
    """Retrieve verified USSD and SMS emergency freeze instructions for all supported banks."""
    return service.get_all_banks()


@router.get("/banks/{bank_id}", response_model=EmergencyKillSwitchBankInfo)
def get_bank_details(bank_id: str):
    """Retrieve detailed kill-switch instructions for a specific bank."""
    bank = service.get_bank_by_id(bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"Bank not found: {bank_id}")
    return bank


@router.get("/aadhaar-guide", response_model=AadhaarBiometricLockGuide)
def get_aadhaar_guide():
    """Retrieve official step-by-step guidance to lock Aadhaar biometrics against AePS fraud."""
    return service.get_aadhaar_guide()


@router.post("/generate-receipt", response_model=EmergencyMitigationReceipt, status_code=201)
def generate_receipt(req: EmergencyMitigationReceiptRequest):
    """
    Generate an SHA-256 sealed Emergency Mitigation Receipt documenting prompt account freeze actions
    for RBI Zero-Liability compliance.
    """
    return service.generate_mitigation_receipt(req)


@router.get("/receipts/{receipt_id}", response_model=EmergencyMitigationReceipt)
def get_receipt(receipt_id: str):
    """Retrieve an existing emergency mitigation receipt by ID."""
    receipt = service.get_receipt_by_id(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail=f"Mitigation receipt not found: {receipt_id}")
    return receipt


@router.post("/reset", response_model=dict)
def reset_receipts():
    """Reset the mitigation receipts store (for testing)."""
    service.reset_receipt_store()
    return {"status": "reset_successful"}
