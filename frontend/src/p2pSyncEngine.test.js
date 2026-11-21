import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateQRCodeSVG,
  encodeSignalingPayload,
  decodeSignalingPayload,
  applyPeerMeshExchange,
  executeSimulatedPeerMeshSync,
  P2PMeshSyncSession,
} from './p2pSyncEngine.js';

import {
  resetLocalFieldSeizuresStore,
  getStoredFieldSeizures,
  DEFAULT_OFFICER_PIN,
  encryptPayload,
} from './fieldSeizureStore.js';

beforeEach(() => {
  resetLocalFieldSeizuresStore();
});

test('generates valid SVG QR code string with standard matrix structure', () => {
  const samplePayload = 'KSHEMOS:OFFER:TEST_PAYLOAD_STRING_12345';
  const svg = generateQRCodeSVG(samplePayload, { size: 240 });

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="240"'));
  assert.ok(svg.includes('height="240"'));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.endsWith('</svg>'));
});

test('encodes and decodes WebRTC signaling payloads correctly', () => {
  const original = {
    protocol: 'kshemos.p2p.v1',
    type: 'OFFER',
    sessionId: 'P2P-177000-TEST',
    officerBadge: 'INSP-VERMA-771',
    officerName: 'Inspector Ananya Verma',
    timestampMs: 1770000000000,
    sdp: 'v=0\r\no=KshemOS 123 2 IN IP4 127.0.0.1\r\ns=P2P\r\n',
  };

  const encoded = encodeSignalingPayload(original);
  assert.ok(encoded.startsWith('KSHEMOS:OFFER:'));

  const decoded = decodeSignalingPayload(encoded);
  assert.equal(decoded.protocol, original.protocol);
  assert.equal(decoded.type, 'OFFER');
  assert.equal(decoded.sessionId, original.sessionId);
  assert.equal(decoded.officerBadge, original.officerBadge);
  assert.equal(decoded.sdp, original.sdp);
});

test('applies peer mesh exchange, resolves conflicts, and appends PEER_MESH_EXCHANGED event', () => {
  const pairingTimestampMs = Date.now();
  const peerBadge = 'SUB-INSP-DESHMUKH-202';
  const peerName = 'Sub-Inspector Vikram Deshmukh';

  // Seed record SEIZ-2026-DEL-02 exists with offline_timestamp_ms: 1770003600000
  // Incoming record has earlier timestamp (1770001000000) -> Incoming should win!
  const earlierIncomingRecord = {
    seizure_id: 'SEIZ-2026-DEL-02',
    case_id: 'CASE-2026-DELHI-01',
    incident_id: 'INC-DEL-401',
    officer_badge: peerBadge,
    officer_name: peerName,
    device_category: 'laptop',
    make_model: 'Apple MacBook Pro M3 Max (1TB)',
    seizure_bag_barcode: 'BAG-DEL-7783-B',
    offline_timestamp_ms: 1770001000000, // Earlier on-scene capture!
    offline_timestamp_iso: '2026-02-02T10:03:20.000Z',
    on_site_genesis_hash: '22839b2b2b1bc5ceb6375bcbcfaea373235b2e9894e63b6a9bc245eb0a98f796',
    faraday_bag_sealed: true,
  };

  const brandNewRecord = {
    seizure_id: 'SEIZ-NEW-MESH-991',
    case_id: 'CASE-2026-DELHI-01',
    incident_id: 'INC-DEL-401',
    officer_badge: peerBadge,
    officer_name: peerName,
    device_category: 'crypto_hardware_wallet',
    make_model: 'Trezor Model T',
    seizure_bag_barcode: 'BAG-DEL-9911-T',
    offline_timestamp_ms: pairingTimestampMs - 60000,
    offline_timestamp_iso: new Date(pairingTimestampMs - 60000).toISOString(),
    on_site_genesis_hash: '3344556677889900aabbccddeeff0011223344556677889900aabbccddeeff00',
    faraday_bag_sealed: true,
  };

  const incomingEncryptedRecords = [
    {
      seizure_id: earlierIncomingRecord.seizure_id,
      envelope: encryptPayload(earlierIncomingRecord, DEFAULT_OFFICER_PIN),
    },
    {
      seizure_id: brandNewRecord.seizure_id,
      envelope: encryptPayload(brandNewRecord, DEFAULT_OFFICER_PIN),
    },
  ];

  const result = applyPeerMeshExchange({
    incomingEncryptedRecords,
    peerOfficerBadge: peerBadge,
    peerOfficerName: peerName,
    pairingTimestampMs,
    localOfficerBadge: 'INSP-VERMA-771',
    localOfficerPin: DEFAULT_OFFICER_PIN,
  });

  assert.equal(result.auditSummary.conflictsResolved, 1);
  assert.equal(result.auditSummary.incomingWon, 1);
  assert.equal(result.auditSummary.addedNew, 1);
  assert.equal(result.auditSummary.peerOfficerBadge, peerBadge);

  // Verify in storage
  const updatedStored = getStoredFieldSeizures(DEFAULT_OFFICER_PIN);
  const conflicted = updatedStored.find((r) => r.seizure_id === 'SEIZ-2026-DEL-02');
  assert.ok(conflicted);
  assert.equal(conflicted.offline_timestamp_ms, 1770001000000); // Earlier incoming timestamp won!

  // Verify statutory PEER_MESH_EXCHANGED event details
  const meshEvent = conflicted.chain_of_custody_events.find((e) => e.action === 'PEER_MESH_EXCHANGED');
  assert.ok(meshEvent, 'Expected PEER_MESH_EXCHANGED event in custody ledger');
  assert.equal(meshEvent.peer_officer_badge_id, peerBadge);
  assert.ok(meshEvent.local_pairing_timestamp);
  assert.equal(meshEvent.pairing_timestamp_ms, pairingTimestampMs);
  assert.match(meshEvent.details, /P2P WebRTC DataChannel sync/);

  // Verify new record has PEER_MESH_EXCHANGED event
  const brandNewStored = updatedStored.find((r) => r.seizure_id === 'SEIZ-NEW-MESH-991');
  assert.ok(brandNewStored);
  const newMeshEvent = brandNewStored.chain_of_custody_events.find((e) => e.action === 'PEER_MESH_EXCHANGED');
  assert.ok(newMeshEvent);
  assert.equal(newMeshEvent.peer_officer_badge_id, peerBadge);
});

test('executes simulated peer mesh sync end-to-end', () => {
  const result = executeSimulatedPeerMeshSync({
    localOfficerBadge: 'INSP-VERMA-771',
    peerOfficerBadge: 'SUB-INSP-DESHMUKH-202',
    officerPin: DEFAULT_OFFICER_PIN,
  });

  assert.ok(result.auditSummary);
  assert.equal(result.auditSummary.peerOfficerBadge, 'SUB-INSP-DESHMUKH-202');
  assert.ok(result.auditSummary.conflictsResolved >= 1);
  assert.ok(result.auditSummary.addedNew >= 1);

  const stored = getStoredFieldSeizures();
  assert.ok(stored.some((r) => r.chain_of_custody_events.some((e) => e.action === 'PEER_MESH_EXCHANGED')));
});

test('P2PMeshSyncSession creates offer and decodes answer in headless runtime', async () => {
  const initiator = new P2PMeshSyncSession({
    role: 'initiator',
    officerBadge: 'INSP-VERMA-771',
  });

  const offer = await initiator.createOffer();
  assert.ok(offer.startsWith('KSHEMOS:OFFER:'));

  const receiver = new P2PMeshSyncSession({
    role: 'receiver',
    officerBadge: 'SUB-INSP-DESHMUKH-202',
  });

  const answer = await receiver.createAnswerFromOffer(offer);
  assert.ok(answer.startsWith('KSHEMOS:ANSWER:'));

  await initiator.applyAnswer(answer);
  assert.equal(initiator.state, 'connected');

  initiator.close();
  receiver.close();
});
