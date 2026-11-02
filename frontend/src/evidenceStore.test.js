import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLocalEvidenceStore,
  sha256Sync,
  generateRfc3161Token,
  computeLogHash,
  GENESIS_HASH,
} from './evidenceStore.js';

test('cryptographic fingerprinting produces accurate SHA-256 and RFC 3161 timestamp token', () => {
  const content = 'DIGITAL-EVIDENCE-TEST-PAYLOAD-1234';
  const digest = sha256Sync(content);
  assert.equal(digest.length, 64);

  // Consistency check
  assert.equal(sha256Sync('test'), '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');

  const token = generateRfc3161Token(digest, 1770000000000);
  assert.ok(token.serial_number.startsWith('TSA-'));
  assert.equal(token.digest_algorithm, 'SHA-256');
  assert.equal(token.digest_value, digest);
  assert.ok(token.tsa_authority.includes('KshemOS-TSA'));
  assert.equal(token.timestamp_iso, new Date(1770000000000).toISOString());
});

test('local evidence store pre-seeds default evidence with genesis custodial ledgers', () => {
  const store = createLocalEvidenceStore(null);
  const items = store.getEvidenceItems();
  assert.ok(items.length >= 4);

  const digitalArrest = items.find((i) => i.id === 'EVID-2026-00101');
  assert.ok(digitalArrest);
  assert.equal(digitalArrest.category, 'digital_arrest');
  assert.equal(digitalArrest.legal_hold, true);
  assert.equal(digitalArrest.sha256_hash.length, 64);

  const ledger = store.getCustodialLedger('EVID-2026-00101');
  assert.ok(ledger.length >= 1);
  assert.equal(ledger[0].action, 'INGESTION');
  assert.equal(ledger[0].previous_hash, GENESIS_HASH);

  // Initial verification must pass
  const ver = store.verifyEvidenceIntegrity('EVID-2026-00101');
  assert.equal(ver.verified, true);
  assert.equal(ver.sha256_match, true);
  assert.equal(ver.custodial_ledger_intact, true);
});

test('ingesting new evidence computes SHA-256 and applies statutory retention clocks', () => {
  const store = createLocalEvidenceStore(null);
  const rawPayload = 'AUDIO-INTERCEPT: Fraudster demanding ₹5,00,000 transfer to avoid arrest.';

  const created = store.ingestEvidenceItem({
    case_id: 'CASE-2026-NORTH-11',
    title: 'Extortion Audio Intercept Clip',
    description: 'VoIP call recording captured by citizen.',
    evidence_type: 'audio_recording',
    category: 'digital_arrest',
    source: 'citizen_report',
    raw_content: rawPayload,
    file_name: 'extortion_clip.m4a',
    officer_badge_id: 'OFF-SPEC-DIGITAL-ARREST',
    officer_name: 'Inspector Sen',
  });

  assert.equal(created.case_id, 'CASE-2026-NORTH-11');
  assert.equal(created.sha256_hash, sha256Sync(rawPayload));
  assert.equal(created.retention_days, 1825); // 5-year statutory retention for digital arrest
  assert.ok(created.retention_until > created.ingested_at);

  const ledger = store.getCustodialLedger(created.id);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].action, 'INGESTION');
});

test('immutable custodial ledger creates an unbroken cryptographic hash chain', () => {
  const store = createLocalEvidenceStore(null);
  const created = store.ingestEvidenceItem({
    case_id: 'CASE-2026-SOUTH-05',
    title: 'Forged Bank Demand Letter',
    description: 'Fake notice delivered to merchant.',
    evidence_type: 'document',
    category: 'financial_fraud',
    raw_content: 'FORGED-NOTICE-CONTENT-1234',
    officer_badge_id: 'OFF-S1',
  });
  const evId = created.id;

  // Log sequential custodial operations
  store.logCustodialAction(evId, {
    action: 'VIEW',
    officerBadgeId: 'OFF-FORENSIC-02',
    details: 'Examined forensic image in secure viewer.',
  });

  store.logCustodialAction(evId, {
    action: 'ANNOTATE',
    officerBadgeId: 'OFF-FORENSIC-02',
    details: 'Tagged suspect bank IFSC code.',
  });

  store.logCustodialAction(evId, {
    action: 'DOWNLOAD',
    officerBadgeId: 'OFF-LEGAL-COUNCIL',
    details: 'Exported local copy for prosecution brief.',
  });

  const ledger = store.getCustodialLedger(evId);
  assert.equal(ledger.length, 4); // INGESTION + VIEW + ANNOTATE + DOWNLOAD

  // Verify chained hashes
  for (let i = 1; i < ledger.length; i++) {
    assert.equal(ledger[i].previous_hash, ledger[i - 1].integrity_hash);
  }

  // Integrity check should be valid
  const ver = store.verifyEvidenceIntegrity(evId);
  assert.equal(ver.verified, true);
  assert.equal(ver.ledger_entries_verified, 4);
});

test('tamper detection flags corrupted evidence payload', () => {
  const store = createLocalEvidenceStore(null);
  const rawOriginal = 'LEGITIMATE-UNMODIFIED-EVIDENCE-BODY';
  const created = store.ingestEvidenceItem({
    case_id: 'CASE-TAMPER-01',
    title: 'Tamper Verification Candidate',
    evidence_type: 'document',
    category: 'other',
    raw_content: rawOriginal,
    officer_badge_id: 'OFF-AUDIT-01',
  });
  const evId = created.id;

  // Initial verification passes
  assert.equal(store.verifyEvidenceIntegrity(evId).verified, true);

  // Corrupt the stored raw content
  store._setRawPayload(evId, 'TAMPERED-CORRUPTED-PAYLOAD-MODIFIED');

  // Verification must catch the tampering
  const tamperedResult = store.verifyEvidenceIntegrity(evId);
  assert.equal(tamperedResult.verified, false);
  assert.equal(tamperedResult.sha256_match, false);
  assert.ok(tamperedResult.tamper_status.includes('FAILED'));
});

test('legal-hold overrides retention and logs custodial actions', () => {
  const store = createLocalEvidenceStore(null);
  const evId = 'EVID-2026-00103';

  // Apply legal hold
  const holdRes = store.toggleLegalHold(evId, {
    legalHold: true,
    reason: 'Active Special Cyber Court proceeding No. 88/2026',
    officerBadgeId: 'OFF-CHIEF-LEGAL',
  });
  assert.equal(holdRes.legal_hold, true);
  assert.ok(holdRes.legal_hold_reason.includes('Active Special Cyber Court'));

  let ledger = store.getCustodialLedger(evId);
  assert.ok(ledger.some((e) => e.action === 'LEGAL_HOLD_APPLIED'));

  // Release legal hold
  const releaseRes = store.toggleLegalHold(evId, {
    legalHold: false,
    reason: 'Case resolved; defendant convicted.',
    officerBadgeId: 'OFF-CHIEF-LEGAL',
  });
  assert.equal(releaseRes.legal_hold, false);
  assert.equal(releaseRes.legal_hold_reason, null);

  ledger = store.getCustodialLedger(evId);
  assert.ok(ledger.some((e) => e.action === 'LEGAL_HOLD_RELEASED'));
});

test('forensic export bundle generates court-admissible certificate and manifest', () => {
  const store = createLocalEvidenceStore(null);
  const bundle = store.generateForensicBundle('CASE-2026-DELHI-01', 'OFF-FORENSIC-LEAD');

  assert.ok(bundle.bundle_id.startsWith('BUNDLE-CRIM-'));
  assert.equal(bundle.case_id, 'CASE-2026-DELHI-01');
  assert.ok(bundle.evidence_items.length >= 2);
  assert.equal(bundle.manifest_sha256.length, 64);
  assert.equal(bundle.tamper_verification_passed, true);
  assert.ok(bundle.attestation_statement.includes('Section 65B'));

  // Ensure export action was logged for each evidence item
  for (const item of bundle.evidence_items) {
    const ledger = store.getCustodialLedger(item.id);
    assert.ok(ledger.some((e) => e.action === 'EXPORT_BUNDLE'));
  }
});

