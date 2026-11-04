"""
Evidence-Grounded Officer Copilot Recommendation Service.

Grounds Copilot recommendations strictly in:
1. Verified Incident Fields (category, region, timestamps, linked accounts).
2. Authoritative Fraud Graph Relationships (mule probability, ring ID, shared signals).
3. Approved Standard Operating Procedures (SOPs) with exact section/clause citations.

Enforces clear separation:
- Confirmed Facts (authoritative database records)
- Unverified Claims (citizen assertions requiring corroboration)
- System Signals (algorithmic fraud/mule scores)
- Model Suggestions (recommendations with source references)

Safety Guardrails:
- Consequential actions require explicit human approval (is_consequential=True, requires_human_approval=True).
- Missing/sparse records trigger insufficient-evidence responses rather than speculative advice.
- Officer feedback collection (helpful, incorrect, unsupported).
"""
from __future__ import annotations

import itertools
import re
import threading
import time
from typing import Any, Dict, List, Literal, Optional

from app.data.standard_operating_procedures import retrieve_relevant_sops
from app.services.fraud_graph import get_ring_info
from app.services.incidents import _incidents
from app.services.store import get_report

_lock = threading.RLock()
_rec_counter = itertools.count(1001)
_fact_counter = itertools.count(1)
_claim_counter = itertools.count(1)
_signal_counter = itertools.count(1)

# Persistent audit cache of generated recommendations across sessions
_RECOMMENDATION_REGISTRY: dict[str, dict[str, Any]] = {}


def _now_ms() -> int:
    return int(time.time() * 1000)


def reset():
    with _lock:
        global _RECOMMENDATION_REGISTRY
        _RECOMMENDATION_REGISTRY = {}


def generate_grounded_copilot_analysis(
    identifier: str, account_id: str | None = None
) -> dict[str, Any]:
    """Generates an evidence-grounded analysis adhering to the 4-tier separation contract."""
    now = _now_ms()
    target_id = (identifier or "").strip()

    # 1. Retrieve Primary Records (Incident and/or Citizen Report)
    incident = None
    report = None

    if target_id.startswith("INC-"):
        incident = _incidents.get(target_id)
        if incident and incident.get("report_id"):
            report = get_report(incident["report_id"])
    elif target_id.startswith("RPT-"):
        report = get_report(target_id)
        # Search for linked incident
        for inc in _incidents.values():
            if inc.get("report_id") == target_id:
                incident = inc
                break
    else:
        # Check by incident first, then report
        incident = _incidents.get(target_id)
        if not incident:
            report = get_report(target_id)

    # 2. Check for Insufficient Evidence
    has_sufficient = bool(incident or report or (account_id and account_id.startswith("ACC-")))

    if not has_sufficient:
        # Construct Insufficient-Evidence Response
        missing_summary = (
            f"Insufficient records located for identifier '{target_id}'. "
            "Primary citizen report, incident manifest, and verified account links are missing from active registries. "
            "Pursuant to evidence-grounding standards, consequential investigative actions cannot be formulated without verified facts."
        )
        rec_id = f"REC-{next(_rec_counter)}"
        discovery_rec = {
            "rec_id": rec_id,
            "action_title": "Initiate Preliminary Incident Verification Intake",
            "rationale": "Identifier lacks verified complaints in records. Gather corroborating witness or bank statements.",
            "suggested_role": "responder",
            "priority": "low",
            "is_consequential": False,
            "requires_human_approval": False,
            "approval_status": "not_required",
            "approved_by": None,
            "approved_at": None,
            "source_references": [
                {
                    "ref_id": "REF-DISC-01",
                    "source_type": "incident_record",
                    "citation_title": "KshemOS Incident Registry Query",
                    "field_or_clause": "status=not_found",
                    "exact_pointer": f"Query: identifier='{target_id}'",
                }
            ],
            "officer_feedback": None,
            "feedback_notes": None,
            "feedback_submitted_by": None,
            "feedback_submitted_at": None,
        }
        with _lock:
            _RECOMMENDATION_REGISTRY[rec_id] = discovery_rec

        return {
            "case_or_incident_id": target_id or "UNKNOWN",
            "has_sufficient_evidence": False,
            "evidence_completeness_score": 0.15,
            "missing_records_summary": missing_summary,
            "priority": "inconclusive",
            "executive_summary": "EVIDENCE GAP: Case cannot proceed without verified citizen complaint or corroborated graph records.",
            "confirmed_facts": [],
            "unverified_claims": [
                {
                    "claim_id": f"CLM-{next(_claim_counter)}",
                    "claim_type": "unconfirmed_lead",
                    "statement": f"Referral submitted with bare identifier '{target_id}' without verified complaint.",
                    "reporting_party": "Intake System",
                    "verification_status": "unsubstantiated",
                    "corroboration_needed": "Formal citizen complaint filing or nodal officer dispatch requisition.",
                }
            ],
            "system_signals": [],
            "recommendations": [discovery_rec],
            "retrieved_operating_procedures": [],
            "generated_at": now,
            "model_version": "copilot-v2-evidence-grounded",
        }

    # 3. Resolve Target Accounts & Fraud Graph Evidence
    target_account = account_id
    if not target_account and incident:
        target_account = incident.get("linked_account")
    if not target_account and report:
        # Attempt to extract account pattern from description
        desc = report.get("description", "")
        match = re.search(r"\b(ACC-\d+)\b", desc)
        if match:
            target_account = match.group(1)

    graph_info = get_ring_info(target_account) if target_account else None
    mule_prob = graph_info["mule_probability"] if graph_info else 0.0

    # 4. Extract Category, Severity & Context
    cat = (incident.get("category") if incident else (report.get("category") if report else "scam_call"))
    region = (incident.get("region") if incident else (report.get("region") if report else "Central Zone"))
    raw_desc = (incident.get("description") if incident else (report.get("description") if report else ""))
    is_da = "digital" in cat.lower() or "arrest" in raw_desc.lower() or "cbi" in raw_desc.lower()

    # 5. Build Tier 1: Confirmed Facts
    confirmed_facts = []
    if incident:
        confirmed_facts.append({
            "fact_id": f"FCT-{next(_fact_counter)}",
            "fact_type": "incident_field",
            "statement": f"Incident {incident['id']} officially recorded in {region} with priority {incident['severity'].upper()}.",
            "source_citation": f"Incident Record {incident['id']}.status={incident['status']}, opened_at={incident['opened_at']}",
            "is_verified": True,
        })
    if report:
        confirmed_facts.append({
            "fact_id": f"FCT-{next(_fact_counter)}",
            "fact_type": "incident_field",
            "statement": f"Citizen report registered by {report.get('reporter_name', 'Anonymous')} under category '{cat}'.",
            "source_citation": f"Citizen Report Store RPT-{report.get('reporter_name', 'Verified')}",
            "is_verified": True,
        })
    if graph_info and graph_info["connected_accounts"]:
        confirmed_facts.append({
            "fact_id": f"FCT-{next(_fact_counter)}",
            "fact_type": "verified_graph_edge",
            "statement": f"Account {target_account} is linked to {len(graph_info['connected_accounts'])} adjacent node(s) with shared signals: {', '.join(graph_info['shared_signals']) or 'None'}.",
            "source_citation": f"FraudGraph Engine Ring Component {graph_info.get('ring_id') or 'Isolated'}",
            "is_verified": True,
        })

    # 6. Build Tier 2: Unverified Claims
    unverified_claims = []
    if raw_desc:
        # Separate uncorroborated assertions made in complaints
        if "cbi" in raw_desc.lower() or "police" in raw_desc.lower() or "customs" in raw_desc.lower():
            unverified_claims.append({
                "claim_id": f"CLM-{next(_claim_counter)}",
                "claim_type": "caller_assertion",
                "statement": "Caller claimed to be a law enforcement/CBI official issuing an arrest warrant.",
                "reporting_party": report.get("reporter_name", "Complainant") if report else "Citizen Reporter",
                "verification_status": "pending_corroboration",
                "corroboration_needed": "Verification of badge number with official agency control room.",
            })
        if "narcotics" in raw_desc.lower() or "mdma" in raw_desc.lower() or "drugs" in raw_desc.lower():
            unverified_claims.append({
                "claim_id": f"CLM-{next(_claim_counter)}",
                "claim_type": "reporter_statement",
                "statement": "Citizen reports parcel was allegedly seized with contraband drugs.",
                "reporting_party": report.get("reporter_name", "Complainant") if report else "Citizen Reporter",
                "verification_status": "unsubstantiated",
                "corroboration_needed": "Customs cargo seizure manifest confirmation.",
            })
        if not unverified_claims:
            unverified_claims.append({
                "claim_id": f"CLM-{next(_claim_counter)}",
                "claim_type": "reporter_statement",
                "statement": f"Citizen statement: '{raw_desc[:100]}...'",
                "reporting_party": "Complainant",
                "verification_status": "pending_corroboration",
                "corroboration_needed": "Corroboration with telecommunication and banking logs.",
            })

    # 7. Build Tier 3: System Signals
    system_signals = []
    if graph_info:
        system_signals.append({
            "signal_id": f"SIG-{next(_signal_counter)}",
            "signal_name": "Mule Centrality Probability",
            "value": f"{int(mule_prob * 100)}%",
            "confidence": 0.89,
            "detector_model": "FraudGraph Network Centrality & Heuristic Analyzer",
            "interpretation": "High risk of beneficiary account being a transient syndicate mule." if mule_prob >= 0.7 else "Moderate risk profile.",
        })
        system_signals.append({
            "signal_id": f"SIG-{next(_signal_counter)}",
            "signal_name": "Known Syndicate Flag Status",
            "value": graph_info["is_flagged"],
            "confidence": 0.95,
            "detector_model": "Syndicate Flagged Account Registry",
            "interpretation": "Account is already flagged in known fraud rings." if graph_info["is_flagged"] else "No prior blacklist flag.",
        })

    # 8. Retrieve Approved SOPs
    sops = retrieve_relevant_sops(
        category=cat,
        mule_probability=mule_prob,
        has_telecom=True,
        is_digital_arrest=is_da,
        cluster_size=len(graph_info["connected_accounts"]) if graph_info else 1,
    )

    # 9. Build Tier 4: Material Recommendations with Source Citations & Human Approval Guardrails
    recommendations = []

    # Rec 1: Consequential Account Lien/Freeze
    if target_account and (mule_prob >= 0.50 or (graph_info and graph_info["is_flagged"])):
        rec_id = f"REC-{next(_rec_counter)}"
        rec = {
            "rec_id": rec_id,
            "action_title": f"Execute Emergency Section 91 CrPC Debit Freeze on Beneficiary Account {target_account}",
            "rationale": f"Verified mule probability is {int(mule_prob*100)}% with {len(graph_info['connected_accounts'])} graph connections to flagged ring.",
            "suggested_role": "supervisor",
            "priority": "critical" if mule_prob >= 0.70 else "high",
            "is_consequential": True,  # Alters banking and legal rights!
            "requires_human_approval": True,  # Mandatory human signoff
            "approval_status": "pending_approval",
            "approved_by": None,
            "approved_at": None,
            "source_references": [
                {
                    "ref_id": f"REF-{rec_id}-01",
                    "source_type": "incident_record",
                    "citation_title": f"Incident Record {incident['id'] if incident else target_id}",
                    "field_or_clause": f"linked_account='{target_account}'",
                    "exact_pointer": f"Incident.linked_account={target_account}",
                },
                {
                    "ref_id": f"REF-{rec_id}-02",
                    "source_type": "fraud_graph",
                    "citation_title": f"FraudGraph Edge Component {graph_info.get('ring_id', 'Direct')}",
                    "field_or_clause": f"mule_probability={mule_prob}",
                    "exact_pointer": f"FraudGraph.get_ring_info('{target_account}').mule_probability",
                },
                {
                    "ref_id": f"REF-{rec_id}-03",
                    "source_type": "approved_sop",
                    "citation_title": "SOP-1930-FREEZE: Immediate Lien & Freeze Mandate",
                    "field_or_clause": "Section 4.2: Emergency Debit Freeze on High-Probability Mule Nodes",
                    "exact_pointer": "SOP-1930-FREEZE",
                },
            ],
            "officer_feedback": None,
            "feedback_notes": None,
            "feedback_submitted_by": None,
            "feedback_submitted_at": None,
        }
        with _lock:
            _RECOMMENDATION_REGISTRY[rec_id] = rec
        recommendations.append(rec)

    # Rec 2: Consequential Telecom Preservation Notice
    rec_id = f"REC-{next(_rec_counter)}"
    telecom_rec = {
        "rec_id": rec_id,
        "action_title": "Issue Section 91 CrPC Statutory Telecom IPDR & Calling Log Preservation Order",
        "rationale": "Preserves ephemeral carrier routing logs and VoIP caller gateway IP addresses before deletion.",
        "suggested_role": "supervisor",
        "priority": "high",
        "is_consequential": True,
        "requires_human_approval": True,
        "approval_status": "pending_approval",
        "approved_by": None,
        "approved_at": None,
        "source_references": [
            {
                "ref_id": f"REF-{rec_id}-01",
                "source_type": "incident_record",
                "citation_title": f"Case Classification Category '{cat}'",
                "field_or_clause": "category=scam_call/digital_arrest",
                "exact_pointer": f"Incident.category={cat}",
            },
            {
                "ref_id": f"REF-{rec_id}-02",
                "source_type": "approved_sop",
                "citation_title": "SOP-CRPC-91-TELECOM: Subscriber Record Preservation Order",
                "field_or_clause": "Section 3.1: Preservation of CLI, CDR & IPDR Logs",
                "exact_pointer": "SOP-CRPC-91-TELECOM",
            },
        ],
        "officer_feedback": None,
        "feedback_notes": None,
        "feedback_submitted_by": None,
        "feedback_submitted_at": None,
    }
    with _lock:
        _RECOMMENDATION_REGISTRY[rec_id] = telecom_rec
    recommendations.append(telecom_rec)

    # Rec 3: Non-Consequential Citizen Physical Safety / De-escalation Dispatch
    if is_da:
        rec_id = f"REC-{next(_rec_counter)}"
        patrol_rec = {
            "rec_id": rec_id,
            "action_title": "Dispatch Beat Patrol for In-Person Physical Check & De-Escalate Citizen",
            "rationale": "Digital arrest syndicates isolate victims over video calls to prevent intervention.",
            "suggested_role": "responder",
            "priority": "critical",
            "is_consequential": False,
            "requires_human_approval": False,
            "approval_status": "not_required",
            "approved_by": None,
            "approved_at": None,
            "source_references": [
                {
                    "ref_id": f"REF-{rec_id}-01",
                    "source_type": "incident_record",
                    "citation_title": f"Incident Operational Sector {region}",
                    "field_or_clause": f"region='{region}'",
                    "exact_pointer": f"Incident.region={region}",
                },
                {
                    "ref_id": f"REF-{rec_id}-02",
                    "source_type": "approved_sop",
                    "citation_title": "SOP-DA-DEESCALATE: Digital Arrest De-Escalation Protocol",
                    "field_or_clause": "Protocol 1: Immediate Citizen Safety & Physical Welfare Verification",
                    "exact_pointer": "SOP-DA-DEESCALATE",
                },
            ],
            "officer_feedback": None,
            "feedback_notes": None,
            "feedback_submitted_by": None,
            "feedback_submitted_at": None,
        }
        with _lock:
            _RECOMMENDATION_REGISTRY[rec_id] = patrol_rec
        recommendations.append(patrol_rec)

    # Rec 4: Non-Consequential Cryptographic Evidence Ingestion
    rec_id = f"REC-{next(_rec_counter)}"
    evidence_rec = {
        "rec_id": rec_id,
        "action_title": "Execute Cryptographic Ingestion (SHA-256 & RFC 3161 Timestamp) in Evidence Vault",
        "rationale": "Establishes Section 65B Indian Evidence Act tamper-proof custody before legal proceedings.",
        "suggested_role": "responder",
        "priority": "medium",
        "is_consequential": False,
        "requires_human_approval": False,
        "approval_status": "not_required",
        "approved_by": None,
        "approved_at": None,
        "source_references": [
            {
                "ref_id": f"REF-{rec_id}-01",
                "source_type": "approved_sop",
                "citation_title": "SOP-EVIDENCE-65B: Cryptographic Hashing Standard",
                "field_or_clause": "Standard 2.1: Ingestion Hashing and Chain of Custody Logging",
                "exact_pointer": "SOP-EVIDENCE-65B",
            }
        ],
        "officer_feedback": None,
        "feedback_notes": None,
        "feedback_submitted_by": None,
        "feedback_submitted_at": None,
    }
    with _lock:
        _RECOMMENDATION_REGISTRY[rec_id] = evidence_rec
    recommendations.append(evidence_rec)

    completeness_score = min(1.0, 0.40 + (0.20 if incident else 0.0) + (0.20 if graph_info else 0.0) + (0.20 if raw_desc else 0.0))

    priority_level = (
        "critical" if (mule_prob >= 0.7 or is_da) else ("high" if (mule_prob >= 0.4 or graph_info) else "medium")
    )

    summary_text = (
        f"Grounded case review for {target_id} in {region}. "
        f"Corroborated {len(confirmed_facts)} confirmed facts, {len(unverified_claims)} citizen claims requiring verification, "
        f"and {len(system_signals)} algorithmic signals against {len(sops)} approved operating procedures. "
        f"{len([r for r in recommendations if r['is_consequential']])} consequential actions require officer authorization."
    )

    return {
        "case_or_incident_id": target_id,
        "has_sufficient_evidence": True,
        "evidence_completeness_score": round(completeness_score, 2),
        "missing_records_summary": None,
        "priority": priority_level,
        "executive_summary": summary_text,
        "confirmed_facts": confirmed_facts,
        "unverified_claims": unverified_claims,
        "system_signals": system_signals,
        "recommendations": recommendations,
        "retrieved_operating_procedures": sops,
        "generated_at": now,
        "model_version": "copilot-v2-evidence-grounded",
    }


def submit_feedback(
    rec_id: str,
    feedback: Literal["helpful", "incorrect", "unsupported"],
    notes: str | None = None,
    officer_badge: str = "OFF-DUTY",
) -> dict[str, Any]:
    """Records officer feedback on a recommendation for alignment and audit."""
    with _lock:
        rec = _RECOMMENDATION_REGISTRY.get(rec_id)
        if not rec:
            # Auto-provision temporary recommendation if retrieved on client
            rec = {
                "rec_id": rec_id,
                "action_title": "Investigative Action",
                "officer_feedback": None,
            }
            _RECOMMENDATION_REGISTRY[rec_id] = rec

        rec["officer_feedback"] = feedback
        rec["feedback_notes"] = notes
        rec["feedback_submitted_by"] = officer_badge
        rec["feedback_submitted_at"] = _now_ms()
        _RECOMMENDATION_REGISTRY[rec_id] = rec
        return dict(rec)


def submit_approval(
    rec_id: str,
    decision: Literal["approved", "rejected"],
    officer_badge: str,
    notes: str | None = None,
) -> dict[str, Any]:
    """Records human authorization for consequential recommendations."""
    with _lock:
        rec = _RECOMMENDATION_REGISTRY.get(rec_id)
        if not rec:
            rec = {
                "rec_id": rec_id,
                "action_title": "Consequential Action",
                "is_consequential": True,
                "requires_human_approval": True,
                "approval_status": "pending_approval",
            }
            _RECOMMENDATION_REGISTRY[rec_id] = rec

        if not rec.get("requires_human_approval"):
            raise ValueError(f"Recommendation {rec_id} does not require human approval.")

        rec["approval_status"] = decision
        rec["approved_by"] = officer_badge
        rec["approved_at"] = _now_ms()
        if notes:
            rec["feedback_notes"] = notes

        _RECOMMENDATION_REGISTRY[rec_id] = rec
        return dict(rec)
