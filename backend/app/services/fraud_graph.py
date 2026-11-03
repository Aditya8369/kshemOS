
"""
Fraud Graph Intelligence Agent.

Provides an in-memory NetworkX graph with explainable relationships,
provenance metadata, and bounded graph-path explanations.
"""

from __future__ import annotations

import networkx as nx

from app.data.seed_graph import (
    ACCOUNTS,
    EDGES,
    FLAGGED_ACCOUNTS,
    KNOWN_MULE_ACCOUNTS,
)

_graph: nx.Graph | None = None


def _build_graph() -> nx.Graph:
    """Construct the fraud graph with relationship metadata."""
    graph = nx.Graph()

    for account in ACCOUNTS:
        graph.add_node(
            account,
            flagged=account in FLAGGED_ACCOUNTS,
        )

    for edge in EDGES:
        graph.add_edge(
            edge["source"],
            edge["target"],
            **edge,
        )

    return graph


def get_graph() -> nx.Graph:
    """Return the cached graph, building it on first access."""
    global _graph

    if _graph is None:
        _graph = _build_graph()

    return _graph


def _get_edge_explanation(
    graph: nx.Graph,
    source: str,
    target: str,
) -> dict:
    """Return the complete explanation for an individual edge."""
    edge = graph.edges[source, target]

    return {
        "edge_id": edge["edge_id"],
        "source": edge["source"],
        "target": edge["target"],
        "relationship_type": edge["relationship_type"],
        "source_signal": edge["source_signal"],
        "observed_at": edge["observed_at"],
        "confidence": edge["confidence"],
        "provenance": edge["provenance"],
        "annotation": edge["annotation"],
    }


def _get_explainable_paths(
    graph: nx.Graph,
    account_id: str,
    max_hops: int = 2,
) -> list[dict]:
    """
    Return simple paths from the requested account up to max_hops.

    Each path contains its account sequence and corresponding edge IDs.
    """
    paths = []

    for target in sorted(graph.nodes):
        if target == account_id:
            continue

        for path in nx.all_simple_paths(
            graph,
            source=account_id,
            target=target,
            cutoff=max_hops,
        ):
            edge_explanations = [
                _get_edge_explanation(graph, source, destination)
                for source, destination in zip(path, path[1:])
            ]

            edge_ids = [
                edge["edge_id"]
                for edge in edge_explanations
            ]

            paths.append({
                "accounts": path,
                "edge_ids": edge_ids,
                "edge_explanations": edge_explanations,
            })

    return sorted(
        paths,
        key=lambda item: (
            len(item["edge_ids"]),
            item["accounts"],
        ),
    )


def get_ring_info(account_id: str) -> dict:
    """
    Return fraud-ring information with explainable graph relationships.

    The existing mule-probability heuristic is preserved.
    """
    graph = get_graph()

    if account_id not in graph:
        return {
            "account_id": account_id,
            "is_flagged": False,
            "mule_probability": 0.0,
            "ring_id": None,
            "connected_accounts": [],
            "shared_signals": [],
            "edges": [],
            "paths": [],
        }

    neighbors = list(graph.neighbors(account_id))

    shared_signals = sorted({
        graph.edges[account_id, neighbor]["relationship_type"]
        for neighbor in neighbors
    })

    edges = [
        _get_edge_explanation(graph, account_id, neighbor)
        for neighbor in neighbors
    ]

    paths = _get_explainable_paths(
        graph,
        account_id,
        max_hops=2,
    )

    # Preserve the original mule-scoring calculation.
    degree = graph.degree(account_id)
    flagged_neighbor = any(
        graph.nodes[neighbor]["flagged"]
        for neighbor in neighbors
    )

    base = min(0.5, degree * 0.15)

    if flagged_neighbor:
        base += 0.3

    if account_id in KNOWN_MULE_ACCOUNTS:
        base += 0.2

    mule_probability = round(min(1.0, base), 2)

    # Preserve the original ring-ID calculation.
    component = nx.node_connected_component(graph, account_id)

    ring_id = (
        f"RING-{sorted(component)[0]}"
        if len(component) > 1
        else None
    )

    return {
        "account_id": account_id,
        "is_flagged": graph.nodes[account_id]["flagged"],
        "mule_probability": mule_probability,
        "ring_id": ring_id,
        "connected_accounts": neighbors,
        "shared_signals": shared_signals,
        "edges": edges,
        "paths": paths,
    }
