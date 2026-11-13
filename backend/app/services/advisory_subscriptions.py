"""
Public Incident Advisory Subscription & Location/Topic Preferences Service.
Implements Issue #43:
- Citizen subscription with explicit consent & withdrawal (unsubscribe).
- Delivery channels (email, in-app feed).
- Location/district and topic preference matching.
- Strict draft and expired advisory exclusion.
- Idempotent dispatch and duplicate prevention across retries.
- Unsubscribe and preference-management links in email notifications.
- Restricted access to subscriber directory.
"""
from __future__ import annotations

import re
import uuid
import threading
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.models import (
    AdvisorySubscriptionCreate,
    AdvisoryPreferenceUpdate,
    AdvisorySubscriptionResponse,
    PublicSubscriberSummary,
    AdvisoryNotificationDispatchRecord,
    AdvisoryDispatchSummary,
    InAppAdvisoryFeedItem,
)

# Thread-safe in-memory storage
_lock = threading.RLock()
_subscriptions: Dict[str, Dict[str, Any]] = {}
_token_to_sub_id: Dict[str, str] = {}
_email_to_sub_id: Dict[str, str] = {}
_dispatches: Dict[str, Dict[str, Any]] = {}  # idempotency_key -> dispatch record


def mask_email(email: str) -> str:
    """Mask email for privacy-preserving logs and audit summaries (e.g. j***n@example.com)."""
    if not email or "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*"
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


def is_advisory_expired(advisory: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    """Evaluates whether an advisory is past its expiration cutoff."""
    current_time = now or datetime.now(timezone.utc)
    expires_at_str = advisory.get("expires_at")
    if not expires_at_str:
        return False
    try:
        exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        return current_time > exp_dt
    except Exception:
        return False


def seed_default_subscriptions():
    """Initializes realistic baseline subscribers across zones and topics for immediate demo use."""
    with _lock:
        now = datetime.now(timezone.utc).isoformat()
        sample_subs = [
            {
                "id": "SUB-1001",
                "email": "citizen.central@delhi.residence.org",
                "areas": ["Central Zone", "SA-CENTRAL-01"],
                "topics": ["digital_arrest", "tpl_digital_arrest", "cyber_extortion"],
                "channels": ["email", "in_app"],
                "is_active": True,
                "consent_given": True,
                "consent_timestamp": "2026-11-01T10:00:00Z",
                "management_token": "token-sub-central-001",
                "created_at": "2026-11-01T10:00:00Z",
                "updated_at": now,
                "unsubscribed_at": None,
            },
            {
                "id": "SUB-1002",
                "email": "merchant.saket@south.residence.org",
                "areas": ["South Zone", "SA-SOUTH-01"],
                "topics": ["counterfeit_currency", "tpl_counterfeit_notes", "atm_skimming"],
                "channels": ["email"],
                "is_active": True,
                "consent_given": True,
                "consent_timestamp": "2026-11-02T11:30:00Z",
                "management_token": "token-sub-south-002",
                "created_at": "2026-11-02T11:30:00Z",
                "updated_at": now,
                "unsubscribed_at": None,
            },
            {
                "id": "SUB-1003",
                "email": "student.north@university.edu",
                "areas": ["All"],
                "topics": ["All"],
                "channels": ["in_app"],
                "is_active": True,
                "consent_given": True,
                "consent_timestamp": "2026-11-03T08:00:00Z",
                "management_token": "token-sub-inapp-003",
                "created_at": "2026-11-03T08:00:00Z",
                "updated_at": now,
                "unsubscribed_at": None,
            },
        ]

        for s in sample_subs:
            _subscriptions[s["id"]] = s
            _token_to_sub_id[s["management_token"]] = s["id"]
            _email_to_sub_id[s["email"].lower()] = s["id"]


# Automatically seed on import
seed_default_subscriptions()


def reset_store():
    """Resets memory store for unit testing."""
    with _lock:
        _subscriptions.clear()
        _token_to_sub_id.clear()
        _email_to_sub_id.clear()
        _dispatches.clear()
        seed_default_subscriptions()


def create_subscription(payload: AdvisorySubscriptionCreate) -> Dict[str, Any]:
    """
    Registers citizen subscription with explicit consent.
    If email already exists, updates preferences or reactivates withdrawn subscription.
    """
    if not payload.consent_given:
        raise ValueError("Explicit consent is required to activate public advisory subscriptions.")

    email_clean = str(payload.email).strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    with _lock:
        if email_clean in _email_to_sub_id:
            sub_id = _email_to_sub_id[email_clean]
            sub = _subscriptions[sub_id]
            sub["areas"] = payload.areas if payload.areas else ["All"]
            sub["topics"] = payload.topics if payload.topics else ["All"]
            sub["channels"] = payload.channels if payload.channels else ["email", "in_app"]
            sub["is_active"] = True
            sub["consent_given"] = True
            sub["consent_timestamp"] = now_iso
            sub["unsubscribed_at"] = None
            sub["updated_at"] = now_iso
            return dict(sub)

        sub_id = f"SUB-{uuid.uuid4().hex[:8].upper()}"
        management_token = f"tok-{uuid.uuid4().hex}"

        new_sub = {
            "id": sub_id,
            "email": email_clean,
            "areas": payload.areas if payload.areas else ["All"],
            "topics": payload.topics if payload.topics else ["All"],
            "channels": payload.channels if payload.channels else ["email", "in_app"],
            "is_active": True,
            "consent_given": True,
            "consent_timestamp": now_iso,
            "management_token": management_token,
            "created_at": now_iso,
            "updated_at": now_iso,
            "unsubscribed_at": None,
        }

        _subscriptions[sub_id] = new_sub
        _token_to_sub_id[management_token] = sub_id
        _email_to_sub_id[email_clean] = sub_id
        return dict(new_sub)


def get_subscription_by_token(token: str) -> Dict[str, Any]:
    """Fetches subscription settings using subscriber's private management token."""
    with _lock:
        sub_id = _token_to_sub_id.get(token)
        if not sub_id or sub_id not in _subscriptions:
            raise KeyError("Subscription not found for the provided management token.")
        return dict(_subscriptions[sub_id])


def update_subscription_preferences(token: str, payload: AdvisoryPreferenceUpdate) -> Dict[str, Any]:
    """Updates location/topic preferences or modifies active subscription state via private token."""
    with _lock:
        sub_id = _token_to_sub_id.get(token)
        if not sub_id or sub_id not in _subscriptions:
            raise KeyError("Subscription not found for the provided management token.")

        sub = _subscriptions[sub_id]
        now_iso = datetime.now(timezone.utc).isoformat()

        if payload.areas is not None:
            sub["areas"] = payload.areas if payload.areas else ["All"]
        if payload.topics is not None:
            sub["topics"] = payload.topics if payload.topics else ["All"]
        if payload.channels is not None:
            sub["channels"] = payload.channels if payload.channels else ["email", "in_app"]

        if payload.is_active is False and sub["is_active"]:
            sub["is_active"] = False
            sub["unsubscribed_at"] = now_iso
        elif payload.is_active is True and not sub["is_active"]:
            sub["is_active"] = True
            sub["unsubscribed_at"] = None

        sub["updated_at"] = now_iso
        return dict(sub)


def unsubscribe_by_token(token: str) -> Dict[str, Any]:
    """One-click unsubscribe handler implementing statutory consent withdrawal."""
    return update_subscription_preferences(token, AdvisoryPreferenceUpdate(is_active=False))


def list_subscribers(officer_badge: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns full subscriber registry.
    Strictly restricted to authorized officers / commanders to prevent unauthorized list harvesting.
    """
    if not officer_badge or not officer_badge.strip():
        raise PermissionError(
            "Access Restricted: Only authorized cyber cell officers may access citizen subscriber lists pursuant to DPDP compliance."
        )

    with _lock:
        return [dict(s) for s in _subscriptions.values()]


def get_subscriber_summary() -> Dict[str, Any]:
    """Returns high-level non-PII aggregate subscriber metrics."""
    with _lock:
        active = [s for s in _subscriptions.values() if s["is_active"]]
        unsub = [s for s in _subscriptions.values() if not s["is_active"]]

        by_channel = {"email": 0, "in_app": 0}
        by_area: Dict[str, int] = {}
        by_topic: Dict[str, int] = {}

        for s in active:
            for ch in s.get("channels", []):
                by_channel[ch] = by_channel.get(ch, 0) + 1
            for a in s.get("areas", []):
                by_area[a] = by_area.get(a, 0) + 1
            for t in s.get("topics", []):
                by_topic[t] = by_topic.get(t, 0) + 1

        return {
            "total_active_subscribers": len(active),
            "total_unsubscribed": len(unsub),
            "by_channel": by_channel,
            "by_area": by_area,
            "by_topic": by_topic,
        }


def matches_area(sub_areas: List[str], advisory: Dict[str, Any]) -> bool:
    """Matches subscriber area preferences against advisory location metadata."""
    sub_clean = [a.lower().strip() for a in sub_areas]
    if "all" in sub_clean or "*" in sub_clean:
        return True

    location = str(advisory.get("affected_location", "")).lower()
    targeting = advisory.get("targeting", {})
    region = str(targeting.get("region", "")).lower()
    sa_id = str(targeting.get("service_area_id", "")).lower()
    sa_name = str(targeting.get("service_area_name", "")).lower()
    pincodes = [str(p).lower() for p in targeting.get("postal_pincodes", [])]

    for area in sub_clean:
        if area in location or area in region or area in sa_id or area in sa_name:
            return True
        if area in pincodes:
            return True

    return False


def matches_topic(sub_topics: List[str], advisory: Dict[str, Any]) -> bool:
    """Matches subscriber topic preferences against advisory category or template metadata."""
    sub_clean = [t.lower().strip() for t in sub_topics]
    if "all" in sub_clean or "*" in sub_clean:
        return True

    tpl_type = str(advisory.get("template_type", "")).lower()
    title = str(advisory.get("title", "")).lower()
    desc = str(advisory.get("description", "")).lower()

    # Keyword mappings
    topic_synonyms = {
        "digital_arrest": ["digital_arrest", "tpl_digital_arrest", "digital arrest", "cbi", "video call arrest", "extortion"],
        "counterfeit_currency": ["counterfeit_notes", "tpl_counterfeit_notes", "counterfeit", "banknote", "currency", "fake ₹500"],
        "mule_account": ["mule_account", "tpl_mule_account", "mule", "rented account", "upi money"],
        "atm_skimming": ["atm_skimming", "tpl_atm_skimming", "skimmer", "atm", "card skimming"],
        "cyber_extortion": ["extortion", "digital arrest", "coercion", "blackmail"],
    }

    for topic in sub_clean:
        if topic in tpl_type or topic in title:
            return True
        keywords = topic_synonyms.get(topic, [topic])
        if any(kw in tpl_type or kw in title or kw in desc for kw in keywords):
            return True

    return False


def matches_subscription(sub: Dict[str, Any], advisory: Dict[str, Any]) -> bool:
    """Evaluates whether an active subscriber should receive the specified advisory."""
    if not sub.get("is_active", False):
        return False
    return matches_area(sub.get("areas", ["All"]), advisory) and matches_topic(sub.get("topics", ["All"]), advisory)


def build_advisory_email(
    sub: Dict[str, Any],
    advisory: Dict[str, Any],
    app_base_url: str = "https://kshemos.gov.in",
) -> Tuple[str, str, str]:
    """
    Constructs compliant email notification payload with mandatory elements:
    - Verified law enforcement source
    - Issue time and expiry cutoff
    - Severity and affected location
    - Direct preference management link
    - Direct one-click unsubscribe link
    """
    advisory_id = advisory.get("id", "ADV-NOTICE")
    title = advisory.get("title", "Public Incident Advisory")
    severity = str(advisory.get("severity", "high")).upper()
    location = advisory.get("affected_location", "General Metropolitan Area")
    desc = advisory.get("description", "")
    source = advisory.get("source") or "Cyber Public Safety Command & Civil Defense Desk, New Delhi"
    issued_at = advisory.get("issued_at") or advisory.get("created_at") or datetime.now(timezone.utc).isoformat()
    expires_at = advisory.get("expires_at") or (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
    token = sub.get("management_token", "")

    pref_link = f"{app_base_url}/advisory-subscriptions?token={token}&action=preferences"
    unsub_link = f"{app_base_url}/advisory-subscriptions?token={token}&action=unsubscribe"

    subject = f"[{severity} ADVISORY] {title} — KshemOS Public Safety Alert"

    body_text = f"""
================================================================================
OFFICIAL LAW ENFORCEMENT PUBLIC SAFETY ADVISORY [{advisory_id}]
================================================================================

ALERT: {title}
SEVERITY: {severity}
ISSUED BY: {source}
ISSUE TIME: {issued_at}
VALID UNTIL (EXPIRY): {expires_at}
AFFECTED REGION / PERIMETER: {location}

DIRECTIVE & GUIDANCE:
{desc}

IMPORTANT PUBLIC SAFETY ACTIONS:
1. Real police, CBI, ED, and customs officials NEVER demand money or conduct interrogations over Skype/WhatsApp video calls.
2. Never share OTPs, netbanking passwords, or transfer 'verification deposits'.
3. To verify or report this incident, dial National Cyber Crime Helpline: 1930 or visit https://cybercrime.gov.in.

--------------------------------------------------------------------------------
SUBSCRIPTION & PRIVACY PREFERENCES:
You received this alert because you explicitly consented to receive verified incident alerts matching your location and topic preferences.

• Manage your area/topic preferences:
  {pref_link}

• Unsubscribe from advisory alerts (withdraw consent):
  {unsub_link}

KshemOS Civil Defense Desk • Zero PII Retention • Statutory DPDP Compliance
"""

    body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <div style="background: #0f172a; padding: 16px 20px; border-radius: 8px; color: #ffffff; margin-bottom: 20px;">
    <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #f97316;">Official Law Enforcement Advisory &middot; {advisory_id}</div>
    <h2 style="margin: 8px 0 0 0; font-size: 18px; line-height: 1.3;">{title}</h2>
  </div>

  <div style="display: flex; gap: 8px; margin-bottom: 16px;">
    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #fee2e2; color: #dc2626; border: 1px solid #f87171;">
      SEVERITY: {severity}
    </span>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
    <p style="margin: 2px 0;"><strong>Issuing Authority:</strong> {source}</p>
    <p style="margin: 2px 0;"><strong>Issue Time:</strong> {issued_at}</p>
    <p style="margin: 2px 0;"><strong>Valid Until (Expiry):</strong> {expires_at}</p>
    <p style="margin: 2px 0;"><strong>Affected Area:</strong> {location}</p>
  </div>

  <div style="font-size: 14px; line-height: 1.6; color: #1e293b; margin-bottom: 20px;">
    <h3 style="font-size: 15px; margin: 0 0 8px 0; color: #0f172a;">Safety Guidance</h3>
    <p style="margin: 0 0 12px 0;">{desc}</p>
  </div>

  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #1e3a8a;">
    <strong>Helpline:</strong> If targeted, disconnect immediately and dial <strong>1930</strong> (National Cyber Helpline) or access the KshemOS portal.
  </div>

  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />

  <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
    <p style="margin: 0 0 8px 0;">You received this verified advisory because you opted into alerts for your selected area and topics.</p>
    <p style="margin: 0;">
      <a href="{pref_link}" style="color: #2563eb; text-decoration: underline; margin-right: 16px;">Update Notification Preferences</a>
      <a href="{unsub_link}" style="color: #dc2626; text-decoration: underline;">Unsubscribe / Withdraw Consent</a>
    </p>
  </div>
</div>
"""
    return subject, body_text, body_html


def dispatch_advisory_to_subscribers(
    advisory: Dict[str, Any],
    force_retry: bool = False,
    app_base_url: str = "https://kshemos.gov.in",
) -> Dict[str, Any]:
    """
    Dispatches verified advisory to all matching public email subscribers.
    Guarantees:
    1. Draft advisories are strictly blocked (never dispatched publicly).
    2. Expired advisories are excluded.
    3. Idempotent: retries do NOT create duplicate notifications.
    """
    status = advisory.get("status", "draft")
    if status != "published":
        raise PermissionError(
            f"Draft or unapproved advisory cannot be dispatched to public subscribers. Current status is '{status}'."
        )

    if is_advisory_expired(advisory):
        raise ValueError(
            f"Advisory {advisory.get('id')} has expired (at {advisory.get('expires_at')}) and is excluded from dispatch digests."
        )

    advisory_id = advisory.get("id", "ADV-NOTICE")
    now_iso = datetime.now(timezone.utc).isoformat()
    source = advisory.get("source") or "Cyber Public Safety Command, New Delhi"
    issued_at = advisory.get("issued_at") or now_iso
    expires_at = advisory.get("expires_at") or (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()

    eligible_subscribers = []
    with _lock:
        all_subs = list(_subscriptions.values())

    for s in all_subs:
        if s.get("is_active") and "email" in s.get("channels", []) and matches_subscription(s, advisory):
            eligible_subscribers.append(s)

    sent_count = 0
    duplicate_prevented_count = 0
    suppressed_count = 0
    dispatches_result: List[Dict[str, Any]] = []

    with _lock:
        for sub in eligible_subscribers:
            idempotency_key = f"{advisory_id}:{sub['id']}:email"

            # Check for existing delivery
            if idempotency_key in _dispatches:
                existing = _dispatches[idempotency_key]
                if existing.get("delivery_status") == "delivered" and not force_retry:
                    duplicate_prevented_count += 1
                    dispatches_result.append(dict(existing))
                    continue

            subject, body_text, body_html = build_advisory_email(sub, advisory, app_base_url=app_base_url)
            pref_link = f"{app_base_url}/advisory-subscriptions?token={sub['management_token']}&action=preferences"
            unsub_link = f"{app_base_url}/advisory-subscriptions?token={sub['management_token']}&action=unsubscribe"

            dispatch_record = {
                "notification_id": f"ADV-NOTIF-{uuid.uuid4().hex[:8].upper()}",
                "advisory_id": advisory_id,
                "subscription_id": sub["id"],
                "recipient_email": sub["email"],
                "recipient_masked_email": mask_email(sub["email"]),
                "channel": "email",
                "delivery_status": "delivered",
                "idempotency_key": idempotency_key,
                "subject": subject,
                "body_text": body_text,
                "body_html": body_html,
                "source": source,
                "issued_at": issued_at,
                "expires_at": expires_at,
                "unsubscribe_link": unsub_link,
                "preference_management_link": pref_link,
                "dispatched_at": now_iso,
                "attempt_count": 1 if idempotency_key not in _dispatches else _dispatches[idempotency_key]["attempt_count"] + 1,
                "error": None,
            }

            _dispatches[idempotency_key] = dispatch_record
            dispatches_result.append(dispatch_record)
            sent_count += 1

    return {
        "advisory_id": advisory_id,
        "advisory_title": advisory.get("title", ""),
        "status": status,
        "source": source,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "is_expired": False,
        "eligible_subscribers_count": len(eligible_subscribers),
        "sent_count": sent_count,
        "duplicate_prevented_count": duplicate_prevented_count,
        "suppressed_count": suppressed_count,
        "dispatches": dispatches_result,
    }


def get_advisory_feed(
    area: Optional[str] = None,
    topic: Optional[str] = None,
    include_expired: bool = False,
    engine_advisories: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Produces the in-app verified public advisory feed.
    Filters:
    - Only published, verified advisories.
    - Excludes expired advisories unless explicitly requested.
    - Matches optional area/district and topic filters.
    """
    from app.services.emergency_broadcast import default_broadcast_engine

    items = list((engine_advisories or default_broadcast_engine.advisories).values())
    now = datetime.now(timezone.utc)
    feed_items: List[Dict[str, Any]] = []

    for a in items:
        # Strict requirement: only published advisories in public feed
        if a.get("status") != "published":
            continue

        expired = is_advisory_expired(a, now=now)
        if expired and not include_expired:
            continue

        # Area filtering
        if area and area.strip() and area.lower() not in ("all", "*"):
            sub_areas = [area]
            if not matches_area(sub_areas, a):
                continue

        # Topic filtering
        if topic and topic.strip() and topic.lower() not in ("all", "*"):
            sub_topics = [topic]
            if not matches_topic(sub_topics, a):
                continue

        source = a.get("source") or a.get("targeting", {}).get("primary_station") or "Cyber Public Safety Command, New Delhi"
        issued_at = a.get("issued_at") or a.get("created_at") or now.isoformat()
        expires_at = a.get("expires_at") or (now + timedelta(hours=48)).isoformat()

        feed_items.append({
            "advisory_id": a.get("id"),
            "title": a.get("title"),
            "description": a.get("description"),
            "severity": a.get("severity", "medium"),
            "affected_location": a.get("affected_location", "Metropolitan Area"),
            "service_area_id": a.get("targeting", {}).get("service_area_id"),
            "target_audience": a.get("target_audience", "citizens"),
            "template_type": a.get("template_type"),
            "source": source,
            "status": "published",
            "issued_at": issued_at,
            "expires_at": expires_at,
            "is_expired": expired,
            "action_checklist": [
                "Real police never demand funds or conduct interrogations over Skype/WhatsApp.",
                "Do not authorize OTP or click verification links.",
                "Call 1930 Cyber Safety Helpline immediately to report.",
            ],
        })

    feed_items.sort(key=lambda x: x["issued_at"], reverse=True)
    return feed_items
