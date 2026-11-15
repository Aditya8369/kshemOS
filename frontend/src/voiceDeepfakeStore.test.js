import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  analyzeVoiceRecordingLocally,
  listLocalVoiceDeepfakeInspections,
  fetchVoiceDeepfakeStatsApi,
  resetLocalVoiceDeepfakeStore,
  computeFastHash,
  TACTICAL_CITIZEN_GUIDANCE,
  TACTICAL_CHECKLIST,
  VOICE_DEEPFAKE_PRESETS,
} from './voiceDeepfakeStore.js';

describe('Voice Deepfake & Synthetic Audio Impersonation Detector Store', () => {
  beforeEach(() => {
    resetLocalVoiceDeepfakeStore();
  });

  it('evaluates synthetic grandson kidnapping voicemail as HIGH_PROBABILITY_SYNTHETIC', () => {
    const preset = VOICE_DEEPFAKE_PRESETS.find((p) => p.id === 'preset-elevenlabs-kidnapping');
    assert.ok(preset, 'Preset should exist');

    const result = analyzeVoiceRecordingLocally({
      audio_data: preset.samplePayload,
      file_name: preset.fileName,
      duration_seconds: preset.durationSeconds,
      caller_claimed_identity: preset.claimedIdentity,
      scam_context: preset.scamContext,
      save_to_evidence_vault: true,
    });

    assert.ok(result.inspection_id.startsWith('VDF-LOCAL-'));
    assert.strictEqual(result.risk_band, 'HIGH_PROBABILITY_SYNTHETIC');
    assert.ok(result.synthetic_probability_score >= 0.7);
    assert.strictEqual(result.duration_seconds, preset.durationSeconds);
    assert.strictEqual(result.file_name, preset.fileName);

    // Verify Acoustic Spectral Metrics
    const metrics = result.spectral_metrics;
    assert.ok(metrics.jitter_pct < 0.25, 'Jitter should exhibit robotic pitch flatline (<0.25%)');
    assert.ok(metrics.shimmer_pct < 1.0, 'Shimmer should exhibit abnormally flat amplitude (<1.0%)');
    assert.ok(metrics.vocoder_footprint_score >= 0.85, 'High neural vocoder footprint');
    assert.ok(metrics.pitch_stability_index >= 0.9, 'Pitch stability should be unnaturally high');

    // Verify Anomaly Spans
    const spanTypes = result.anomaly_spans.map((s) => s.anomaly_type);
    assert.ok(spanTypes.includes('PITCH_FREEZE_FLATLINING'));
    assert.ok(spanTypes.includes('VOCODER_HIGH_FREQ_SMEARING'));
    assert.ok(spanTypes.includes('ABSENCE_OF_PHYSIOLOGICAL_RESPIRATION'));

    // Verify Mandatory Tactical Guidance
    assert.strictEqual(
      result.tactical_guidance,
      'Perform a reverse verification call on a trusted family phone number.'
    );
    assert.ok(Array.isArray(result.tactical_checklist));
    assert.ok(result.tactical_checklist.length >= 4);

    // Verify Evidence Vault preservation
    assert.ok(result.vaulted_evidence_id, 'Should have preserved evidence ID');
  });

  it('evaluates natural organic family voicenote as LOW_PROBABILITY_NATURAL', () => {
    const preset = VOICE_DEEPFAKE_PRESETS.find((p) => p.id === 'preset-natural-voicenote');
    assert.ok(preset);

    const result = analyzeVoiceRecordingLocally({
      audio_data: preset.samplePayload,
      file_name: preset.fileName,
      duration_seconds: preset.durationSeconds,
      caller_claimed_identity: preset.claimedIdentity,
      scam_context: preset.scamContext,
      save_to_evidence_vault: true,
    });

    assert.strictEqual(result.risk_band, 'LOW_PROBABILITY_NATURAL');
    assert.ok(result.synthetic_probability_score < 0.4);

    // Verify healthy physiological ranges
    const metrics = result.spectral_metrics;
    assert.ok(metrics.jitter_pct >= 0.5 && metrics.jitter_pct <= 1.2, 'Normal human vocal fold jitter');
    assert.ok(metrics.shimmer_pct >= 1.5 && metrics.shimmer_pct <= 3.8, 'Normal amplitude shimmer');
    assert.ok(metrics.vocoder_footprint_score < 0.2);

    // Verify biological indicators in spans
    const spanTypes = result.anomaly_spans.map((s) => s.anomaly_type);
    assert.ok(spanTypes.includes('NATURAL_PHYSIOLOGICAL_MICRO_TREMOR'));
    assert.ok(spanTypes.includes('BIOLOGICAL_INHALATION_DETECTED'));
  });

  it('contains exact statutory tactical guidance constant and checklist rules', () => {
    assert.strictEqual(
      TACTICAL_CITIZEN_GUIDANCE,
      'Perform a reverse verification call on a trusted family phone number.'
    );
    assert.ok(TACTICAL_CHECKLIST.some((tip) => tip.toLowerCase().includes('passphrase')));
    assert.ok(TACTICAL_CHECKLIST.some((tip) => tip.includes('1930')));
    assert.ok(TACTICAL_CHECKLIST.some((tip) => tip.includes('BNSS')));
  });

  it('lists inspection history and aggregates stats', async () => {
    // Generate one synthetic and one natural
    analyzeVoiceRecordingLocally({
      audio_data: 'synthetic_police_scam_clone',
      file_name: 'fake_police.wav',
    });
    analyzeVoiceRecordingLocally({
      audio_data: 'natural_mom_greeting_genuine',
      file_name: 'mom.m4a',
    });

    const inspections = listLocalVoiceDeepfakeInspections();
    assert.ok(inspections.length >= 2);

    const stats = await fetchVoiceDeepfakeStatsApi();
    assert.ok(stats.total_evaluated >= 2);
    assert.ok(stats.high_synthetic_detected >= 1);
    assert.ok(stats.natural_confirmed >= 1);
  });

  it('computes 64-character SHA-256 equivalent hash', () => {
    const hash = computeFastHash('test-audio-recording-buffer');
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });
});

