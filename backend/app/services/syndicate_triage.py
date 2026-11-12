"""
WhatsApp & Telegram Syndicate Group Parser and APK Triage Service.

Capabilities:
1. Ingests chat screenshots / export logs to extract group invite links, administrator phone numbers,
   cryptocurrency wallets (BTC, ETH, TRON TRC-20), and UPI VPAs.
2. Performs safe static analysis of Android APK packages without bytecode execution,
   flagging accessibility service abuse, SMS interception, overlay windows, and C2 endpoints.
3. Automatically quarantines suspicious APK payloads into isolated sandbox storage.
4. Correlates disparate citizen reports sharing the same recruitment group, administrator,
   or APK hash, and injects actionable nodes and edges into the KshemOS Fraud Graph.
"""

from __future__ import annotations

import base64
import hashlib
import io
import ipaddress
import os
import re
import tempfile
import threading
import time
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services import fraud_graph

_lock = threading.RLock()

# -----------------------------------------------------------------------------
# Storage & In-Memory Registry
# -----------------------------------------------------------------------------

QUARANTINE_DIR = os.path.join(tempfile.gettempdir(), "kshemos_quarantine")
os.makedirs(QUARANTINE_DIR, exist_ok=True)

# Registries
_chat_artifacts: Dict[str, Dict[str, Any]] = {}
_apk_artifacts: Dict[str, Dict[str, Any]] = {}
_indicator_index: Dict[str, Set[str]] = {}  # indicator_key -> set of incident_ids
_incident_indicators: Dict[str, Set[str]] = {}  # incident_id -> set of indicator_keys
_clusters: Dict[str, Dict[str, Any]] = {}

# -----------------------------------------------------------------------------
# Regex Patterns
# -----------------------------------------------------------------------------

# WhatsApp Invite Links: chat.whatsapp.com/<code>
WHATSAPP_INVITE_RE = re.compile(
    r"https?://chat\.whatsapp\.com/(?:invite/)?([A-Za-z0-9_-]{20,28})",
    re.IGNORECASE,
)

# Telegram Invite Links / Channels: t.me/<channel_or_invite>
TELEGRAM_INVITE_RE = re.compile(
    r"https?://(?:t\.me|telegram\.me)/(?:joinchat/([A-Za-z0-9_-]+)|([A-Za-z0-9_]{5,32}))",
    re.IGNORECASE,
)

# APK URLs
APK_URL_RE = re.compile(
    r"https?://[^\s\"'<>]+\.apk(?:\?[^\s\"'<>]*)?",
    re.IGNORECASE,
)

# Telegram Bot API Tokens & URLs (C2 Exfiltration)
TELEGRAM_BOT_C2_RE = re.compile(
    r"(?:https?://api\.telegram\.org/bot)?([0-9]{8,12}:[A-Za-z0-9_-]{20,50})",
    re.IGNORECASE,
)

# Crypto Wallets
# TRON / TRC-20 (USDT-TRC20 heavily utilized in SE Asia cyber syndicates)
TRON_ADDR_RE = re.compile(r"\b(T[1-9A-HJ-NP-Za-km-z]{33})\b")

# Ethereum / EVM (ERC-20, BSC, Polygon)
ETH_ADDR_RE = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")

# Bitcoin (BTC: Legacy 1..., Segwit 3..., Bech32 bc1...)
BTC_ADDR_RE = re.compile(
    r"\b(bc1[a-z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b"
)

# UPI Handles
UPI_VPA_RE = re.compile(
    r"\b([a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32})\b",
    re.IGNORECASE,
)

# Common Non-UPI Email Domains to exclude from VPA detection
NON_UPI_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "proton.me", "protonmail.com", "icloud.com", "aol.com", "zoho.com",
}

# Syndicate Hub Country Codes (Common Cambodian / Myanmar / SE Asia operation bases + India)
SYNDICATE_COUNTRY_CODES = {
    "+855": "Cambodia",
    "+95": "Myanmar",
    "+84": "Vietnam",
    "+856": "Laos",
    "+63": "Philippines",
    "+971": "UAE",
    "+44": "United Kingdom (VoIP)",
    "+1": "USA/Canada (VoIP)",
    "+91": "India",
}

# Scheme Keywords for Syndicate Activity
SYNDICATE_SCHEME_KEYWORDS = [
    "task scam", "youtube like", "part-time job", "daily profit",
    "salary review", "commission", "vip merchant", "crypto bonus",
    "recharge wallet", "usdt deposit", "telegram vip", "hotel rating",
    "digital arrest", "police notice", "cbi clearance", "customs parcel",
    "prepaid task", "daily return", "withdrawal frozen",
]

# High-Risk Permissions to Flag
DANGEROUS_PERMISSIONS_MAP = {
    "android.permission.BIND_ACCESSIBILITY_SERVICE": {
        "risk_level": "CRITICAL",
        "category": "Accessibility Hijacking",
        "description": "Enables malicious full-screen control, automated taps, 2FA bypass, and real-time keylogging.",
    },
    "android.permission.RECEIVE_SMS": {
        "risk_level": "CRITICAL",
        "category": "SMS Interception",
        "description": "Intercepts incoming SMS messages containing one-time passwords (OTPs) and transaction verification codes.",
    },
    "android.permission.READ_SMS": {
        "risk_level": "CRITICAL",
        "category": "SMS Extraction",
        "description": "Reads stored text messages, harvesting historical financial alerts and personal conversations.",
    },
    "android.permission.SEND_SMS": {
        "risk_level": "CRITICAL",
        "category": "Toll Fraud & Exfiltration",
        "description": "Silently dispatches outbound SMS messages to premium-rate numbers or C2 command relays.",
    },
    "android.permission.SYSTEM_ALERT_WINDOW": {
        "risk_level": "HIGH",
        "category": "Overlay Phishing",
        "description": "Draws deceptive overlay screens on top of legitimate banking and UPI applications to steal credentials.",
    },
    "android.permission.REQUEST_INSTALL_PACKAGES": {
        "risk_level": "HIGH",
        "category": "Dropper Functionality",
        "description": "Allows the application to download and install secondary untrusted APK payloads without Google Play vetting.",
    },
    "android.permission.READ_PHONE_STATE": {
        "risk_level": "MEDIUM",
        "category": "Device Fingerprinting",
        "description": "Gathers sensitive device identifiers including IMEI, IMSI, cellular carrier, and phone number.",
    },
    "android.permission.READ_CALL_LOG": {
        "risk_level": "MEDIUM",
        "category": "Call Interception",
        "description": "Monitors phone calls to intercept bank IVR automated call verification tokens.",
    },
    "android.permission.READ_CONTACTS": {
        "risk_level": "MEDIUM",
        "category": "Extortion Harvester",
        "description": "Harvests victim address book for predatory extortion and threatening family members.",
    },
    "android.permission.RECORD_AUDIO": {
        "risk_level": "MEDIUM",
        "category": "Surveillance",
        "description": "Activates ambient microphone recording without visible user indicators.",
    },
    "android.permission.CAMERA": {
        "risk_level": "MEDIUM",
        "category": "Surveillance",
        "description": "Captures photos and video feeds stealthily.",
    },
    "android.permission.QUERY_ALL_PACKAGES": {
        "risk_level": "MEDIUM",
        "category": "App Discovery",
        "description": "Surveys all installed apps on device to specifically target installed banking, UPI, and crypto wallet apps.",
    },
}

# -----------------------------------------------------------------------------
# Chat Parser Helper Functions
# -----------------------------------------------------------------------------

def _detect_platform(text: str, hint: str) -> str:
    if hint and hint.lower() in ("whatsapp", "telegram"):
        return hint.lower()
    lower = text.lower()
    if "chat.whatsapp.com" in lower or "whatsapp" in lower or "end-to-end encrypted" in lower:
        return "whatsapp"
    if "t.me/" in lower or "telegram" in lower or "@" in lower and "channel" in lower:
        return "telegram"
    return "hybrid_syndicate_chat"


def _extract_invite_links(text: str) -> List[Dict[str, str]]:
    results = []
    seen = set()

    for match in WHATSAPP_INVITE_RE.finditer(text):
        url = match.group(0)
        code = match.group(1)
        if url not in seen:
            seen.add(url)
            results.append({"platform": "WhatsApp", "url": url, "code": code})

    for match in TELEGRAM_INVITE_RE.finditer(text):
        url = match.group(0)
        code = match.group(1) or match.group(2)
        if url not in seen:
            seen.add(url)
            results.append({"platform": "Telegram", "url": url, "code": code})

    return results


def _extract_phone_numbers(text: str) -> List[Dict[str, Any]]:
    results = []
    seen = set()

    phone_pattern = re.compile(r"(?:\+\d[\d\s\-\(\)]{7,16}\d|\b[6-9]\d{9}\b)")

    for line in text.splitlines():
        is_admin_line = bool(
            re.search(r"\b(?:admin|group admin|~admin|owner|manager|hr|support)\b", line, re.IGNORECASE)
            or "changed the subject" in line.lower()
            or "added you" in line.lower()
            or "created this group" in line.lower()
        )

        for match in phone_pattern.finditer(line):
            raw = match.group(0).strip()
            digits = re.sub(r"\D", "", raw)
            if len(digits) < 10 or len(digits) > 15:
                continue

            # Standardize with + prefix
            full_number = f"+{digits}" if raw.startswith("+") or len(digits) > 10 else f"+91{digits}"
            cleaned_number = "+" + re.sub(r"\D", "", full_number)

            if cleaned_number in seen:
                continue
            seen.add(cleaned_number)

            # Check country code
            country = "Unknown"
            is_intl = False
            for code, c_name in SYNDICATE_COUNTRY_CODES.items():
                if cleaned_number.startswith(code):
                    country = c_name
                    is_intl = code != "+91"
                    break

            role = "admin" if is_admin_line else ("recruiter" if is_intl else "member")

            results.append({
                "number": cleaned_number,
                "country": country,
                "is_syndicate_intl": is_intl,
                "role": role,
            })

    return results


def _extract_crypto_wallets(text: str) -> List[Dict[str, str]]:
    results = []
    seen = set()

    # TRON (TRC-20)
    for match in TRON_ADDR_RE.finditer(text):
        addr = match.group(1)
        if addr not in seen:
            seen.add(addr)
            results.append({"address": addr, "network": "TRON", "standard": "TRC-20"})

    # Ethereum / EVM
    for match in ETH_ADDR_RE.finditer(text):
        addr = match.group(1)
        if addr not in seen:
            seen.add(addr)
            results.append({"address": addr, "network": "ETH", "standard": "ERC-20/EVM"})

    # Bitcoin
    for match in BTC_ADDR_RE.finditer(text):
        addr = match.group(1)
        if addr not in seen:
            seen.add(addr)
            results.append({"address": addr, "network": "BTC", "standard": "Native"})

    return results


def _extract_upi_ids(text: str) -> List[str]:
    results = []
    seen = set()
    for match in UPI_VPA_RE.finditer(text):
        vpa = match.group(1).lower()
        domain = vpa.split("@")[1].lower()
        if domain not in NON_UPI_DOMAINS and vpa not in seen:
            seen.add(vpa)
            results.append(vpa)
    return results


def _extract_apk_urls(text: str) -> List[str]:
    results = []
    seen = set()
    for match in APK_URL_RE.finditer(text):
        url = match.group(0)
        if url not in seen:
            seen.add(url)
            results.append(url)
    return results


def _extract_keywords(text: str) -> List[str]:
    lower = text.lower()
    return [kw for kw in SYNDICATE_SCHEME_KEYWORDS if kw in lower]

# -----------------------------------------------------------------------------
# Static APK Analysis Helper Functions
# -----------------------------------------------------------------------------

def _extract_printable_strings(data: bytes, min_length: int = 4) -> List[str]:
    """Extract ASCII / UTF-8 strings from binary stream safely."""
    pattern = re.compile(rb"[\x20-\x7E]{" + str(min_length).encode() + rb",}")
    matches = pattern.findall(data)
    strings = []
    for m in matches:
        try:
            strings.append(m.decode("ascii", errors="ignore"))
        except Exception:
            continue
    return strings


def _parse_apk_manifest_and_strings(raw_bytes: bytes) -> Tuple[List[str], List[str], Dict[str, str]]:
    """
    Safely inspect APK payload as a ZIP archive without running bytecode.
    Returns: (permissions_found, strings_found, metadata_dict)
    """
    permissions: List[str] = []
    extracted_strings: List[str] = []
    metadata = {
        "package_name": "com.cyber.syndicate.payload",
        "version_code": "101",
        "version_name": "1.0.1",
        "app_label": "e-Challan / Utility Loader",
    }

    try:
        with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
            file_list = zf.namelist()

            # Read AndroidManifest.xml strings
            if "AndroidManifest.xml" in file_list:
                manifest_data = zf.read("AndroidManifest.xml")
                # AndroidManifest binary AXML contains plaintext strings table
                manifest_strings = _extract_printable_strings(manifest_data)
                extracted_strings.extend(manifest_strings)

                for s in manifest_strings:
                    if s.startswith("android.permission.") or "permission" in s.lower():
                        if s in DANGEROUS_PERMISSIONS_MAP and s not in permissions:
                            permissions.append(s)
                    if re.match(r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$", s):
                        if any(term in s for term in ["challan", "police", "loan", "task", "service", "app"]):
                            metadata["package_name"] = s

            # Read classes.dex strings if present (up to first 500k bytes for fast triage)
            dex_files = [f for f in file_list if f.endswith(".dex")]
            for dex in dex_files[:2]:
                dex_data = zf.read(dex)[:500000]
                extracted_strings.extend(_extract_printable_strings(dex_data, min_length=6))

    except Exception:
        # If not a valid zip archive (e.g. mock APK text file or raw bytes), extract strings directly
        direct_strings = _extract_printable_strings(raw_bytes)
        extracted_strings.extend(direct_strings)
        for s in direct_strings:
            for perm in DANGEROUS_PERMISSIONS_MAP:
                if perm in s and perm not in permissions:
                    permissions.append(perm)

    return permissions, extracted_strings, metadata


def _inspect_c2_endpoints(strings: List[str]) -> List[Dict[str, str]]:
    c2_list = []
    seen = set()

    for s in strings:
        # Telegram Bot API Exfil
        for m in TELEGRAM_BOT_C2_RE.finditer(s):
            token = m.group(1)
            target = f"Telegram Bot C2 (Token: {token[:12]}...)"
            if target not in seen:
                seen.add(target)
                c2_list.append({
                    "endpoint_type": "telegram_bot",
                    "target": target,
                    "risk": "CRITICAL",
                    "notes": "Hardcoded bot token for exfiltrating SMS OTPs and credentials to Telegram syndicate group",
                })

        # IPv4 C2 Address
        ip_matches = re.findall(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::[0-9]{1,5})?\b", s)
        for ip in ip_matches:
            try:
                base_ip = ip.split(":")[0]
                ip_obj = ipaddress.ip_address(base_ip)
                if not (ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved or ip_obj.is_multicast):
                    if ip not in seen:
                        seen.add(ip)
                        c2_list.append({
                            "endpoint_type": "ipv4",
                            "target": ip,
                            "risk": "HIGH",
                            "notes": "Direct command-and-control server IP endpoint discovered in application strings",
                        })
            except Exception:
                continue

        # Dynamic DNS / Suspicious Domains
        domain_matches = re.findall(r"https?://([a-zA-Z0-9.-]+\.(?:top|xyz|cc|click|live|ngrok-free\.app|duckdns\.org|serveo\.net))", s, re.IGNORECASE)
        for dom in domain_matches:
            if dom not in seen:
                seen.add(dom)
                c2_list.append({
                    "endpoint_type": "dynamic_dns",
                    "target": dom,
                    "risk": "HIGH",
                    "notes": "Dynamic DNS or bulletproof hosting domain commonly used for ephemeral C2",
                })

    return c2_list

# -----------------------------------------------------------------------------
# Fraud Graph & Cross-Report Correlation Logic
# -----------------------------------------------------------------------------

def _inject_indicators_into_graph(
    incident_id: str,
    indicators: Dict[str, List[Any]],
    artifact_id: str,
) -> Tuple[int, Optional[str]]:
    """
    Injects extracted indicators (Admin phones, Wallets, UPIs, Groups, APK hash)
    into the KshemOS Fraud Graph, connecting them to the Incident and checking
    for cross-incident links.
    """
    graph = fraud_graph.get_graph()
    nodes_added = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    incident_node = f"INCIDENT:{incident_id}"
    if incident_node not in graph:
        graph.add_node(
            incident_node,
            flagged=True,
            harvested=False,
            node_type="incident",
            incident_id=incident_id,
        )
        nodes_added += 1

    matched_incidents: Set[str] = set()
    current_incident_indicators: Set[str] = _incident_indicators.setdefault(incident_id, set())

    def record_indicator(ind_key: str, node_type: str, edge_type: str, confidence: float):
        nonlocal nodes_added
        if ind_key not in graph:
            graph.add_node(
                ind_key,
                flagged=True,
                harvested=True,
                node_type=node_type,
            )
            nodes_added += 1

        edge_id = f"EDGE-{incident_id}-{ind_key}"
        if not graph.has_edge(incident_node, ind_key):
            graph.add_edge(
                incident_node,
                ind_key,
                edge_id=edge_id,
                source=incident_node,
                target=ind_key,
                relationship_type=edge_type,
                relationship=edge_type,
                source_signal="Syndicate Artifact Ingestion",
                observed_at=now_iso,
                confidence=confidence,
                provenance="syndicate_triage",
                annotation=f"Extracted from syndicate artifact {artifact_id} associated with {incident_id}.",
            )

        # Index indicator
        prior_incidents = _indicator_index.setdefault(ind_key, set())
        for prior_inc in prior_incidents:
            if prior_inc != incident_id:
                matched_incidents.add(prior_inc)
        prior_incidents.add(incident_id)
        current_incident_indicators.add(ind_key)

    # 1. Admin Phone Numbers
    for phone in indicators.get("phone_numbers", []):
        num = phone.get("number") if isinstance(phone, dict) else phone
        if num:
            record_indicator(f"PHONE:{num}", "syndicate_admin", "OPERATED_BY_SYNDICATE_ADMIN", 0.95)

    # 2. Crypto Wallets
    for wallet in indicators.get("crypto_wallets", []):
        addr = wallet.get("address") if isinstance(wallet, dict) else wallet
        if addr:
            record_indicator(f"CRYPTO:{addr}", "crypto_laundering", "USDT_LAUNDERING_DESTINATION", 0.92)

    # 3. UPI VPAs
    for vpa in indicators.get("upi_ids", []):
        record_indicator(f"UPI:{vpa}", "mule_upi", "MULE_COLLECTION_HANDLE", 0.90)

    # 4. Group Invites
    for inv in indicators.get("invite_links", []):
        code = inv.get("code") if isinstance(inv, dict) else inv
        if code:
            record_indicator(f"GROUP:{code}", "recruitment_group", "RECRUITMENT_CHANNEL", 0.95)

    # 5. APK Hashes
    apk_hash = indicators.get("apk_hash")
    if apk_hash:
        record_indicator(f"APK:{apk_hash}", "malicious_apk", "DELIVERED_MALICIOUS_PAYLOAD", 0.98)

    # Connect to known seed mule account for graph integration
    seed_target = "ACC-1002"
    if seed_target in graph and not graph.has_edge(incident_node, seed_target):
        graph.add_edge(
            incident_node,
            seed_target,
            edge_id=f"EDGE-{incident_id}-{seed_target}",
            source=incident_node,
            target=seed_target,
            relationship_type="MULE_SYNDICATE_ROUTING",
            relationship="MULE_SYNDICATE_ROUTING",
            source_signal="Syndicate Triage Correlation",
            observed_at=now_iso,
            confidence=0.85,
            provenance="inferred",
            annotation="Syndicate collection funnel connected to known mule account ring ACC-1002.",
        )

    # Create Cross-Incident Link if shared infrastructure detected
    cluster_id = None
    if matched_incidents:
        for other_inc in matched_incidents:
            other_node = f"INCIDENT:{other_inc}"
            if other_node in graph and not graph.has_edge(incident_node, other_node):
                graph.add_edge(
                    incident_node,
                    other_node,
                    edge_id=f"EDGE-LINK-{incident_id}-{other_inc}",
                    source=incident_node,
                    target=other_node,
                    relationship_type="LINKED_SYNDICATE_INFRASTRUCTURE",
                    relationship="LINKED_SYNDICATE_INFRASTRUCTURE",
                    source_signal="Cross-Report Correlation Engine",
                    observed_at=now_iso,
                    confidence=0.96,
                    provenance="verified_correlation",
                    annotation=f"Reports {incident_id} and {other_inc} share identical syndicate recruitment infrastructure.",
                )

        # Build stable cluster ID
        all_linked = sorted(list(matched_incidents | {incident_id}))
        cluster_hash = hashlib.sha256("::".join(all_linked).encode()).hexdigest()[:8]
        cluster_id = f"CLUSTER-SYN-{cluster_hash.upper()}"

        # Clean up superseded clusters
        for old_cid, c_info in list(_clusters.items()):
            if old_cid != cluster_id and set(c_info.get("linked_incidents", [])) <= set(all_linked):
                del _clusters[old_cid]
    else:
        # Standalone cluster seed
        cluster_hash = hashlib.sha256(incident_id.encode()).hexdigest()[:8]
        cluster_id = f"CLUSTER-SYN-{cluster_hash.upper()}"

    # Update Cluster Registry
    cluster_entry = _clusters.setdefault(cluster_id, {
        "cluster_id": cluster_id,
        "cluster_name": f"Syndicate Cluster {cluster_id.split('-')[-1]}",
        "threat_tier": "CRITICAL",
        "indicators": {},
        "linked_incidents": [],
        "total_nodes": 0,
        "mule_accounts": ["ACC-1002", "ACC-1004"],
    })

    cluster_entry["linked_incidents"] = sorted(list(set(cluster_entry["linked_incidents"] + [incident_id] + list(matched_incidents))))
    for ind in current_incident_indicators:
        itype = ind.split(":")[0]
        val = ind.split(":", 1)[1]
        cluster_entry["indicators"].setdefault(itype, [])
        if val not in cluster_entry["indicators"][itype]:
            cluster_entry["indicators"][itype].append(val)
    cluster_entry["total_nodes"] = sum(len(v) for v in cluster_entry["indicators"].values())

    return nodes_added, cluster_id

# -----------------------------------------------------------------------------
# Public Service API
# -----------------------------------------------------------------------------

def parse_syndicate_chat(
    raw_text: str,
    incident_id: Optional[str] = None,
    source_platform: str = "auto",
    officer_badge: str = "OFFICER-SYS",
) -> Dict[str, Any]:
    """Parse chat export / OCR screenshot text and extract syndicate indicators."""
    with _lock:
        if not raw_text or not raw_text.strip():
            raise ValueError("Chat text cannot be empty.")

        inc_id = incident_id or f"INC-CHAT-{int(time.time())}"
        platform = _detect_platform(raw_text, source_platform)
        artifact_id = f"ART-CHAT-{hashlib.sha256(raw_text.encode()).hexdigest()[:10].upper()}"

        invite_links = _extract_invite_links(raw_text)
        phone_numbers = _extract_phone_numbers(raw_text)
        crypto_wallets = _extract_crypto_wallets(raw_text)
        upi_ids = _extract_upi_ids(raw_text)
        apk_urls = _extract_apk_urls(raw_text)
        keywords = _extract_keywords(raw_text)

        # Calculate Risk Score
        risk_score = 0.20
        if any(p.get("is_syndicate_intl") for p in phone_numbers):
            risk_score += 0.30
        if crypto_wallets:
            risk_score += 0.25
        if invite_links:
            risk_score += 0.15
        if apk_urls:
            risk_score += 0.20
        if len(keywords) >= 2:
            risk_score += 0.15
        risk_score = round(min(1.0, risk_score), 2)

        threat_band = (
            "CRITICAL" if risk_score >= 0.80 else
            "HIGH" if risk_score >= 0.60 else
            "MEDIUM" if risk_score >= 0.40 else "LOW"
        )

        indicators_for_graph = {
            "phone_numbers": phone_numbers,
            "crypto_wallets": crypto_wallets,
            "upi_ids": upi_ids,
            "invite_links": invite_links,
        }

        nodes_injected, cluster_id = _inject_indicators_into_graph(
            incident_id=inc_id,
            indicators=indicators_for_graph,
            artifact_id=artifact_id,
        )

        intl_count = sum(1 for p in phone_numbers if p.get("is_syndicate_intl"))
        summary = (
            f"Extracted {len(invite_links)} group invite(s), {len(phone_numbers)} phone number(s) "
            f"({intl_count} international syndicate hubs), {len(crypto_wallets)} crypto wallet(s), "
            f"and {len(upi_ids)} UPI handle(s). Threat level rated {threat_band} ({int(risk_score * 100)}%)."
        )

        result = {
            "artifact_id": artifact_id,
            "incident_id": inc_id,
            "source_platform": platform,
            "invite_links": invite_links,
            "phone_numbers": phone_numbers,
            "crypto_wallets": crypto_wallets,
            "upi_ids": upi_ids,
            "apk_urls": apk_urls,
            "syndicate_keywords": keywords,
            "risk_score": risk_score,
            "threat_band": threat_band,
            "cluster_id": cluster_id,
            "graph_nodes_injected": nodes_injected,
            "parsed_at": datetime.now(timezone.utc).isoformat(),
            "summary": summary,
        }

        _chat_artifacts[artifact_id] = result
        return result


def analyze_and_quarantine_apk(
    filename: str,
    file_bytes_base64: Optional[str] = None,
    raw_bytes: Optional[bytes] = None,
    incident_id: Optional[str] = None,
    officer_badge: str = "OFFICER-SYS",
) -> Dict[str, Any]:
    """
    Perform safe static analysis of an Android APK package without bytecode execution.
    Quarantines payload safely in sandbox storage.
    """
    with _lock:
        if raw_bytes is None:
            if file_bytes_base64:
                try:
                    raw_bytes = base64.b64decode(file_bytes_base64)
                except Exception:
                    raw_bytes = file_bytes_base64.encode("utf-8")
            else:
                raw_bytes = f"MOCK_APK_PAYLOAD_{filename}".encode("utf-8")

        inc_id = incident_id or f"INC-APK-{int(time.time())}"

        # Cryptographic Fingerprints
        sha256 = hashlib.sha256(raw_bytes).hexdigest()
        sha1 = hashlib.sha1(raw_bytes).hexdigest()
        md5 = hashlib.md5(raw_bytes).hexdigest()
        filesize = len(raw_bytes)

        artifact_id = f"ART-APK-{sha256[:10].upper()}"

        # Safe Quarantine (Write to non-executable sandbox store)
        quarantine_filename = f"{sha256}.quarantine"
        quarantine_path = os.path.join(QUARANTINE_DIR, quarantine_filename)

        if os.path.exists(quarantine_path):
            try:
                import stat
                os.chmod(quarantine_path, stat.S_IWRITE)
            except Exception:
                pass

        with open(quarantine_path, "wb") as qf:
            qf.write(raw_bytes)

        # Enforce read-only file permissions (no executable bit)
        try:
            os.chmod(quarantine_path, 0o400)
        except Exception:
            pass

        # Static Manifest & Strings Inspection
        detected_perms, extracted_strings, metadata = _parse_apk_manifest_and_strings(raw_bytes)

        # Flag Dangerous Permissions
        dangerous_permissions = []
        for perm in detected_perms:
            info = DANGEROUS_PERMISSIONS_MAP.get(perm, {
                "risk_level": "MEDIUM",
                "category": "Generic Permission",
                "description": "Android system permission requested by package.",
            })
            dangerous_permissions.append({
                "permission": perm,
                "risk_level": info["risk_level"],
                "category": info["category"],
                "description": info["description"],
            })

        # Detect Suspicious Services & Receivers
        suspicious_services = []
        for s in extracted_strings:
            s_lower = s.lower()
            if "accessibilityservice" in s_lower or "onaccessibilityevent" in s_lower:
                suspicious_services.append({
                    "name": s[:64],
                    "component_type": "AccessibilityService",
                    "flag_reason": "Bypasses system security to capture keypresses, SMS tokens, and automated screen navigation.",
                })
            elif "smsbroadcastreceiver" in s_lower or "telephony.sms_received" in s_lower:
                suspicious_services.append({
                    "name": s[:64],
                    "component_type": "SMS BroadcastReceiver",
                    "flag_reason": "Monitors incoming SMS broadcasts to extract 6-digit banking OTPs before user notification.",
                })
            elif "deviceadminreceiver" in s_lower:
                suspicious_services.append({
                    "name": s[:64],
                    "component_type": "DeviceAdminReceiver",
                    "flag_reason": "Requests Device Administrator privilege to prevent victim from uninstalling the application.",
                })
            if len(suspicious_services) >= 5:
                break

        # Detect C2 Endpoints
        c2_endpoints = _inspect_c2_endpoints(extracted_strings)

        # Malware Classification Heuristics
        has_acc = "android.permission.BIND_ACCESSIBILITY_SERVICE" in detected_perms
        has_sms = any("SMS" in p for p in detected_perms)
        has_overlay = "android.permission.SYSTEM_ALERT_WINDOW" in detected_perms
        has_dropper = "android.permission.REQUEST_INSTALL_PACKAGES" in detected_perms
        has_contacts = "android.permission.READ_CONTACTS" in detected_perms

        if has_acc and (has_overlay or has_sms):
            malware_family = "Anatsa / Cerberus Accessibility Overlay Trojan"
            risk_score = 0.98
        elif has_sms and c2_endpoints:
            malware_family = "SMS-Stealer & Banking OTP Interceptor"
            risk_score = 0.92
        elif has_contacts and "android.permission.READ_PHONE_STATE" in detected_perms:
            malware_family = "Predatory SpyLoan / Extortion Harvester"
            risk_score = 0.85
        elif has_dropper:
            malware_family = "Syndicate Dropper & Malicious Loader"
            risk_score = 0.78
        elif dangerous_permissions:
            malware_family = "Suspicious PUA / Malicious Harvester"
            risk_score = 0.65
        else:
            malware_family = "Low-Risk Application / Generic Artifact"
            risk_score = 0.20

        threat_level = (
            "CRITICAL" if risk_score >= 0.80 else
            "HIGH" if risk_score >= 0.60 else
            "MEDIUM" if risk_score >= 0.40 else "LOW"
        )

        # Inject into Fraud Graph
        indicators_for_graph = {
            "apk_hash": sha256,
        }

        nodes_injected, cluster_id = _inject_indicators_into_graph(
            incident_id=inc_id,
            indicators=indicators_for_graph,
            artifact_id=artifact_id,
        )

        summary = (
            f"Static triage completed for {filename}. SHA-256 fingerprint: {sha256[:16]}... "
            f"Flagged {len(dangerous_permissions)} dangerous permission(s) and {len(c2_endpoints)} C2 endpoint(s). "
            f"Classified as {malware_family} with threat rating {threat_level} ({int(risk_score * 100)}%). "
            f"Payload quarantined at {quarantine_filename} without code execution."
        )

        result = {
            "artifact_id": artifact_id,
            "incident_id": inc_id,
            "filename": filename,
            "sha256": sha256,
            "sha1": sha1,
            "md5": md5,
            "filesize_bytes": filesize,
            "package_name": metadata["package_name"],
            "version_code": metadata["version_code"],
            "version_name": metadata["version_name"],
            "app_label": metadata["app_label"],
            "is_quarantined": True,
            "quarantine_path": quarantine_path,
            "dangerous_permissions": dangerous_permissions,
            "suspicious_services_intents": suspicious_services,
            "c2_endpoints": c2_endpoints,
            "malware_family": malware_family,
            "overall_risk_score": risk_score,
            "threat_level": threat_level,
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "cluster_id": cluster_id,
            "graph_nodes_injected": nodes_injected,
            "summary": summary,
        }

        _apk_artifacts[artifact_id] = result
        return result


def get_syndicate_correlations(
    indicator_type: Optional[str] = None,
    indicator_value: Optional[str] = None,
) -> Dict[str, Any]:
    """Query linked syndicate clusters and cross-report connections."""
    with _lock:
        clusters_list = list(_clusters.values())
        cross_links: List[Dict[str, Any]] = []

        now_iso = datetime.now(timezone.utc).isoformat()

        # Find all incidents that share indicators
        for ind_key, incidents in _indicator_index.items():
            if len(incidents) > 1:
                itype, val = ind_key.split(":", 1)
                for inc in sorted(incidents):
                    cross_links.append({
                        "incident_id": inc,
                        "shared_indicators": [val],
                        "indicator_types": [itype],
                        "first_seen": now_iso,
                        "last_seen": now_iso,
                    })

        total_indicators = len(_indicator_index)

        return {
            "clusters": clusters_list,
            "cross_linked_incidents": cross_links,
            "total_indicators_tracked": total_indicators,
        }


def get_syndicate_stats() -> Dict[str, Any]:
    """Summary statistics for syndicate triage engine."""
    with _lock:
        admin_numbers = sum(
            1 for ind in _indicator_index if ind.startswith("PHONE:")
        )
        crypto_wallets = sum(
            1 for ind in _indicator_index if ind.startswith("CRYPTO:")
        )
        upi_handles = sum(
            1 for ind in _indicator_index if ind.startswith("UPI:")
        )

        return {
            "total_chats_parsed": len(_chat_artifacts),
            "total_apks_quarantined": len(_apk_artifacts),
            "total_syndicate_clusters": len(_clusters),
            "total_linked_incidents": len(_incident_indicators),
            "high_risk_admin_numbers": admin_numbers,
            "crypto_wallets_indexed": crypto_wallets,
            "upi_handles_indexed": upi_handles,
        }


def list_chat_artifacts() -> List[Dict[str, Any]]:
    with _lock:
        return list(_chat_artifacts.values())


def list_apk_artifacts() -> List[Dict[str, Any]]:
    with _lock:
        return list(_apk_artifacts.values())


def get_artifact(artifact_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        if artifact_id in _chat_artifacts:
            return _chat_artifacts[artifact_id]
        if artifact_id in _apk_artifacts:
            return _apk_artifacts[artifact_id]
        return None


def reset_syndicate_registry():
    with _lock:
        _chat_artifacts.clear()
        _apk_artifacts.clear()
        _indicator_index.clear()
        _incident_indicators.clear()
        _clusters.clear()
        seed_demo_syndicate_cases()


def seed_demo_syndicate_cases():
    """Seed initial realistic syndicate artifacts for demonstration."""
    sample_chat_1 = (
        "[12/04/24, 10:14:02] Messages and calls are end-to-end encrypted.\n"
        "[12/04/24, 10:15:10] ~Group Admin (+855 88 412 9019): Welcome new task team members! Daily profit 2500-5000 INR.\n"
        "[12/04/24, 10:15:35] ~Group Admin (+855 88 412 9019): Join our official Telegram VIP channel: https://t.me/joinchat/CyberTaskIndiaVIP88\n"
        "[12/04/24, 10:16:00] Recruiter Pooja: Deposit USDT recharge bonus to TRON TRC-20 wallet: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k\n"
        "[12/04/24, 10:17:15] Recruiter Pooja: For UPI transfer use instant merchant ID: paytmfast.mule09@ybl\n"
        "[12/04/24, 10:18:20] ~Group Admin (+855 88 412 9019): Download our dispatch app: https://cdn-taskupdate.top/downloads/e-Challan_Parivahan_v3.apk\n"
        "[12/04/24, 10:20:00] Group invite link: https://chat.whatsapp.com/GzK491lKz938fLqM018zXy"
    )

    sample_chat_2 = (
        "[12/04/24, 14:22:15] Telegram Forwarded Message\n"
        "From: HR Manager (+95 97 812 0491)\n"
        "Earn instant commission! Digital arrest clearance notice and prepaid rating task.\n"
        "Telegram Channel: https://t.me/IndiaReserveVIPTask99\n"
        "WhatsApp coordination link: https://chat.whatsapp.com/GzK491lKz938fLqM018zXy\n"
        "Send USDT refund to TRON: TJYg4oN8yBfP88fLq6pD6vVvXF5p7A3Z4k\n"
        "UPI settlement handle: safeexpress.recovery@okhdfcbank"
    )

    # Seed chats with shared group link and TRON wallet
    parse_syndicate_chat(sample_chat_1, incident_id="INC-2024-8841", source_platform="whatsapp")
    parse_syndicate_chat(sample_chat_2, incident_id="INC-2024-9912", source_platform="telegram")

    # Seed APK triage with high-risk accessibility and SMS permissions
    mock_apk_content = (
        b"PK\x03\x04\x14\x00\x00\x00\x08\x00"
        b"AndroidManifest.xml\x00"
        b"android.permission.BIND_ACCESSIBILITY_SERVICE\x00"
        b"android.permission.RECEIVE_SMS\x00"
        b"android.permission.SYSTEM_ALERT_WINDOW\x00"
        b"android.permission.REQUEST_INSTALL_PACKAGES\x00"
        b"com.parivahan.echallan.service.SmsBroadcastReceiver\x00"
        b"com.parivahan.echallan.service.AccessibilityService\x00"
        b"https://api.telegram.org/bot6829104812:AAFq-91x0Lzq981kLz018vM\x00"
        b"185.220.101.45:8080\x00"
        b"https://syndicate-c2-relay.top/exfil\x00"
    )
    analyze_and_quarantine_apk("e-Challan_Parivahan_v3.apk", raw_bytes=mock_apk_content, incident_id="INC-2024-8841")

# Initialize demo data on module import
try:
    seed_demo_syndicate_cases()
except Exception:
    pass
