from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException

from app.models import (
    ScamAnalyzeRequest,
    ScamAnalyzeResponse,
    ModelRegistryConfig,
    ModelConfigUpdateRequest,
    ModelRollbackRequest,
    BenchmarkEvaluationResponse,
)
from app.services.scam_detection import (
    analyze_transcript,
    get_model_config,
    update_model_config,
    rollback_model,
    evaluate_benchmark,
)

router = APIRouter(prefix="/api/scam", tags=["Digital Arrest Agent"])


@router.post("/analyze", response_model=ScamAnalyzeResponse)
def analyze(payload: ScamAnalyzeRequest):
    result = analyze_transcript(
        transcript=payload.transcript,
        caller_claims_to_be=payload.caller_claims_to_be,
        model_version=payload.model_version,
        context=payload.context,
    )
    return result


@router.get("/models")
def get_models():
    """Retrieve active risk model configuration, available versions, and thresholds."""
    return get_model_config()


@router.post("/models/config")
def update_configuration(payload: ModelConfigUpdateRequest):
    """Update active model version, detection thresholds, or fallback behavior."""
    try:
        thresh = payload.thresholds.model_dump() if payload.thresholds else None
        return update_model_config(
            active_version=payload.active_version,
            thresholds=thresh,
            fallback_enabled=payload.fallback_enabled,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/models/rollback")
def rollback(payload: ModelRollbackRequest):
    """Roll back active model version to baseline or designated target version."""
    try:
        return rollback_model(
            target_version=payload.target_version,
            reason=payload.reason,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/benchmark", response_model=BenchmarkEvaluationResponse)
def run_benchmark(payload: Optional[Dict[str, Any]] = None):
    """Run full evaluation against labeled scam & benign benchmark cases."""
    version = payload.get("model_version") if payload else None
    return evaluate_benchmark(model_version=version)
