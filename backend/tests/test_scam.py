
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.scam import router


# Create an isolated FastAPI application for testing
test_app = FastAPI()
test_app.include_router(router)

client = TestClient(test_app)

API_PATH = "/api/scam/analyze"
MODEL_V2 = "v2.0-calibrated-ensemble"


def test_analyze_returns_valid_response_for_suspicious_transcript():
    transcript = (
        "CBI police are investigating a narcotics parcel. "
        "You must transfer the verification amount immediately today. "
        "Do not disconnect this video call or inform your family. "
        "Send the money to this safe account and share your OTP."
    )

    response = client.post(
        API_PATH,
        json={
            "transcript": transcript,
            "model_version": MODEL_V2,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert 0 <= data["risk_score"] <= 100
    assert data["risk_band"] in {
        "low", "medium", "high", "critical", "inconclusive"
    }
    assert 0 <= data["confidence"] <= 1
    assert isinstance(data["matched_patterns"], list)
    assert len(data["matched_patterns"]) > 0
    assert isinstance(data["recommendation"], str)
    assert isinstance(data["explanation"], str)
    assert data["is_inconclusive"] is False


def test_analyze_returns_valid_response_for_benign_transcript():
    transcript = (
        "Hello, I am calling to confirm your appointment for tomorrow. "
        "Please arrive at ten in the morning and bring your prescription."
    )

    response = client.post(
        API_PATH,
        json={
            "transcript": transcript,
            "model_version": MODEL_V2,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert 0 <= data["risk_score"] <= 100
    assert data["risk_band"] in {
        "low", "medium", "high", "critical", "inconclusive"
    }
    assert isinstance(data["matched_patterns"], list)


def test_analyze_marks_sparse_transcript_as_inconclusive():
    response = client.post(
        API_PATH,
        json={
            "transcript": "Hello",
            "model_version": MODEL_V2,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["risk_band"] == "inconclusive"
    assert data["risk_score"] == 0
    assert data["is_inconclusive"] is True
    assert data["inconclusive_reason"] is not None


def test_analyze_rejects_missing_transcript():
    response = client.post(
        API_PATH,
        json={
            "model_version": MODEL_V2,
        },
    )

    assert response.status_code == 422


def test_analyze_rejects_non_string_transcript():
    response = client.post(
        API_PATH,
        json={
            "transcript": 12345,
            "model_version": MODEL_V2,
        },
    )

    assert response.status_code == 422


def test_analyze_includes_context_risk_signal():
    transcript = (
        "I am calling to discuss your account statement and recent "
        "account activity. Please review the information through "
        "your usual official channel."
    )

    response = client.post(
        API_PATH,
        json={
            "transcript": transcript,
            "caller_claims_to_be": "CBI officer",
            "context": {
                "channel": "video_call",
                "time_of_day": "night",
            },
            "model_version": MODEL_V2,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["contributing_signals"]["call_context"] == 0.95
