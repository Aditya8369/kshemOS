"""
FastAPI Router for Voice Deepfake & Synthetic Audio Impersonation Detector.
Prefix: /api/voice-deepfake
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Path

from app.models import (
    VoiceDeepfakeInspectionRequest,
    VoiceDeepfakeInspectionResponse,
    VoiceDeepfakeStatsResponse,
)
from app.services import voice_deepfake_detector

router = APIRouter(prefix="/api/voice-deepfake", tags=["Voice Deepfake Detector"])


@router.post("/analyze", response_model=VoiceDeepfakeInspectionResponse)
def analyze_voice_recording_endpoint(payload: VoiceDeepfakeInspectionRequest):
    """
    Evaluates uploaded voice recordings (.wav, .mp3, .m4a) for synthetic artifacts,
    measuring spectral continuity, harmonic irregularities, pitch stability (jitter/shimmer),
    and vocoder footprints.
    Outputs explainable probability score and highlights anomaly spans in interactive waveform.
    Provides immediate tactical citizen guidance.
    """
    try:
        return voice_deepfake_detector.analyze_voice_recording(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice deepfake analysis error: {exc}")


@router.get("/inspections", response_model=List[VoiceDeepfakeInspectionResponse])
def list_voice_deepfake_inspections_endpoint(
    risk_band: Optional[str] = None,
    limit: int = 50,
):
    """
    Returns history of voice deepfake inspections, optionally filtered by risk_band.
    """
    return voice_deepfake_detector.list_inspections(risk_band=risk_band, limit=limit)


@router.get("/inspections/{inspection_id}", response_model=VoiceDeepfakeInspectionResponse)
def get_voice_deepfake_inspection_endpoint(
    inspection_id: str = Path(..., description="Unique inspection identifier e.g. VDF-2026-1001"),
):
    """
    Retrieve full acoustic inspection details, anomaly spans, and vault status for a specific audio sample.
    """
    result = voice_deepfake_detector.get_inspection(inspection_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Voice deepfake inspection {inspection_id} not found.")
    return result


@router.get("/stats", response_model=VoiceDeepfakeStatsResponse)
def get_voice_deepfake_stats_endpoint():
    """
    Aggregated operational statistics: total recordings analyzed, high probability deepfakes detected,
    suspicious samples flagged, natural audio confirmed, and vault preservations.
    """
    return voice_deepfake_detector.get_stats()

