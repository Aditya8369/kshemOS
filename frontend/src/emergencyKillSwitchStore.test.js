import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateLocalMitigationReceipt,
  getAadhaarLockGuide,
  getEmergencyBankById,
  getEmergencyBanksList,
  getStoredMitigationReceipts,
  resetLocalMitigationReceiptsStore,
  sha256Sync,
} from './emergencyKillSwitchStore.js';

beforeEach(() => {
  resetLocalMitigationReceiptsStore();
});

test('retrieves emergency banks registry with verified USSD and SMS syntaxes', () => {
  const banks = getEmergencyBanksList();
  assert.ok(banks.length >= 12);

  const sbi = banks.find((b) => b.bank_id === 'sbi');
  assert.ok(sbi);
  assert.equal(sbi.bank_name, 'State Bank of India (SBI)');
  assert.equal(sbi.ussd_code, '*99#');
  assert.match(sbi.ussd_instructions, /Dial \*99#/);
  assert.match(sbi.sms_card_block_syntax, /BLOCK/);
  assert.equal(sbi.sms_card_block_number, '567676');
  assert.ok(sbi.phone_hotline.includes('1800 1234'));
  assert.ok(sbi.netbanking_url.startsWith('https://'));
});

test('resolves bank by ID case-insensitively and returns null for unknown', () => {
  const hdfcUpper = getEmergencyBankById('HDFC');
  assert.ok(hdfcUpper);
  assert.equal(hdfcUpper.bank_name, 'HDFC Bank');
  assert.equal(hdfcUpper.sms_card_block_number, '5676712');

  const icici = getEmergencyBankById('icici');
  assert.ok(icici);
  assert.equal(icici.bank_name, 'ICICI Bank');

  const unknown = getEmergencyBankById('bank_does_not_exist');
  assert.equal(unknown, null);
});

test('returns complete Aadhaar biometric lock guide with AePS defense and 1947 SMS syntax', () => {
  const guide = getAadhaarLockGuide();
  assert.equal(guide.myaadhaar_portal_url, 'https://myaadhaar.uidai.gov.in');
  assert.equal(guide.uidai_helpline, '1947');
  assert.match(guide.why_lock_biometrics, /AePS/);
  assert.match(guide.aeps_vulnerability_explanation, /fingerprint/i);
  assert.equal(guide.steps.length, 5);

  // Validate 1947 SMS syntax
  assert.ok(guide.sms_1947_syntax.step_1_get_otp.includes('GETOTP'));
  assert.ok(guide.sms_1947_syntax.step_2_lock_uid.includes('LOCKUID'));
  assert.ok(guide.sms_1947_syntax.unlock_uid.includes('UNLOCKUID'));
});

test('generates certified Emergency Mitigation Receipt with SHA-256 seal for RBI zero liability compliance', () => {
  const receiptData = {
    citizen_name: 'Pooja Verma',
    selected_bank_id: 'axis',
    bank_name: 'Axis Bank',
    card_last_4: '7721',
    account_last_4: '1099',
    actions_attempted: [
      'Sent SMS BLOCK 7721 to 56161600',
      'Dialed *99# to deregister UPI',
      'Locked Aadhaar biometrics on myAadhaar',
    ],
    reported_to_1930: true,
    reported_to_portal: true,
    aadhaar_biometrics_locked: true,
  };

  const receipt = generateLocalMitigationReceipt(receiptData);

  assert.ok(receipt.receipt_id.startsWith('EMR-'));
  assert.equal(receipt.citizen_name, 'Pooja Verma');
  assert.equal(receipt.bank_name, 'Axis Bank');
  assert.equal(receipt.card_last_4, '7721');
  assert.equal(receipt.reported_to_1930, true);
  assert.equal(receipt.aadhaar_biometrics_locked, true);

  // Cryptographic hash check
  assert.equal(receipt.sha256_hash.length, 64);
  assert.ok(receipt.verification_token.startsWith('RBI-MITIG-'));

  // RBI circular reference check
  assert.match(receipt.rbi_circular_reference, /DBR\.No\.Leg\.BC\.78\/09\.07\.005\/2017-18/);
  assert.match(receipt.rbi_circular_reference, /Zero Liability/);

  // Storage persistence check
  const stored = getStoredMitigationReceipts();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].receipt_id, receipt.receipt_id);
});

test('resets mitigation receipts store cleanly', () => {
  generateLocalMitigationReceipt({
    selected_bank_id: 'sbi',
    bank_name: 'State Bank of India',
  });
  assert.equal(getStoredMitigationReceipts().length, 1);

  resetLocalMitigationReceiptsStore();
  assert.equal(getStoredMitigationReceipts().length, 0);
});
