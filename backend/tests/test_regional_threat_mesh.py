"""
Unit tests for Privacy-Preserving Regional Threat Broadcast & Micro-Advisory Mesh.
Validates:
1. Cluster aggregation threshold (3+ complaints within 24h window).
2. Privacy preservation (zero victim PII exposure; k-anonymized tokens).
3. Automated drafting of human-readable citizen safety alerts ("Notice: Fake electricity bill payment SMS active in North Delhi area.").
4. Commander single-click sign-off workflow.
5. Strict jurisdiction boundary geofencing (withholding advisories outside geofence).
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException

from app.models import (
    CitizenMeshAdvisoryQuery,
    CommanderSignoffRequest,
)
from app.routers import regional_threat_mesh as router_endpoints
from app.services import regional_threat_mesh


@pytest.fixture(autouse=True)
def reset_service():
    regional_threat_mesh.reset_store()
    regional_threat_mesh.seed_default_mesh_state()
    yield


def test_cluster_aggregation_threshold_3_plus_within_24h():
    regional_threat_mesh.reset_store()

    # 1. Ingest 2 complaints in West Delhi - should NOT trigger advisory yet
    r1, adv1 = regional_threat_mesh.ingest_verified_citizen_report(
        pincode="110027",
        scam_category="electricity_bill_scam",
        service_area_id="SA-WEST-01",
    )
    r2, adv2 = regional_threat_mesh.ingest_verified_citizen_report(
        pincode="110015",
        scam_category="electricity_bill_scam",
        service_area_id="SA-WEST-01",
    )
    assert adv1 is None
    assert adv2 is None
    assert len(regional_threat_mesh.list_clusters()) == 0

    # 2. Ingest 3rd complaint within 24h - must trigger cluster and draft advisory
    r3, adv3 = regional_threat_mesh.ingest_verified_citizen_report(
        pincode="110026",
        scam_category="electricity_bill_scam",
        service_area_id="SA-WEST-01",
    )
    assert adv3 is not None
    assert adv3.complaints_aggregated == 3
    assert adv3.window_hours <= 24.0
    assert adv3.status == "DRAFTED_PENDING_APPROVAL"

    # Verify Human-readable title
    assert "Notice: Fake electricity bill payment SMS active in West District area." in adv3.title
    assert "110027" in adv3.target_pincodes
    assert len(adv3.action_checklist) >= 3


def test_privacy_preservation_zero_victim_pii():
    clusters = regional_threat_mesh.list_clusters()
    assert len(clusters) >= 2

    for cluster in clusters:
        # Check that cluster contains no PII
        assert cluster.privacy_guarantee.startswith("K-Anonymity Verified")
        for ref in cluster.anonymized_report_refs:
            assert ref.startswith("ANON-REF-")

    advisories = regional_threat_mesh.list_micro_advisories()
    assert len(advisories) >= 2
    for adv in advisories:
        # Ensure advisory guidance has no citizen names or personal numbers
        assert "Aadhaar" not in adv.summary_guidance
        assert "PAN" not in adv.summary_guidance
        assert "+91" not in adv.summary_guidance


def test_default_seeded_north_delhi_cluster_and_draft():
    adv_north = regional_threat_mesh.get_micro_advisory("ADV-MESH-SA-NORTH-01-electricity_bill_scam")
    assert adv_north is not None
    assert adv_north.status == "DRAFTED_PENDING_APPROVAL"
    assert adv_north.complaints_aggregated >= 3
    assert "Notice: Fake electricity bill payment SMS active in North Delhi area." in adv_north.title
    assert "Civil Lines Cyber Cell Desk" in adv_north.police_station_circle
    assert "110007" in adv_north.target_pincodes


def test_commander_single_click_signoff_workflow():
    advisory_id = "ADV-MESH-SA-NORTH-01-electricity_bill_scam"

    # Initially pending signoff
    adv_before = regional_threat_mesh.get_micro_advisory(advisory_id)
    assert adv_before.status == "DRAFTED_PENDING_APPROVAL"
    assert adv_before.approved_by_commander_badge is None

    # Commander signs off to publish
    signed_adv = regional_threat_mesh.signoff_micro_advisory(
        advisory_id,
        CommanderSignoffRequest(
            commander_badge_id="CMD-DELHI-NORTH",
            commander_name="DCP Vikram Malhotra",
            action="approve_publish",
            notes="Verified with Civil Lines cyber team. Discom alert confirmed.",
        ),
    )

    assert signed_adv is not None
    assert signed_adv.status == "PUBLISHED_ACTIVE"
    assert signed_adv.approved_by_commander_badge == "CMD-DELHI-NORTH"
    assert signed_adv.approved_by_commander_name == "DCP Vikram Malhotra"
    assert signed_adv.published_at is not None


def test_strict_geofence_boundary_withholding():
    # 1. Query for citizen inside South Delhi (pincode 110017) -> matches published digital arrest alert
    query_inside = CitizenMeshAdvisoryQuery(pincode="110017")
    banner_inside = regional_threat_mesh.query_citizen_portal_mesh_banner(query_inside)

    assert banner_inside is not None
    assert "digital arrest" in banner_inside["title"].lower()
    assert "South Financial Corridors" in banner_inside["service_area_name"]
    assert banner_inside["boundary_restricted"] is True

    # 2. Query for citizen with coordinates inside South Delhi geofence
    query_gps = CitizenMeshAdvisoryQuery(lat=28.5244, lng=77.2066)
    banner_gps = regional_threat_mesh.query_citizen_portal_mesh_banner(query_gps)
    assert banner_gps is not None

    # 3. Query for citizen OUTSIDE affected jurisdiction (e.g. Mumbai 400001 or Bengaluru 560001)
    # MUST be strictly withheld to prevent alert fatigue and panic
    query_outside = CitizenMeshAdvisoryQuery(pincode="400001")
    banner_outside = regional_threat_mesh.query_citizen_portal_mesh_banner(query_outside)
    assert banner_outside is None

    query_outside_gps = CitizenMeshAdvisoryQuery(lat=19.0760, lng=72.8777)
    banner_outside_gps = regional_threat_mesh.query_citizen_portal_mesh_banner(query_outside_gps)
    assert banner_outside_gps is None


def test_router_endpoints_and_stats():
    # Test list clusters
    clusters = router_endpoints.list_threat_clusters_endpoint()
    assert len(clusters) >= 2

    # Test get cluster by ID
    first_cluster = clusters[0]
    fetched_cluster = router_endpoints.get_threat_cluster_endpoint(first_cluster.cluster_id)
    assert fetched_cluster.cluster_id == first_cluster.cluster_id

    # Test list advisories
    advisories = router_endpoints.list_micro_advisories_endpoint()
    assert len(advisories) >= 2

    # Test commander signoff endpoint
    signed = router_endpoints.commander_signoff_endpoint(
        "ADV-MESH-SA-NORTH-01-electricity_bill_scam",
        CommanderSignoffRequest(
            commander_badge_id="CMD-DELHI-NORTH",
            commander_name="DCP Vikram Malhotra",
            action="approve_publish",
        ),
    )
    assert signed.status == "PUBLISHED_ACTIVE"

    # Test portal banner endpoint
    banner_res = router_endpoints.query_citizen_portal_mesh_banner_endpoint(
        CitizenMeshAdvisoryQuery(pincode="110007")
    )
    assert banner_res["banner"] is not None
    assert "Notice: Fake electricity bill payment SMS active in North Delhi area." in banner_res["banner"]["title"]

    # Test stats endpoint
    stats = router_endpoints.get_threat_mesh_stats_endpoint()
    assert stats.total_active_clusters >= 2
    assert stats.published_active_advisories >= 2
    assert stats.covered_pincodes_count >= 10

    # Test 404 for nonexistent advisory
    with pytest.raises(HTTPException) as excinfo:
        router_endpoints.get_micro_advisory_endpoint("ADV-NONEXISTENT")
    assert excinfo.value.status_code == 404
