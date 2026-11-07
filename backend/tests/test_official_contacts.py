
from fastapi.testclient import TestClient

from app.main import app
from app.routers import official_contacts as contacts_router


client = TestClient(app)


def test_get_all_official_contacts():
    response = client.get("/api/official-contacts")

    assert response.status_code == 200

    data = response.json()

    assert "contacts" in data
    assert data["count"] == len(data["contacts"])
    assert data["count"] >= 1


def test_emergency_contact_112_exists():
    response = client.get("/api/official-contacts")

    assert response.status_code == 200

    contacts = response.json()["contacts"]

    emergency_contacts = [
        contact for contact in contacts
        if contact["value"] == "112"
    ]

    assert len(emergency_contacts) == 1
    assert emergency_contacts[0]["category"] == "immediate_emergency"


def test_cyber_financial_fraud_filter():
    response = client.get(
        "/api/official-contacts",
        params={"category": "cyber_financial_fraud"},
    )

    assert response.status_code == 200

    contacts = response.json()["contacts"]

    assert len(contacts) >= 1

    for contact in contacts:
        assert contact["category"] == "cyber_financial_fraud"


def test_unknown_category_returns_empty_list():
    response = client.get(
        "/api/official-contacts",
        params={"category": "unknown_category"},
    )

    assert response.status_code == 200
    assert response.json()["contacts"] == []
    assert response.json()["count"] == 0


def test_unverified_contacts_are_not_public(monkeypatch):
    test_contacts = [
        {
            "id": "verified-test",
            "name": "Verified Contact",
            "category": "immediate_emergency",
            "contact_type": "phone",
            "value": "112",
            "verification_status": "verified",
        },
        {
            "id": "unverified-test",
            "name": "Unverified Contact",
            "category": "immediate_emergency",
            "contact_type": "phone",
            "value": "99999",
            "verification_status": "unverified",
        },
        {
            "id": "outdated-test",
            "name": "Outdated Contact",
            "category": "immediate_emergency",
            "contact_type": "phone",
            "value": "88888",
            "verification_status": "outdated",
        },
    ]

    monkeypatch.setattr(
        contacts_router,
        "OFFICIAL_CONTACTS",
        test_contacts,
    )

    response = client.get("/api/official-contacts")

    assert response.status_code == 200

    contacts = response.json()["contacts"]

    assert len(contacts) == 1
    assert contacts[0]["id"] == "verified-test"
    assert all(
        contact["verification_status"] == "verified"
        for contact in contacts
    )
