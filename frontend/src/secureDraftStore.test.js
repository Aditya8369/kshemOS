import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setSecureBackend,
  resetSecureDraftStore,
  saveJson,
  loadJson,
  decryptJson,
  encryptJson,
  generateDeviceKey,
} from './secureDraftStore.js';
import { createLocalIncidentStore } from './incidentStore.js';

function captureBackend() {
  const records = new Map();
  const keys = new Map();

  return {
    records,
    keys,
    async get(key) {
      return records.get(key) ?? null;
    },
    async set(key, value) {
      records.set(key, value);
    },
    async delete(key) {
      records.delete(key);
    },
    async clear() {
      records.clear();
    },
    async getKey(id) {
      return keys.get(id) ?? null;
    },
    async setKey(id, value) {
      keys.set(id, value);
    },
    async clearKeys() {
      keys.clear();
    },
  };
}

test('encrypts drafts at rest with AES-GCM and round-trips them', async () => {
  const backend = captureBackend();
  setSecureBackend(backend);

  const draft = {
    incidentId: 'INC-0042',
    description: 'Private informant phone +91 90000 00000',
    linked_account: 'ACC-SENSITIVE-7788',
    notes: 'Witness name withheld',
  };

  await saveJson('kshemos.sync_queue.v1', draft);

  const envelope = backend.records.get('kshemos.sync_queue.v1');
  assert.ok(envelope, 'encrypted record should be persisted');
  assert.equal(envelope.v, 1);

  const serialized = JSON.stringify(envelope);
  assert.equal(serialized.includes('Private informant'), false);
  assert.equal(serialized.includes('ACC-SENSITIVE-7788'), false);
  assert.equal(serialized.includes('Witness name'), false);

  const decrypted = await decryptJson(envelope);
  assert.deepEqual(decrypted, draft);

  // Cache hit returns the same object without a second decrypt.
  const loaded = await loadJson('kshemos.sync_queue.v1');
  assert.deepEqual(loaded, draft);

  resetSecureDraftStore();
});

test('detects tampered ciphertext instead of returning corrupt drafts', async () => {
  const key = await generateDeviceKey();
  const envelope = await encryptJson({ status: 'in_progress' }, key);

  const tampered = {
    ...envelope,
    ct: envelope.ct.slice(0, -4) + 'AAAA',
  };

  await assert.rejects(() => decryptJson(tampered, key));

  resetSecureDraftStore();
});

test('offline incident drafts are encrypted, not written as plaintext', async () => {
  const backend = captureBackend();
  setSecureBackend(backend);

  // No explicit storage: this is the browser default path.
  const store = createLocalIncidentStore();
  store.create({
    category: 'other',
    description: 'Informant says the courier will call +91 90000 11111',
    region: 'West Zone',
  });

  // Allow the queued encryption write to finish.
  await new Promise((resolve) => setTimeout(resolve, 25));

  const envelope = backend.records.get('kshemos.incidents.v1');
  assert.ok(envelope, 'draft record should be persisted');
  assert.equal(
    JSON.stringify(envelope).includes('Informant says'),
    false,
    'plaintext must not be persisted',
  );

  const decrypted = await decryptJson(envelope);
  assert.equal(decrypted.length, 1);
  assert.match(decrypted[0].description, /Informant says/);

  resetSecureDraftStore();
});
