from __future__ import annotations

from datetime import date, timedelta, timezone, datetime
from urllib.parse import urlparse

from fastapi import APIRouter, Query

from app.data.official_contacts import OFFICIAL_CONTACTS


router = APIRouter(
    prefix="/api/official-contacts",
    tags=["Official Contacts"],
)

# Contacts must be reverified at least once every 90 days.
VERIFICATION_MAX_AGE_DAYS = 90

ALLOWED_CATEGORIES = {
    "immediate_emergency",
    "cyber_financial_fraud",
    "cybercrime_reporting",
}


def validate_contact(contact: dict, today: date | None = None) -> tuple[bool, str]:
    """Validate source, required metadata, category and freshness."""

    today = today or datetime.now(timezone.utc).date()

    required_fields = (
        "id",
        "jurisdiction",
        "incident_category",
        "display_name",
        "contact_type",
        "contact_value",
        "official_source_url",
        "last_verified_at",
        "verification_status",
    )

    if any(not contact.get(field) for field in required_fields):
        return False, "missing_required_metadata"

    if contact["jurisdiction"] != "India":
        return False, "unsupported_jurisdiction"

    if contact["incident_category"] not in ALLOWED_CATEGORIES:
        return False, "invalid_category"

    if contact["verification_status"] != "verified":
        return False, "not_verified"

    source = urlparse(contact["official_source_url"])
    if source.scheme != "https" or not source.netloc:
        return False, "invalid_official_source"

    try:
        verified_date = date.fromisoformat(contact["last_verified_at"])
    except (TypeError, ValueError):
        return False, "invalid_verification_date"

    if verified_date > today:
        return False, "future_verification_date"

    if today - verified_date > timedelta(days=VERIFICATION_MAX_AGE_DAYS):
        return False, "stale_verification"

    # Emergency number 112 must never be categorized as cybercrime.
    if contact["contact_value"] == "112":
        if (
            contact["contact_type"] != "phone"
            or contact["incident_category"] != "immediate_emergency"
        ):
            return False, "112_category_restriction"

    return True, "verified"


@router.get("")
def get_official_contacts(
    category: str | None = Query(default=None),
):
    """
    Return only contacts with valid official sources and
    current verification metadata.
    """

    contacts = []

    for contact in OFFICIAL_CONTACTS:
        is_valid, _reason = validate_contact(contact)

        if not is_valid:
            continue

        if category and contact["incident_category"] != category:
            continue

        # Preserve compatibility with existing frontend consumers.
        public_contact = {
            **contact,
            "category": contact["incident_category"],
            "name": contact["display_name"],
            "value": contact["contact_value"],
            "source_url": contact["official_source_url"],
            "last_verified": contact["last_verified_at"],
        }

        contacts.append(public_contact)

    return {
        "count": len(contacts),
        "contacts": contacts,
    }