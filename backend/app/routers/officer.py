from fastapi import APIRouter, HTTPException

from app.models import (
    CaseSummaryResponse,
    EvidenceGroundedCopilotResponse,
    CopilotFeedbackRequest,
    CopilotApprovalRequest,
    CopilotRecommendation,
)
from app.services.officer_copilot import (
    generate_grounded_copilot_analysis,
    submit_feedback,
    submit_approval,
)
from app.services.claude_client import ask_claude
from app.services.fraud_graph import get_ring_info
from app.services.store import get_report

router = APIRouter(prefix="/api/officer", tags=["Officer Copilot Agent"])

SYSTEM_PROMPT = (
    "You are the KshemOS Officer Copilot, assisting Indian law-enforcement "
    "officers. Write concise, professional case summaries and concrete, "
    "actionable next investigative steps. Do not invent facts not present in "
    "the supplied data."
)


@router.get("/case/{report_id}", response_model=CaseSummaryResponse)
def case_summary(report_id: str, account_id: str | None = None):
    report = get_report(report_id)
    if report is None:
        # Check if it's an incident ID or unindexed report with grounded analysis
        grounded = generate_grounded_copilot_analysis(report_id, account_id)
        if not grounded["has_sufficient_evidence"]:
            raise HTTPException(status_code=404, detail="Report not found")
        return {
            "case_id": report_id,
            "priority": grounded["priority"],
            "summary": grounded["executive_summary"],
            "suggested_next_steps": [r["action_title"] for r in grounded["recommendations"][:3]],
        }

    graph_context = ""
    if account_id:
        ring_info = get_ring_info(account_id)
        graph_context = (
            f"\nLinked fraud-graph data for account {account_id}: "
            f"flagged={ring_info['is_flagged']}, "
            f"mule_probability={ring_info['mule_probability']}, "
            f"ring_id={ring_info['ring_id']}, "
            f"connected_accounts={ring_info['connected_accounts']}."
        )

    prompt = (
        f"Report category: {report['category']}\n"
        f"Reporter: {report['reporter_name']}\n"
        f"Description: {report['description']}"
        f"{graph_context}\n\n"
        "Write: (1) a 2-3 sentence case summary, (2) a priority of low/medium/"
        "high/critical with one reason, (3) three concrete next investigative "
        "steps as a bulleted list."
    )
    ai_output = ask_claude(SYSTEM_PROMPT, prompt, max_tokens=500)

    priority = "medium"
    lowered = ai_output.lower()
    for level in ("critical", "high", "medium", "low"):
        if level in lowered:
            priority = level
            break

    next_steps = [
        line.strip("-• ").strip()
        for line in ai_output.splitlines()
        if line.strip().startswith(("-", "•"))
    ] or ["Review linked fraud-graph accounts", "Contact reporter for evidence", "Escalate if priority is high/critical"]

    return {
        "case_id": report_id,
        "priority": priority,
        "summary": ai_output,
        "suggested_next_steps": next_steps[:3],
    }


@router.get("/copilot/grounded/{identifier}", response_model=EvidenceGroundedCopilotResponse)
def get_grounded_copilot_analysis(identifier: str, account_id: str | None = None):
    """
    Retrieves a 4-tier evidence-grounded copilot recommendation analysis citing:
    1. Incident fields & verified facts
    2. Unverified citizen claims needing corroboration
    3. System signals (mule probabilities, network centrality)
    4. Material model suggestions citing approved Standard Operating Procedures
    """
    result = generate_grounded_copilot_analysis(identifier, account_id)
    return result


@router.post("/copilot/recommendation/{rec_id}/feedback", response_model=CopilotRecommendation)
def post_copilot_feedback(rec_id: str, request: CopilotFeedbackRequest):
    """
    Allows officers to flag recommendations as helpful, incorrect, or unsupported with optional notes.
    """
    try:
        updated = submit_feedback(
            rec_id=rec_id,
            feedback=request.feedback,
            notes=request.notes,
            officer_badge=request.officer_badge,
        )
        return updated
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/copilot/recommendation/{rec_id}/approval", response_model=CopilotRecommendation)
def post_copilot_approval(rec_id: str, request: CopilotApprovalRequest):
    """
    Enforces human approval guardrail for consequential actions (e.g. Section 91 CrPC freeze/notices).
    """
    try:
        updated = submit_approval(
            rec_id=rec_id,
            decision=request.decision,
            officer_badge=request.officer_badge,
            notes=request.approval_notes,
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
