import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  captureFieldSeizure,
  computeCanonicalGenesisHash,
  decryptPayload,
  encryptPayload,
  getFieldSeizureStats,
  getStoredFieldSeizures,
  isDeviceOnline,
  resetLocalFieldSeizuresStore,
  resolveSeizureConflict,
  setSimulatedOffline,
  triggerVaultSync,
  verifyIntakeLocally,
} from './fieldSeizureStore.js';

beforeEach(() => {
  resetLocalFieldSeizuresStore();
});

test('captures seized hardware offline and generates canonical SHA-256 genesis receipt', () => {
  setSimulatedOffline(true);
  assert.equal(isDeviceOnline(), false);

  const deviceData = {
    case_id: 'CASE-2026-CHANDIGARH-01',
    incident_id: 'INC-CHD-101',
    officer_badge: 'DSP-AHLUWALIA-08',
    officer_name: 'DSP Simran Ahluwalia',
    police_station: 'Cyber Crime Police Station, Sector 17 Chandigarh',
    device_category: 'crypto_hardware_wallet',
    make_model: 'Trezor Safe 3 Hardware Wallet',
    serial_number: 'TRZ-SAFE3-88992',
    mac_address: null,
    seizure_bag_barcode: 'BAG-CHD-8812-A',
    faraday_bag_sealed: true,
    power_state_at_seizure: 'powered_off',
    sim_card_status: 'no_sim',
    offline_timestamp_ms: 1770020000000,
  };

  const record = captureFieldSeizure(deviceData);

  assert.ok(record.seizure_id.startsWith('SEIZ-2026-DEL-'));
  assert.equal(record.case_id, 'CASE-2026-CHANDIGARH-01');
  assert.equal(record.make_model, 'Trezor Safe 3 Hardware Wallet');
  assert.equal(record.sync_status, 'queued_offline');
  assert.equal(record.tamper_flag, false);

  // Validate Genesis SHA-256 calculation
  assert.equal(record.on_site_genesis_hash.length, 64);
  const expectedHash = computeCanonicalGenesisHash(record);
  assert.equal(record.on_site_genesis_hash, expectedHash);

  // Validate RFC 3161 Token
  assert.equal(record.rfc3161_token.digest_algorithm, 'SHA-256');
  assert.equal(record.rfc3161_token.digest_value, record.on_site_genesis_hash);
  assert.equal(record.rfc3161_token.clock_stratum, 1);

  // Validate Genesis Receipt structure
  assert.equal(record.genesis_receipt.receipt_number, `RCV-${record.seizure_id}`);
  assert.equal(record.genesis_receipt.genesis_hash, record.on_site_genesis_hash);
  assert.match(record.genesis_receipt.statutory_declaration, /Section 105.*BNSS/i);
  assert.match(record.genesis_receipt.officer_esign_placeholder, /DSP-AHLUWALIA-08/);
});

test('enforces local storage encryption at rest and rejects unauthorized PIN', () => {
  const secretData = [{ seizure_id: 'SEIZ-SECRET-01', imei: '359998887776665', notes: 'Private Informant Phone' }];
  const validPin = '7492';
  const invalidPin = '0000';

  const encryptedEnvelope = encryptPayload(secretData, validPin);
  assert.ok(encryptedEnvelope.startsWith('ENC:v1:'));
  assert.doesNotMatch(encryptedEnvelope, /Private Informant Phone/);

  // Decrypt with valid PIN
  const decrypted = decryptPayload(encryptedEnvelope, validPin);
  assert.deepEqual(decrypted, secretData);

  // Decrypt with invalid PIN must throw security error
  assert.throws(
    () => {
      decryptPayload(encryptedEnvelope, invalidPin);
    },
    /Decryption failed: Incorrect officer PIN or corrupted tamper record/
  );
});

test('queues offline captures and automatically synchronizes when connection is restored', async () => {
  setSimulatedOffline(true);
  assert.equal(isDeviceOnline(), false);

  const record = captureFieldSeizure({
    case_id: 'CASE-2026-DELHI-05',
    officer_badge: 'INSP-RAWAT-09',
    make_model: 'Google Pixel 7a',
    seizure_bag_barcode: 'BAG-DEL-9911-Z',
  });

  const stored = getStoredFieldSeizures();
  const queued = stored.find((r) => r.seizure_id === record.seizure_id);
  assert.equal(queued.sync_status, 'queued_offline');

  // Cellular restoration
  setSimulatedOffline(false);
  assert.equal(isDeviceOnline(), true);

  const syncResult = await triggerVaultSync();
  assert.ok(syncResult.synced >= 1);

  const refreshed = getStoredFieldSeizures();
  const syncedRec = refreshed.find((r) => r.seizure_id === record.seizure_id);
  assert.equal(syncedRec.sync_status, 'synced_verified');
  assert.ok(syncedRec.synced_at_iso);
});

test('resolves sync conflicts using immutable timestamp order (earliest on-scene capture wins)', () => {
  const tEarly = 1770001000000;
  const tLater = 1770002000000;

  const earlierRecord = {
    seizure_id: 'SEIZ-CONFLICT-01',
    serial_number: 'SERIAL-GENUINE-ORIGINAL',
    offline_timestamp_ms: tEarly,
    offline_timestamp_iso: '2026-02-02T10:00:00Z',
    officer_badge: 'INSP-ORIGINAL',
  };

  const laterRecord = {
    seizure_id: 'SEIZ-CONFLICT-01',
    serial_number: 'SERIAL-MODIFIED-LATER',
    offline_timestamp_ms: tLater,
    offline_timestamp_iso: '2026-02-02T10:16:40Z',
    officer_badge: 'OFF-LATER',
  };

  // Case A: Incoming is earlier than existing -> Incoming wins
  const resA = resolveSeizureConflict(laterRecord, earlierRecord);
  assert.equal(resA.winner, 'incoming');
  assert.equal(resA.winningRecord.serial_number, 'SERIAL-GENUINE-ORIGINAL');
  assert.match(resA.winningRecord.chain_of_custody_events[0].action, /CONFLICT_RESOLVED_EARLIER_TIMESTAMP_WON/);

  // Case B: Existing is earlier than incoming -> Existing wins
  const resB = resolveSeizureConflict(earlierRecord, laterRecord);
  assert.equal(resB.winner, 'existing');
  assert.equal(resB.winningRecord.serial_number, 'SERIAL-GENUINE-ORIGINAL');
  assert.match(resB.winningRecord.chain_of_custody_events[0].action, /CONFLICT_RESOLVED_EXISTING_GENESIS_PRESERVED/);
});

test('flags records immediately when central intake verification hash differs from on-site genesis hash', () => {
  // Capture valid device
  const record = captureFieldSeizure({
    case_id: 'CASE-2026-DELHI-09',
    officer_badge: 'INSP-DELHI-01',
    make_model: 'OnePlus Open Foldable',
    serial_number: 'OP-OPEN-771122',
    seizure_bag_barcode: 'BAG-GENUINE-55',
    faraday_bag_sealed: true,
  });

  // Central lab receives arriving package, but detects broken tamper seal and swapped bag barcode
  const intakeData = {
    verified_by_badge: 'LAB-EXAMINER-DAS-04',
    received_bag_barcode: 'BAG-SWAPPED-TAMPERED-00', // Mismatch!
    verified_serial: 'OP-OPEN-771122',
    bag_seal_intact: false, // Broken!
  };

  const verified = verifyIntakeLocally(record.seizure_id, intakeData);

  assert.equal(verified.tamper_flag, true);
  assert.equal(verified.sync_status, 'synced_tamper_flagged');
  assert.match(verified.tamper_reason, /INTEGRITY_TAMPER_FLAGGED/);
  assert.match(verified.tamper_reason, /Bag barcode mismatch/);
  assert.match(verified.tamper_reason, /Evidence bag tamper-evident tape or seal arrived broken\/torn/);

  // Custodial chain event recorded
  const lastEvent = verified.chain_of_custody_events[verified.chain_of_custody_events.length - 1];
  assert.equal(lastEvent.action, 'CENTRAL_INTAKE_TAMPER_FLAGGED');
  assert.equal(lastEvent.badge, 'LAB-EXAMINER-DAS-04');
});

test('verifies clean central intake when bag barcode and hardware serial match perfectly', () => {
  // Seed record SEIZ-2026-DEL-02
  const intakeData = {
    verified_by_badge: 'LAB-FORENSIC-LEAD',
    received_bag_barcode: 'BAG-DEL-7783-B', // Exact match
    verified_serial: 'C02G90XXMD6M', // Exact match
    bag_seal_intact: true,
  };

  const verified = verifyIntakeLocally('SEIZ-2026-DEL-02', intakeData);

  assert.equal(verified.tamper_flag, false);
  assert.equal(verified.sync_status, 'synced_verified');
  assert.equal(verified.central_intake_hash, verified.on_site_genesis_hash);
  assert.equal(verified.tamper_reason, null);

  const lastEvent = verified.chain_of_custody_events[verified.chain_of_custody_events.length - 1];
  assert.equal(lastEvent.action, 'CENTRAL_INTAKE_VERIFIED_VALID');

  const stats = getFieldSeizureStats();
  assert.ok(stats.totalSeizures >= 3);
  assert.ok(stats.faradaySealedPercent > 0);
});

