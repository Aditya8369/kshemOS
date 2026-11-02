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
    expected_version: Optional[int] = Field(None, description="Client's expected version for concurrency checking")
    force: bool = Field(False, description="Override concurrency conflict if true")


class SyncQueueItem(BaseModel):
    queue_id: str
    action: Literal["create", "update"]
    incident_id: Optional[str] = None
    create_payload: Optional[IncidentCreateRequest] = None
    changes: Optional[IncidentUpdateRequest] = None
    expected_version: Optional[int] = None
    client_timestamp: Optional[int] = None
    force: bool = False


class SyncBatchRequest(BaseModel):
    items: list[SyncQueueItem]


class SyncBatchResponse(BaseModel):
    applied_count: int
    conflict_count: int
    failed_count: int
    results: list[dict[str, Any]]


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

# ---------- Jurisdiction & Zone Configuration ----------

JurisdictionStatus = Literal["active", "draft", "under_review", "archived"]
ServiceAreaStatus = Literal["active", "maintenance", "inactive"]
RiskLevel = Literal["critical", "high", "moderate", "low"]
ImpactLevel = Literal["standard", "high"]
ChangeReviewStatus = Literal["pending", "approved", "rejected"]


class Jurisdiction(BaseModel):
    id: str = Field(..., description="Unique jurisdiction ID, e.g. JUR-DELHI-METRO")
    name: str = Field(..., description="Jurisdiction title / authority")
    code: str = Field(..., description="Administrative code, e.g. DL-CYBER")
    status: JurisdictionStatus = "active"
    headquarters: str = Field(..., description="Headquarters location / precinct")
    contact_officer: str = Field(..., description="Lead commander or contact code")
    region_scope: list[str] = Field(default_factory=list, description="Associated KshemOS operational zones")
    description: Optional[str] = None
    created_at: int = Field(..., description="Epoch milliseconds")
    updated_at: int = Field(..., description="Epoch milliseconds")
    version: int = 1


class ServiceArea(BaseModel):
    id: str = Field(..., description="Unique service area ID, e.g. SA-NORTH-01")
    jurisdiction_id: str = Field(..., description="Parent jurisdiction ID")
    name: str = Field(..., description="Service area name")
    region: str = Field(..., description="Operational region (North/South/East/West/Central Zone)")
    primary_station: str = Field(..., description="Dispatch desk or station name")
    boundary_type: Literal["circle", "polygon"] = "circle"
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    polygon_coordinates: Optional[list[dict[str, float]]] = None
    authorized_units: list[str] = Field(default_factory=list, description="Authorized officer codes")
    capacity_limit_points: int = 24
    risk_level: RiskLevel = "moderate"
    status: ServiceAreaStatus = "active"
    version: int = 1
    updated_at: int = Field(..., description="Epoch milliseconds")


class DispatchRule(BaseModel):
    id: str = Field(..., description="Unique rule ID, e.g. DISP-RULE-01")
    name: str = Field(..., description="Rule description")
    jurisdiction_id: str
    service_area_id: str
    categories: list[str] = Field(default_factory=list, description="Incident categories or ['*'] for all")
    min_severity: Literal["low", "medium", "high", "critical"] = "low"
    target_desk: str = Field(..., description="Target desk or default assigned officer code")
    overflow_service_area_id: Optional[str] = Field(None, description="Redirect destination if primary desk overloaded")
    priority: int = 1
    enabled: bool = True
    updated_at: int = Field(..., description="Epoch milliseconds")


class BoundaryValidationResult(BaseModel):
    is_valid: bool
    impact_level: ImpactLevel
    warnings: list[str] = Field(default_factory=list)
    affected_active_incidents: int = 0
    coverage_gap_detected: bool = False
    overlap_conflicts: list[str] = Field(default_factory=list)
    requires_review: bool = False


class ChangeProposal(BaseModel):
    id: str
    entity_type: Literal["jurisdiction", "service_area", "dispatch_rule"]
    entity_id: str
    proposed_by: str
    change_summary: str
    impact_level: ImpactLevel
    status: ChangeReviewStatus = "pending"
    validation: BoundaryValidationResult
    proposed_payload: dict[str, Any]
    original_payload: Optional[dict[str, Any]] = None
    created_at: int
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[int] = None
    reviewer_notes: Optional[str] = None


class ChangeReviewAction(BaseModel):
    reviewer_code: str
    decision: Literal["approved", "rejected"]
    reviewer_notes: str


class ConfigSnapshot(BaseModel):
    snapshot_id: str
    version: int
    timestamp: int
    author: str
    change_summary: str
    impact_level: ImpactLevel
    jurisdictions: list[Jurisdiction]
    service_areas: list[ServiceArea]
    dispatch_rules: list[DispatchRule]



# ---------- Automated Chain of Custody & Digital Evidence Vault ----------

EvidenceType = Literal[
    "audio_recording",
    "document",
    "transaction_receipt",
    "image_screenshot",
    "chat_transcript",
    "video",
    "other",
]

EvidenceCategory = Literal[
    "digital_arrest",
    "financial_fraud",
    "counterfeit_currency",
    "identity_theft",
    "cyber_extortion",
    "other",
]

EvidenceSource = Literal[
    "citizen_report",
    "field_capture",
    "bank_slip",
    "forensic_extraction",
    "patrol_upload",
]

CustodialAction = Literal[
    "INGESTION",
    "VIEW",
    "DOWNLOAD",
    "ANNOTATE",
    "REDACT",
    "LEGAL_HOLD_APPLIED",
    "LEGAL_HOLD_RELEASED",
    "EXPORT_BUNDLE",
    "CHECKOUT",
    "RETURN",
]

CustodialStatus = Literal["vaulted", "checked_out", "archived", "disposed"]


class RFC3161Token(BaseModel):
    timestamp_iso: str
    serial_number: str
    digest_algorithm: str = "SHA-256"
    digest_value: str
    tsa_authority: str = "KshemOS-TSA-Root-CA-01"


class CustodialLogEntry(BaseModel):
    log_id: str
    evidence_id: str
    action: CustodialAction
    officer_badge_id: str
    officer_name: str
    timestamp: int
    client_ip: str = "127.0.0.1"
    user_agent: Optional[str] = None
    details: str
    integrity_hash: str
    previous_hash: str


class EvidenceItem(BaseModel):
    id: str
    case_id: str
    title: str
    description: str
    evidence_type: EvidenceType
    category: EvidenceCategory
    source: EvidenceSource
    file_name: str
    file_size_bytes: int
    sha256_hash: str
    rfc3161_token: RFC3161Token
    ingested_by: str
    ingested_at: int
    retention_days: int
    retention_until: int
    legal_hold: bool = False
    legal_hold_reason: Optional[str] = None
    custodial_status: CustodialStatus = "vaulted"
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EvidenceIngestRequest(BaseModel):
    case_id: str
    title: str
    description: str
    evidence_type: EvidenceType
    category: EvidenceCategory
    source: EvidenceSource
    raw_content: Optional[str] = None
    file_name: str
    file_size_bytes: Optional[int] = None
    provided_hash: Optional[str] = None
    officer_badge_id: str
    officer_name: str = "OFFICER"
    legal_hold: bool = False
    legal_hold_reason: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CustodialActionRequest(BaseModel):
    action: CustodialAction
    officer_badge_id: str
    officer_name: str = "OFFICER"
    client_ip: str = "127.0.0.1"
    details: str


class LegalHoldToggleRequest(BaseModel):
    legal_hold: bool
    reason: str
    officer_badge_id: str
    officer_name: str = "OFFICER"


class ForensicExportBundle(BaseModel):
    bundle_id: str
    generated_at: int
    generated_by: str
    case_id: str
    evidence_items: list[EvidenceItem]
    manifest_sha256: str
    custodial_chain: list[CustodialLogEntry]
    tamper_verification_passed: bool
    attestation_statement: str
    export_format: str = "court_package_v1"


# ---------- Geofencing & Map Tactical Alerts ----------

class PointCoordinate(BaseModel):
    lat: float
    lng: float


class GeofenceBoundary(BaseModel):
    id: str
    name: str
    type: Literal["circle", "polygon"] = "circle"
    category: str = "operational_sector"
    color: str = "#3b82f6"
    center: Optional[PointCoordinate] = None
    radius_meters: Optional[float] = None
    coordinates: Optional[list[PointCoordinate]] = None
    assigned_teams: list[str] = Field(default_factory=list)
    is_active: bool = True


class GeofenceRule(BaseModel):
    id: str
    name: str
    geofence_id: str
    team: str = "*"
    event_types: list[Literal["entry", "exit", "dwell"]]
    dwell_threshold_seconds: int = 0
    alert_severity: Literal["info", "warning", "critical"] = "warning"
    enabled: bool = True


class GeofenceAlert(BaseModel):
    id: str
    rule_id: str
    geofence_id: str
    geofence_name: str
    entity_id: str
    team: str
    event_type: Literal["entry", "exit", "dwell"]
    severity: Literal["info", "warning", "critical"]
    description: str
    timestamp: int
    acknowledged: bool = False


class LocationPingRequest(BaseModel):
    entity_id: str
    team: str = "DEFAULT"
    lat: float
    lng: float
    timestamp: Optional[int] = None


class LocationPingResponse(BaseModel):
    entity_id: str
    team: str
    lat: float
    lng: float
    timestamp: int
    current_geofences: list[str]
    triggered_alerts: list[dict[str, Any]]


# ---------- Alert Dispatch System ----------

class AlertDispatchPayload(BaseModel):
    incident_id: str
    category: str
    severity: str
    location_zone: str
    target_roles: list[str]
    description: str


class AlertRoutingAuditEntry(BaseModel):
    timestamp: str
    alert_id: str
    incident_id: str
    action: str
    recipient_roles: list[str]
    suppression_hash: str
    details: str


class AlertDispatchResponse(BaseModel):
    alert_id: str
    incident_id: str
    status: str
    suppression_hash: str
    routed_recipients: list[str]
    audit_history: list[dict[str, Any]]


class AlertAckRequest(BaseModel):
    alert_id: str
    responder_id: str
    responder_role: str


# ---------- Triage System ----------

class TriageScoreRequest(BaseModel):
    incident_id: str
    incident_type: str
    caller_claims_authority: bool = False
    financial_loss_imminent: bool = False
    urgency_level: str = "medium"


class SeverityOverrideRequest(BaseModel):
    supervisor_id: str
    new_severity: str
    reason: str


class TriageAuditEntry(BaseModel):
    timestamp: str
    previous_severity: Optional[str] = None
    new_severity: str
    updated_by: str
    action_type: str
    reason: str


class IncidentTriageResponse(BaseModel):
    incident_id: str
    current_severity: str
    auto_calculated_severity: str
    is_overridden: bool = False
    history: list[dict[str, Any]]
