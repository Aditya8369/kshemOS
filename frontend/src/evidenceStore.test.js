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



test('generates secure case-scoped upload links bound to report and allowed types', () => {
  const store = createLocalEvidenceStore(null);
  const link = store.createUploadLink({
    report_id: 'RPT-0001',
    incident_id: 'INC-001',
    title: 'Extortion Call Recording',
    allowed_file_types: ['audio/wav', 'video/mp4'],
    max_file_size_bytes: 20 * 1024 * 1024,
    expiry_minutes: 45,
    requires_passcode: false,
    created_by_badge: 'INSP-SHARMA-01',
  });

  assert.ok(link.link_id.startsWith('UPL-'));
  assert.ok(link.token.startsWith('tok_'));
  assert.equal(link.report_id, 'RPT-0001');
  assert.equal(link.status, 'active');
  assert.equal(link.is_expired, false);
  assert.deepEqual(link.allowed_file_types, ['audio/wav', 'video/mp4']);
  assert.equal(link.max_file_size_bytes, 20 * 1024 * 1024);
  assert.ok(link.expires_at > Date.now());
});

test('enforces short-lived token expiry and optional passcode verification', () => {
  const store = createLocalEvidenceStore(null);
  const link = store.createUploadLink({
    report_id: 'CASE-2026-DELHI-01',
    title: 'Debit Slip',
    requires_passcode: true,
    passcode: '9021',
    expiry_minutes: 60,
  });

  // Missing passcode
  const val1 = store.validateUploadToken(link.token);
  assert.equal(val1.valid, false);
  assert.equal(val1.status, 'passcode_required');

  // Wrong passcode
  const val2 = store.validateUploadToken(link.token, '1234');
  assert.equal(val2.valid, false);
  assert.equal(val2.status, 'invalid_passcode');

  // Correct passcode
  const val3 = store.validateUploadToken(link.token, '9021');
  assert.equal(val3.valid, true);
  assert.equal(val3.status, 'active');

  // Simulate expiration
  store._setLinkExpiry(link.link_id, Date.now() - 1000);
  const valExpired = store.validateUploadToken(link.token, '9021');
  assert.equal(valExpired.valid, false);
  assert.equal(valExpired.status, 'expired');
});

test('fulfills evidence upload, logs chain of custody, and generates immutable receipt', () => {
  const store = createLocalEvidenceStore(null);
  const link = store.createUploadLink({
    report_id: 'RPT-0001',
    title: 'Victim Audio',
    allowed_file_types: ['audio/wav'],
    max_file_size_bytes: 10 * 1024 * 1024,
  });

  const uploadResult = store.uploadEvidenceViaLink(link.token, {
    file_name: 'extortion_voice_clip.wav',
    mime_type: 'audio/wav',
    raw_payload_content: 'RAW-AUDIO-BYTES-TIMESTAMPED-LEGAL-EVIDENCE',
    uploader_name: 'Pooja Verma',
    uploader_notes: 'Uploaded from Android recorder',
    client_ip: '192.168.1.50',
  });

  assert.equal(uploadResult.success, true);
  assert.ok(uploadResult.evidence_id);
  const receipt = uploadResult.receipt;
  assert.ok(receipt.receipt_id.startsWith('RCPT-'));
  assert.equal(receipt.report_id, 'RPT-0001');
  assert.equal(receipt.file_name, 'extortion_voice_clip.wav');
  assert.equal(receipt.sha256_fingerprint.length, 64);
  assert.equal(receipt.vault_status, 'ingested_and_sealed');
  assert.ok(receipt.verification_token.startsWith('VTOK-'));

  // Custody ledger check
  const ledger = store.getCustodialLedger(uploadResult.evidence_id);
  const uploadLog = ledger.find((e) => e.action === 'CITIZEN_SECURE_LINK_UPLOAD');
  assert.ok(uploadLog);
  assert.ok(uploadLog.details.includes('RPT-0001'));
  assert.equal(uploadLog.client_ip, '192.168.1.50');

  // Single-use check: Link becomes completed and cannot be re-used
  assert.throws(
    () =>
      store.uploadEvidenceViaLink(link.token, {
        file_name: 'second.wav',
        mime_type: 'audio/wav',
        raw_payload_content: 'ANOTHER-PAYLOAD',
      }),
    /already been fulfilled/
  );
});

test('allows authorised staff to revoke links and blocks uploads on revoked links', () => {
  const store = createLocalEvidenceStore(null);
  const link = store.createUploadLink({
    report_id: 'RPT-0004',
    title: 'Bank Statement',
  });

  const revoked = store.revokeUploadLink(link.link_id, {
    revokedByBadge: 'INSP-GUPTA-99',
    officerName: 'Inspector Gupta',
    revocationReason: 'Complainant reported accidental report creation',
  });

  assert.equal(revoked.status, 'revoked');
  assert.equal(revoked.revoked_by_badge, 'INSP-GUPTA-99');
  assert.equal(revoked.revocation_reason, 'Complainant reported accidental report creation');

  // Validation must report revoked
  const val = store.validateUploadToken(link.token);
  assert.equal(val.valid, false);
  assert.equal(val.status, 'revoked');

  // Upload attempt must throw
  assert.throws(
    () =>
      store.uploadEvidenceViaLink(link.token, {
        file_name: 'statement.pdf',
        mime_type: 'application/pdf',
        raw_payload_content: 'PDF-DATA',
      }),
    /revoked/
  );
});
