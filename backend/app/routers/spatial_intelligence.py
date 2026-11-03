"""
FastAPI Router for Real-Time Threat Heatmap & Predictive Spatial Intelligence.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import (
    CitizenMicroAdvisoryRequest,
    CitizenMicroAdvisoryResponse,
    FinancialPOI,
    MigrationVector,
    PatrolDispatchRecommendation,
    SpatialIncident,
    ThreatCluster,
    ThreatHeatmapResponse,
)
from app.services import spatial_intelligence as service

router = APIRouter(prefix="/api/spatial", tags=["Predictive Spatial Intelligence & Threat Heatmap"])


@router.get("/heatmap", response_model=ThreatHeatmapResponse)
def get_threat_heatmap():
    """Retrieve full geospatial heatmap with clusters, migration vectors, and patrol points."""
    return service.get_threat_heatmap_data()


@router.get("/clusters", response_model=list[ThreatCluster])
def list_threat_clusters():
    """Retrieve active spatial density clusters."""
    return service.run_spatial_clustering()


@router.get("/migration-vectors", response_model=list[MigrationVector])
def list_migration_vectors():
    """Retrieve velocity and migration vectors for active clusters."""
    clusters = service.run_spatial_clustering()
    return service.calculate_migration_vectors(clusters)


@router.get("/patrol-recommendations", response_model=list[PatrolDispatchRecommendation])
def list_patrol_recommendations():
    """Retrieve AI-suggested preventative patrol dispatch waypoints."""
    clusters = service.run_spatial_clustering()
    vectors = service.calculate_migration_vectors(clusters)
    return service.generate_smart_patrol_recommendations(clusters, vectors)


@router.get("/financial-pois", response_model=list[FinancialPOI])
def list_financial_pois():
    """Retrieve vulnerable ATM locations and bank branch infrastructure."""
    return service.get_threat_heatmap_data()["financial_pois"]


@router.post("/incidents", status_code=201)
def add_spatial_incident(payload: dict[str, Any]):
    """Ingest a confirmed citizen report or fraud event into the spatial engine."""
    return service.add_spatial_incident(payload)


@router.post("/micro-advisory", response_model=CitizenMicroAdvisoryResponse)
def get_citizen_micro_advisory(req: CitizenMicroAdvisoryRequest):
    """Evaluate dynamic localized threat score and safety guidance for a citizen location."""
    return service.evaluate_citizen_micro_advisory(req.lat, req.lng)


@router.get("/micro-advisory", response_model=CitizenMicroAdvisoryResponse)
def query_citizen_micro_advisory(
    lat: float = Query(..., description="Citizen latitude"),
    lng: float = Query(..., description="Citizen longitude"),
):
    """GET variant for quick browser-based location probing."""
    return service.evaluate_citizen_micro_advisory(lat, lng)
