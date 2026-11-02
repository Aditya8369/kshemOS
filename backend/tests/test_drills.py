import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.drills import router
from app.services import drills


app_for_tests = FastAPI()
app_for_tests.include_router(router)
client = TestClient(app_for_tests)


@pytest.fixture(autouse=True)
def clean_drills():
    drills.reset()
    yield
    drills.reset()


def start_default_drill():
    response = client.post(
        "/api/drills",
        json={"scenario_id": "coordinated-digital-arrest"},
    )
    assert response.status_code == 201
    return response.json()


def test_scenario_catalog_hides_expected_action_scoring_keys():
    response = client.get("/api/drills/scenarios")

    assert response.status_code == 200
    scenarios = response.json()["scenarios"]
    assert {scenario["id"] for scenario in scenarios} == {
        "coordinated-digital-arrest",
        "multi-region-fraud-ring",
    }
    assert scenarios[0]["event_count"] == 3
    assert all("accepted_actions" not in objective for scenario in scenarios for objective in scenario["objectives"])


def test_create_drill_initializes_independent_session_and_resources():
    drill = start_default_drill()

    assert drill["id"] == "DRL-0001"
    assert drill["status"] == "active"
    assert len(drill["teams"]) == 3
    assert drill["resources"]["Cyber Cell"]["investigators"] == 3
    assert drill["total_events"] == 3
    assert drill["events_remaining"] == 3
    assert drill["score"] == 0
    assert "event_script" not in drill
    assert all("accepted_actions" not in objective for objective in drill["objectives"])


def test_create_rejects_unknown_scenario_and_invalid_name():
    assert client.post("/api/drills", json={"scenario_id": "missing"}).status_code == 404
    assert client.post("/api/drills", json={"scenario_id": "coordinated-digital-arrest", "name": "x"}).status_code == 422
    assert client.post("/api/drills", json={"scenario_id": "coordinated-digital-arrest", "name": "   "}).status_code == 422


def test_drill_listing_and_detail_are_available():
    created = start_default_drill()

    listed = client.get("/api/drills").json()["drills"]
    fetched = client.get(f"/api/drills/{created['id']}")

    assert [item["id"] for item in listed] == [created["id"]]
    assert fetched.status_code == 200
    assert fetched.json()["scenario_id"] == "coordinated-digital-arrest"
    assert client.get("/api/drills/DRL-9999").status_code == 404


def test_events_are_released_in_order_and_cannot_advance_past_script():
    drill = start_default_drill()
    url = f"/api/drills/{drill['id']}/advance"

    first = client.post(url).json()
    second = client.post(url).json()
    third = client.post(url).json()

    assert [event["id"] for event in third["event_history"]] == ["DA-001", "DA-002", "DA-003"]
    assert third["current_event"]["id"] == "DA-003"
    assert third["events_remaining"] == 0
    assert client.post(url).status_code == 409


def test_decision_scoring_is_deterministic_and_only_rewards_matching_action():
    drill = start_default_drill()
    url = f"/api/drills/{drill['id']}/decisions"

    wrong = client.post(
        url,
        json={"team": "Dispatch", "objective_id": "protect-funds", "action": "send_email"},
    ).json()
    assert wrong["decisions"][-1]["objective_met"] is False
    assert wrong["score"] == 0

    correct = client.post(
        url,
        json={"team": "Dispatch", "objective_id": "protect-funds", "action": "contact_bank"},
    ).json()
    assert correct["decisions"][-1]["objective_met"] is True
    assert correct["score"] == 30
    assert next(o for o in correct["objectives"] if o["id"] == "protect-funds")["completed"] is True


def test_decisions_reject_unknown_team_and_objective():
    drill = start_default_drill()
    url = f"/api/drills/{drill['id']}/decisions"

    assert client.post(
        url,
        json={"team": "Unknown Team", "objective_id": "protect-funds", "action": "contact_bank"},
    ).status_code == 422
    assert client.post(
        url,
        json={"team": "Dispatch", "objective_id": "missing", "action": "contact_bank"},
    ).status_code == 422


def test_resource_movement_updates_balances_and_records_history():
    drill = start_default_drill()
    url = f"/api/drills/{drill['id']}/resources/move"

    response = client.post(
        url,
        json={
            "resource_type": "response_units",
            "quantity": 1,
            "from_team": "Field Response",
            "to_team": "Dispatch",
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["resources"]["Field Response"]["response_units"] == 3
    assert result["resources"]["Dispatch"]["response_units"] == 3
    assert result["resource_movements"][-1]["quantity"] == 1


def test_resource_movement_rejects_overdraw_and_invalid_teams():
    drill = start_default_drill()
    url = f"/api/drills/{drill['id']}/resources/move"

    overdraw = client.post(
        url,
        json={
            "resource_type": "response_units",
            "quantity": 99,
            "from_team": "Field Response",
            "to_team": "Dispatch",
        },
    )
    assert overdraw.status_code == 409

    invalid_team = client.post(
        url,
        json={
            "resource_type": "response_units",
            "quantity": 1,
            "from_team": "Unknown",
            "to_team": "Dispatch",
        },
    )
    assert invalid_team.status_code == 422

    same_team = client.post(
        url,
        json={
            "resource_type": "response_units",
            "quantity": 1,
            "from_team": "Dispatch",
            "to_team": "Dispatch",
        },
    )
    assert same_team.status_code == 422


def test_after_action_report_requires_completion_and_summarizes_drill():
    drill = start_default_drill()
    drill_id = drill["id"]

    assert client.get(f"/api/drills/{drill_id}/report").status_code == 409
    client.post(
        f"/api/drills/{drill_id}/decisions",
        json={"team": "Dispatch", "objective_id": "verify-authority", "action": "independent_verification"},
    )
    client.post(f"/api/drills/{drill_id}/advance")
    client.post(
        f"/api/drills/{drill_id}/resources/move",
        json={"resource_type": "response_units", "quantity": 1, "from_team": "Field Response", "to_team": "Dispatch"},
    )
    completed = client.post(f"/api/drills/{drill_id}/complete")
    report = client.get(f"/api/drills/{drill_id}/report")

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert report.status_code == 200
    body = report.json()
    assert body["score"] == 25
    assert body["max_score"] == 100
    assert body["objectives_completed"] == 1
    assert body["events_released"] == 1
    assert body["decisions_recorded"] == 1
    assert body["resource_movements_recorded"] == 1
    assert body["timeline"][-1]["type"] == "drill_completed"


def test_completed_drill_rejects_further_mutations():
    drill = start_default_drill()
    drill_id = drill["id"]
    assert client.post(f"/api/drills/{drill_id}/complete").status_code == 200

    assert client.post(f"/api/drills/{drill_id}/advance").status_code == 409
    assert client.post(
        f"/api/drills/{drill_id}/decisions",
        json={"team": "Dispatch", "objective_id": "verify-authority", "action": "independent_verification"},
    ).status_code == 409
    assert client.post(
        f"/api/drills/{drill_id}/resources/move",
        json={"resource_type": "response_units", "quantity": 1, "from_team": "Field Response", "to_team": "Dispatch"},
    ).status_code == 409
    assert client.post(f"/api/drills/{drill_id}/complete").status_code == 409


def test_drill_session_does_not_modify_live_incident_data():
    drill = start_default_drill()
    assert drill["id"].startswith("DRL-")

    # The simulation service owns a separate store and never writes to incidents.
    assert drills.get_drill(drill["id"])["event_history"] == []
    assert "incident_id" not in drills.get_drill(drill["id"])
