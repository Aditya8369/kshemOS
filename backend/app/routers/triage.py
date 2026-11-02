from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from datetime import datetime
from app.models import TriageScoreRequest, SeverityOverrideRequest, IncidentTriageResponse

router = APIRouter(prefix="/api/triage", tags=["Triage System"])

triage_store = {}

def calculate_severity(payload: TriageScoreRequest) -> str:
    if payload.incident_type == "digital_arrest" and payload.caller_claims_authority:
        return "critical"
    if payload.financial_loss_imminent or payload.urgency_level == "critical":
        return "critical"
    if payload.incident_type == "fraud_ring" or payload.urgency_level == "high":
        return "high"
    if payload.urgency_level == "medium":
        return "medium"
    return "low"

@router.post("/score", response_model=IncidentTriageResponse)
def score_incident(payload: TriageScoreRequest):
    now = datetime.utcnow().isoformat()
    auto_sev = calculate_severity(payload)
    
    entry = {
        "timestamp": now,
        "previous_severity": None,
        "new_severity": auto_sev,
        "updated_by": "SYSTEM_TRIAGE_ENGINE",
        "action_type": "AUTOMATED_TRIAGE",
        "reason": f"Evaluated incident type: {payload.incident_type}, urgency: {payload.urgency_level}"
    }
    
    triage_record = {
        "incident_id": payload.incident_id,
        "current_severity": auto_sev,
        "auto_calculated_severity": auto_sev,
        "is_overridden": False,
        "history": [entry]
    }
    
    triage_store[payload.incident_id] = triage_record
    return triage_record

@router.patch("/{incident_id}/override", response_model=IncidentTriageResponse)
def override_severity(
    incident_id: str, 
    payload: SeverityOverrideRequest,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role")
):
    if x_user_role not in ["supervisor", "command_officer", "admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Unauthorized: Severity overrides are restricted to supervisor and command roles."
        )
        
    if incident_id not in triage_store:
        raise HTTPException(status_code=404, detail="Incident record not found")
        
    record = triage_store[incident_id]
    now = datetime.utcnow().isoformat()
    prev_sev = record["current_severity"]
    
    history_entry = {
        "timestamp": now,
        "previous_severity": prev_sev,
        "new_severity": payload.new_severity,
        "updated_by": payload.supervisor_id,
        "action_type": "SUPERVISOR_OVERRIDE",
        "reason": payload.reason
    }
    
    record["current_severity"] = payload.new_severity
    record["is_overridden"] = True
    record["history"].append(history_entry)
    
    return record

@router.get("/{incident_id}", response_model=IncidentTriageResponse)
def get_incident_triage(incident_id: str):
    if incident_id not in triage_store:
        raise HTTPException(status_code=404, detail="Incident record not found")
    return triage_store[incident_id]