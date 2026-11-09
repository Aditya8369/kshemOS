"""
Unit and integration tests for WhatsApp & Telegram Syndicate Group Parser and APK Triage.
"""

import base64
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException
from app.models import ApkAnalyzeRequest, SyndicateChatParseRequest
from app.routers import syndicate_triage as router_endpoints
from app.services import fraud_graph
from app.services import syndicate_triage


@pytest.fixture(autouse=True)
def reset_service():
    syndicate_triage.reset_syndicate_registry()
    yield


def test_parse_whatsapp_syndicate_chat():
    sample_text = (
        "[12/04/24, 10:15:10] ~Group Admin (+855 88 412 9019): Welcome new task team members! Daily profit 5000 INR.\n"
        "[12/04/24, 10:16:00] Recruiter Pooja: Deposit USDT recharge bonus to TRON TRC-20 wallet: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k\n"
        "[12/04/24, 10:17:15] For instant UPI transfer use merchant ID: instant.mule99@ybl\n"
        "[12/04/24, 10:18:20] Download our VIP task dispatch app: https://cdn-taskupdate.top/downloads/e-Challan_Parivahan_v3.apk\n"
        "[12/04/24, 10:20:00] Group invite link: https://chat.whatsapp.com/GzK491lKz938fLqM018zXy"
    )

    result = syndicate_triage.parse_syndicate_chat(
        raw_text=sample_text,
        incident_id="INC-TEST-001",
        source_platform="whatsapp",
    )

    assert result["artifact_id"].startswith("ART-CHAT-")
    assert result["incident_id"] == "INC-TEST-001"
    assert result["source_platform"] == "whatsapp"

    # Verify extracted invite link
    assert len(result["invite_links"]) == 1
    assert result["invite_links"][0]["platform"] == "WhatsApp"
    assert result["invite_links"][0]["code"] == "GzK491lKz938fLqM018zXy"

    # Verify extracted phone numbers
    assert len(result["phone_numbers"]) >= 1
    admin_num = next((p for p in result["phone_numbers"] if "+855" in p["number"]), None)
    assert admin_num is not None
    assert admin_num["country"] == "Cambodia"
    assert admin_num["is_syndicate_intl"] is True
    assert admin_num["role"] == "admin"

    # Verify crypto wallet
    assert len(result["crypto_wallets"]) == 1
    assert result["crypto_wallets"][0]["address"] == "TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k"
    assert result["crypto_wallets"][0]["network"] == "TRON"
    assert result["crypto_wallets"][0]["standard"] == "TRC-20"

    # Verify UPI ID
    assert "instant.mule99@ybl" in result["upi_ids"]

    # Verify APK URL
    assert len(result["apk_urls"]) == 1
    assert "e-Challan_Parivahan_v3.apk" in result["apk_urls"][0]

    # Verify threat assessment
    assert result["threat_band"] in ("HIGH", "CRITICAL")
    assert result["risk_score"] >= 0.70
    assert result["cluster_id"] is not None


def test_parse_telegram_syndicate_chat():
    telegram_text = (
        "Forwarded from Telegram VIP Task Force\n"
        "Manager (+95 97 812 0491): High yield crypto task and YouTube rating commission!\n"
        "Official Channel: https://t.me/CyberTaskSyndicateVIP\n"
        "EVM Settlement: 0x71C8360537ab1e504F0b6771F49b94CE80f07eab\n"
        "Support email: support@gmail.com (should not be indexed as UPI)\n"
        "Valid UPI VPA: nodal.recovery@oksbi\n"
    )

    result = syndicate_triage.parse_syndicate_chat(
        raw_text=telegram_text,
        incident_id="INC-TEST-002",
        source_platform="auto",
    )

    assert result["source_platform"] == "telegram"
    assert any(inv["platform"] == "Telegram" for inv in result["invite_links"])
    assert any(w["network"] == "ETH" for w in result["crypto_wallets"])
    assert "nodal.recovery@oksbi" in result["upi_ids"]
    assert "support@gmail.com" not in result["upi_ids"]

    # Myanmar recruiter
    myanmar_num = next((p for p in result["phone_numbers"] if "+95" in p["number"]), None)
    assert myanmar_num is not None
    assert myanmar_num["country"] == "Myanmar"
    assert myanmar_num["is_syndicate_intl"] is True


def test_empty_chat_text_raises_validation_error():
    with pytest.raises(ValueError, match="Chat text cannot be empty"):
        syndicate_triage.parse_syndicate_chat("   ")


def test_static_apk_analysis_and_quarantine():
    mock_manifest = (
        "android.permission.BIND_ACCESSIBILITY_SERVICE\n"
        "android.permission.RECEIVE_SMS\n"
        "android.permission.SYSTEM_ALERT_WINDOW\n"
        "android.permission.REQUEST_INSTALL_PACKAGES\n"
        "com.syndicate.malware.AccessibilityService\n"
        "com.syndicate.malware.SmsBroadcastReceiver\n"
        "https://api.telegram.org/bot7182910482:AAFq-91x0Lzq981kLz018vM\n"
        "194.38.20.12:4444\n"
    )

    result = syndicate_triage.analyze_and_quarantine_apk(
        filename="Police_Verification_Notice.apk",
        raw_bytes=mock_manifest.encode("utf-8"),
        incident_id="INC-TEST-APK-001",
    )

    assert result["artifact_id"].startswith("ART-APK-")
    assert result["filename"] == "Police_Verification_Notice.apk"
    assert len(result["sha256"]) == 64
    assert len(result["sha1"]) == 40
    assert len(result["md5"]) == 32
    assert result["is_quarantined"] is True
    assert os.path.exists(result["quarantine_path"])

    # Verify dangerous permissions flagged
    perms = [p["permission"] for p in result["dangerous_permissions"]]
    assert "android.permission.BIND_ACCESSIBILITY_SERVICE" in perms
    assert "android.permission.RECEIVE_SMS" in perms
    assert "android.permission.SYSTEM_ALERT_WINDOW" in perms

    # Verify C2 endpoints detected
    c2_targets = [c["target"] for c in result["c2_endpoints"]]
    assert any("Telegram Bot C2" in t for t in c2_targets)
    assert any("194.38.20.12:4444" in t for t in c2_targets)

    # Verify malware family classification
    assert "Accessibility Overlay" in result["malware_family"]
    assert result["threat_level"] == "CRITICAL"
    assert result["overall_risk_score"] >= 0.90


def test_cross_report_correlation_and_fraud_graph_linkage():
    # Report A: Citizen 1 submits recruitment WhatsApp chat
    chat_a = (
        "Recruiter (+855 88 123 4567): Join daily salary VIP group: https://chat.whatsapp.com/AlphaBravoCharlie123456\n"
        "Deposit USDT to TRON: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k\n"
    )
    res_a = syndicate_triage.parse_syndicate_chat(chat_a, incident_id="INC-CITIZEN-001")

    # Report B: Citizen 2 submits chat from another platform sharing the SAME TRON wallet
    chat_b = (
        "Telegram admin (+91 98765 43210): Task refund pending!\n"
        "Send verification fee to TRON wallet: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k\n"
    )
    res_b = syndicate_triage.parse_syndicate_chat(chat_b, incident_id="INC-CITIZEN-002")

    # Both reports must be correlated under the same cluster
    correlations = syndicate_triage.get_syndicate_correlations()
    linked_incidents = [x["incident_id"] for x in correlations["cross_linked_incidents"]]
    assert "INC-CITIZEN-001" in linked_incidents
    assert "INC-CITIZEN-002" in linked_incidents

    # Check Fraud Graph nodes & edges
    graph = fraud_graph.get_graph()
    assert "INCIDENT:INC-CITIZEN-001" in graph
    assert "INCIDENT:INC-CITIZEN-002" in graph
    assert "CRYPTO:TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k" in graph

    # Verify cross-incident edge created
    assert graph.has_edge("INCIDENT:INC-CITIZEN-001", "INCIDENT:INC-CITIZEN-002")
    edge_data = graph.edges["INCIDENT:INC-CITIZEN-001", "INCIDENT:INC-CITIZEN-002"]
    assert edge_data["relationship_type"] == "LINKED_SYNDICATE_INFRASTRUCTURE"
    assert edge_data["confidence"] >= 0.95


def test_api_parse_chat_endpoint():
    req = SyndicateChatParseRequest(
        raw_text="Join Telegram: https://t.me/SyndicateTest88 Admin: +855 99 111 222",
        incident_id="INC-API-001",
        source_platform="telegram",
    )
    data = router_endpoints.parse_chat_endpoint(req)
    assert data["incident_id"] == "INC-API-001"
    assert len(data["invite_links"]) == 1
    assert data["invite_links"][0]["code"] == "SyndicateTest88"


def test_api_analyze_apk_endpoint():
    req = ApkAnalyzeRequest(
        filename="e-Challan_Dropper.apk",
        file_bytes_base64=base64.b64encode(b"android.permission.RECEIVE_SMS\n185.220.101.45:8080").decode("utf-8"),
        incident_id="INC-API-002",
    )
    data = router_endpoints.analyze_apk_endpoint(req)
    assert data["filename"] == "e-Challan_Dropper.apk"
    assert data["is_quarantined"] is True
    assert any(p["permission"] == "android.permission.RECEIVE_SMS" for p in data["dangerous_permissions"])


def test_api_correlations_and_stats_endpoints():
    stats = router_endpoints.get_stats_endpoint()
    assert stats["total_chats_parsed"] >= 1
    assert stats["total_apks_quarantined"] >= 1

    corrs = router_endpoints.get_correlations_endpoint()
    assert "clusters" in corrs
    assert "cross_linked_incidents" in corrs


def test_api_artifact_retrieval_and_404():
    chats = router_endpoints.list_chats_endpoint()
    assert len(chats) >= 1

    first_art_id = chats[0]["artifact_id"]
    item = router_endpoints.get_artifact_endpoint(first_art_id)
    assert item["artifact_id"] == first_art_id

    with pytest.raises(HTTPException) as exc_info:
        router_endpoints.get_artifact_endpoint("ART-NON-EXISTENT")
    assert exc_info.value.status_code == 404
