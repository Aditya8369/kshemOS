"""
FastAPI Router for Voice Deepfake & Synthetic Audio Impersonation Detector.
Prefix: /api/voice-deepfake
"""

from __future__ import annotations

import base64
import json
import time
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Path, WebSocket, WebSocketDisconnect, status

from app.models import (
    VoiceDeepfakeInspectionRequest,
    VoiceDeepfakeInspectionResponse,
    VoiceDeepfakeStatsResponse,
)
from app.services import voice_deepfake, voice_deepfake_detector

router = APIRouter(prefix="/api/voice-deepfake", tags=["Voice Deepfake Detector"])


@router.websocket("/stream")
async def voice_deepfake_websocket_stream(websocket: WebSocket):
    """
    Real-Time WebSocket Ingestion Endpoint (/api/voice-deepfake/stream).
    Accepts binary 16 kHz mono PCM chunks, maintains a rolling 3-second sliding window buffer,
    and streams structured JSON telemetry:
    { "synthetic_prob": 0.88, "jitter_anomaly": true, "spectral_flux": 0.72, ... }
    """
    await websocket.accept()
    stream_buffer = voice_deepfake.RollingPcmStreamBuffer(max_seconds=3.0, sample_rate=16000)

    try:
        # Handshake frame
        await websocket.send_json({
            "type": "connection_status",
            "status": "connected",
            "sample_rate": 16000,
            "buffer_window_sec": 3.0,
            "message": "KshemOS Voice Deepfake Streaming Engine ready for 16 kHz mono PCM chunks.",
        })

        while True:
            message = await websocket.receive()

            if "bytes" in message and message["bytes"]:
                pcm_bytes = message["bytes"]
                current_samples = stream_buffer.append_pcm_bytes(pcm_bytes)

                # Extract Short-Time Fourier Transform (STFT), pitch jitter/shimmer,
                # and harmonic-to-noise ratio (HNR) on each buffer slide
                telemetry = voice_deepfake.extract_streaming_acoustic_telemetry(
                    samples=current_samples,
                    sample_rate=16000,
                    include_waveform=True,
                )
                await websocket.send_json(telemetry)

            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    action = payload.get("action")
                    if action == "reset":
                        stream_buffer.reset()
                        await websocket.send_json({
                            "type": "control",
                            "action": "reset_confirmed",
                            "buffer_duration_sec": 0.0,
                        })
                    elif action == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp_ms": int(time.time() * 1000),
                        })
                    elif "audio_b64" in payload:
                        raw_bytes = base64.b64decode(payload["audio_b64"])
                        current_samples = stream_buffer.append_pcm_bytes(raw_bytes)
                        telemetry = voice_deepfake.extract_streaming_acoustic_telemetry(
                            samples=current_samples,
                            sample_rate=16000,
                            include_waveform=True,
                        )
                        await websocket.send_json(telemetry)
                except Exception as exc:
                    await websocket.send_json({
                        "type": "error",
                        "error": f"Failed to parse control message: {str(exc)}",
                    })
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass


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

