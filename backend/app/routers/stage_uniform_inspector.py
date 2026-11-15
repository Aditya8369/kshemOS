"""
FastAPI Router for Digital Arrest Video Call Stage & Uniform Artifact Inspector.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import (
    StageUniformInspectionRequest,
    StageUniformInspectionResponse,
    UniformRegulationRecord,
    StageInspectionStatsResponse,
)
from app.services.stage_uniform_inspector import (
    default_stage_inspector_service,
)

router = APIRouter(prefix="/api/stage-inspector", tags=["Stage & Uniform Inspector"])


@router.post("/inspect", response_model=StageUniformInspectionResponse)
def inspect_video_call_stage(request: StageUniformInspectionRequest):
    """
    Analyzes an uploaded video call screenshot for synthetic background blur bleeding,
    virtual chroma fringes, perspective warps, and uniform rank insignia violations.
    Automatically preserves the original image and EXIF metadata in the Evidence Vault.
    """
    return default_stage_inspector_service.inspect_stage(request)


@router.get("/regulations", response_model=List[UniformRegulationRecord])
def get_uniform_regulations():
    """Returns official Indian police and federal agency uniform regulation standards."""
    return default_stage_inspector_service.get_regulations()


@router.get("/inspections", response_model=List[StageUniformInspectionResponse])
def list_inspections():
    """Lists recent video call stage inspections with forensic verdicts."""
    return default_stage_inspector_service.list_inspections()


@router.get("/inspections/{inspection_id}", response_model=StageUniformInspectionResponse)
def get_inspection_detail(inspection_id: str):
    """Retrieves full visual forensic inspection report and vaulted evidence pointers."""
    res = default_stage_inspector_service.get_inspection(inspection_id)
    if not res:
        raise HTTPException(status_code=404, detail=f"Inspection '{inspection_id}' not found")
    return res


@router.get("/stats", response_model=StageInspectionStatsResponse)
def get_inspection_statistics():
    """Returns aggregate visual stage forgery statistics and Evidence Vault counts."""
    return default_stage_inspector_service.get_stats()

