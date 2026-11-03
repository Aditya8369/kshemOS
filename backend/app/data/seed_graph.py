
"""
Synthetic seed data for the Fraud Graph Intelligence Agent demo.

All account IDs, phone numbers, devices, and UPI IDs are fabricated
for demonstration purposes only.

All relationship metadata below is synthetic demonstration data.
Confidence values are illustrative and must not be interpreted
as confidence measurements from real investigations.
"""

ACCOUNTS = [
    "ACC-1001", "ACC-1002", "ACC-1003", "ACC-1004", "ACC-1005",
    "ACC-1006", "ACC-1007", "ACC-1008", "ACC-1009", "ACC-1010",
]

# Every edge has a stable ID and explicit explanation metadata.
EDGES = [
    {
        "edge_id": "EDGE-1001-1002",
        "source": "ACC-1001",
        "target": "ACC-1002",
        "relationship_type": "SHARED_DEVICE",
        "source_signal": "device_fingerprint_match",
        "observed_at": "2026-11-02T10:00:00Z",
        "confidence": 0.94,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a shared device fingerprint.",
    },
    {
        "edge_id": "EDGE-1002-1003",
        "source": "ACC-1002",
        "target": "ACC-1003",
        "relationship_type": "TRANSACTED_WITH",
        "source_signal": "transaction_reference_match",
        "observed_at": "2026-11-02T10:15:00Z",
        "confidence": 0.88,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a transaction relationship.",
    },
    {
        "edge_id": "EDGE-1003-1004",
        "source": "ACC-1003",
        "target": "ACC-1004",
        "relationship_type": "SHARED_DEVICE",
        "source_signal": "device_fingerprint_match",
        "observed_at": "2026-11-02T11:00:00Z",
        "confidence": 0.91,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a shared device fingerprint.",
    },
    {
        "edge_id": "EDGE-1004-1005",
        "source": "ACC-1004",
        "target": "ACC-1005",
        "relationship_type": "TRANSACTED_WITH",
        "source_signal": "transaction_reference_match",
        "observed_at": "2026-11-02T11:30:00Z",
        "confidence": 0.82,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a transaction relationship.",
    },
    {
        "edge_id": "EDGE-1002-1006",
        "source": "ACC-1002",
        "target": "ACC-1006",
        "relationship_type": "SAME_IP",
        "source_signal": "ip_address_match",
        "observed_at": "2026-11-02T12:00:00Z",
        "confidence": 0.76,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a shared IP address.",
    },
    {
        "edge_id": "EDGE-1006-1007",
        "source": "ACC-1006",
        "target": "ACC-1007",
        "relationship_type": "TRANSACTED_WITH",
        "source_signal": "transaction_reference_match",
        "observed_at": "2026-11-02T12:30:00Z",
        "confidence": 0.84,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a transaction relationship.",
    },
    {
        "edge_id": "EDGE-1008-1009",
        "source": "ACC-1008",
        "target": "ACC-1009",
        "relationship_type": "TRANSACTED_WITH",
        "source_signal": "transaction_reference_match",
        "observed_at": "2026-11-02T13:00:00Z",
        "confidence": 0.93,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a transaction relationship.",
    },
    {
        "edge_id": "EDGE-1009-1010",
        "source": "ACC-1009",
        "target": "ACC-1010",
        "relationship_type": "SHARED_DEVICE",
        "source_signal": "device_fingerprint_match",
        "observed_at": "2026-11-02T13:30:00Z",
        "confidence": 0.89,
        "provenance": "synthetic",
        "annotation": "Synthetic demonstration of a shared device fingerprint.",
    },
]

FLAGGED_ACCOUNTS = {"ACC-1001", "ACC-1008"}

KNOWN_MULE_ACCOUNTS = {"ACC-1002", "ACC-1009"}
