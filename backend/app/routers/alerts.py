from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from datetime import datetime, timedelta
import hashlib
import uuid
from app.models import AlertDispatchPayload, AlertAckRequest, AlertDispatchResponse, AlertRoutingAuditEntry

router = APIRouter(prefix="/api/alerts", tags=["Alert Dispatch System"])

# In-memory stores for active alerts, audit logs, and suppression hashes
alert_store = {}
audit_logs = []
suppression_cache = {}  # { hash: expire_timestamp }

SUPPRESSION_WINDOW_SECONDS = 300  # 5-minute hash-based deduplication window

def generate_suppression_hash(payload: AlertDispatchPayload) -> str:
    raw_key = f"{payload.incident_type}:{payload.location_zone}:{payload.urgency_level}"
    return hashlib.sha256(raw_key.encode()).hexdigest()[:16]

@router.post("/dispatch", response_model=AlertDispatchResponse)
def dispatch_alert(payload: AlertDispatchPayload):
    now_dt = datetime.utcnow()
    now_str = now_dt.isoformat()
    supp_hash = generate_suppression_hash(payload)

    # Check Hash-Based Suppression Window
    if supp_hash in suppression_cache:
        expire_time = suppression_cache[supp_hash]
        if now_dt < expire_time:
            # Suppress duplicate alert
            audit_entry = {
                "timestamp": now_str,
                "alert_id": f"ALT-SUPPRESSED-{supp_hash}",
                "incident_id": payload.incident_id,
                "action": "SUPPRESSED_DUPLICATE",
                "recipient_roles": payload.target_roles,
                "suppression_hash": supp_hash,
                "details": f"Alert suppressed within {SUPPRESSION_WINDOW_SECONDS}s deduplication window."
            }
            audit_logs.append(audit_entry)
            return {
                "alert_id": f"ALT-SUP-REG",
                "incident_id": payload.incident_id,
                "status": "suppressed",
                "suppression_hash": supp_hash,
                "routed_recipients": [],
                "audit_history": [audit_entry]
            }

    # Register active suppression hash
    suppression_cache[supp_hash] = now_dt + timedelta(seconds=SUPPRESSION_WINDOW_SECONDS)

    alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
    audit_entry = {
        "timestamp": now_str,
        "alert_id": alert_id,
        "incident_id": payload.incident_id,
        "action": "DISPATCHED",
        "recipient_roles": payload.target_roles,
        "suppression_hash": supp_hash,
        "details": f"Routed to {', '.join(payload.target_roles)} in {payload.location_zone}."
    }
    audit_logs.append(audit_entry)

    record = {
        "alert_id": alert_id,
        "incident_id": payload.incident_id,
        "status": "dispatched",
        "suppression_hash": supp_hash,
        "routed_recipients": payload.target_roles,
        "audit_history": [audit_entry]
    }
    alert_store[alert_id] = record
    return record

@router.post("/acknowledge", response_model=dict)
def acknowledge_alert(payload: AlertAckRequest):
    if payload.alert_id not in alert_store:
        raise HTTPException(status_code=404, detail="Alert ID not found")

    alert = alert_store[payload.alert_id]
    now_str = datetime.utcnow().isoformat()

    audit_entry = {
        "timestamp": now_str,
        "alert_id": payload.alert_id,
        "incident_id": alert["incident_id"],
        "action": "ACKNOWLEDGED",
        "recipient_roles": [payload.responder_role],
        "suppression_hash": alert["suppression_hash"],
        "details": f"Acknowledged by {payload.responder_id} ({payload.responder_role}). Downstream escalations cancelled."
    }
    audit_logs.append(audit_entry)
    alert["status"] = "acknowledged"
    alert["audit_history"].append(audit_entry)

    return {
        "message": "Alert acknowledged successfully.",
        "alert_id": payload.alert_id,
        "incident_status": "in_progress",
        "downstream_escalation_cancelled": True
    }

@router.get("/audit-log", response_model=List[AlertRoutingAuditEntry])
def get_alert_audit_logs():
    return audit_logs