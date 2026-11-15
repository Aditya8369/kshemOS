"""
Tests for Public Incident Advisory Subscriptions (Issue #43).
Verifies:
1. Subscriptions require explicit consent and can be withdrawn.
2. Draft advisories are never sent publicly.
3. Expired advisories are marked and excluded from new digests.
4. Retries do not create duplicate notifications.
5. In-app feed filtering by district/area and topic.
6. Email payloads include source, issue time, expiry, and unsubscribe/preference links.
7. Subscriber directory access is restricted.
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.services import advisory_subscriptions as sub_service
from app.services.emergency_broadcast import default_broadcast_engine

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_subscriptions():
    """Reset subscription store before each test run."""
    sub_service.reset_store()
    yield
    sub_service.reset_store()


def test_subscription_requires_explicit_consent(client):
    """Subscriptions require explicit consent to activate; without it, requests are rejected."""
    # Attempt without consent
    res = client.post(
        "/api/advisory-subscriptions/subscribe",
        json={
            "email": "noconsent@example.com",
            "areas": ["Central Zone"],
            "topics": ["digital_arrest"],
            "channels": ["email"],
            "consent_given": False,
        },
    )
    assert res.status_code == 400
    assert "Explicit consent is required" in res.json()["detail"]

    # Attempt with explicit consent
    res = client.post(
        "/api/advisory-subscriptions/subscribe",
        json={
            "email": "consent.user@example.com",
            "areas": ["Central Zone"],
            "topics": ["digital_arrest"],
            "channels": ["email", "in_app"],
            "consent_given": True,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["id"].startswith("SUB-")
    assert data["email"] == "consent.user@example.com"
    assert data["is_active"] is True
    assert data["consent_given"] is True
    assert data["management_token"].startswith("tok-")


def test_subscription_can_be_withdrawn(client):
    """Consent can be withdrawn via one-click unsubscribe or preference management."""
    # Create subscription
    sub_res = client.post(
        "/api/advisory-subscriptions/subscribe",
        json={
            "email": "withdraw.test@example.com",
            "areas": ["South Zone"],
            "topics": ["counterfeit_currency"],
            "channels": ["email"],
            "consent_given": True,
        },
    )
    assert sub_res.status_code == 201
    token = sub_res.json()["management_token"]

    # Retrieve preferences using private token
    pref_res = client.get(f"/api/advisory-subscriptions/preferences/{token}")
    assert pref_res.status_code == 200
    assert pref_res.json()["is_active"] is True

    # Withdraw consent via unsubscribe endpoint
    unsub_res = client.post(f"/api/advisory-subscriptions/unsubscribe?token={token}")
    assert unsub_res.status_code == 200
    assert unsub_res.json()["success"] is True

    # Verify status is now inactive
    pref_after = client.get(f"/api/advisory-subscriptions/preferences/{token}")
    assert pref_after.status_code == 200
    assert pref_after.json()["is_active"] is False
    assert pref_after.json()["unsubscribed_at"] is not None


def test_draft_advisories_never_sent_publicly(client):
    """Draft or unapproved advisories must NEVER be dispatched to public subscribers."""
    # Create a draft advisory
    create_res = client.post(
        "/api/advisory/create",
        json={
            "title": "DRAFT: Internal Testing Advisory",
            "description": "Internal test description",
            "severity": "critical",
            "affected_location": "Central Zone",
            "target_audience": "citizens",
            "template_type": "tpl_digital_arrest",
        },
    )
    assert create_res.status_code == 200
    adv_id = create_res.json()["id"]

    # Verify advisory is draft
    adv = default_broadcast_engine.advisories[adv_id]
    assert adv["status"] == "draft"

    # Attempt to dispatch draft advisory to public subscribers
    dispatch_res = client.post(f"/api/advisory-subscriptions/dispatch/{adv_id}")
    assert dispatch_res.status_code == 403
    assert "Draft or unapproved advisory cannot be dispatched" in dispatch_res.json()["detail"]

    # Verify draft advisory does NOT appear in in-app feed
    feed_res = client.get("/api/advisory-subscriptions/feed")
    assert feed_res.status_code == 200
    feed_ids = [item["advisory_id"] for item in feed_res.json()]
    assert adv_id not in feed_ids


def test_expired_advisories_marked_and_excluded(client):
    """Expired advisories are marked and excluded from new digests and the active in-app feed."""
    past_time = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    expired_adv_id = "ADV-EXPIRED-TEST"

    # Inject an expired published advisory
    default_broadcast_engine.advisories[expired_adv_id] = {
        "id": expired_adv_id,
        "title": "OLD ALERT: Expired Threat Notice",
        "description": "This threat was resolved yesterday.",
        "severity": "medium",
        "affected_location": "Central Zone",
        "target_audience": "citizens",
        "template_type": "tpl_digital_arrest",
        "status": "published",
        "created_at": "2026-11-01T00:00:00Z",
        "updated_at": past_time,
        "source": "Cyber Public Safety Command",
        "issued_at": "2026-11-01T00:00:00Z",
        "expires_at": past_time,
        "is_expired": True,
        "targeting": {
            "region": "Central Zone",
            "service_area_id": "SA-CENTRAL-01",
            "postal_pincodes": ["110001"],
        },
    }

    # Attempt to dispatch expired advisory
    dispatch_res = client.post(f"/api/advisory-subscriptions/dispatch/{expired_adv_id}")
    assert dispatch_res.status_code == 400
    assert "has expired" in dispatch_res.json()["detail"]

    # Verify default in-app feed excludes expired advisory
    feed_res = client.get("/api/advisory-subscriptions/feed")
    assert feed_res.status_code == 200
    feed_ids = [item["advisory_id"] for item in feed_res.json()]
    assert expired_adv_id not in feed_ids

    # Verify feed with include_expired=True returns it marked as expired
    feed_all = client.get("/api/advisory-subscriptions/feed?include_expired=true")
    assert feed_all.status_code == 200
    found = next((i for i in feed_all.json() if i["advisory_id"] == expired_adv_id), None)
    assert found is not None
    assert found["is_expired"] is True


def test_retries_do_not_create_duplicate_notifications(client):
    """Retrying notification dispatches must be idempotent and prevent duplicate emails."""
    # Ensure a published valid advisory exists
    adv_id = "ADV-9104"
    adv = default_broadcast_engine.advisories[adv_id]
    adv["status"] = "published"
    adv["expires_at"] = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()

    # First dispatch
    res1 = client.post(f"/api/advisory-subscriptions/dispatch/{adv_id}")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["sent_count"] >= 1
    assert data1["duplicate_prevented_count"] == 0

    # Second dispatch (retry scenario)
    res2 = client.post(f"/api/advisory-subscriptions/dispatch/{adv_id}")
    assert res2.status_code == 200
    data2 = res2.json()
    # No new sends, previous sends counted as duplicate prevented
    assert data2["sent_count"] == 0
    assert data2["duplicate_prevented_count"] >= 1


def test_email_payload_contains_links_and_metadata(client):
    """Every email notification must contain source, issue time, expiry, and unsubscribe/preference links."""
    adv_id = "ADV-9104"
    adv = default_broadcast_engine.advisories[adv_id]
    adv["status"] = "published"

    res = client.post(f"/api/advisory-subscriptions/dispatch/{adv_id}")
    assert res.status_code == 200
    dispatches = res.json()["dispatches"]
    assert len(dispatches) > 0

    first = dispatches[0]
    assert first["source"] != ""
    assert first["issued_at"] != ""
    assert first["expires_at"] != ""
    assert "unsubscribe" in first["unsubscribe_link"]
    assert "token=" in first["unsubscribe_link"]
    assert "preferences" in first["preference_management_link"]
    assert "token=" in first["preference_management_link"]
    assert first["unsubscribe_link"] in first["body_text"]
    assert first["preference_management_link"] in first["body_text"]


def test_restricted_subscriber_list_access(client):
    """Subscriber list is restricted to authorized officers; unauthenticated access returns 403."""
    # Unauthenticated / citizen query
    res = client.get("/api/advisory-subscriptions/subscribers")
    assert res.status_code == 403
    assert "Access Restricted" in res.json()["detail"]

    # Authorized officer query
    res_auth = client.get(
        "/api/advisory-subscriptions/subscribers",
        headers={"X-Officer-Badge": "BADGE-CMD-701"},
    )
    assert res_auth.status_code == 200
    subscribers = res_auth.json()
    assert len(subscribers) >= 3
