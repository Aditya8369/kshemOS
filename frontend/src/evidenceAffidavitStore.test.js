import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileSection63AffidavitLocally,
  OFFICIAL_NTP_RECORD,
  HARDWARE_SIGNATURE_PROFILES,
  DEMO_CASE_PRESETS,
  sha256Sync,
} from './evidenceAffidavitStore.js';

describe('Section 63 BSA / 65B IEA Electronic Evidence Affidavit Compiler Store', () => {
  const sampleEvidence = [
    {
      id: 'EV-1001',
      title: 'WhatsApp Extortion Call Audio Intercept',
      file_name: 'extortion_call_01.wav',
      file_size_bytes: 4210500,
      mime_type: 'audio/wav',
      source: 'audio_intercept',
      sha256_hash: sha256Sync('AUDIO-INTERCEPT-RAW-CONTENT'),
      raw_content: 'AUDIO-INTERCEPT-RAW-CONTENT',
      ingested_at: 1714000000000,
      rfc3161_token: { serial_number: 'TSA-NPL-998811' },
      custodial_log_count: 3,
    },
    {
      id: 'EV-1002',
      title: 'Suspect OnePlus Mobile Seizure Clone',
      file_name: 'suspect_phone_tar.gz',
      file_size_bytes: 28400000,
      mime_type: 'application/gzip',
      source: 'mobile_seizure',
      sha256_hash: sha256Sync('MOBILE-PHONE-RAW-TAR-CONTENT'),
      raw_content: 'MOBILE-PHONE-RAW-TAR-CONTENT',
      ingested_at: 1714010000000,
      rfc3161_token: { serial_number: 'TSA-NPL-998812' },
      custodial_log_count: 2,
    },
  ];

  it('compiles standardized Section 63 BSA certificate with SHA-256 hashes, file sizes, creation timestamps, and capture hardware signatures', () => {
    const res = compileSection63AffidavitLocally({
      caseId: 'CASE-2026-DELHI-01',
      evidenceItems: sampleEvidence,
    });

    assert.equal(res.status, 'SEALED_CRYPTOGRAPHICALLY_VALID');
    assert.equal(res.all_hash_chains_verified, true);
    assert.equal(res.total_exhibits, 2);
    assert.ok(res.master_manifest_sha256.length === 64);
    assert.match(res.legal_framework, /Section 63 Bharatiya Sakshya Adhiniyam/);
    assert.match(res.legal_framework, /Section 65B Indian Evidence Act/);

    // Exhibits checks
    const ex1 = res.exhibits[0];
    assert.equal(ex1.exhibit_number, 'Exhibit P-1');
    assert.equal(ex1.evidence_id, 'EV-1001');
    assert.equal(ex1.file_size_bytes, 4210500);
    assert.ok(ex1.sha256_hash.length === 64);
    assert.ok(ex1.ingested_at_iso.length > 10);

    // Hardware signature check
    assert.ok(ex1.hardware_signature);
    assert.match(ex1.hardware_signature.device_make_model, /Dell PowerEdge/);
    assert.equal(ex1.hardware_signature.hardware_id_type, 'SERVER_SERIAL / MAC');

    const ex2 = res.exhibits[1];
    assert.equal(ex2.exhibit_number, 'Exhibit P-2');
    assert.match(ex2.hardware_signature.device_make_model, /OnePlus 11 5G/);
    assert.match(ex2.hardware_signature.operating_system, /Android 14/);
  });

  it('includes server clock stratum NTP synchronization verification records', () => {
    const res = compileSection63AffidavitLocally({
      caseId: 'CASE-2026-DELHI-01',
      evidenceItems: sampleEvidence,
    });

    const ntp = res.ntp_verification;
    assert.equal(ntp.ntp_server_host, 'time.nplindia.org');
    assert.equal(ntp.stratum_level, 1);
    assert.equal(ntp.is_synchronized, true);
    assert.ok(ntp.clock_offset_ms < 5.0);
    assert.equal(ntp.reference_clock_id, 'NPLI-GPS');
    assert.match(ntp.statutory_compliance, /Section 63\(2\)\(a\) BSA/);
  });

  it('provides fill-in legal declarations for IO and System In-Charge with digital signature / eSign slots', () => {
    const res = compileSection63AffidavitLocally({
      caseId: 'CASE-2026-DELHI-01',
      evidenceItems: sampleEvidence,
      affixDigitalSignature: false,
    });

    const sysDecl = res.system_incharge_declaration;
    assert.equal(sysDecl.signatory_role, 'SYSTEM_IN_CHARGE');
    assert.match(sysDecl.declaration_text, /Section 63\(4\)\(a\)/);
    assert.equal(sysDecl.esign_status, 'PENDING_SIGNATURE');
    assert.match(sysDecl.esign_placeholder, /AWAITING_DSC_OR_AADHAAR_ESIGN/);
    assert.equal(sysDecl.signed_at, null);

    const ioDecl = res.investigating_officer_declaration;
    assert.equal(ioDecl.signatory_role, 'INVESTIGATING_OFFICER');
    assert.match(ioDecl.declaration_text, /Section 63\(4\)\(b\)/);
    assert.equal(ioDecl.esign_status, 'PENDING_SIGNATURE');
    assert.match(ioDecl.esign_placeholder, /ROLE=INVESTIGATING_OFFICER/);
  });

  it('affixes digital signature tokens when affixDigitalSignature is enabled', () => {
    const res = compileSection63AffidavitLocally({
      caseId: 'CASE-2026-DELHI-01',
      evidenceItems: sampleEvidence,
      affixDigitalSignature: true,
    });

    assert.equal(res.system_incharge_declaration.esign_status, 'DSC_TOKEN_AFFIXED');
    assert.match(res.system_incharge_declaration.esign_placeholder, /DSC-CERT:/);
    assert.ok(res.system_incharge_declaration.signed_at);

    assert.equal(res.investigating_officer_declaration.esign_status, 'DSC_TOKEN_AFFIXED');
    assert.match(res.investigating_officer_declaration.esign_placeholder, /DSC-CERT:/);
    assert.ok(res.investigating_officer_declaration.signed_at);
  });

  it('prevents generation if any artifact in the bundle fails cryptographic hash chain validation', () => {
    const corruptedEvidence = [
      {
        id: 'EV-1001',
        title: 'Authentic Audio',
        file_name: 'clean.wav',
        sha256_hash: sha256Sync('CLEAN'),
        raw_content: 'CLEAN',
      },
      {
        id: 'EV-1002',
        title: 'Tampered Audio Intercept',
        file_name: 'tampered.wav',
        sha256_hash: sha256Sync('ORIGINAL-CONTENT'),
        raw_content: 'CORRUPTED-ALTERED-CONTENT', // mismatch with sha256_hash!
      },
    ];

    assert.throws(
      () => {
        compileSection63AffidavitLocally({
          caseId: 'CASE-2026-DELHI-01',
          evidenceItems: corruptedEvidence,
        });
      },
      (err) => {
        assert.equal(err.status, 'COMPILATION_BLOCKED_TAMPER_DETECTED');
        assert.equal(err.failed_artifact_id, 'EV-1002');
        assert.match(err.message, /compilation BLOCKED/);
        assert.match(err.message, /Arjun Panditrao Khotkar/);
        return true;
      }
    );
  });
});

