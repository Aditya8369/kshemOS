"""
Geo-Targeted Multi-Channel Emergency Broadcast Service for KshemOS.

Implements:
1. Reverse-Geocode Audience Targeting (Service Areas & Custom Perimeters).
2. Multi-Channel Dispatch Adapters (SMS, WhatsApp, Push Notifications, Portal Header Banner).
3. Commander Approval Guardrail (Dual-Authorization Workflow for Critical/High sirens).
4. Real-time Delivery & Acknowledgment Telemetry Simulation.
"""
from __future__ import annotations
import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from app.models import (
    PerimeterTargeting,
    SeniorCenterPOI,
    ChannelConfig,
    DualAuthorization,
    ChannelTelemetryItem,
    DeliveryTelemetry,
    AdvisoryCreate,
    AdvisoryResponse,
    AuthorizeBroadcastRequest,
    EstimateAudienceRequest,
)

# Registry of Metropolitan Operational Service Areas & Demographics
SERVICE_AREAS_REGISTRY: Dict[str, Dict[str, Any]] = {
    "SA-CENTRAL-01": {
        "id": "SA-CENTRAL-01",
        "name": "Central Secretariat Cyber Command",
        "region": "Central Zone",
        "primary_station": "Central Cyber Cell Desk, Barakhamba Road",
        "center_lat": 28.6139,
        "center_lng": 77.2090,
        "radius_km": 4.5,
        "postal_pincodes": ["110001", "110002", "110005"],
        "estimated_citizens": 14500,
        "merchant_nodes_count": 195,
        "bank_branches_count": 48,
        "senior_centers": [
            {"name": "Barakhamba Elder Haven", "lat": 28.6295, "lng": 77.2210, "capacity_beds": 85, "contact_phone": "+91-11-2331-0101"},
            {"name": "Connaught Golden Years Retreat", "lat": 28.6320, "lng": 77.2180, "capacity_beds": 120, "contact_phone": "+91-11-2334-0202"},
            {"name": "Shivaji Senior Wellness Care", "lat": 28.6250, "lng": 77.2140, "capacity_beds": 60, "contact_phone": "+91-11-2336-0303"},
            {"name": "Janpath Assisted Living Lodge", "lat": 28.6190, "lng": 77.2195, "capacity_beds": 95, "contact_phone": "+91-11-2338-0404"},
            {"name": "Mandir Marg Senior Citizens Home", "lat": 28.6310, "lng": 77.2005, "capacity_beds": 110, "contact_phone": "+91-11-2336-0505"},
            {"name": "Babar Road Elders Sanctuary", "lat": 28.6265, "lng": 77.2280, "capacity_beds": 70, "contact_phone": "+91-11-2332-0606"},
        ],
    },
    "SA-SOUTH-01": {
        "id": "SA-SOUTH-01",
        "name": "South Financial Corridors",
        "region": "South Zone",
        "primary_station": "Saket Tech Crime Unit",
        "center_lat": 28.5244,
        "center_lng": 77.2066,
        "radius_km": 6.5,
        "postal_pincodes": ["110017", "110019", "110048"],
        "estimated_citizens": 22000,
        "merchant_nodes_count": 260,
        "bank_branches_count": 64,
        "senior_centers": [
            {"name": "Saket Silver Jubilee Home", "lat": 28.5280, "lng": 77.2150, "capacity_beds": 140, "contact_phone": "+91-11-2651-0111"},
            {"name": "Mehrauli Care Community", "lat": 28.5180, "lng": 77.1950, "capacity_beds": 115, "contact_phone": "+91-11-2652-0222"},
            {"name": "GK Elders Circle", "lat": 28.5390, "lng": 77.2340, "capacity_beds": 90, "contact_phone": "+91-11-2653-0333"},
            {"name": "Hauz Khas Senior Living", "lat": 28.5450, "lng": 77.2020, "capacity_beds": 105, "contact_phone": "+91-11-2654-0444"},
            {"name": "Malviya Care Point", "lat": 28.5320, "lng": 77.2110, "capacity_beds": 75, "contact_phone": "+91-11-2655-0555"},
            {"name": "Sainik Farm Senior Haven", "lat": 28.5080, "lng": 77.2080, "capacity_beds": 80, "contact_phone": "+91-11-2656-0666"},
            {"name": "Vasant Kunj Care Pavilion", "lat": 28.5380, "lng": 77.1550, "capacity_beds": 130, "contact_phone": "+91-11-2657-0777"},
            {"name": "Panchsheel Senior Retreat", "lat": 28.5420, "lng": 77.2180, "capacity_beds": 95, "contact_phone": "+91-11-2658-0888"},
        ],
    },
    "SA-NORTH-01": {
        "id": "SA-NORTH-01",
        "name": "North University & Transit Sector",
        "region": "North Zone",
        "primary_station": "Civil Lines Cyber Post",
        "center_lat": 28.6900,
        "center_lng": 77.2100,
        "radius_km": 5.0,
        "postal_pincodes": ["110007", "110009", "110054"],
        "estimated_citizens": 16800,
        "merchant_nodes_count": 140,
        "bank_branches_count": 32,
        "senior_centers": [
            {"name": "Civil Lines Senior Sanctuary", "lat": 28.6850, "lng": 77.2180, "capacity_beds": 100, "contact_phone": "+91-11-2391-0111"},
            {"name": "Mall Road Golden Age Home", "lat": 28.6980, "lng": 77.2140, "capacity_beds": 80, "contact_phone": "+91-11-2392-0222"},
            {"name": "Kamla Nagar Assisted Care", "lat": 28.6810, "lng": 77.2030, "capacity_beds": 65, "contact_phone": "+91-11-2393-0333"},
            {"name": "GTB Nagar Senior Haven", "lat": 28.7020, "lng": 77.2050, "capacity_beds": 90, "contact_phone": "+91-11-2394-0444"},
            {"name": "Model Town Elderly Care", "lat": 28.7120, "lng": 77.1920, "capacity_beds": 110, "contact_phone": "+91-11-2395-0555"},
        ],
    },
    "SA-WEST-01": {
        "id": "SA-WEST-01",
        "name": "West Commercial Sector",
        "region": "West Zone",
        "primary_station": "Janakpuri Cyber Station",
        "center_lat": 28.6219,
        "center_lng": 77.0878,
        "radius_km": 5.0,
        "postal_pincodes": ["110027", "110058", "110028"],
        "estimated_citizens": 18500,
        "merchant_nodes_count": 210,
        "bank_branches_count": 44,
        "senior_centers": [
            {"name": "Rajouri Garden Senior Oasis", "lat": 28.6410, "lng": 77.1220, "capacity_beds": 95, "contact_phone": "+91-11-2541-0111"},
            {"name": "Janakpuri Assisted Home", "lat": 28.6220, "lng": 77.0880, "capacity_beds": 120, "contact_phone": "+91-11-2542-0222"},
            {"name": "Tagore Garden Elders Rest", "lat": 28.6480, "lng": 77.1110, "capacity_beds": 70, "contact_phone": "+91-11-2543-0333"},
            {"name": "Tilak Nagar Golden Nest", "lat": 28.6360, "lng": 77.0980, "capacity_beds": 85, "contact_phone": "+91-11-2544-0444"},
            {"name": "Vikaspuri Senior Life Center", "lat": 28.6330, "lng": 77.0720, "capacity_beds": 105, "contact_phone": "+91-11-2545-0555"},
            {"name": "Paschim Vihar Care Home", "lat": 28.6650, "lng": 77.0950, "capacity_beds": 110, "contact_phone": "+91-11-2546-0666"},
            {"name": "Punjabi Bagh Seniors Lounge", "lat": 28.6680, "lng": 77.1320, "capacity_beds": 90, "contact_phone": "+91-11-2547-0777"},
        ],
    },
    "SA-EAST-01": {
        "id": "SA-EAST-01",
        "name": "East Trans-Yamuna Safety Sector",
        "region": "East Zone",
        "primary_station": "East Precinct Cyber Unit",
        "center_lat": 28.6200,
        "center_lng": 77.3000,
        "radius_km": 5.5,
        "postal_pincodes": ["110091", "110092", "110095"],
        "estimated_citizens": 15200,
        "merchant_nodes_count": 130,
        "bank_branches_count": 28,
        "senior_centers": [
            {"name": "Mayur Vihar Elders Retreat", "lat": 28.6080, "lng": 77.2950, "capacity_beds": 110, "contact_phone": "+91-11-2271-0111"},
            {"name": "Preet Vihar Care Center", "lat": 28.6410, "lng": 77.2960, "capacity_beds": 85, "contact_phone": "+91-11-2272-0222"},
            {"name": "Laxmi Nagar Senior Life", "lat": 28.6310, "lng": 77.2790, "capacity_beds": 75, "contact_phone": "+91-11-2273-0333"},
            {"name": "Anand Vihar Assisted Living", "lat": 28.6500, "lng": 77.3150, "capacity_beds": 95, "contact_phone": "+91-11-2274-0444"},
        ],
    },
}

TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "tpl_digital_arrest",
        "name": "Digital Arrest Extortion Warning",
        "title": "URGENT PUBLIC SAFETY ALERT: Digital Arrest Extortion Scam",
        "severity": "critical",
        "target_audience": "citizens",
        "description": "Scammers impersonating CBI, Cyber Police, or ED are coercing citizens into continuous video calls under the threat of 'digital arrest' for parcel seizures. Real police agencies NEVER conduct interrogations or demand fund verification over Skype, WhatsApp, or phone. Disconnect immediately and report to 1930.",
        "template_type": "tpl_digital_arrest",
    },
    {
        "id": "tpl_counterfeit_notes",
        "name": "Counterfeit Banknote Warning",
        "title": "ALERT: High-Velocity ₹500 Counterfeit Banknotes Circulating",
        "severity": "high",
        "target_audience": "banks",
        "description": "Sophisticated counterfeit currency detected in commercial banking corridors. Cash desks and merchants must inspect colour-shifting security threads and watermark micro-lettering prior to cash ingestion.",
        "template_type": "tpl_counterfeit_notes",
    },
    {
        "id": "tpl_mule_account",
        "name": "Coerced Mule Account Crackdown",
        "title": "NOTICE: Illegal Rented Bank Accounts & Mule Recruiters",
        "severity": "high",
        "target_audience": "citizens",
        "description": "Offering your bank account or UPI credentials for 'commission jobs' or crypto transfers is a punishable offense under PMLA. Criminal syndicates use rented accounts for cyber extortion.",
        "template_type": "tpl_mule_account",
    },
    {
        "id": "tpl_atm_skimming",
        "name": "ATM Skimmer & Cash-Out Wave",
        "title": "SURVEILLANCE ADVISORY: ATM Wireless Skimmer Devices",
        "severity": "high",
        "target_audience": "banks",
        "description": "Active skimming hardware detected at transit kiosks. Inspect card insertion bezels and PIN overlay pads before entering security PINs.",
        "template_type": "tpl_atm_skimming",
    },
]


class EmergencyBroadcastEngine:
    """Core domain engine for geo-targeted emergency broadcast delivery and telemetry."""

    def __init__(self):
        self.advisories: Dict[str, Dict[str, Any]] = {}
        self._seed_default_data()

    def _seed_default_data(self):
        """Pre-seeds realistic broadcast items so the system is immediately usable."""
        now = datetime.now(timezone.utc).isoformat()
        sample_id = "ADV-9104"
        targeting = self.estimate_audience(
            EstimateAudienceRequest(
                targeting_type="service_area",
                service_area_id="SA-CENTRAL-01"
            )
        )
        channels = ChannelConfig(
            sms_gateway=True,
            whatsapp_emergency=True,
            push_notifications=True,
            portal_header_banner=True,
        )
        dual_auth = DualAuthorization(
            requires_dual_auth=True,
            authorizer_1_badge="BADGE-CMD-701",
            authorizer_1_name="Commander Rajesh Varma",
            authorizer_1_role="Senior Superintendent of Police",
            authorizer_1_timestamp="2026-11-03T09:15:00Z",
            authorizer_2_badge="BADGE-DCP-402",
            authorizer_2_name="Deputy Commissioner Ananya Sen",
            authorizer_2_role="Joint Director, Cyber Public Safety",
            authorizer_2_timestamp="2026-11-03T09:18:00Z",
            is_fully_authorized=True,
        )
        telemetry = self.compute_initial_telemetry(targeting, channels)
        # Advance counters for the seed to show live receipts
        telemetry.dispatched = 14500
        telemetry.delivered = 14240
        telemetry.read = 11980
        telemetry.failed = 260
        telemetry.linked_citizen_reports = 18
        telemetry.delivery_rate_pct = 98.2
        telemetry.read_rate_pct = 82.6

        exp_time = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
        self.advisories[sample_id] = {
            "id": sample_id,
            "title": "CRITICAL SIREN: Fake CBI/ED Digital Arrest Syndicate Active in Central Zone",
            "description": "Organized extortion ring contacting residents with forged Supreme Court warrants. Never transfer funds or remain on coerced video calls. Police never demand money for verification.",
            "severity": "critical",
            "affected_location": "Central Zone (Connaught Place & Barakhamba Corridor)",
            "target_audience": "citizens",
            "template_type": "tpl_digital_arrest",
            "status": "published",
            "created_at": "2026-11-03T09:10:00Z",
            "updated_at": now,
            "source": "Central Cyber Cell Desk, Barakhamba Road",
            "issued_at": "2026-11-03T09:19:00Z",
            "expires_at": exp_time,
            "is_expired": False,
            "targeting": targeting.model_dump(),
            "channels": channels.model_dump(),
            "dual_auth": dual_auth.model_dump(),
            "delivery_status": {"sent": 14500, "pending": 0, "failed": 260},
            "telemetry": telemetry.model_dump(),
            "audit_trail": [
                {"action": "CREATED", "timestamp": "2026-11-03T09:10:00Z", "details": "Draft created by Commander Rajesh Varma (BADGE-CMD-701)."},
                {"action": "AUTHORIZER_1_SIGNED", "timestamp": "2026-11-03T09:15:00Z", "details": "1st Authorization signed by Commander Rajesh Varma."},
                {"action": "AUTHORIZER_2_SIGNED", "timestamp": "2026-11-03T09:18:00Z", "details": "2nd Dual-Authorization approved by DCP Ananya Sen (BADGE-DCP-402)."},
                {"action": "DISPATCHED_TO_CHANNELS", "timestamp": "2026-11-03T09:19:00Z", "details": "Simultaneous dispatch across SMS, WhatsApp, Push & Portal Banner to 14,500 citizens."},
            ],
        }

    def estimate_audience(self, req: EstimateAudienceRequest) -> PerimeterTargeting:
        """Reverse-geocodes service area boundary or perimeter coordinates to compute audience demographics."""
        sa_id = req.service_area_id or "SA-CENTRAL-01"

        if req.targeting_type == "service_area" and sa_id in SERVICE_AREAS_REGISTRY:
            data = SERVICE_AREAS_REGISTRY[sa_id]
            senior_pois = [SeniorCenterPOI(**p) for p in data["senior_centers"]]
            return PerimeterTargeting(
                targeting_type="service_area",
                service_area_id=sa_id,
                service_area_name=data["name"],
                region=data["region"],
                center_lat=data["center_lat"],
                center_lng=data["center_lng"],
                radius_km=data["radius_km"],
                postal_pincodes=data["postal_pincodes"],
                estimated_citizens=data["estimated_citizens"],
                senior_centers_count=len(senior_pois),
                senior_centers=senior_pois,
                merchant_nodes_count=data["merchant_nodes_count"],
                bank_branches_count=data["bank_branches_count"],
                primary_station=data["primary_station"],
            )

        # Custom perimeter calculation based on lat/lng and radius
        lat = req.center_lat or 28.6139
        lng = req.center_lng or 77.2090
        radius = req.radius_km or 4.0

        area = math.pi * (radius ** 2)
        est_citizens = max(800, int(round(area * 720)))
        merchants = max(15, int(round(area * 14)))
        banks = max(5, int(round(area * 3.5)))

        # Find closest service area for naming context
        closest_sa = min(
            SERVICE_AREAS_REGISTRY.values(),
            key=lambda s: (s["center_lat"] - lat) ** 2 + (s["center_lng"] - lng) ** 2
        )

        sample_seniors = [
            SeniorCenterPOI(
                name=f"Perimeter Elder Care Node #{idx+1}",
                lat=round(lat + (idx * 0.006 * (-1 if idx % 2 else 1)), 4),
                lng=round(lng + (idx * 0.007 * (1 if idx % 2 else -1)), 4),
                capacity_beds=60 + (idx * 20),
                contact_phone=f"+91-11-2300-{1000 + idx}",
            )
            for idx in range(min(5, max(2, int(round(radius * 0.8)))))
        ]

        return PerimeterTargeting(
            targeting_type="custom_perimeter",
            service_area_id=None,
            service_area_name=f"Tactical Perimeter ({radius} km around {lat:.3f}°N, {lng:.3f}°E)",
            region=closest_sa["region"],
            center_lat=lat,
            center_lng=lng,
            radius_km=radius,
            postal_pincodes=["110001", "110002"],
            estimated_citizens=est_citizens,
            senior_centers_count=len(sample_seniors),
            senior_centers=sample_seniors,
            merchant_nodes_count=merchants,
            bank_branches_count=banks,
            primary_station=closest_sa["primary_station"],
        )

    def evaluate_dual_auth_requirement(self, severity: str, targeting: PerimeterTargeting) -> bool:
        """Dual-authorization guardrail: required for critical/high sirens or large audience (>5000)."""
        if severity.lower() in ("critical", "high"):
            return True
        if targeting.estimated_citizens > 5000:
            return True
        return False

    def adapt_sms_payload(self, title: str, description: str, ref_id: str) -> str:
        """Adapts alert to strict TRAI/CDAC DLT emergency SMS limit (<160 chars)."""
        core = f"[KSHEM-POLICE ALERT {ref_id}] {title}. Real police never ask for money or video arrest. Dial 1930. kshemos.gov.in"
        if len(core) > 160:
            core = f"[KSHEM-POLICE {ref_id}] URGENT: {title[:70]}... Never send money. Call 1930. kshemos.gov.in"
        return core

    def adapt_whatsapp_payload(self, title: str, description: str, ref_id: str, location: str) -> Dict[str, Any]:
        """Adapts alert for Meta Verified Government WhatsApp Broadcast."""
        return {
            "template": "emergency_public_safety_siren_v2",
            "header": f"🚨 LAW ENFORCEMENT PUBLIC SAFETY ADVISORY [{ref_id}]",
            "body": f"*{title}*\n\n{description}\n\n📍 *Affected Perimeter:* {location}\n👮 *Reporting Desk:* Dial 1930 or verify via KshemOS Portal.",
            "buttons": [
                {"type": "url", "text": "Verify Official Notice", "url": f"https://kshemos.gov.in/advisory/{ref_id}"},
                {"type": "phone_number", "text": "Call Cyber Helpline (1930)", "phone_number": "1930"},
            ],
        }

    def adapt_push_payload(self, title: str, description: str, severity: str, ref_id: str) -> Dict[str, Any]:
        """Adapts alert for APNS/FCM mobile push with high-priority siren channel."""
        return {
            "title": f"🚨 EMERGENCY SIREN: {title}",
            "body": description[:180] + ("..." if len(description) > 180 else ""),
            "sound": "emergency_siren.wav" if severity in ("critical", "high") else "default",
            "priority": "high",
            "data": {
                "advisory_id": ref_id,
                "severity": severity,
                "type": "EMERGENCY_BROADCAST",
                "click_action": f"/advisory/{ref_id}",
            },
        }

    def adapt_portal_banner_payload(self, title: str, description: str, severity: str, ref_id: str, location: str) -> Dict[str, Any]:
        """Adapts alert for the citizen portal and HQ dashboard sticky marquee."""
        return {
            "advisory_id": ref_id,
            "marquee_text": f"⚠️ {severity.upper()} ADVISORY: {title} ({location}) — Disconnect scam calls immediately.",
            "severity": severity,
            "action_text": "Review Safety Directives",
            "action_url": f"/advisory/{ref_id}",
            "active": True,
        }

    def compute_initial_telemetry(self, targeting: PerimeterTargeting, channels: ChannelConfig) -> DeliveryTelemetry:
        """Initializes telemetry channel counters based on targeted demographic footprint."""
        total = targeting.estimated_citizens
        channel_items: Dict[str, ChannelTelemetryItem] = {}

        if channels.sms_gateway:
            channel_items["sms"] = ChannelTelemetryItem(
                channel="sms",
                channel_name="CDAC/TRAI National Emergency SMS",
                dispatched=int(total * 0.95),
                delivered=0,
                read=0,
                failed=0,
                delivery_rate_pct=0.0,
            )
        if channels.whatsapp_emergency:
            channel_items["whatsapp"] = ChannelTelemetryItem(
                channel="whatsapp",
                channel_name="Meta Verified Gov WhatsApp Alert",
                dispatched=int(total * 0.88),
                delivered=0,
                read=0,
                failed=0,
                delivery_rate_pct=0.0,
            )
        if channels.push_notifications:
            channel_items["push"] = ChannelTelemetryItem(
                channel="push",
                channel_name="KshemOS Citizen App Priority Push",
                dispatched=int(total * 0.65),
                delivered=0,
                read=0,
                failed=0,
                delivery_rate_pct=0.0,
            )
        if channels.portal_header_banner:
            channel_items["portal_banner"] = ChannelTelemetryItem(
                channel="portal_banner",
                channel_name="Citizen Portal Sticky Marquee",
                dispatched=total,
                delivered=0,
                read=0,
                failed=0,
                delivery_rate_pct=0.0,
            )

        total_dispatched = sum(item.dispatched for item in channel_items.values())

        return DeliveryTelemetry(
            dispatched=total_dispatched,
            delivered=0,
            read=0,
            failed=0,
            linked_citizen_reports=0,
            delivery_rate_pct=0.0,
            read_rate_pct=0.0,
            channels=channel_items,
        )

    def create_broadcast(self, payload: AdvisoryCreate) -> AdvisoryResponse:
        """Creates a new advisory draft with reverse-geocoded audience and evaluated guardrails."""
        advisory_id = f"ADV-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        # Handle targeting
        targeting = payload.targeting or self.estimate_audience(
            EstimateAudienceRequest(
                targeting_type="service_area",
                service_area_id="SA-CENTRAL-01"
            )
        )
        channels = payload.channels or ChannelConfig()
        req_dual = self.evaluate_dual_auth_requirement(payload.severity, targeting)

        dual_auth = DualAuthorization(
            requires_dual_auth=req_dual,
            authorizer_1_badge=payload.created_by_badge or "BADGE-CMD-701",
            authorizer_1_name=payload.created_by_name or "Commander Rajesh Varma",
            authorizer_1_role="Initiating Commander",
            authorizer_1_timestamp=now,
            authorizer_2_badge=None,
            authorizer_2_name=None,
            authorizer_2_role=None,
            authorizer_2_timestamp=None,
            is_fully_authorized=not req_dual,
        )

        initial_status = "pending_second_authorization" if req_dual else "approved"
        telemetry = self.compute_initial_telemetry(targeting, channels)

        exp_hours = getattr(payload, "expires_in_hours", 48) or 48
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=exp_hours)).isoformat()
        source = getattr(payload, "source", None) or targeting.primary_station or "Cyber Public Safety Command, New Delhi"

        record = {
            "id": advisory_id,
            "title": payload.title,
            "description": payload.description,
            "severity": payload.severity,
            "affected_location": payload.affected_location or targeting.region or "Metropolitan Sector",
            "target_audience": payload.target_audience,
            "template_type": payload.template_type,
            "status": "draft",
            "created_at": now,
            "updated_at": now,
            "source": source,
            "issued_at": None,
            "expires_at": expires_at,
            "is_expired": False,
            "targeting": targeting.model_dump(),
            "channels": channels.model_dump(),
            "dual_auth": dual_auth.model_dump(),
            "delivery_status": {"sent": 0, "pending": telemetry.dispatched, "failed": 0},
            "telemetry": telemetry.model_dump(),
            "audit_trail": [
                {
                    "action": "CREATED",
                    "timestamp": now,
                    "details": f"Draft created by {payload.created_by_name} ({payload.created_by_badge}). Dual-authorization requirement: {req_dual}.",
                }
            ],
        }

        self.advisories[advisory_id] = record
        return AdvisoryResponse(**record)

    def authorize_broadcast(self, advisory_id: str, req: AuthorizeBroadcastRequest) -> AdvisoryResponse:
        """Executes commander sign-off step, enforcing the dual-authorization guardrail."""
        if advisory_id not in self.advisories:
            raise KeyError(f"Advisory {advisory_id} not found.")

        advisory = self.advisories[advisory_id]
        now = datetime.now(timezone.utc).isoformat()
        dual_auth = DualAuthorization(**advisory["dual_auth"])

        if req.decision == "reject":
            advisory["status"] = "rejected"
            advisory["updated_at"] = now
            dual_auth.rejection_reason = req.reviewer_notes or "Rejected during commander review."
            advisory["dual_auth"] = dual_auth.model_dump()
            advisory["audit_trail"].append({
                "action": "REJECTED_BY_COMMANDER",
                "timestamp": now,
                "details": f"Advisory rejected by {req.authorizer_name} ({req.authorizer_badge}): {req.reviewer_notes}",
            })
            return AdvisoryResponse(**advisory)

        # Check dual authorization requirements
        if not dual_auth.authorizer_1_badge:
            # First authorizer sign-off
            dual_auth.authorizer_1_badge = req.authorizer_badge
            dual_auth.authorizer_1_name = req.authorizer_name
            dual_auth.authorizer_1_role = req.authorizer_role
            dual_auth.authorizer_1_timestamp = now

            if not dual_auth.requires_dual_auth:
                dual_auth.is_fully_authorized = True
                advisory["status"] = "approved"
            else:
                advisory["status"] = "pending_second_authorization"

            advisory["audit_trail"].append({
                "action": "AUTHORIZER_1_SIGNED",
                "timestamp": now,
                "details": f"First authorization signed by {req.authorizer_name} ({req.authorizer_badge}).",
            })
        else:
            # Second authorizer sign-off
            if req.authorizer_badge == dual_auth.authorizer_1_badge:
                raise ValueError("Second authorizer must be a distinct officer (dual-authorization guardrail).")

            dual_auth.authorizer_2_badge = req.authorizer_badge
            dual_auth.authorizer_2_name = req.authorizer_name
            dual_auth.authorizer_2_role = req.authorizer_role
            dual_auth.authorizer_2_timestamp = now
            dual_auth.is_fully_authorized = True
            advisory["status"] = "approved"

            advisory["audit_trail"].append({
                "action": "AUTHORIZER_2_SIGNED",
                "timestamp": now,
                "details": f"Second dual-authorization confirmed by {req.authorizer_name} ({req.authorizer_badge}). Guardrail cleared for dispatch.",
            })

        advisory["updated_at"] = now
        advisory["dual_auth"] = dual_auth.model_dump()
        return AdvisoryResponse(**advisory)

    def dispatch_broadcast(self, advisory_id: str) -> AdvisoryResponse:
        """Dispatches approved broadcast to all enabled multi-channel delivery adapters."""
        if advisory_id not in self.advisories:
            raise KeyError(f"Advisory {advisory_id} not found.")

        advisory = self.advisories[advisory_id]
        dual_auth = DualAuthorization(**advisory["dual_auth"])

        # Guardrail check
        if dual_auth.requires_dual_auth and not dual_auth.is_fully_authorized:
            raise PermissionError(
                "Commander Guardrail Violation: Broadcast requires dual-authorization before live dispatch to prevent mass panic."
            )

        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        targeting = PerimeterTargeting(**advisory["targeting"])
        channels = ChannelConfig(**advisory["channels"])
        telemetry = self.compute_initial_telemetry(targeting, channels)

        # Simulate immediate confirmed dispatch numbers
        total = telemetry.dispatched
        deliv = int(total * 0.984)
        reads = int(deliv * 0.835)
        failed = total - deliv

        telemetry.dispatched = total
        telemetry.delivered = deliv
        telemetry.read = reads
        telemetry.failed = failed
        telemetry.linked_citizen_reports = 12
        telemetry.delivery_rate_pct = round((deliv / total) * 100, 1) if total > 0 else 0.0
        telemetry.read_rate_pct = round((reads / deliv) * 100, 1) if deliv > 0 else 0.0

        for key, item in telemetry.channels.items():
            item.delivered = int(item.dispatched * 0.985)
            item.read = int(item.delivered * 0.82)
            item.failed = item.dispatched - item.delivered
            item.delivery_rate_pct = 98.5

        advisory["status"] = "published"
        advisory["updated_at"] = now
        if not advisory.get("issued_at"):
            advisory["issued_at"] = now
        if not advisory.get("expires_at"):
            advisory["expires_at"] = (now_dt + timedelta(hours=48)).isoformat()
        if not advisory.get("source"):
            advisory["source"] = targeting.primary_station or "Cyber Public Safety Command, New Delhi"
        advisory["is_expired"] = False
        advisory["delivery_status"] = {"sent": deliv, "pending": 0, "failed": failed}
        advisory["telemetry"] = telemetry.model_dump()

        enabled_names = [k for k, v in channels.model_dump().items() if v]
        advisory["audit_trail"].append({
            "action": "DISPATCHED_TO_CHANNELS",
            "timestamp": now,
            "details": f"Simultaneous emergency broadcast dispatched to {', '.join(enabled_names)} ({deliv:,} verified deliveries).",
        })

        # Trigger public email advisory subscriber notification dispatch
        try:
            from app.services.advisory_subscriptions import dispatch_advisory_to_subscribers
            sub_dispatch = dispatch_advisory_to_subscribers(advisory)
            advisory["audit_trail"].append({
                "action": "PUBLIC_SUBSCRIBERS_NOTIFIED",
                "timestamp": now,
                "details": f"Dispatched alerts to {sub_dispatch.get('sent_count', 0)} public email subscribers ({sub_dispatch.get('duplicate_prevented_count', 0)} duplicates prevented).",
            })
        except Exception:
            pass

        return AdvisoryResponse(**advisory)

    def advance_telemetry(self, advisory_id: str, new_acks: int = 150) -> DeliveryTelemetry:
        """Simulates incoming telemetry acknowledgments and linked citizen reports."""
        if advisory_id not in self.advisories:
            raise KeyError(f"Advisory {advisory_id} not found.")

        advisory = self.advisories[advisory_id]
        telemetry = DeliveryTelemetry(**advisory["telemetry"])

        telemetry.read = min(telemetry.delivered, telemetry.read + new_acks)
        telemetry.linked_citizen_reports += max(1, int(new_acks * 0.04))
        if telemetry.delivered > 0:
            telemetry.read_rate_pct = round((telemetry.read / telemetry.delivered) * 100, 1)

        advisory["telemetry"] = telemetry.model_dump()
        return telemetry

    def get_active_banner(self) -> Optional[Dict[str, Any]]:
        """Returns the highest priority published advisory with portal_header_banner enabled."""
        published = [
            a for a in self.advisories.values()
            if a["status"] == "published" and a.get("channels", {}).get("portal_header_banner", False)
        ]
        if not published:
            return None

        # Sort by severity priority: critical > high > medium > low
        prio = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        published.sort(key=lambda a: (prio.get(a["severity"], 0), a["created_at"]), reverse=True)
        top = published[0]

        return self.adapt_portal_banner_payload(
            top["title"],
            top["description"],
            top["severity"],
            top["id"],
            top["affected_location"]
        )


# Global singleton instance
default_broadcast_engine = EmergencyBroadcastEngine()
