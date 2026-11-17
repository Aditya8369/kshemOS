from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.routers import official_contacts as contacts_router


client = TestClient(app)


def make_contact(**overrides):
    contact = {
        "id": "test-contact",
        "jurisdiction": "India",
        "incident_category": "cyber_financial_fraud",
        "display_name": "Test Official Contact",
        "contact_type": "phone",
        "contact_value": "1930",
        "official_source_url": "https://cybercrime.gov.in/",
        "last_verified_at": "2026-11-10",
        "verification_status": "verified",
    }
    contact.update(overrides)
    return contact


def test_get_all_official_contacts():
    response = client.get("/api/official-contacts")

    assert response.status_code == 200

    data = response.json()
    assert data["count"] == len(data["contacts"])
    assert data["count"] >= 1

    for contact in data["contacts"]:
        assert contact["verification_status"] == "verified"
        assert contact["official_source_url"].startswith("https://")


def test_emergency_contact_112_exists_only_in_emergency_category():
    response = client.get("/api/official-contacts")

    assert response.status_code == 200

    contacts = response.json()["contacts"]
    emergency_contacts = [
        contact for contact in contacts
        if contact["contact_value"] == "112"
    ]

    assert len(emergency_contacts) == 1
    assert emergency_contacts[0]["incident_category"] == "immediate_emergency"

    cyber_response = client.get(
        "/api/official-contacts",
        params={"category": "cyber_financial_fraud"},
    )

    assert all(
        contact["contact_value"] != "112"
        for contact in cyber_response.json()["contacts"]
    )


def test_cyber_financial_fraud_filter():
    response = client.get(
        "/api/official-contacts",
        params={"category": "cyber_financial_fraud"},
    )

    assert response.status_code == 200

    for contact in response.json()["contacts"]:
        assert contact["incident_category"] == "cyber_financial_fraud"


def test_unknown_category_returns_empty_list():
    response = client.get(
        "/api/official-contacts",
        params={"category": "unknown_category"},
    )

    assert response.status_code == 200
    assert response.json()["contacts"] == []
    assert response.json()["count"] == 0


def test_unverified_contacts_are_rejected():
    contact = make_contact(verification_status="unverified")

    valid, reason = contacts_router.validate_contact(
        contact, today=date(2026, 11, 14)
    )

    assert not valid
    assert reason == "not_verified"


def test_stale_contacts_are_rejected():
    contact = make_contact(last_verified_at="2026-01-01")

    valid, reason = contacts_router.validate_contact(
        contact, today=date(2026, 11, 14)
    )

    assert not valid
    assert reason == "stale_verification"


def test_missing_official_source_is_rejected():
    contact = make_contact(official_source_url="")

    valid, reason = contacts_router.validate_contact(
        contact, today=date(2026, 11, 14)
    )

    assert not valid
    assert reason == "missing_required_metadata"


def test_non_https_source_is_rejected():
    contact = make_contact(
        official_source_url="http://example.com"
    )

    valid, reason = contacts_router.validate_contact(
        contact, today=date(2026, 11, 14)
    )

    assert not valid
    assert reason == "invalid_official_source"


def test_future_verification_date_is_rejected():
    contact = make_contact(last_verified_at="2027-01-01")

    valid, reason = contacts_router.validate_contact(
        contact, today=date(2026, 11, 14)
    )

    assert not valid
    assert reason == "future_verification_date"


def test_112_cannot_be_used_for_cybercrime():
    contact = make_contact(
        contact_value="112",
        incident_category="cyber_financial_fraud",
    )

    valid, reason = contacts_router.validate_contact(
        contact, today=date(2026, 11, 14)
    )

    assert not valid
    assert reason == "112_category_restriction"


def test_public_api_hides_invalid_contacts(monkeypatch):
    contacts = [
        make_contact(id="valid"),
        make_contact(
            id="unverified",
            verification_status="unverified",
        ),
        make_contact(
            id="stale",
            last_verified_at="2026-01-01",
        ),
    ]

    monkeypatch.setattr(
        contacts_router,
        "OFFICIAL_CONTACTS",
        contacts,
    )

    response = client.get("/api/official-contacts")

    assert response.status_code == 200
    assert [c["id"] for c in response.json()["contacts"]] == ["valid"]


def test_suspicious_caller_number_does_not_change_directory():
    before = client.get("/api/official-contacts").json()

    response = client.post(
        "/api/official-contacts",
        json={"contact_value": "9999999999"},
    )

    after = client.get("/api/official-contacts").json()

    assert response.status_code == 405
    assert before == after