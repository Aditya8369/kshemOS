"""
Backend Tests for Evidence-Grounded Officer Copilot Recommendations.

Validates:
1. 4-Tier Separation:
   - Confirmed Facts (incident fields, verified graph edges)
   - Unverified Claims (citizen assertions requiring corroboration)
   - System Signals (algorithmic mule probability, detector confidence)
   - Model Suggestions (recommendations with attached source references)
2. Attached Source References:
   - Material recommendations cite specific incident fields, fraud graph nodes, and approved SOPs.
3. Insufficient-Evidence Responses:
   - Sparse or missing records return has_sufficient_evidence=False, priority='inconclusive',
     and suggest intake verification rather than speculative/hallucinated consequential actions.
4. Officer Feedback Flagging:
   - Recommendations can be flagged as 'helpful', 'incorrect', or 'unsupported' with notes.
5. Mandatory Human Approval for Consequential Actions:
   - Statutory account freeze and telecom preservation actions require explicit human signoff.
   - Non-consequential actions execute without human approval.
"""
import pytest
from app.data.standard_operating_procedures import retrieve_relevant_sops, ALL_SOPS
from app.models import CopilotApprovalRequest, CopilotFeedbackRequest
from app.routers import officer as officer_router
from app.services import officer_copilot as copilot_service
from app.services.incidents import create_incident, _incidents
from app.services.store import save_report


def setup_function():
    copilot_service.reset()


def test_sop_retrieval_and_structure():
    sops = retrieve_relevant_sops(category="digital_arrest", mule_probability=0.85, is_digital_arrest=True)
    assert len(sops) >= 2
    sop_ids = [s["sop_id"] for s in sops]
    assert "SOP-1930-FREEZE" in sop_ids
    assert "SOP-DA-DEESCALATE" in sop_ids

    freeze_sop = next(s for s in sops if s["sop_id"] == "SOP-1930-FREEZE")
    assert freeze_sop["is_consequential"] is True
    assert freeze_sop["requires_human_approval"] is True
    assert "Section 91" in freeze_sop["statutory_authority"]


def test_4_tier_separation_and_source_references():
    setup_function()

    report_id = save_report({
        "reporter_name": "Rohan Deshmukh",
        "category": "digital_arrest",
        "description": "Caller claimed to be a CBI Inspector alleging parcel with MDMA. Demanded 2,50,000 transfer to ACC-1002.",
        "region": "Central Zone",
    })

    incident = create_incident(
        category="digital_arrest",
        description="Caller claimed to be a CBI Inspector alleging parcel with MDMA. Demanded transfer to ACC-1002.",
        report_id=report_id,
        region="Central Zone",
        linked_account="ACC-1002",
    )
    inc_id = incident["id"]

    analysis = copilot_service.generate_grounded_copilot_analysis(inc_id)

    assert analysis["has_sufficient_evidence"] is True
    assert analysis["evidence_completeness_score"] > 0.5
    assert analysis["priority"] in ("critical", "high")

    # Tier 1: Confirmed Facts
    assert len(analysis["confirmed_facts"]) >= 2
    for fact in analysis["confirmed_facts"]:
        assert "fact_id" in fact
        assert "fact_type" in fact
        assert "statement" in fact
        assert "source_citation" in fact
        assert fact["is_verified"] is True

    # Tier 2: Unverified Claims
    assert len(analysis["unverified_claims"]) >= 1
    for claim in analysis["unverified_claims"]:
        assert "claim_id" in claim
        assert "statement" in claim
        assert "reporting_party" in claim
        assert claim["verification_status"] in ("pending_corroboration", "unsubstantiated")
        assert len(claim["corroboration_needed"]) > 0

    # Tier 3: System Signals
    assert len(analysis["system_signals"]) >= 1
    for signal in analysis["system_signals"]:
        assert "signal_id" in signal
        assert "signal_name" in signal
        assert "value" in signal
        assert 0.0 <= signal["confidence"] <= 1.0
        assert "detector_model" in signal
        assert "interpretation" in signal

    # Tier 4: Model Suggestions with Source References
    assert len(analysis["recommendations"]) >= 2
    for rec in analysis["recommendations"]:
        assert "rec_id" in rec
        assert "action_title" in rec
        assert "rationale" in rec
        assert len(rec["source_references"]) >= 1
        for ref in rec["source_references"]:
            assert "ref_id" in ref
            assert "source_type" in ref
            assert "citation_title" in ref
            assert "field_or_clause" in ref
            assert "exact_pointer" in ref


def test_insufficient_evidence_response():
    setup_function()

    analysis = copilot_service.generate_grounded_copilot_analysis("NONEXISTENT-TARGET-999")

    assert analysis["has_sufficient_evidence"] is False
    assert analysis["priority"] == "inconclusive"
    assert analysis["missing_records_summary"] is not None
    assert "Insufficient records located" in analysis["missing_records_summary"]
    assert len(analysis["confirmed_facts"]) == 0
    # Must NOT formulate consequential account freeze on non-existent records
    consequential_recs = [r for r in analysis["recommendations"] if r["is_consequential"]]
    assert len(consequential_recs) == 0

    # Instead should formulate preliminary intake discovery
    assert len(analysis["recommendations"]) == 1
    assert "Verification Intake" in analysis["recommendations"][0]["action_title"]


def test_consequential_action_requires_human_approval():
    setup_function()

    report_id = save_report({
        "reporter_name": "Meera Sen",
        "category": "digital_arrest",
        "description": "Scammer threatened immediate arrest. Account ACC-1002 used for fund routing.",
        "region": "South Zone",
    })

    incident = create_incident(
        category="digital_arrest",
        description="Mule account routing via ACC-1002.",
        report_id=report_id,
        region="South Zone",
        linked_account="ACC-1002",
    )

    analysis = copilot_service.generate_grounded_copilot_analysis(incident["id"])

    consequential = [r for r in analysis["recommendations"] if r["is_consequential"]]
    assert len(consequential) >= 1

    freeze_rec = next(r for r in consequential if "Section 91" in r["action_title"])
    assert freeze_rec["requires_human_approval"] is True
    assert freeze_rec["approval_status"] == "pending_approval"
    assert freeze_rec["approved_by"] is None
    assert freeze_rec["approved_at"] is None


def test_human_approval_workflow():
    setup_function()

    report_id = save_report({
        "reporter_name": "Pooja Verma",
        "category": "digital_arrest",
        "description": "Urgent freeze needed on ACC-1002.",
        "region": "Central Zone",
    })

    analysis = copilot_service.generate_grounded_copilot_analysis(report_id, account_id="ACC-1002")
    consequential_recs = [r for r in analysis["recommendations"] if r["is_consequential"]]
    assert len(consequential_recs) >= 1
    freeze_rec = consequential_recs[0]

    # 1. Approve
    approved = copilot_service.submit_approval(
        rec_id=freeze_rec["rec_id"],
        decision="approved",
        officer_badge="INSP-KUMAR-771",
        notes="Branch manager verified transaction flow.",
    )
    assert approved["approval_status"] == "approved"
    assert approved["approved_by"] == "INSP-KUMAR-771"
    assert approved["approved_at"] is not None
    assert approved["feedback_notes"] == "Branch manager verified transaction flow."

    # 2. Reject another consequential action
    if len(consequential_recs) > 1:
        other_rec = consequential_recs[1]
        rejected = copilot_service.submit_approval(
            rec_id=other_rec["rec_id"],
            decision="rejected",
            officer_badge="DSP-SINGH-302",
            notes="Jurisdiction transfer required first.",
        )
        assert rejected["approval_status"] == "rejected"
        assert rejected["approved_by"] == "DSP-SINGH-302"

    # 3. Disallow approving non-consequential recommendation
    non_consequential = next(r for r in analysis["recommendations"] if not r["is_consequential"])
    with pytest.raises(ValueError):
        copilot_service.submit_approval(
            rec_id=non_consequential["rec_id"],
            decision="approved",
            officer_badge="INSP-KUMAR-771",
        )


def test_officer_feedback_flagging():
    setup_function()

    analysis = copilot_service.generate_grounded_copilot_analysis("ACC-1002", account_id="ACC-1002")
    recs = analysis["recommendations"]
    assert len(recs) >= 2

    # Flag helpful
    rec1 = recs[0]
    res1 = copilot_service.submit_feedback(
        rec_id=rec1["rec_id"],
        feedback="helpful",
        notes="Accurate Section 91 statutory reference.",
        officer_badge="SI-PATEL-904",
    )
    assert res1["officer_feedback"] == "helpful"
    assert res1["feedback_notes"] == "Accurate Section 91 statutory reference."
    assert res1["feedback_submitted_by"] == "SI-PATEL-904"

    # Flag unsupported
    rec2 = recs[1]
    res2 = copilot_service.submit_feedback(
        rec_id=rec2["rec_id"],
        feedback="unsupported",
        notes="Citizen already confirmed no mobile call was made.",
        officer_badge="SI-PATEL-904",
    )
    assert res2["officer_feedback"] == "unsupported"
    assert res2["feedback_notes"] == "Citizen already confirmed no mobile call was made."

    # Flag incorrect
    res3 = copilot_service.submit_feedback(
        rec_id=rec2["rec_id"],
        feedback="incorrect",
        notes="Wrong jurisdiction desk.",
        officer_badge="SI-PATEL-904",
    )
    assert res3["officer_feedback"] == "incorrect"


def test_officer_router_endpoints():
    setup_function()

    report_id = save_report({
        "reporter_name": "Aman Gupta",
        "category": "digital_arrest",
        "description": "Call demanding 5,00,000 for customs parcel release.",
        "region": "Central Zone",
    })

    # Test grounded endpoint
    grounded_res = officer_router.get_grounded_copilot_analysis(report_id, account_id="ACC-1002")
    assert grounded_res["case_or_incident_id"] == report_id
    assert grounded_res["has_sufficient_evidence"] is True
    assert len(grounded_res["recommendations"]) >= 1

    rec_id = grounded_res["recommendations"][0]["rec_id"]

    # Test feedback endpoint
    fb_req = CopilotFeedbackRequest(
        feedback="helpful",
        notes="Matches operational procedure",
        officer_badge="INSP-SHARMA-12",
    )
    fb_res = officer_router.post_copilot_feedback(rec_id, fb_req)
    assert fb_res["officer_feedback"] == "helpful"
    assert fb_res["feedback_submitted_by"] == "INSP-SHARMA-12"

    # Test approval endpoint
    consequential_rec = next((r for r in grounded_res["recommendations"] if r["is_consequential"]), None)
    if consequential_rec:
        app_req = CopilotApprovalRequest(
            decision="approved",
            officer_badge="COMM-VERMA-01",
            approval_notes="Priority freeze sanctioned.",
        )
        app_res = officer_router.post_copilot_approval(consequential_rec["rec_id"], app_req)
        assert app_res["approval_status"] == "approved"
        assert app_res["approved_by"] == "COMM-VERMA-01"
