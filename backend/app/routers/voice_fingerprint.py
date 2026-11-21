"""
FastAPI Router for Acoustic Syndicate Voiceprint Fingerprinting.
Prefix: /api/voice-fingerprint
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Path, Query

from app.models import (
    VoiceprintFeatureExtractRequest,
    VoiceprintFeatureExtractResponse,
    VoiceprintMatchRequest,
    VoiceprintMatchResponse,
    VoiceClusterNodeResponse,
)
from app.services import voice_fingerprint

router = APIRouter(prefix="/api/voice-fingerprint", tags=["Acoustic Syndicate Voiceprint Fingerprinting"])


@router.post("/extract", response_model=VoiceprintFeatureExtractResponse)
def extract_voiceprint_features_endpoint(payload: VoiceprintFeatureExtractRequest):
    """
    Extracts a 128-dimensional unit-normalized acoustic embedding from speech audio
    using mel-filterbanks, spectral moments, F0 pitch jitter/shimmer, and formant ratios.
    """
    try:
        audio_input = payload.audio_base64 or payload.caller_phone or "SAMPLE_SPEAKER_WAVEFORM"
        res = voice_fingerprint.extract_128d_voiceprint_embedding(
            audio_input, sample_rate=payload.sample_rate
        )
        return VoiceprintFeatureExtractResponse(
            embedding_dimension=128,
            acoustic_embedding=res["embedding"],
            l2_norm=res["l2_norm"],
            duration_seconds=res["duration_seconds"],
            spectral_centroid_hz=res["spectral_centroid_hz"],
            pitch_f0_median_hz=res["pitch_f0_median_hz"],
            jitter_local=res["jitter_local"],
            shimmer_local=res["shimmer_local"],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice feature extraction failed: {exc}")


@router.post("/match", response_model=VoiceprintMatchResponse)
def match_voiceprint_endpoint(payload: VoiceprintMatchRequest):
    """
    Matches a caller's 128-dimensional acoustic embedding against the vector index
    using Cosine Similarity:
    - Match threshold >= 0.85: Flags as SAME_CALLER_SYNDICATE_OPERATOR.
    - Automatically creates a VOICE_CLUSTER node in fraud_graph.py linking disparate
      phone numbers, bank accounts, and geographic locations.
    """
    try:
        # Determine embedding
        if payload.embedding and len(payload.embedding) == 128:
            emb = payload.embedding
        elif payload.audio_base64:
            res = voice_fingerprint.extract_128d_voiceprint_embedding(payload.audio_base64)
            emb = res["embedding"]
        elif payload.caller_phone:
            # Deterministic speaker simulation from phone
            res = voice_fingerprint.extract_128d_voiceprint_embedding(payload.caller_phone)
            emb = res["embedding"]
        else:
            res = voice_fingerprint.extract_128d_voiceprint_embedding("OPERATOR_VIKRAM_DCP_RATHORE_SEED")
            emb = res["embedding"]

        return voice_fingerprint.match_voiceprint_vector(
            embedding=emb,
            threshold=payload.threshold,
            caller_phone=payload.caller_phone,
            incident_id=payload.incident_id,
            bank_account=payload.bank_account,
            location=payload.location,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voiceprint matching failed: {exc}")


@router.get("/clusters", response_model=List[VoiceClusterNodeResponse])
def get_voice_clusters_endpoint():
    """
    Returns all syndicate voice clusters cross-linked into the KshemOS Fraud Graph.
    """
    return voice_fingerprint.get_all_voice_clusters()


@router.get("/incidents/{incident_id}")
def get_incident_voice_alert_endpoint(
    incident_id: str = Path(..., description="Incident tracking ID"),
):
    """
    Returns repeat syndicate speaker forensic alert details for an incident feed card.
    """
    alert = voice_fingerprint.get_incident_voiceprint_alert(incident_id)
    if not alert:
        return {"is_repeat_speaker": False, "incident_id": incident_id}
    return alert
