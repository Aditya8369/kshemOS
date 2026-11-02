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

# ---------- Geofencing & Tactical Map Alerts ----------

GeofenceType = Literal["polygon", "circle"]
GeofenceCategory = Literal[
    "high_risk",
    "patrol_zone",
    "restricted",
    "critical_infra",
    "transit_checkpoint",
    "operational_sector",
]
GeofenceEventType = Literal["entry", "exit", "dwell"]
AlertSeverity = Literal["critical", "warning", "info"]


class PointCoordinate(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)


class GeofenceBoundary(BaseModel):
    id: str = Field(..., description="Unique boundary ID, e.g. GEO-FIN-01")
    name: str = Field(..., description="Human readable zone name")
    type: GeofenceType = Field(..., description="polygon or circle")
    category: GeofenceCategory = Field(..., description="Operational classification")
    color: str = Field("#ff7a1a", description="Hex or CSS color for map rendering")
    center: Optional[PointCoordinate] = Field(None, description="Center coordinate for circular geofence")
    radius_meters: Optional[float] = Field(None, description="Radius in meters for circular geofence")
    coordinates: Optional[List[PointCoordinate]] = Field(None, description="Polygon vertices")
    assigned_teams: List[str] = Field(default_factory=list, description="Teams assigned to this sector")
    is_active: bool = Field(True, description="Whether boundary evaluation is active")


class GeofenceRule(BaseModel):
    id: str = Field(..., description="Unique rule ID, e.g. RULE-01")
    name: str = Field(..., description="Descriptive name")
    geofence_id: str = Field("*", description="Target geofence ID or '*' for all")
    team: str = Field("*", description="Target team or '*' for all")
    event_types: List[GeofenceEventType] = Field(..., description="List of entry, exit, dwell")
    dwell_threshold_seconds: int = Field(60, description="Dwell duration before alert triggers")
    alert_severity: AlertSeverity = Field("warning", description="critical | warning | info")
    enabled: bool = Field(True, description="Whether rule is active")


class GeofenceAlert(BaseModel):
    id: str = Field(..., description="Unique alert ID")
    rule_id: str
    geofence_id: str
    geofence_name: str
    entity_id: str
    team: str
    event_type: GeofenceEventType
    severity: AlertSeverity
    message: str
    timestamp: int
    lat: float
    lng: float
    acknowledged: bool = False


class LocationPingRequest(BaseModel):
    entity_id: str = Field(..., description="ID of the tracked unit/responder")
    team: str = Field("TEAM-ALPHA", description="Assigned team")
    lat: float = Field(..., description="Current latitude")
    lng: float = Field(..., description="Current longitude")
    timestamp: Optional[int] = None


class LocationPingResponse(BaseModel):
    entity_id: str
    team: str
    current_geofences: List[str]
    triggered_alerts: List[GeofenceAlert]
    timestamp: int

