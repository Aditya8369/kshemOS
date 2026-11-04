import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CalibratedRiskStore,
  BENCHMARK_CORPUS,
} from './calibratedRiskStore.js';

describe('CalibratedRiskStore & Multi-Signal Risk Model', () => {
  it('returns inconclusive for sparse utterances and ambiguous greetings', () => {
    const store = new CalibratedRiskStore();
    const shortPhrases = [
      'Hello?',
      'Who is on the line please?',
      'Can you hear me?',
      'Sorry, wrong number.',
    ];

    for (const phrase of shortPhrases) {
      const res = store.evaluateTranscriptLocally(phrase);
      assert.equal(res.risk_band, 'inconclusive');
      assert.equal(res.is_inconclusive, true);
      assert.equal(res.risk_score, 0);
      assert.ok(res.inconclusive_reason);
      assert.ok(res.baseline_comparison);
      assert.equal(res.baseline_comparison.baseline_version, 'v1.0-legacy-rules');
    }
  });

  it('does not mark overt critical phrases as inconclusive even if brief', () => {
    const store = new CalibratedRiskStore();
    const text = 'CBI digital arrest warrant issued.';
    const res = store.evaluateTranscriptLocally(text);
    assert.equal(res.is_inconclusive, false);
    assert.ok(['high', 'critical'].includes(res.risk_band));
    assert.ok(res.risk_score >= 50);
  });

  it('escalates digital arrest call with multi-pillar coercion to critical', () => {
    const store = new CalibratedRiskStore();
    const transcript =
      'This is the CBI. A parcel with your Aadhaar number has been seized containing ' +
      'illegal narcotics and MDMA. You are under digital arrest. Stay on this video call, ' +
      'do not disconnect, stay in a quiet room, and transfer verification amount to the ' +
      'Supreme Court safe account immediately or a warrant will execute.';

    const res = store.evaluateTranscriptLocally(
      transcript,
      'CBI officer',
      'v2.0-calibrated-ensemble',
      { channel: 'whatsapp_video', time_of_day: 'night' }
    );

    assert.equal(res.risk_band, 'critical');
    assert.ok(res.risk_score >= 75);
    assert.ok(res.confidence >= 0.75);
    assert.equal(res.is_inconclusive, false);
    assert.ok(res.matched_patterns.length >= 3);
    assert.ok(res.contributing_signals.phrase_patterns > 0.5);
    assert.ok(res.contributing_signals.call_context > 0.4);
  });

  it('evaluates benign institutional calls as low risk without false alarm', () => {
    const store = new CalibratedRiskStore();
    const transcript =
      'I am calling from HDFC Bank to confirm your home loan appointment for tomorrow ' +
      'afternoon at 2 PM. Please bring your identity proof and salary slips to the branch.';

    const res = store.evaluateTranscriptLocally(transcript, 'bank officer');
    assert.equal(res.risk_band, 'low');
    assert.ok(res.risk_score < 25);
    assert.equal(res.is_inconclusive, false);
  });

  it('computes side-by-side baseline comparison with legacy v1.0 rules', () => {
    const store = new CalibratedRiskStore();
    const transcript =
      'Customs seizure division. A parcel addressed in your name has been impounded. ' +
      'You must pay the settlement amount through this UPI ID immediately to avoid police custody.';

    const res = store.evaluateTranscriptLocally(transcript, 'customs official');
    const comp = res.baseline_comparison;
    assert.ok(comp);
    assert.equal(comp.baseline_version, 'v1.0-legacy-rules');
    assert.ok(typeof comp.baseline_score === 'number');
    assert.ok(typeof comp.score_delta === 'number');
    assert.ok(comp.divergence_rationale);
  });

  it('supports explicit model version switching and instant rollback', () => {
    const store = new CalibratedRiskStore();
    assert.equal(store.getConfig().active_version, 'v2.0-calibrated-ensemble');

    // Switch version
    store.updateConfig({ active_version: 'v1.0-legacy-rules' });
    assert.equal(store.getConfig().active_version, 'v1.0-legacy-rules');

    // Run legacy
    const res = store.evaluateTranscriptLocally('Emergency police alert.');
    assert.equal(res.model_version, 'v1.0-legacy-rules');

    // Rollback
    const rolled = store.rollbackModel('v1.0-legacy-rules', 'Operator test rollback');
    assert.equal(rolled.active_version, 'v1.0-legacy-rules');
  });

  it('evaluates labeled benchmark suite achieving >= 85% accuracy and baseline outperformance', () => {
    const store = new CalibratedRiskStore();
    const bench = store.runBenchmarkLocally('v2.0-calibrated-ensemble');

    assert.equal(bench.total_cases, BENCHMARK_CORPUS.length);
    assert.ok(bench.accuracy >= 0.85);
    assert.ok(bench.improvement_over_baseline > 0.15);
    assert.ok(bench.inconclusive_count >= 4);
    assert.equal(bench.cases.length, BENCHMARK_CORPUS.length);
  });
});
