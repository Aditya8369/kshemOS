"""
Unit tests for Automated Inbound Telegram/WhatsApp Webhook & Static APK Unpacker.

Validates:
1. Webhook HMAC-SHA256 authentication (Meta WhatsApp, Telegram secret token, Twilio).
2. Automated Entity Harvesting (Telegram handles, WhatsApp links, TRON/ETH wallets, Indian IFSC codes).
3. Automated Static APK Unpacker extracting AndroidManifest.xml permissions (BIND_ACCESSIBILITY_SERVICE, RECEIVE_SMS).
4. Live Incident Feed auto-creation with _syncStatus: 'synced' and category 'Syndicate Recruitment Scam'.
"""
import io
import json
import zipfile
import pytest

from app.services import syndicate_triage
from app.services.incidents import _incidents


@pytest.fixture(autouse=True)
def clean_syndicate():
    """Reset registry before and after tests."""
    syndicate_triage.reset_syndicate_registry()
    yield
    syndicate_triage.reset_syndicate_registry()


def test_extract_syndicate_entities_comprehensive():
    """Verifies automated entity harvesting from unstructured chat text."""
    sample_text = (
        "Welcome to VIP task team! Recruiter: @task_vip_admin. "
        "Official Channel: https://t.me/joinchat/CyberTaskIndiaVIP88 "
        "WhatsApp Coordinator: https://wa.me/855884129019 and group https://chat.whatsapp.com/GzK491lKz938fLqM018zXy "
        "Send USDT deposit to TRON TRC-20: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k "
        "EVM clearing wallet: 0x71C8364f3B39C13E7D52B980c5e62f026E7bB102 "
        "Bank NEFT Details: IFSC SBIN0001234 A/C: 98765432101 "
        "UPI handle: safe.fast@ybl"
    )

    entities = syndicate_triage.extract_syndicate_entities(sample_text)

    # 1. Telegram Handles
    assert "@task_vip_admin" in entities["telegram_handles"]

    # 2. Telegram Links
    assert any("CyberTaskIndiaVIP88" in l for l in entities["telegram_links"])

    # 3. WhatsApp Links
    assert any("855884129019" in l for l in entities["whatsapp_links"])
    assert any("GzK491lKz938fLqM018zXy" in l for l in entities["whatsapp_links"])

    # 4. Crypto Wallets
    wallet_addrs = {w["address"] for w in entities["crypto_wallets"]}
    assert "TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k" in wallet_addrs
    assert "0x71C8364f3B39C13E7D52B980c5e62f026E7bB102" in wallet_addrs

    # 5. Indian IFSC Codes & Bank Account
    assert "SBIN0001234" in entities["ifsc_codes"]
    assert "98765432101" in entities["bank_accounts"]

    # 6. UPI VPAs
    assert "safe.fast@ybl" in entities["upi_ids"]


def test_static_apk_unpacker_native_zipfile():
    """
    Tests automated static APK unpacker extracting AndroidManifest.xml permissions
    including BIND_ACCESSIBILITY_SERVICE and RECEIVE_SMS without bytecode execution.
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest_content = (
            b"<manifest package=\"com.syndicate.challan\">\n"
            b"  <uses-permission android:name=\"android.permission.BIND_ACCESSIBILITY_SERVICE\"/>\n"
            b"  <uses-permission android:name=\"android.permission.RECEIVE_SMS\"/>\n"
            b"  <uses-permission android:name=\"android.permission.SYSTEM_ALERT_WINDOW\"/>\n"
            b"</manifest>"
        )
        zf.writestr("AndroidManifest.xml", manifest_content)
        zf.writestr("classes.dex", b"TelegramBotC2: 1234567890:AAHq_mock_bot_token_99")

    apk_bytes = zip_buffer.getvalue()

    result = syndicate_triage.analyze_and_quarantine_apk(
        filename="malicious_challan.apk",
        raw_bytes=apk_bytes,
        officer_badge="GATEWAY-TEST",
    )

    flagged_perms = {p["permission"] for p in result["dangerous_permissions"]}
    assert "android.permission.BIND_ACCESSIBILITY_SERVICE" in flagged_perms
    assert "android.permission.RECEIVE_SMS" in flagged_perms
    assert result["threat_level"] in ("CRITICAL", "HIGH")
    assert result["is_quarantined"] is True


def test_webhook_hmac_token_verification():
    """Verifies HMAC validation logic against standard messaging gateway headers."""
    secret = "test_webhook_secret_key_123"
    body = b'{"platform": "telegram", "message_text": "hello"}'

    # Valid HMAC
    valid_hmac = syndicate_triage.generate_webhook_hmac(body, secret)
    headers_meta = {"x-hub-signature-256": f"sha256={valid_hmac}"}
    assert syndicate_triage.verify_webhook_hmac(body, headers_meta, secret) is True

    # Valid Telegram Secret Token
    headers_tg = {"x-telegram-bot-api-secret-token": secret}
    assert syndicate_triage.verify_webhook_hmac(body, headers_tg, secret) is True

    # Tampered HMAC
    headers_tampered = {"x-hub-signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000"}
    assert syndicate_triage.verify_webhook_hmac(body, headers_tampered, secret) is False


def test_process_inbound_webhook_auto_creates_synced_incident():
    """
    Tests that inbound webhook automatically extracts entities, unpacks APKs,
    calculates risk severity, and creates a synced incident in the Officer Feed.
    """
    payload = {
        "platform": "telegram",
        "sender_id": "vip_recruiter_bot",
        "message_text": (
            "Prepaid YouTube review task! Contact @task_lead_99. "
            "TRON USDT: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k "
            "IFSC: HDFC0000456 A/C: 50100239102941 "
            "Install dispatch APK: https://cdn.malicious.top/app.apk"
        ),
        "region": "Central Zone",
    }
    raw_body = json.dumps(payload).encode("utf-8")
    secret = syndicate_triage.DEFAULT_WEBHOOK_SECRET
    hmac_val = syndicate_triage.generate_webhook_hmac(raw_body, secret)
    headers = {"x-hub-signature-256": f"sha256={hmac_val}"}

    result = syndicate_triage.process_inbound_webhook(payload, raw_body=raw_body, headers=headers)

    assert result["status"] == "processed"
    assert result["platform"] == "telegram"
    assert result["incident_id"].startswith("INC-")
    assert result["category"] == "Syndicate Recruitment Scam"
    assert result["_syncStatus"] == "synced"
    assert result["severity"] in ("critical", "high")

    # Verify incident exists in system store
    inc_record = _incidents.get(result["incident_id"])
    assert inc_record is not None
    assert inc_record["category"] == "Syndicate Recruitment Scam"

    # Verify entities harvested
    assert "@task_lead_99" in result["harvested_entities"]["telegram_handles"]
    assert "HDFC0000456" in result["harvested_entities"]["ifsc_codes"]
