"""
Fraud Graph Intelligence Agent with AI Telephony Honeypot Integration.

Hackathon-real implementation: an in-memory networkx graph seeded with
synthetic accounts/edges, so the demo runs with zero external dependencies.
Now extended to receive automated mule account harvesting feeds from the
AI Telephony Honeypot deflection engine.
"""
from __future__ import annotations

import networkx as nx

from app.data.seed_graph import ACCOUNTS, EDGES, FLAGGED_ACCOUNTS, KNOWN_MULE_ACCOUNTS

_graph: nx.Graph | None = None
HARVESTED_HONEYPOT_ACCOUNTS: set[str] = set()


def _build_graph() -> nx.Graph:
    g = nx.Graph()
    for acc in ACCOUNTS:
        g.add_node(acc, flagged=acc in FLAGGED_ACCOUNTS, harvested=acc in HARVESTED_HONEYPOT_ACCOUNTS)
    for a, b, rel in EDGES:
        g.add_edge(a, b, relationship=rel)
    return g


def get_graph() -> nx.Graph:
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph


def inject_harvested_mule_account(
    account_id: str,
    connected_to: str = "ACC-1002",
    relationship: str = "HARVESTED_HONEYPOT_BENEFICIARY",
) -> dict:
    """Injects newly trapped mule credentials from the AI Telephony Honeypot into the Fraud Graph."""
    g = get_graph()
    HARVESTED_HONEYPOT_ACCOUNTS.add(account_id)
    FLAGGED_ACCOUNTS.add(account_id)
    KNOWN_MULE_ACCOUNTS.add(account_id)

    g.add_node(account_id, flagged=True, harvested=True)
    if connected_to in g:
        g.add_edge(account_id, connected_to, relationship=relationship)
    else:
        # Link to first known flagged mule
        fallback = next(iter(FLAGGED_ACCOUNTS))
        g.add_edge(account_id, fallback, relationship=relationship)

    return get_ring_info(account_id)


def get_ring_info(account_id: str) -> dict:
    g = get_graph()
    if account_id not in g:
        return {
            "account_id": account_id,
            "is_flagged": False,
            "mule_probability": 0.0,
            "ring_id": None,
            "connected_accounts": [],
            "shared_signals": [],
            "harvested_by_honeypot": False,
        }

    neighbors = list(g.neighbors(account_id))
    shared_signals = sorted({g.edges[account_id, n]["relationship"] for n in neighbors})

    # Simple, explainable mule heuristic: degree centrality + adjacency to a
    # flagged account + presence in the known-mule seed set.
    degree = g.degree(account_id)
    flagged_neighbor = any(g.nodes[n]["flagged"] for n in neighbors)
    base = min(0.5, degree * 0.15)
    if flagged_neighbor:
        base += 0.3
    if account_id in KNOWN_MULE_ACCOUNTS:
        base += 0.2
    if account_id in HARVESTED_HONEYPOT_ACCOUNTS:
        base = max(base, 0.96)
    mule_probability = round(min(1.0, base), 2)

    # Ring id: use the smallest connected-component member as a stable label.
    component = nx.node_connected_component(g, account_id)
    ring_id = f"RING-{sorted(component)[0]}" if len(component) > 1 else None

    return {
        "account_id": account_id,
        "is_flagged": g.nodes[account_id]["flagged"],
        "mule_probability": mule_probability,
        "ring_id": ring_id,
        "connected_accounts": neighbors,
        "shared_signals": shared_signals,
        "harvested_by_honeypot": account_id in HARVESTED_HONEYPOT_ACCOUNTS,
    }
