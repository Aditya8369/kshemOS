"""
Unit tests for Interactive Dynamic Geofence Polygon Builder & Micro-Advisory Engine.
Validates:
1. Ray-casting point-in-polygon spatial calculations.
2. GeoJSON polygon intersection with station circles and PIN centroids.
3. Multi-zone advisory auto-population:
   "Targets 4 postal sectors across 2 police circles (Est. reach: 18,500 citizens)"
4. GeoJSON vertex limit validation (min 3, max 500 vertices).
5. FastAPI endpoint POST /api/threat-mesh/broadcast-advisories.
"""

import os
import sys
import pytest
from fastapi import HTTPException

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import AdvisoryBroadcastCreateRequest
from app.routers import regional_threat_mesh as router_endpoints
from app.services import regional_threat_mesh


@pytest.fixture(autouse=True)
def setup_services():
    regional_threat_mesh.reset_store()
    regional_threat_mesh.seed_default_mesh_state()
    yield


def test_ray_casting_point_in_geojson_polygon():
    """Verify point-in-polygon ray-casting mathematics."""
    # Polygon covering North-Central Delhi corridor
    polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.185, 28.718],
                [77.245, 28.712],
                [77.248, 28.625],
                [77.180, 28.628],
                [77.185, 28.718],
            ]
        ],
    }

    # Civil Lines (110007: 28.6920, 77.2150) is inside
    assert regional_threat_mesh.is_point_in_geojson_polygon(28.6920, 77.2150, polygon) is True

    # Connaught Place (110001: 28.6304, 77.2177) is inside
    assert regional_threat_mesh.is_point_in_geojson_polygon(28.6304, 77.2177, polygon) is True

    # Saket / South Delhi (110017: 28.5244, 77.2066) is outside
    assert regional_threat_mesh.is_point_in_geojson_polygon(28.5244, 77.2066, polygon) is False

    # Mumbai (18.9388, 72.8354) is outside
    assert regional_threat_mesh.is_point_in_geojson_polygon(18.9388, 72.8354, polygon) is False


def test_create_polygon_broadcast_advisory_multi_zone():
    """Verify multi-zone advisory auto-population across 4 sectors and 2 police circles."""
    polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.185, 28.718],
                [77.245, 28.712],
                [77.248, 28.625],
                [77.180, 28.628],
                [77.185, 28.718],
            ]
        ],
    }

    req = AdvisoryBroadcastCreateRequest(
        title="Notice: Fake electricity bill payment SMS active in North/Central corridor.",
        summary_guidance="Scammers circulating disconnection SMS notices across targeted postal sectors.",
        scam_category="electricity_bill_scam",
        urgency="high",
        polygon_geojson=polygon,
    )

    advisory = regional_threat_mesh.create_polygon_broadcast_advisory(req)

    assert advisory.advisory_id.startswith("ADV-MESH-POLY-")
    assert advisory.status == "DRAFTED_PENDING_APPROVAL"
    assert len(advisory.target_pincodes) == 4
    assert set(advisory.target_pincodes) == {"110007", "110009", "110054", "110001"}
    assert len(advisory.affected_police_circles) == 2
    assert "Civil Lines Cyber Cell Desk" in advisory.affected_police_circles
    assert "Central Cyber Cell Desk, Barakhamba Road" in advisory.affected_police_circles
    assert advisory.estimated_citizen_reach == 18500
    assert "Targets 4 postal sectors across 2 police circles (Est. reach: 18,500 citizens)" in advisory.multi_zone_summary


def test_validate_polygon_vertex_limits_minimum():
    """Verify rejection when polygon has fewer than 3 distinct vertices."""
    two_point_polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.185, 28.718],
                [77.245, 28.712],
            ]
        ],
    }

    req = AdvisoryBroadcastCreateRequest(
        title="Invalid Polygon",
        summary_guidance="Testing minimum vertices",
        polygon_geojson=two_point_polygon,
    )

    with pytest.raises(HTTPException) as exc_info:
        router_endpoints.create_broadcast_advisory_endpoint(req)

    assert exc_info.value.status_code == 400
    assert "at least 3 distinct vertices" in exc_info.value.detail


def test_validate_polygon_vertex_limits_maximum():
    """Verify rejection when polygon exceeds 500 vertices limit."""
    # Generate 505 vertices
    lots_of_points = [[77.20 + (i * 0.0001), 28.60 + (i * 0.0001)] for i in range(505)]
    lots_of_points.append(lots_of_points[0])  # close

    huge_polygon = {
        "type": "Polygon",
        "coordinates": [lots_of_points],
    }

    req = AdvisoryBroadcastCreateRequest(
        title="Exceeded Limit Polygon",
        summary_guidance="Testing maximum vertices",
        polygon_geojson=huge_polygon,
    )

    with pytest.raises(HTTPException) as exc_info:
        router_endpoints.create_broadcast_advisory_endpoint(req)

    assert exc_info.value.status_code == 400
    assert "maximum allowed vertex limit of 500" in exc_info.value.detail


def test_validate_coordinate_geographic_bounds():
    """Verify rejection when coordinates exceed valid lat/lng boundaries."""
    invalid_coords_polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [200.0, 28.718],  # invalid lng > 180
                [77.245, 28.712],
                [77.248, 28.625],
                [200.0, 28.718],
            ]
        ],
    }

    req = AdvisoryBroadcastCreateRequest(
        title="Out of Bounds",
        summary_guidance="Testing bounds",
        polygon_geojson=invalid_coords_polygon,
    )

    with pytest.raises(HTTPException) as exc_info:
        router_endpoints.create_broadcast_advisory_endpoint(req)

    assert exc_info.value.status_code == 400
    assert "out of geographic bounds" in exc_info.value.detail
