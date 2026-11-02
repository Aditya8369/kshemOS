import pytest
from app.routers import geofence as router
from app.models import (
    GeofenceBoundary,
    GeofenceRule,
    LocationPingRequest,
    PointCoordinate,
)
from app.services import geofence


def test_spatial_calculations():
    geofence.reset()
    # Central Zone center is (28.6139, 77.2090), radius 2000m
    central = geofence.get_boundary("GEO-CENTRAL")
    assert central is not None

    # Point right near center
    inside = geofence.is_point_in_boundary(28.6140, 77.2091, central)
    assert inside is True

    # Point 10km away is outside
    outside = geofence.is_point_in_boundary(28.7500, 77.2090, central)
    assert outside is False


def test_entry_and_exit_alerts():
    geofence.reset()
    geofence.clear_alerts()

    # Unit starts outside Financial Corridor (28.6300, 77.2180)
    # Ping 1: Far outside
    res1 = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-101",
            team="TEAM-ALPHA",
            lat=28.7000,
            lng=77.2180,
            timestamp=1700000000000,
        )
    )
    assert "GEO-FIN-01" not in res1["current_geofences"]

    # Ping 2: Enters Financial Corridor (lat 28.6300, lng 77.2180)
    res2 = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-101",
            team="TEAM-ALPHA",
            lat=28.6300,
            lng=77.2180,
            timestamp=1700000010000,
        )
    )
    assert "GEO-FIN-01" in res2["current_geofences"]
    # Entry alert should be triggered
    entry_alerts = [a for a in res2["triggered_alerts"] if a["event_type"] == "entry" and a["geofence_id"] == "GEO-FIN-01"]
    assert len(entry_alerts) >= 1

    # Ping 3: Exits Financial Corridor back to 28.7000
    res3 = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-101",
            team="TEAM-ALPHA",
            lat=28.7000,
            lng=77.2180,
            timestamp=1700000020000,
        )
    )
    assert "GEO-FIN-01" not in res3["current_geofences"]
    exit_alerts = [a for a in res3["triggered_alerts"] if a["event_type"] == "exit" and a["geofence_id"] == "GEO-FIN-01"]
    assert len(exit_alerts) >= 1


def test_dwell_event_trigger():
    geofence.reset()
    geofence.clear_alerts()

    # Rule: Dwell Alert in High-Risk Financial Corridor (>30s)
    # Ping 1: Enters at t=0
    router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-DWELL",
            team="TEAM-ALPHA",
            lat=28.6300,
            lng=77.2180,
            timestamp=1700000000000,
        )
    )

    # Ping 2: Remains at t=15s (threshold not reached yet)
    res2 = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-DWELL",
            team="TEAM-ALPHA",
            lat=28.6300,
            lng=77.2180,
            timestamp=1700000015000,
        )
    )
    dwell_alerts_2 = [a for a in res2["triggered_alerts"] if a["event_type"] == "dwell"]
    assert len(dwell_alerts_2) == 0

    # Ping 3: Remains at t=35s (exceeds 30s threshold!)
    res3 = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-DWELL",
            team="TEAM-ALPHA",
            lat=28.6300,
            lng=77.2180,
            timestamp=1700000035000,
        )
    )
    dwell_alerts_3 = [a for a in res3["triggered_alerts"] if a["event_type"] == "dwell" and a["geofence_id"] == "GEO-FIN-01"]
    assert len(dwell_alerts_3) >= 1
    assert dwell_alerts_3[0]["severity"] in ("warning", "critical")


def test_configurable_rules_by_team():
    geofence.reset()
    geofence.clear_alerts()

    # Create a rule specific to CYBER-PATROL team entering Cyber Hub
    rule = router.create_rule(
        GeofenceRule(
            id="RULE-CYBER-TEAM-ONLY",
            name="Special VIP Cyber Team Rule",
            geofence_id="GEO-TECH-02",
            team="CYBER-PATROL",
            event_types=["entry"],
            alert_severity="critical",
            dwell_threshold_seconds=0,
            enabled=True,
        )
    )
    assert rule["id"] == "RULE-CYBER-TEAM-ONLY"

    # Ping with TEAM-OTHER into Cyber Hub (28.5350, 77.2250)
    res_other = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-OTHER",
            team="TEAM-OTHER",
            lat=28.5350,
            lng=77.2250,
            timestamp=1700000000000,
        )
    )
    # The special rule should NOT trigger for TEAM-OTHER
    rule_alerts = [a for a in res_other["triggered_alerts"] if a["rule_id"] == "RULE-CYBER-TEAM-ONLY"]
    assert len(rule_alerts) == 0

    # Ping with CYBER-PATROL into Cyber Hub
    res_cyber = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-CYBER-01",
            team="CYBER-PATROL",
            lat=28.5350,
            lng=77.2250,
            timestamp=1700000005000,
        )
    )
    cyber_alerts = [a for a in res_cyber["triggered_alerts"] if a["rule_id"] == "RULE-CYBER-TEAM-ONLY"]
    assert len(cyber_alerts) == 1
    assert cyber_alerts[0]["severity"] == "critical"


def test_alert_acknowledgement():
    geofence.reset()
    geofence.clear_alerts()

    # Trigger alert into Diplomatic Enclave (28.6000, 77.1900)
    res = router.location_ping(
        LocationPingRequest(
            entity_id="UNIT-INT",
            team="TEAM-ALPHA",
            lat=28.6000,
            lng=77.1900,
            timestamp=1700000000000,
        )
    )
    alerts = res["triggered_alerts"]
    assert len(alerts) >= 1
    target_alert_id = alerts[0]["id"]

    # Acknowledge
    ack = router.acknowledge_alert(target_alert_id)
    assert ack["acknowledged"] is True

    # Check alert feed
    feed_alerts = router.list_alerts(acknowledged=True)
    assert any(a["id"] == target_alert_id for a in feed_alerts)
