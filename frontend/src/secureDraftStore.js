/*
 * At-rest protection for field offline drafts.
 *
 * Sensitive incident drafts must not sit in localStorage as readable JSON.
 * Records are encrypted with AES-GCM (Web Crypto) using a non-extractable
 * device key held in IndexedDB, and the ciphertext is stored in IndexedDB.
 *
 * Threat model: this protects against casual filesystem/localStorage
 * inspection and other-origin scripts. It does not protect against script
 * running in this origin, which is inherent to a browser app. A native
 * wrapper could additionally bind the key to an OS keystore.
 */

const DB_NAME = 'kshemos-secure-drafts';
const DB_VERSION = 1;
const RECORDS_STORE = 'records';
const KEYS_STORE = 'keys';
const DEVICE_KEY_ID = 'device-draft-key';

const memoryRecords = new Map();
const memoryKeys = new Map();
const cache = new Map();

let backend = null;
let keyPromise = null;
let writeChain = Promise.resolve();

function jsonToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function subtleCrypto() {
  return globalThis.crypto?.subtle ? globalThis.crypto : null;
}

export function isSecureStorageSupported() {
  return Boolean(subtleCrypto()) && typeof indexedDB !== 'undefined';
}

/* ------------------------------------------------------------------ */
/* Injectable backend (tests, private mode, unsupported browsers)      */
/* ------------------------------------------------------------------ */

function memoryBackend() {
  return {
    async get(key) {
      return memoryRecords.get(key) ?? null;
    },
    async set(key, value) {
      memoryRecords.set(key, value);
    },
    async delete(key) {
      memoryRecords.delete(key);
    },
    async clear() {
      memoryRecords.clear();
    },
    async getKey(id) {
      return memoryKeys.get(id) ?? null;
    },
    async setKey(id, value) {
      memoryKeys.set(id, value);
    },
    async clearKeys() {
      memoryKeys.clear();
    },
  };
}

function idbBackend() {
  let dbPromise = null;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(RECORDS_STORE)) {
            db.createObjectStore(RECORDS_STORE);
          }
          if (!db.objectStoreNames.contains(KEYS_STORE)) {
            db.createObjectStore(KEYS_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  }

  async function withStore(storeName, mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    get: (key) => withStore(RECORDS_STORE, 'readonly', (store) => store.get(key)),
    set: (key, value) => withStore(RECORDS_STORE, 'readwrite', (store) => store.put(value, key)),
    delete: (key) => withStore(RECORDS_STORE, 'readwrite', (store) => store.delete(key)),
    clear: () => withStore(RECORDS_STORE, 'readwrite', (store) => store.clear()),
    getKey: (id) => withStore(KEYS_STORE, 'readonly', (store) => store.get(id)),
    setKey: (id, value) => withStore(KEYS_STORE, 'readwrite', (store) => store.put(value, id)),
    clearKeys: () => withStore(KEYS_STORE, 'readwrite', (store) => store.clear()),
  };
}

function activeBackend() {
  if (backend) return backend;
  return isSecureStorageSupported() ? idbBackend() : memoryBackend();
}

export function setSecureBackend(custom) {
  backend = custom;
  keyPromise = null;
  cache.clear();
}

export function resetSecureDraftStore() {
  backend = null;
  keyPromise = null;
  cache.clear();
  memoryRecords.clear();
  memoryKeys.clear();
  writeChain = Promise.resolve();
}

/* ------------------------------------------------------------------ */
/* Crypto                                                              */
/* ------------------------------------------------------------------ */

export async function generateDeviceKey() {
  const cryptoApi = subtleCrypto();
  if (!cryptoApi) {
    throw new Error('Web Crypto is unavailable');
  }

  return cryptoApi.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function getDeviceKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const store = activeBackend();
      const existing = await store.getKey(DEVICE_KEY_ID);
      if (existing) return existing;

      const key = await generateDeviceKey();
      await store.setKey(DEVICE_KEY_ID, key);
      return key;
    })();
  }

  return keyPromise;
}

export async function encryptJson(value, key = null) {
  const cryptoApi = subtleCrypto();
  if (!cryptoApi) {
    throw new Error('Web Crypto is unavailable');
  }

  const deviceKey = key || (await getDeviceKey());
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    deviceKey,
    plaintext,
  );

  return {
    v: 1,
    iv: jsonToBase64(iv),
    ct: jsonToBase64(ciphertext),
  };
}

export async function decryptJson(envelope, key = null) {
  const cryptoApi = subtleCrypto();
  if (!cryptoApi) {
    throw new Error('Web Crypto is unavailable');
  }

  if (!envelope || typeof envelope !== 'object' || !envelope.iv || !envelope.ct) {
    throw new Error('Malformed secure draft envelope');
  }

  const deviceKey = key || (await getDeviceKey());
  const plaintext = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    deviceKey,
    base64ToBytes(envelope.ct),
  );

  return JSON.parse(new TextDecoder().decode(plaintext));
}

/* ------------------------------------------------------------------ */
/* Cached, synchronous reads with async encrypted persistence          */
/* ------------------------------------------------------------------ */

export function getCachedJson(key, fallback = null) {
  return cache.has(key) ? cache.get(key) : fallback;
}

export function hasCached(key) {
  return cache.has(key);
}

export function setCachedJson(key, value) {
  cache.set(key, value);
}

export function removeCached(key) {
  cache.delete(key);
}

export async function loadJson(key, fallback = null) {
  if (cache.has(key)) return cache.get(key);

  try {
    const envelope = await activeBackend().get(key);
    if (!envelope) {
      cache.set(key, fallback);
      return fallback;
    }
    const value = await decryptJson(envelope);
    cache.set(key, value);
    return value;
  } catch {
    cache.set(key, fallback);
    return fallback;
  }
}

function enqueueWrite(task) {
  writeChain = writeChain.then(task).catch(() => {});
  return writeChain;
}

export function saveJson(key, value) {
  cache.set(key, value);

  return enqueueWrite(async () => {
    const envelope = await encryptJson(value);
    await activeBackend().set(key, envelope);
  });
}

export function deleteJson(key) {
  cache.delete(key);
  return enqueueWrite(async () => {
    await activeBackend().delete(key);
  });
}

export async function hydrateKeys(keys) {
  const result = {};
  for (const key of keys) {
    result[key] = await loadJson(key, null);
  }
  return result;
}

export async function purgeSecureDrafts() {
  cache.clear();
  await enqueueWrite(async () => {
    const store = activeBackend();
    await store.clear();
    await store.clearKeys();
  });
  keyPromise = null;
}
