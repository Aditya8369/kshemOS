import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALKTHROUGH_STEPS,
  SYSTEM_DISCLAIMERS,
  COMPARISON_TRACKS,
  filterWalkthroughSteps
} from './howItWorksData.js';

test('WALKTHROUGH_STEPS provides a complete, sequential 4-step walkthrough', () => {
  assert.equal(WALKTHROUGH_STEPS.length, 4, 'Expected exactly 4 sequential steps');

  // Verify step ordering
  WALKTHROUGH_STEPS.forEach((step, index) => {
    assert.equal(step.stepNumber, index + 1, `Step ${index} should have stepNumber ${index + 1}`);
    assert.ok(step.stepLabel, `Step ${index} missing stepLabel`);
    assert.ok(step.title, `Step ${index} missing title`);
    assert.ok(step.shortDescription, `Step ${index} missing shortDescription`);
    assert.ok(Array.isArray(step.keyPoints) && step.keyPoints.length > 0, `Step ${index} missing keyPoints`);
    assert.ok(['user_action', 'system_processing'].includes(step.actorType), `Invalid actorType in step ${index}`);
  });
});

test('distinguishes citizen actions from behind-the-scenes system processing', () => {
  const userSteps = filterWalkthroughSteps(WALKTHROUGH_STEPS, 'user_action');
  const systemSteps = filterWalkthroughSteps(WALKTHROUGH_STEPS, 'system_processing');

  assert.equal(userSteps.length, 2, 'Expected 2 citizen user action steps (Step 1 and Step 4)');
  assert.equal(systemSteps.length, 2, 'Expected 2 behind-the-scenes processing steps (Step 2 and Step 3)');

  assert.equal(userSteps[0].stepNumber, 1);
  assert.equal(systemSteps[0].stepNumber, 2);
  assert.equal(systemSteps[1].stepNumber, 3);
  assert.equal(userSteps[1].stepNumber, 4);

  // Check badges
  assert.ok(userSteps.every((s) => s.actorBadge === 'What You Do'));
  assert.ok(systemSteps.every((s) => s.actorBadge === 'Behind the Scenes'));
});

test('SYSTEM_DISCLAIMERS articulates non-guarantee limitations and inconclusive handling', () => {
  assert.ok(SYSTEM_DISCLAIMERS.title.includes('Not an Automated Legal Verdict'));
  assert.ok(SYSTEM_DISCLAIMERS.points.some((p) => p.toLowerCase().includes('inconclusive')));
  assert.ok(SYSTEM_DISCLAIMERS.points.some((p) => p.toLowerCase().includes('guarantee') || p.toLowerCase().includes('verdict')));
});

test('COMPARISON_TRACKS accurately maps citizen actions to system processing across pillars', () => {
  assert.equal(COMPARISON_TRACKS.length, 4, 'Expected 4 comparison pillars');

  for (const track of COMPARISON_TRACKS) {
    assert.ok(track.pillar, 'Pillar name required');
    assert.ok(track.userAction, 'User action description required');
    assert.ok(track.systemProcessing, 'System processing description required');
  }
});

