"""
Backend Tests for Cross-Jurisdiction Mutual Aid & Dynamic Resource Rebalancing.
"""
import sys
import time

from app.models import (
    CreateJointTaskforceRequest,
    DeclareMutualAidRequest,
    DelegateGuestUnitRequest,
    LogGuestActionRequest,
    RevokeGuestUnitRequest,
)
from app.routers import mutual_aid as router
from app.services import incidents as incident_service
from app.services import jurisdiction as jurisdiction_service
from app.services import mutual_aid as service


def setup_function():
    incident_service._incidents.clear()
    incident_service._staffing = {region: 0 for region in incident_service.REGIONS}
    jurisdiction_service.reset()
    service.reset()


def test_mutual_aid_declaration_and_auto_trigger():
    setup_function()

    # 1. Initially check default seeded declaration
    declarations = router.list_declarations()
    assert len(declarations) >= 1
    assert declarations[0]["requesting_jurisdiction_id"] in ("JUR-DELHI-METRO", "JUR-NCR-SOUTH")

    # 2. Add high-load incidents to Central Zone to trigger >150% overload
    # SA-CENTRAL-01 has capacity_limit_points = 30.
    # Add 16 critical incidents (16 * 3.0 = 48 points -> 160% workload ratio)
    for i in range(16):
        inc = incident_service.create_incident(
            category="scam_call",
            description=f"Critical digital arrest scam alert #{i} requiring immediate police intervention.",
            region="Central Zone",
        )
        incident_service._incidents[inc["id"]]["severity"] = "critical"

    # Trigger automatic evaluation
    triggered = service.check_workload_and_trigger_mutual_aid()
    decs = router.list_declarations()
    central_decs = [d for d in decs if d["region"] == "Central Zone" and d["status"] == "active"]
    assert len(central_decs) >= 1
    assert central_decs[0]["workload_ratio"] >= 1.50
    assert "JUR-NCR-SOUTH" in central_decs[0]["target_neighbor_jurisdictions"]

    # 3. Test manual commander declaration for South Zone
    south_req = DeclareMutualAidRequest(
        service_area_id="SA-SOUTH-01",
        declared_by="OFF-CMD-SOUTH",
        requested_units_count=3,
        notes="Urgent financial fraud mule ring takedown",
    )
    south_dec = router.declare_mutual_aid(south_req)
    assert south_dec["id"].startswith("MAD-")
    assert south_dec["requesting_jurisdiction_id"] == "JUR-NCR-SOUTH"
    assert south_dec["requested_units_count"] == 3
    print("test_mutual_aid_declaration_and_auto_trigger PASSED")


def test_temporary_guest_unit_access_delegation():
    setup_function()

    # Create guest delegation: Officer OFF-S2 (from JUR-NCR-SOUTH) borrowed into JUR-DELHI-METRO (Central Zone)
    req = DelegateGuestUnitRequest(
        guest_officer_id="OFF-S2",
        home_jurisdiction_id="JUR-NCR-SOUTH",
        borrowing_jurisdiction_id="JUR-DELHI-METRO",
        target_service_area_id="SA-CENTRAL-01",
        authorized_by="OFF-DIR-01",
        duration_hours=4.0,
        declaration_id="MAD-2026-00101",
        notes="Reinforcement for Central Secretariat digital arrest flood",
    )
    delegation = router.delegate_guest_unit(req)
    assert delegation["delegation_id"].startswith("GUEST-DEL-")
    assert delegation["guest_officer_id"] == "OFF-S2"
    assert delegation["home_jurisdiction_id"] == "JUR-NCR-SOUTH"
    assert delegation["borrowing_jurisdiction_id"] == "JUR-DELHI-METRO"
    assert delegation["target_region"] == "Central Zone"
    assert delegation["status"] == "active"
    assert delegation["valid_until"] > delegation["valid_from"]

    # Verify permanent roster in home jurisdiction is unchanged
    home_jur = jurisdiction_service.get_jurisdiction("JUR-NCR-SOUTH")
    assert home_jur["id"] == "JUR-NCR-SOUTH"

    # Verify active guest delegation listing
    active_list = router.list_guest_delegations(status="active")
    assert any(d["delegation_id"] == delegation["delegation_id"] for d in active_list)
    print("test_temporary_guest_unit_access_delegation PASSED")


def test_guest_action_logging_and_master_audit_trail():
    setup_function()

    # Log guest officer action on an incident in borrowed zone
    action_req = LogGuestActionRequest(
        guest_officer_id="OFF-S1",
        incident_id="INC-0042",
        action_type="triage",
        details="Guest officer OFF-S1 triaged digital arrest spoof call and frozen destination mule account.",
    )
    audit = router.log_guest_action(action_req)
    assert audit["id"].startswith("AUDIT-")
    assert audit["guest_officer_id"] == "OFF-S1"
    assert audit["home_jurisdiction_id"] == "JUR-NCR-SOUTH"
    assert audit["borrowed_jurisdiction_id"] == "JUR-DELHI-METRO"
    assert audit["incident_id"] == "INC-0042"

    # Query master audit trail
    trail = router.get_guest_action_audit(officer_id="OFF-S1")
    assert len(trail) >= 1
    assert trail[0]["details"] == audit["details"]
    print("test_guest_action_logging_and_master_audit_trail PASSED")


def test_auto_revocation_and_sunset_audits():
    setup_function()

    # 1. Create a fresh delegation to manually revoke
    fresh_deleg = router.delegate_guest_unit(
        DelegateGuestUnitRequest(
            guest_officer_id="OFF-S3",
            home_jurisdiction_id="JUR-NCR-SOUTH",
            borrowing_jurisdiction_id="JUR-DELHI-METRO",
            target_service_area_id="SA-CENTRAL-01",
            authorized_by="OFF-DIR-01",
            duration_hours=2.0,
            notes="Temporary morning shift reinforcement",
        )
    )
    del_id = fresh_deleg["delegation_id"]

    rev_req = RevokeGuestUnitRequest(
        revoked_by="OFF-DIR-01",
        reason="Incident load stabilized; returning officer to home precinct.",
    )
    revoked = router.revoke_guest_delegation(del_id, rev_req)
    assert revoked["status"] == "revoked"
    assert revoked["revocation_reason"] == rev_req.reason

    # 2. Check sunset audit log
    sunset_logs = router.get_sunset_audit()
    assert len(sunset_logs) >= 1
    assert any(s["delegation_id"] == del_id and s["sunset_reason"] == "COMMAND_REVOCATION" for s in sunset_logs)

    # 3. Test de-escalation of mutual aid declaration cascading to linked delegations
    dec = router.declare_mutual_aid(
        DeclareMutualAidRequest(
            service_area_id="SA-NORTH-01",
            declared_by="OFF-N1",
            requested_units_count=1,
        )
    )
    guest = router.delegate_guest_unit(
        DelegateGuestUnitRequest(
            guest_officer_id="OFF-C2",
            home_jurisdiction_id="JUR-DELHI-METRO",
            borrowing_jurisdiction_id="JUR-DELHI-METRO",
            target_service_area_id="SA-NORTH-01",
            declaration_id=dec["id"],
        )
    )
    deescalate_res = router.deescalate_declaration(dec["id"], reason="Crisis resolved")
    assert deescalate_res["declaration"]["status"] == "de_escalated"
    assert deescalate_res["sunset_delegations_count"] >= 1

    # Verify delegation is now revoked
    updated_guest = [d for d in router.list_guest_delegations() if d["delegation_id"] == guest["delegation_id"]][0]
    assert updated_guest["status"] == "revoked"
    print("test_auto_revocation_and_sunset_audits PASSED")


def test_joint_taskforce_workspaces():
    setup_function()

    # 1. List seeded joint taskforce
    jtfs = router.list_joint_taskforces()
    assert len(jtfs) >= 1
    jtf_id = jtfs[0]["id"]
    assert "JUR-DELHI-METRO" in jtfs[0]["participating_jurisdiction_ids"]
    assert "JUR-NCR-SOUTH" in jtfs[0]["participating_jurisdiction_ids"]

    # 2. Create incidents in both Central Zone (Delhi) and South Zone (NCR) sharing a mule account
    incident_service.create_incident(
        category="scam_call",
        description="Delhi caller demanding RTGS transfer to syndicate account.",
        region="Central Zone",
        linked_account="MULE-SYNDICATE-8899",
    )
    incident_service.create_incident(
        category="fraud_tx",
        description="Gurugram victim transferred 5 lakhs to same mule account.",
        region="South Zone",
        linked_account="MULE-SYNDICATE-8899",
    )

    # 3. Retrieve workspace
    workspace = router.get_joint_taskforce_workspace(jtf_id)
    assert workspace["taskforce"]["id"] == jtf_id
    assert workspace["aggregated_metrics"]["total_incidents"] >= 2
    assert workspace["aggregated_metrics"]["cross_zone_syndicates_detected"] >= 1

    # Verify cross-zone syndicate account detected across both zones
    syndicates = workspace["cross_zone_syndicate_accounts"]
    found = [s for s in syndicates if s["account_id"] == "MULE-SYNDICATE-8899"]
    assert len(found) == 1
    assert "Central Zone" in found[0]["regions"]
    assert "South Zone" in found[0]["regions"]

    # 4. Create custom joint taskforce
    custom_jtf = router.create_joint_taskforce(
        CreateJointTaskforceRequest(
            name="Interstate UPI Mule Strike Operation",
            lead_jurisdiction_id="JUR-NCR-SOUTH",
            participating_jurisdiction_ids=["JUR-NCR-SOUTH", "JUR-DELHI-METRO"],
            monitored_regions=["South Zone", "West Zone"],
            active_taskforce_officers=["OFF-S2", "OFF-W1"],
        )
    )
    assert custom_jtf["id"].startswith("JTF-")
    assert custom_jtf["name"] == "Interstate UPI Mule Strike Operation"
    print("test_joint_taskforce_workspaces PASSED")


def test_dynamic_resource_rebalancing_evaluator():
    setup_function()

    # Add heavy load to Central Zone (16 critical cases: 16 * 3.0 = 48 points vs 30 capacity -> ratio 1.6)
    for i in range(16):
        inc = incident_service.create_incident(
            category="scam_call",
            description=f"Urgent critical digital arrest police cyber warrant CBI #{i}",
            region="Central Zone",
        )
        # Explicitly ensure critical severity for high workload calculation
        incident_service._incidents[inc["id"]]["severity"] = "critical"

    # South Zone with minimal workload
    inc_south = incident_service.create_incident(
        category="fraud_tx",
        description="Minor unverified transaction notification inquiry",
        region="South Zone",
    )
    incident_service._incidents[inc_south["id"]]["severity"] = "low"

    eval_result = router.evaluate_dynamic_rebalancing()
    assert eval_result["overloaded_sectors_count"] >= 1

    recs = eval_result["recommendations"]
    assert len(recs) >= 1
    rec = recs[0]
    assert rec["overloaded_region"] == "Central Zone"
    assert rec["recommended_units"] >= 1
    assert rec["projected_workload_ratio_after"] < 1.60
    assert len(rec["rationales"]) >= 2
    print("test_dynamic_resource_rebalancing_evaluator PASSED")


def run_all_tests():
    test_mutual_aid_declaration_and_auto_trigger()
    test_temporary_guest_unit_access_delegation()
    test_guest_action_logging_and_master_audit_trail()
    test_auto_revocation_and_sunset_audits()
    test_joint_taskforce_workspaces()
    test_dynamic_resource_rebalancing_evaluator()
    print("ALL 6 BACKEND MUTUAL AID & REBALANCING TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_all_tests()
