"""Graph persistence adapters for NetworkX and Neo4j."""

from __future__ import annotations

import os
from typing import Protocol

import networkx as nx


class GraphStore(Protocol):
    """Interface implemented by graph persistence backends."""

    def load_graph(self) -> nx.Graph: ...

    def seed_graph(
        self,
        accounts: list[str],
        edges: list[dict],
        flagged_accounts: set[str],
        known_mule_accounts: set[str],
    ) -> None: ...

    def upsert_account(
        self,
        account_id: str,
        flagged: bool = False,
        harvested: bool = False,
        known_mule: bool = False,
    ) -> None: ...

    def upsert_relationship(self, edge: dict) -> None: ...

    def close(self) -> None: ...


class NetworkXGraphStore:
    """In-memory adapter used for development and automated tests."""

    def __init__(self):
        self.graph = nx.Graph()

    def load_graph(self) -> nx.Graph:
        return self.graph.copy()

    def seed_graph(
        self,
        accounts: list[str],
        edges: list[dict],
        flagged_accounts: set[str],
        known_mule_accounts: set[str],
    ) -> None:
        for account in accounts:
            self.upsert_account(
                account,
                flagged=account in flagged_accounts,
                known_mule=account in known_mule_accounts,
            )

        for edge in edges:
            self.upsert_relationship(edge)

    def upsert_account(
        self,
        account_id: str,
        flagged: bool = False,
        harvested: bool = False,
        known_mule: bool = False,
    ) -> None:
        existing = self.graph.nodes.get(account_id, {})

        self.graph.add_node(
            account_id,
            flagged=bool(existing.get("flagged", False) or flagged),
            harvested=bool(existing.get("harvested", False) or harvested),
            known_mule=bool(existing.get("known_mule", False) or known_mule),
        )

    def upsert_relationship(self, edge: dict) -> None:
        edge_data = dict(edge)
        edge_data.setdefault(
            "relationship",
            edge_data["relationship_type"],
        )

        self.graph.add_edge(
            edge_data["source"],
            edge_data["target"],
            **edge_data,
        )

    def close(self) -> None:
        pass


class Neo4jGraphStore:
    """Persistent graph adapter backed by Neo4j."""

    def __init__(self):
        try:
            from neo4j import GraphDatabase
        except ImportError as exc:
            raise RuntimeError(
                "Neo4j backend requires the neo4j Python package."
            ) from exc

        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")

        if not all((uri, username, password)):
            raise RuntimeError(
                "NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD "
                "are required when GRAPH_BACKEND=neo4j."
            )

        self.database = os.getenv("NEO4J_DATABASE", "neo4j")

        self.driver = GraphDatabase.driver(
            uri,
            auth=(username, password),
        )
        self.driver.verify_connectivity()

    def load_graph(self) -> nx.Graph:
        graph = nx.Graph()

        with self.driver.session(database=self.database) as session:
            account_result = session.run(
                """
                MATCH (a:Account)
                RETURN a
                """
            )

            for record in account_result:
                node = dict(record["a"])
                account_id = node.pop("account_id")

                graph.add_node(account_id, **node)

            relationship_result = session.run(
                """
                MATCH (a:Account)-[r:RELATED]-(b:Account)
                RETURN a.account_id AS source,
                       b.account_id AS target,
                       properties(r) AS edge
                """
            )

            for record in relationship_result:
                edge = dict(record["edge"])
                edge["source"] = record["source"]
                edge["target"] = record["target"]
                edge.setdefault(
                    "relationship",
                    edge.get("relationship_type", "UNKNOWN"),
                )

                graph.add_edge(
                    record["source"],
                    record["target"],
                    **edge,
                )

        return graph

    def seed_graph(
        self,
        accounts: list[str],
        edges: list[dict],
        flagged_accounts: set[str],
        known_mule_accounts: set[str],
    ) -> None:
        for account in accounts:
            self.upsert_account(
                account,
                flagged=account in flagged_accounts,
                known_mule=account in known_mule_accounts,
            )

        for edge in edges:
            self.upsert_relationship(edge)

    def upsert_account(
        self,
        account_id: str,
        flagged: bool = False,
        harvested: bool = False,
        known_mule: bool = False,
    ) -> None:
        with self.driver.session(database=self.database) as session:
            session.run(
                """
                MERGE (a:Account {account_id: $account_id})
                SET a.flagged = coalesce(a.flagged, false) OR $flagged,
                    a.harvested = coalesce(a.harvested, false) OR $harvested,
                    a.known_mule = coalesce(a.known_mule, false) OR $known_mule
                """,
                account_id=account_id,
                flagged=flagged,
                harvested=harvested,
                known_mule=known_mule,
            )

    def upsert_relationship(self, edge: dict) -> None:
        with self.driver.session(database=self.database) as session:
            session.run(
                """
                MERGE (source:Account {account_id: $source})
                MERGE (target:Account {account_id: $target})
                MERGE (source)-[r:RELATED {edge_id: $edge_id}]->(target)
                SET r.relationship_type = $relationship_type,
                    r.source_signal = $source_signal,
                    r.observed_at = $observed_at,
                    r.confidence = $confidence,
                    r.provenance = $provenance,
                    r.annotation = $annotation
                """,
                source=edge["source"],
                target=edge["target"],
                edge_id=edge["edge_id"],
                relationship_type=edge["relationship_type"],
                source_signal=edge["source_signal"],
                observed_at=edge["observed_at"],
                confidence=edge["confidence"],
                provenance=edge["provenance"],
                annotation=edge["annotation"],
            )

    def close(self) -> None:
        self.driver.close()


def create_graph_store() -> GraphStore:
    """Create the configured graph persistence adapter."""

    backend = os.getenv("GRAPH_BACKEND", "networkx").strip().lower()

    if backend == "networkx":
        return NetworkXGraphStore()

    if backend == "neo4j":
        return Neo4jGraphStore()

    raise ValueError(
        f"Unsupported GRAPH_BACKEND={backend!r}. "
        "Use 'networkx' or 'neo4j'."
    )