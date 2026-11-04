"""
Unit test suite for Geo-Targeted Multi-Channel Emergency Broadcast.
Tests:
- Reverse-Geocode Audience Targeting (service areas vs custom perimeter).
- Multi-Channel Dispatch Adapters (SMS limit, WhatsApp template, Push notification, Portal Banner).
- Commander Approval Guardrail & Dual-Authorization Enforcement.
- Delivery & Acknowledgment Telemetry calculation.
- Live Emergency Portal Banner retrieval.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models import (
    AdvisoryCreate,
    AuthorizeBroadcastRequest,
    EstimateAudienceRequest,
    ChannelConfig,
    PerimeterTargeting,
)
from app.services.emergency_broadcast import (
    EmergencyBroadcastEngine,
    SERVICE_AREAS_REGISTRY,
)


def test_audience_reverse_geocoding():
    """Verifies service area and custom perimeter reverse-geocode audience estimation."""
    engine = EmergencyBroadcastEngine()

    # 1. Test Service Area targeting (Central Zone)
    req_sa = EstimateAudienceRequest(
        targeting_type="service_area",
        service_area_id="SA-CENTRAL-01"
    )
    res_sa = engine.estimate_audience(req_sa)

    assert res_sa.service_area_id == "SA-CENTRAL-01"
    assert res_sa.region == "Central Zone"
    assert res_sa.estimated_citizens == 14500
    assert res_sa.senior_centers_count == 6
    assert len(res_sa.senior_centers) == 6
    assert res_sa.merchant_nodes_count == 195
    assert res_sa.bank_branches_count == 48
    assert "110001" in res_sa.postal_pincodes
    assert "Barakhamba Elder Haven" in [s.name for s in res_sa.senior_centers]

    # 2. Test South Zone
    req_south = EstimateAudienceRequest(
        targeting_type="service_area",
        service_area_id="SA-SOUTH-01"
    )
    res_south = engine.estimate_audience(req_south)
    assert res_south.estimated_citizens == 22000
    assert res_south.senior_centers_count == 8

    # 3. Test Custom Perimeter
    req_custom = EstimateAudienceRequest(
        targeting_type="custom_perimeter",
        center_lat=28.6315,
        center_lng=77.2167,
        radius_km=3.5,
    )
    res_custom = engine.estimate_audience(req_custom)
    assert res_custom.targeting_type == "custom_perimeter"
    assert res_custom.radius_km == 3.5
    assert res_custom.estimated_citizens > 2000
    assert res_custom.senior_centers_count >= 2
    assert res_custom.merchant_nodes_count >= 15
    print("test_audience_reverse_geocoding PASSED")


def test_multi_channel_dispatch_adapters():
    """Verifies that alert adapters correctly format SMS, WhatsApp, Push & Portal Banner payloads."""
    engine = EmergencyBroadcastEngine()

    title = "Extortion Scam: Fake Law Enforcement Calls"
    desc = "Scammers claiming to be CBI officers are demanding immediate fund transfer over video call. Police never ask for money."
    ref_id = "ADV-TEST"

    # SMS Adapter
    sms = engine.adapt_sms_payload(title, desc, ref_id)
    assert len(sms) <= 160, f"SMS exceeded 160 characters: {len(sms)}"
    assert "[KSHEM-POLICE" in sms
    assert "1930" in sms

    # WhatsApp Adapter
    wa = engine.adapt_whatsapp_payload(title, desc, ref_id, "Central Zone")
    assert wa["template"] == "emergency_public_safety_siren_v2"
    assert "🚨 LAW ENFORCEMENT" in wa["header"]
    assert len(wa["buttons"]) == 2
    assert wa["buttons"][0]["type"] == "url"

    # Push Notification Adapter
    push = engine.adapt_push_payload(title, desc, "critical", ref_id)
    assert "EMERGENCY SIREN" in push["title"]
    assert push["sound"] == "emergency_siren.wav"
    assert push["priority"] == "high"
    assert push["data"]["advisory_id"] == ref_id

    # Portal Header Banner Adapter
    banner = engine.adapt_portal_banner_payload(title, desc, "critical", ref_id, "Central Zone")
    assert banner["active"] is True
    assert "⚠️ CRITICAL ADVISORY" in banner["marquee_text"]
    assert banner["advisory_id"] == ref_id
    print("test_multi_channel_dispatch_adapters PASSED")


def test_dual_authorization_guardrail_enforcement():
    """Verifies that high-impact / critical sirens strictly require 2 distinct commanding officer authorizations."""
    engine = EmergencyBroadcastEngine()

    # Create critical advisory
    targeting = engine.estimate_audience(EstimateAudienceRequest(targeting_type="service_area", service_area_id="SA-CENTRAL-01"))
    adv_payload = AdvisoryCreate(
        title="CRITICAL: Fake Supreme Court Digital Arrest Warrants",
        description="Criminals issuing forged legal notices and demanding money.",
        severity="critical",
        affected_location="Central Zone",
        target_audience="citizens",
        targeting=targeting,
        created_by_badge="BADGE-CMD-701",
        created_by_name="Commander Rajesh Varma",
    )
    adv = engine.create_broadcast(adv_payload)
    advisory_id = adv.id

    assert adv.dual_auth.requires_dual_auth is True
    assert adv.dual_auth.is_fully_authorized is False
    assert adv.dual_auth.authorizer_1_badge == "BADGE-CMD-701"
    assert adv.dual_auth.authorizer_2_badge is None

    # Attempting to dispatch before 2nd authorization MUST fail
    try:
        engine.dispatch_broadcast(advisory_id)
        assert False, "Dispatch should have failed without 2nd dual-authorization!"
    except PermissionError as e:
        assert "Commander Guardrail Violation" in str(e)

    # Attempting to have the same officer sign as Authorizer 2 MUST fail
    try:
        engine.authorize_broadcast(
            advisory_id,
            AuthorizeBroadcastRequest(
                authorizer_badge="BADGE-CMD-701",  # Same officer!
                authorizer_name="Commander Rajesh Varma",
                authorizer_role="Initiating Commander",
                decision="approve",
            )
        )
        assert False, "Same officer cannot sign both dual authorizations!"
    except ValueError as e:
        assert "dual-authorization guardrail" in str(e)

    # Legitimate second commanding officer signs off
    auth2_res = engine.authorize_broadcast(
        advisory_id,
        AuthorizeBroadcastRequest(
            authorizer_badge="BADGE-DCP-402",  # Distinct 2nd officer
            authorizer_name="Deputy Commissioner Ananya Sen",
            authorizer_role="Joint Director, Cyber Public Safety",
            decision="approve",
            reviewer_notes="Target perimeter reviewed. Clear for immediate multi-channel siren dispatch.",
        )
    )

    assert auth2_res.dual_auth.authorizer_2_badge == "BADGE-DCP-402"
    assert auth2_res.dual_auth.is_fully_authorized is True
    assert auth2_res.status == "approved"

    # Now dispatch MUST succeed
    dispatched = engine.dispatch_broadcast(advisory_id)
    assert dispatched.status == "published"
    assert dispatched.telemetry.dispatched > 0
    assert dispatched.telemetry.delivered > 0
    assert dispatched.telemetry.delivery_rate_pct >= 95.0
    print("test_dual_authorization_guardrail_enforcement PASSED")


def test_delivery_telemetry_progression():
    """Verifies delivery counters, channel breakdowns, and real-time acknowledgment simulation."""
    engine = EmergencyBroadcastEngine()

    sample_id = "ADV-9104"  # Default seeded broadcast
    telemetry_before = engine.advisories[sample_id]["telemetry"]
    initial_read = telemetry_before["read"]
    initial_reports = telemetry_before["linked_citizen_reports"]

    # Advance telemetry with 200 new acks
    updated = engine.advance_telemetry(sample_id, new_acks=200)

    assert updated.read == initial_read + 200
    assert updated.linked_citizen_reports > initial_reports
    assert updated.read_rate_pct > 0.0
    assert "sms" in updated.channels
    assert "whatsapp" in updated.channels
    assert "push" in updated.channels
    assert "portal_banner" in updated.channels
    print("test_delivery_telemetry_progression PASSED")


def test_active_portal_header_banner():
    """Verifies that the highest priority active published broadcast is returned for the portal banner."""
    engine = EmergencyBroadcastEngine()

    banner = engine.get_active_banner()
    assert banner is not None
    assert banner["active"] is True
    assert "advisory_id" in banner
    assert "marquee_text" in banner
    assert banner["severity"] in ("critical", "high")
    print("test_active_portal_header_banner PASSED")


def run_all_tests():
    test_audience_reverse_geocoding()
    test_multi_channel_dispatch_adapters()
    test_dual_authorization_guardrail_enforcement()
    test_delivery_telemetry_progression()
    test_active_portal_header_banner()
    print("ALL 5 EMERGENCY BROADCAST BACKEND TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_all_tests()
