import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateVpa,
  validateUtr,
  validateIfsc,
  parseFinancialEntities,
  evaluateMuleRisk,
  generateSection102NoticeText,
  generateCfcfrmsPayload,
  MuleFreezeStore,
  DEFAULT_SAMPLE_FREEZE_REQUESTS,
} from './muleFreezeStore.js';

test('validateVpa correctly validates and classifies standard and phone-linked VPAs', () => {
  const v1 = validateVpa('payment.fraud@okaxis');
  assert.equal(v1.isValid, true);
  assert.equal(v1.handle, 'okaxis');
  assert.equal(v1.isPhoneLinked, false);

  const v2 = validateVpa('9876543210@paytm');
  assert.equal(v2.isValid, true);
  assert.equal(v2.isPhoneLinked, true);
  assert.equal(v2.handle, 'paytm');

  const v3 = validateVpa('invalid-vpa-format');
  assert.equal(v3.isValid, false);
  assert.ok(v3.error);
});

test('validateUtr and validateIfsc enforce statutory banking length and formats', () => {
  assert.equal(validateUtr('431209876543'), true);
  assert.equal(validateUtr('12345'), false);
  assert.equal(validateUtr('4312098765432'), false);

  const ifscValid = validateIfsc('HDFC0000240');
  assert.equal(ifscValid.isValid, true);
  assert.equal(ifscValid.bankCode, 'HDFC');

  const ifscInvalid = validateIfsc('HDFC240');
  assert.equal(ifscInvalid.isValid, false);
});

test('parseFinancialEntities extracts all indicators from unstructured text', () => {
  const text = `
    The scammer told me to send ₹50,000 to rapid.mule@ybl and ₹10,000 to 9812345678@paytm.
    The UTR generated on PhonePe was 431209876543.
    Bank details provided: Account 20491827401, IFSC code SBIN0001234.
  `;

  const parsed = parseFinancialEntities(text);
  assert.ok(parsed.vpas.includes('rapid.mule@ybl'));
  assert.ok(parsed.vpas.includes('9812345678@paytm'));
  assert.ok(parsed.phoneLinkedVpas.includes('9812345678@paytm'));
  assert.ok(parsed.utrs.includes('431209876543'));
  assert.ok(parsed.ifscCodes.includes('SBIN0001234'));
  assert.ok(parsed.accountNumbers.includes('20491827401'));
  assert.equal(parsed.extractedCount >= 5, true);
});

test('evaluateMuleRisk classifies high amounts or known mules into TIER_1_IMMEDIATE_STOP', () => {
  const evalHigh = evaluateMuleRisk({
    vpa: 'extortion.mule@upi',
    accountNumber: 'ACC-1002',
    transactionAmount: 75000,
    isDigitalArrest: true,
  });

  assert.equal(evalHigh.priorityTier, 'TIER_1_IMMEDIATE_STOP');
  assert.equal(evalHigh.slaMinutes, 15);
  assert.equal(evalHigh.actionDirective, 'IMMEDIATE_DEBIT_FREEZE_AND_HOTLIST');
  assert.equal(evalHigh.graphHopDistance, 0);

  const evalLow = evaluateMuleRisk({
    vpa: 'friend@okhdfcbank',
    transactionAmount: 1500,
  });
  assert.equal(evalLow.priorityTier, 'TIER_3_MONITOR');
  assert.equal(evalLow.slaMinutes, 1440);
});

test('generateSection102NoticeText and generateCfcfrmsPayload create legally valid artifacts', () => {
  const notice = generateSection102NoticeText({
    freezeId: 'FRZ-UPI-2026-9001',
    incidentId: 'INC-2026-99',
    suspectVpa: 'mule@ybl',
    suspectAccount: '9988112233',
    suspectIfsc: 'ICIC0000002',
    utrNumber: '431209876543',
    transactionAmount: 48000,
    officerName: 'Inspector Rajesh Sharma',
    officerBadgeId: 'OFF-DELHI-101',
  });

  assert.match(notice, /SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE/);
  assert.match(notice, /BHARATIYA NAGARIK SURAKSHA SANHITA/);
  assert.match(notice, /431209876543/);
  assert.match(notice, /mule@ybl/);

  const payload = generateCfcfrmsPayload({
    freezeId: 'FRZ-UPI-2026-9001',
    incidentId: 'INC-2026-99',
    suspectVpa: 'mule@ybl',
    utrNumber: '431209876543',
    transactionAmount: 48000,
    priorityTier: 'TIER_1_IMMEDIATE_STOP',
    slaMinutes: 15,
    officerBadgeId: 'OFF-DELHI-101',
    officerName: 'Inspector Rajesh Sharma',
  });

  assert.equal(payload.cfcfrms_header.gateway_protocol, 'I4C-NPCI-PRIORITY-FREEZE-v2.4');
  assert.equal(payload.transaction_mandate.utr_number, '431209876543');
  assert.equal(payload.suspect_beneficiary.freeze_type, 'PROVISIONAL_DEBIT_FREEZE');
});

test('MuleFreezeStore maintains full lifecycle: dispatch, acknowledgment, latency, revocation', () => {
  const store = new MuleFreezeStore([]);

  // 1. Dispatch
  const record = store.dispatchFreeze({
    incidentId: 'INC-2026-TEST',
    suspectVpa: 'test.mule@ybl',
    utrNumber: '112233445566',
    transactionAmount: 95000,
    officerName: 'Inspector Rajesh Sharma',
    officerBadgeId: 'OFF-DELHI-101',
    isDigitalArrest: true,
  });

  assert.equal(record.status, 'DISPATCHED');
  assert.equal(record.priority_tier, 'TIER_1_IMMEDIATE_STOP');
  assert.equal(record.sla_minutes, 15);
  assert.equal(record.audit_events.length, 2);

  // 2. Bank Acknowledgment
  const updated = store.recordBankAcknowledgment(
    record.freeze_id,
    'BANK-REF-99881',
    'FROZEN',
    'Debit freeze active on account'
  );

  assert.equal(updated.status, 'FROZEN');
  assert.equal(updated.bank_nodal_ref, 'BANK-REF-99881');
  assert.ok(updated.bank_response_time_ms >= 0);
  assert.equal(updated.audit_events.length, 3);

  // 3. Stats verification
  const stats = store.getStats();
  assert.equal(stats.totalRequests, 1);
  assert.equal(stats.frozen, 1);
  assert.equal(stats.totalAmountProtectedInr, 95000);

  // 4. Revocation
  const revoked = store.revokeFreeze(
    record.freeze_id,
    'OFF-DELHI-101',
    'Verified genuine merchant refund dispute'
  );
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(revoked.audit_events.length, 4);
});
