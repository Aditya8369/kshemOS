import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import fraud_graph_reviews


client = TestClient(app)

EDGE_ID = "EDGE-1001-1002"
TOKEN = "test-analyst-token-that-is-long-enough-123456"


@pytest.fixture(autouse=True)
def reset_review_store():
    fraud_graph_reviews.reset_review_store()
    yield
    fraud_graph_reviews.reset_review_store()


@pytest.fixture
def analyst_headers(monkeypatch):
    token_mapping = {TOKEN: "ANALYST-001"}

    monkeypatch.setenv(
        "FRAUD_GRAPH_ANALYST_TOKENS",
        json.dumps(token_mapping),
    )

    return {"Authorization": f"Bearer {TOKEN}"}


def test_review_submission_requires_authentication(analyst_headers):
    response = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        json={
            "decision": "confirm",
            "reason": "Evidence reviewed",
        },
    )

    assert response.status_code == 401


def test_invalid_analyst_token_is_rejected(analyst_headers):
    response = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers={"Authorization": "Bearer invalid-token"},
        json={
            "decision": "confirm",
            "reason": "Evidence reviewed",
        },
    )

    assert response.status_code == 401


def test_missing_authentication_configuration_returns_503(monkeypatch):
    monkeypatch.delenv("FRAUD_GRAPH_ANALYST_TOKENS", raising=False)

    response = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "decision": "confirm",
            "reason": "Evidence reviewed",
        },
    )

    assert response.status_code == 503


def test_review_uses_server_resolved_analyst_identity(analyst_headers):
    response = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
        json={
            "decision": "confirm",
            "reason": "Shared device evidence reviewed",
            "analyst_id": "CLIENT-CONTROLLED-IDENTITY",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["edge_id"] == EDGE_ID
    assert data["decision"] == "confirm"
    assert data["analyst_id"] == "ANALYST-001"
    assert data["event_type"] == "decision"


def test_review_rejects_blank_reason(analyst_headers):
    response = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
        json={
            "decision": "confirm",
            "reason": "   ",
        },
    )

    assert response.status_code == 422


def test_unknown_edge_returns_404(analyst_headers):
    response = client.post(
        "/api/graph/edges/UNKNOWN-EDGE/reviews",
        headers=analyst_headers,
        json={
            "decision": "confirm",
            "reason": "Evidence reviewed",
        },
    )

    assert response.status_code == 404


def test_review_history_and_integrity_endpoints(analyst_headers):
    created = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
        json={
            "decision": "dispute",
            "reason": "Additional evidence is required",
        },
    )

    assert created.status_code == 201

    history = client.get(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
    )

    assert history.status_code == 200
    assert history.json()["current_decision"] == "dispute"
    assert len(history.json()["events"]) == 1

    integrity = client.get(
        f"/api/graph/edges/{EDGE_ID}/reviews/integrity",
        headers=analyst_headers,
    )

    assert integrity.status_code == 200
    assert integrity.json()["verified"] is True
    assert integrity.json()["event_count"] == 1


def test_reversal_endpoint_preserves_original_decision(analyst_headers):
    created = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
        json={
            "decision": "confirm",
            "reason": "Initial confirmation",
        },
    )

    assert created.status_code == 201
    event_id = created.json()["event_id"]

    reversal = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews/{event_id}/reverse",
        headers=analyst_headers,
        json={
            "reason": "New evidence contradicts the original decision",
        },
    )

    assert reversal.status_code == 200
    assert reversal.json()["event_type"] == "reversal"
    assert reversal.json()["reverses_event_id"] == event_id

    history = client.get(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
    )

    assert history.status_code == 200
    assert len(history.json()["events"]) == 2
    assert history.json()["current_decision"] is None


def test_duplicate_reversal_returns_conflict(analyst_headers):
    created = client.post(
        f"/api/graph/edges/{EDGE_ID}/reviews",
        headers=analyst_headers,
        json={
            "decision": "reject",
            "reason": "Relationship rejected",
        },
    )

    event_id = created.json()["event_id"]
    reversal_url = (
        f"/api/graph/edges/{EDGE_ID}/reviews/{event_id}/reverse"
    )

    first = client.post(
        reversal_url,
        headers=analyst_headers,
        json={"reason": "First reversal"},
    )

    second = client.post(
        reversal_url,
        headers=analyst_headers,
        json={"reason": "Second reversal"},
    )

    assert first.status_code == 200
    assert second.status_code == 409


def test_evaluation_export_requires_authentication(analyst_headers):
    response = client.get("/api/graph/reviews/export")

    assert response.status_code == 401


def test_evaluation_export_is_available_to_authenticated_analyst(
    analyst_headers,
):
    response = client.get(
        "/api/graph/reviews/export",
        headers=analyst_headers,
    )

    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert response.json()["records"] == []