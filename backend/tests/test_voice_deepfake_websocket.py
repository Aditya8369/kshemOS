"""
Unit and integration tests for Real-Time WebSocket Streaming Voice Deepfake Detector.

Validates:
1. WebSocket connection lifecycle (handshake, ping/pong, reset, graceful disconnect).
2. Binary 16 kHz mono PCM streaming and structured telemetry verification.
3. Handling audio dropouts and silence pauses without server errors.
4. Robustness under packet loss, irregular buffer chunks, and odd-byte payloads.
5. Telemetry score range boundaries [0.0, 1.0] and statutory citizen guidance.
"""
from __future__ import annotations

import math
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import voice_deepfake


@pytest.fixture
def client():
    return TestClient(app)


def generate_pcm16_chunk(
    frequency_hz: float = 220.0,
    duration_sec: float = 0.5,
    sample_rate: int = 16000,
    jitter_pct: float = 0.0,
    is_silence: bool = False,
) -> bytes:
    """Generate 16-bit signed PCM mono audio bytes at 16 kHz."""
    num_samples = int(sample_rate * duration_sec)
    if is_silence:
        return np.zeros(num_samples, dtype=np.int16).tobytes()

    samples = np.zeros(num_samples, dtype=np.int16)
    phase = 0.0
    for i in range(num_samples):
        f = frequency_hz
        if jitter_pct > 0.0:
            # Inject cycle perturbation
            f += (np.random.random() - 0.5) * (frequency_hz * jitter_pct * 0.1)

        val = math.sin(phase) * 0.7 + math.sin(phase * 2.0) * 0.2
        samples[i] = int(val * 30000)
        phase += (2.0 * math.pi * f) / sample_rate
        if phase > 2.0 * math.pi:
            phase -= 2.0 * math.pi

    return samples.tobytes()


def test_websocket_connection_lifecycle(client):
    """Verify WebSocket connect handshake, ping/pong, reset action, and disconnect."""
    with client.websocket_connect("/api/voice-deepfake/stream") as websocket:
        # 1. Connection Handshake
        handshake = websocket.receive_json()
        assert handshake.get("type") == "connection_status"
        assert handshake.get("status") == "connected"
        assert handshake.get("sample_rate") == 16000
        assert handshake.get("buffer_window_sec") == 3.0

        # 2. Ping / Pong control
        websocket.send_text('{"action": "ping"}')
        pong = websocket.receive_json()
        assert pong.get("type") == "pong"
        assert "timestamp_ms" in pong

        # 3. Buffer reset control
        websocket.send_text('{"action": "reset"}')
        reset_ack = websocket.receive_json()
        assert reset_ack.get("type") == "control"
        assert reset_ack.get("action") == "reset_confirmed"
        assert reset_ack.get("buffer_duration_sec") == 0.0


def test_websocket_binary_pcm_streaming_telemetry(client):
    """Verify that sending binary 16 kHz PCM chunks returns structured acoustic telemetry."""
    with client.websocket_connect("/api/voice-deepfake/stream") as websocket:
        # Handshake
        websocket.receive_json()

        # Send 0.5s of 16kHz PCM audio chunk
        chunk = generate_pcm16_chunk(frequency_hz=220.0, duration_sec=0.5, jitter_pct=0.0)
        websocket.send_bytes(chunk)

        telemetry = websocket.receive_json()
        assert telemetry.get("type") == "telemetry"
        assert "synthetic_prob" in telemetry
        assert "jitter_anomaly" in telemetry
        assert "spectral_flux" in telemetry
        assert "tactical_guidance" in telemetry

        # Validate score ranges
        prob = telemetry["synthetic_prob"]
        assert 0.0 <= prob <= 1.0

        flux = telemetry["spectral_flux"]
        assert flux >= 0.0

        assert isinstance(telemetry["jitter_anomaly"], bool)
        assert isinstance(telemetry["shimmer_anomaly"], bool)
        assert isinstance(telemetry["hnr_anomaly"], bool)

        # Tactical Citizen Guidance validation
        assert "Perform a reverse verification call on a trusted family phone number." in telemetry["tactical_guidance"]


def test_websocket_audio_dropouts_and_silence_handling(client):
    """Verify system handles audio dropouts, silence pauses, and empty frames gracefully."""
    with client.websocket_connect("/api/voice-deepfake/stream") as websocket:
        websocket.receive_json()  # Handshake

        # 1. Send silent PCM chunk (dropouts / muted mic)
        silent_chunk = generate_pcm16_chunk(duration_sec=0.4, is_silence=True)
        websocket.send_bytes(silent_chunk)

        telemetry = websocket.receive_json()
        assert telemetry.get("type") == "telemetry"
        # Silence must not trigger a false synthetic alarm
        assert telemetry.get("is_silent_frame") is True
        assert telemetry.get("synthetic_prob") <= 0.15
        assert telemetry.get("jitter_anomaly") is False

        # 2. Send active speech chunk after silence (resuming after dropout)
        active_chunk = generate_pcm16_chunk(frequency_hz=220.0, duration_sec=0.5, jitter_pct=0.0)
        websocket.send_bytes(active_chunk)

        resumed_telemetry = websocket.receive_json()
        assert resumed_telemetry.get("type") == "telemetry"
        assert resumed_telemetry.get("buffer_duration_sec") > 0.4


def test_websocket_packet_loss_and_odd_byte_alignment(client):
    """Verify engine handles irregular chunks, packet loss, and odd-byte alignment without crashing."""
    with client.websocket_connect("/api/voice-deepfake/stream") as websocket:
        websocket.receive_json()  # Handshake

        # Send odd number of bytes (16-bit PCM requires even bytes)
        odd_chunk = b"\x00\x10\x20\x30\x40\x50\x60\x70\x80\x90\xa0\xb0\xc0\xd0\xe0"  # 15 bytes
        websocket.send_bytes(odd_chunk)

        # Send empty byte frame (representing dropped packet)
        websocket.send_bytes(b"")

        # Send standard chunk
        normal_chunk = generate_pcm16_chunk(frequency_hz=300.0, duration_sec=0.25)
        websocket.send_bytes(normal_chunk)

        telemetry = websocket.receive_json()
        assert telemetry.get("type") == "telemetry"
        assert 0.0 <= telemetry["synthetic_prob"] <= 1.0


def test_synthetic_vs_natural_acoustic_scoring():
    """Verify streaming acoustic engine distinguishes synthetic flatlining from natural vibrato."""
    # 1. Synthetic Flatline (zero jitter, robotic vocoder clone)
    synthetic_samples = np.frombuffer(
        generate_pcm16_chunk(frequency_hz=220.0, duration_sec=1.5, jitter_pct=0.0),
        dtype=np.int16,
    ).astype(np.float32) / 32768.0

    synth_telemetry = voice_deepfake.extract_streaming_acoustic_telemetry(synthetic_samples)
    assert synth_telemetry["jitter_anomaly"] is True or synth_telemetry["synthetic_prob"] >= 0.70
    assert synth_telemetry["risk_band"] in ["HIGH_PROBABILITY_SYNTHETIC", "SUSPICIOUS"]

    # 2. Natural Voice (biological micro-tremor jitter 0.8% - 1.2%)
    natural_samples = np.frombuffer(
        generate_pcm16_chunk(frequency_hz=200.0, duration_sec=1.5, jitter_pct=0.8),
        dtype=np.int16,
    ).astype(np.float32) / 32768.0

    natural_telemetry = voice_deepfake.extract_streaming_acoustic_telemetry(natural_samples)
    assert natural_telemetry["synthetic_prob"] < 0.60
