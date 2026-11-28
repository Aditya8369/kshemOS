"""
Citizen Digital Safety Guardian Browser Extension Service.

Compiles dynamic Manifest V3 declarativeNetRequest rules from active takedown
notices and regional threat mesh clusters, and evaluates DOM heuristics to detect
fake lookalike bank portals and Aadhaar OTP harvesting pages.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.models import (
    DeclarativeNetRequestRule,
    DeclarativeRuleAction,
    DeclarativeRuleCondition,
    ExtensionRulesResponse,
    PhishHeuristicEvaluationRequest,
    PhishHeuristicEvaluationResponse,
)
from app.services import takedown_service

# -----------------------------------------------------------------------------
# Legitimate Indian Banking & Government Whitelist (Never Blocked)
# -----------------------------------------------------------------------------

PROTECTED_LEGITIMATE_DOMAINS = [
    "onlinesbi.sbi",
    "sbi.co.in",
    "hdfcbank.com",
    "icicibank.com",
    "axisbank.com",
    "pnbindia.in",
    "bankofbaroda.in",
    "canarabank.com",
    "kotak.com",
    "indusind.com",
    "yesbank.in",
    "idfcfirstbank.com",
    "unionbankofindia.co.in",
    "uidai.gov.in",
    "myaadhaar.uidai.gov.in",
    "cybercrime.gov.in",
    "incometax.gov.in",
    "epfindia.gov.in",
    "rbi.org.in",
    "npci.org.in",
    "digilocker.gov.in",
    "parivahan.gov.in",
    "localhost",
    "127.0.0.1",
]

# Baseline high-risk threat domains from recent syndicated operations
BASELINE_THREAT_DOMAINS = [
    "sbi-netbanking-kyc-alert.top",
    "delhi-police-digital-arrest-portal.site",
    "fedex-customs-clearance-india.online",
    "hdfc-rewards-cashback-points.top",
    "icici-profile-kyc-verification.xyz",
    "axis-netbanking-session-login.online",
    "pnb-one-aadhaar-link-urgent.site",
    "uidai-biometric-unlock-portal.online",
    "incometax-refund-instant-approval.top",
    "bses-electricity-bill-clearance.site",
]


def _clean_hostname(url_or_domain: str) -> str:
    """Extracts raw clean lowercase domain without scheme, port or trailing path."""
    val = (url_or_domain or "").strip().lower()
    if not val:
        return ""
    if not (val.startswith("http://") or val.startswith("https://")):
        val = f"https://{val}"
    parsed = urlparse(val)
    host = parsed.netloc or parsed.path
    # Strip port if present
    if ":" in host:
        host = host.split(":")[0]
    return host.strip()


def compile_declarative_rules() -> ExtensionRulesResponse:
    """
    Dynamically compiles Manifest V3 declarativeNetRequest rules from:
    1. Active takedown database notices in kshemOS takedown_service.
    2. Active baseline syndicate threat mesh domains.
    """
    domain_set = set(BASELINE_THREAT_DOMAINS)
    takedown_count = 0

    try:
        notices = takedown_service.list_takedown_notices(limit=200)
        for notice in notices:
            domain = _clean_hostname(notice.target_domain)
            if domain and domain not in PROTECTED_LEGITIMATE_DOMAINS:
                domain_set.add(domain)
                takedown_count += 1
    except Exception:
        pass

    # Compile rules into standard Manifest V3 declarativeNetRequest format
    rules: List[DeclarativeNetRequestRule] = []
    sorted_domains = sorted(list(domain_set))

    for idx, domain in enumerate(sorted_domains, start=1):
        rule = DeclarativeNetRequestRule(
            id=idx,
            priority=1,
            action=DeclarativeRuleAction(type="block"),
            condition=DeclarativeRuleCondition(
                urlFilter=f"||{domain}",
                resourceTypes=["main_frame", "sub_frame"],
                isUrlFilterCaseSensitive=False,
            ),
        )
        rules.append(rule)

    now_ms = int(time.time() * 1000)
    return ExtensionRulesResponse(
        extension_id="kshemos-digital-safety-guardian",
        version="1.0.0",
        compiled_at=now_ms,
        total_rules=len(rules),
        takedown_sources_count=takedown_count,
        threat_mesh_sources_count=len(BASELINE_THREAT_DOMAINS),
        rules=rules,
        active_threat_domains=sorted_domains,
        protected_bank_domains=PROTECTED_LEGITIMATE_DOMAINS,
    )


def evaluate_dom_phishing_heuristic(
    payload: PhishHeuristicEvaluationRequest,
) -> PhishHeuristicEvaluationResponse:
    """
    Evaluates DOM input fields on non-banking domains to detect:
    - Debit/credit card PIN, CVV, or full card credentials
    - NetBanking password or profile transaction passwords
    - Aadhaar OTP or UIDAI verification codes
    Triggers immediate red high-visibility takeover warning.
    """
    clean_host = _clean_hostname(payload.current_hostname or payload.current_url)

    # 1. If legitimate protected bank or official portal, immediately safe
    is_legitimate = any(
        clean_host == legit or clean_host.endswith(f".{legit}")
        for legit in PROTECTED_LEGITIMATE_DOMAINS
    )
    if is_legitimate:
        return PhishHeuristicEvaluationResponse(
            is_phishing=False,
            risk_level="SAFE_VERIFIED",
            warning_title="Official Bank Portal Verified",
            warning_message=f"{clean_host} is an authorized, verified financial/government domain.",
            detected_indicators=[],
            impersonated_brand=None,
            matched_takedown_notice_id=None,
            recommended_action="Safe to proceed with authorized transactions.",
            killswitch_deep_link="http://localhost:5173/?view=emergency-killswitch",
        )

    # 2. Check if known active takedown target
    rules_resp = compile_declarative_rules()
    matched_in_database = clean_host in rules_resp.active_threat_domains

    # 3. Check DOM Heuristic Signals
    indicators: List[str] = []
    if payload.has_card_pin:
        indicators.append("ATM / Debit Card PIN field requested")
    if payload.has_cvv:
        indicators.append("Card CVV / Security Code field requested")
    if payload.has_netbanking_password:
        indicators.append("NetBanking / Profile Password field requested")
    if payload.has_aadhaar_otp:
        indicators.append("Aadhaar Biometric / UIDAI OTP field requested")

    # Inspect form fields list
    for field in payload.detected_form_fields:
        f_lower = field.lower()
        if any(k in f_lower for k in ["pin", "mpin", "atm_pin"]) and "ATM / Debit Card PIN field requested" not in indicators:
            indicators.append("ATM / Debit Card PIN field requested")
        if any(k in f_lower for k in ["cvv", "cvc", "security_code"]) and "Card CVV / Security Code field requested" not in indicators:
            indicators.append("Card CVV / Security Code field requested")
        if any(k in f_lower for k in ["netbanking", "txn_pwd", "profile_pwd"]) and "NetBanking / Profile Password field requested" not in indicators:
            indicators.append("NetBanking / Profile Password field requested")
        if any(k in f_lower for k in ["aadhaar", "uidai", "adhaar"]) and any(o in f_lower for o in ["otp", "code", "auth"]) and "Aadhaar Biometric / UIDAI OTP field requested" not in indicators:
            indicators.append("Aadhaar Biometric / UIDAI OTP field requested")

    # Detect Brand Impersonation in Hostname or Page Title
    impersonated = None
    target_text = f"{clean_host} {payload.page_title or ''}".lower()
    if "sbi" in target_text or "state bank" in target_text:
        impersonated = "State Bank of India (SBI)"
    elif "hdfc" in target_text:
        impersonated = "HDFC Bank"
    elif "icici" in target_text:
        impersonated = "ICICI Bank"
    elif "axis" in target_text:
        impersonated = "Axis Bank"
    elif "pnb" in target_text:
        impersonated = "Punjab National Bank (PNB)"
    elif "uidai" in target_text or "aadhaar" in target_text:
        impersonated = "UIDAI (Aadhaar Portal)"
    elif "incometax" in target_text or "tax refund" in target_text:
        impersonated = "Income Tax Department"
    elif "police" in target_text or "digital arrest" in target_text:
        impersonated = "Cyber Police / Law Enforcement"

    # Evaluate Verdict
    is_phishing = matched_in_database or (len(indicators) > 0 and not is_legitimate)
    risk_level = "CRITICAL_PHISHING" if (is_phishing or matched_in_database) else "SAFE_VERIFIED"
    if not is_phishing and impersonated and not is_legitimate:
        is_phishing = True
        risk_level = "SUSPICIOUS_HIGH_RISK"
        indicators.append(f"Lookalike brand signature detected: {impersonated}")

    killswitch_link = (
        f"http://localhost:5173/?view=emergency-killswitch&suspect_domain={clean_host}"
        f"&brand={impersonated or 'Unknown'}"
    )

    if is_phishing:
        brand_str = f" impersonating {impersonated}" if impersonated else ""
        warning_title = "Warning: Fake Bank Portal Detected by kshemOS"
        warning_msg = (
            f"This untrusted website ({clean_host}){brand_str} is attempting to harvest "
            f"your confidential credentials ({', '.join(indicators) or 'suspicious authentication patterns'}). "
            f"Official banks NEVER collect Card PINs or NetBanking passwords on third-party domains."
        )
        rec_action = "Do NOT submit any form data. Close this tab immediately and freeze your cards via the Emergency Kill-Switch."
    else:
        warning_title = "No Immediate Credential Harvesting Detected"
        warning_msg = f"{clean_host} does not currently display unauthorized bank credential harvesting forms."
        rec_action = "Exercise standard browsing caution."

    return PhishHeuristicEvaluationResponse(
        is_phishing=is_phishing,
        risk_level=risk_level,
        warning_title=warning_title,
        warning_message=warning_msg,
        detected_indicators=indicators,
        impersonated_brand=impersonated,
        matched_takedown_notice_id=f"ABUSE-MATCH-{clean_host[:8].upper()}" if matched_in_database else None,
        recommended_action=rec_action,
        killswitch_deep_link=killswitch_link,
    )
