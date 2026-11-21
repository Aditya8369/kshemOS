"""Fraud graph intelligence with persistent graph-store adapters."""

from __future__ import annotations

from datetime import datetime, timezone

import networkx as nx

from app.data.seed_graph import (
    ACCOUNTS,
    EDGES,
    FLAGGED_ACCOUNTS,
    KNOWN_MULE_ACCOUNTS,
)
from app.services.graph_store import create_graph_store

_graph: nx.Graph | None = None
_graph_store = None

HARVESTED_HONEYPOT_ACCOUNTS: set[str] = set()


def _get_store():
    """Return the configured graph adapter."""
    global _graph_store

    if _graph_store is None:
        _graph_store = create_graph_store()

    return _graph_store


def _build_graph() -> nx.Graph:
    """Build and initialize the configured graph backend."""

    store = _get_store()

    store.seed_graph(
        accounts=ACCOUNTS,
        edges=EDGES,
        flagged_accounts=FLAGGED_ACCOUNTS,
        known_mule_accounts=KNOWN_MULE_ACCOUNTS,
    )

    return store.load_graph()


def get_graph() -> nx.Graph:
    """Return a NetworkX-compatible graph snapshot."""

    global _graph

    if _graph is None:
        _graph = _build_graph()

        for account in _graph.nodes:
            node = _graph.nodes[account]

            if node.get("harvested"):
                HARVESTED_HONEYPOT_ACCOUNTS.add(account)

            if node.get("flagged"):
                FLAGGED_ACCOUNTS.add(account)

            if node.get("known_mule"):
                KNOWN_MULE_ACCOUNTS.add(account)

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
    """Return simple paths from an account up to max_hops."""

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

            paths.append(
                {
                    "accounts": path,
                    "edge_ids": edge_ids,
                    "edge_explanations": edge_explanations,
                }
            )

    return sorted(
        paths,
        key=lambda item: (
            len(item["edge_ids"]),
            item["accounts"],
        ),
    )


def inject_harvested_mule_account(
    account_id: str,
    connected_to: str = "ACC-1002",
    relationship: str = "HARVESTED_HONEYPOT_BENEFICIARY",
) -> dict:
    """Persist an account harvested by the AI Telephony Honeypot."""

    graph = get_graph()
    store = _get_store()

    HARVESTED_HONEYPOT_ACCOUNTS.add(account_id)
    FLAGGED_ACCOUNTS.add(account_id)
    KNOWN_MULE_ACCOUNTS.add(account_id)

    store.upsert_account(
        account_id,
        flagged=True,
        harvested=True,
        known_mule=True,
    )

    graph.add_node(
        account_id,
        flagged=True,
        harvested=True,
        known_mule=True,
    )

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
            "relationship": relationship,
            "source_signal": "AI Telephony Honeypot",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "confidence": 0.0,
            "provenance": "inferred",
            "annotation": (
                "Account harvested by the AI Telephony Honeypot; "
                "this link is inferred and has not been independently "
                "verified."
            ),
        }

        store.upsert_relationship(edge_data)

        graph.add_edge(
            account_id,
            target,
            **edge_data,
        )

    return get_ring_info(account_id)


def get_ring_info(account_id: str) -> dict:
    """Return fraud-ring information with explainable relationships."""

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

    paths = _get_explainable_paths(
        graph,
        account_id,
        max_hops=2,
    )

    degree = graph.degree(account_id)

    flagged_neighbor = any(
        graph.nodes[neighbor].get("flagged", False)
        for neighbor in neighbors
    )

    base = min(0.5, degree * 0.15)

    if flagged_neighbor:
        base += 0.3

    if account_id in KNOWN_MULE_ACCOUNTS:
        base += 0.2

    if account_id in HARVESTED_HONEYPOT_ACCOUNTS:
        base = max(base, 0.96)

    mule_probability = round(min(1.0, base), 2)

    component = nx.node_connected_component(
        graph,
        account_id,
    )

    ring_id = (
        f"RING-{sorted(component)[0]}"
        if len(component) > 1
        else None
    )

    return {
        "account_id": account_id,
        "is_flagged": graph.nodes[account_id].get("flagged", False),
        "mule_probability": mule_probability,
        "ring_id": ring_id,
        "connected_accounts": neighbors,
        "shared_signals": shared_signals,
        "edges": edges,
        "paths": paths,
        "harvested_by_honeypot": (
            account_id in HARVESTED_HONEYPOT_ACCOUNTS
        ),
    }


def link_voiceprint_cluster_to_fraud_graph(
    cluster_id: str,
    speaker_alias: str,
    match_confidence: float,
    phone_numbers: list[str],
    bank_accounts: list[str],
    locations: list[str],
    incident_ids: list[str] | None = None,
) -> str:
    """
    Creates or updates a VOICE_CLUSTER node in the fraud graph,
    linking disparate phone numbers, bank accounts, and geographic locations
    associated with a confirmed SAME_CALLER_SYNDICATE_OPERATOR.
    """
    graph = get_graph()
    store = _get_store()
    now_iso = datetime.now(timezone.utc).isoformat()

    cluster_node_id = f"VOICE_CLUSTER-{cluster_id}"

    # 1. Add / Upsert the VOICE_CLUSTER node
    graph.add_node(
        cluster_node_id,
        node_type="VOICE_CLUSTER",
        speaker_alias=speaker_alias,
        cluster_id=cluster_id,
        match_confidence=match_confidence,
        classification="SAME_CALLER_SYNDICATE_OPERATOR",
        flagged=True,
        known_mule=True,
    )
    store.upsert_account(
        cluster_node_id,
        flagged=True,
        harvested=True,
        known_mule=True,
    )
    FLAGGED_ACCOUNTS.add(cluster_node_id)
    KNOWN_MULE_ACCOUNTS.add(cluster_node_id)

    # 2. Link Disparate Phone Numbers
    for phone in phone_numbers:
        clean_phone = phone.replace(" ", "").replace("+", "")
        phone_node = f"PHONE-{clean_phone}"
        graph.add_node(
            phone_node,
            node_type="PHONE_NUMBER",
            phone=phone,
            flagged=True,
        )
        edge_id = f"voice-phone-{cluster_id}-{clean_phone}"
        edge_data = {
            "edge_id": edge_id,
            "source": cluster_node_id,
            "target": phone_node,
            "relationship_type": "SAME_VOICEPRINT_CALLER",
            "relationship": "SAME_VOICEPRINT_CALLER",
            "source_signal": "Acoustic Voiceprint Matcher",
            "observed_at": now_iso,
            "confidence": match_confidence,
            "provenance": "acoustic_embedding_cosine_similarity",
            "annotation": f"Voiceprint match ({round(match_confidence*100, 1)}%) identified speaker {speaker_alias} operating through phone {phone}.",
        }
        graph.add_edge(cluster_node_id, phone_node, **edge_data)
        store.upsert_relationship(edge_data)

    # 3. Link Bank Mule Accounts
    for acc in bank_accounts:
        if acc not in graph:
            graph.add_node(
                acc,
                node_type="BANK_ACCOUNT",
                flagged=True,
                known_mule=True,
            )
            store.upsert_account(acc, flagged=True, known_mule=True)
            FLAGGED_ACCOUNTS.add(acc)
            KNOWN_MULE_ACCOUNTS.add(acc)

        edge_id = f"voice-acc-{cluster_id}-{acc}"
        edge_data = {
            "edge_id": edge_id,
            "source": cluster_node_id,
            "target": acc,
            "relationship_type": "SYNDICATE_DISBURSAL_ACCOUNT",
            "relationship": "SYNDICATE_DISBURSAL_ACCOUNT",
            "source_signal": "Acoustic Voiceprint Matcher",
            "observed_at": now_iso,
            "confidence": match_confidence,
            "provenance": "voiceprint_extortion_crosslink",
            "annotation": f"Mule account {acc} solicited by repeat syndicate speaker {speaker_alias}.",
        }
        graph.add_edge(cluster_node_id, acc, **edge_data)
        store.upsert_relationship(edge_data)

    # 4. Link Geographic Locations
    for loc in locations:
        clean_loc = loc.replace(" ", "_").replace(",", "")
        loc_node = f"GEO-{clean_loc}"
        graph.add_node(
            loc_node,
            node_type="GEOGRAPHY",
            location=loc,
            flagged=True,
        )
        edge_id = f"voice-geo-{cluster_id}-{clean_loc}"
        edge_data = {
            "edge_id": edge_id,
            "source": cluster_node_id,
            "target": loc_node,
            "relationship_type": "OPERATOR_COORDINATE_CLUSTER",
            "relationship": "OPERATOR_COORDINATE_CLUSTER",
            "source_signal": "Acoustic Voiceprint Matcher",
            "observed_at": now_iso,
            "confidence": match_confidence,
            "provenance": "caller_telecom_geolocation",
            "annotation": f"Syndicate speaker {speaker_alias} active within telecommunication cluster {loc}.",
        }
        graph.add_edge(cluster_node_id, loc_node, **edge_data)
        store.upsert_relationship(edge_data)

    return cluster_node_id
