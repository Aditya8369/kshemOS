"""
SIM Box & Spoofed Calling Line Identification (CLI) Detection Engine Service.

Capabilities:
1. Validates incoming caller ID against TRAI National Numbering Plans (NNP),
   telecom circle allocations, and official verified police/agency directories.
2. Inspects SIP trunk headers (From, Contact, User-Agent, PAI, X-Call-Route)
   and cross-references against known SIM box hardware signatures and offshore VoIP gateways.
3. Scores carrier legitimacy using acoustic/network telemetry: round-trip audio latency,
   packet jitter, packet loss, and circle routing anomalies.
4. Generates statutory citizen alerts with the mandatory warning banner:
   "Warning: Official law enforcement agencies never place summons or arrest demands via WhatsApp VoIP or international trunks."
5. Dispatches carrier ingress indicators and rogue gateway fingerprints to the Officer Telecom Triage Dashboard.
"""

from __future__ import annotations

import copy
import hashlib
import ipaddress
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.models import (
    SpoofAnomalyFlag,
    TelecomTriageIncident,
    TelecomTriageSummary,
    TelephonyRouteVerificationRequest,
    TelephonyRouteVerificationResponse,
)

_lock = threading.RLock()

# Mandatory Citizen Warning Banner as required by public safety directives
MANDATORY_WARNING_BANNER = (
    "Warning: Official law enforcement agencies never place summons or arrest demands via WhatsApp VoIP or international trunks."
)

# -----------------------------------------------------------------------------
# TRAI Directory & Official Government / Police Registry
# -----------------------------------------------------------------------------

# Major Indian Telecom Circles & STD Codes
TRAI_STD_CIRCLES: Dict[str, Dict[str, str]] = {
    "011": {"circle_code": "DL", "circle_name": "Delhi Metro", "default_operator": "MTNL Fixed / BSNL"},
    "022": {"circle_code": "MH", "circle_name": "Mumbai / Maharashtra", "default_operator": "MTNL Fixed / Tata Tele"},
    "080": {"circle_code": "KA", "circle_name": "Bengaluru / Karnataka", "default_operator": "BSNL Fixed / Airtel"},
    "044": {"circle_code": "TN", "circle_name": "Chennai / Tamil Nadu", "default_operator": "BSNL Fixed / Airtel"},
    "033": {"circle_code": "WB", "circle_name": "Kolkata / West Bengal", "default_operator": "BSNL Fixed"},
    "040": {"circle_code": "AP", "circle_name": "Hyderabad / Telangana", "default_operator": "BSNL Fixed / ACT"},
    "020": {"circle_code": "MH", "circle_name": "Pune / Maharashtra", "default_operator": "BSNL Fixed"},
    "079": {"circle_code": "GJ", "circle_name": "Ahmedabad / Gujarat", "default_operator": "BSNL Fixed"},
    "0141": {"circle_code": "RJ", "circle_name": "Jaipur / Rajasthan", "default_operator": "BSNL Fixed"},
    "0522": {"circle_code": "UP", "circle_name": "Lucknow / Uttar Pradesh (East)", "default_operator": "BSNL Fixed"},
    "0755": {"circle_code": "MP", "circle_name": "Bhopal / Madhya Pradesh", "default_operator": "BSNL Fixed"},
    "0172": {"circle_code": "PB", "circle_name": "Chandigarh / Punjab", "default_operator": "BSNL Fixed"},
}

# Verified Official Law Enforcement / Investigative Agency Phone Numbers
# Key: normalized digits (e.g. "912222620111" or "02222620111")
OFFICIAL_POLICE_DIRECTORIES: Dict[str, Dict[str, Any]] = {
    "912222620111": {
        "agency": "Mumbai Police Commissionerate HQ",
        "jurisdiction": "Mumbai, Maharashtra",
        "std_code": "022",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://mumbaipolice.gov.in/",
    },
    "02222620111": {
        "agency": "Mumbai Police Commissionerate HQ",
        "jurisdiction": "Mumbai, Maharashtra",
        "std_code": "022",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://mumbaipolice.gov.in/",
    },
    "912222620834": {
        "agency": "Mumbai Police Cyber Crime Cell",
        "jurisdiction": "Mumbai, Maharashtra",
        "std_code": "022",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://mumbaipolice.gov.in/",
    },
    "911124368800": {
        "agency": "Central Bureau of Investigation (CBI) HQ",
        "jurisdiction": "Pan-India / New Delhi",
        "std_code": "011",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://cbi.gov.in/",
    },
    "01124368800": {
        "agency": "Central Bureau of Investigation (CBI) HQ",
        "jurisdiction": "Pan-India / New Delhi",
        "std_code": "011",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://cbi.gov.in/",
    },
    "911123092011": {
        "agency": "Ministry of Home Affairs (MHA) Emergency Cell",
        "jurisdiction": "New Delhi",
        "std_code": "011",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://mha.gov.in/",
    },
    "911123210000": {
        "agency": "Telecom Regulatory Authority of India (TRAI)",
        "jurisdiction": "New Delhi",
        "std_code": "011",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://trai.gov.in/",
    },
    "911123412235": {
        "agency": "Delhi Police Cyber Cell (Special Cell)",
        "jurisdiction": "Delhi Metro",
        "std_code": "011",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://delhipolice.gov.in/",
    },
    "918022942222": {
        "agency": "Karnataka CID Cyber Crime Division",
        "jurisdiction": "Bengaluru, Karnataka",
        "std_code": "080",
        "contact_type": "Official Landline (PSTN)",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://ksp.karnataka.gov.in/",
    },
    "112": {
        "agency": "Emergency Response Support System (ERSS)",
        "jurisdiction": "Pan-India",
        "std_code": "N/A",
        "contact_type": "National Emergency Shortcode",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://112.gov.in/",
    },
    "1930": {
        "agency": "National Cyber Crime Helpline (I4C)",
        "jurisdiction": "Pan-India",
        "std_code": "N/A",
        "contact_type": "Cyber Financial Fraud Shortcode",
        "authorized_channels": ["pstn_gsm"],
        "verification_source": "https://cybercrime.gov.in/",
    },
}

# -----------------------------------------------------------------------------
# SIM Box & Grey VoIP Gateway Signatures
# -----------------------------------------------------------------------------

SIMBOX_USER_AGENTS = [
    ("dinstar", "Dinstar Multi-SIM GSM Gateway", "Hardware SIM Box typically holding 16-64 consumer SIMs for grey termination."),
    ("yeastar", "Yeastar TG GSM Gateway", "Commercial multi-channel SIM gateway used for unauthorized route bypass."),
    ("goip", "GoIP Multi-Port GSM Gateway", "Widely abused VoIP-to-GSM gateway cluster for bulk CLI spoofing."),
    ("openvox", "OpenVox Wireless Gateway", "Modular GSM/VoIP gateway with SIM rotation capabilities."),
    ("hypermedia", "Hypermedia HG Gateway", "High-density SIM array gateway."),
    ("asterisk", "Asterisk Open Source PBX", "Software PBX commonly configured with unauthenticated SIP trunks."),
    ("freepbx", "FreePBX Telephony Server", "Asterisk web wrapper configured for call automation."),
    ("goautodial", "GoAutoDial Call Center Suite", "Predictive autodialer software used in scam call-center operations."),
    ("vicidial", "VICIdial Predictive Dialer", "Open source contact center suite used for bulk telemarketing/extortion."),
    ("linphone", "Linphone Softphone", "Generic open-source SIP user agent."),
    ("microsip", "MicroSIP Client", "Lightweight Windows softphone."),
    ("zoiper", "Zoiper SIP Client", "Softphone software."),
]

# Known Offshore Grey Transit / Bulletproof IP Blocks
OFFSHORE_GREY_IP_BLOCKS = [
    ("185.220.101.", "Netherlands / Offshore Proxy Relay", "Known bulletproof hosting and anonymized VoIP gateway cluster."),
    ("194.38.20.", "Cyprus / Eastern Europe VoIP Relay", "Unregistered international transit trunk without TRAI PoI license."),
    ("103.241.88.", "Mewat-NCR Rogue IP Subnet", "Unlicensed virtual VoIP gateway used by Mewat extortion cluster."),
    ("45.154.255.", "Cambodia / Poipet Transit Relay", "Southeast Asian cyber scam park VoIP gateway."),
    ("103.112.44.", "Hong Kong VPN Relay", "Commercial VPN exit node backhauling scam call center traffic."),
    ("198.51.100.", "International Grey Route Test Relay", "Simulated unverified offshore SIP trunk."),
]

# In-Memory Triage Stores
_triage_incidents: Dict[str, Dict[str, Any]] = {}
_verifications: Dict[str, Dict[str, Any]] = {}

# -----------------------------------------------------------------------------
# Telephony Route Verification Core Logic
# -----------------------------------------------------------------------------

def _normalize_phone_number(phone: str) -> str:
    """Normalize input phone string into clean digits."""
    return re.sub(r"\D", "", phone or "")


def _identify_trai_circle(phone_digits: str) -> Dict[str, Any]:
    """Look up telecom circle information from TRAI numbering plan."""
    clean = phone_digits
    if clean.startswith("91") and len(clean) > 10:
        clean = clean[2:]

    # Check fixed-line STD code
    for std, info in TRAI_STD_CIRCLES.items():
        std_clean = std.lstrip("0")
        if clean.startswith(std) or clean.startswith(std_clean):
            return {
                "circle_code": info["circle_code"],
                "circle_name": info["circle_name"],
                "operator": info["default_operator"],
                "number_type": "Official Landline / STD Fixed",
                "std_code": std,
            }

    # Mobile prefix check (10 digits starting with 6-9)
    if len(clean) == 10 and clean[0] in "6789":
        prefix = clean[:2]
        circle_name = "Pan-India Mobile GSM"
        circle_code = "IN-MOB"
        if prefix in ("98", "99", "97", "88"):
            circle_name = "Metro & Tier-1 Circle Mobile"
        return {
            "circle_code": circle_code,
            "circle_name": circle_name,
            "operator": "Indian GSM Operator (Jio / Airtel / Vi / BSNL)",
            "number_type": "Mobile Cellular (GSM/LTE)",
            "std_code": "N/A",
        }

    # Shortcodes
    if clean in ("112", "1930", "100"):
        return {
            "circle_code": "NATIONAL",
            "circle_name": "Pan-India Emergency Response",
            "operator": "DoT Dedicated Priority Shortcode",
            "number_type": "Emergency Toll-Free Shortcode",
            "std_code": "N/A",
        }

    return {
        "circle_code": "UNKNOWN",
        "circle_name": "Unallocated / Foreign Number Range",
        "operator": "Unrecognized Telecom Carrier",
        "number_type": "Virtual / International",
        "std_code": "N/A",
    }


def _check_known_police_directory(digits: str) -> Optional[Dict[str, Any]]:
    """Check if the number matches a known police or investigative agency."""
    if digits in OFFICIAL_POLICE_DIRECTORIES:
        return OFFICIAL_POLICE_DIRECTORIES[digits]

    # Try with 91 prefix
    if not digits.startswith("91") and f"91{digits}" in OFFICIAL_POLICE_DIRECTORIES:
        return OFFICIAL_POLICE_DIRECTORIES[f"91{digits}"]

    # Try stripping leading 0 or 91
    clean = digits.lstrip("0")
    if clean.startswith("91"):
        clean = clean[2:]
    for k, v in OFFICIAL_POLICE_DIRECTORIES.items():
        k_clean = k.lstrip("0")
        if k_clean.startswith("91"):
            k_clean = k_clean[2:]
        if clean == k_clean:
            return v

    return None


def verify_telephony_route(
    req: TelephonyRouteVerificationRequest,
) -> Dict[str, Any]:
    """
    Perform deep verification of incoming telephony route, cross-referencing
    CLI metadata, TRAI numbering plan, SIP trunk headers, and latency telemetry.
    """
    with _lock:
        call_id = req.call_id or f"CALL-{int(time.time() * 1000)}"
        verif_id = f"CLI-VERIF-{hashlib.sha256(f'{call_id}:{req.claimed_cli}'.encode()).hexdigest()[:8].upper()}"

        raw_cli = req.claimed_cli.strip()
        digits = _normalize_phone_number(raw_cli)
        claimed_entity = req.claimed_entity or "Unspecified Caller"
        call_channel = req.call_channel
        sip_headers = req.sip_headers or {}
        ingress_ip = req.carrier_ingress_ip or ""
        latency_ms = req.audio_latency_ms if req.audio_latency_ms is not None else 45.0
        jitter_ms = req.packet_jitter_ms if req.packet_jitter_ms is not None else 12.0
        loss_pct = req.packet_loss_pct if req.packet_loss_pct is not None else 0.2

        # 1. Circle & Directory Lookup
        trai_info = _identify_trai_circle(digits)
        official_match = _check_known_police_directory(digits)
        is_known_gov = official_match is not None

        trai_circle_info = {
            "circle_code": trai_info["circle_code"],
            "circle_name": trai_info["circle_name"],
            "operator": trai_info["operator"],
            "number_type": trai_info["number_type"],
            "is_known_government_police_number": is_known_gov,
            "verified_department": official_match["agency"] if official_match else None,
        }

        # 2. Evaluate Anomaly Flags
        anomaly_flags: List[Dict[str, Any]] = []
        is_spoofed = False
        carrier_score = 100.0

        # Flag Check A: Law Enforcement / Court Claimed Over WhatsApp / Skype / Telegram
        is_gov_claimed = is_known_gov or any(
            term in claimed_entity.lower()
            for term in ["police", "cbi", "crime branch", "customs", "supreme court", "high court", "ed officer", "narcotics"]
        )

        if is_gov_claimed and call_channel in ("whatsapp_voip", "skype_voip", "telegram_call"):
            is_spoofed = True
            carrier_score -= 60.0
            anomaly_flags.append({
                "flag_type": "UNOFFICIAL_VOIP_PROTOCOL",
                "severity": "CRITICAL",
                "description": (
                    f"Official government entity ({claimed_entity}) is contacting citizen via {call_channel.upper()}. "
                    "Law enforcement agencies in India are strictly prohibited by DoT/MHA regulations from issuing summons, "
                    "arrest notices, or financial demands over consumer OTT VoIP channels."
                ),
                "statutory_reference": "DoT Directive on Law Enforcement Telephony Protocol / CrPC § 61-69 Summons Rules",
            })

        # Flag Check B: Landline Number Ingressing Via Foreign or Untrusted VoIP Trunk
        user_agent = sip_headers.get("user_agent", "") or sip_headers.get("User-Agent", "")
        contact_hdr = sip_headers.get("contact", "") or sip_headers.get("Contact", "")
        from_hdr = sip_headers.get("from_header", "") or sip_headers.get("From", "")
        pai_hdr = sip_headers.get("p_asserted_identity", "") or sip_headers.get("P-Asserted-Identity", "")

        is_simbox_detected = False
        detected_gateway_model = None

        # Check SIM box signatures
        for sig_kw, model_name, sig_desc in SIMBOX_USER_AGENTS:
            if sig_kw in user_agent.lower() or sig_kw in contact_hdr.lower():
                is_simbox_detected = True
                detected_gateway_model = model_name
                is_spoofed = True
                carrier_score -= 35.0
                anomaly_flags.append({
                    "flag_type": "SIMBOX_USER_AGENT_SIGNATURE",
                    "severity": "CRITICAL",
                    "description": f"SIP headers match known grey SIM Box gateway hardware ({model_name}). {sig_desc}",
                    "statutory_reference": "Indian Telegraph Act § 4 / TRAI Prohibition on Illegal Telephony Gateways",
                })
                break

        # Check Offshore Grey IP Ingress
        is_offshore_ip = False
        ingress_country = "India (Domestic Gateway)"

        if ingress_ip:
            for prefix, origin_country, block_desc in OFFSHORE_GREY_IP_BLOCKS:
                if ingress_ip.startswith(prefix):
                    is_offshore_ip = True
                    ingress_country = origin_country
                    is_spoofed = True
                    carrier_score -= 40.0
                    anomaly_flags.append({
                        "flag_type": "OFFSHORE_VOIP_INGRESS",
                        "severity": "CRITICAL",
                        "description": f"Incoming call stream originates from unverified offshore IP {ingress_ip} ({origin_country}). {block_desc}",
                        "statutory_reference": "DoT International Long Distance (ILD) Traffic Bypass Regulations",
                    })
                    break

            # Check if IP is public non-Indian via ipaddress
            try:
                ip_obj = ipaddress.ip_address(ingress_ip)
                if not (ip_obj.is_private or ip_obj.is_loopback):
                    # Flag international route mismatch if presenting an Indian landline CLI (+91 11 / +91 22)
                    if (digits.startswith("9111") or digits.startswith("9122") or digits.startswith("011") or digits.startswith("022")) and is_offshore_ip:
                        anomaly_flags.append({
                            "flag_type": "INTERNATIONAL_ROUTE_MISMATCH",
                            "severity": "CRITICAL",
                            "description": (
                                f"CLI presents local Indian police/agency landline ({raw_cli}), but physical SIP trunk "
                                f"enters via international transit gateway {ingress_ip}. Classical grey ILD CLI-tampering."
                            ),
                            "statutory_reference": "DoT Security Conditions for Unified License Clause 39.23 (CLI Spoofing)",
                        })
            except Exception:
                pass

        # Flag Check C: P-Asserted-Identity (PAI) vs From Header Discrepancy
        if pai_hdr and from_hdr:
            pai_digits = _normalize_phone_number(pai_hdr)
            from_digits = _normalize_phone_number(from_hdr)
            if pai_digits and from_digits and pai_digits != from_digits:
                is_spoofed = True
                carrier_score -= 30.0
                anomaly_flags.append({
                    "flag_type": "SIP_HEADER_IDENTITY_MISMATCH",
                    "severity": "HIGH",
                    "description": (
                        f"SIP From header claims identity '{from_digits}', but P-Asserted-Identity specifies '{pai_digits}'. "
                        "The upstream SIP trunk is actively masquerading caller identity."
                    ),
                    "statutory_reference": "TRAI Interconnection Regulations / RFC 3325 Assertion Validation",
                })

        # Flag Check D: Acoustic & Network Telemetry (Audio Latency, Jitter, Packet Loss)
        latency_assessment = "Normal domestic latency"
        jitter_assessment = "Stable RTP stream"

        if latency_ms > 240.0:
            carrier_score -= 25.0
            latency_assessment = f"Excessive round-trip latency ({latency_ms:.1f}ms). Consistent with transcontinental grey route relay."
            anomaly_flags.append({
                "flag_type": "HIGH_LATENCY_GREY_ROUTE",
                "severity": "HIGH",
                "description": f"Round-trip audio latency measured at {latency_ms:.1f}ms (PSTN threshold <= 70ms). Signals overseas VoIP tunneling.",
                "statutory_reference": "TRAI Quality of Service (QoS) Standards for Telephony Interconnects",
            })
        elif latency_ms > 140.0:
            carrier_score -= 10.0
            latency_assessment = f"Moderate latency elevation ({latency_ms:.1f}ms)."

        if jitter_ms > 45.0 or loss_pct > 3.0:
            carrier_score -= 15.0
            jitter_assessment = f"Elevated packet jitter ({jitter_ms:.1f}ms) / loss ({loss_pct:.1f}%). Characteristic of SIM Box GSM multiplexing."
            anomaly_flags.append({
                "flag_type": "PACKET_JITTER_SIMBOX_INDICATOR",
                "severity": "MEDIUM",
                "description": f"Network jitter ({jitter_ms:.1f}ms) and packet loss ({loss_pct:.1f}%) match consumer SIM array modulation.",
            })

        # Ensure carrier legitimacy score is bounded [0, 100]
        carrier_score = max(0.0, min(100.0, carrier_score))

        # Threat Tier Calculation
        spoof_confidence = 0.0
        if is_spoofed:
            critical_count = sum(1 for f in anomaly_flags if f["severity"] == "CRITICAL")
            spoof_confidence = round(min(0.99, 0.60 + (critical_count * 0.15) + ((100 - carrier_score) / 250)), 2)

        if carrier_score <= 35.0 or any(f["severity"] == "CRITICAL" for f in anomaly_flags):
            threat_tier = "CRITICAL"
            is_spoofed = True
        elif carrier_score <= 65.0:
            threat_tier = "HIGH"
            is_spoofed = True
        elif carrier_score <= 80.0:
            threat_tier = "MEDIUM"
        elif not is_spoofed and carrier_score >= 85.0:
            threat_tier = "VERIFIED_LEGITIMATE"
        else:
            threat_tier = "LOW"

        # Recommended Action & Citizen Guidance
        if threat_tier in ("CRITICAL", "HIGH"):
            recommended_action = (
                "DO NOT COMPLY OR TRANSFER FUNDS. Disconnect call immediately. Official summons are served in person "
                "or via registered post under CrPC Section 61-69. Report caller CLI to National Cyber Crime Helpline 1930."
            )
        else:
            recommended_action = "Standard call telemetry verified. Proceed with regular citizen security precautions."

        # Forward to Officer Telecom Triage if spoofed or high threat
        forwarded = False
        triage_id = None
        if threat_tier in ("CRITICAL", "HIGH"):
            forwarded = True
            triage_id = f"TELCO-TRG-{hashlib.sha256(f'{verif_id}:{time.time()}'.encode()).hexdigest()[:8].upper()}"

            triage_record = {
                "triage_id": triage_id,
                "verification_id": verif_id,
                "claimed_cli": raw_cli,
                "carrier_ingress_ip": ingress_ip or "Hidden VoIP Transit",
                "ingress_country": ingress_country,
                "spoof_type": anomaly_flags[0]["flag_type"] if anomaly_flags else "UNKNOWN_CLI_SPOOF",
                "gateway_signature": detected_gateway_model or (user_agent[:40] if user_agent else "Generic SIP Gateway"),
                "status": "DISPATCHED_TO_TELCO",
                "target_agency_spoofed": official_match["agency"] if official_match else claimed_entity,
                "dot_reporting_payload": {
                    "calling_number": raw_cli,
                    "normalized_cli": digits,
                    "ingress_ip": ingress_ip,
                    "latency_ms": latency_ms,
                    "jitter_ms": jitter_ms,
                    "sip_user_agent": user_agent,
                    "trai_circle": trai_info["circle_name"],
                    "statutory_violation": "Unauthorized ILD Bypass & False Calling Line Identification",
                    "compliance_protocol": "DoT Sanchar Saathi / TAFCOP Rogue Trunk Triage",
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            _triage_incidents[triage_id] = triage_record

        route_telemetry = {
            "detected_ingress_country": ingress_country,
            "is_international_ingress": is_offshore_ip,
            "is_simbox_gateway": is_simbox_detected,
            "gateway_model": detected_gateway_model,
            "audio_latency_ms": latency_ms,
            "packet_jitter_ms": jitter_ms,
            "packet_loss_pct": loss_pct,
            "latency_assessment": latency_assessment,
            "jitter_assessment": jitter_assessment,
        }

        result = {
            "verification_id": verif_id,
            "call_id": call_id,
            "claimed_cli": raw_cli,
            "normalized_cli": digits,
            "claimed_entity": claimed_entity,
            "is_spoofed": is_spoofed,
            "spoof_confidence": spoof_confidence if is_spoofed else 0.05,
            "threat_tier": threat_tier,
            "carrier_legitimacy_score": round(carrier_score, 1),
            "trai_circle_info": trai_circle_info,
            "route_telemetry": route_telemetry,
            "anomaly_flags": anomaly_flags,
            "warning_banner": MANDATORY_WARNING_BANNER,
            "recommended_action": recommended_action,
            "forwarded_to_telecom_triage": forwarded,
            "ingress_point_id": triage_id,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }

        _verifications[verif_id] = result
        return result


def get_telecom_triage_feed() -> List[Dict[str, Any]]:
    """Return all dispatched rogue carrier ingress incidents for officer review."""
    with _lock:
        return list(_triage_incidents.values())


def update_triage_incident_status(triage_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    """Update officer action on a rogue carrier ingress record."""
    with _lock:
        if triage_id in _triage_incidents:
            _triage_incidents[triage_id]["status"] = new_status
            return _triage_incidents[triage_id]
        return None


def get_telecom_triage_summary() -> Dict[str, Any]:
    """Summary metrics for the officer telecom dashboard."""
    with _lock:
        total_inspected = len(_verifications)
        spoofed = sum(1 for v in _verifications.values() if v["is_spoofed"])
        simboxes = sum(1 for v in _verifications.values() if v.get("route_telemetry", {}).get("is_simbox_gateway"))
        intl_blocked = sum(1 for v in _verifications.values() if v.get("route_telemetry", {}).get("is_international_ingress"))

        high_risk_ips = list({
            inc["carrier_ingress_ip"]
            for inc in _triage_incidents.values()
            if inc["carrier_ingress_ip"] and inc["carrier_ingress_ip"] != "Hidden VoIP Transit"
        })

        return {
            "total_calls_inspected": total_inspected,
            "spoofed_calls_intercepted": spoofed,
            "simbox_gateways_isolated": simboxes,
            "international_grey_routes_blocked": intl_blocked,
            "high_risk_ingress_ips": high_risk_ips,
            "recent_dispatches": list(_triage_incidents.values())[-10:],
        }


def get_trai_reference_directory() -> Dict[str, Any]:
    """Return reference metadata for TRAI circles and verified police numbers."""
    return {
        "circles": TRAI_STD_CIRCLES,
        "official_police_directories": OFFICIAL_POLICE_DIRECTORIES,
    }


def reset_service_state():
    """Clear in-memory state and re-seed demo incidents."""
    with _lock:
        _verifications.clear()
        _triage_incidents.clear()
        seed_demo_telephony_incidents()


def seed_demo_telephony_incidents():
    """Pre-seed realistic demonstration cases."""
    # Case 1: Offshore Cambodian trunk spoofing Mumbai Police Commissionerate HQ
    case_1 = TelephonyRouteVerificationRequest(
        call_id="CALL-DEMO-01",
        claimed_cli="+91 22 2262 0111",
        claimed_entity="Mumbai Police Commissionerate (Cyber Branch)",
        call_channel="sip_trunk",
        sip_headers={
            "From": '"Mumbai Police HQ" <sip:+912222620111@185.220.101.45>',
            "Contact": "<sip:mumbai-simbox@185.220.101.45:5060>",
            "User-Agent": "Asterisk PBX 18.9.2 (Poipet-Cambodia)",
            "P-Asserted-Identity": "<tel:+855884129019>",
        },
        carrier_ingress_ip="185.220.101.45",
        audio_latency_ms=342.0,
        packet_jitter_ms=64.0,
        packet_loss_pct=4.2,
        recipient_circle="MH",
    )
    verify_telephony_route(case_1)

    # Case 2: Mewat SIM Box spoofing CBI HQ New Delhi via GSM gateway
    case_2 = TelephonyRouteVerificationRequest(
        call_id="CALL-DEMO-02",
        claimed_cli="+91 11 2436 8800",
        claimed_entity="CBI Special Crimes Unit New Delhi",
        call_channel="sip_trunk",
        sip_headers={
            "From": '"CBI Headquarters" <sip:01124368800@103.241.88.14>',
            "Contact": "<sip:gw-line04@103.241.88.14:5060>",
            "User-Agent": "Dinstar-SIMBOX/v3.2.4 (32-Port GSM Array)",
        },
        carrier_ingress_ip="103.241.88.14",
        audio_latency_ms=195.0,
        packet_jitter_ms=58.0,
        packet_loss_pct=2.5,
        recipient_circle="DL",
    )
    verify_telephony_route(case_2)

    # Case 3: WhatsApp VoIP call claiming to be "Supreme Court Bailiff"
    case_3 = TelephonyRouteVerificationRequest(
        call_id="CALL-DEMO-03",
        claimed_cli="+1 (202) 555-0198",
        claimed_entity="Supreme Court Digital Arrest Registry",
        call_channel="whatsapp_voip",
        carrier_ingress_ip="103.112.44.8",
        audio_latency_ms=280.0,
        packet_jitter_ms=42.0,
    )
    verify_telephony_route(case_3)

    # Case 4: Verified legitimate domestic citizen call
    case_4 = TelephonyRouteVerificationRequest(
        call_id="CALL-DEMO-04",
        claimed_cli="01123412345",
        claimed_entity="Delhi Metro Transit Inquiry",
        call_channel="pstn_gsm",
        sip_headers={
            "From": "<sip:01123412345@mtnl.net.in>",
            "User-Agent": "Cisco-Unified-Communications/12.5",
        },
        carrier_ingress_ip="103.24.12.5",
        audio_latency_ms=26.0,
        packet_jitter_ms=8.0,
        packet_loss_pct=0.1,
        recipient_circle="DL",
    )
    verify_telephony_route(case_4)


# Initialize on import
try:
    seed_demo_telephony_incidents()
except Exception:
    pass

