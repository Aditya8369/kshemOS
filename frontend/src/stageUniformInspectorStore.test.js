import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUTORY_BNSS_NOTICE,
  OFFICIAL_UNIFORM_REGULATIONS,
  DEMO_STAGE_PRESETS,
  inspectVideoCallStageLocally,
  listLocalStageInspections,
} from './stageUniformInspectorStore.js';

test('OFFICIAL_UNIFORM_REGULATIONS contains mandatory Indian police and agency rules', () => {
  assert.ok(OFFICIAL_UNIFORM_REGULATIONS.length >= 6);
  const agencyIds = OFFICIAL_UNIFORM_REGULATIONS.map((r) => r.agency_id);
  assert.ok(agencyIds.includes('CBI'));
  assert.ok(agencyIds.includes('DELHI_POLICE'));
  assert.ok(agencyIds.includes('MUMBAI_POLICE'));
  assert.ok(agencyIds.includes('CUSTOMS'));
  assert.ok(agencyIds.includes('SUPREME_COURT'));
  assert.ok(agencyIds.includes('ED'));

  const cbi = OFFICIAL_UNIFORM_REGULATIONS.find((r) => r.agency_id === 'CBI');
  assert.ok(cbi.authorized_attire.includes('Civilian business formal'));
  assert.ok(cbi.authorized_attire.includes('NEVER wear police khaki tunics'));
});

test('DEMO_STAGE_PRESETS provides realistic video call test cases', () => {
  assert.ok(DEMO_STAGE_PRESETS.length >= 3);
  const cbiPreset = DEMO_STAGE_PRESETS.find((p) => p.claimed_agency === 'CBI');
  assert.ok(cbiPreset);
  assert.ok(cbiPreset.preview_url.startsWith('data:image/svg+xml'));
  assert.ok(cbiPreset.file_name.endsWith('.png'));
});

test('inspectVideoCallStageLocally detects synthetic stage hallmarks on fake CBI call', () => {
  const result = inspectVideoCallStageLocally({
    image_data: 'RAW_IMAGE_PAYLOAD_CBI_FAKE_CALL',
    file_name: 'cbi_interrogation.png',
    claimed_agency: 'CBI',
    claimed_officer_name: 'Inspector Sharma',
    save_to_evidence_vault: true,
  });

  assert.ok(result.inspection_id.startsWith('STAGE-INSP-'));
  assert.equal(result.is_synthetic_stage, true);
  assert.ok(result.stage_forgery_score >= 0.70);
  assert.equal(result.risk_verdict, 'CRITICAL_FORGERY_DETECTED');
  assert.equal(result.image_sha256.length, 64);

  // Check visual hallmarks
  const hallmarkTypes = result.detected_hallmarks.map((h) => h.hallmark_type);
  assert.ok(hallmarkTypes.includes('virtual_chroma_fringe'));
  assert.ok(hallmarkTypes.includes('perspective_warp'));
  assert.ok(hallmarkTypes.includes('synthetic_blur_bleeding'));
  assert.ok(hallmarkTypes.includes('non_standard_stars'));
  assert.ok(hallmarkTypes.includes('improper_agency_uniform'));

  // Uniform evaluation
  assert.equal(result.uniform_evaluation.uniform_matches_agency, false);
  assert.equal(result.uniform_evaluation.insignia_validity, 'forged');
  assert.ok(result.uniform_evaluation.discrepancies.length >= 3);

  // Exact statutory BNSS notice
  assert.equal(result.statutory_bnss_notice, STATUTORY_BNSS_NOTICE);
  assert.ok(result.statutory_bnss_notice.includes('Bharatiya Nagarik Suraksha Sanhita (BNSS)'));
  assert.ok(result.statutory_bnss_notice.includes('no court, police officer, or CBI official is authorized to place anyone under arrest'));

  // Evidence Vault auto-preservation
  assert.ok(result.vaulted_evidence_id);
  assert.ok(result.vaulted_evidence_id.startsWith('EVID-'));
});

test('inspectVideoCallStageLocally skips Evidence Vault when save_to_evidence_vault is false', () => {
  const result = inspectVideoCallStageLocally({
    image_data: 'RAW_IMAGE_PAYLOAD_MUMBAI_DCP',
    file_name: 'mumbai_dcp.png',
    claimed_agency: 'Mumbai Police',
    save_to_evidence_vault: false,
  });

  assert.equal(result.vaulted_evidence_id, null);
  assert.equal(result.is_synthetic_stage, true);
});

test('listLocalStageInspections retrieves past analysis records', () => {
  inspectVideoCallStageLocally({
    image_data: 'TEST_IMG_01',
    file_name: 'test1.png',
    claimed_agency: 'Delhi Police',
    save_to_evidence_vault: false,
  });

  const list = listLocalStageInspections();
  assert.ok(list.length >= 1);
  assert.ok(list[0].inspection_id.startsWith('STAGE-INSP-'));
});

