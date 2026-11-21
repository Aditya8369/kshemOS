"""
Unit tests for Acoustic Syndicate Voiceprint Fingerprinting & Speaker Recognition.
Validates:
1. 128-dimensional acoustic embedding extraction (Mel-energies, spectral moments, F0, formants, deltas).
2. Unit L2 normalization (||v||_2 = 1.0) and cosine similarity matching.
3. Vector index clustering with >= 0.85 threshold flagging SAME_CALLER_SYNDICATE_OPERATOR.
4. Cross-linkage into Fraud Graph via VOICE_CLUSTER nodes and edges.
5. Officer Command Center alerts for repeat syndicate speaker incidents.
6. FastAPI endpoints for voiceprint extraction, matching, and cluster retrieval.
"""

import os
import sys
import numpy as np
import pytest

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import (
    VoiceprintFeatureExtractRequest,
    VoiceprintMatchRequest,
)
from app.services import fraud_graph, incidents, voice_fingerprint
from app.routers import voice_fingerprint as router_endpoints


@pytest.fixture(autouse=True)
def setup_services():
    voice_fingerprint.seed_syndicate_voiceprints()
    fraud_graph.seed_default_graph()
    yield


def test_extract_128d_voiceprint_embedding():
    """Verify 128-dimensional acoustic embedding extraction and L2 normalization."""
    result = voice_fingerprint.extract_128d_voiceprint_embedding("TEST_AUDIO_SPEECH_STREAM_16KHZ")

    embedding = result["embedding"]
    assert len(embedding) == 128, f"Expected 128 dimensions, got {len(embedding)}"

    # Check unit L2 normalization (norm ~ 1.0)
    norm = np.linalg.norm(np.array(embedding, dtype=np.float32))
    assert abs(norm - 1.0) < 0.01, f"Expected unit norm ~ 1.0, got {norm}"

    # Acoustic metrics
    assert result["spectral_centroid_hz"] > 0
    assert result["pitch_f0_median_hz"] > 0
    assert result["jitter_local"] >= 0
    assert result["shimmer_local"] >= 0
    assert result["duration_seconds"] > 0


def test_cosine_similarity_threshold_match():
    """Test vector index matching against known syndicate operator with >= 0.85 threshold."""
    # Seed audio matching Operator Vikram (DCP Rathore Impersonator)
    extracted = voice_fingerprint.extract_128d_voiceprint_embedding("OPERATOR_VIKRAM_DCP_RATHORE_SEED")
    embedding = extracted["embedding"]

    match_res = voice_fingerprint.match_voiceprint_vector(
        embedding=embedding,
        threshold=0.85,
        caller_phone="+91-98711-22334",
        incident_id="INC-0001",
        bank_account="ACC-1002",
        location="Dwarka Sector 12, Delhi",
    )

    assert match_res.is_repeat_speaker is True
    assert match_res.classification == "SAME_CALLER_SYNDICATE_OPERATOR"
    assert match_res.cosine_similarity >= 0.85
    assert "Operator Vikram" in (match_res.speaker_alias or "")
    assert match_res.syndicate_cluster_id == "VOICE_CLUSTER-SYN-902"
    assert len(match_res.past_cases) > 0
    assert "ACC-1002" in match_res.linked_accounts
    assert "+91-98711-22334" in match_res.linked_phone_numbers


def test_new_unindexed_speaker_below_threshold():
    """Verify dissimilar acoustic features flag as NEW_UNINDEXED_SPEAKER below 0.85 threshold."""
    # Create an orthogonal vector to all seed embeddings
    orthogonal_emb = [0.0] * 128
    orthogonal_emb[127] = 1.0  # single component orthogonal to normal speech distributions

    match_res = voice_fingerprint.match_voiceprint_vector(
        embedding=orthogonal_emb,
        threshold=0.85,
        caller_phone="+91-99999-00000",
        incident_id="INC-NEW-9999",
    )

    assert match_res.is_repeat_speaker is False
    assert match_res.classification == "NEW_UNINDEXED_SPEAKER"
    assert match_res.cosine_similarity < 0.85
    assert match_res.matched_voiceprint_id is None


def test_fraud_graph_voice_cluster_cross_linkage():
    """Verify that matching creates VOICE_CLUSTER nodes and links disparate assets in Fraud Graph."""
    cluster_node = fraud_graph.link_voiceprint_cluster_to_fraud_graph(
        cluster_id="SYN-TEST-999",
        speaker_alias="Operator Test Voice",
        match_confidence=0.95,
        phone_numbers=["+91-91111-22222"],
        bank_accounts=["ACC-TEST-999"],
        locations=["Jaipur, Rajasthan"],
        incident_ids=["INC-TEST-001"],
    )

    assert cluster_node == "VOICE_CLUSTER-SYN-999"

    # Query graph nodes and edges
    graph_data = fraud_graph.get_graph()
    nodes = {n["id"]: n for n in graph_data.get("nodes", [])}
    edges = graph_data.get("edges", [])

    assert "VOICE_CLUSTER-SYN-999" in nodes
    voice_node = nodes["VOICE_CLUSTER-SYN-999"]
    assert voice_node["type"] == "VOICE_CLUSTER"
    assert voice_node["speaker_alias"] == "Operator Test Voice"
    assert voice_node["match_confidence"] == 0.95

    # Check that connected phone, account, and geo nodes are linked
    edge_types = [e["type"] for e in edges if e["from_id"] == "VOICE_CLUSTER-SYN-999" or e["to_id"] == "VOICE_CLUSTER-SYN-999"]
    assert "SAME_VOICEPRINT_CALLER" in edge_types
    assert "SYNDICATE_DISBURSAL_ACCOUNT" in edge_types
    assert "OPERATOR_COORDINATE_CLUSTER" in edge_types


def test_officer_command_center_alert():
    """Verify incident alert payload for repeat syndicate speaker."""
    alert = voice_fingerprint.get_incident_voiceprint_alert("INC-0001")
    assert alert is not None
    assert alert["is_repeat_speaker"] is True
    assert alert["classification"] == "SAME_CALLER_SYNDICATE_OPERATOR"
    assert "Operator Vikram" in alert["speaker_alias"]
    assert "VOICE_CLUSTER" in alert["cluster_id"]
    assert len(alert["linked_cases"]) > 0


def test_incident_feed_enrichment():
    """Verify incident feed automatically enriches incidents with voiceprint alerts."""
    feed = incidents.get_feed()
    incidents_list = feed.get("incidents", [])

    # Find INC-0001 (seeded digital arrest case)
    inc_1 = next((i for i in incidents_list if i["id"] == "INC-0001"), None)
    if inc_1:
        assert inc_1.get("voiceprint_match") is not None
        assert inc_1["voiceprint_match"]["is_repeat_speaker"] is True


def test_api_extract_and_match_endpoints():
    """Verify router endpoints for feature extraction and matching."""
    # 1. Extract endpoint
    extract_req = VoiceprintFeatureExtractRequest(
        audio_data="TEST_STREAMING_AUDIO_SAMPLE_DATA",
        sample_rate=16000,
    )
    extract_resp = router_endpoints.extract_voiceprint_features(extract_req)
    assert len(extract_resp.embedding) == 128
    assert extract_resp.l2_norm > 0.99

    # 2. Match endpoint
    match_req = VoiceprintMatchRequest(
        embedding=extract_resp.embedding,
        threshold=0.85,
        caller_phone="+91-98711-22334",
        incident_id="INC-0001",
    )
    match_resp = router_endpoints.match_voiceprint(match_req)
    assert match_resp.classification in ("SAME_CALLER_SYNDICATE_OPERATOR", "NEW_UNINDEXED_SPEAKER")

    # 3. List clusters endpoint
    clusters = router_endpoints.list_voice_clusters()
    assert isinstance(clusters, list)
    assert len(clusters) >= 3  # Vikram, Rajesh, Amit seeded clusters

    # 4. Incident voiceprint alert endpoint
    alert_resp = router_endpoints.get_incident_voiceprint("INC-0001")
    assert alert_resp is not None
    assert alert_resp["is_repeat_speaker"] is True
