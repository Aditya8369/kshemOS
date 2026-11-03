import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectSuspiciousPhrases,
  calculateRiskAssessment,
  InMemoryLiveCallManager,
  SAMPLE_CALL_SIMULATIONS,
  OFFICIAL_HELPLINES,
} from './liveCallSafetyStore.js';

describe('LiveCallSafetyStore & Opt-In Deflection Logic', () => {
  it('enforces mandatory explicit consent before session initialization', () => {
    const manager = new InMemoryLiveCallManager();

    // Missing mic permission
    assert.throws(() => {
      manager.createSession({
        user_acknowledged: true,
        mic_permission_granted: false,
        data_processing_accepted: true,
        no_auto_record_acknowledged: true,
      });
    }, /All consent permissions must be explicitly granted/);

    // Missing auto-record acknowledgement
    assert.throws(() => {
      manager.createSession({
        user_acknowledged: true,
        mic_permission_granted: true,
        data_processing_accepted: true,
        no_auto_record_acknowledged: false,
      });
    }, /All consent permissions must be explicitly granted/);

    // Full consent granted
    const session = manager.createSession(
      {
        user_acknowledged: true,
        mic_permission_granted: true,
        data_processing_accepted: true,
        no_auto_record_acknowledged: true,
      },
      'Suspected Caller (+91 99999 88888)'
    );

    assert.ok(session.session_id.startsWith('CALL-SAFE-'));
    assert.equal(session.status, 'active');
    assert.equal(session.current_risk_score, 0.0);
    assert.equal(session.current_risk_band, 'low');
    assert.equal(session.full_transcript, '');
    assert.equal(session.utterances.length, 0);
  });

  it('accurately identifies and categorizes threat, urgency, secrecy, and payment phrases', () => {
    const text = 'This is CBI officer calling. You are under digital arrest right now. Do not disconnect and transfer money to RBI safe account.';
    const phrases = detectSuspiciousPhrases(text);

    const categories = new Set(phrases.map((p) => p.category));
    assert.ok(categories.has('threat'), 'Should detect threat category');
    assert.ok(categories.has('urgency'), 'Should detect urgency category');
    assert.ok(categories.has('secrecy'), 'Should detect secrecy category');
    assert.ok(categories.has('payment'), 'Should detect payment category');

    const matchedWords = phrases.map((p) => p.phrase);
    assert.ok(matchedWords.includes('digital arrest'));
    assert.ok(matchedWords.includes('cbi officer') || matchedWords.includes('cbi'));
    assert.ok(matchedWords.includes('do not disconnect'));
    assert.ok(matchedWords.includes('transfer money'));
    assert.ok(matchedWords.includes('safe account') || matchedWords.includes('rbi safe account'));
  });

  it('escalates risk score to Critical and provides urgent actionable prompts as scam speech accumulates', () => {
    const manager = new InMemoryLiveCallManager();
    const session = manager.createSession({
      user_acknowledged: true,
      mic_permission_granted: true,
      data_processing_accepted: true,
      no_auto_record_acknowledged: true,
    });

    // Chunk 1: Initial claim
    const res1 = manager.ingestChunk(session.session_id, 'Hello, I am speaking from Mumbai Police Crime Branch.');
    assert.ok(res1.current_risk_score > 0, 'Risk should start accumulating');
    assert.equal(res1.status, 'active');

    // Chunk 2: Fake seizure
    const res2 = manager.ingestChunk(session.session_id, 'Your identity was used in a seized parcel with drugs found.');
    assert.ok(res2.current_risk_score > res1.current_risk_score);

    // Chunk 3 & 4: Digital arrest & money transfer demand
    manager.ingestChunk(session.session_id, 'You are under digital arrest right now. Do not disconnect, stay in a quiet room.');
    const finalRes = manager.ingestChunk(
      session.session_id,
      'Transfer money to the RBI safe account immediately for clearance or Supreme Court warrant will execute.'
    );

    assert.ok(finalRes.current_risk_score >= 75.0, `Expected >= 75.0, got ${finalRes.current_risk_score}`);
    assert.equal(finalRes.current_risk_band, 'critical');

    // Actionable prompts validation
    const promptString = finalRes.actionable_safety_prompts.join(' ');
    assert.ok(promptString.includes('HANG UP IMMEDIATELY'));
    assert.ok(promptString.includes('DO NOT TRANSFER MONEY'));
    assert.ok(promptString.includes('1930'));

    // Helplines present
    assert.ok(finalRes.official_helpline_recommendations.some((h) => h.number === '1930'));
  });

  it('supports pause, resume, and stop lifecycles without recording unconsented speech while paused', () => {
    const manager = new InMemoryLiveCallManager();
    const session = manager.createSession({
      user_acknowledged: true,
      mic_permission_granted: true,
      data_processing_accepted: true,
      no_auto_record_acknowledged: true,
    });

    manager.ingestChunk(session.session_id, 'Phase 1 conversation.');
    assert.equal(session.full_transcript, 'Phase 1 conversation.');

    // Pause session
    manager.pauseSession(session.session_id);
    assert.equal(session.status, 'paused');

    // Attempting speech while paused must NOT be recorded
    manager.ingestChunk(session.session_id, 'Confidential family chatter during pause.');
    assert.ok(!session.full_transcript.includes('Confidential family chatter'));

    // Resume session
    manager.resumeSession(session.session_id);
    assert.equal(session.status, 'active');

    manager.ingestChunk(session.session_id, 'Phase 2 conversation resumes.');
    assert.ok(session.full_transcript.includes('Phase 2 conversation resumes.'));

    // Stop session
    manager.stopSession(session.session_id);
    assert.equal(session.status, 'stopped');

    assert.throws(() => {
      manager.ingestChunk(session.session_id, 'Words after stop');
    }, /Session is stopped/);
  });

  it('completely purges session transcript and memory on demand leaving zero residue', () => {
    const manager = new InMemoryLiveCallManager();
    const session = manager.createSession({
      user_acknowledged: true,
      mic_permission_granted: true,
      data_processing_accepted: true,
      no_auto_record_acknowledged: true,
    });

    manager.ingestChunk(session.session_id, 'Sensitive caller conversation to be wiped.');
    assert.ok(session.full_transcript.length > 0);

    const purgeResult = manager.purgeSession(session.session_id);
    assert.equal(purgeResult.purged, true);

    // Verifying session is completely gone
    assert.throws(() => {
      manager.getSession(session.session_id);
    }, /not found/);
  });

  it('correctly provides pre-configured realistic scam simulation scenarios', () => {
    assert.ok(SAMPLE_CALL_SIMULATIONS.length >= 3);
    const digitalArrestSim = SAMPLE_CALL_SIMULATIONS.find((s) => s.id === 'sim-digital-arrest');
    assert.ok(digitalArrestSim);
    assert.ok(digitalArrestSim.chunks.length >= 4);

    const benignSim = SAMPLE_CALL_SIMULATIONS.find((s) => s.id === 'sim-benign-appointment');
    assert.ok(benignSim);
    // Benign scenario should yield low risk
    const detected = benignSim.chunks.flatMap((c) => detectSuspiciousPhrases(c));
    const assessment = calculateRiskAssessment(detected);
    assert.equal(assessment.band, 'low');
    assert.ok(assessment.score < 25.0);
  });
});

