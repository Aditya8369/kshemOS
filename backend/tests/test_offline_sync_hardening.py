"""Offline sync hardening: idempotency, ordering, and scoped field access."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import incidents

ADMIN_TOKEN = "test-admin-token-that-is-long-enough-123456789"
OFFICER_TOKEN = "test-officer-token-that-is-long-enough-1234567"
OTHER_TOKEN = "test-other-token-that-is-long-enough-1234567890"


def _tokens() -> dict:
    return {
        ADMIN_TOKEN: {
            "subject": "ADMIN-TEST",
            "role": "admin",
            "jurisdictions": [],
            "case_ids": [],
        },
        OFFICER_TOKEN: {
            "subject": "OFF-FIELD-1",
            "role": "officer",
            "jurisdictions": ["West Zone"],
            "case_ids": [],
        },
        OTHER_TOKEN: {
            "subject": "OFF-FIELD-2",
            "role": "officer",
            "jurisdictions": ["East Zone"],
            "case_ids": [],
        },
    }


@pytest.fixture(autouse=True)
def clean_store(monkeypatch):
    monkeypatch.setenv("KSHEMOS_ACCESS_TOKENS", json.dumps(_tokens()))
    incidents.reset()
    yield
    incidents.reset()


def admin_client() -> TestClient:
    return TestClient(
        app, headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )


def officer_client(token: str = OFFICER_TOKEN) -> TestClient:
    return TestClient(
        app, headers={"Authorization": f"Bearer {token}"}
    )


def create_incident(client: TestClient, **overrides) -> dict:
    payload = {
        "category": "scam_call",
        "description": "Field officer reported an ongoing digital arrest scam.",
        "region": "West Zone",
    }
    payload.update(overrides)
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_http_responses_expose_version_and_timestamps():
    client = admin_client()

    created = create_incident(client)
    assert created["version"] == 1
    assert isinstance(created["updated_at"], int)
    assert created["notes"] == []

    updated = client.patch(
        f"/api/incidents/{created['id']}",
        json={"status": "in_progress", "expected_version": 1},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["version"] == 2

    feed = client.get("/api/incidents").json()
    assert feed["incidents"][0]["version"] == 2


def test_duplicate_patch_retry_is_idempotent_and_does_not_duplicate_notes():
    client = admin_client()
    created = create_incident(client)

    payload = {
        "status": "in_progress",
        "notes": "En route to the scene.",
        "operation_id": "op-patch-1",
        "expected_version": 1,
    }

    first = client.patch(f"/api/incidents/{created['id']}", json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["version"] == 2
    assert first.json()["notes"] == ["En route to the scene."]

    retry = client.patch(f"/api/incidents/{created['id']}", json=payload)
    assert retry.status_code == 200, retry.text
    assert retry.json()["version"] == 2
    assert retry.json()["notes"] == ["En route to the scene."]

    feed = client.get("/api/incidents").json()
    stored = feed["incidents"][0]
    assert stored["version"] == 2
    assert stored["notes"] == ["En route to the scene."]


def test_duplicate_sync_batch_retry_does_not_create_duplicate_incident():
    client = admin_client()

    batch = {
        "items": [
            {
                "queue_id": "Q-DUP-1",
                "operation_id": "op-create-1",
                "action": "create",
                "local_incident_id": "INC-PENDING-aaaa",
                "create_payload": {
                    "category": "fraud_tx",
                    "description": "Offline intake: ATM skimming device located.",
                    "region": "West Zone",
                },
                "client_timestamp": 1700000000000,
            }
        ]
    }

    first = client.post("/api/incidents/sync", json=batch)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["applied_count"] == 1
    assert body["replayed_count"] == 0
    incident_id = body["results"][0]["incident"]["id"]

    retry = client.post("/api/incidents/sync", json=batch)
    assert retry.status_code == 200, retry.text
    replayed = retry.json()
    assert replayed["results"][0]["incident"]["id"] == incident_id
    assert replayed["results"][0]["replayed"] is True
    assert replayed["replayed_count"] == 1

    feed = client.get("/api/incidents").json()["incidents"]
    assert len(feed) == 1


def test_update_batch_retry_is_idempotent():
    client = admin_client()
    created = create_incident(client)

    batch = {
        "items": [
            {
                "queue_id": "Q-UPD-1",
                "operation_id": "op-update-1",
                "action": "update",
                "incident_id": created["id"],
                "changes": {
                    "status": "triaged",
                    "notes": "Witness statement recorded.",
                },
                "expected_version": 1,
                "client_timestamp": 1700000001000,
            }
        ]
    }

    first = client.post("/api/incidents/sync", json=batch)
    assert first.status_code == 200, first.text
    assert first.json()["results"][0]["status"] == "applied"

    retry = client.post("/api/incidents/sync", json=batch)
    assert retry.status_code == 200, retry.text
    result = retry.json()["results"][0]
    assert result["status"] == "applied"
    assert result["replayed"] is True
    assert result["incident"]["version"] == 2
    assert result["incident"]["notes"] == ["Witness statement recorded."]

    stored = client.get("/api/incidents").json()["incidents"][0]
    assert stored["version"] == 2
    assert stored["notes"] == ["Witness statement recorded."]


def test_conflict_retry_is_idempotent_and_never_overwrites():
    client = admin_client()
    created = create_incident(client)
    client.patch(
        f"/api/incidents/{created['id']}",
        json={"status": "in_progress"},
    )

    stale_batch = {
        "items": [
            {
                "queue_id": "Q-CONFLICT-1",
                "operation_id": "op-conflict-1",
                "action": "update",
                "incident_id": created["id"],
                "changes": {"severity": "critical"},
                "expected_version": 1,
                "client_timestamp": 1700000002000,
            }
        ]
    }

    first = client.post("/api/incidents/sync", json=stale_batch)
    assert first.status_code == 200, first.text
    conflict = first.json()["results"][0]
    assert conflict["status"] == "conflict"
    assert conflict["server_incident"]["version"] == 2

    retry = client.post("/api/incidents/sync", json=stale_batch)
    replayed = retry.json()["results"][0]
    assert replayed["status"] == "conflict"
    assert replayed["replayed"] is True
    assert replayed["server_incident"]["version"] == 2

    stored = client.get("/api/incidents").json()["incidents"][0]
    assert stored["version"] == 2
    assert stored["severity"] != "critical"

    # A deliberate resolution uses a fresh operation ID and force flag.
    resolution = {
        "items": [
            {
                "queue_id": "Q-CONFLICT-2",
                "operation_id": "op-conflict-2",
                "action": "update",
                "incident_id": created["id"],
                "changes": {"severity": "critical"},
                "expected_version": 1,
                "force": True,
                "client_timestamp": 1700000003000,
            }
        ]
    }
    resolved = client.post("/api/incidents/sync", json=resolution)
    assert resolved.json()["results"][0]["status"] == "applied"
    assert resolved.json()["results"][0]["incident"]["version"] == 3


def test_out_of_order_batch_applies_by_client_timestamp():
    client = admin_client()
    created = create_incident(client)

    # Array order is intentionally the reverse of authoring order. Without
    # timestamp ordering the second item would conflict with the first.
    batch = {
        "items": [
            {
                "queue_id": "Q-LATER",
                "operation_id": "op-later",
                "action": "update",
                "incident_id": created["id"],
                "changes": {"status": "resolved"},
                "expected_version": 2,
                "client_timestamp": 1700000002000,
            },
            {
                "queue_id": "Q-EARLIER",
                "operation_id": "op-earlier",
                "action": "update",
                "incident_id": created["id"],
                "changes": {"severity": "high"},
                "expected_version": 1,
                "client_timestamp": 1700000001000,
            },
        ]
    }

    response = client.post("/api/incidents/sync", json=batch)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["applied_count"] == 2
    assert body["conflict_count"] == 0
    assert [r["queue_id"] for r in body["results"]] == ["Q-EARLIER", "Q-LATER"]

    stored = client.get("/api/incidents").json()["incidents"][0]
    assert stored["version"] == 3
    assert stored["severity"] == "high"
    assert stored["status"] == "resolved"


def test_create_then_update_in_same_batch_resolves_local_id():
    client = admin_client()

    batch = {
        "items": [
            {
                "queue_id": "Q-LOCAL-UPD",
                "operation_id": "op-local-update",
                "action": "update",
                "incident_id": "INC-PENDING-bbbb",
                "changes": {
                    "status": "in_progress",
                    "assigned_to": "OFF-FIELD-1",
                },
                "expected_version": 1,
                "client_timestamp": 1700000001000,
            },
            {
                "queue_id": "Q-LOCAL-CREATE",
                "operation_id": "op-local-create",
                "action": "create",
                "local_incident_id": "INC-PENDING-bbbb",
                "create_payload": {
                    "category": "counterfeit",
                    "description": "Offline draft: counterfeit note seized at market.",
                    "region": "West Zone",
                },
                "client_timestamp": 1700000000000,
            },
        ]
    }

    response = client.post("/api/incidents/sync", json=batch)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["applied_count"] == 2
    assert body["failed_count"] == 0

    created_id = next(
        r["incident"]["id"] for r in body["results"] if r["queue_id"] == "Q-LOCAL-CREATE"
    )
    update_result = next(
        r for r in body["results"] if r["queue_id"] == "Q-LOCAL-UPD"
    )
    assert update_result["status"] == "applied"
    assert update_result["incident_id"] == created_id

    stored = next(
        i for i in client.get("/api/incidents").json()["incidents"]
        if i["id"] == created_id
    )
    assert stored["status"] == "in_progress"
    assert stored["assigned_to"] == "OFF-FIELD-1"
    assert stored["version"] == 2


def test_officer_can_sync_within_jurisdiction_but_not_outside_it():
    admin = admin_client()
    west = create_incident(admin, region="West Zone")
    east = create_incident(admin, region="East Zone")

    officer = officer_client()

    allowed = officer.post(
        "/api/incidents/sync",
        json={
            "items": [
                {
                    "queue_id": "Q-WEST",
                    "operation_id": "op-west",
                    "action": "update",
                    "incident_id": west["id"],
                    "changes": {"status": "triaged"},
                    "expected_version": 1,
                    "client_timestamp": 1700000000000,
                },
                {
                    "queue_id": "Q-EAST",
                    "operation_id": "op-east",
                    "action": "update",
                    "incident_id": east["id"],
                    "changes": {"status": "triaged"},
                    "expected_version": 1,
                    "client_timestamp": 1700000001000,
                },
            ]
        },
    )

    assert allowed.status_code == 200, allowed.text
    results = {r["queue_id"]: r for r in allowed.json()["results"]}
    assert results["Q-WEST"]["status"] == "applied"
    assert results["Q-EAST"]["status"] == "failed"


def test_officer_can_create_offline_draft_only_in_own_jurisdiction():
    officer = officer_client()

    same_region = {
        "items": [
            {
                "queue_id": "Q-CREATE-OK",
                "operation_id": "op-create-ok",
                "action": "create",
                "local_incident_id": "INC-PENDING-cccc",
                "create_payload": {
                    "category": "other",
                    "description": "Offline field draft within assigned zone.",
                    "region": "West Zone",
                },
                "client_timestamp": 1700000000000,
            }
        ]
    }
    ok = officer.post("/api/incidents/sync", json=same_region)
    assert ok.status_code == 200, ok.text
    assert ok.json()["applied_count"] == 1

    other_region = {
        "items": [
            {
                "queue_id": "Q-CREATE-DENIED",
                "operation_id": "op-create-denied",
                "action": "create",
                "create_payload": {
                    "category": "other",
                    "description": "Attempted out-of-scope draft.",
                    "region": "East Zone",
                },
                "client_timestamp": 1700000001000,
            }
        ]
    }
    denied = officer.post("/api/incidents/sync", json=other_region)
    assert denied.status_code == 200, denied.text
    assert denied.json()["failed_count"] == 1


def test_concurrent_duplicate_retries_apply_once():
    from concurrent.futures import ThreadPoolExecutor

    payload = {
        "category": "other",
        "description": "Concurrent retry of the same field draft.",
        "region": "West Zone",
    }

    def apply(_):
        return incidents.create_incident_idempotent(
            payload,
            subject="OFF-CONCURRENT",
            operation_id="op-concurrent-1",
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(apply, range(8)))

    incident_ids = {result["incident"]["id"] for result in results}
    assert len(incident_ids) == 1
    assert sum(1 for result in results if not result["replayed"]) == 1
    assert len(incidents.get_feed()["incidents"]) == 1


def test_duplicate_operation_ids_are_scoped_per_subject():
    admin = admin_client()
    created = create_incident(admin)
    client_a = officer_client(OFFICER_TOKEN)
    client_b = officer_client(OTHER_TOKEN)

    # Both officers use the same operation ID in their own offline queue.
    payload = {
        "items": [
            {
                "queue_id": "Q-SHARED",
                "operation_id": "queue-0001",
                "action": "update",
                "incident_id": created["id"],
                "changes": {"status": "triaged"},
                "expected_version": 1,
                "client_timestamp": 1700000000000,
            }
        ]
    }

    # The East Zone officer is out of scope, so this must not claim the ID.
    out_of_scope = client_b.post("/api/incidents/sync", json=payload)
    assert out_of_scope.json()["failed_count"] == 1

    applied = client_a.post("/api/incidents/sync", json=payload)
    assert applied.status_code == 200, applied.text
    assert applied.json()["applied_count"] == 1
    assert applied.json()["results"][0]["replayed"] is False
