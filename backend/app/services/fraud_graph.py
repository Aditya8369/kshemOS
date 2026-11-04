"""Fraud graph intelligence with explainable edges and honeypot integration.

The graph is seeded with synthetic account relationships and supports bounded
path explanations with provenance metadata. Accounts harvested by the AI
Telephony Honeypot can be added at runtime as inferred relationships.
"""

from __future__ import annotations

from datetime import datetime, timezone

import networkx as nx

from app.data.seed_graph import (
    ACCOUNTS,
    EDGES,
    FLAGGED_ACCOUNTS,
    KNOWN_MULE_ACCOUNTS,
)

_graph: nx.Graph | None = None
HARVESTED_HONEYPOT_ACCOUNTS: set[str] = set()


def _build_graph() -> nx.Graph:
    """Construct the fraud graph with relationship and provenance metadata."""
    graph = nx.Graph()

    for account in ACCOUNTS:
        graph.add_node(
            account,
            flagged=account in FLAGGED_ACCOUNTS,
            harvested=account in HARVESTED_HONEYPOT_ACCOUNTS,
        )

    for edge in EDGES:
        # Keep the upstream ``relationship`` attribute for compatibility while
        # retaining Issue #41's richer ``relationship_type`` explanation.
        edge_data = dict(edge)
        edge_data.setdefault("relationship", edge["relationship_type"])
        graph.add_edge(edge["source"], edge["target"], **edge_data)

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
    """Return simple paths from the requested account up to ``max_hops``."""
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
            edge_ids = [edge["edge_id"] for edge in edge_explanations]

            paths.append(
                {
                    "accounts": path,
                    "edge_ids": edge_ids,
                    "edge_explanations": edge_explanations,
                }
            )

    return sorted(
        paths,
        key=lambda item: (len(item["edge_ids"]), item["accounts"]),
    )


def inject_harvested_mule_account(
    account_id: str,
    connected_to: str = "ACC-1002",
    relationship: str = "HARVESTED_HONEYPOT_BENEFICIARY",
) -> dict:
    """Add a honeypot-harvested account and an inferred graph relationship."""
    graph = get_graph()

    HARVESTED_HONEYPOT_ACCOUNTS.add(account_id)
    FLAGGED_ACCOUNTS.add(account_id)
    KNOWN_MULE_ACCOUNTS.add(account_id)
    graph.add_node(account_id, flagged=True, harvested=True)

    target = (
        connected_to
        if connected_to in graph and connected_to != account_id
        else None
    )
    if target is None:
        target = next(
            (
                candidate
                for candidate in sorted(FLAGGED_ACCOUNTS)
                if candidate != account_id and candidate in graph
            ),
            None,
        )

    if target is not None:
        edge_data = {
            "edge_id": f"honeypot-{account_id}-{target}",
            "source": account_id,
            "target": target,
            "relationship_type": relationship,
            # Retain the upstream attribute for callers using the old graph shape.
            "relationship": relationship,
            "source_signal": "AI Telephony Honeypot",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "confidence": 0.0,
            "provenance": "inferred",
            "annotation": (
                "Account harvested by the AI Telephony Honeypot; this link is "
                "inferred and has not been independently verified."
            ),
        }
        graph.add_edge(account_id, target, **edge_data)

    return get_ring_info(account_id)


def get_ring_info(account_id: str) -> dict:
    """Return fraud-ring information with explainable graph relationships."""
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
            "harvested_by_honeypot": False,
        }

    neighbors = list(graph.neighbors(account_id))

    shared_signals = sorted(
        {
            graph.edges[account_id, neighbor]["relationship_type"]
            for neighbor in neighbors
        }
    )

    edges = [
        _get_edge_explanation(graph, account_id, neighbor)
        for neighbor in neighbors
    ]

    paths = _get_explainable_paths(graph, account_id, max_hops=2)

    # Preserve the original mule-scoring calculation.
    degree = graph.degree(account_id)
    flagged_neighbor = any(
        graph.nodes[neighbor]["flagged"] for neighbor in neighbors
    )

    base = min(0.5, degree * 0.15)

    if flagged_neighbor:
        base += 0.3

    if account_id in KNOWN_MULE_ACCOUNTS:
        base += 0.2

    if account_id in HARVESTED_HONEYPOT_ACCOUNTS:
        base = max(base, 0.96)

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
        "harvested_by_honeypot": account_id in HARVESTED_HONEYPOT_ACCOUNTS,
    }
