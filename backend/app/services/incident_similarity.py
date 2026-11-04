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