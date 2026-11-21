"""
FastAPI Router for Privacy-Preserving Regional Threat Broadcast & Micro-Advisory Mesh.
Prefix: /api/threat-mesh
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path

from app.models import (
    AdvisoryBroadcastCreateRequest,
    CitizenMeshAdvisoryQuery,
    CommanderSignoffRequest,
    RegionalMicroAdvisory,
    RegionalThreatCluster,
    RegionalThreatMeshStats,
)
from app.services import regional_threat_mesh

router = APIRouter(prefix="/api/threat-mesh", tags=["Regional Threat Mesh"])


@router.get("/clusters", response_model=List[RegionalThreatCluster])
def list_threat_clusters_endpoint():
    """
    Returns active localized threat clusters aggregated by service area and scam type (3+ reports within 24h).
    Zero PII is revealed.
    """
    return regional_threat_mesh.list_clusters()


@router.get("/clusters/{cluster_id}", response_model=RegionalThreatCluster)
def get_threat_cluster_endpoint(
    cluster_id: str = Path(..., description="Unique cluster identifier e.g. CLUST-SA-NORTH-01-electricity_bill_scam"),
):
    """
    Returns granular cluster data and k-anonymized complaint counts.
    """
    cluster = regional_threat_mesh.get_cluster(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Threat cluster {cluster_id} not found.")
    return cluster


@router.get("/advisories", response_model=List[RegionalMicroAdvisory])
def list_micro_advisories_endpoint(
    status: Optional[str] = None,
):
    """
    Returns list of localized micro-advisories, optionally filtered by status
    (DRAFTED_PENDING_APPROVAL, PUBLISHED_ACTIVE, DISMISSED, EXPIRED).
    """
    return regional_threat_mesh.list_micro_advisories(status=status)


@router.get("/advisories/{advisory_id}", response_model=RegionalMicroAdvisory)
def get_micro_advisory_endpoint(
    advisory_id: str = Path(..., description="Micro-advisory identifier"),
):
    """
    Returns specific micro-advisory draft or published alert details.
    """
    adv = regional_threat_mesh.get_micro_advisory(advisory_id)
    if not adv:
        raise HTTPException(status_code=404, detail=f"Micro-advisory {advisory_id} not found.")
    return adv


@router.post("/broadcast-advisories", response_model=RegionalMicroAdvisory)
def create_broadcast_advisory_endpoint(
    payload: AdvisoryBroadcastCreateRequest,
):
    """
    Accepts GeoJSON polygon coordinates in AdvisoryBroadcastCreateRequest,
    validates vertex limits (min 3, max 500 vertices) and coordinate bounds,
    and drafts a multi-zone micro-advisory targeting affected postal sectors.
    """
    polygon = payload.polygon_geojson
    if not isinstance(polygon, dict) or polygon.get("type") != "Polygon":
        raise HTTPException(
            status_code=400,
            detail="Invalid GeoJSON geometry: 'type' must be 'Polygon'.",
        )

    coords = polygon.get("coordinates")
    if not coords or not isinstance(coords, list):
        raise HTTPException(
            status_code=400,
            detail="Invalid GeoJSON: 'coordinates' array required.",
        )

    ring = coords[0] if isinstance(coords[0], list) and len(coords[0]) > 0 and isinstance(coords[0][0], (list, tuple)) else coords

    # Distinct vertex count check
    vertex_count = len(ring)
    if vertex_count >= 4 and ring[0] == ring[-1]:
        distinct_count = vertex_count - 1
    else:
        distinct_count = vertex_count

    if distinct_count < 3:
        raise HTTPException(
            status_code=400,
            detail="Polygon boundary must contain at least 3 distinct vertices.",
        )

    if distinct_count > 500:
        raise HTTPException(
            status_code=400,
            detail=f"Polygon exceeds maximum allowed vertex limit of 500 (has {distinct_count} vertices).",
        )

    # Validate coordinate values
    for pt in ring:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            raise HTTPException(
                status_code=400,
                detail="Invalid coordinate element format in polygon. Expected [lng, lat].",
            )
        try:
            lng, lat = float(pt[0]), float(pt[1])
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid numeric coordinate value in polygon: {pt}",
            )
        if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
            raise HTTPException(
                status_code=400,
                detail=f"Coordinate [{lng}, {lat}] is out of geographic bounds (lng must be [-180, 180], lat must be [-90, 90]).",
            )

    try:
        return regional_threat_mesh.create_polygon_broadcast_advisory(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create broadcast advisory: {str(e)}")


@router.post("/advisories/{advisory_id}/signoff", response_model=RegionalMicroAdvisory)
def commander_signoff_endpoint(
    advisory_id: str = Path(..., description="Micro-advisory identifier"),
    payload: CommanderSignoffRequest = ...,
):
    """
    Commander single-click sign-off workflow:
    Authorizes publication of the drafted micro-advisory to the citizen portal banner,
    or dismisses the alert.
    """
    signed = regional_threat_mesh.signoff_micro_advisory(advisory_id, payload)
    if not signed:
        raise HTTPException(status_code=404, detail=f"Micro-advisory {advisory_id} not found.")
    return signed


@router.post("/portal-banner")
def query_citizen_portal_mesh_banner_endpoint(
    query: CitizenMeshAdvisoryQuery,
):
    """
    Strict Geofenced Boundary Query:
    Returns the active published micro-advisory banner ONLY if the citizen's postal pin code,
    service area, or coordinates fall within the affected jurisdiction boundary.
    Advisories are withheld outside the geofence to prevent panic.
    """
    banner = regional_threat_mesh.query_citizen_portal_mesh_banner(query)
    return {"banner": banner}


@router.post("/ingest-report")
def ingest_citizen_report_endpoint(
    pincode: str,
    scam_category: str,
    service_area_id: Optional[str] = None,
):
    """
    Ingests verified citizen report into the regional threat mesh.
    Automatically generates a draft micro-advisory if 3+ complaints occur within 24h.
    """
    anon_ref, adv = regional_threat_mesh.ingest_verified_citizen_report(
        pincode=pincode,
        scam_category=scam_category,
        service_area_id=service_area_id,
    )
    return {
        "status": "ingested",
        "anonymized_reference": anon_ref,
        "advisory_triggered": adv is not None,
        "advisory": adv,
    }


@router.get("/stats", response_model=RegionalThreatMeshStats)
def get_threat_mesh_stats_endpoint():
    """
    Returns aggregated metrics: active clusters, pending commander drafts, published advisories,
    and covered postal pin codes.
    """
    return regional_threat_mesh.get_mesh_stats()

