"""
Approved Standard Operating Procedures (SOPs) for Indian Cyber Crime Law Enforcement.

Authoritative reference procedures cited by the Evidence-Grounded Officer Copilot.
"""
from __future__ import annotations

APPROVED_OPERATING_PROCEDURES = [
    {
        "sop_id": "SOP-1930-FREEZE",
        "title": "Immediate Lien & Freeze Mandate on Beneficiary Mule Accounts",
        "statutory_authority": "Section 91 CrPC / Bharatiya Nagarik Suraksha Sanhita (BNSS) & CFCFRS (1930) Protocol",
        "issuing_agency": "Indian Cyber Crime Coordination Centre (I4C) & Reserve Bank of India",
        "clause_reference": "Section 4.2: Emergency Debit Freeze on High-Probability Mule Nodes",
        "trigger_criteria": "Mule probability >= 0.70 or direct transaction edge to confirmed fraudulent UPI/bank node.",
        "consequential": True,
        "is_consequential": True,
        "requires_human_approval": True,
        "recommended_action": (
            "Issue emergency Section 91 CrPC / BNSS statutory freeze order to bank nodal officer "
            "for immediate lien placement on beneficiary accounts, restricting debit/outward transfers."
        ),
        "required_approver_role": "supervisor",
    },
    {
        "sop_id": "SOP-CRPC-91-TELECOM",
        "title": "Statutory Telecom & ISP Subscriber Record Preservation Order",
        "statutory_authority": "Section 91 CrPC / BNSS & Rule 419A Indian Telegraph Rules",
        "issuing_agency": "Ministry of Communications (DoT) & Cyber Crime Investigation Directorate",
        "clause_reference": "Section 3.1: Preservation of Calling Line Identification (CLI), CDR & IPDR Logs",
        "trigger_criteria": "Unverified VoIP calling, spoofed law-enforcement CLI, or WhatsApp call vector.",
        "consequential": True,
        "is_consequential": True,
        "requires_human_approval": True,
        "recommended_action": (
            "Serve statutory notice on telecom service provider nodal officer requiring 1-year preservation "
            "of Call Detail Records (CDR), IP Detail Records (IPDR), and cell-tower triangulation telemetry."
        ),
        "required_approver_role": "supervisor",
    },
    {
        "sop_id": "SOP-DA-DEESCALATE",
        "title": "Digital Arrest & Coercive Law Enforcement Impersonation De-Escalation Protocol",
        "statutory_authority": "MHA / I4C National Advisory on Digital Arrest Extortion Syndicates",
        "issuing_agency": "Ministry of Home Affairs, Government of India",
        "clause_reference": "Protocol 1: Immediate Citizen Safety & Physical Welfare Verification",
        "trigger_criteria": "Category 'digital_arrest' or coercive threat indicators involving CBI, Police, Customs, or Court.",
        "consequential": False,
        "is_consequential": False,
        "requires_human_approval": False,
        "recommended_action": (
            "Immediately dispatch local beat / PCR patrol unit for in-person physical verification of victim. "
            "Direct citizen to terminate active video call and reassure them that genuine law enforcement agencies "
            "never execute arrests or demand financial settlements over digital video calls."
        ),
        "required_approver_role": "responder",
    },
    {
        "sop_id": "SOP-MULE-CLUSTER",
        "title": "Cross-Jurisdiction Syndicate Mule Ring Disruption & Inter-State Coordination",
        "statutory_authority": "Standard Investigation Procedure for Organized Interstate Cyber Fraud Syndicates",
        "issuing_agency": "National Cyber Crime Threat Analytics Unit (TAU)",
        "clause_reference": "Clause 5.4: Shared Infrastructure & Multi-Zone Syndicate Clustering",
        "trigger_criteria": "Graph cluster containing >= 3 connected accounts or multi-jurisdiction shared signals.",
        "consequential": True,
        "is_consequential": True,
        "requires_human_approval": True,
        "recommended_action": (
            "Mobilize Joint Taskforce review across involved police jurisdictions and request dynamic mutual aid "
            "resource rebalancing to seize operating hardware and intercept active cash-out mules."
        ),
        "required_approver_role": "commander",
    },
    {
        "sop_id": "SOP-EVIDENCE-65B",
        "title": "Digital Evidence Cryptographic Hashing & Forensic Custody Manifest",
        "statutory_authority": "Section 65B Indian Evidence Act / Section 63 Bharatiya Sakshya Adhiniyam (BSA)",
        "issuing_agency": "Central Forensic Science Laboratory (CFSL) Guidelines",
        "clause_reference": "Standard 2.1: Immediate Ingestion Hashing and Chain of Custody Logging",
        "trigger_criteria": "Audio recordings, live transcripts, payment receipts, or APK artifacts.",
        "consequential": False,
        "is_consequential": False,
        "requires_human_approval": False,
        "recommended_action": (
            "Generate cryptographically verifiable SHA-256 fingerprint and RFC 3161 trusted timestamp token "
            "upon ingestion, creating an immutable ledger entry before evidentiary analysis."
        ),
        "required_approver_role": "responder",
    },
]

ALL_SOPS = APPROVED_OPERATING_PROCEDURES


def retrieve_relevant_sops(
    category: str | None = None,
    mule_probability: float = 0.0,
    has_telecom: bool = False,
    is_digital_arrest: bool = False,
    cluster_size: int = 1,
) -> list[dict]:
    """Retrieves relevant approved SOPs matching case facts and signals."""
    sops = []
    for sop in APPROVED_OPERATING_PROCEDURES:
        sop_id = sop["sop_id"]
        if sop_id == "SOP-1930-FREEZE" and (mule_probability >= 0.50 or category in ("fraud_tx", "scam_call", "digital_arrest")):
            sops.append(dict(sop))
        elif sop_id == "SOP-CRPC-91-TELECOM" and (has_telecom or is_digital_arrest or category in ("scam_call", "digital_arrest")):
            sops.append(dict(sop))
        elif sop_id == "SOP-DA-DEESCALATE" and is_digital_arrest:
            sops.append(dict(sop))
        elif sop_id == "SOP-MULE-CLUSTER" and (cluster_size >= 2 or mule_probability >= 0.70):
            sops.append(dict(sop))
        elif sop_id == "SOP-EVIDENCE-65B":
            sops.append(dict(sop))

    return sops or [APPROVED_OPERATING_PROCEDURES[0]]
