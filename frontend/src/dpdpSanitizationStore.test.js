import test from 'node:test';
import assert from 'node:assert/strict';

import {
  maskAadhaar,
  maskPan,
  maskBankAccount,
  maskMobile,
  maskEmail,
  generatePersistentToken,
  sanitizeTextLocally,
  pseudonymizeThreatFeedLocally,
  listUnmaskRequestsLocally,
  submitUnmaskRequestLocally,
  reviewUnmaskRequestLocally,
  revealUnmaskedValueLocally,
  getDpdpAuditTrailLocally,
} from './dpdpSanitizationStore.js';

test('maskAadhaar masks 12-digit numbers to UIDAI XXXX-XXXX-1234 format', () => {
  assert.equal(maskAadhaar('482910428492'), 'XXXX-XXXX-8492');
  assert.equal(maskAadhaar('4829 1042 8492'), 'XXXX-XXXX-8492');
  assert.equal(maskAadhaar('4829-1042-8492'), 'XXXX-XXXX-8492');
  assert.equal(maskAadhaar('invalid'), 'XXXX-XXXX-XXXX');
});

test('maskPan masks 10-char PAN to ABCDE****F format', () => {
  assert.equal(maskPan('ABCDE1234F'), 'ABCDE****F');
  assert.equal(maskPan('bkzps9876k'), 'BKZPS****K');
  assert.equal(maskPan('123'), 'ABCDE****X');
});

test('maskBankAccount masks account number preserving last 4 digits', () => {
  assert.equal(maskBankAccount('987654321098'), 'XXXXXXXX1098');
  assert.equal(maskBankAccount('123456789'), 'XXXXXXXX6789');
  assert.equal(maskBankAccount('12'), 'XXXXXXXX');
});

test('maskMobile and maskEmail mask contacts consistently', () => {
  assert.equal(maskMobile('+91 98765 43210'), '+91 XXXXX 43210');
  assert.equal(maskMobile('9876543210'), '+91 XXXXX 43210');
  assert.equal(maskEmail('citizen.victim@example.com'), 'c***m@example.com');
  assert.equal(maskEmail('ab@example.com'), 'a***@example.com');
});

test('generatePersistentToken generates deterministic pseudonymous tokens', () => {
  const tok1 = generatePersistentToken('482910428492', 'CITIZEN', 'salt_a');
  const tok2 = generatePersistentToken('482910428492', 'CITIZEN', 'salt_a');
  const tok3 = generatePersistentToken('987654321098', 'CITIZEN', 'salt_a');

  assert.equal(tok1, tok2, 'Tokens for identical input and salt must match');
  assert.ok(tok1.startsWith('CITIZEN_REF_'));
  assert.ok(tok3.startsWith('CITIZEN_REF_'));
  assert.notEqual(tok1, tok3, 'Tokens for different inputs should differ');

  const accToken = generatePersistentToken('987654321098', 'ACCOUNT', 'salt_a');
  assert.ok(accToken.startsWith('ACC_REF_'));
});

test('sanitizeTextLocally redacts mixed citizen report text without false positives', () => {
  const rawText = `Citizen reported loss of Rs 50,000. Victim Aadhaar: 4829 1042 8492, PAN: ABCDE1234F.
Transferred from SBI Savings Account 987654321098 to fraudster.
Victim phone: +91 98765 43210, Email: rajesh.kumar@example.com.`;

  const { sanitizedText, detectedEntities } = sanitizeTextLocally(rawText);

  assert.ok(!sanitizedText.includes('4829 1042 8492'), 'Aadhaar must be redacted');
  assert.ok(sanitizedText.includes('XXXX-XXXX-8492'), 'Masked Aadhaar format must be present');
  assert.ok(!sanitizedText.includes('ABCDE1234F'), 'PAN must be redacted');
  assert.ok(sanitizedText.includes('ABCDE****F'), 'Masked PAN format must be present');
  assert.ok(!sanitizedText.includes('987654321098'), 'Bank account must be redacted');
  assert.ok(sanitizedText.includes('XXXXXXXX1098'), 'Masked account format must be present');
  assert.ok(!sanitizedText.includes('rajesh.kumar@example.com'), 'Email must be redacted');

  assert.ok(detectedEntities.length >= 4, 'Entities must be identified');
  const entityTypes = detectedEntities.map((e) => e.entity_type);
  assert.ok(entityTypes.includes('AADHAAR'));
  assert.ok(entityTypes.includes('PAN'));
  assert.ok(entityTypes.includes('BANK_ACCOUNT'));
  assert.ok(entityTypes.includes('EMAIL'));
});

test('pseudonymizeThreatFeedLocally preserves graph relationship topology', () => {
  const feedItems = [
    {
      record_id: 'INC-001',
      source: '482910428492',
      source_type: 'CITIZEN',
      target: 'MULE_ACC_8819',
      target_type: 'ACCOUNT',
      description: 'Victim 4829 1042 8492 sent Rs 10000 to mule.',
    },
    {
      record_id: 'INC-002',
      source: '482910428492',
      source_type: 'CITIZEN',
      target: 'TELEGRAM_BOT_99',
      target_type: 'CHANNEL',
      description: 'Second report by victim with PAN ABCDE1234F.',
    },
  ];

  const result = pseudonymizeThreatFeedLocally(feedItems, 'test_salt');
  assert.equal(result.graphTopologyPreserved, true);
  assert.equal(result.sanitizedItems.length, 2);

  // Victim source token in both incidents must be identical
  const source1 = result.sanitizedItems[0].source;
  const source2 = result.sanitizedItems[1].source;
  assert.ok(source1.startsWith('CITIZEN_REF_'));
  assert.equal(source1, source2, 'Same victim must yield identical pseudonymous graph node');
  assert.ok(!result.sanitizedItems[0].description.includes('4829 1042 8492'));
  assert.ok(!result.sanitizedItems[1].description.includes('ABCDE1234F'));
});

test('unmask workflow enforces dual-authorization and grants time-bounded lease', () => {
  // 1. Submit unmask request
  const newReq = submitUnmaskRequestLocally({
    record_id: 'REP-UNIT-TEST-101',
    field_name: 'aadhaar',
    case_fir_number: 'FIR 999/2026',
    legal_basis: 'SECTION_91_CRPC',
    justification: 'Court verification required',
    requester_badge_id: 'OFF-IO-TEST-1',
    requester_name: 'IO Test Officer',
  });

  assert.ok(newReq.request_id);
  assert.equal(newReq.status, 'PENDING_SUPERVISORY_APPROVAL');

  // 2. Reject self-approval (Dual-authorization enforcement)
  assert.throws(
    () => {
      reviewUnmaskRequestLocally({
        requestId: newReq.request_id,
        action: 'APPROVE',
        supervisorBadgeId: 'OFF-IO-TEST-1', // Same officer
        supervisorName: 'IO Test Officer',
        approvalNotes: 'Self approval attempt',
      });
    },
    { message: /Dual-authorization violation/ },
    'Investigating officer cannot approve their own unmask request'
  );

  // 3. Supervisor approves
  const approved = reviewUnmaskRequestLocally({
    requestId: newReq.request_id,
    action: 'APPROVE',
    supervisorBadgeId: 'SUP-DCP-TEST-9',
    supervisorName: 'DCP Supervisor',
    approvalNotes: 'Statutory exemption approved under Section 91 CrPC',
  });

  assert.equal(approved.status, 'APPROVED');
  assert.ok(approved.lease_expires_at > Date.now());

  // 4. Reveal identity
  const revealed = revealUnmaskedValueLocally(newReq.request_id, 'OFF-IO-TEST-1');
  assert.ok(revealed.unmasked_value);
  assert.equal(revealed.field_name, 'aadhaar');
  assert.ok(revealed.audit_transaction_id.startsWith('DPDP-AUDIT-'));
  assert.ok(revealed.seconds_remaining > 0);

  // 5. Verify audit trail has recorded all actions
  const audit = getDpdpAuditTrailLocally();
  assert.ok(audit.length >= 3);
  const actions = audit.map((a) => a.action);
  assert.ok(actions.includes('UNMASK_REQUEST_SUBMITTED'));
  assert.ok(actions.includes('UNMASK_APPROVED'));
  assert.ok(actions.includes('DPDP_UNMASK_ACCESSED'));
});

