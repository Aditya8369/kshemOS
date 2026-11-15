from __future__ import annotations
"""Baseline incident similarity matching for analyst review.

Limitations:
- Text similarity measures word overlap, not semantic meaning.
- Similar wording and matching context can produce false positives.
- Different wording can cause related reports to be missed.
- Region and submission time are coarse supporting signals.
- Account comparison only normalizes case and surrounding whitespace.
- Sensitive identifiers embedded in descriptions are not yet redacted
  or separately protected during comparison.

Results are review candidates, not confirmed duplicate incidents.
This module does not merge records or implement analyst review,
audit history, or grouped incident counts.
"""
import re
import unicodedata
from app.models import Incident


def tokenize_description(text: str) -> set[str]:
    """Normalize report text into a set of lowercase words."""
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return set(re.findall(r"\w+", normalized))

def text_similarity(left: str, right: str) -> float:
    """Return word-set Jaccard similarity between 0 and 1."""
    left_tokens = tokenize_description(left)
    right_tokens = tokenize_description(right)

    if not left_tokens or not right_tokens:
        return 0.0

    shared = left_tokens & right_tokens
    combined = left_tokens | right_tokens
    return len(shared) / len(combined)

def compare_context(left: Incident, right: Incident) -> dict:
    """Compare available context without changing either incident."""
    same_category = (
        left.category not in ("", "other")
        and left.category == right.category
    )

    same_region = (
        left.region not in ("", "Unspecified")
        and left.region == right.region
    )

    time_gap_hours = abs(left.opened_at - right.opened_at) / 3_600_000

    return {
        "same_category": same_category,
        "same_region": same_region,
        "submission_gap_hours": time_gap_hours,
    }

def compare_linked_accounts(left: Incident, right: Incident) -> bool | None:
    """Compare account IDs without returning their original values."""
    left_account = (left.linked_account or "").strip().upper()
    right_account = (right.linked_account or "").strip().upper()

    if not left_account or not right_account:
        return None

    return left_account == right_account

def suggest_match(
    left: Incident,
    right: Incident,
    *,
    text_threshold: float = 0.7,
    time_window_hours: float = 24.0,
) -> dict | None:
    """Suggest a candidate for analyst review; never merge records."""
    if not 0 < text_threshold <= 1:
        raise ValueError("text_threshold must be between 0 (exclusive) and 1")

    if not 0 < time_window_hours < float("inf"):
        raise ValueError("time_window_hours must be positive and finite")

    if left.id == right.id:
        return None

    similarity = text_similarity(left.description, right.description)
    context = compare_context(left, right)
    account_match = compare_linked_accounts(left, right)

    close_in_time = (
        context["submission_gap_hours"] <= time_window_hours
    )

    supporting_context = (
        context["same_category"]
        and context["same_region"]
        and close_in_time
    )

    if similarity < text_threshold:
        return None

    if account_match is not True and not supporting_context:
        return None

    return {
        "incident_ids": [left.id, right.id],
        "requires_review": True,
        "signals": {
            "text_similarity": similarity,
            **context,
            "within_time_window": close_in_time,
            "same_linked_account": account_match,
        },
    }