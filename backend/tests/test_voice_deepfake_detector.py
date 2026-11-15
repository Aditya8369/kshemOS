"""
Unit tests for Voice Deepfake & Synthetic Audio Impersonation Detector.
Validates acoustic metric calculation (jitter, shimmer, HNR, vocoder footprints),
anomaly span extraction, tactical guidance directives, and Evidence Vault integration.
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException

from app.models import VoiceDeepfakeInspectionRequest
from app.routers import voice_deepfake as router_endpoints
from app.services import evidence, voice_deepfake_detector


@pytest.fixture(autouse=True)
def reset_service():
    voice_deepfake_detector.reset_store()
    voice_deepfake_detector.seed_default_inspections()
    yield


def test_detect_high_probability_synthetic_elevenlabs():
    req = VoiceDeepfakeInspectionRequest(
        audio_data="synthetic_elevenlabs_clone_grandson_kidnapping_extortion_audio_stream_sample",
        file_name="grandson_kidnapping_extortion_elevenlabs.wav",
        duration_seconds=7.5,
        case_id="CASE-2026-NCR-VOICE-01",
        caller_claimed_identity="Grandson (Aarav)",
        scam_context="Emergency Bail Kidnapping Extortion",
        save_to_evidence_vault=True,
        officer_badge_id="OFF-DELHI-104",
    )

    result = voice_deepfake_detector.analyze_voice_recording(req)

    assert result.inspection_id.startswith("VDF-2026-")
    assert result.risk_band == "HIGH_PROBABILITY_SYNTHETIC"
    assert result.synthetic_probability_score >= 0.70
    assert result.duration_seconds == 7.5
    assert len(result.file_sha256) == 64

    # Verify acoustic metrics
    metrics = result.spectral_metrics
    assert metrics.jitter_pct < 0.25  # Robotic pitch flatlining
    assert metrics.shimmer_pct < 1.0  # Abnormally static amplitude perturbation
    assert metrics.vocoder_footprint_score >= 0.85
    assert metrics.pitch_stability_index >= 0.90

    # Verify explainable anomaly spans
    anomaly_types = [span.anomaly_type for span in result.anomaly_spans]
    assert "PITCH_FREEZE_FLATLINING" in anomaly_types
    assert "VOCODER_HIGH_FREQ_SMEARING" in anomaly_types
    assert "ABSENCE_OF_PHYSIOLOGICAL_RESPIRATION" in anomaly_types

    # Verify exact mandatory tactical guidance
    assert (
        result.tactical_guidance
        == "Perform a reverse verification call on a trusted family phone number."
    )
    assert len(result.tactical_checklist) >= 4
    assert any("passphrase" in tip.lower() for tip in result.tactical_checklist)
    assert any("1930" in tip for tip in result.tactical_checklist)

    # Verify Evidence Vaulting
    assert result.vaulted_evidence_id is not None
    vault_item = evidence.get_evidence(result.vaulted_evidence_id)
    assert vault_item is not None
    assert vault_item["legal_hold"] is True
    assert vault_item["category"] == "digital_arrest"
    assert vault_item["evidence_type"] == "voice_recording"


def test_detect_natural_organic_voice_note():
    req = VoiceDeepfakeInspectionRequest(
        audio_data="natural_organic_family_voicenote_greeting_authentic_voice_recording",
        file_name="family_greeting_note_genuine.m4a",
        duration_seconds=5.0,
        case_id="CASE-2026-VERIFY-03",
        caller_claimed_identity="Mother (Kavita)",
        scam_context="Family Voice Check",
        save_to_evidence_vault=True,
    )

    result = voice_deepfake_detector.analyze_voice_recording(req)

    assert result.risk_band == "LOW_PROBABILITY_NATURAL"
    assert result.synthetic_probability_score < 0.40

    # Verify normal organic vocal fold micro-tremors
    metrics = result.spectral_metrics
    assert 0.5 <= metrics.jitter_pct <= 1.2
    assert 1.5 <= metrics.shimmer_pct <= 3.8
    assert metrics.vocoder_footprint_score < 0.20

    # Verify spans contain biological indicators
    anomaly_types = [span.anomaly_type for span in result.anomaly_spans]
    assert "NATURAL_PHYSIOLOGICAL_MICRO_TREMOR" in anomaly_types
    assert "BIOLOGICAL_INHALATION_DETECTED" in anomaly_types


def test_detect_suspicious_borderline_audio():
    # Audio with moderate entropy
    mock_payload = "medium_entropy_suspicious_audio_sample_borderline_compression_012345"
    req = VoiceDeepfakeInspectionRequest(
        audio_data=mock_payload,
        file_name="suspicious_call_fragment.mp3",
        duration_seconds=4.0,
    )

    result = voice_deepfake_detector.analyze_voice_recording(req)

    assert result.risk_band in ["SUSPICIOUS", "HIGH_PROBABILITY_SYNTHETIC"]
    assert result.synthetic_probability_score >= 0.40
    assert result.tactical_guidance == voice_deepfake_detector.TACTICAL_CITIZEN_GUIDANCE


def test_statutory_tactical_guidance_exact_constant():
    expected_guidance = "Perform a reverse verification call on a trusted family phone number."
    assert voice_deepfake_detector.TACTICAL_CITIZEN_GUIDANCE == expected_guidance


def test_router_endpoints_and_history():
    # Test analyze endpoint
    req = VoiceDeepfakeInspectionRequest(
        audio_data="synthetic_fake_police_arrest_summons_recording",
        file_name="fake_police_summons.wav",
        duration_seconds=6.0,
        caller_claimed_identity="Delhi Police Inspector",
    )
    analyzed = router_endpoints.analyze_voice_recording_endpoint(req)
    assert analyzed.risk_band == "HIGH_PROBABILITY_SYNTHETIC"

    # Test get by ID
    fetched = router_endpoints.get_voice_deepfake_inspection_endpoint(analyzed.inspection_id)
    assert fetched.inspection_id == analyzed.inspection_id
    assert fetched.file_name == "fake_police_summons.wav"

    # Test list endpoint
    inspections = router_endpoints.list_voice_deepfake_inspections_endpoint()
    assert len(inspections) >= 3

    # Test stats endpoint
    stats = router_endpoints.get_voice_deepfake_stats_endpoint()
    assert stats.total_evaluated >= 3
    assert stats.high_synthetic_detected >= 1
    assert stats.natural_confirmed >= 1

    # Test 404 for invalid ID
    with pytest.raises(HTTPException) as excinfo:
        router_endpoints.get_voice_deepfake_inspection_endpoint("VDF-NONEXISTENT")
    assert excinfo.value.status_code == 404

