"""
FastAPI Router for Offline-First Field Seizure & Device Triage Companion.

Endpoints:
- GET /api/field-seizure/records: List seized hardware records.
- GET /api/field-seizure/records/{seizure_id}: Get single record.
- POST /api/field-seizure/records: Create on-scene seizure record.
- POST /api/field-seizure/sync: Batch sync offline captures with conflict resolution.
- POST /api/field-seizure/verify-intake: Central forensics intake inspection & tamper check.
- GET /api/field-seizure/stats: Triage dashboard statistics.
- POST /api/field-seizure/reset: Reset store for tests.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import (
    CentralIntakeVerificationRequest,
    FieldSeizureCreateRequest,
    FieldSeizureRecord,
    FieldSeizureStatsResponse,
    FieldSeizureSyncRequest,
    FieldSeizureSyncResponse,
)
from app.services import field_seizure as service

router = APIRouter(prefix="/api/field-seizure", tags=["Field Seizure Companion"])


@router.get("/records", response_model=List[FieldSeizureRecord])
def list_seizure_records(
    case_id: Optional[str] = Query(None, description="Filter by Case ID"),
    sync_status: Optional[str] = Query(None, description="Filter by sync status"),
    tamper_flag: Optional[bool] = Query(None, description="Filter by tamper flag"),
):
    """Retrieve seized device records with optional filters."""
    return service.get_field_seizure_records(
        case_id=case_id,
        sync_status=sync_status,
        tamper_flag=tamper_flag,
    )


@router.get("/records/{seizure_id}", response_model=FieldSeizureRecord)
def get_seizure_record(seizure_id: str):
    """Retrieve a specific seized device record by ID."""
    rec = service.get_field_seizure_record(seizure_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Seizure record not found: {seizure_id}")
    return rec


@router.post("/records", response_model=FieldSeizureRecord, status_code=201)
def create_seizure_record(req: FieldSeizureCreateRequest):
    """Create a new seized device record on-scene with cryptographic genesis receipt."""
    return service.create_field_seizure_record(req)


@router.post("/sync", response_model=FieldSeizureSyncResponse)
def sync_offline_seizures(req: FieldSeizureSyncRequest):
    """
    Synchronizes offline-captured field seizure records with central Evidence Vault.
    Resolves conflicts via immutable timestamp order.
    """
    return service.sync_field_seizures(req)


@router.post("/verify-intake", response_model=FieldSeizureRecord)
def verify_central_intake(req: CentralIntakeVerificationRequest):
    """
    Performs physical central intake verification of a seized hardware evidence bag.
    Flags records where on-site capture hashes differ from central intake verification.
    """
    try:
        return service.verify_central_intake(req)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stats", response_model=FieldSeizureStatsResponse)
def get_seizure_stats():
    """Retrieve aggregate statistics for field seizures."""
    return service.get_field_seizure_stats()


@router.post("/reset", response_model=dict)
def reset_store():
    """Reset the field seizure store to initial seed state."""
    service.reset_field_seizure_store()
    return {"status": "reset_successful"}

