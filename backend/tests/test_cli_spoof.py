"""
Unit and integration tests for SIM Box & Spoofed Calling Line Identification (CLI) Detection Engine.
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException

from app.models import TelephonyRouteVerificationRequest
from app.routers import cli_spoof as router_endpoints
from app.services import cli_spoof_detection


@pytest.fixture(autouse=True)
def reset_service():
    cli_spoof_detection.reset_service_state()
    yield


def test_flag_international_call_masquerading_as_mumbai_police():
    req = TelephonyRouteVerificationRequest(
        call_id="CALL-TEST-01",
        claimed_cli="+91 22 2262 0111",
        claimed_entity="Mumbai Police Cyber Branch",
        call_channel="sip_trunk",
        sip_headers={
            "From": '"Mumbai Police HQ" <sip:+912222620111@185.220.101.45>',
            "Contact": "<sip:line1@185.220.101.45:5060>",
            "User-Agent": "Asterisk PBX 18.9 (Poipet-Cambodia)",
            "P-Asserted-Identity": "<tel:+855884129019>",
        },
        carrier_ingress_ip="185.220.101.45",
        audio_latency_ms=340.0,
        packet_jitter_ms=62.0,
        packet_loss_pct=4.0,
        recipient_circle="MH",
    )

    result = cli_spoof_detection.verify_telephony_route(req)

    assert result["verification_id"].startswith("CLI-VERIF-")
    assert result["claimed_cli"] == "+91 22 2262 0111"
    assert result["normalized_cli"] == "912222620111"
    assert result["is_spoofed"] is True
    assert result["threat_tier"] == "CRITICAL"
    assert result["spoof_confidence"] >= 0.85
    assert result["carrier_legitimacy_score"] <= 35.0

    # Verify Anomaly Flags
    flag_types = [f["flag_type"] for f in result["anomaly_flags"]]
    assert "OFFSHORE_VOIP_INGRESS" in flag_types
    assert "SIMBOX_USER_AGENT_SIGNATURE" in flag_types
    assert "HIGH_LATENCY_GREY_ROUTE" in flag_types
    assert "SIP_HEADER_IDENTITY_MISMATCH" in flag_types

    # Verify Mandatory Warning Banner
    expected_banner = "Warning: Official law enforcement agencies never place summons or arrest demands via WhatsApp VoIP or international trunks."
    assert result["warning_banner"] == expected_banner

    # Verify TRAI Circle identification
    assert result["trai_circle_info"]["circle_code"] == "MH"
    assert result["trai_circle_info"]["is_known_government_police_number"] is True
    assert "Mumbai Police" in result["trai_circle_info"]["verified_department"]

    # Verify Forwarded to Officer Telecom Triage
    assert result["forwarded_to_telecom_triage"] is True
    assert result["ingress_point_id"] is not None


def test_detect_simbox_gateway_and_cbi_spoofing():
    req = TelephonyRouteVerificationRequest(
        call_id="CALL-TEST-02",
        claimed_cli="+91 11 2436 8800",
        claimed_entity="Central Bureau of Investigation (CBI)",
        call_channel="sip_trunk",
        sip_headers={
            "From": '"CBI New Delhi" <sip:01124368800@103.241.88.14>',
            "User-Agent": "Dinstar-SIMBOX/v3.2 (32-Port Array)",
        },
        carrier_ingress_ip="103.241.88.14",
        audio_latency_ms=190.0,
        packet_jitter_ms=55.0,
        recipient_circle="DL",
    )

    result = cli_spoof_detection.verify_telephony_route(req)

    assert result["is_spoofed"] is True
    assert result["threat_tier"] == "CRITICAL"
    assert result["route_telemetry"]["is_simbox_gateway"] is True
    assert "Dinstar" in result["route_telemetry"]["gateway_model"]

    # Check TRAI STD Circle
    assert result["trai_circle_info"]["circle_code"] == "DL"
    assert result["trai_circle_info"]["is_known_government_police_number"] is True
    assert "CBI" in result["trai_circle_info"]["verified_department"]


def test_whatsapp_voip_call_claiming_law_enforcement():
    req = TelephonyRouteVerificationRequest(
        call_id="CALL-TEST-03",
        claimed_cli="+91 98200 12345",
        claimed_entity="Delhi Police Crime Branch Officer",
        call_channel="whatsapp_voip",
        audio_latency_ms=290.0,
    )

    result = cli_spoof_detection.verify_telephony_route(req)

    assert result["is_spoofed"] is True
    assert result["threat_tier"] == "CRITICAL"

    flag_types = [f["flag_type"] for f in result["anomaly_flags"]]
    assert "UNOFFICIAL_VOIP_PROTOCOL" in flag_types

    # Mandatory warning banner present
    assert "Warning: Official law enforcement agencies never place summons" in result["warning_banner"]


def test_verified_legitimate_domestic_call():
    req = TelephonyRouteVerificationRequest(
        call_id="CALL-TEST-04",
        claimed_cli="01123412345",
        claimed_entity="Delhi Metro Support Center",
        call_channel="pstn_gsm",
        carrier_ingress_ip="103.24.12.5",
        audio_latency_ms=25.0,
        packet_jitter_ms=6.0,
        packet_loss_pct=0.1,
        recipient_circle="DL",
    )

    result = cli_spoof_detection.verify_telephony_route(req)

    assert result["is_spoofed"] is False
    assert result["threat_tier"] == "VERIFIED_LEGITIMATE"
    assert result["carrier_legitimacy_score"] >= 90.0
    assert result["forwarded_to_telecom_triage"] is False
    assert len(result["anomaly_flags"]) == 0


def test_telecom_triage_feed_and_action_update():
    # Verify pre-seeded demo incidents in feed
    feed = cli_spoof_detection.get_telecom_triage_feed()
    assert len(feed) >= 1

    first_incident = feed[0]
    triage_id = first_incident["triage_id"]
    assert first_incident["status"] == "DISPATCHED_TO_TELCO"

    # Officer performs operational blocking action
    updated = cli_spoof_detection.update_triage_incident_status(triage_id, "BLOCKED_AT_GATEWAY")
    assert updated is not None
    assert updated["status"] == "BLOCKED_AT_GATEWAY"

    # Non-existent incident returns None
    assert cli_spoof_detection.update_triage_incident_status("TELCO-NONEXISTENT", "RESOLVED") is None


def test_telecom_triage_summary():
    summary = cli_spoof_detection.get_telecom_triage_summary()
    assert summary["total_calls_inspected"] >= 4
    assert summary["spoofed_calls_intercepted"] >= 3
    assert summary["simbox_gateways_isolated"] >= 1
    assert len(summary["high_risk_ingress_ips"]) >= 1


def test_trai_reference_directory():
    dir_info = cli_spoof_detection.get_trai_reference_directory()
    assert "011" in dir_info["circles"]
    assert "022" in dir_info["circles"]
    assert "912222620111" in dir_info["official_police_directories"]


def test_fastapi_router_endpoints():
    # 1. POST /api/cli-spoof/verify
    req = TelephonyRouteVerificationRequest(
        call_id="CALL-API-01",
        claimed_cli="+91 22 2262 0111",
        claimed_entity="Mumbai Police",
        call_channel="whatsapp_voip",
    )
    res = router_endpoints.verify_cli_route_endpoint(req)
    assert res["is_spoofed"] is True
    assert res["threat_tier"] == "CRITICAL"

    # 2. GET /api/cli-spoof/telecom-triage
    feed = router_endpoints.get_telecom_triage_feed_endpoint()
    assert len(feed) >= 1

    # 3. POST /api/cli-spoof/telecom-triage/{triage_id}/action
    tid = feed[0]["triage_id"]
    action_res = router_endpoints.update_triage_incident_action_endpoint(
        triage_id=tid,
        action="RESOLVED",
    )
    assert action_res["status"] == "success"
    assert action_res["incident"]["status"] == "RESOLVED"

    # 404 check
    with pytest.raises(HTTPException) as exc:
        router_endpoints.update_triage_incident_action_endpoint(
            triage_id="NON-EXISTENT-ID",
            action="RESOLVED",
        )
    assert exc.value.status_code == 404

    # 4. GET /api/cli-spoof/summary
    summary = router_endpoints.get_telecom_triage_summary_endpoint()
    assert summary["total_calls_inspected"] >= 1

    # 5. GET /api/cli-spoof/trai-directory
    trai_dir = router_endpoints.get_trai_directory_endpoint()
    assert "circles" in trai_dir

