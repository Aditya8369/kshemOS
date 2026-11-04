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


# ---------- Offline Sync Models ----------

class SyncQueueItem(BaseModel):
    queue_id: str
    incident_id: str
    action_type: str
    changes: dict[str, Any]
    queued_at: int
    client_version: int
    status: str
    retry_count: int = 0
    error_message: Optional[str] = None
    applied_at: Optional[int] = None
    server_incident_snapshot: Optional[dict[str, Any]] = None


class SyncBatchRequest(BaseModel):
    client_id: str
    items: list[SyncQueueItem]


class SyncBatchResponse(BaseModel):
    processed: int
    succeeded: int
    conflicts: int
    results: list[dict[str, Any]]


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
    case_number: str
    incident_id: Optional[str] = None
    title: str
    file_name: str
    mime_type: str = "application/octet-stream"
    raw_payload_content: str
    officer_badge_id: str
    officer_name: str
    client_ip: str = "127.0.0.1"
    crime_category: str = "digital_arrest"
    notes: Optional[str] = None


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


# ---------- Role-Aware Incident Assignment & Escalation Notification Models ----------

class OfficerNotificationPreference(BaseModel):
    email_enabled: bool = True
    assignment_enabled: bool = True
    reassignment_enabled: bool = True
    escalation_enabled: bool = True
    supervisor_review_enabled: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"
    timezone: str = "Asia/Kolkata"


class OfficerDirectoryEntry(BaseModel):
    officer_id: str
    name: str
    email: str
    role: Literal["responder", "supervisor", "commander"]
    jurisdiction_id: str
    regions: list[str]
    preferences: OfficerNotificationPreference = Field(default_factory=OfficerNotificationPreference)


class IncidentNotificationPayload(BaseModel):
    notification_id: str
    incident_id: str
    event_type: Literal["assignment", "reassignment", "escalation", "supervisor_review"]
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
    delivery_status: Literal[
        "delivered",
        "failed",
        "retrying",
        "suppressed_quiet_hours",
        "suppressed_unsubscribed",
        "unauthorized_jurisdiction",
    ]
    attempts: int = 1
    last_attempt_at: int
    error_message: Optional[str] = None
    retry_history: list[dict[str, Any]] = Field(default_factory=list)


class SendNotificationRequest(BaseModel):
    incident_id: str
    event_type: Literal["assignment", "reassignment", "escalation", "supervisor_review"]
    actor_id: Optional[str] = None
    override_recipient_id: Optional[str] = None
    notes: Optional[str] = None


class UpdateOfficerPreferencesRequest(BaseModel):
    preferences: OfficerNotificationPreference


class RetryNotificationResponse(BaseModel):
    success: bool
    notification: IncidentNotificationPayload
    message: str


class NotificationAuditResponse(BaseModel):
    total: int
    delivered: int
    retrying: int
    failed: int
    suppressed: int
    notifications: list[IncidentNotificationPayload]
