"""
Unit and Integration Tests for Digital Arrest Video Call Stage & Uniform Artifact Inspector.
Directly invokes service and router functions to avoid AnyIO portal cleanup delays on Windows.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from app.routers import stage_uniform_inspector as stage_router
from app.services.stage_uniform_inspector import (
    default_stage_inspector_service,
    StageUniformInspectorService,
    STATUTORY_BNSS_NOTICE,
    INDIAN_UNIFORM_REGULATIONS,
)
from app.models import (
    StageUniformInspectionRequest,
)


@pytest.fixture(autouse=True)
def clean_stage_inspector_state():
    default_stage_inspector_service.inspections.clear()
    yield
    default_stage_inspector_service.inspections.clear()


def test_uniform_regulations_database():
    regs = stage_router.get_uniform_regulations()
    assert len(regs) >= 6

    agency_ids = [r.agency_id for r in regs]
    assert "CBI" in agency_ids
    assert "DELHI_POLICE" in agency_ids
    assert "MUMBAI_POLICE" in agency_ids
    assert "CUSTOMS" in agency_ids
    assert "SUPREME_COURT" in agency_ids
    assert "ED" in agency_ids

    # Verify CBI civilian requirement
    cbi = next(r for r in regs if r.agency_id == "CBI")
    assert "Civilian business formal attire" in cbi.authorized_attire
    assert "NEVER wear police khaki tunics" in cbi.authorized_attire


def test_inspect_cbi_digital_arrest_stage_forgery():
    service = StageUniformInspectorService()

    fake_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    request = StageUniformInspectionRequest(
        image_data=fake_image_base64,
        file_name="fake_cbi_call_screenshot.png",
        claimed_agency="CBI",
        claimed_officer_name="Inspector R. K. Sharma",
        case_id="CASE-2026-DEL-01",
        save_to_evidence_vault=True,
    )

    res = service.inspect_stage(request)

    assert res.inspection_id.startswith("STAGE-INSP-")
    assert res.is_synthetic_stage is True
    assert res.stage_forgery_score >= 0.70
    assert res.risk_verdict == "CRITICAL_FORGERY_DETECTED"
    assert len(res.image_sha256) == 64

    # Verify detected hallmarks
    hallmark_types = [h.hallmark_type for h in res.detected_hallmarks]
    assert "virtual_chroma_fringe" in hallmark_types
    assert "perspective_warp" in hallmark_types
    assert "synthetic_blur_bleeding" in hallmark_types
    assert "improper_agency_uniform" in hallmark_types
    assert "non_standard_stars" in hallmark_types

    # Verify uniform evaluation
    assert res.uniform_evaluation.uniform_matches_agency is False
    assert res.uniform_evaluation.insignia_validity == "forged"
    assert any("does not utilize police khaki uniforms" in d for d in res.uniform_evaluation.discrepancies)

    # Verify statutory BNSS notice
    assert res.statutory_bnss_notice == STATUTORY_BNSS_NOTICE
    assert "Bharatiya Nagarik Suraksha Sanhita (BNSS)" in res.statutory_bnss_notice
    assert "no court, police officer, or CBI official is authorized to place anyone under arrest" in res.statutory_bnss_notice

    # Verify Evidence Vault auto-preservation
    assert res.vaulted_evidence_id is not None
    assert res.vaulted_evidence_id.startswith("EVID-")


def test_inspect_mumbai_police_collar_stars_discrepancy():
    req = StageUniformInspectionRequest(
        image_data="EVIDENCE_RAW_IMAGE_BYTE_STREAM_MUMBAI_DCP_FAKE",
        file_name="mumbai_dcp_call.png",
        claimed_agency="Mumbai Police",
        save_to_evidence_vault=True,
    )
    res = stage_router.inspect_video_call_stage(req)

    assert res.is_synthetic_stage is True
    assert res.risk_verdict in ("CRITICAL_FORGERY_DETECTED", "HIGH_RISK_STAGE")
    assert res.uniform_evaluation.claimed_agency == "Mumbai Police / Maharashtra State Police"

    # Verify non-standard collar rank stars hallmark
    star_hallmark = next((h for h in res.detected_hallmarks if h.hallmark_type == "non_standard_stars"), None)
    assert star_hallmark is not None
    assert "collar" in star_hallmark.description.lower()

    # Check statutory notice
    assert STATUTORY_BNSS_NOTICE in res.statutory_bnss_notice


def test_exif_metadata_extraction():
    service = StageUniformInspectorService()
    # Simulated byte stream with OBS virtual camera tag
    fake_obs_bytes = b"\xff\xd8\xff\xe100Exif0000SomeDataOBS Studio VirtualCam Stream"

    req = StageUniformInspectionRequest(
        image_data=fake_obs_bytes.decode("latin-1"),
        file_name="obs_virtual_cam.jpg",
        claimed_agency="Delhi Police",
        save_to_evidence_vault=False,
    )
    res = service.inspect_stage(req)

    assert res.exif_metadata["has_exif_tags"] is True
    assert "OBS" in res.exif_metadata["software_environment"]
    assert res.exif_metadata["synthetic_camera_flag"] is True
    assert res.vaulted_evidence_id is None  # Since save_to_evidence_vault was False


def test_list_inspections_and_stats():
    req1 = StageUniformInspectionRequest(
        image_data="IMAGE_1",
        file_name="call_1.png",
        claimed_agency="CBI",
    )
    req2 = StageUniformInspectionRequest(
        image_data="IMAGE_2",
        file_name="call_2.png",
        claimed_agency="Customs",
    )
    stage_router.inspect_video_call_stage(req1)
    stage_router.inspect_video_call_stage(req2)

    inspections = stage_router.list_inspections()
    assert len(inspections) == 2

    # Get single inspection
    detail = stage_router.get_inspection_detail(inspections[0].inspection_id)
    assert detail.inspection_id == inspections[0].inspection_id

    # Get stats
    stats = stage_router.get_inspection_statistics()
    assert stats.total_inspected == 2
    assert stats.critical_forgeries_detected >= 1
    assert stats.vault_evidence_preserved == 2


def test_non_existent_inspection_404():
    with pytest.raises(Exception):
        stage_router.get_inspection_detail("STAGE-INSP-NON-EXISTENT")


def test_screen_recapture_prnu_and_fft_moire_detection():
    """Verify 2D FFT spatial frequency and multi-camera sensor PRNU screen recapture detection."""
    service = StageUniformInspectorService()

    # Recaptured LCD monitor screenshot request
    req = StageUniformInspectionRequest(
        image_data="RAW_IMAGE_STREAM_LCD_MONITOR_RECAPTURE_MOIRE_LATTICE_SPECULAR_GLINT",
        file_name="lcd_screen_recapture_call.png",
        claimed_agency="CBI",
        claimed_officer_name="Inspector R. K. Sharma",
        save_to_evidence_vault=True,
    )

    res = service.inspect_stage(req)

    # Validate scoring breakdown signals
    assert res.screen_recapture_detected is True
    assert res.moire_frequency_index >= 0.60
    assert res.edge_glint_score >= 0.50
    assert res.confidence_rating == "HIGH_PROBABILITY_RECAPTURE"

    # Validate analysis payload & explanation
    analysis = res.screen_recapture_analysis
    assert analysis is not None
    assert analysis.screen_recapture_detected is True
    assert "Lattice pattern detected: This image appears to be a photograph of an LCD monitor." in analysis.recapture_explanation
    assert analysis.bezel_detected is True
    assert analysis.specular_glare_detected is True
    assert analysis.color_temp_discrepancy > 0.0

    # Validate 8x8 heatmap grid and cluster coordinates
    assert len(analysis.heatmap_grid) == 8
    assert all(len(row) == 8 for row in analysis.heatmap_grid)
    assert len(analysis.moire_clusters) > 0

    # Validate hallmark injection
    recapture_hallmark = next((h for h in res.detected_hallmarks if h.hallmark_type == "screen_recapture_moire"), None)
    assert recapture_hallmark is not None
    assert "Lattice pattern detected" in recapture_hallmark.description
    assert recapture_hallmark.severity in ("critical", "high")


