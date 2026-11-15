"""
Privacy-Preserving Regional Threat Broadcast & Micro-Advisory Mesh Service.

Aggregates verified citizen complaints by postal pin code and police station circle,
automatically generating localized micro-advisories when 3+ complaints of the same
scam category occur in a service area within a 24-hour window.

Privacy & Boundary Rules:
1. Zero PII Exposure: Strips individual victim names, phone numbers, exact street addresses,
   and financial loss figures. Only k-anonymous cluster metrics and modus operandi are synthesized.
2. Cluster Threshold: Generates micro-advisory draft only when >= 3 reports occur in a service area within 24h.
3. Commander Sign-off: Micro-advisories remain in DRAFTED_PENDING_APPROVAL until a commanding officer
   provides single-click authorization to publish to the citizen portal banner.
4. Strict Geofencing: Citizen portal banner query strictly evaluates pin code, coordinates, or circle ID.
   Advisories are withheld outside the affected jurisdiction boundary to prevent panic and alert fatigue.
"""

from __future__ import annotations

import copy
import itertools
import math
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from app.models import (
    CitizenMeshAdvisoryQuery,
    CommanderSignoffRequest,
    MicroAdvisoryStatus,
    RegionalMicroAdvisory,
    RegionalThreatCluster,
    RegionalThreatMeshStats,
)

_lock = threading.RLock()
_cluster_counter = itertools.count(101)
_advisory_counter = itertools.count(101)
_report_counter = itertools.count(8001)

# In-memory stores
_clusters: Dict[str, Dict[str, Any]] = {}
_advisories: Dict[str, Dict[str, Any]] = {}
_citizen_reports_pool: List[Dict[str, Any]] = []

# Service Area Registry for Delhi-NCR Metropolitan Grid
SERVICE_AREAS_REGISTRY: Dict[str, Dict[str, Any]] = {
    "SA-NORTH-01": {
        "service_area_id": "SA-NORTH-01",
        "service_area_name": "North Delhi Cyber Command",
        "police_station_circle": "Civil Lines Cyber Cell Desk",
        "postal_pincodes": ["110007", "110009", "110054"],
        "geofence_center": {"lat": 28.6920, "lng": 77.2150},
        "geofence_radius_km": 5.5,
    },
    "SA-CENTRAL-01": {
        "service_area_id": "SA-CENTRAL-01",
        "service_area_name": "Central Secretariat Cyber Command",
        "police_station_circle": "Central Cyber Cell Desk, Barakhamba Road",
        "postal_pincodes": ["110001", "110002", "110005"],
        "geofence_center": {"lat": 28.6139, "lng": 77.2090},
        "geofence_radius_km": 4.5,
    },
    "SA-SOUTH-01": {
        "service_area_id": "SA-SOUTH-01",
        "service_area_name": "South Financial Corridors",
        "police_station_circle": "Saket Tech Crime Unit",
        "postal_pincodes": ["110017", "110019", "110048"],
        "geofence_center": {"lat": 28.5244, "lng": 77.2066},
        "geofence_radius_km": 6.5,
    },
    "SA-WEST-01": {
        "service_area_id": "SA-WEST-01",
        "service_area_name": "West District Cyber Cell",
        "police_station_circle": "Rajouri Garden Cyber Police Desk",
        "postal_pincodes": ["110027", "110015", "110026"],
        "geofence_center": {"lat": 28.6500, "lng": 77.1200},
        "geofence_radius_km": 5.0,
    },
}

SCAM_METADATA_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "electricity_bill_scam": {
        "label": "Fake Electricity Bill Payment SMS",
        "headline_template": "Notice: Fake electricity bill payment SMS active in {area} area.",
        "modus_operandi": (
            "Cyber criminals are circulating deceptive SMS notices claiming electricity will be disconnected tonight "
            "due to unpaid bills. Citizens are instructed to call a 10-digit mobile number or install a remote-access APK."
        ),
        "guidance_checklist": [
            "Do not call unauthorized mobile numbers or click shortened URLs in disconnection SMS messages.",
            "Official discoms (BSES, Tata Power, NDPL) never demand bill payment via personal UPI handles or WhatsApp.",
            "Verify dues directly through your official DISCOM mobile app or dial customer toll-free 19122.",
            "Report fraudulent numbers immediately to Cyber Crime Helpline 1930.",
        ],
        "default_urgency": "high",
    },
    "digital_arrest": {
        "label": "Impersonation Video Call Digital Arrest",
        "headline_template": "Notice: Fake police & CBI digital arrest video calls active in {area} area.",
        "modus_operandi": (
            "Scammers impersonating CBI or Mumbai Police officers place video calls wearing fake uniforms and demand "
            "funds transfer to clear alleged illegal narcotics parcels or money laundering warrants."
        ),
        "guidance_checklist": [
            "Under Indian law (BNSS) and court rules, no agency can place citizens under arrest via phone or video call.",
            "Official law enforcement never asks citizens to transfer money to clearing or RBI verification accounts.",
            "Disconnect video calls immediately; perform reverse verification on verified landlines.",
            "Report active extortion attempts to nearest cyber police station or 1930.",
        ],
        "default_urgency": "critical",
    },
    "courier_customs_fraud": {
        "label": "Seized Courier Contraband Clearance Scam",
        "headline_template": "Notice: Seized parcel customs clearance fee scam active in {area} area.",
        "modus_operandi": (
            "Fraudulent calls claiming a parcel containing narcotics or passports was intercepted at customs, "
            "demanding instant penalty clearance via UPI."
        ),
        "guidance_checklist": [
            "Customs departments never demand fine settlement over phone or personal UPI accounts.",
            "Do not share OTPs, Aadhaar, or PAN cards with callers claiming to represent courier companies.",
            "Track international shipments exclusively on official courier portals (FedEx, DHL, India Post).",
        ],
        "default_urgency": "high",
    },
    "part_time_job_scam": {
        "label": "Telegram Work-From-Home Task Scam",
        "headline_template": "Notice: Fraudulent Telegram part-time rating scam active in {area} area.",
        "modus_operandi": (
            "Recruiters promising high daily returns for rating videos or hotels, later freezing victim deposits in crypto wallets."
        ),
        "guidance_checklist": [
            "Legitimate companies never ask employees or freelancers to deposit money to unlock earnings.",
            "Block unknown recruitment handles on WhatsApp and Telegram immediately.",
        ],
        "default_urgency": "medium",
    },
}


def _now_ms() -> int:
    return int(time.time() * 1000)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def find_service_area_for_pincode(pincode: str) -> Optional[Dict[str, Any]]:
    for sa in SERVICE_AREAS_REGISTRY.values():
        if pincode in sa["postal_pincodes"]:
            return sa
    return None


def ingest_verified_citizen_report(
    pincode: str,
    scam_category: str,
    service_area_id: Optional[str] = None,
    raw_timestamp: Optional[int] = None,
) -> Tuple[str, Optional[RegionalMicroAdvisory]]:
    """
    Ingests an anonymous verified citizen report into the regional mesh pool.
    Strips all victim PII, verifies 3+ cluster thresholds within 24 hours,
    and drafts an automated localized micro-advisory if the threshold is met.
    """
    with _lock:
        now = raw_timestamp or _now_ms()
        anon_ref = f"ANON-REF-{next(_report_counter)}"

        sa = None
        if service_area_id and service_area_id in SERVICE_AREAS_REGISTRY:
            sa = SERVICE_AREAS_REGISTRY[service_area_id]
        else:
            sa = find_service_area_for_pincode(pincode) or SERVICE_AREAS_REGISTRY["SA-NORTH-01"]

        # Store anonymized report entry
        report_entry = {
            "anon_ref": anon_ref,
            "pincode": pincode,
            "service_area_id": sa["service_area_id"],
            "scam_category": scam_category,
            "timestamp": now,
        }
        _citizen_reports_pool.append(report_entry)

        # Run cluster aggregation for this service_area & scam_category
        return anon_ref, evaluate_and_refresh_clusters(sa["service_area_id"], scam_category)


def evaluate_and_refresh_clusters(
    service_area_id: str,
    scam_category: str,
    window_hours: float = 24.0,
) -> Optional[RegionalMicroAdvisory]:
    """
    Evaluates complaints in service area within the window.
    If >= 3 complaints match the same scam category, creates or updates
    a RegionalThreatCluster and drafts a RegionalMicroAdvisory for commander sign-off.
    """
    with _lock:
        now = _now_ms()
        window_ms = int(window_hours * 3600 * 1000)
        cutoff_ms = now - window_ms

        matching_reports = [
            r for r in _citizen_reports_pool
            if r["service_area_id"] == service_area_id
            and r["scam_category"] == scam_category
            and r["timestamp"] >= cutoff_ms
        ]

        if len(matching_reports) < 3:
            return None

        sa = SERVICE_AREAS_REGISTRY.get(service_area_id, SERVICE_AREAS_REGISTRY["SA-NORTH-01"])
        meta = SCAM_METADATA_DEFINITIONS.get(scam_category, SCAM_METADATA_DEFINITIONS["electricity_bill_scam"])

        cluster_key = f"CLUST-{service_area_id}-{scam_category}"
        matching_reports.sort(key=lambda x: x["timestamp"])
        first_ts = matching_reports[0]["timestamp"]
        last_ts = matching_reports[-1]["timestamp"]
        actual_window_hours = round(max(0.5, (last_ts - first_ts) / (3600 * 1000)), 1)
        if actual_window_hours > 24.0:
            actual_window_hours = 24.0

        cluster_record = RegionalThreatCluster(
            cluster_id=cluster_key,
            service_area_id=sa["service_area_id"],
            service_area_name=sa["service_area_name"],
            police_station_circle=sa["police_station_circle"],
            postal_pincodes=list(sa["postal_pincodes"]),
            scam_category=scam_category,
            scam_category_label=meta["label"],
            complaint_count=len(matching_reports),
            first_complaint_timestamp=first_ts,
            last_complaint_timestamp=last_ts,
            window_hours=actual_window_hours,
            privacy_guarantee="K-Anonymity Verified: Zero PII or individual loss figures retained",
            anonymized_report_refs=[r["anon_ref"] for r in matching_reports],
        )
        _clusters[cluster_key] = cluster_record.model_dump()

        # Check if an advisory already exists for this cluster
        advisory_key = f"ADV-MESH-{service_area_id}-{scam_category}"
        existing_adv = _advisories.get(advisory_key)

        area_clean = sa["service_area_name"].replace(" Cyber Command", "").replace(" Cyber Cell", "").strip()
        title = meta["headline_template"].format(area=area_clean)
        summary = (
            f"{meta['modus_operandi']} Law enforcement has verified {len(matching_reports)} complaints "
            f"within the {sa['police_station_circle']} jurisdiction over the past {actual_window_hours} hours. "
            f"Citizens in postal areas {', '.join(sa['postal_pincodes'])} are advised to exercise heightened caution."
        )

        banner_text = (
            f"Notice: {meta['label']} active in {sa['service_area_name']} area. "
            "Verify all claims through official portals only."
        )

        if existing_adv:
            # Update complaint count and window hours without overwriting published status
            existing_adv["complaints_aggregated"] = len(matching_reports)
            existing_adv["window_hours"] = actual_window_hours
            existing_adv["summary_guidance"] = summary
            existing_adv["active_portal_banner_text"] = banner_text
            return RegionalMicroAdvisory(**copy.deepcopy(existing_adv))

        # Create new draft advisory requiring commander sign-off
        new_advisory = RegionalMicroAdvisory(
            advisory_id=advisory_key,
            cluster_id=cluster_key,
            title=title,
            summary_guidance=summary,
            scam_category=scam_category,
            service_area_id=sa["service_area_id"],
            service_area_name=sa["service_area_name"],
            police_station_circle=sa["police_station_circle"],
            target_pincodes=list(sa["postal_pincodes"]),
            geofence_center=sa["geofence_center"],
            geofence_radius_km=sa["geofence_radius_km"],
            complaints_aggregated=len(matching_reports),
            window_hours=actual_window_hours,
            status="DRAFTED_PENDING_APPROVAL",
            urgency=meta["default_urgency"],
            action_checklist=list(meta["guidance_checklist"]),
            drafted_at=now,
            published_at=None,
            approved_by_commander_badge=None,
            approved_by_commander_name=None,
            active_portal_banner_text=banner_text,
        )
        _advisories[advisory_key] = new_advisory.model_dump()
        return new_advisory


def signoff_micro_advisory(
    advisory_id: str,
    request: CommanderSignoffRequest,
) -> Optional[RegionalMicroAdvisory]:
    """
    Commander single-click sign-off workflow.
    Publishes the micro-advisory to the regional citizen portal mesh or dismisses it.
    """
    with _lock:
        adv = _advisories.get(advisory_id)
        if not adv:
            return None

        now = _now_ms()
        if request.action == "approve_publish":
            adv["status"] = "PUBLISHED_ACTIVE"
            adv["approved_by_commander_badge"] = request.commander_badge_id
            adv["approved_by_commander_name"] = request.commander_name
            adv["published_at"] = now
        elif request.action == "dismiss":
            adv["status"] = "DISMISSED"

        return RegionalMicroAdvisory(**copy.deepcopy(adv))


def query_citizen_portal_mesh_banner(
    query: CitizenMeshAdvisoryQuery,
) -> Optional[Dict[str, Any]]:
    """
    Strict Geofenced Boundary Query:
    Returns the active micro-advisory portal banner ONLY if citizen is located within
    the target pin code, service area, or geofence radius.
    Withholds advisories outside the affected jurisdiction boundary to prevent panic.
    """
    with _lock:
        published = [
            a for a in _advisories.values()
            if a.get("status") == "PUBLISHED_ACTIVE"
        ]

        if not published:
            return None

        # Sort by urgency priority (critical > high > medium > low)
        priority_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        published.sort(key=lambda x: priority_map.get(x.get("urgency", "low"), 1), reverse=True)

        for adv in published:
            is_matched = False

            # Check 1: Postal Pin Code match
            if query.pincode and query.pincode.strip() in adv["target_pincodes"]:
                is_matched = True

            # Check 2: Service Area ID match
            elif query.service_area_id and query.service_area_id == adv["service_area_id"]:
                is_matched = True

            # Check 3: GPS Coordinates within geofence radius
            elif query.lat is not None and query.lng is not None:
                center = adv["geofence_center"]
                dist_km = haversine_distance_km(query.lat, query.lng, center["lat"], center["lng"])
                if dist_km <= adv["geofence_radius_km"]:
                    is_matched = True

            if is_matched:
                return {
                    "advisory_id": adv["advisory_id"],
                    "title": adv["title"],
                    "banner_text": adv["active_portal_banner_text"],
                    "service_area_name": adv["service_area_name"],
                    "police_station_circle": adv["police_station_circle"],
                    "urgency": adv["urgency"],
                    "action_checklist": adv["action_checklist"],
                    "complaints_aggregated": adv["complaints_aggregated"],
                    "published_at": adv["published_at"],
                    "boundary_restricted": True,
                    "matched_pincodes": adv["target_pincodes"],
                }

        # If user is outside all affected geofences, strictly return None
        return None


def list_clusters() -> List[RegionalThreatCluster]:
    with _lock:
        return [RegionalThreatCluster(**copy.deepcopy(c)) for c in _clusters.values()]


def get_cluster(cluster_id: str) -> Optional[RegionalThreatCluster]:
    with _lock:
        data = _clusters.get(cluster_id)
        if not data:
            return None
        return RegionalThreatCluster(**copy.deepcopy(data))


def list_micro_advisories(status: Optional[str] = None) -> List[RegionalMicroAdvisory]:
    with _lock:
        results = []
        for adv in _advisories.values():
            if status and adv.get("status") != status:
                continue
            results.append(RegionalMicroAdvisory(**copy.deepcopy(adv)))
        results.sort(key=lambda x: x.drafted_at, reverse=True)
        return results


def get_micro_advisory(advisory_id: str) -> Optional[RegionalMicroAdvisory]:
    with _lock:
        data = _advisories.get(advisory_id)
        if not data:
            return None
        return RegionalMicroAdvisory(**copy.deepcopy(data))


def get_mesh_stats() -> RegionalThreatMeshStats:
    with _lock:
        total_clusters = len(_clusters)
        drafted = sum(1 for a in _advisories.values() if a.get("status") == "DRAFTED_PENDING_APPROVAL")
        published = sum(1 for a in _advisories.values() if a.get("status") == "PUBLISHED_ACTIVE")

        all_pincodes = set()
        for sa in SERVICE_AREAS_REGISTRY.values():
            all_pincodes.update(sa["postal_pincodes"])

        return RegionalThreatMeshStats(
            total_active_clusters=total_clusters,
            drafted_pending_signoff=drafted,
            published_active_advisories=published,
            covered_pincodes_count=len(all_pincodes),
            total_reports_aggregated=len(_citizen_reports_pool),
        )


def reset_store() -> None:
    with _lock:
        _clusters.clear()
        _advisories.clear()
        _citizen_reports_pool.clear()


def seed_default_mesh_state() -> None:
    """Pre-seeds verified citizen complaints and clusters matching the task requirements."""
    with _lock:
        if _clusters or _advisories:
            return

        now = _now_ms()
        hour = 3600 * 1000

        # Cluster 1: North Delhi (Civil Lines) - Fake Electricity Bill SMS (5 complaints in past 16 hrs)
        # Expected: Drafted alert "Notice: Fake electricity bill payment SMS active in North Delhi area."
        for i in range(5):
            ingest_verified_citizen_report(
                pincode="110007" if i % 2 == 0 else "110009",
                scam_category="electricity_bill_scam",
                service_area_id="SA-NORTH-01",
                raw_timestamp=now - ((i * 3 + 1) * hour),
            )

        # Cluster 2: South Delhi (Saket) - Digital Arrest Extortion (4 complaints in past 18 hrs)
        # Pre-approved by commander to test published banner
        for i in range(4):
            ingest_verified_citizen_report(
                pincode="110017",
                scam_category="digital_arrest",
                service_area_id="SA-SOUTH-01",
                raw_timestamp=now - ((i * 4 + 2) * hour),
            )

        adv_south_key = "ADV-MESH-SA-SOUTH-01-digital_arrest"
        if adv_south_key in _advisories:
            _advisories[adv_south_key]["status"] = "PUBLISHED_ACTIVE"
            _advisories[adv_south_key]["approved_by_commander_badge"] = "CMD-DELHI-SOUTH"
            _advisories[adv_south_key]["approved_by_commander_name"] = "DCP Anita Mehra"
            _advisories[adv_south_key]["published_at"] = now - (2 * hour)

        # Cluster 3: Central Delhi - Courier Customs Fraud (3 complaints in past 12 hrs)
        for i in range(3):
            ingest_verified_citizen_report(
                pincode="110001",
                scam_category="courier_customs_fraud",
                service_area_id="SA-CENTRAL-01",
                raw_timestamp=now - ((i * 3 + 1) * hour),
            )


# Initialize default state on module load
seed_default_mesh_state()
