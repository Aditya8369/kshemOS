from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import scam, currency, graph, citizen, officer, llm, incidents, advisory, jurisdiction

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
app.include_router(llm.router)
app.include_router(incidents.router)
app.include_router(advisory.router)
app.include_router(jurisdiction.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "KshemOS API",
        "status": "ok",
        "docs": "/docs",
    }
