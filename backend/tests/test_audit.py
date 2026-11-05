"""Tests for the centralized KshemOS audit logging system."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import audit


client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_audit_store():
    audit.reset()
    yield
    audit.reset()


def test_record_event_creates_complete_audit_entry():
    event = audit.record_event(
        actor_id="OFF-101",
        actor_role="officer",
        action="INCIDENT_CREATED",
        resource_type="incident",
        resource_id="INC-1001",
        metadata={"region": "West Zone"},
        occurred_at=1000,
    )

    assert event["actor_id"] == "OFF-101"
    assert event["actor_role"] == "officer"
    assert event["action"] == "INCIDENT_CREATED"
    assert event["resource_type"] == "incident"
    assert event["resource_id"] == "INC-1001"
    assert event["occurred_at"] == 1000
    assert event["event_hash"]
    assert event["previous_hash"] == audit.GENESIS_HASH


def test_sensitive_metadata_is_redacted_recursively():
    event = audit.record_event(
        actor_id="OFF-101",
        action="EVIDENCE_VIEW",
        resource_type="evidence",
        metadata={
            "document_type": "PDF",
            "password": "secret123",
            "nested": {
                "api_key": "private-key",
                "safe_field": "visible",
            },
            "phone": "9876543210",
        },
    )

    metadata = event["metadata"]

    assert metadata["document_type"] == "PDF"
    assert metadata["password"] == "[REDACTED]"
    assert metadata["nested"]["api_key"] == "[REDACTED]"
    assert metadata["nested"]["safe_field"] == "visible"
    assert metadata["phone"] == "[REDACTED]"


def test_returned_event_cannot_mutate_stored_event():
    event = audit.record_event(
        actor_id="OFF-101",
        action="INCIDENT_CREATED",
        resource_type="incident",
    )

    event["action"] = "TAMPERED"

    stored = audit.list_events()["items"][0]

    assert stored["action"] == "INCIDENT_CREATED"


def test_sensitive_and_unusual_events_are_classified():
    sensitive = audit.record_event(
        actor_id="OFF-101",
        action="EVIDENCE_VIEW",
        resource_type="evidence",
    )

    unusual = audit.record_event(
        actor_id="OFF-102",
        action="ACCESS_DENIED",
        resource_type="incident",
        outcome="denied",
    )

    assert sensitive["is_sensitive"] is True
    assert sensitive["risk_level"] == "medium"

    assert unusual["is_unusual"] is True
    assert unusual["risk_level"] == "high"


def test_filter_events_by_actor_action_and_resource():
    audit.record_event(
        actor_id="OFF-101",
        action="EVIDENCE_VIEW",
        resource_type="evidence",
        resource_id="EVID-101",
    )

    audit.record_event(
        actor_id="OFF-102",
        action="INCIDENT_UPDATED",
        resource_type="incident",
        resource_id="INC-101",
    )

    results = audit.list_events(
        actor_id="OFF-101",
        action="VIEW",
        resource_type="evidence",
    )

    assert results["total"] == 1
    assert results["items"][0]["resource_id"] == "EVID-101"


def test_filter_events_by_timestamp():
    for timestamp in (1000, 2000, 3000):
        audit.record_event(
            actor_id="OFF-101",
            action="INCIDENT_CREATED",
            resource_type="incident",
            occurred_at=timestamp,
        )

    results = audit.list_events(
        from_ms=1500,
        to_ms=2500,
    )

    assert results["total"] == 1
    assert results["items"][0]["occurred_at"] == 2000


def test_filter_events_by_outcome_and_classification():
    audit.record_event(
        actor_id="OFF-101",
        action="EVIDENCE_VIEW",
        resource_type="evidence",
        outcome="success",
    )

    audit.record_event(
        actor_id="OFF-102",
        action="ACCESS_DENIED",
        resource_type="incident",
        outcome="denied",
    )

    sensitive = audit.list_events(sensitive=True)
    unusual = audit.list_events(unusual=True)
    denied = audit.list_events(outcome="denied")

    assert sensitive["total"] == 1
    assert unusual["total"] == 1
    assert denied["total"] == 1


def test_search_events_by_metadata():
    audit.record_event(
        actor_id="OFF-101",
        action="INCIDENT_REVIEWED",
        resource_type="incident",
        metadata={"region": "Pune"},
    )

    results = audit.list_events(search="Pune")

    assert results["total"] == 1


def test_pagination_returns_correct_results():
    for index in range(5):
        audit.record_event(
            actor_id=f"OFF-{index}",
            action="INCIDENT_CREATED",
            resource_type="incident",
            occurred_at=1000 + index,
        )

    first_page = audit.list_events(page=1, page_size=2)
    second_page = audit.list_events(page=2, page_size=2)
    third_page = audit.list_events(page=3, page_size=2)

    assert first_page["total"] == 5
    assert first_page["pages"] == 3
    assert len(first_page["items"]) == 2
    assert len(second_page["items"]) == 2
    assert len(third_page["items"]) == 1

    assert (
        first_page["items"][0]["event_id"]
        != second_page["items"][0]["event_id"]
    )


def test_hash_chain_integrity_verification():
    audit.record_event(
        actor_id="OFF-101",
        action="INCIDENT_CREATED",
        resource_type="incident",
    )

    audit.record_event(
        actor_id="OFF-102",
        action="INCIDENT_UPDATED",
        resource_type="incident",
    )

    result = audit.verify_integrity()

    assert result["valid"] is True
    assert result["event_count"] == 2
    assert result["invalid_event_id"] is None


def test_hash_chain_detects_tampering():
    event = audit.record_event(
        actor_id="OFF-101",
        action="INCIDENT_CREATED",
        resource_type="incident",
    )

    # Simulate unauthorized modification of stored data.
    audit._events[0]["action"] = "TAMPERED"

    result = audit.verify_integrity()

    assert result["valid"] is False
    assert result["invalid_event_id"] == event["event_id"]


def test_event_history_is_append_only():
    audit.record_event(
        actor_id="OFF-101",
        action="INCIDENT_CREATED",
        resource_type="incident",
    )

    audit.record_event(
        actor_id="OFF-102",
        action="INCIDENT_UPDATED",
        resource_type="incident",
    )

    result = audit.list_events()

    assert result["total"] == 2


def test_invalid_outcome_is_rejected():
    with pytest.raises(ValueError):
        audit.record_event(
            actor_id="OFF-101",
            action="TEST",
            resource_type="incident",
            outcome="invalid",
        )


def test_audit_events_api():
    audit.record_event(
        actor_id="OFF-101",
        action="EVIDENCE_VIEW",
        resource_type="evidence",
        resource_id="EVID-101",
    )

    response = client.get(
        "/api/audit/events",
        params={"actor_id": "OFF-101"},
    )

    assert response.status_code == 200

    body = response.json()

    assert body["total"] == 1
    assert body["items"][0]["actor_id"] == "OFF-101"


def test_audit_integrity_api():
    audit.record_event(
        actor_id="OFF-101",
        action="INCIDENT_CREATED",
        resource_type="incident",
    )

    response = client.get("/api/audit/integrity")

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["event_count"] == 1


def test_audit_api_rejects_invalid_timestamp_range():
    response = client.get(
        "/api/audit/events",
        params={
            "from_ms": 5000,
            "to_ms": 1000,
        },
    )

    assert response.status_code == 422


def test_audit_middleware_records_api_requests():
    response = client.post(
        "/api/scam/analyze",
        json={},
        headers={
            "X-Actor-ID": "FAKE-ADMIN",
            "X-User-Role": "admin",
        },
    )

    assert response.status_code == 422

    results = audit.list_events(
        action="HTTP_POST",
        resource_type="scam",
    )

    assert results["total"] == 1

    event = results["items"][0]

    assert event["actor_id"] == "anonymous"
    assert event["outcome"] == "failure"
    assert event["metadata"]["http_status"] == 422
