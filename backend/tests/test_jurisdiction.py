"""
Unit tests for Jurisdiction and Zone Configuration in KshemOS.
Directly invokes service and router functions to avoid Starlette AnyIO blocking portal hangs on Windows Python 3.13.
"""
from __future__ import annotations

import pytest
from app.services import jurisdiction as service
from app.services import incidents as incident_service
from app.routers import jurisdiction as router
from app.routers.jurisdiction import (
    DispatchEvaluationRequest,
    ReviewProposalRequest,
    RestoreSnapshotRequest,
)


@pytest.fixture(autouse=True)
def clean_state():
    service.reset()
    incident_service.reset()
    yield
    service.reset()
    incident_service.reset()


def test_default_jurisdictions_and_service_areas():
    jurisdictions = router.list_jurisdictions()
    assert len(jurisdictions) >= 2
    jur_ids = [j["id"] for j in jurisdictions]
    assert "JUR-DELHI-METRO" in jur_ids
    assert "JUR-NCR-SOUTH" in jur_ids

    service_areas = router.list_service_areas()
    assert len(service_areas) >= 5
    regions = {sa["region"] for sa in service_areas}
    expected_regions = {"North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"}
    assert expected_regions.issubset(regions)

    rules = router.list_dispatch_rules()
    assert len(rules) >= 4


def test_jurisdiction_crud():
    # 1. Create new jurisdiction
    new_jur = {
        "id": "JUR-EAST-EXP",
        "name": "East Peripheral Cyber Command",
        "code": "DL-EP-CYBER",
        "status": "active",
        "headquarters": "Anand Vihar Hub",
        "contact_officer": "OFF-EV-09",
        "region_scope": ["East Zone"],
        "description": "Rapid response jurisdiction for transit and cross-border incidents",
    }
    created = router.create_jurisdiction(new_jur, author="OFF-DIR-01")
    assert created["id"] == "JUR-EAST-EXP"
    assert created["version"] == 1

    # 2. Retrieve
    retrieved = router.get_jurisdiction("JUR-EAST-EXP")
    assert retrieved["name"] == "East Peripheral Cyber Command"

    # 3. Update
    updated = router.update_jurisdiction(
        "JUR-EAST-EXP",
        {"headquarters": "Patparganj Sector 3", "description": "Expanded rapid response jurisdiction"},
        author="OFF-DIR-01",
    )
    assert updated["headquarters"] == "Patparganj Sector 3"
    assert updated["version"] == 2


def test_low_impact_service_area_save_applies_directly():
    existing = router.get_service_area("SA-CENTRAL-01")
    assert existing is not None

    update_payload = dict(existing)
    update_payload["primary_station"] = "Barakhamba Metro Cyber Command Center"

    res = router.save_service_area(update_payload, author="OFF-CENTRAL-01")
    assert res["requires_review"] is False
    assert "service_area" in res
    assert res["service_area"]["primary_station"] == "Barakhamba Metro Cyber Command Center"
    assert res["service_area"]["version"] >= 2


def test_high_impact_radius_shrink_creates_proposal():
    existing = router.get_service_area("SA-NORTH-01")
    assert existing is not None
    original_radius = existing["radius_km"]  # e.g., 5.0 km

    # Shrink by 50% (>25% shrink threshold)
    shrunk_payload = dict(existing)
    shrunk_payload["radius_km"] = original_radius * 0.5

    # 1. Test validation endpoint
    val = router.validate_boundary(shrunk_payload)
    assert val["is_valid"] is True
    assert val["requires_review"] is True
    assert val["coverage_gap_detected"] is True
    assert val["impact_level"] == "high"

    # 2. Test save endpoint without force_apply
    save_res = router.save_service_area(shrunk_payload, author="OFF-NORTH-02")
    assert save_res["requires_review"] is True
    prop_id = save_res["proposal_id"]
    assert prop_id.startswith("PROP-")

    # The service area should NOT have been updated yet
    current = router.get_service_area("SA-NORTH-01")
    assert current["radius_km"] == original_radius


def test_high_impact_deactivation_with_active_incidents():
    # Seed active incident in Central Zone
    incident_service.create_incident(
        category="digital_arrest",
        description="Victim under active extortion in Connaught Place",
        region="Central Zone",
    )

    sa = router.get_service_area("SA-CENTRAL-01")
    deact_payload = dict(sa)
    deact_payload["status"] = "inactive"

    val = router.validate_boundary(deact_payload)
    assert val["requires_review"] is True
    assert val["impact_level"] == "high"
    assert val["affected_active_incidents"] >= 1
    assert any("Deactivating service area" in w for w in val["warnings"])


def test_change_proposal_approval_and_rejection():
    existing = router.get_service_area("SA-EAST-01")
    payload = dict(existing)
    payload["radius_km"] = 2.0  # Significant shrinkage from 5.5km (>25%)

    # Submit proposal
    res = router.save_service_area(payload, author="OFF-SUBMITTER")
    assert res["requires_review"] is True
    prop_id = res["proposal_id"]

    # Verify pending proposals list
    proposals = router.list_proposals(status="pending")
    assert any(p["id"] == prop_id for p in proposals)

    # Review: Approve
    review_req = ReviewProposalRequest(
        reviewer_code="OFF-SUPERVISOR-01",
        decision="approved",
        reviewer_notes="Approved following perimeter reassignment to adjacent sector.",
    )
    rev_res = router.review_proposal(prop_id, review_req)
    assert rev_res["proposal"]["status"] == "approved"
    assert rev_res["applied_entity"]["radius_km"] == 2.0

    # Verify updated in store
    updated_sa = router.get_service_area("SA-EAST-01")
    assert updated_sa["radius_km"] == 2.0

    # Submit another proposal and reject it
    payload2 = dict(updated_sa)
    payload2["radius_km"] = 0.8  # Further shrinkage
    res2 = router.save_service_area(payload2, author="OFF-SUBMITTER")
    assert res2["requires_review"] is True
    prop_id2 = res2["proposal_id"]

    rev_res2 = router.review_proposal(
        prop_id2,
        ReviewProposalRequest(
            reviewer_code="OFF-SUPERVISOR-01",
            decision="rejected",
            reviewer_notes="Rejected: Leaves major commercial sectors uncovered.",
        ),
    )
    assert rev_res2["proposal"]["status"] == "rejected"
    # Service area radius remains 2.0 (from first approval)
    assert router.get_service_area("SA-EAST-01")["radius_km"] == 2.0


def test_force_apply_bypasses_proposal_review():
    existing = router.get_service_area("SA-WEST-01")
    payload = dict(existing)
    payload["radius_km"] = 2.0  # shrink from 5.0km

    res = router.save_service_area(payload, force_apply=True, author="COMMISSIONER")
    assert res["requires_review"] is False
    assert res["service_area"]["radius_km"] == 2.0
    assert router.get_service_area("SA-WEST-01")["radius_km"] == 2.0


def test_dispatch_rule_matching_and_evaluation():
    # 1. Critical scam call in Central Zone should match DISP-RULE-DIGITAL-ARREST
    eval_req = DispatchEvaluationRequest(
        category="scam_call",
        severity="critical",
        region="Central Zone",
    )
    res = router.evaluate_dispatch(eval_req)
    assert res["matched"] is True
    assert res["rule"]["target_desk"] == "OFF-SPEC-DIGITAL-ARREST"

    # 2. Financial fraud in South Zone should match South rule
    eval_req_south = DispatchEvaluationRequest(
        category="fraud_tx",
        severity="high",
        region="South Zone",
    )
    res_south = router.evaluate_dispatch(eval_req_south)
    assert res_south["matched"] is True
    assert "South" in res_south["rule"]["name"] or res_south["rule"]["service_area_id"] == "SA-SOUTH-01"

    # 3. Add and delete custom dispatch rule
    custom_rule = {
        "id": "DISP-CUSTOM-TEST",
        "name": "ATM Skimming Rapid Taskforce",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "service_area_id": "SA-WEST-01",
        "categories": ["atm_skimming", "pos_fraud"],
        "min_severity": "high",
        "target_desk": "DESK-WEST-RAPID",
        "priority": 5,
        "enabled": True,
    }
    saved_rule = router.save_dispatch_rule(custom_rule, author="OFF-DISPATCH")
    assert saved_rule["id"] == "DISP-CUSTOM-TEST"

    del_res = router.delete_dispatch_rule("DISP-CUSTOM-TEST")
    assert del_res["status"] == "deleted"


def test_snapshots_audit_and_rollback():
    # Capture baseline snapshot
    baseline_snaps = router.list_snapshots()
    assert len(baseline_snaps) >= 1
    baseline_id = baseline_snaps[-1]["snapshot_id"]

    # Apply changes
    router.create_jurisdiction({
        "id": "JUR-TEMPORARY",
        "name": "Temporary Special Operations",
        "code": "DL-TEMP",
        "status": "active",
        "headquarters": "Mobile HQ Alpha",
        "contact_officer": "OFF-TEMP",
        "region_scope": ["West Zone"],
    })
    router.save_service_area({
        "id": "SA-WEST-01",
        "jurisdiction_id": "JUR-DELHI-METRO",
        "name": "West Specialized Sector",
        "region": "West Zone",
        "primary_station": "Janakpuri Cyber Unit",
        "boundary_type": "circle",
        "center_lat": 28.6219,
        "center_lng": 77.0878,
        "radius_km": 15.0,
        "authorized_units": ["OFF-W1", "OFF-W2", "OFF-W3"],
        "capacity_limit_points": 40,
        "risk_level": "low",
        "status": "active",
    }, force_apply=True)

    after_snaps = router.list_snapshots()
    latest_id = after_snaps[0]["snapshot_id"]
    assert len(after_snaps) > len(baseline_snaps)

    # Test snapshot diff
    diff = router.diff_snapshots(snap_a=baseline_id, snap_b=latest_id)
    assert diff["snapshot_a"] == baseline_id
    assert diff["snapshot_b"] == latest_id
    assert len(diff["service_areas"]["modified"]) >= 1

    # Perform Rollback to baseline
    restore_res = router.restore_snapshot(
        baseline_id,
        RestoreSnapshotRequest(restored_by="OFF-SUPERVISOR-AUDIT"),
    )
    assert restore_res["status"] == "restored"
    assert restore_res["restored_snapshot_id"] == baseline_id

    # Verify rollback reverted temporary jurisdiction and restored original service area
    restored_jurisdictions = [j["id"] for j in router.list_jurisdictions()]
    assert "JUR-TEMPORARY" not in restored_jurisdictions

    restored_west = router.get_service_area("SA-WEST-01")
    assert restored_west["radius_km"] == 5.0


def run_all_tests():
    tests = [
        test_default_jurisdictions_and_service_areas,
        test_jurisdiction_crud,
        test_low_impact_service_area_save_applies_directly,
        test_high_impact_radius_shrink_creates_proposal,
        test_high_impact_deactivation_with_active_incidents,
        test_change_proposal_approval_and_rejection,
        test_force_apply_bypasses_proposal_review,
        test_dispatch_rule_matching_and_evaluation,
        test_snapshots_audit_and_rollback,
    ]
    for t in tests:
        service.reset()
        incident_service.reset()
        t()
        print(f"PASS: {t.__name__}")
    print(f"\nAll {len(tests)} jurisdiction backend tests passed successfully!")


if __name__ == "__main__":
    run_all_tests()
