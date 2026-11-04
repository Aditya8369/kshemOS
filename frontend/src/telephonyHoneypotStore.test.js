import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TelephonyHoneypotStore,
  HONEYPOT_PERSONAS,
  KNOWN_SYNDICATES_DB,
} from './telephonyHoneypotStore.js';

describe('TelephonyHoneypotStore & Deflection Engine Logic', () => {
  it('loads deflection personas with specialized prolongation tactics', () => {
    const store = new TelephonyHoneypotStore();
    const personas = store.getPersonas();

    assert.equal(personas.length, 3);
    const shastri = personas.find((p) => p.id === 'PERSONA-SHASTRI-68');
    assert.ok(shastri);
    assert.equal(shastri.age, 68);
    assert.ok(shastri.prolongation_tactic.includes('spectacles'));

    const agarwal = personas.find((p) => p.id === 'PERSONA-AGARWAL-52');
    assert.ok(agarwal);
    assert.ok(agarwal.prolongation_tactic.includes('GPay'));
  });

  it('harvests bank accounts, IFSC codes, UPI VPAs, and payment URLs from scammer utterances', () => {
    const store = new TelephonyHoneypotStore();
    const transcript =
      'Transfer ₹1,80,000 immediately to State Bank of India account 919876543210, IFSC code SBIN0004521, beneficiary Sunil Kumar Meena. ' +
      'Or pay via UPI to verify.rbi.pool@icici or open https://rbi-clearance-portal.online/pay.';

    const harvested = store.extractMuleCredentials(transcript);
    assert.ok(harvested.length >= 3);

    const bank = harvested.find((h) => h.credential_type === 'bank_account');
    assert.ok(bank);
    assert.ok(bank.value.includes('919876543210'));
    assert.equal(bank.ifsc_code, 'SBIN0004521');
    assert.equal(bank.beneficiary_name, 'Sunil Kumar Meena');

    const upi = harvested.find((h) => h.credential_type === 'upi_vpa');
    assert.ok(upi);
    assert.equal(upi.value, 'verify.rbi.pool@icici');

    const url = harvested.find((h) => h.credential_type === 'payment_url');
    assert.ok(url);
    assert.equal(url.value, 'https://rbi-clearance-portal.online/pay');
  });

  it('triangulates call transcripts against known syndicate acoustic and script patterns', () => {
    const store = new TelephonyHoneypotStore();
    const transcript =
      'This is customs Mumbai. Your package containing contraband and narcotics has been seized. ' +
      'You are placed under digital arrest by Supreme Court order. Transfer funds to holding account.';

    const { acoustic_fingerprint, script_triangulation } = store.triangulateCallPatterns(transcript);

    assert.equal(script_triangulation.matched_syndicate_id, 'SYND-MEWAT-08');
    assert.ok(script_triangulation.matched_syndicate_name.includes('Mewat'));
    assert.ok(script_triangulation.script_similarity_pct >= 80.0);
    assert.ok(acoustic_fingerprint.ambient_cross_talk_score >= 0.7);
    assert.ok(acoustic_fingerprint.voip_codec_jitter_ms > 30.0);
  });

  it('executes one-tap citizen call forwarding into an active honeypot deflection session', () => {
    const store = new TelephonyHoneypotStore();

    const session = store.forwardCall({
      caller_phone: '+91-99887-76655',
      caller_claims_to_be: 'CBI Inspector Vikram Rathore',
      preferred_persona_id: 'PERSONA-SHASTRI-68',
      initial_transcript: 'Your Aadhaar is implicated in money laundering. Transfer verification fee immediately.',
    });

    assert.ok(session.session_id.startsWith('HP-CALL-'));
    assert.equal(session.caller_phone, '+91-99887-76655');
    assert.equal(session.persona.id, 'PERSONA-SHASTRI-68');
    assert.equal(session.call_status, 'active');
    assert.equal(session.transcript_turns.length, 2);
    assert.equal(session.transcript_turns[1].speaker, 'PERSONA');
  });

  it('processes live call turns, prolongs call duration, and executes statutory account freezes', () => {
    const store = new TelephonyHoneypotStore();
    const sessions = store.getSessions();
    const activeSession = sessions.find((s) => s.call_status === 'prolonging') || sessions[0];
    const initialTurns = activeSession.transcript_turns.length;
    const initialDuration = activeSession.call_duration_seconds;

    // Process new turn with another mule
    const updated = store.processTurn(
      activeSession.session_id,
      'Transfer funds to alternate Axis Bank account 409100201948 IFSC UTIB0000123 beneficiary Vikram Rathore.'
    );

    assert.equal(updated.transcript_turns.length, initialTurns + 2);
    assert.ok(updated.call_duration_seconds > initialDuration);

    const newMule = updated.harvested_credentials.find((c) => c.value.includes('409100201948'));
    assert.ok(newMule, 'New mule account should be harvested');

    // Execute statutory freeze
    const frozen = store.freezeCredential(activeSession.session_id, newMule.credential_id);
    assert.equal(frozen.freeze_status, 'frozen');
  });
});
