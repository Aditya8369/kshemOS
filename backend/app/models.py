"""
Pydantic models shared across KshemOS backend routers.
"""
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ---------- Scam / Digital Arrest Agent ----------

class ScamAnalyzeRequest(BaseModel):
    transcript: str = Field(..., description="Live or recorded call transcript text")
    caller_number: Optional[str] = Field(None, description="Caller phone number, if known")
    caller_claims_to_be: Optional[str] = Field(
        None, description="What the caller claims to be, e.g. 'CBI officer'"
    )


class ScamAnalyzeResponse(BaseModel):
    risk_score: int = Field(..., ge=0, le=100)
    risk_band: str  # "low" | "medium" | "high" | "critical"
    matched_patterns: list[str]
    matched_known_scam_similarity: float
    recommendation: str
    explanation: str


# ---------- Counterfeit Currency Agent ----------

class CurrencyScanResponse(BaseModel):
    verdict: str  # "likely_genuine" | "suspicious" | "inconclusive"
    confidence: float
    reasons: list[str]
    signals: dict


# ---------- Fraud Graph Agent ----------

class RingLookupResponse(BaseModel):
    account_id: str
    is_flagged: bool
    mule_probability: float
    ring_id: Optional[str]
    connected_accounts: list[str]
    shared_signals: list[str]


# ---------- Citizen Assistant Agent ----------

class CitizenReportRequest(BaseModel):
    reporter_name: str
    language: str = Field("English", description="Preferred reply language")
    category: str = Field(..., description="scam_call | counterfeit | fraud_tx | other")
    description: str
    region: Optional[str] = Field(None, description="Operational region the incident belongs to")


class CitizenReportResponse(BaseModel):
    report_id: str
    incident_id: str
    acknowledgement: str
    draft_fir: str


class CitizenAskRequest(BaseModel):
    question: str
    language: str = Field("English", description="Preferred reply language")


class CitizenAskResponse(BaseModel):
    answer: str


# ---------- Officer Copilot ----------

class CaseSummaryResponse(BaseModel):
    case_id: str
    priority: str
    summary: str
    suggested_next_steps: list[str]


# ---------- Operational Incident Dashboard ----------

Severity = Literal["critical", "high", "medium", "low"]
IncidentStatus = Literal["new", "triaged", "in_progress", "escalated", "resolved"]


class Incident(BaseModel):
    id: str
    report_id: Optional[str]
    title: str
    description: str
    category: str
    severity: Severity
    previous_severity: Optional[Severity]
    region: str
    status: IncidentStatus
    assigned_to: Optional[str]
    linked_account: Optional[str]
    opened_at: int = Field(..., description="Epoch milliseconds")
    first_response_at: Optional[int]
    resolved_at: Optional[int]


class IncidentCreateRequest(BaseModel):
    category: str = Field(..., description="scam_call | counterfeit | fraud_tx | other")
    description: str = Field(..., min_length=1)
    region: Optional[str] = None
    report_id: Optional[str] = None
    linked_account: Optional[str] = None


class IncidentUpdateRequest(BaseModel):
    status: Optional[IncidentStatus] = None
    severity: Optional[Severity] = None
    assigned_to: Optional[str] = Field(None, description="Officer code; empty string unassigns")
    linked_account: Optional[str] = Field(None, description="Account ID; empty string unlinks")


class RegionStaffing(BaseModel):
    region: str
    officers_on_duty: int


class StaffingUpdateRequest(BaseModel):
    officers_on_duty: int = Field(..., ge=0, le=500)


class IncidentFeedResponse(BaseModel):
    regions: list[str]
    staffing: list[RegionStaffing]
    incidents: list[Incident]


# ---------- Public Advisory Bulletin Composer ----------

class AdvisoryCreate(BaseModel):
    title: str = Field(..., description="Advisory bulletin title")
    description: str = Field(..., description="Detailed warning and safety guidance")
    severity: str = Field(..., description="Severity level: low | medium | high | critical")
    affected_location: str = Field(..., description="Impacted region or location")
    target_audience: str = Field(..., description="Audience: citizens | banks | telecom | officers | all")
    template_type: Optional[str] = Field(None, description="Optional emergency template ID used")


class AdvisoryStatusUpdate(BaseModel):
    status: str = Field(..., description="Status: draft | pending_approval | approved | published | rejected")
    reviewer_notes: Optional[str] = Field(None, description="Optional notes regarding approval/rejection")

class EvidenceCreateRequest(BaseModel):
    incident_id: str
    file_name: str
    file_type: str = Field(..., description="document | image | audio | video | operational_note")
    file_size_kb: int
    content_hash: str  # SHA-256 for cryptographic integrity verification
    sensitivity_level: str = Field("restricted", description="public | internal | restricted | confidential")
    notes: Optional[str] = None

class EvidenceAccessAudit(BaseModel):
    timestamp: str
    user_id: str
    user_role: str
    action: str  # "UPLOAD" | "VIEW" | "DOWNLOAD" | "EXPORT"

class EvidenceResponse(BaseModel):
    evidence_id: str
    incident_id: str
    file_name: str
    file_type: str
    file_size_kb: int
    content_hash: str
    sensitivity_level: str
    version: int = 1
    notes: Optional[str] = None
    created_at: str
    access_history: List[EvidenceAccessAudit] = Field(default_factory=list)

class EvidenceExportRequest(BaseModel):
    evidence_ids: List[str]
    export_reason: str = Field(..., description="legal_review | formal_audit | court_subpoena")

class AdvisoryResponse(AdvisoryCreate):
    id: str
    status: str
    created_at: str
    updated_at: str
    delivery_status: Dict[str, int] = Field(
        default_factory=lambda: {"sent": 0, "pending": 0, "failed": 0}
    )
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)
class AlertDispatchPayload(BaseModel):
    incident_id: str
    incident_type: str
    urgency_level: str = Field(..., description="low | medium | high | critical")
    target_roles: List[str] = Field(..., description="e.g. ['operator', 'supervisor', 'field_officer']")
    location_zone: str = Field(..., description="e.g. 'zone_north', 'sector_4'")
    message_content: str

class AlertAckRequest(BaseModel):
    alert_id: str
    responder_id: str
    responder_role: str
    response_action: str = Field(..., description="acknowledged | investigating | resolved | false_alarm")

class AlertRoutingAuditEntry(BaseModel):
    timestamp: str
    alert_id: str
    incident_id: str
    action: str  # "DISPATCHED" | "SUPPRESSED_DUPLICATE" | "ACKNOWLEDGED" | "ESCALATION_CANCELLED"
    recipient_roles: List[str]
    suppression_hash: Optional[str] = None
    details: str
