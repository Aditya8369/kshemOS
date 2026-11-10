from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    scam,
    currency,
    graph,
    citizen,
    officer,
    llm,
    incidents,
    advisory,
    jurisdiction,
    response_teams,
    mutual_aid,
    geofence,
    alerts,
    triage,
    drills,
    multilingual_asr,
    live_call_safety,
    incident_notifications,
    official_contacts,
    dpdp,
    evidence,
    evidence_affidavit,
    cli_spoof,
    syndicate_triage,
    mule_freeze,
    voice_safety_hotline,
)

app = FastAPI(
    title="KshemOS API",
    description=(
        "AI operating system for digital public safety — digital-arrest scam "
        "detection, counterfeit currency scanning, fraud-graph intelligence, "
        "citizen assistant, and officer copilot, wired together as a set of "
        "collaborating agents."
    ),
    version="0.1.0",
)

# Permissive CORS for hackathon demo purposes — tighten before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scam.router)
app.include_router(currency.router)
app.include_router(graph.router)
app.include_router(citizen.router)
app.include_router(officer.router)
app.include_router(response_teams.router)
app.include_router(llm.router)
app.include_router(incidents.router)
app.include_router(advisory.router)
app.include_router(jurisdiction.router)
app.include_router(mutual_aid.router)
app.include_router(geofence.router)
app.include_router(alerts.router)
app.include_router(triage.router)
app.include_router(drills.router)
app.include_router(multilingual_asr.router)
app.include_router(live_call_safety.router)
app.include_router(incident_notifications.router)
app.include_router(official_contacts.router)
app.include_router(dpdp.router)
app.include_router(evidence.router)
app.include_router(evidence_affidavit.router)
app.include_router(cli_spoof.router)
app.include_router(syndicate_triage.router)
app.include_router(mule_freeze.router)
app.include_router(voice_safety_hotline.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "KshemOS API",
        "status": "ok",
        "docs": "/docs",
    }


# ============================================================
# CENTRALIZED AUDIT LOGGING & COMPLIANCE
# ============================================================

import logging

from fastapi import Request
from app.routers.audit import router as audit_router
from app.services import audit


logger = logging.getLogger(__name__)


@app.middleware("http")
async def audit_api_requests(request: Request, call_next):
    """Capture API request activity in the centralized audit service."""

    path = request.url.path

    # Prevent recursive logging of audit API requests.
    if (
        not path.startswith("/api/")
        or path.startswith("/api/audit/")
        or request.method == "OPTIONS"
    ):
        return await call_next(request)

    parts = path.strip("/").split("/")
    resource_type = parts[1] if len(parts) > 1 else "unknown"

    def record_request(status_code, exception_type=None):
        if status_code in (401, 403):
            outcome = "denied"
        elif status_code >= 400:
            outcome = "failure"
        else:
            outcome = "success"

        metadata = {
            "method": request.method,
            "path": path,
            "http_status": status_code,
        }

        if exception_type:
            metadata["exception_type"] = exception_type

        try:
            audit.record_event(
                actor_id="anonymous",
                actor_role="unknown",
                action=f"HTTP_{request.method}",
                resource_type=resource_type,
                resource_id=path,
                outcome=outcome,
                metadata=metadata,
                source="http_middleware",
            )
        except Exception:
            logger.exception("Audit event recording failed")

    try:
        response = await call_next(request)
    except Exception as exc:
        record_request(500, type(exc).__name__)
        raise

    record_request(response.status_code)

    return response


# Register centralized audit API.
app.include_router(audit_router)
