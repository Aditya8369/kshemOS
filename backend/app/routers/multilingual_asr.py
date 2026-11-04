from fastapi import APIRouter, HTTPException, status
from typing import List

from app.models import (
    SpeechTurn,
    ASRProviderInfo,
    ASRTranscribeRequest,
    ASRCorrectionRequest,
    MultilingualScamAnalyzeRequest,
    MultilingualScamAnalyzeResponse,
)
from app.services import multilingual_asr

router = APIRouter(prefix="/api/v1/asr", tags=["Multilingual Speech & Regional ASR"])


@router.get("/providers", response_model=List[ASRProviderInfo])
def get_providers():
    """
    Returns available ASR providers and their supported regional Indian languages.
    """
    return multilingual_asr.ASR_PROVIDERS


@router.get("/samples")
def get_samples():
    """
    Returns pre-configured multilingual Indic code-switched call samples.
    """
    return {"samples": multilingual_asr.MULTILINGUAL_SAMPLES}


@router.post("/transcribe", response_model=SpeechTurn, status_code=status.HTTP_201_CREATED)
def transcribe(payload: ASRTranscribeRequest):
    """
    Transcribes audio or text input with the selected ASR provider,
    computes word-level confidences, marks low-confidence tokens,
    and identifies regional code-switching segments.
    """
    try:
        turn = multilingual_asr.transcribe_speech(
            provider=payload.provider,
            sample_id=payload.sample_id,
            text_input=payload.text_input,
            audio_payload=payload.audio_payload,
            target_language=payload.target_language,
            speaker=payload.speaker,
            enable_code_switching=payload.enable_code_switching,
            confidence_threshold=payload.confidence_threshold,
        )
        return turn
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/correct", response_model=SpeechTurn)
def correct_turn(payload: ASRCorrectionRequest):
    """
    Applies citizen corrections to low-confidence or mistranscribed words
    without mutating or overwriting the original raw ASR output.
    """
    try:
        updated_turn = multilingual_asr.apply_citizen_corrections(
            turn_id=payload.turn_id,
            word_corrections=payload.word_corrections,
            full_corrected_text=payload.full_corrected_text,
        )
        return updated_turn
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/analyze-scam", response_model=MultilingualScamAnalyzeResponse)
def analyze_scam(payload: MultilingualScamAnalyzeRequest):
    """
    Evaluates the citizen-corrected or original transcript for Indic / code-switched
    scam threats, preserving the immutable original ASR text for court-admissible audit.
    """
    return multilingual_asr.analyze_multilingual_scam(
        text_to_analyze=payload.text_to_analyze,
        original_asr_text=payload.original_asr_text,
        language=payload.language,
        caller_claims_to_be=payload.caller_claims_to_be,
        turn_id=payload.turn_id,
    )


@router.get("/turns/{turn_id}", response_model=SpeechTurn)
def get_turn(turn_id: str):
    """
    Retrieves an individual speech turn record with original and corrected text.
    """
    try:
        return multilingual_asr.get_turn(turn_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
