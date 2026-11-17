import pytest

from app.services.graph_store import (
    NetworkXGraphStore,
    Neo4jGraphStore,
    create_graph_store,
)


@pytest.fixture
def sample_edge():
    return {
        "edge_id": "EDGE-TEST-001",
        "source": "ACC-TEST-001",
        "target": "ACC-TEST-002",
        "relationship_type": "SHARED_DEVICE",
        "source_signal": "device_fingerprint",
        "observed_at": 1730000000,
        "confidence": 0.95,
        "provenance": "synthetic_test",
        "annotation": "Synthetic test relationship",
    }


def test_networkx_store_upserts_account():
    store = NetworkXGraphStore()

    store.upsert_account("ACC-001", flagged=True)
    store.upsert_account("ACC-001", harvested=True)

    graph = store.load_graph()

    assert graph.has_node("ACC-001")
    assert graph.nodes["ACC-001"]["flagged"] is True
    assert graph.nodes["ACC-001"]["harvested"] is True


def test_networkx_store_upserts_relationship(sample_edge):
    store = NetworkXGraphStore()

    store.upsert_relationship(sample_edge)

    graph = store.load_graph()

    assert graph.has_edge("ACC-TEST-001", "ACC-TEST-002")
    assert (
        graph["ACC-TEST-001"]["ACC-TEST-002"]["relationship_type"]
        == "SHARED_DEVICE"
    )


def test_networkx_store_seed_is_idempotent(sample_edge):
    store = NetworkXGraphStore()

    accounts = ["ACC-TEST-001", "ACC-TEST-002"]

    store.seed_graph(
        accounts,
        [sample_edge],
        {"ACC-TEST-001"},
        {"ACC-TEST-002"},
    )

    store.seed_graph(
        accounts,
        [sample_edge],
        {"ACC-TEST-001"},
        {"ACC-TEST-002"},
    )

    graph = store.load_graph()

    assert graph.number_of_nodes() == 2
    assert graph.number_of_edges() == 1
    assert graph.nodes["ACC-TEST-001"]["flagged"] is True
    assert graph.nodes["ACC-TEST-002"]["known_mule"] is True


def test_load_graph_returns_independent_copy():
    store = NetworkXGraphStore()
    store.upsert_account("ACC-001")

    graph = store.load_graph()
    graph.add_node("ACC-002")

    assert not store.graph.has_node("ACC-002")


def test_networkx_store_close():
    store = NetworkXGraphStore()

    store.close()


def test_create_networkx_backend(monkeypatch):
    monkeypatch.setenv("GRAPH_BACKEND", "networkx")

    store = create_graph_store()

    assert isinstance(store, NetworkXGraphStore)


def test_create_graph_store_defaults_to_networkx(monkeypatch):
    monkeypatch.delenv("GRAPH_BACKEND", raising=False)

    store = create_graph_store()

    assert isinstance(store, NetworkXGraphStore)


def test_unsupported_graph_backend(monkeypatch):
    monkeypatch.setenv("GRAPH_BACKEND", "invalid")

    with pytest.raises(ValueError, match="Unsupported GRAPH_BACKEND"):
        create_graph_store()


def test_neo4j_requires_credentials(monkeypatch):
    monkeypatch.setenv("GRAPH_BACKEND", "neo4j")

    monkeypatch.delenv("NEO4J_URI", raising=False)
    monkeypatch.delenv("NEO4J_USERNAME", raising=False)
    monkeypatch.delenv("NEO4J_PASSWORD", raising=False)

    with pytest.raises(RuntimeError, match="NEO4J_URI"):
        Neo4jGraphStore()