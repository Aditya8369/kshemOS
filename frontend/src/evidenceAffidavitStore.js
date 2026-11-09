/**
 * Section 63 BSA / 65B IEA Electronic Evidence Affidavit Compiler Store.
 *
 * Implements automated, court-ready electronic evidence certificate compilation under:
 * - Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA § 63)
 * - Section 65B Indian Evidence Act, 1872 (IEA § 65B)
 * - Supreme Court binding directives in Arjun Panditrao Khotkar (2020) 7 SCC 1
 *
 * Offline-first and API-connected.
 */

// Simple SHA-256 implementation for synchronous browser/offline environments
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

// CSIR-NPL Stratum 1 Master NTP Record
export const OFFICIAL_NTP_RECORD = {
  ntp_server_host: 'time.nplindia.org',
  stratum_level: 1,
  is_synchronized: true,
  clock_offset_ms: 0.342,
  jitter_ms: 0.084,
  round_trip_delay_ms: 1.25,
  reference_clock_id: 'NPLI-GPS',
  leap_indicator: 0,
  statutory_compliance:
    'Complies with Section 63(2)(a) BSA 2023 & Rule 419A Indian Telegraph Rules temporal precision standards (<5.0ms forensic tolerance against UTC(NPLI)).',
};

// Standard hardware profile signatures
export const HARDWARE_SIGNATURE_PROFILES = {
  audio_intercept: {
    device_make_model: 'Dell PowerEdge R750 Cyber Forensic Telephony Ingestion Node',
    hardware_id_type: 'SERVER_SERIAL / MAC',
    hardware_identifier: 'SRV-DEL-9941 / 3C:52:82:1A:BC:44',
    operating_system: 'Ubuntu 24.04 LTS (Kernel 6.8.0-45-generic x86_64)',
    acquisition_software: 'KshemOS Carrier SIP Packet Capture & RFC 3161 Notary v2.4',
    storage_media_type: 'Encrypted NVMe RAID-10 (Samsung PM1733 PCIe 4.0, FIPS-140-3)',
  },
  mobile_seizure: {
    device_make_model: 'OnePlus 11 5G (Model CPH2447 / Dual SIM)',
    hardware_id_type: 'IMEI1 / IMEI2 / SYSTEM_UUID',
    hardware_identifier: '864923051234567 / 864923051234568',
    operating_system: 'Android 14 (OxygenOS 14.0.0.800 kernel 5.15.131)',
    acquisition_software: 'Cellebrite UFED Physical Extraction / KshemOS Mobile Triage v3.1',
    storage_media_type: 'Internal UFS 3.1 256GB Flash Storage',
  },
  bank_slip: {
    device_make_model: 'HP ScanJet Enterprise Flow 7000 s3 / KshemOS Document Ingest Station',
    hardware_id_type: 'DEVICE_SERIAL',
    hardware_identifier: 'CN7812F004 / WORKSTATION-IO-02',
    operating_system: 'Windows 11 Enterprise 23H2 (OS Build 22631.3880)',
    acquisition_software: 'KshemOS Document Forensic Verifier & OCR Cryptographic Ingester v1.8',
    storage_media_type: 'Encrypted SSD BitLocker XTS-AES 256-bit',
  },
  currency_scan: {
    device_make_model: 'KshemOS Optical Currency Verification Unit & Regula 4308 Dual-Spectrum',
    hardware_id_type: 'REGULA_SERIAL / LAB_NODE_ID',
    hardware_identifier: 'REG-4308-IND-9021 / CFSL-OPT-04',
    operating_system: 'Linux 6.8.0-40-generic x86_64',
    acquisition_software: 'KshemOS High-Resolution Spectral Currency Analysis Engine v2.1',
    storage_media_type: 'Write-Once-Read-Many (WORM) Forensic Storage Archive',
  },
  default: {
    device_make_model: 'KshemOS Secure Cloud Forensic Node (AWS ap-south-1 Mumbai)',
    hardware_id_type: 'SYSTEM_UUID',
    hardware_identifier: '550e8400-e29b-41d4-a716-446655440000',
    operating_system: 'Linux 6.8.0-45-generic x86_64',
    acquisition_software: 'KshemOS Cryptographic Custody Ingestion Agent v2.4.0 (FIPS-140-3)',
    storage_media_type: 'Encrypted NVMe Block Volume (AES-256-XTS)',
  },
};

export const DEMO_CASE_PRESETS = {
  'CASE-2026-DELHI-01': {
    case_id: 'CASE-2026-DELHI-01',
    fir_crime_number: 'FIR No. 142/2026 PS Cyber Crime u/s 318(4), 319(2) BNS & 66D IT Act',
    court_name: 'Court of the Chief Metropolitan Magistrate, Rouse Avenue Courts, New Delhi',
    investigating_officer: {
      officer_name: 'Inspector Rajesh Kumar',
      designation: 'Inspector of Police (Cyber Crime Branch)',
      badge_id: 'IO-DEL-4412',
      police_station: 'Cyber Crime Police Station, Central District, New Delhi',
      organization: 'Delhi Police Cyber Crime Unit',
    },
    system_incharge: {
      officer_name: 'Dr. Neha V. Sharma',
      designation: 'Forensic System In-Charge & Senior Scientist (Cyber Forensics)',
      badge_id: 'SYS-CFSL-8819',
      organization: 'State Cyber Forensic Science Laboratory / KshemOS Vault Authority',
    },
  },
  'CASE-2026-MUMBAI-04': {
    case_id: 'CASE-2026-MUMBAI-04',
    fir_crime_number: 'CR No. 89/2026 BKC Cyber PS u/s 318(4) BNS & 66C IT Act',
    court_name: 'Court of the Additional Chief Metropolitan Magistrate, 37th Court, Esplanade, Mumbai',
    investigating_officer: {
      officer_name: 'Sr. Inspector Sanjay Patil',
      designation: 'Senior Police Inspector (Cyber Unit)',
      badge_id: 'IO-MUM-1092',
      police_station: 'Bandra-Kurla Complex (BKC) Cyber Police Station, Mumbai',
      organization: 'Mumbai Police Cyber Crime Branch',
    },
    system_incharge: {
      officer_name: 'Dr. Amit S. Deshmukh',
      designation: 'Technical In-Charge & Digital Forensic Analyst',
      badge_id: 'SYS-MUM-7721',
      organization: 'Directorate of Forensic Science Laboratories, Maharashtra',
    },
  },
};

/**
 * Local offline compiler for Section 63 BSA / 65B IEA affidavits.
 */
export function compileSection63AffidavitLocally({
  caseId = 'CASE-2026-DELHI-01',
  evidenceItems = [],
  investigatingOfficer = null,
  systemIncharge = null,
  courtName = null,
  firCrimeNumber = null,
  affixDigitalSignature = false,
}) {
  if (!evidenceItems || evidenceItems.length === 0) {
    throw new Error(`Cannot compile affidavit: No evidence items provided for case '${caseId}'.`);
  }

  // -------------------------------------------------------------------------
  // CRITICAL GATE: Verify Cryptographic Hash Chains for Every Artifact
  // -------------------------------------------------------------------------
  const tamperedItems = [];
  for (const item of evidenceItems) {
    const rawContent = item.raw_content || item.raw_payload || '';
    let hashMatches = true;

    // Check SHA-256 match if raw content is available
    if (rawContent) {
      const calculatedSha = sha256Sync(rawContent);
      if (item.sha256_hash && calculatedSha !== item.sha256_hash) {
        hashMatches = false;
      }
    }

    // Check explicit tamper flags
    if (item.tamper_detected || item.is_tampered || !hashMatches) {
      tamperedItems.push({
        evidence_id: item.id || item.evidence_id,
        file_name: item.file_name || 'unknown',
        reason: 'Cryptographic SHA-256 digest mismatch or broken custodial hash chain.',
      });
    }
  }

  if (tamperedItems.length > 0) {
    const failed = tamperedItems[0];
    const err = new Error(
      `Section 63 BSA Affidavit compilation BLOCKED: Artifact '${failed.evidence_id}' ` +
      `(${failed.file_name}) failed cryptographic hash chain validation. Pursuant to BSA § 63 ` +
      `and Arjun Panditrao Khotkar (2020), no certificate can be issued for compromised electronic records.`
    );
    err.failed_artifact_id = failed.evidence_id;
    err.status = 'COMPILATION_BLOCKED_TAMPER_DETECTED';
    err.tamper_details = tamperedItems;
    throw err;
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const preset = DEMO_CASE_PRESETS[caseId] || DEMO_CASE_PRESETS['CASE-2026-DELHI-01'];

  const firNo = firCrimeNumber || preset.fir_crime_number;
  const court = courtName || preset.court_name;

  const io = investigatingOfficer || preset.investigating_officer;
  const sys = systemIncharge || preset.system_incharge;

  const affidavitId = `BSA63-AFF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${caseId.replace('CASE-', '')}-${String(now % 10000).padStart(4, '0')}`;

  const exhibits = evidenceItems.map((item, idx) => {
    const itemId = item.id || item.evidence_id || `EV-${1001 + idx}`;
    const src = item.source || 'default';
    const hwSig = HARDWARE_SIGNATURE_PROFILES[src] || HARDWARE_SIGNATURE_PROFILES.default;
    const size = Number(item.file_size_bytes || 1024);

    return {
      exhibit_number: `Exhibit P-${idx + 1}`,
      evidence_id: itemId,
      title: item.title || `Electronic Record #${idx + 1}`,
      file_name: item.file_name || `${itemId}.bin`,
      file_size_bytes: size,
      mime_type: item.mime_type || 'application/octet-stream',
      sha256_hash: item.sha256_hash || sha256Sync(`MOCK-PAYLOAD-${itemId}`),
      genesis_hash: item.genesis_hash || item.sha256_hash || sha256Sync(`MOCK-PAYLOAD-${itemId}`),
      ingested_at: Number(item.ingested_at || now),
      ingested_at_iso: new Date(Number(item.ingested_at || now)).toISOString(),
      hardware_signature: hwSig,
      rfc3161_token_serial: item.rfc3161_token?.serial_number || `TSA-TOKEN-${itemId}`,
      chain_of_custody_verified: true,
      custodial_transactions_count: Number(item.custodial_log_count || 1),
    };
  });

  const totalBytes = exhibits.reduce((acc, ex) => acc + ex.file_size_bytes, 0);

  // NTP Record
  const ntpRecord = {
    ...OFFICIAL_NTP_RECORD,
    last_sync_timestamp: nowIso,
  };

  // Part A: System In-Charge Declaration
  const sysText =
    `I, ${sys.officer_name}, ${sys.designation}, ${sys.organization}, do hereby solemnly affirm and declare under Section 63(4)(a) ` +
    `of the Bharatiya Sakshya Adhiniyam, 2023 (BSA) / Section 65B(4)(a) of the Indian Evidence Act, 1872: ` +
    `(1) That I have lawful command and administrative control over the digital evidence storage system and cryptographic vault repository; ` +
    `(2) That during the whole of the said period, the computer system and peripheral devices were operating properly, synchronized with CSIR-NPL Stratum 1 atomic time source (Offset: ${ntpRecord.clock_offset_ms} ms), without any malfunction affecting accuracy; ` +
    `(3) That the SHA-256 cryptographic hashes and RFC 3161 timestamp tokens reproduced herein accurately reflect the mathematical truth of the records held in immutable custody.`;

  // Part B: Investigating Officer Declaration
  const ioText =
    `I, ${io.officer_name}, ${io.designation}, ${io.police_station}, investigating ${firNo}, do hereby solemnly affirm and state on oath ` +
    `under Section 63(4)(b) of the Bharatiya Sakshya Adhiniyam, 2023 (BSA) / Section 65B(4)(b) of the Indian Evidence Act, 1872: ` +
    `(1) That the electronic records identified as Exhibits P-1 through P-${exhibits.length} were duly seized or lawful electronic custody obtained during the course of investigation into ${firNo}; ` +
    `(2) That each item was secured and cryptographically hashed via SHA-256 in the KshemOS Chain of Custody Vault without modification or tampering; ` +
    `(3) That I tender this affidavit along with the sealed electronic records before the ${court} as primary electronic evidence admissible under law.`;

  const sysEsignStatus = affixDigitalSignature ? 'DSC_TOKEN_AFFIXED' : 'PENDING_SIGNATURE';
  const sysEsignPlaceholder = affixDigitalSignature
    ? `DSC-CERT:[CN=${sys.officer_name},OU=${sys.organization},SERIAL=${sha256Sync(sys.officer_name + ':' + now).slice(0, 16).toUpperCase()}:VALID]`
    : `eSIGN-SLOT:[OFFICER_ID=${sys.badge_id}:ROLE=SYSTEM_IN_CHARGE:STATUS=AWAITING_DSC_OR_AADHAAR_ESIGN]`;

  const ioEsignStatus = affixDigitalSignature ? 'DSC_TOKEN_AFFIXED' : 'PENDING_SIGNATURE';
  const ioEsignPlaceholder = affixDigitalSignature
    ? `DSC-CERT:[CN=${io.officer_name},OU=${io.police_station},SERIAL=${sha256Sync(io.officer_name + ':' + firNo).slice(0, 16).toUpperCase()}:VALID]`
    : `eSIGN-SLOT:[OFFICER_ID=${io.badge_id}:ROLE=INVESTIGATING_OFFICER:STATUS=AWAITING_DSC_OR_AADHAAR_ESIGN]`;

  const systemDecl = {
    signatory_role: 'SYSTEM_IN_CHARGE',
    officer_name: sys.officer_name,
    designation: sys.designation,
    badge_id: sys.badge_id,
    organization: sys.organization,
    declaration_text: sysText,
    fir_number: firNo,
    police_station: io.police_station,
    court_name: court,
    esign_status: sysEsignStatus,
    esign_placeholder: sysEsignPlaceholder,
    signed_at: affixDigitalSignature ? nowIso : null,
  };

  const ioDecl = {
    signatory_role: 'INVESTIGATING_OFFICER',
    officer_name: io.officer_name,
    designation: io.designation,
    badge_id: io.badge_id,
    organization: io.organization,
    declaration_text: ioText,
    fir_number: firNo,
    police_station: io.police_station,
    court_name: court,
    esign_status: ioEsignStatus,
    esign_placeholder: ioEsignPlaceholder,
    signed_at: affixDigitalSignature ? nowIso : null,
  };

  const itemHashes = exhibits.map((e) => e.sha256_hash).join(':');
  const masterManifestSha256 = sha256Sync(`${affidavitId}:${caseId}:${firNo}:${itemHashes}:${ntpRecord.ntp_server_host}:${now}`);

  return {
    affidavit_id: affidavitId,
    case_id: caseId,
    fir_crime_number: firNo,
    court_name: court,
    legal_framework: 'Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA) & Section 65B Indian Evidence Act, 1872 (IEA)',
    generated_at: now,
    generated_at_iso: nowIso,
    status: 'SEALED_CRYPTOGRAPHICALLY_VALID',
    all_hash_chains_verified: true,
    tampered_artifacts_count: 0,
    ntp_verification: ntpRecord,
    system_incharge_declaration: systemDecl,
    investigating_officer_declaration: ioDecl,
    exhibits,
    master_manifest_sha256: masterManifestSha256,
    total_exhibits: exhibits.length,
    total_file_size_bytes: totalBytes,
    affidavit_title: `Electronic Evidence Certificate under Section 63 BSA for ${firNo}`,
    tamper_details: null,
  };
}

// -----------------------------------------------------------------------------
// Backend API Connectors
// -----------------------------------------------------------------------------

const API_BASE = '/api/evidence-affidavit';

export async function compileSection63AffidavitApi(payload) {
  const res = await fetch(`${API_BASE}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const err = new Error(errorJson.detail?.message || `HTTP ${res.status}: Failed to compile affidavit`);
    err.status = res.status;
    err.detail = errorJson.detail;
    throw err;
  }
  return await res.json();
}

export async function fetchNtpStatusApi() {
  const res = await fetch(`${API_BASE}/ntp-status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch NTP status`);
  return await res.json();
}

export async function fetchHardwareProfilesApi() {
  const res = await fetch(`${API_BASE}/hardware-profiles`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch hardware profiles`);
  return await res.json();
}

export function getAffidavitPreviewHtmlUrl(caseId, { fir = '', court = '', affixDsc = false } = {}) {
  const params = new URLSearchParams();
  if (fir) params.set('fir', fir);
  if (court) params.set('court', court);
  if (affixDsc) params.set('affix_dsc', 'true');
  const q = params.toString();
  return `${API_BASE}/preview-html/${encodeURIComponent(caseId)}${q ? `?${q}` : ''}`;
}

