from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from datetime import datetime
import uuid
from app.models import EvidenceCreateRequest, EvidenceResponse, EvidenceAccessAudit, EvidenceExportRequest

router = APIRouter(prefix="/api/evidence", tags=["Evidence Vault"])

# In-memory vault repository
evidence_store = {}

ROLE_PERMISSIONS = {
    "public": ["operator", "analyst", "supervisor", "command_officer", "admin"],
    "internal": ["operator", "analyst", "supervisor", "command_officer", "admin"],
    "restricted": ["analyst", "supervisor", "command_officer", "admin"],
    "confidential": ["supervisor", "command_officer", "admin"]
}

@router.post("/upload", response_model=EvidenceResponse)
def upload_evidence(
    payload: EvidenceCreateRequest,
    x_user_id: str = Header("SYS_OPERATOR", alias="X-User-Id"),
    x_user_role: str = Header("operator", alias="X-User-Role")
):
    evidence_id = f"EVD-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow().isoformat()
    
    audit_entry = {
        "timestamp": now,
        "user_id": x_user_id,
        "user_role": x_user_role,
        "action": "UPLOAD"
    }
    
    record = {
        "evidence_id": evidence_id,
        "incident_id": payload.incident_id,
        "file_name": payload.file_name,
        "file_type": payload.file_type,
        "file_size_kb": payload.file_size_kb,
        "content_hash": payload.content_hash,
        "sensitivity_level": payload.sensitivity_level,
        "version": 1,
        "notes": payload.notes,
        "created_at": now,
        "access_history": [audit_entry]
    }
    
    evidence_store[evidence_id] = record
    return record

@router.get("/case/{incident_id}", response_model=List[EvidenceResponse])
def get_case_evidence(
    incident_id: str,
    x_user_id: str = Header("SYS_OPERATOR", alias="X-User-Id"),
    x_user_role: str = Header("operator", alias="X-User-Role")
):
    case_files = [ev for ev in evidence_store.values() if ev["incident_id"] == incident_id]
    accessible_files = []
    
    now = datetime.utcnow().isoformat()
    for item in case_files:
        allowed_roles = ROLE_PERMISSIONS.get(item["sensitivity_level"], [])
        if x_user_role in allowed_roles:
            item["access_history"].append({
                "timestamp": now,
                "user_id": x_user_id,
                "user_role": x_user_role,
                "action": "VIEW"
            })
            accessible_files.append(item)
            
    return accessible_files

@router.post("/export", response_model=dict)
def export_evidence_package(
    payload: EvidenceExportRequest,
    x_user_id: str = Header("SYS_COMMAND", alias="X-User-Id"),
    x_user_role: str = Header("command_officer", alias="X-User-Role")
):
    if x_user_role not in ["supervisor", "command_officer", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: Evidence export is restricted to supervisor and command roles."
        )
        
    exported_records = []
    now = datetime.utcnow().isoformat()
    
    for ev_id in payload.evidence_ids:
        if ev_id in evidence_store:
            record = evidence_store[ev_id]
            record["access_history"].append({
                "timestamp": now,
                "user_id": x_user_id,
                "user_role": x_user_role,
                "action": f"EXPORT ({payload.export_reason})"
            })
            exported_records.append(record)
            
    return {
        "export_id": f"EXP-{uuid.uuid4().hex[:8].upper()}",
        "export_timestamp": now,
        "export_reason": payload.export_reason,
        "exported_by": x_user_id,
        "total_files": len(exported_records),
        "files": exported_records
    }