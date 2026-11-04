import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OfficerCopilotStore,
  APPROVED_OPERATING_PROCEDURES,
} from './officerCopilotStore.js';

describe('OfficerCopilotStore & Evidence-Grounded Recommendations', () => {
  let store;

  beforeEach(() => {
    store = new OfficerCopilotStore();
    store.reset();
  });

  it('provides approved standard operating procedures with statutory citations', () => {
    assert.ok(APPROVED_OPERATING_PROCEDURES.length >= 4);
    const freezeSop = APPROVED_OPERATING_PROCEDURES.find((s) => s.sop_id === 'SOP-1930-FREEZE');
    assert.ok(freezeSop);
    assert.equal(freezeSop.is_consequential, true);
    assert.equal(freezeSop.requires_human_approval, true);
    assert.ok(freezeSop.statutory_authority.includes('Section 91 CrPC'));
  });

  it('enforces 4-tier separation in generated analysis', () => {
    const analysis = store.generateGroundedAnalysis('INC-001', 'ACC-1002');

    assert.equal(analysis.has_sufficient_evidence, true);
    assert.equal(analysis.priority, 'critical');

    // Tier 1: Confirmed Facts
    assert.ok(analysis.confirmed_facts.length >= 2);
    analysis.confirmed_facts.forEach((fact) => {
      assert.ok(fact.fact_id);
      assert.ok(fact.fact_type);
      assert.ok(fact.statement);
      assert.ok(fact.source_citation);
      assert.equal(fact.is_verified, true);
    });

    // Tier 2: Unverified Claims
    assert.ok(analysis.unverified_claims.length >= 1);
    analysis.unverified_claims.forEach((claim) => {
      assert.ok(claim.claim_id);
      assert.ok(claim.claim_type);
      assert.ok(claim.statement);
      assert.ok(claim.reporting_party);
      assert.equal(claim.verification_status, 'pending_corroboration');
      assert.ok(claim.corroboration_needed);
    });

    // Tier 3: System Signals
    assert.ok(analysis.system_signals.length >= 1);
    analysis.system_signals.forEach((sig) => {
      assert.ok(sig.signal_id);
      assert.ok(sig.signal_name);
      assert.ok(sig.value);
      assert.ok(sig.confidence > 0);
      assert.ok(sig.detector_model);
      assert.ok(sig.interpretation);
    });

    // Tier 4: Model Suggestions with Source References
    assert.ok(analysis.recommendations.length >= 2);
    analysis.recommendations.forEach((rec) => {
      assert.ok(rec.rec_id);
      assert.ok(rec.action_title);
      assert.ok(rec.rationale);
      assert.ok(rec.source_references.length >= 1);
      rec.source_references.forEach((ref) => {
        assert.ok(ref.ref_id);
        assert.ok(ref.source_type);
        assert.ok(ref.citation_title);
        assert.ok(ref.field_or_clause);
        assert.ok(ref.exact_pointer);
      });
    });
  });

  it('handles insufficient evidence with inconclusive priority and intake recommendations', () => {
    const analysis = store.generateGroundedAnalysis('UNKNOWN-TARGET-999');

    assert.equal(analysis.has_sufficient_evidence, false);
    assert.equal(analysis.priority, 'inconclusive');
    assert.ok(analysis.missing_records_summary.includes('Insufficient records located'));
    assert.equal(analysis.confirmed_facts.length, 0);

    // Consequential actions must NOT be generated for missing records
    const consequential = analysis.recommendations.filter((r) => r.is_consequential);
    assert.equal(consequential.length, 0);

    // Preliminary intake discovery should be suggested
    assert.equal(analysis.recommendations.length, 1);
    assert.ok(analysis.recommendations[0].action_title.includes('Verification Intake'));
    assert.equal(analysis.recommendations[0].is_consequential, false);
    assert.equal(analysis.recommendations[0].requires_human_approval, false);
  });

  it('flags consequential recommendations as requiring human approval', () => {
    const analysis = store.generateGroundedAnalysis('RPT-0001', 'ACC-1002');
    const consequential = analysis.recommendations.filter((r) => r.is_consequential);

    assert.ok(consequential.length >= 1);
    const freezeRec = consequential.find((r) => r.action_title.includes('Section 91 CrPC Debit Freeze'));
    assert.ok(freezeRec);
    assert.equal(freezeRec.requires_human_approval, true);
    assert.equal(freezeRec.approval_status, 'pending_approval');
    assert.equal(freezeRec.approved_by, null);
    assert.equal(freezeRec.approved_at, null);
  });

  it('processes human approval workflow for consequential recommendations', () => {
    const analysis = store.generateGroundedAnalysis('RPT-0001', 'ACC-1002');
    const freezeRec = analysis.recommendations.find((r) => r.is_consequential);

    // 1. Approve
    const approved = store.submitApproval(
      freezeRec.rec_id,
      'approved',
      'INSP-MALHOTRA-501',
      'Direct witness corroboration obtained'
    );
    assert.equal(approved.approval_status, 'approved');
    assert.equal(approved.approved_by, 'INSP-MALHOTRA-501');
    assert.ok(approved.approved_at > 0);
    assert.equal(approved.feedback_notes, 'Direct witness corroboration obtained');

    // 2. Non-consequential action should disallow approval
    const nonConsequential = analysis.recommendations.find((r) => !r.is_consequential);
    assert.throws(
      () => store.submitApproval(nonConsequential.rec_id, 'approved', 'INSP-MALHOTRA-501'),
      /does not require human approval/
    );
  });

  it('allows officers to flag recommendations as helpful, incorrect, or unsupported', () => {
    const analysis = store.generateGroundedAnalysis('RPT-0001', 'ACC-1002');
    const rec = analysis.recommendations[0];

    // Helpful
    const res1 = store.submitFeedback(
      rec.rec_id,
      'helpful',
      'Procedure fits SOP-1930 perfectly',
      'SI-RAO-202'
    );
    assert.equal(res1.officer_feedback, 'helpful');
    assert.equal(res1.feedback_notes, 'Procedure fits SOP-1930 perfectly');
    assert.equal(res1.feedback_submitted_by, 'SI-RAO-202');

    // Unsupported
    const res2 = store.submitFeedback(
      rec.rec_id,
      'unsupported',
      'Telecom provider indicates number is disconnected',
      'SI-RAO-202'
    );
    assert.equal(res2.officer_feedback, 'unsupported');

    // Incorrect
    const res3 = store.submitFeedback(
      rec.rec_id,
      'incorrect',
      'Wrong bank jurisdiction code',
      'SI-RAO-202'
    );
    assert.equal(res3.officer_feedback, 'incorrect');
  });
});
