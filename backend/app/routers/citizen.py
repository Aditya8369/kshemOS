from fastapi import APIRouter

from app.models import (
    CitizenAskRequest,
    CitizenAskResponse,
    CitizenReportRequest,
    CitizenReportResponse,
)
from app.services.claude_client import ask_claude
from app.services.incidents import create_incident
from app.services.store import save_report

router = APIRouter(prefix="/api/citizen", tags=["Citizen Assistant Agent"])

SYSTEM_PROMPT = (
    "You are the KshemOS Citizen Assistant, a calm, plain-language safety "
    "helper for Indian citizens dealing with suspected digital-arrest scams, "
    "counterfeit currency, or financial fraud. Always: (1) reply in the "
    "citizen's requested language, (2) never ask for OTP, passwords, or full "
    "bank details yourself, (3) recommend verifying any 'law enforcement' call "
    "through official published helpline numbers rather than any number given "
    "on the call itself, (4) keep answers short and reassuring, not alarmist."
)


@router.post("/ask", response_model=CitizenAskResponse)
def ask(payload: CitizenAskRequest):
    prompt = f"Respond in {payload.language}. Citizen question: {payload.question}"
    answer = ask_claude(SYSTEM_PROMPT, prompt, max_tokens=400)
    return {"answer": answer}


@router.post("/report", response_model=CitizenReportResponse)
def report(payload: CitizenReportRequest):
    report_id = save_report(payload.model_dump())
    incident = create_incident(
        category=payload.category,
        description=payload.description,
        region=payload.region,
        report_id=report_id,
    )

    fir_prompt = (
        f"Draft a short, factual, first-person FIR-style incident statement in "
        f"{payload.language} based on this citizen report. Category: "
        f"{payload.category}. Reporter: {payload.reporter_name}. "
        f"Description: {payload.description}. Keep it under 150 words, factual, "
        f"no speculation beyond what was reported."
    )
    draft_fir = ask_claude(SYSTEM_PROMPT, fir_prompt, max_tokens=400)

    ack_prompt = (
        f"Reply in {payload.language} with a short (2-3 sentence) reassuring "
        f"acknowledgement that report {report_id} has been received and next "
        f"steps, for category {payload.category}."
    )
    acknowledgement = ask_claude(SYSTEM_PROMPT, ack_prompt, max_tokens=200)

    return {
        "report_id": report_id,
        "incident_id": incident["id"],
        "acknowledgement": acknowledgement,
        "draft_fir": draft_fir,
    }
