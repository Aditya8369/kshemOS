"""
Unit and integration tests for Calibrated Multi-Signal Risk Model & Governance.
"""
from __future__ import annotations

import sys
import unittest

from app.services.scam_detection import (
    analyze_transcript,
    get_model_config,
    update_model_config,
    rollback_model,
    evaluate_benchmark,
)
from app.services.incidents import create_incident, reset


class TestCalibratedRiskModel(unittest.TestCase):
    def setUp(self):
        # Reset model config to default before each test
        update_model_config(
            active_version="v2.0-calibrated-ensemble",
            thresholds={
                "critical": 75,
                "high": 50,
                "medium": 25,
                "inconclusive_min_words": 5,
                "confidence_cutoff": 0.50,
            },
            fallback_enabled=True,
        )

    def test_sparse_text_returns_inconclusive(self):
        """Conversational greetings or short tokens without overt threats must return inconclusive."""
        short_utterances = [
            "Hello?",
            "Yes, who is this?",
            "Can you hear me?",
            "Wrong number, sorry.",
        ]
        for utterance in short_utterances:
            res = analyze_transcript(utterance)
            self.assertEqual(res["risk_band"], "inconclusive", f"Failed on: {utterance}")
            self.assertTrue(res["is_inconclusive"])
            self.assertEqual(res["risk_score"], 0)
            self.assertIsNotNone(res["inconclusive_reason"])
            self.assertIn("baseline_comparison", res)
            self.assertEqual(res["baseline_comparison"]["baseline_version"], "v1.0-legacy-rules")

    def test_overt_critical_escalation_despite_brevity(self):
        """Short phrase with overt critical term like 'digital arrest' must NOT be inconclusive."""
        text = "Digital arrest warrant."
        res = analyze_transcript(text)
        self.assertFalse(res["is_inconclusive"])
        self.assertIn(res["risk_band"], ["high", "critical"])
        self.assertGreaterEqual(res["risk_score"], 50)

    def test_multi_signal_digital_arrest_detection(self):
        """Full digital arrest call should trigger critical risk band with contributing signals."""
        transcript = (
            "This is the CBI. A parcel with your Aadhaar number has been seized containing "
            "illegal narcotics and MDMA. You are under digital arrest. Stay on this video call, "
            "do not disconnect, stay in a quiet room, and transfer verification amount to the "
            "Supreme Court safe account immediately or a warrant will execute."
        )
        res = analyze_transcript(
            transcript,
            caller_claims_to_be="CBI officer",
            context={"channel": "whatsapp_video", "time_of_day": "night"},
        )
        self.assertEqual(res["risk_band"], "critical")
        self.assertGreaterEqual(res["risk_score"], 75)
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertFalse(res["is_inconclusive"])

        signals = res["contributing_signals"]
        self.assertIsNotNone(signals)
        self.assertGreater(signals["phrase_patterns"], 0.5)
        self.assertGreater(signals["call_context"], 0.4)
        self.assertGreater(signals["transcript_features"], 0.3)

    def test_benign_institutional_scoring(self):
        """Legitimate bank appointment, delivery, or colleague conversation must stay low risk."""
        benign_transcripts = [
            ("I am calling from HDFC Bank to confirm your home loan appointment for tomorrow afternoon at 2 PM.", "bank officer"),
            ("Hello, your Amazon delivery package has arrived at the security gate. Please collect it whenever free.", "courier"),
            ("Calling from Apollo Pharmacy to notify that your prescription refill is ready at our store.", "pharmacist"),
        ]
        for transcript, caller in benign_transcripts:
            res = analyze_transcript(transcript, caller_claims_to_be=caller)
            self.assertEqual(res["risk_band"], "low", f"False positive on benign: {transcript}")
            self.assertLess(res["risk_score"], 25)
            self.assertFalse(res["is_inconclusive"])

    def test_baseline_comparison_generation(self):
        """v2 calibrated result must provide side-by-side delta against v1.0 legacy baseline."""
        transcript = (
            "Customs seizure division. A parcel addressed in your name has contraband items. "
            "You must pay the settlement amount through this UPI ID immediately to avoid custody."
        )
        res = analyze_transcript(transcript, caller_claims_to_be="customs official")
        baseline = res.get("baseline_comparison")
        self.assertIsNotNone(baseline)
        self.assertEqual(baseline["baseline_version"], "v1.0-legacy-rules")
        self.assertIsInstance(baseline["baseline_score"], int)
        self.assertIsInstance(baseline["score_delta"], int)
        self.assertIn("divergence_rationale", baseline)

    def test_model_version_parameter_and_legacy_parity(self):
        """Explicitly requesting v1.0 returns immutable legacy baseline rules."""
        transcript = "Police notice. Transfer fine to safe account immediately."
        res_v1 = analyze_transcript(transcript, model_version="v1.0-legacy-rules")
        self.assertEqual(res_v1["model_version"], "v1.0-legacy-rules")
        self.assertIn(res_v1["risk_band"], ["low", "medium", "high", "critical"])

        res_v2 = analyze_transcript(transcript, model_version="v2.0-calibrated-ensemble")
        self.assertEqual(res_v2["model_version"], "v2.0-calibrated-ensemble")

    def test_model_governance_and_rollback(self):
        """Operators can update thresholds, switch versions, and perform instant rollback."""
        cfg = get_model_config()
        self.assertEqual(cfg["active_version"], "v2.0-calibrated-ensemble")

        # Update threshold
        updated = update_model_config(thresholds={"critical": 80})
        self.assertEqual(updated["thresholds"]["critical"], 80)

        # Rollback to legacy
        rb = rollback_model(target_version="v1.0-legacy-rules", reason="Incident drill rollback")
        self.assertEqual(rb["active_version"], "v1.0-legacy-rules")
        self.assertEqual(get_model_config()["active_version"], "v1.0-legacy-rules")

        # Test rollback reflection in analyze_transcript
        res = analyze_transcript("Test caller transcript")
        self.assertEqual(res["model_version"], "v1.0-legacy-rules")

    def test_benchmark_suite_accuracy_and_improvement(self):
        """Benchmark suite evaluates labeled cases and achieves high accuracy > 85%."""
        bench = evaluate_benchmark("v2.0-calibrated-ensemble")
        self.assertGreaterEqual(bench["accuracy"], 0.85)
        self.assertGreater(bench["improvement_over_baseline"], 0.15)
        self.assertGreater(bench["inconclusive_count"], 0)
        self.assertEqual(bench["total_cases"], len(bench["cases"]))

    def test_incident_service_defense(self):
        """Incident service handles inconclusive severity safely without throwing or violating SEVERITIES."""
        reset()
        inc = create_incident(
            category="scam_call",
            description="Hello? Can you hear me?",
        )
        self.assertEqual(inc["severity"], "low")


def run_all_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestCalibratedRiskModel)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
