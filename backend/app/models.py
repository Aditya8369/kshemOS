"""
Pydantic models shared across KshemOS backend routers.
"""
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

# ---------- Scam / Digital Arrest Agent ----------

class ScamAnalyzeRequest(BaseModel):
    transcript: str = Field(..., description="Live or recorded call transcript text")
    caller_number: Optional[str] = Field(None, description="Caller phone number, if known")
    caller_claims_to_be: Optional[str] = Field(
        None, description="What the caller claims to be, e.g. 'CBI officer'"
    )
    model_version: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ScamBaselineComparison(BaseModel):
    baseline_version: str
    baseline_score: int
    baseline_band: str
    score_delta: int
    divergence_rationale: str


class ScamAnalyzeResponse(BaseModel):
    risk_score: int = Field(..., ge=0, le=100)
    risk_band: Literal["low", "medium", "high", "critical", "inconclusive"]
    matched_patterns: List[str]
    matched_known_scam_similarity: float
    recommendation: str
    explanation: str
    model_version: str
    confidence: float = Field(..., ge=0, le=1)
    is_inconclusive: bool
    inconclusive_reason: Optional[str] = None
    contributing_signals: Dict[str, float] = Field(default_factory=dict)
    baseline_comparison: Optional[ScamBaselineComparison] = None


class ScamThresholdUpdate(BaseModel):
    critical: Optional[int] = Field(None, ge=0, le=100)
    high: Optional[int] = Field(None, ge=0, le=100)
    medium: Optional[int] = Field(None, ge=0, le=100)
    inconclusive_min_words: Optional[int] = Field(None, ge=1)
    confidence_cutoff: Optional[float] = Field(None, ge=0, le=1)


class ModelConfigUpdateRequest(BaseModel):
    active_version: Optional[str] = None
    thresholds: Optional[ScamThresholdUpdate] = None
    fallback_enabled: Optional[bool] = None


class ModelRollbackRequest(BaseModel):
    target_version: str = "v1.0-legacy-rules"
    reason: str = "Operator manual rollback"


class BenchmarkCaseResult(BaseModel):
    case_id: str
    category: str
    ground_truth_label: str
    predicted_band: str
    risk_score: int
    confidence: float
    is_correct: bool
    model_version: str


class BenchmarkEvaluationResponse(BaseModel):
    model_version: str
    total_cases: int
    correct_predictions: int
    accuracy: float
    inconclusive_count: int
    false_positives: int
    false_negatives: int
    baseline_accuracy_v1: float
    improvement_over_baseline: float
    cases: List[BenchmarkCaseResult]
    evaluated_at: int


# ---------- Counterfeit Currency Agent ----------

class CurrencyScanResponse(BaseModel):
    verdict: str  # "inconclusive" until a validated model is available
    confidence: float
    reasons: list[str]
    signals: dict
    quality_status: str
    quality_checks: dict
    model_version: str
    analysis_status: str

# ---------- Fraud Graph Agent ----------

class GraphEdgeExplanation(BaseModel):
    edge_id: str
    source: str
    target: str
    relationship_type: str
    source_signal: str = Field(..., min_length=1)
    observed_at: datetime
    confidence: float = Field(..., ge=0, le=1)
    provenance: Literal["verified", "inferred", "synthetic"]
    annotation: str = Field(..., min_length=1)


class GraphPathExplanation(BaseModel):
    accounts: list[str]
    edge_ids: list[str]
    edge_explanations: list[GraphEdgeExplanation] = Field(
        default_factory=list
    )


class RingLookupResponse(BaseModel):
    account_id: str
    is_flagged: bool
    mule_probability: float
    ring_id: Optional[str]
    connected_accounts: list[str]
    shared_signals: list[str]

    edges: list[GraphEdgeExplanation] = Field(
        default_factory=list
    )

    paths: list[GraphPathExplanation] = Field(
        default_factory=list
    )

# ---------- Fraud Graph Analyst Reviews ----------

ReviewDecision = Literal["confirm", "dispute", "reject"]


class GraphReviewRequest(BaseModel):
    decision: ReviewDecision
    reason: str = Field(..., min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A review reason is required")
        return value


class GraphReviewReversalRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A reversal reason is required")
        return value


class GraphReviewEvent(BaseModel):
    event_id: str
    edge_id: str
    event_type: Literal["decision", "reversal"]
    decision: Optional[ReviewDecision] = None
    reason: str
    analyst_id: str
    created_at: datetime
    reverses_event_id: Optional[str] = None
    previous_hash: str
    integrity_hash: str


class GraphReviewHistoryResponse(BaseModel):
    edge_id: str
    events: list[GraphReviewEvent]
    current_decision: Optional[ReviewDecision] = None


class GraphReviewEvaluationRecord(BaseModel):
    edge_id: str
    review_event_id: str
    relationship_type: str
    provenance: Literal["verified", "inferred", "synthetic"]
    decision: ReviewDecision
    evaluation_label: Optional[Literal["positive", "negative"]] = None
    eligible_for_binary_evaluation: bool
    reviewed_at: datetime


class GraphReviewEvaluationExport(BaseModel):
    generated_at: datetime
    total: int
    records: list[GraphReviewEvaluationRecord]

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


# ---------- Geofencing & Alerts Models ----------

class PointCoordinate(BaseModel):
    lat: float
    lng: float


class GeofenceBoundary(BaseModel):
    id: str
    name: str
    zone_type: Literal["hotspot", "safe_zone", "transit_corridor", "financial_district"]
    center_lat: float
    center_lng: float
    radius_km: float
    polygon: Optional[list[PointCoordinate]] = None
    active: bool = True


class GeofenceRule(BaseModel):
    id: str
    name: Optional[str] = None
    boundary_id: Optional[str] = None
    geofence_id: Optional[str] = None
    team: Optional[str] = "*"
    event_type: Optional[str] = None
    event_types: Optional[list[str]] = Field(default_factory=lambda: ["entry"])
    dwell_threshold_seconds: Optional[int] = 0
    alert_severity: str = "medium"
    enabled: bool = True


class LocationPingRequest(BaseModel):
    unit_id: Optional[str] = None
    entity_id: Optional[str] = None
    team: Optional[str] = None
    lat: float
    lng: float
    accuracy_m: Optional[float] = None
    heading: Optional[float] = None
    timestamp: Optional[int] = None


class GeofenceAlert(BaseModel):
    alert_id: str
    unit_id: str
    boundary_id: str
    boundary_name: str
    event_type: Literal["entry", "exit", "dwell"]
    lat: float
    lng: float
    timestamp: int
    severity: Literal["low", "medium", "high", "critical"]
    acknowledged: bool = False


class LocationPingResponse(BaseModel):
    received: bool
    alerts_triggered: list[GeofenceAlert] = Field(default_factory=list)


class AlertDispatchPayload(BaseModel):
    alert_id: str
    title: str
    severity: Literal["low", "medium", "high", "critical"]
    region: str
    category: str
    source: str
    timestamp: int
    payload: dict[str, Any] = Field(default_factory=dict)


class AlertAckRequest(BaseModel):
    officer_id: str
    notes: Optional[str] = None


class AlertRoutingAuditEntry(BaseModel):
    alert_id: str
    routed_to: str
    routed_at: int
    rule_matched: str


class AlertDispatchResponse(BaseModel):
    status: str
    dispatched_to: list[str]


class TriageScoreRequest(BaseModel):
    incident_id: str
    factors: dict[str, Any] = Field(default_factory=dict)


class SeverityOverrideRequest(BaseModel):
    new_severity: Literal["low", "medium", "high", "critical"]
    reason: str
    officer_id: str


class IncidentTriageResponse(BaseModel):
    incident_id: str
    calculated_severity: Literal["low", "medium", "high", "critical"]
    confidence: float
    priority_rank: int
    rationale: list[str]


# ---------- Public Advisory & Geo-Targeted Emergency Broadcast ----------

class SeniorCenterPOI(BaseModel):
    name: str
    lat: float
    lng: float
    capacity_beds: int
    contact_phone: Optional[str] = None


class PerimeterTargeting(BaseModel):
    targeting_type: str = Field("service_area", description="service_area | custom_perimeter | all_regions")
    service_area_id: Optional[str] = Field("SA-CENTRAL-01", description="Service Area ID from boundary registry")
    service_area_name: Optional[str] = Field("Central Secretariat Cyber Command")
    region: Optional[str] = Field("Central Zone")
    center_lat: Optional[float] = Field(28.6139)
    center_lng: Optional[float] = Field(77.2090)
    radius_km: Optional[float] = Field(4.5)
    postal_pincodes: List[str] = Field(default_factory=lambda: ["110001", "110002", "110005"])
    estimated_citizens: int = Field(14500)
    senior_centers_count: int = Field(6)
    senior_centers: List[SeniorCenterPOI] = Field(default_factory=list)
    merchant_nodes_count: int = Field(195)
    bank_branches_count: int = Field(48)
    primary_station: Optional[str] = Field("Central Cyber Cell Desk, Barakhamba Road")


class ChannelConfig(BaseModel):
    sms_gateway: bool = Field(True, description="CDAC/TRAI National Emergency SMS Pipeline")
    whatsapp_emergency: bool = Field(True, description="Meta Verified Gov Emergency Broadcast")
    push_notifications: bool = Field(True, description="KshemOS Priority Mobile APNS/FCM Push")
    portal_header_banner: bool = Field(True, description="Citizen Portal & HQ Sticky Emergency Marquee")


class DualAuthorization(BaseModel):
    requires_dual_auth: bool = Field(True, description="True for critical/high severity or large audience")
    authorizer_1_badge: Optional[str] = Field(None, description="Badge ID of first authorizing officer")
    authorizer_1_name: Optional[str] = Field(None)
    authorizer_1_role: Optional[str] = Field(None)
    authorizer_1_timestamp: Optional[str] = Field(None)
    authorizer_2_badge: Optional[str] = Field(None, description="Badge ID of second authorizing officer")
    authorizer_2_name: Optional[str] = Field(None)
    authorizer_2_role: Optional[str] = Field(None)
    authorizer_2_timestamp: Optional[str] = Field(None)
    is_fully_authorized: bool = Field(False)
    rejection_reason: Optional[str] = Field(None)


class ChannelTelemetryItem(BaseModel):
    channel: str
    channel_name: str
    dispatched: int = 0
    delivered: int = 0
    read: int = 0
    failed: int = 0
    delivery_rate_pct: float = 0.0


class DeliveryTelemetry(BaseModel):
    dispatched: int = 0
    delivered: int = 0
    read: int = 0
    failed: int = 0
    linked_citizen_reports: int = 0
    delivery_rate_pct: float = 0.0
    read_rate_pct: float = 0.0
    channels: Dict[str, ChannelTelemetryItem] = Field(default_factory=dict)


class AdvisoryCreate(BaseModel):
    title: str = Field(..., description="Advisory bulletin title")
    description: str = Field(..., description="Detailed warning and safety guidance")
    severity: str = Field("medium", description="Severity level: low | medium | high | critical")
    affected_location: str = Field("Central Zone", description="Impacted region or location")
    target_audience: str = Field("citizens", description="Audience: citizens | banks | telecom | officers | all")
    template_type: Optional[str] = Field(None, description="Optional emergency template ID used")
    targeting: Optional[PerimeterTargeting] = Field(default_factory=PerimeterTargeting)
    channels: Optional[ChannelConfig] = Field(default_factory=ChannelConfig)
    created_by_badge: Optional[str] = Field("BADGE-CMD-701")
    created_by_name: Optional[str] = Field("Commander Rajesh Varma")


class AdvisoryStatusUpdate(BaseModel):
    status: str = Field(..., description="Status: draft | pending_approval | pending_second_authorization | approved | dispatched | published | rejected")
    reviewer_notes: Optional[str] = Field(None, description="Optional notes regarding approval/rejection")


class AuthorizeBroadcastRequest(BaseModel):
    authorizer_badge: str = Field(..., description="Badge ID of authorizing officer (e.g. BADGE-DCP-402)")
    authorizer_name: str = Field(..., description="Name of authorizing officer")
    authorizer_role: str = Field("Commanding Officer", description="Role / Designation")
    decision: str = Field("approve", description="approve | reject")
    reviewer_notes: Optional[str] = Field(None)


class EstimateAudienceRequest(BaseModel):
    targeting_type: str = Field("service_area", description="service_area | custom_perimeter")
    service_area_id: Optional[str] = Field(None)
    center_lat: Optional[float] = Field(None)
    center_lng: Optional[float] = Field(None)
    radius_km: Optional[float] = Field(None)


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


class AdvisoryResponse(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    affected_location: str
    target_audience: str
    template_type: Optional[str] = None
    status: str = "draft"
    created_at: str
    updated_at: str
    targeting: PerimeterTargeting = Field(default_factory=PerimeterTargeting)
    channels: ChannelConfig = Field(default_factory=ChannelConfig)
    dual_auth: DualAuthorization = Field(default_factory=DualAuthorization)
    delivery_status: Dict[str, int] = Field(
        default_factory=lambda: {"sent": 0, "pending": 0, "failed": 0}
    )
    telemetry: DeliveryTelemetry = Field(default_factory=DeliveryTelemetry)
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)


# ---------- Automated Chain of Custody & Evidence Vault ----------

class RFC3161Token(BaseModel):
    serial_number: str
    timestamp: int
    tsa_authority: str
    policy_oid: str
    hash_algorithm: str
    signature: str


class CustodialLogEntry(BaseModel):
    log_id: str
    timestamp: int
    action: str
    officer_badge_id: str
    officer_name: str
    client_ip: str
    previous_hash: str
    entry_hash: str
    details: str


class EvidenceItem(BaseModel):
    id: str
    case_number: str
    incident_id: Optional[str] = None
    title: str
    file_name: str
    mime_type: str
    file_size_bytes: int
    sha256_fingerprint: str
    rfc3161_token: RFC3161Token
    ingested_at: int
    ingested_by_badge: str
    crime_category: str
    statutory_retention_years: int
    retention_expiration_at: int
    legal_hold: bool = False
    legal_hold_reason: Optional[str] = None
    legal_hold_by_badge: Optional[str] = None
    legal_hold_at: Optional[int] = None
    status: str = "sealed"
    custodial_ledger: list[CustodialLogEntry] = Field(default_factory=list)


class EvidenceIngestRequest(BaseModel):
    case_number: Optional[str] = None
    case_id: Optional[str] = None
    incident_id: Optional[str] = None
    title: str
    file_name: str
    mime_type: str = "application/octet-stream"
    raw_payload_content: Optional[str] = None
    raw_content: Optional[str] = None
    officer_badge_id: str = "OFFICER"
    officer_name: str = "Officer"
    client_ip: str = "127.0.0.1"
    crime_category: Optional[str] = "digital_arrest"
    category: Optional[str] = None
    evidence_type: Optional[str] = "document"
    source: Optional[str] = "citizen_report"
    legal_hold: bool = False
    legal_hold_reason: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CustodialActionRequest(BaseModel):
    action: str
    officer_badge_id: str
    officer_name: str
    client_ip: str = "127.0.0.1"
    details: str


class LegalHoldToggleRequest(BaseModel):
    legal_hold: bool
    reason: str
    officer_badge_id: str
    officer_name: str = "Authorizing Officer"


class ForensicExportBundle(BaseModel):
    bundle_id: str
    evidence_id: str
    case_number: str
    generated_at: int
    master_sha256: str
    manifest_signature: str
    court_admissible_certification: str
    retention_status: dict[str, Any]
    custodial_trail: list[CustodialLogEntry]
    raw_artifact_ref: str


# ---------- Secure Evidence Upload Links ----------

class CreateUploadLinkRequest(BaseModel):
    report_id: str = Field(..., description="Target citizen report or case number")
    incident_id: Optional[str] = None
    title: str = Field(..., description="Title/purpose of requested evidence")
    description: Optional[str] = None
    allowed_file_types: list[str] = Field(
        default_factory=lambda: [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "audio/mpeg",
            "audio/wav",
            "video/mp4",
        ],
        description="Permitted MIME types"
    )
    max_file_size_bytes: int = Field(default=25 * 1024 * 1024, description="Max upload size in bytes (default 25MB)")
    expiry_minutes: int = Field(default=60, description="Lifetime in minutes (default 60 mins)")
    requires_passcode: bool = Field(default=False, description="Whether additional passcode verification is required")
    passcode: Optional[str] = Field(default=None, description="Optional passcode required to complete upload")
    created_by_badge: str = Field(default="OFF-DESK-01", description="Authorizing officer badge")
    officer_name: str = Field(default="Investigating Officer", description="Authorizing officer name")
    recipient_email: Optional[str] = Field(default=None, description="Citizen email")
    recipient_phone: Optional[str] = Field(default=None, description="Citizen phone/SMS destination")


class RevokeUploadLinkRequest(BaseModel):
    revoked_by_badge: str = Field(..., description="Officer badge revoking the link")
    officer_name: str = Field(default="Officer", description="Officer name")
    revocation_reason: str = Field(..., description="Reason for invalidating/revoking link")


class UploadEvidenceViaLinkRequest(BaseModel):
    token: str = Field(..., description="Secure upload token")
    passcode: Optional[str] = Field(default=None, description="Passcode if verification was enabled")
    file_name: str
    mime_type: str
    raw_payload_content: str = Field(..., description="File content or base64 stream")
    file_size_bytes: Optional[int] = None
    uploader_name: Optional[str] = "Citizen Complainant"
    uploader_notes: Optional[str] = None
    client_ip: str = "127.0.0.1"
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"


class UploadReceipt(BaseModel):
    receipt_id: str
    link_id: str
    report_id: str
    evidence_id: str
    file_name: str
    mime_type: str
    file_size_bytes: int
    sha256_fingerprint: str
    rfc3161_serial: str
    uploaded_at: int
    client_ip: str
    vault_status: str = "ingested_and_sealed"
    verification_token: str


class SecureUploadLink(BaseModel):
    link_id: str
    token: str
    upload_url: str
    report_id: str
    incident_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    allowed_file_types: list[str]
    max_file_size_bytes: int
    created_at: int
    expires_at: int
    is_expired: bool
    status: Literal["active", "completed", "expired", "revoked"] = "active"
    requires_passcode: bool = False
    passcode_hint: Optional[str] = None
    created_by_badge: str
    officer_name: str
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    revoked_at: Optional[int] = None
    revoked_by_badge: Optional[str] = None
    revocation_reason: Optional[str] = None
    completed_at: Optional[int] = None
    evidence_id: Optional[str] = None
    receipt: Optional[UploadReceipt] = None


class UploadLinkValidationResponse(BaseModel):
    valid: bool
    link_id: Optional[str] = None
    report_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    allowed_file_types: list[str] = Field(default_factory=list)
    max_file_size_bytes: Optional[int] = None
    expires_at: Optional[int] = None
    requires_passcode: bool = False
    status: str
    error: Optional[str] = None


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


# ---------- Cross-Jurisdiction Mutual Aid & Dynamic Resource Rebalancing ----------

MutualAidTriggerType = Literal["automatic_threshold", "commander_manual"]
MutualAidStatus = Literal["active", "partially_fulfilled", "fulfilled", "de_escalated", "revoked"]
DelegationStatus = Literal["active", "expired", "revoked"]
JointTaskforceStatus = Literal["active", "standby", "disbanded"]


class MutualAidDeclaration(BaseModel):
    id: str
    requesting_jurisdiction_id: str
    service_area_id: str
    region: str
    declared_by: str
    trigger_type: MutualAidTriggerType
    workload_points: float
    capacity_limit_points: float
    workload_ratio: float
    target_neighbor_jurisdictions: list[str] = Field(default_factory=list)
    requested_units_count: int = 2
    status: MutualAidStatus = "active"
    declared_at: int
    deescalated_at: Optional[int] = None
    notes: Optional[str] = None


class DeclareMutualAidRequest(BaseModel):
    service_area_id: str
    declared_by: str = "COMMANDING_OFFICER"
    requested_units_count: int = 2
    target_neighbor_jurisdictions: Optional[list[str]] = None
    notes: Optional[str] = None


class GuestUnitDelegation(BaseModel):
    delegation_id: str
    declaration_id: Optional[str] = None
    guest_officer_id: str
    home_jurisdiction_id: str
    home_service_area_id: str
    borrowing_jurisdiction_id: str
    borrowing_service_area_id: str
    target_region: str
    authorized_by: str
    authorized_at: int
    valid_from: int
    valid_until: int
    permissions: list[str] = Field(default_factory=lambda: ["triage", "respond", "log_action", "reassign"])
    status: DelegationStatus = "active"
    revocation_reason: Optional[str] = None
    revoked_at: Optional[int] = None
    revoked_by: Optional[str] = None


class DelegateGuestUnitRequest(BaseModel):
    guest_officer_id: str
    home_jurisdiction_id: str
    borrowing_jurisdiction_id: str
    target_service_area_id: str
    authorized_by: str = "COMMANDING_OFFICER"
    duration_hours: float = 8.0
    permissions: list[str] = Field(default_factory=lambda: ["triage", "respond", "log_action", "reassign"])
    declaration_id: Optional[str] = None
    notes: Optional[str] = None


class RevokeGuestUnitRequest(BaseModel):
    revoked_by: str = "COMMANDING_OFFICER"
    reason: str = "Manual command revocation"


class JointTaskforce(BaseModel):
    id: str
    name: str
    lead_jurisdiction_id: str
    participating_jurisdiction_ids: list[str]
    monitored_regions: list[str]
    active_taskforce_officers: list[str]
    target_syndicate_tags: list[str]
    status: JointTaskforceStatus = "active"
    created_at: int
    created_by: str
    notes: Optional[str] = None


class CreateJointTaskforceRequest(BaseModel):
    name: str
    lead_jurisdiction_id: str
    participating_jurisdiction_ids: list[str]
    monitored_regions: list[str]
    active_taskforce_officers: list[str]
    target_syndicate_tags: list[str] = Field(default_factory=lambda: ["digital_arrest", "mule_network"])
    created_by: str = "COMMANDING_OFFICER"
    notes: Optional[str] = None


class GuestActionAuditEntry(BaseModel):
    id: str
    delegation_id: str
    guest_officer_id: str
    home_jurisdiction_id: str
    borrowed_jurisdiction_id: str
    incident_id: str
    action_type: Literal["triage", "status_change", "severity_override", "assignment", "evidence_tag", "note_added"]
    details: str
    timestamp: int


class LogGuestActionRequest(BaseModel):
    guest_officer_id: str
    incident_id: str
    action_type: Literal["triage", "status_change", "severity_override", "assignment", "evidence_tag", "note_added"]
    details: str


class SectorCapacityAnalysis(BaseModel):
    service_area_id: str
    service_area_name: str
    region: str
    jurisdiction_id: str
    capacity_limit_points: float
    workload_points: float
    workload_ratio: float
    active_incidents_count: int
    is_overloaded_150: bool
    has_surplus_capacity: bool
    guest_units_count: int


class RebalanceRecommendation(BaseModel):
    recommendation_id: str
    overloaded_service_area_id: str
    overloaded_region: str
    donor_jurisdiction_id: str
    donor_service_area_id: str
    recommended_units: int
    projected_workload_ratio_after: float
    rationales: list[str]


class RebalanceEvaluationResponse(BaseModel):
    timestamp: int
    sectors: list[SectorCapacityAnalysis]
    overloaded_sectors_count: int
    active_declarations_count: int
    active_guest_delegations_count: int
    recommendations: list[RebalanceRecommendation]
    auto_declarations_triggered: list[MutualAidDeclaration]


# ---------- Multilingual Speech Recognition & Regional-Language Confidence ----------

ASRProviderType = Literal["bhashini", "whisper_local", "browser_speech", "mock_adapter"]
# ---------- Consent-Based Live Scam-Call Transcription & Risk Alerts ----------

class LiveCallConsent(BaseModel):
    user_acknowledged: bool = Field(..., description="User explicitly acknowledged call safety monitoring")
    mic_permission_granted: bool = Field(..., description="User granted live microphone audio stream access")
    data_processing_accepted: bool = Field(..., description="User consented to real-time risk scoring and transcription")
    no_auto_record_acknowledged: bool = Field(..., description="User acknowledged zero automatic recording policy")
    timestamp: int = Field(..., description="Epoch millisecond timestamp when consent was granted")

class WordConfidence(BaseModel):
    word: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None
    language: Optional[str] = "hi"
    is_low_confidence: bool = False
    alternatives: list[str] = Field(default_factory=list)

class SuspiciousPhrase(BaseModel):
    phrase: str
    category: Literal["threat", "urgency", "secrecy", "payment", "coercion"]
    severity_weight: float
    context_snippet: Optional[str] = None

class CodeSwitchSegment(BaseModel):
    text: str
    language: str
    confidence: float = 1.0


class WordCorrection(BaseModel):
    word_index: int
    original_word: str
    corrected_word: str
    corrected_by: str = "citizen"
    timestamp: int


class SpeechTurn(BaseModel):
    turn_id: str
    speaker: Literal["caller", "citizen", "system"] = "caller"
    timestamp_ms: int
    original_text: str
    corrected_text: str
    words: list[WordConfidence] = Field(default_factory=list)
    corrections: list[WordCorrection] = Field(default_factory=list)
    is_citizen_corrected: bool = False
    detected_language: str = "hi"
    language_confidence: float = 0.95
    code_switch_segments: list[CodeSwitchSegment] = Field(default_factory=list)
    average_confidence: float = 1.0
    provider: str = "bhashini"


class ASRProviderInfo(BaseModel):
    id: str
    name: str
    description: str
    supported_languages: list[str]
    supports_code_switching: bool
    is_local: bool


class ASRTranscribeRequest(BaseModel):
    provider: ASRProviderType = "bhashini"
    sample_id: Optional[str] = None
    text_input: Optional[str] = None
    audio_payload: Optional[str] = None
    target_language: str = "hi"
    speaker: Literal["caller", "citizen", "system"] = "caller"
    enable_code_switching: bool = True
    confidence_threshold: float = 0.70


class ASRCorrectionRequest(BaseModel):
    turn_id: str
    word_corrections: list[WordCorrection] = Field(default_factory=list)
    full_corrected_text: Optional[str] = None


class MultilingualScamAnalyzeRequest(BaseModel):
    turn_id: Optional[str] = None
    text_to_analyze: str
    original_asr_text: str
    language: str = "hi"
    caller_claims_to_be: Optional[str] = None


class MultilingualScamAnalyzeResponse(BaseModel):
    risk_score: float
    risk_band: str
    analyzed_text: str
    original_asr_text: str
    was_corrected: bool
    detected_language: str
    code_switch_ratio: float
    matched_patterns: list[str]
    recommendation: str
    explanation: str

class SpeechUtterance(BaseModel):
    utterance_id: str
    timestamp_ms: int
    speaker: str = "caller"
    text: str
    suspicious_phrases: list[SuspiciousPhrase] = Field(default_factory=list)
    incremental_risk: float = 0.0


class LiveCallSession(BaseModel):
    session_id: str
    status: Literal["consent_pending", "active", "paused", "stopped", "purged"] = "active"
    consent: LiveCallConsent
    started_at: int
    updated_at: int
    stopped_at: Optional[int] = None
    caller_label: Optional[str] = None
    full_transcript: str = ""
    utterances: list[SpeechUtterance] = Field(default_factory=list)
    current_risk_score: float = 0.0
    current_risk_band: Literal["low", "medium", "high", "critical"] = "low"
    detected_categories: list[str] = Field(default_factory=list)
    highlighted_phrases: list[SuspiciousPhrase] = Field(default_factory=list)
    actionable_safety_prompts: list[str] = Field(default_factory=list)
    official_helpline_recommendations: list[dict[str, str]] = Field(default_factory=list)
    tactics_breakdown: dict[str, float] = Field(default_factory=dict)


class CreateLiveCallSessionRequest(BaseModel):
    consent: LiveCallConsent
    caller_label: Optional[str] = "Incoming Suspected Call"


class IngestSpeechChunkRequest(BaseModel):
    text: str
    speaker: str = "caller"
    audio_duration_ms: Optional[int] = None
    is_final: bool = True


class LiveCallSessionActionRequest(BaseModel):
    action: Literal["pause", "resume", "stop", "purge"]


class LiveCallRiskUpdateResponse(BaseModel):
    session_id: str
    status: str
    new_utterance: Optional[SpeechUtterance] = None
    full_transcript: str
    current_risk_score: float
    current_risk_band: str
    highlighted_phrases: list[SuspiciousPhrase]
    actionable_safety_prompts: list[str]
    tactics_breakdown: dict[str, float]
    official_helpline_recommendations: list[dict[str, str]]

# ---------- AI Telephony Honeypot & Call-Pattern Triangulation ----------

class HoneypotPersona(BaseModel):
    id: str = Field(..., description="Unique persona identifier")
    name: str = Field(..., description="Persona name, e.g. Prof. Rameshwar Shastri")
    age: int
    profile: str = Field(..., description="Demographic and behavioral persona description")
    prolongation_tactic: str = Field(..., description="Specific tactic to drag out call and extract mules")
    primary_target_extraction: str = Field(..., description="Primary credentials targeted for harvesting")
    voice_profile: str = Field("elderly_male_hindi_english")


class AcousticFingerprint(BaseModel):
    ambient_cross_talk_score: float = Field(0.0, description="0.0 - 1.0 probability of call-center background chatter")
    voip_codec_jitter_ms: float = Field(0.0, description="VoIP latency and packet jitter in milliseconds")
    background_noise_profile: str = Field("Clean Audio", description="Acoustic background characterization")
    ivr_signature_match: Optional[str] = Field(None, description="Matched predictive dialer / PBX signature")
    synthetic_voice_probability: float = Field(0.0, description="Probability of deepfake or TTS voice clone")


class ScriptTriangulation(BaseModel):
    matched_syndicate_id: Optional[str] = Field(None, description="Known syndicate ID e.g. SYND-MEWAT-08")
    matched_syndicate_name: Optional[str] = Field(None, description="Name of syndicate ring")
    script_similarity_pct: float = Field(0.0, description="Script match percentage against known corpus")
    geographic_origin: Optional[str] = Field(None, description="Triangulated geographic origin or VoIP gateway")
    confidence_score: float = Field(0.0, description="Overall triangulation confidence score 0.0 - 1.0")
    matched_script_excerpts: List[str] = Field(default_factory=list)


class HarvestedMuleCredential(BaseModel):
    credential_id: str
    credential_type: str = Field(..., description="bank_account | upi_vpa | payment_url")
    value: str = Field(..., description="Account number, VPA, or URL")
    bank_or_provider: str
    beneficiary_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    extracted_at: str
    confidence: float = 0.95
    freeze_status: str = Field("recommended", description="recommended | freezing_initiated | frozen | pending_review")
    freeze_warrant_id: Optional[str] = None


class HoneypotCallSession(BaseModel):
    session_id: str
    caller_phone: str
    caller_claims_to_be: str
    forwarded_by_citizen_id: Optional[str] = None
    persona: HoneypotPersona
    call_status: str = Field("active", description="active | prolonging | completed | extracted")
    call_duration_seconds: int = 0
    transcript_turns: List[Dict[str, Any]] = Field(default_factory=list)
    acoustic_fingerprint: AcousticFingerprint = Field(default_factory=AcousticFingerprint)
    script_triangulation: ScriptTriangulation = Field(default_factory=ScriptTriangulation)
    harvested_credentials: List[HarvestedMuleCredential] = Field(default_factory=list)
    freeze_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str
    updated_at: str


class CallForwardRequest(BaseModel):
    caller_phone: str = Field(..., description="Phone number of scam caller")
    caller_claims_to_be: str = Field(..., description="Who caller claims to be e.g. CBI Officer")
    citizen_name: Optional[str] = Field("Citizen User")
    initial_transcript: Optional[str] = Field(None)
    preferred_persona_id: Optional[str] = Field(None)


class CallTurnRequest(BaseModel):
    caller_utterance: str = Field(..., description="Incoming sentence from scam caller")


class MuleFreezeRequest(BaseModel):
    credential_id: str
    officer_badge: str = Field("OFF-CYBER-901")
    statutory_section: str = Field("Section 102 CrPC / Cyber Defense Act")
    freeze_reason: Optional[str] = Field("Harvested active beneficiary account from live honeypot extortion call.")
# ---------- Real-Time Threat Heatmap & Predictive Spatial Intelligence ----------

class FinancialPOI(BaseModel):
    id: str
    name: str
    poi_type: Literal["atm", "bank_branch", "money_exchange", "fintech_hub"]
    bank_name: str
    lat: float
    lng: float
    region: str
    vulnerability_score: float = 0.5


class SpatialIncident(BaseModel):
    id: str
    title: str
    category: str
    severity: Literal["low", "medium", "high", "critical"]
    lat: float
    lng: float
    timestamp: int
    region: str
    nearby_poi_id: Optional[str] = None


class ThreatCluster(BaseModel):
    cluster_id: str
    name: str
    center_lat: float
    center_lng: float
    radius_meters: float
    incident_count: int
    severity_density: float
    threat_level: Literal["critical", "high", "moderate", "low"]
    primary_category: str
    surrounding_poi_count: int
    nearby_atms: list[str] = Field(default_factory=list)
    region: str
    service_area_id: Optional[str] = None


class MigrationVector(BaseModel):
    cluster_id: str
    trend: Literal["expanding", "dissipating", "migrating", "stationary"]
    heading_degrees: float
    heading_cardinal: str
    velocity_km_per_day: float
    growth_rate_pct: float
    target_service_area_id: Optional[str] = None
    target_region: Optional[str] = None
    risk_narrative: str


class PatrolDispatchRecommendation(BaseModel):
    recommendation_id: str
    cluster_id: str
    waypoint_name: str
    lat: float
    lng: float
    suggested_priority: Literal["urgent_deterrence", "preventative_check", "surveillance_stakeout"]
    assigned_team_code: str
    suggested_unit_code: Optional[str] = None
    target_infrastructure: str
    action_checklist: list[str]
    valid_duration_minutes: int = 120
    generated_at: int


class CitizenMicroAdvisoryRequest(BaseModel):
    lat: float
    lng: float
    user_identifier: Optional[str] = None


class CitizenMicroAdvisoryResponse(BaseModel):
    proximity_meters: float
    nearest_cluster_id: Optional[str] = None
    nearest_cluster_name: Optional[str] = None
    threat_level: Literal["critical", "high", "moderate", "low"]
    localized_risk_score: int
    active_incident_count_nearby: int
    migration_trend: Optional[str] = None
    safety_guidance: list[str] = Field(default_factory=list)
    nearest_safe_precinct: str
    timestamp: int


class ThreatHeatmapResponse(BaseModel):
    timestamp: int
    clusters: list[ThreatCluster]
    migration_vectors: list[MigrationVector]
    patrol_recommendations: list[PatrolDispatchRecommendation]
    financial_pois: list[FinancialPOI]
    total_clusters: int
    highest_threat_region: str

# ---------- Evidence-Grounded Officer Copilot ----------

class CopilotFeedbackRequest(BaseModel):
    feedback: Literal["helpful", "incorrect", "unsupported"]
    notes: Optional[str] = None
    officer_badge: str = "OFF-DUTY"


class CopilotApprovalRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    officer_badge: str
    approval_notes: Optional[str] = None


class CopilotRecommendation(BaseModel):
    rec_id: str
    action_title: str
    rationale: Optional[str] = None
    suggested_role: Optional[str] = None
    priority: Optional[str] = None
    is_consequential: Optional[bool] = None
    requires_human_approval: Optional[bool] = None
    approval_status: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[int] = None
    source_references: List[Dict[str, Any]] = Field(default_factory=list)
    officer_feedback: Optional[Literal["helpful", "incorrect", "unsupported"]] = None
    feedback_notes: Optional[str] = None
    feedback_submitted_by: Optional[str] = None
    feedback_submitted_at: Optional[int] = None


class EvidenceGroundedCopilotResponse(BaseModel):
    case_or_incident_id: str
    has_sufficient_evidence: bool
    evidence_completeness_score: float
    missing_records_summary: Optional[str] = None
    priority: str
    executive_summary: str
    confirmed_facts: List[Dict[str, Any]] = Field(default_factory=list)
    unverified_claims: List[Dict[str, Any]] = Field(default_factory=list)
    system_signals: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[CopilotRecommendation] = Field(default_factory=list)
    retrieved_operating_procedures: List[Dict[str, Any]] = Field(default_factory=list)
    generated_at: int
    model_version: str


# ---------- Role-Aware Incident Notifications ----------

class OfficerNotificationPreferences(BaseModel):
    email_enabled: Optional[bool] = None
    assignment_enabled: Optional[bool] = None
    reassignment_enabled: Optional[bool] = None
    escalation_enabled: Optional[bool] = None
    supervisor_review_enabled: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = Field(
        None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"
    )
    quiet_hours_end: Optional[str] = Field(
        None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"
    )
    timezone: Optional[str] = None


class UpdateOfficerPreferencesRequest(BaseModel):
    preferences: OfficerNotificationPreferences


class OfficerDirectoryEntry(BaseModel):
    officer_id: str
    name: str
    email: str
    role: str
    jurisdiction_id: str
    regions: List[str]
    preferences: Dict[str, Any] = Field(default_factory=dict)


class SendNotificationRequest(BaseModel):
    incident_id: str
    event_type: Literal[
        "assignment", "reassignment", "escalation", "supervisor_review"
    ]
    actor_id: Optional[str] = None


class IncidentNotificationPayload(BaseModel):
    notification_id: str
    incident_id: Optional[str] = None
    event_type: str
    priority: str
    jurisdiction_id: str
    region: str
    recipient_id: str
    recipient_email: str
    recipient_role: str
    recipient_name: str
    subject: str
    body_snippet: str
    secure_dashboard_link: str
    created_at: int
    delivery_status: str
    attempts: int
    last_attempt_at: int
    error_message: Optional[str] = None
    retry_history: List[Dict[str, Any]] = Field(default_factory=list)


class NotificationAuditResponse(BaseModel):
    total: int
    delivered: int
    retrying: int
    failed: int
    suppressed: int
    notifications: List[IncidentNotificationPayload] = Field(default_factory=list)


class RetryNotificationResponse(BaseModel):
    success: bool
    notification: IncidentNotificationPayload
    message: str

# ======================================================
# SECTION 63 BSA / 65B IEA ELECTRONIC EVIDENCE AFFIDAVIT COMPILER MODELS
# ======================================================

class DeviceHardwareSignature(BaseModel):
    device_make_model: str = Field(default="KshemOS Cloud Forensic Vault Node")
    hardware_id_type: str = Field(default="SYSTEM_UUID", description="IMEI, MAC_ADDRESS, SYSTEM_UUID, SERVER_SERIAL")
    hardware_identifier: str = Field(default="550e8400-e29b-41d4-a716-446655440000")
    operating_system: str = Field(default="Linux 6.8.0-45-generic x86_64")
    acquisition_software: str = Field(default="KshemOS Cryptographic Custody Ingestion Agent v2.4.0 (FIPS-140-3)")
    storage_media_type: str = Field(default="Encrypted NVMe Block Volume (AES-256-XTS)")


class NtpSynchronizationRecord(BaseModel):
    ntp_server_host: str = Field(default="time.nplindia.org", description="CSIR-National Physical Laboratory India Primary Reference")
    stratum_level: int = Field(default=1, description="NTP stratum (Stratum 1 atomic/GPS primary reference)")
    is_synchronized: bool = Field(default=True)
    clock_offset_ms: float = Field(default=0.342, description="Clock offset in milliseconds against UTC(NPLI)")
    jitter_ms: float = Field(default=0.084, description="Packet jitter in milliseconds")
    round_trip_delay_ms: float = Field(default=1.25, description="Network round-trip delay in ms")
    last_sync_timestamp: str = Field(default="2026-11-09T10:40:00.000Z")
    leap_indicator: int = Field(default=0, description="0=no warning, 1=last minute has 61 seconds")
    reference_clock_id: str = Field(default="NPLI-GPS", description="National Physical Laboratory Primary GPS Clock")
    statutory_compliance: str = Field(
        default="Complies with Section 63(2)(a) BSA 2023 & Rule 419A Indian Telegraph Rules temporal precision standards (<5.0ms forensic tolerance)"
    )


class SignatoryDeclaration(BaseModel):
    signatory_role: Literal["SYSTEM_IN_CHARGE", "INVESTIGATING_OFFICER", "FORENSIC_EXPERT"]
    officer_name: str
    designation: str
    badge_id: str
    organization: str
    declaration_text: str
    fir_number: Optional[str] = None
    police_station: Optional[str] = None
    court_name: Optional[str] = None
    esign_status: Literal["PENDING_SIGNATURE", "DSC_TOKEN_AFFIXED", "AADHAAR_ESIGN_VERIFIED", "EXEMPT_MANUAL_SEAL"] = "PENDING_SIGNATURE"
    esign_placeholder: str
    signed_at: Optional[str] = None


class AffidavitArtifactExhibit(BaseModel):
    exhibit_number: str
    evidence_id: str
    title: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    genesis_hash: str
    ingested_at: int
    ingested_at_iso: str
    hardware_signature: DeviceHardwareSignature
    rfc3161_token_serial: str
    chain_of_custody_verified: bool
    custodial_transactions_count: int


class Section63AffidavitRequest(BaseModel):
    case_id: str = Field(..., description="Target Case or Incident ID (e.g. CASE-2026-DELHI-01)")
    evidence_ids: Optional[List[str]] = Field(default=None, description="Specific evidence IDs to include. If omitted, includes all case exhibits.")
    investigating_officer: Optional[Dict[str, Any]] = Field(default=None, description="Investigating Officer (IO) details")
    system_incharge: Optional[Dict[str, Any]] = Field(default=None, description="System In-Charge / Technical Custodian details")
    court_name: Optional[str] = Field(default=None, description="Jurisdictional Magistrate or Sessions Court")
    fir_crime_number: Optional[str] = Field(default=None, description="FIR / Crime Number and Police Station")
    affix_digital_signature: bool = Field(default=False, description="Whether to simulate affixing DSC / Aadhaar eSign")


class Section63AffidavitResponse(BaseModel):
    affidavit_id: str
    case_id: str
    fir_crime_number: str
    court_name: str
    legal_framework: str = "Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA) & Section 65B Indian Evidence Act, 1872 (IEA)"
    generated_at: int
    generated_at_iso: str
    status: Literal["SEALED_CRYPTOGRAPHICALLY_VALID", "COMPILATION_BLOCKED_TAMPER_DETECTED"]
    all_hash_chains_verified: bool
    tampered_artifacts_count: int = 0
    ntp_verification: NtpSynchronizationRecord
    system_incharge_declaration: SignatoryDeclaration
    investigating_officer_declaration: SignatoryDeclaration
    exhibits: List[AffidavitArtifactExhibit]
    master_manifest_sha256: str
    total_exhibits: int
    total_file_size_bytes: int
    affidavit_title: str
    court_printable_html: str
    tamper_details: Optional[Dict[str, Any]] = None


# ---------- SIM Box & Spoofed Calling Line Identification (CLI) Detection Engine ----------

class SpoofAnomalyFlag(BaseModel):
    flag_type: str
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    description: str
    statutory_reference: Optional[str] = None


class TelephonyRouteVerificationRequest(BaseModel):
    call_id: Optional[str] = Field(None, description="Optional telephony call identifier")
    claimed_cli: str = Field(..., description="Incoming caller ID as displayed on handset / softphone")
    claimed_entity: Optional[str] = Field(None, description="Caller's claimed organization (e.g. Mumbai Police, CBI HQ)")
    call_channel: Literal[
        "pstn_gsm", "whatsapp_voip", "skype_voip", "telegram_call", "sip_trunk", "unknown"
    ] = "sip_trunk"
    sip_headers: Optional[Dict[str, str]] = Field(default_factory=dict, description="Extracted SIP headers (From, Contact, User-Agent, PAI)")
    carrier_ingress_ip: Optional[str] = Field(None, description="Ingress gateway IP of the incoming call stream")
    audio_latency_ms: Optional[float] = Field(None, description="Round-trip audio latency measurement in milliseconds")
    packet_jitter_ms: Optional[float] = Field(None, description="VoIP / RTP packet jitter in milliseconds")
    packet_loss_pct: Optional[float] = Field(None, description="Packet loss percentage")
    recipient_circle: Optional[str] = Field("MH", description="Recipient telecom circle (e.g. DL, MH, KA)")
    officer_badge: Optional[str] = Field("OFFICER-SYS", description="Investigating officer identifier")


class TelephonyRouteVerificationResponse(BaseModel):
    verification_id: str
    call_id: str
    claimed_cli: str
    normalized_cli: str
    claimed_entity: str
    is_spoofed: bool
    spoof_confidence: float = Field(..., ge=0.0, le=1.0)
    threat_tier: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "VERIFIED_LEGITIMATE"]
    carrier_legitimacy_score: float = Field(..., ge=0.0, le=100.0)
    trai_circle_info: Dict[str, Any]
    route_telemetry: Dict[str, Any]
    anomaly_flags: List[SpoofAnomalyFlag] = Field(default_factory=list)
    warning_banner: str
    recommended_action: str
    forwarded_to_telecom_triage: bool
    ingress_point_id: Optional[str] = None
    verified_at: str


class TelecomTriageIncident(BaseModel):
    triage_id: str
    verification_id: str
    claimed_cli: str
    carrier_ingress_ip: Optional[str] = None
    ingress_country: str
    spoof_type: str
    gateway_signature: str
    status: Literal["DISPATCHED_TO_TELCO", "BLOCKED_AT_GATEWAY", "UNDER_INVESTIGATION", "RESOLVED"]
    target_agency_spoofed: str
    dot_reporting_payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str


class TelecomTriageSummary(BaseModel):
    total_calls_inspected: int
    spoofed_calls_intercepted: int
    simbox_gateways_isolated: int
    international_grey_routes_blocked: int
    high_risk_ingress_ips: List[str] = Field(default_factory=list)
    recent_dispatches: List[TelecomTriageIncident] = Field(default_factory=list)


# ---------- WhatsApp & Telegram Syndicate Group Parser and APK Triage ----------

class SyndicateChatParseRequest(BaseModel):
    raw_text: str = Field(..., description="Chat screenshot OCR text or exported chat log")
    incident_id: Optional[str] = Field(None, description="Linked citizen report or incident ID")
    source_platform: Optional[str] = Field("auto", description="Source platform: whatsapp, telegram, or auto")
    officer_badge: Optional[str] = Field("OFFICER-SYS", description="Officer ID or badge number")


class ExtractedInviteLink(BaseModel):
    platform: str
    url: str
    code: str


class ExtractedPhoneNumber(BaseModel):
    number: str
    country: str
    is_syndicate_intl: bool
    role: str  # "admin", "recruiter", "sender", "mentioned"


class ExtractedCryptoWallet(BaseModel):
    address: str
    network: str  # "BTC", "ETH", "TRON"
    standard: str  # "TRC-20", "ERC-20", "Native"


class SyndicateChatParseResponse(BaseModel):
    artifact_id: str
    incident_id: Optional[str] = None
    source_platform: str
    invite_links: List[ExtractedInviteLink] = Field(default_factory=list)
    phone_numbers: List[ExtractedPhoneNumber] = Field(default_factory=list)
    crypto_wallets: List[ExtractedCryptoWallet] = Field(default_factory=list)
    upi_ids: List[str] = Field(default_factory=list)
    apk_urls: List[str] = Field(default_factory=list)
    syndicate_keywords: List[str] = Field(default_factory=list)
    risk_score: float
    threat_band: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    cluster_id: Optional[str] = None
    graph_nodes_injected: int = 0
    parsed_at: str
    summary: str


class ApkAnalyzeRequest(BaseModel):
    filename: str = Field(..., description="File name of APK or mock payload")
    file_bytes_base64: Optional[str] = Field(None, description="Base64 encoded APK or package manifest")
    incident_id: Optional[str] = Field(None, description="Associated citizen incident ID")
    officer_badge: Optional[str] = Field("OFFICER-SYS", description="Submitting officer badge")


class DangerousPermission(BaseModel):
    permission: str
    risk_level: str  # "CRITICAL", "HIGH", "MEDIUM"
    category: str
    description: str


class SuspiciousServiceOrIntent(BaseModel):
    name: str
    component_type: str  # "Service", "Receiver", "Activity"
    flag_reason: str


class C2Endpoint(BaseModel):
    endpoint_type: str  # "telegram_bot", "ipv4", "domain", "dynamic_dns"
    target: str
    risk: str
    notes: Optional[str] = None


class ApkAnalyzeResponse(BaseModel):
    artifact_id: str
    incident_id: Optional[str] = None
    filename: str
    sha256: str
    sha1: str
    md5: str
    filesize_bytes: int
    package_name: str
    version_code: str
    version_name: str
    app_label: str
    is_quarantined: bool
    quarantine_path: str
    dangerous_permissions: List[DangerousPermission] = Field(default_factory=list)
    suspicious_services_intents: List[SuspiciousServiceOrIntent] = Field(default_factory=list)
    c2_endpoints: List[C2Endpoint] = Field(default_factory=list)
    malware_family: str
    overall_risk_score: float
    threat_level: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    analyzed_at: str
    cluster_id: Optional[str] = None
    graph_nodes_injected: int = 0
    summary: str


class LinkedIncident(BaseModel):
    incident_id: str
    shared_indicators: List[str]
    indicator_types: List[str]
    first_seen: str
    last_seen: str


class SyndicateClusterInfo(BaseModel):
    cluster_id: str
    cluster_name: str
    threat_tier: str
    indicators: Dict[str, List[str]]
    linked_incidents: List[str]
    total_nodes: int
    mule_accounts: List[str]


class SyndicateCorrelationResponse(BaseModel):
    clusters: List[SyndicateClusterInfo]
    cross_linked_incidents: List[LinkedIncident]
    total_indicators_tracked: int


class SyndicateStatsResponse(BaseModel):
    total_chats_parsed: int
    total_apks_quarantined: int
    total_syndicate_clusters: int
    total_linked_incidents: int
    high_risk_admin_numbers: int
    crypto_wallets_indexed: int
    upi_handles_indexed: int


# ---------- Automated UPI Mule Account Freeze Dispatch via CFCFRMS / 1930 ----------

class ParseFinancialEntitiesRequest(BaseModel):
    text: str = Field(..., description="Raw citizen complaint, chat log, or note text")


class ParseFinancialEntitiesResponse(BaseModel):
    vpas: List[str] = Field(default_factory=list)
    phone_linked_vpas: List[str] = Field(default_factory=list)
    utrs: List[str] = Field(default_factory=list)
    ifsc_codes: List[str] = Field(default_factory=list)
    account_numbers: List[str] = Field(default_factory=list)
    extracted_count: int


class FreezeEvaluationRequest(BaseModel):
    vpa: str
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    utr_number: Optional[str] = None
    transaction_amount: float = 0.0
    transaction_timestamp_iso: Optional[str] = None
    recent_transactions: Optional[List[Dict[str, Any]]] = None
    is_digital_arrest: bool = False


class FreezeEvaluationResponse(BaseModel):
    vpa: str
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    utr_number: Optional[str] = None
    transaction_amount: float
    priority_tier: str
    sla_minutes: int
    action_directive: str
    graph_hop_distance: Optional[int] = None
    shortest_syndicate_path: List[str] = Field(default_factory=list)
    mule_probability: float
    velocity_score: float
    has_rapid_burst: bool
    total_volume: float
    evaluation_rationale: str
    evaluated_at: str


class DispatchFreezeRequest(BaseModel):
    incident_id: str
    suspect_vpa: str
    suspect_account: Optional[str] = None
    suspect_ifsc: Optional[str] = None
    utr_number: Optional[str] = None
    transaction_amount: float = 0.0
    transaction_timestamp_iso: Optional[str] = None
    recent_transactions: Optional[List[Dict[str, Any]]] = None
    officer_name: str = "Inspector R. K. Sharma"
    officer_badge_id: str = "OFF-DELHI-101"
    police_station: str = "Cyber Crime Police Station, Central Delhi"
    is_digital_arrest: bool = False
    victim_details: Optional[Dict[str, Any]] = None


class RecordBankAcknowledgmentRequest(BaseModel):
    bank_nodal_ref: str
    freeze_outcome: Literal[
        "FROZEN", "LIEN_MARKED", "REJECTED_INSUFFICIENT_FUNDS", "REJECTED_INVALID_ACCOUNT"
    ] = "FROZEN"
    notes: Optional[str] = None


class RevokeFreezeRequest(BaseModel):
    revoking_officer_badge_id: str
    revocation_reason: str


class FreezeRecordResponse(BaseModel):
    freeze_id: str
    incident_id: str
    suspect_vpa: str
    suspect_account: Optional[str] = None
    suspect_ifsc: Optional[str] = None
    utr_number: Optional[str] = None
    transaction_amount: float
    status: str
    priority_tier: str
    sla_minutes: int
    action_directive: str
    officer_badge_id: str
    officer_name: str
    police_station: str
    dispatched_at: str
    dispatched_at_ms: int
    acknowledged_at: Optional[str] = None
    acknowledged_at_ms: Optional[int] = None
    bank_nodal_ref: Optional[str] = None
    bank_response_time_ms: Optional[float] = None
    evaluation: Dict[str, Any]
    statutory_notice: Dict[str, Any]
    cfcfrms_payload: Dict[str, Any]
    audit_events: List[Dict[str, Any]] = Field(default_factory=list)


class FreezeStatsResponse(BaseModel):
    total_requests: int
    dispatched: int
    frozen: int
    rejected: int
    revoked: int
    tier1_immediate_stop: int
    tier2_provisional_freeze: int
    tier3_monitor: int
    average_bank_latency_ms: float
    total_amount_protected_inr: float
