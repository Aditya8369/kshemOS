"""
FastAPI Router for Citizen Digital Safety Guardian Browser Extension.
Prefix: /api/extension
"""

from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Query, Response

from app.models import (
    DeclarativeNetRequestRule,
    ExtensionRulesResponse,
    PhishHeuristicEvaluationRequest,
    PhishHeuristicEvaluationResponse,
)
from app.services import extension_guardian

router = APIRouter(prefix="/api/extension", tags=["Citizen Safety Guardian Extension"])


@router.get("/rules", response_model=ExtensionRulesResponse)
def get_compiled_rules_endpoint():
    """
    Returns dynamically compiled Manifest V3 declarativeNetRequest rules
    synthesized from kshemOS's active takedown database and regional threat mesh.
    """
    return extension_guardian.compile_declarative_rules()


@router.get("/rules/raw-json")
def get_raw_declarative_rules_endpoint():
    """
    Returns pure JSON array of declarativeNetRequest rules, ready for direct
    consumption by chrome.declarativeNetRequest.updateDynamicRules.
    """
    compiled = extension_guardian.compile_declarative_rules()
    return [rule.model_dump() for rule in compiled.rules]


@router.post("/evaluate-dom", response_model=PhishHeuristicEvaluationResponse)
def evaluate_dom_heuristics_endpoint(payload: PhishHeuristicEvaluationRequest):
    """
    DOM Heuristic Shield Endpoint:
    Evaluates form input fields, page titles, and hostnames to detect lookalike
    banking login portals requesting PINs, CVVs, NetBanking passwords, or Aadhaar OTPs.
    """
    try:
        return extension_guardian.evaluate_dom_phishing_heuristic(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DOM evaluation error: {exc}")


@router.get("/status")
def get_extension_bridge_status_endpoint():
    """
    Provides real-time bridge status, active takedown rule count, and
    Emergency Kill-Switch connectivity metrics for the browser extension popup.
    """
    compiled = extension_guardian.compile_declarative_rules()
    return {
        "status": "ONLINE",
        "extension_id": compiled.extension_id,
        "version": compiled.version,
        "active_rules_count": compiled.total_rules,
        "active_threat_domains": compiled.active_threat_domains,
        "takedowns_loaded": compiled.takedown_sources_count,
        "killswitch_url": "http://localhost:5173/?view=emergency-killswitch",
        "helpline": "1930",
        "last_compiled_at": compiled.compiled_at,
    }
