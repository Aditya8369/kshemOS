import networkx as nx
import pytest

from app.services import fraud_graph_reviews as reviews


@pytest.fixture(autouse=True)
def clean_review_store():
    reviews.reset_review_store()
    yield
    reviews.reset_review_store()


def test_create_review_records_decision_and_audit_metadata():
    event = reviews.create_review(
        edge_id="EDGE-1001-1002",
        decision="confirm",
        reason="Shared device evidence reviewed",
        analyst_id="ANALYST-001",
    )

    assert event["edge_id"] == "EDGE-1001-1002"
    assert event["event_type"] == "decision"
    assert event["decision"] == "confirm"
    assert event["reason"] == "Shared device evidence reviewed"
    assert event["analyst_id"] == "ANALYST-001"
    assert event["previous_hash"] == reviews.GENESIS_HASH
    assert len(event["integrity_hash"]) == 64


def test_review_requires_valid_decision_reason_and_analyst():
    with pytest.raises(ValueError):
        reviews.create_review(
            "EDGE-1001-1002", "approve", "Valid reason", "ANALYST-001"
        )

    with pytest.raises(ValueError):
        reviews.create_review(
            "EDGE-1001-1002", "confirm", "   ", "ANALYST-001"
        )

    with pytest.raises(ValueError):
        reviews.create_review(
            "EDGE-1001-1002", "confirm", "Valid reason", "   "
        )


def test_review_history_returns_current_decision():
    reviews.create_review(
        "EDGE-1001-1002",
        "confirm",
        "Evidence supports the relationship",
        "ANALYST-001",
    )

    history = reviews.get_review_history("EDGE-1001-1002")

    assert history["current_decision"] == "confirm"
    assert len(history["events"]) == 1


def test_reversal_appends_event_without_deleting_original():
    original = reviews.create_review(
        "EDGE-1001-1002",
        "confirm",
        "Initial confirmation",
        "ANALYST-001",
    )

    reversal = reviews.reverse_review(
        edge_id="EDGE-1001-1002",
        event_id=original["event_id"],
        reason="New evidence contradicts the earlier decision",
        analyst_id="ANALYST-002",
    )

    history = reviews.get_review_history("EDGE-1001-1002")

    assert len(history["events"]) == 2
    assert history["events"][0]["event_id"] == original["event_id"]
    assert history["events"][1]["event_id"] == reversal["event_id"]
    assert reversal["event_type"] == "reversal"
    assert reversal["reverses_event_id"] == original["event_id"]
    assert history["current_decision"] is None


def test_same_decision_cannot_be_reversed_twice():
    original = reviews.create_review(
        "EDGE-1001-1002",
        "reject",
        "Relationship rejected",
        "ANALYST-001",
    )

    reviews.reverse_review(
        "EDGE-1001-1002",
        original["event_id"],
        "Reconsideration",
        "ANALYST-002",
    )

    with pytest.raises(ValueError, match="already been reversed"):
        reviews.reverse_review(
            "EDGE-1001-1002",
            original["event_id"],
            "Attempted second reversal",
            "ANALYST-002",
        )


def test_hash_chain_verifies_and_detects_tampering():
    reviews.create_review(
        "EDGE-1001-1002",
        "confirm",
        "First review",
        "ANALYST-001",
    )

    reviews.create_review(
        "EDGE-1001-1002",
        "dispute",
        "Additional evidence requires review",
        "ANALYST-002",
    )

    result = reviews.verify_review_history("EDGE-1001-1002")

    assert result["verified"] is True
    assert result["event_count"] == 2

    # Deliberately corrupt a stored event to test integrity detection.
    reviews._review_events["EDGE-1001-1002"][0]["reason"] = "Tampered"

    result = reviews.verify_review_history("EDGE-1001-1002")

    assert result["verified"] is False


def test_synthetic_relationship_is_not_binary_evaluation_eligible():
    reviews.create_review(
        "EDGE-1001-1002",
        "confirm",
        "Demonstration review",
        "ANALYST-001",
    )

    export = reviews.export_evaluation_records()

    record = next(
        item
        for item in export["records"]
        if item["edge_id"] == "EDGE-1001-1002"
    )

    assert record["provenance"] == "synthetic"
    assert record["eligible_for_binary_evaluation"] is False
    assert record["evaluation_label"] is None
    assert "analyst_id" not in record
    assert "reason" not in record


@pytest.mark.parametrize(
    ("decision", "expected_label"),
    [
        ("confirm", "positive"),
        ("reject", "negative"),
        ("dispute", None),
    ],
)
def test_evaluation_export_labels_only_confirmed_or_rejected_real_edges(
    monkeypatch, decision, expected_label
):
    graph = nx.Graph()
    graph.add_edge(
        "ACC-TEST-01",
        "ACC-TEST-02",
        edge_id="EDGE-TEST-01",
        relationship_type="SHARED_DEVICE",
        provenance="verified",
    )

    monkeypatch.setattr(reviews, "get_graph", lambda: graph)

    reviews.create_review(
        "EDGE-TEST-01",
        decision,
        "Reviewed test relationship",
        "ANALYST-001",
    )

    export = reviews.export_evaluation_records()

    assert export["total"] == 1
    record = export["records"][0]
    assert record["evaluation_label"] == expected_label
    assert record["eligible_for_binary_evaluation"] == (
        expected_label is not None
    )