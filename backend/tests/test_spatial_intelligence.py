"""
Backend Tests for Real-Time Threat Heatmap & Predictive Spatial Intelligence.
"""
from app.models import CitizenMicroAdvisoryRequest
from app.routers import spatial_intelligence as router
from app.services import spatial_intelligence as service


def setup_function():
    service.reset()


def test_spatial_clustering_and_density():
    setup_function()

    clusters = router.list_threat_clusters()
    assert len(clusters) >= 2, f"Expected at least 2 clusters, got {len(clusters)}"

    # Check Central Zone cluster
    central = next((c for c in clusters if c["region"] == "Central Zone"), None)
    assert central is not None, "Central Zone cluster missing"
    assert central["incident_count"] >= 3
    assert central["severity_density"] > 0.0
    assert central["radius_meters"] >= 500.0
    assert central["threat_level"] in ("critical", "high")
    assert len(central["nearby_atms"]) >= 1

    # Check South Zone cluster
    south = next((c for c in clusters if c["region"] == "South Zone"), None)
    assert south is not None, "South Zone cluster missing"
    assert south["incident_count"] >= 2
    print("test_spatial_clustering_and_density PASSED")


def test_velocity_and_migration_vectors():
    setup_function()

    vectors = router.list_migration_vectors()
    assert len(vectors) >= 2

    # Check migration direction and velocity
    central_vec = next((v for v in vectors if "Central" in v["risk_narrative"]), None)
    assert central_vec is not None
    assert central_vec["trend"] in ("migrating", "expanding")
    assert central_vec["velocity_km_per_day"] > 0.0
    assert central_vec["heading_cardinal"] in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    assert central_vec["target_region"] == "North Zone"
    assert len(central_vec["risk_narrative"]) > 10
    print("test_velocity_and_migration_vectors PASSED")


def test_smart_patrol_dispatch_recommendations():
    setup_function()

    recs = router.list_patrol_recommendations()
    assert len(recs) >= 2

    for rec in recs:
        assert rec["recommendation_id"].startswith("PATROL-REC-")
        assert rec["lat"] != 0.0 and rec["lng"] != 0.0
        assert rec["suggested_priority"] in ("urgent_deterrence", "preventative_check", "surveillance_stakeout")
        assert len(rec["action_checklist"]) >= 3
        assert rec["assigned_team_code"] in ("CYBER-PATROL", "TEAM-ALPHA", "FIELD-UNIT-1")
    print("test_smart_patrol_dispatch_recommendations PASSED")


def test_citizen_micro_advisory():
    setup_function()

    # 1. Citizen standing inside Central Zone hotspot (near Barakhamba / CP: 28.6310, 77.2175)
    close_req = CitizenMicroAdvisoryRequest(lat=28.6310, lng=77.2175)
    close_resp = router.get_citizen_micro_advisory(close_req)

    assert close_resp["proximity_meters"] < 500.0
    assert close_resp["threat_level"] in ("critical", "high")
    assert close_resp["localized_risk_score"] >= 60
    assert len(close_resp["safety_guidance"]) >= 2
    assert "Barakhamba" in close_resp["nearest_safe_precinct"]

    # 2. Citizen standing far away in safe perimeter (lat 28.4000, lng 77.0000, >25km away)
    far_req = CitizenMicroAdvisoryRequest(lat=28.4000, lng=77.0000)
    far_resp = router.get_citizen_micro_advisory(far_req)

    assert far_resp["proximity_meters"] > 5000.0
    assert far_resp["threat_level"] == "low"
    assert far_resp["localized_risk_score"] <= 30
    print("test_citizen_micro_advisory PASSED")


def test_threat_heatmap_and_live_ingestion():
    setup_function()

    # Query master heatmap
    heatmap = router.get_threat_heatmap()
    assert heatmap["total_clusters"] >= 2
    assert len(heatmap["financial_pois"]) >= 5
    assert len(heatmap["migration_vectors"]) >= 2
    assert len(heatmap["patrol_recommendations"]) >= 2

    # Ingest a new incident in North Zone
    new_inc = {
        "title": "Mule Card Swapping at Civil Lines Transit",
        "category": "fraud_tx",
        "severity": "critical",
        "lat": 28.6825,
        "lng": 77.2125,
        "region": "North Zone",
    }
    router.add_spatial_incident(new_inc)

    # Re-query clusters to verify density update
    updated_clusters = router.list_threat_clusters()
    north = next((c for c in updated_clusters if c["region"] == "North Zone"), None)
    assert north is not None
    assert north["incident_count"] >= 2
    print("test_threat_heatmap_and_live_ingestion PASSED")


def run_all_tests():
    test_spatial_clustering_and_density()
    test_velocity_and_migration_vectors()
    test_smart_patrol_dispatch_recommendations()
    test_citizen_micro_advisory()
    test_threat_heatmap_and_live_ingestion()
    print("ALL 5 BACKEND SPATIAL INTELLIGENCE TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_all_tests()
