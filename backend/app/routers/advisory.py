from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid
from app.models import AdvisoryCreate, AdvisoryStatusUpdate, AdvisoryResponse

router = APIRouter(prefix="/api/advisory", tags=["Advisory"])

# In-memory store (aligns with store.py pattern)
advisories_db = {}

TEMPLATES = [
    {
        "id": "tpl_digital_arrest",
        "name": "Digital Arrest Scam Warning",
        "title": "URGENT: Impersonation of Law Enforcement Agencies (CBI/Cyber Cell)",
        "severity": "critical",
        "target_audience": "citizens",
        "description": "Scammers are coercing citizens into video calls claiming digital arrest due to illegal packages. Do NOT share OTPs or transfer money. Law enforcement never demands money via video calls."
    },
    {
        "id": "tpl_counterfeit_notes",
        "name": "Counterfeit Banknote Alert",
        "title": "ALERT: High-Quality Fake ₹500 Notes Circulating",
        "severity": "high",
        "target_audience": "banks",
        "description": "Sophisticated counterfeit currency detected in regional hubs. Verify security thread features and latent image density immediately."
    }
]


@router.get("/templates")
def get_templates():
    return {"templates": TEMPLATES}


@router.post("/create", response_model=AdvisoryResponse)
def create_advisory(payload: AdvisoryCreate):
    advisory_id = f"ADV-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow().isoformat()

    advisory = {
        **payload.dict(),
        "id": advisory_id,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "delivery_status": {"sent": 0, "pending": 0, "failed": 0},
        "audit_trail": [
            {"action": "CREATED", "timestamp": now, "details": "Draft advisory created."}
        ]
    }
    advisories_db[advisory_id] = advisory
    return advisory


@router.get("/list", response_model=List[AdvisoryResponse])
def list_advisories(status: Optional[str] = None):
    items = list(advisories_db.values())
    if status:
        items = [i for i in items if i["status"] == status]
    return sorted(items, key=lambda x: x["created_at"], reverse=True)


@router.patch("/{advisory_id}/status", response_model=AdvisoryResponse)
def update_advisory_status(advisory_id: str, payload: AdvisoryStatusUpdate):
    if advisory_id not in advisories_db:
        raise HTTPException(status_code=404, detail="Advisory bulletin not found")

    advisory = advisories_db[advisory_id]
    now = datetime.utcnow().isoformat()
    old_status = advisory["status"]

    advisory["status"] = payload.status
    advisory["updated_at"] = now

    if payload.status == "published" and old_status != "published":
        advisory["delivery_status"] = {"sent": 1240, "pending": 15, "failed": 2}

    advisory["audit_trail"].append({
        "action": f"STATUS_CHANGE_TO_{payload.status.upper()}",
        "timestamp": now,
        "details": payload.reviewer_notes or f"Status transitioned from {old_status} to {payload.status}."
    })

    return advisory