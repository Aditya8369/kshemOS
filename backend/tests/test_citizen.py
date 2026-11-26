import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import citizen
from app.routers.citizen import router


# Create an isolated FastAPI application for testing
citizen_app = FastAPI()
citizen_app.include_router(router)

client = TestClient(citizen_app)

ASK_PATH = "/api/citizen/ask"
REPORT_PATH = "/api/citizen/report"

REPORT_PAYLOAD = {
    "reporter_name": "Test Citizen",
    "language": "en",
    "category": "digital_arrest",
    "description": "A caller claiming to be a CBI officer asked me to share my OTP.",
    "region": "Kolkata",
}


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch):
    """Applies only to tests in this file: never use a real Claude key."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture()
def stub_llm(monkeypatch):
    """Replace the Claude call with a deterministic stub and record the prompts."""
    prompts = []

    def fake_ask_claude(system_prompt, prompt, max_tokens=0):
        prompts.append(prompt)
        return "stub answer"

    monkeypatch.setattr(citizen, "ask_claude", fake_ask_claude)
    return prompts


@pytest.fixture()
def stub_storage(monkeypatch):
    """Keep the in-memory report/incident stores untouched by these tests."""
    incident_calls = []

    def fake_save_report(data):
        return "RPT-TEST1"

    def fake_create_incident(**kwargs):
        incident_calls.append(kwargs)
        return {"id": "INC-TEST1"}

    monkeypatch.setattr(citizen, "save_report", fake_save_report)
    monkeypatch.setattr(citizen, "create_incident", fake_create_incident)
    return incident_calls


# ---------- POST /api/citizen/ask ----------


def test_ask_returns_answer(stub_llm):
    response = client.post(
        ASK_PATH,
        json={"question": "Is a call from CBI about my parcel real?", "language": "en"},
    )

    assert response.status_code == 200
    assert response.json() == {"answer": "stub answer"}


def test_ask_prompt_includes_language_and_question(stub_llm):
    client.post(
        ASK_PATH,
        json={"question": "Mera parcel seize ho gaya?", "language": "hi"},
    )

    assert len(stub_llm) == 1
    assert "hi" in stub_llm[0]
    assert "Mera parcel seize ho gaya?" in stub_llm[0]


def test_ask_works_without_api_key_using_fallback():
    # No stub here: exercises the real placeholder fallback.
    response = client.post(
        ASK_PATH,
        json={"question": "What should I do about a scam call?", "language": "en"},
    )

    assert response.status_code == 200
    answer = response.json()["answer"]
    assert isinstance(answer, str)
    assert answer.strip()


def test_ask_rejects_missing_question():
    response = client.post(ASK_PATH, json={"language": "en"})

    assert response.status_code == 422


# ---------- POST /api/citizen/report ----------


def test_report_returns_ids_acknowledgement_and_fir(stub_llm, stub_storage):
    response = client.post(REPORT_PATH, json=REPORT_PAYLOAD)

    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == "RPT-TEST1"
    assert data["incident_id"] == "INC-TEST1"
    assert data["acknowledgement"] == "stub answer"
    assert data["draft_fir"] == "stub answer"


def test_report_opens_incident_from_report(stub_llm, stub_storage):
    client.post(REPORT_PATH, json=REPORT_PAYLOAD)

    assert len(stub_storage) == 1
    call = stub_storage[0]
    assert call["category"] == REPORT_PAYLOAD["category"]
    assert call["description"] == REPORT_PAYLOAD["description"]
    assert call["region"] == REPORT_PAYLOAD["region"]
    assert call["report_id"] == "RPT-TEST1"


def test_report_calls_llm_for_fir_and_acknowledgement(stub_llm, stub_storage):
    client.post(REPORT_PATH, json=REPORT_PAYLOAD)

    # One prompt for the draft FIR, one for the acknowledgement
    assert len(stub_llm) == 2
    assert REPORT_PAYLOAD["reporter_name"] in stub_llm[0]
    assert "RPT-TEST1" in stub_llm[1]


def test_report_without_region_is_accepted(stub_llm, stub_storage):
    payload = {k: v for k, v in REPORT_PAYLOAD.items() if k != "region"}

    response = client.post(REPORT_PATH, json=payload)

    assert response.status_code == 200
    assert stub_storage[0]["region"] is None


def test_report_works_without_api_key_using_fallback(stub_storage):
    # LLM is not stubbed: exercises the real placeholder fallback.
    response = client.post(REPORT_PATH, json=REPORT_PAYLOAD)

    assert response.status_code == 200
    data = response.json()
    assert data["draft_fir"].strip()
    assert data["acknowledgement"].strip()


def test_report_rejects_missing_required_fields():
    response = client.post(REPORT_PATH, json={"reporter_name": "Test Citizen"})

    assert response.status_code == 422