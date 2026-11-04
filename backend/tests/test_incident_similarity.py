from app.services.incident_similarity import tokenize_description
import pytest
from app.services.incident_similarity import text_similarity
from app.models import Incident
from app.services.incident_similarity import compare_context
from app.services.incident_similarity import compare_linked_accounts

def test_normalizes_case_punctuation_and_repeated_words():
    assert tokenize_description("Bank CALL! Bank transfer.") == {
        "bank", "call", "transfer"
    }


def test_normalizes_full_width_characters():
    assert tokenize_description("ＢＡＮＫ transfer") == {"bank", "transfer"}


def test_empty_or_punctuation_only_text_returns_empty_set():
    assert tokenize_description("") == set()
    assert tokenize_description(" ! ? ... ") == set()

def test_identical_words_have_full_similarity():
    assert text_similarity("Bank transfer!", "transfer bank") == 1.0


def test_partial_overlap():
    assert text_similarity("bank transfer", "bank call") == pytest.approx(1 / 3)


def test_unrelated_words_have_zero_similarity():
    assert text_similarity("bank transfer", "counterfeit currency") == 0.0


def test_empty_text_has_zero_similarity():
    assert text_similarity("", "bank transfer") == 0.0
    assert text_similarity("", "") == 0.0

def make_incident(**changes):
    data = {
        "id": "INC-0001",
        "report_id": None,
        "title": "Test report",
        "description": "Suspicious bank call",
        "category": "scam_call",
        "severity": "low",
        "previous_severity": None,
        "region": "North Zone",
        "status": "new",
        "assigned_to": None,
        "linked_account": None,
        "opened_at": 0,
        "first_response_at": None,
        "resolved_at": None,
    }
    data.update(changes)
    return Incident(**data)


def test_matching_context_and_submission_gap():
    left = make_incident()
    right = make_incident(id="INC-0002", opened_at=3_600_000)

    assert compare_context(left, right) == {
        "same_category": True,
        "same_region": True,
        "submission_gap_hours": 1.0,
    }
    assert compare_context(right, left) == compare_context(left, right)


def test_unknown_values_do_not_count_as_matches():
    left = make_incident(category="other", region="Unspecified")
    right = make_incident(
        id="INC-0002", category="other", region="Unspecified"
    )

    result = compare_context(left, right)

    assert result["same_category"] is False
    assert result["same_region"] is False


def test_different_categories_and_regions_do_not_match():
    left = make_incident()
    right = make_incident(
        id="INC-0002", category="counterfeit", region="South Zone"
    )

    result = compare_context(left, right)

    assert result["same_category"] is False
    assert result["same_region"] is False

def test_account_match_ignores_case_and_surrounding_spaces():
    left = make_incident(linked_account=" acct-001 ")
    right = make_incident(id="INC-0002", linked_account="ACCT-001")

    assert compare_linked_accounts(left, right) is True
    assert left.linked_account == " acct-001 "


def test_different_accounts_do_not_match():
    left = make_incident(linked_account="ACCT-001")
    right = make_incident(id="INC-0002", linked_account="ACCT-002")

    assert compare_linked_accounts(left, right) is False


@pytest.mark.parametrize(
    "left_account,right_account",
    [(None, None), (None, "ACCT-001"), ("ACCT-001", "   ")],
)
def test_missing_accounts_are_not_treated_as_matches(
    left_account, right_account
):
    left = make_incident(linked_account=left_account)
    right = make_incident(id="INC-0002", linked_account=right_account)

    assert compare_linked_accounts(left, right) is None


def test_account_comparison_preserves_meaningful_characters():
    left = make_incident(linked_account="ACCT-001")
    right = make_incident(id="INC-0002", linked_account="ACCT001")

    assert compare_linked_accounts(left, right) is False