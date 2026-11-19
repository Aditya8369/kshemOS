import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import security
from app.routers import incidents as router
from app.models import (
    IncidentCreateRequest,
    IncidentUpdateRequest,
    SyncBatchRequest,
    SyncQueueItem,
)
from app.services import incidents

DELHI_TOKEN = "offline-delhi-test-token-that-is-long-enough-123456"
SOUTH_TOKEN = "offline-south-test-token-that-is-long-enough-123456"


@pytest.fixture
def principals(monkeypatch):
    monkeypatch.setenv(
        "KSHEMOS_API_TOKENS",
        (
            f'{{"{DELHI_TOKEN}": "OFF-SUP-DELHI", '
            f'"{SOUTH_TOKEN}": "OFF-CMD-SOUTH"}}'
        ),
    )
    return {
        "delhi": security.get_current_principal(
            HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=DELHI_TOKEN
            )
        ),
        "south": security.get_current_principal(
            HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=SOUTH_TOKEN
            )
        ),
    }


def test_incident_versioning_and_concurrency(principals):
    incidents.reset()
    created = router.create(
        IncidentCreateRequest(
            category="scam_call",
            description="Field officer reported ongoing digital arrest scam.",
            region="North Zone",
        ),
        principal=principals["delhi"],
    )
    assert created["version"] == 1
    assert created["updated_at"] is not None

    updated = router.update(
        created["id"],
        IncidentUpdateRequest(status="in_progress", assigned_to="OFF-FIELD-1"),
        principal=principals["delhi"],
    )
    assert updated["version"] == 2
    assert updated["status"] == "in_progress"
    assert updated["assigned_to"] == "OFF-FIELD-1"

    with pytest.raises(HTTPException) as exc_info:
        router.update(
            created["id"],
            IncidentUpdateRequest(
                status="escalated",
                expected_version=1,
            ),
            principal=principals["delhi"],
        )
    assert exc_info.value.status_code == 409
    conflict_detail = exc_info.value.detail
    assert conflict_detail["conflict"] is True
    assert conflict_detail["current_version"] == 2
    assert conflict_detail["expected_version"] == 1
    assert "status" in conflict_detail["conflicting_fields"]

    with pytest.raises(HTTPException) as exc_info:
        router.update(
            created["id"],
            IncidentUpdateRequest(
                status="escalated",
                expected_version=1,
                force=True,
            ),
            principal=principals["delhi"],
        )
    assert exc_info.value.status_code == 403


def test_batch_offline_sync(principals):
    incidents.reset()
    hq_incident = router.create(
        IncidentCreateRequest(
            category="other",
            description="HQ incident reported earlier.",
            region="West Zone",
        ),
        principal=principals["south"],
    )
    assert hq_incident["version"] == 1

    router.update(
        hq_incident["id"],
        IncidentUpdateRequest(severity="high"),
        principal=principals["south"],
    )

    batch = SyncBatchRequest(
        items=[
            SyncQueueItem(
                queue_id="Q-101",
                action="create",
                create_payload=IncidentCreateRequest(
                    category="fraud_tx",
                    description="Offline field intake: ATM skimming report.",
                    region="South Zone",
                ),
                client_timestamp=1700000000000,
            ),
            SyncQueueItem(
                queue_id="Q-102",
                action="update",
                incident_id=hq_incident["id"],
                changes=IncidentUpdateRequest(
                    status="triaged",
                    assigned_to="OFF-WEST-2",
                ),
                expected_version=1,
                client_timestamp=1700000001000,
                force=False,
            ),
        ]
    )

    result = router.sync_batch(batch, principal=principals["south"])
    assert result["applied_count"] == 1
    assert result["conflict_count"] == 1
    assert result["failed_count"] == 0

    created_result = next(
        item for item in result["results"] if item["queue_id"] == "Q-101"
    )
    assert created_result["status"] == "applied"
    assert created_result["incident"]["category"] == "fraud_tx"

    conflict_result = next(
        item for item in result["results"] if item["queue_id"] == "Q-102"
    )
    assert conflict_result["status"] == "conflict"
    assert conflict_result["server_incident"]["version"] == 2
    assert "status" in conflict_result["conflicting_fields"]

    with pytest.raises(HTTPException) as exc_info:
        router.update(
            "INC-9999",
            IncidentUpdateRequest(status="in_progress"),
            principal=principals["south"],
        )
    assert exc_info.value.status_code == 404
