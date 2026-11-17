/**
 * DPDP Act Redaction & Identity Masking Pipeline Store.
 *
 * Implements client-and-server data sanitization under:
 * - Digital Personal Data Protection Act, 2023 (DPDP Act §§ 4, 8, 9, 17)
 * - UIDAI Aadhaar Masking Regulations
 * - RBI Circulars on Masking of Sensitive Financial Credentials
 *
 * Provides:
 * - Deterministic PII regex masking (Aadhaar XXXX-XXXX-1234, PAN ABCDE****F, Bank XXXXXXXX1234).
 * - Persistent pseudonymous tokenization (CITIZEN_REF_8492) preserving graph topology.
 * - Access-controlled, role-audited Unmask Identity workflow with supervisory approvals.
 */

// Offline SHA-256 helper for browser environments
export function sha256Sync(str) {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) bytes.push(code);
    else if (code < 2048) {
      bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else {
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
  }

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen >>> (i * 8)) & 0xff);

  const w = new Uint32Array(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3);
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10);
      w[t] = (((w[t - 16] + s0) | 0) + ((w[t - 7] + s1) | 0)) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (((((h + s1) | 0) + ch) | 0) + ((k[t] + w[t]) | 0)) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => ((v >>> 0) + 0x100000000).toString(16).slice(1))
    .join('');
}

// -----------------------------------------------------------------------------
// PII Masking Utilities
// -----------------------------------------------------------------------------

export function maskAadhaar(raw) {
  const clean = String(raw || '').replace(/[\s\-]/g, '');
  if (clean.length === 12 && /^\d+$/.test(clean)) {
    return `XXXX-XXXX-${clean.slice(-4)}`;
  }
  return 'XXXX-XXXX-XXXX';
}

export function maskPan(raw) {
  const clean = String(raw || '').trim().toUpperCase();
  if (clean.length === 10) {
    return `${clean.slice(0, 5)}****${clean.slice(-1)}`;
  }
  return 'ABCDE****X';
}

export function maskBankAccount(raw) {
  const clean = String(raw || '').replace(/[\s\-]/g, '');
  if (clean.length >= 4) {
    return `XXXXXXXX${clean.slice(-4)}`;
  }
  return 'XXXXXXXX';
}

export function maskMobile(raw) {
  let clean = String(raw || '').replace(/[\s\-\+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2);
  else if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
  if (clean.length === 10) {
    return `+91 XXXXX ${clean.slice(5)}`;
  }
  return '+91 XXXXX XXXXX';
}

export function maskEmail(raw) {
  const parts = String(raw || '').trim().split('@');
  if (parts.length === 2) {
    const [user, domain] = parts;
    const maskedUser = user.length <= 2 ? `${user[0]}***` : `${user[0]}***${user.slice(-1)}`;
    return `${maskedUser}@${domain}`;
  }
  return 'u***r@domain.com';
}

// In-memory token cache
const _tokenCache = {};

export function generatePersistentToken(rawVal, entityType = 'CITIZEN', salt = 'kshemos_dpdp_salt') {
  const norm = String(rawVal || '').trim().toLowerCase();
  const cacheKey = `${salt}:${entityType.toUpperCase()}:${norm}`;
  if (_tokenCache[cacheKey]) return _tokenCache[cacheKey];

  const hash = sha256Sync(cacheKey);
  const num = (parseInt(hash.slice(0, 8), 16) % 9000) + 1000;
  const prefix = entityType.toUpperCase().includes('ACC') ? 'ACC_REF' : 'CITIZEN_REF';
  const token = `${prefix}_${num}`;
  _tokenCache[cacheKey] = token;
  return token;
}

/**
 * Client-side unstructured text sanitizer.
 */
export function sanitizeTextLocally(text, maskTypes = null) {
  if (!text) return { sanitizedText: '', detectedEntities: [] };

  const targets = maskTypes ? maskTypes.map((t) => t.toUpperCase()) : ['AADHAAR', 'PAN', 'BANK_ACCOUNT', 'PHONE', 'EMAIL'];
  const detected = [];
  let result = text;

  // 1. Contextual Bank Accounts
  if (targets.includes('BANK_ACCOUNT')) {
    const bankRegex = /\b(?:account|a\/c|acct|acc|savings|current|deposit|sbi|hdfc|icici|axis|pnb)[\s#:]*(\d{9,18})\b/gi;
    let match;
    while ((match = bankRegex.exec(result)) !== null) {
      const raw = match[1];
      if (raw.length >= 9 && !raw.startsWith('XXXX')) {
        const masked = maskBankAccount(raw);
        const token = generatePersistentToken(raw, 'ACCOUNT');
        detected.push({
          entity_type: 'BANK_ACCOUNT',
          original_snippet: raw,
          masked_value: masked,
          pseudonym_token: token,
        });
        result = result.replace(raw, masked);
      }
    }
  }

  // 2. Aadhaar Numbers
  if (targets.includes('AADHAAR')) {
    const aadhaarRegex = /\b([2-9]\d{3})[ -](\d{4})[ -](\d{4})\b|\b([2-9]\d{11})\b/g;
    let match;
    while ((match = aadhaarRegex.exec(result)) !== null) {
      const raw = match[0];
      const masked = maskAadhaar(raw);
      const token = generatePersistentToken(raw, 'AADHAAR');
      detected.push({
        entity_type: 'AADHAAR',
        original_snippet: raw,
        masked_value: masked,
        pseudonym_token: token,
      });
      result = result.replace(raw, masked);
    }
  }

  // 3. PAN Numbers
  if (targets.includes('PAN')) {
    const panRegex = /\b([A-Z]{5})(\d{4})([A-Z])\b/g;
    let match;
    while ((match = panRegex.exec(result)) !== null) {
      const raw = match[0];
      const masked = maskPan(raw);
      const token = generatePersistentToken(raw, 'PAN');
      detected.push({
        entity_type: 'PAN',
        original_snippet: raw,
        masked_value: masked,
        pseudonym_token: token,
      });
      result = result.replace(raw, masked);
    }
  }

  // 4. Mobile Phones
  if (targets.includes('PHONE')) {
    const mobRegex = /(?:\+91[\-\s]?|0)?\b([6-9]\d{1})\d{4}(\d{4})\b/g;
    let match;
    while ((match = mobRegex.exec(result)) !== null) {
      const raw = match[0];
      if (!raw.startsWith('XXXX') && !raw.startsWith('+91 XXXXX')) {
        const masked = maskMobile(raw);
        const token = generatePersistentToken(raw, 'CITIZEN');
        detected.push({
          entity_type: 'PHONE',
          original_snippet: raw,
          masked_value: masked,
          pseudonym_token: token,
        });
        result = result.replace(raw, masked);
      }
    }
  }

  // 5. Emails
  if (targets.includes('EMAIL')) {
    const emailRegex = /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*([A-Za-z0-9])@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g;
    let match;
    while ((match = emailRegex.exec(result)) !== null) {
      const raw = match[0];
      const masked = maskEmail(raw);
      const token = generatePersistentToken(raw, 'CITIZEN');
      detected.push({
        entity_type: 'EMAIL',
        original_snippet: raw,
        masked_value: masked,
        pseudonym_token: token,
      });
      result = result.replace(raw, masked);
    }
  }

  return {
    sanitizedText: result,
    detectedEntities: detected,
  };
}

/**
 * Pseudonymize threat intelligence feed items.
 */
export function pseudonymizeThreatFeedLocally(feedItems, salt = 'kshemos_dpdp_salt') {
  let totalRedactions = 0;
  let tokenizedCount = 0;

  const sanitizedItems = feedItems.map((it) => {
    const copy = JSON.parse(JSON.stringify(it));

    ['citizen_id', 'reporter_id', 'victim_aadhaar', 'victim_pan', 'victim_account'].forEach((f) => {
      if (copy[f]) {
        copy[f] = generatePersistentToken(copy[f], 'CITIZEN', salt);
        tokenizedCount += 1;
      }
    });

    if (copy.source_type === 'CITIZEN' && copy.source) {
      copy.source = generatePersistentToken(copy.source, 'CITIZEN', salt);
      tokenizedCount += 1;
    }
    if (copy.target_type === 'CITIZEN' && copy.target) {
      copy.target = generatePersistentToken(copy.target, 'CITIZEN', salt);
      tokenizedCount += 1;
    }

    if (copy.description) {
      const res = sanitizeTextLocally(copy.description);
      copy.description = res.sanitizedText;
      totalRedactions += res.detectedEntities.length;
    }

    return copy;
  });

  return {
    sanitizedItems,
    totalRedactions,
    tokenizedCount,
    graphTopologyPreserved: true,
  };
}

// -----------------------------------------------------------------------------
// Offline Unmask Store
// -----------------------------------------------------------------------------

const STORAGE_KEY_UNMASK_REQS = 'kshemos_dpdp_unmask_requests_v1';
const STORAGE_KEY_DPDP_AUDIT = 'kshemos_dpdp_audit_log_v1';

export const DEMO_UNMASK_REQUESTS = [
  {
    request_id: 'UNMASK-REQ-2026-0001',
    record_id: 'REP-2026-DELHI-8841',
    field_name: 'aadhaar',
    case_fir_number: 'FIR No. 142/2026 PS Cyber Crime',
    legal_basis: 'SECTION_91_CRPC',
    justification: 'Court-mandated Section 91 CrPC notice to verify victim KYC against mule beneficiary accounts.',
    requester_badge_id: 'OFF-IO-4412',
    requester_name: 'Inspector Rajesh Kumar',
    requester_role: 'INVESTIGATOR',
    status: 'APPROVED',
    created_at: Date.now() - 3600000,
    reviewed_at: Date.now() - 1800000,
    supervisor_badge_id: 'SUP-DCP-9901',
    supervisor_name: 'DCP Cyber Crime Ops',
    approval_notes: 'Approved under Section 91 CrPC judicial summons.',
    lease_expires_at: Date.now() + 1800000,
  },
  {
    request_id: 'UNMASK-REQ-2026-0002',
    record_id: 'REP-2026-MUMBAI-2201',
    field_name: 'bank_account',
    case_fir_number: 'CR No. 89/2026 BKC Cyber PS',
    legal_basis: 'SECTION_17_DPDP_INVESTIGATION_EXEMPTION',
    justification: 'Interstate syndicate money trail tracking requiring primary account unmasking.',
    requester_badge_id: 'OFF-IO-1092',
    requester_name: 'Sr. Inspector Sanjay Patil',
    requester_role: 'INVESTIGATOR',
    status: 'PENDING_SUPERVISORY_APPROVAL',
    created_at: Date.now() - 600000,
    reviewed_at: null,
    supervisor_badge_id: null,
    supervisor_name: null,
    approval_notes: null,
    lease_expires_at: null,
  },
];

const _memoryFallback = new Map();

function readStorage(key, fallback) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  if (_memoryFallback.has(key)) {
    return _memoryFallback.get(key);
  }
  return fallback;
}

function writeStorage(key, val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(val));
    }
  } catch {}
  _memoryFallback.set(key, val);
}

export function listUnmaskRequestsLocally() {
  return readStorage(STORAGE_KEY_UNMASK_REQS, DEMO_UNMASK_REQUESTS);
}

export function submitUnmaskRequestLocally(data) {
  const list = listUnmaskRequestsLocally();
  const reqId = `UNMASK-REQ-2026-${String(list.length + 1001).padStart(4, '0')}`;
  const now = Date.now();

  const record = {
    request_id: reqId,
    record_id: data.record_id,
    field_name: data.field_name || 'all_pii',
    case_fir_number: data.case_fir_number,
    legal_basis: data.legal_basis,
    justification: data.justification,
    requester_badge_id: data.requester_badge_id || 'OFF-IO-4412',
    requester_name: data.requester_name || 'Investigating Officer',
    requester_role: 'INVESTIGATOR',
    status: 'PENDING_SUPERVISORY_APPROVAL',
    created_at: now,
    reviewed_at: null,
    supervisor_badge_id: null,
    supervisor_name: null,
    approval_notes: null,
    lease_expires_at: null,
  };

  const updated = [record, ...list];
  writeStorage(STORAGE_KEY_UNMASK_REQS, updated);
  logDpdpAuditLocally('UNMASK_REQUEST_SUBMITTED', record.requester_badge_id, record.record_id, record.legal_basis, 'PENDING');
  return record;
}

export function reviewUnmaskRequestLocally({ requestId, action, supervisorBadgeId, supervisorName, approvalNotes }) {
  const list = listUnmaskRequestsLocally();
  const req = list.find((r) => r.request_id === requestId);
  if (!req) throw new Error(`Request ${requestId} not found.`);

  // Dual authorization enforcement
  if (req.requester_badge_id === supervisorBadgeId) {
    throw new Error('Dual-authorization violation: Investigating Officer cannot approve their own unmask request.');
  }

  const now = Date.now();
  req.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  req.reviewed_at = now;
  req.supervisor_badge_id = supervisorBadgeId || 'SUP-DCP-9901';
  req.supervisor_name = supervisorName || 'DCP Cyber Crime Ops';
  req.approval_notes = approvalNotes;
  req.lease_expires_at = action === 'APPROVE' ? now + 3600000 : null;

  writeStorage(STORAGE_KEY_UNMASK_REQS, list);
  logDpdpAuditLocally(`UNMASK_${action}D`, supervisorBadgeId, req.record_id, req.legal_basis, req.status);
  return req;
}

export function revealUnmaskedValueLocally(requestId, requesterBadgeId = 'OFF-IO-4412') {
  const list = listUnmaskRequestsLocally();
  const req = list.find((r) => r.request_id === requestId);
  if (!req) throw new Error(`Request ${requestId} not found.`);

  if (req.status !== 'APPROVED') {
    throw new Error(`Cannot reveal identity: Request is in state '${req.status}'. Supervisory approval required.`);
  }

  const now = Date.now();
  if (req.lease_expires_at && now > req.lease_expires_at) {
    req.status = 'EXPIRED';
    writeStorage(STORAGE_KEY_UNMASK_REQS, list);
    throw new Error('Identity lease has expired. Re-submission and supervisory approval required.');
  }

  const rawDemoData = {
    aadhaar: '4829 1042 8492',
    pan: 'ABCDE1234F',
    bank_account: '987654321098',
    phone: '+91 98765 43210',
    citizen_name: 'Vikramaditya Sen',
  };

  const field = req.field_name;
  const unmaskedVal = rawDemoData[field] || `Aadhaar: ${rawDemoData.aadhaar}, PAN: ${rawDemoData.pan}, A/C: ${rawDemoData.bank_account}`;
  const auditId = logDpdpAuditLocally('DPDP_UNMASK_ACCESSED', requesterBadgeId, req.record_id, req.legal_basis, 'REVEALED_UNDER_WARRANT');

  return {
    request_id: requestId,
    record_id: req.record_id,
    field_name: field,
    unmasked_value: unmaskedVal,
    masked_value: maskAadhaar(rawDemoData.aadhaar),
    requester_badge_id: requesterBadgeId,
    supervisor_badge_id: req.supervisor_badge_id || 'SUP-DCP-9901',
    lease_expires_at: req.lease_expires_at || now + 3600000,
    seconds_remaining: Math.max(0, Math.floor(((req.lease_expires_at || now + 3600000) - now) / 1000)),
    audit_transaction_id: auditId,
    statutory_warning: 'CONFIDENTIAL: Unmasked under statutory court exemption. Unauthorized dissemination violates Section 17 DPDP Act & BNS § 316.',
  };
}

function logDpdpAuditLocally(action, actorBadge, recordId, legalBasis, outcome) {
  const auditList = readStorage(STORAGE_KEY_DPDP_AUDIT, []);
  const auditId = `DPDP-AUDIT-${Date.now()}-${auditList.length + 5001}`;
  const entry = {
    audit_id: auditId,
    timestamp: Date.now(),
    timestamp_iso: new Date().toISOString(),
    action,
    actor_badge_id: actorBadge,
    actor_role: 'OFFICER',
    record_id: recordId,
    legal_basis: legalBasis,
    outcome,
    details: `${action} on record ${recordId} under authority ${legalBasis}`,
    client_ip: '127.0.0.1',
  };
  writeStorage(STORAGE_KEY_DPDP_AUDIT, [entry, ...auditList]);
  return auditId;
}

export function getDpdpAuditTrailLocally() {
  return readStorage(STORAGE_KEY_DPDP_AUDIT, []);
}

// -----------------------------------------------------------------------------
// Backend API Connectors
// -----------------------------------------------------------------------------

const API_BASE = '/api/dpdp';

export async function sanitizePiiApi(payload) {
  const res = await fetch(`${API_BASE}/sanitize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to sanitize PII`);
  return await res.json();
}

export async function pseudonymizeThreatFeedApi(payload) {
  const res = await fetch(`${API_BASE}/pseudonymize-feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to pseudonymize feed`);
  return await res.json();
}

export async function submitUnmaskRequestApi(payload) {
  const res = await fetch(`${API_BASE}/unmask-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.detail || `HTTP ${res.status}: Failed to submit unmask request`);
  }
  return await res.json();
}

export async function listUnmaskRequestsApi(caseId = null, status = null) {
  const params = new URLSearchParams();
  if (caseId) params.set('case_id', caseId);
  if (status) params.set('status', status);
  const q = params.toString();
  const res = await fetch(`${API_BASE}/unmask-requests${q ? `?${q}` : ''}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch unmask requests`);
  return await res.json();
}

export async function reviewUnmaskRequestApi(payload) {
  const res = await fetch(`${API_BASE}/unmask-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.detail || `HTTP ${res.status}: Failed to review unmask request`);
  }
  return await res.json();
}

export async function revealUnmaskedValueApi(requestId, requesterBadgeId = 'OFF-IO-4412') {
  const params = new URLSearchParams({ request_id: requestId, requester_badge_id: requesterBadgeId });
  const res = await fetch(`${API_BASE}/unmask-reveal?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.detail || `HTTP ${res.status}: Failed to reveal unmasked identity`);
  }
  return await res.json();
}

export async function fetchDpdpAuditTrailApi() {
  const res = await fetch(`${API_BASE}/audit-trail`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit trail`);
  return await res.json();
}
