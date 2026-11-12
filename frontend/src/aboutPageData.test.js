import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_MISSION,
  INTENDED_USERS,
  CORE_CAPABILITIES,
  PROTOTYPE_LIMITATIONS,
  PROJECT_LINKS
} from './aboutPageData.js';

test('PROJECT_MISSION provides headline, origin story, and purpose', () => {
  assert.ok(PROJECT_MISSION.headline && PROJECT_MISSION.headline.length > 0);
  assert.ok(PROJECT_MISSION.originStory && PROJECT_MISSION.originStory.length > 0);
  assert.ok(PROJECT_MISSION.corePurpose && PROJECT_MISSION.corePurpose.length > 0);
});

test('INTENDED_USERS covers citizens, seniors, officers, and advocates', () => {
  assert.equal(INTENDED_USERS.length, 4);
  const userIds = INTENDED_USERS.map((u) => u.id);
  assert.ok(userIds.includes('citizens'));
  assert.ok(userIds.includes('seniors'));
  assert.ok(userIds.includes('officers'));
  assert.ok(userIds.includes('advocates'));

  for (const user of INTENDED_USERS) {
    assert.ok(user.role);
    assert.ok(user.summary);
    assert.ok(Array.isArray(user.keyBenefits) && user.keyBenefits.length > 0);
  }
});

test('CORE_CAPABILITIES lists verified implemented features with target views', () => {
  assert.ok(CORE_CAPABILITIES.length >= 6);

  for (const cap of CORE_CAPABILITIES) {
    assert.ok(cap.id);
    assert.ok(cap.title);
    assert.ok(cap.category);
    assert.ok(cap.description);
    assert.ok(cap.implementedStatus);
    assert.ok(cap.targetView);
  }
});

test('PROTOTYPE_LIMITATIONS grounds project claims realistically', () => {
  assert.ok(PROTOTYPE_LIMITATIONS.length >= 4);

  const limitIds = PROTOTYPE_LIMITATIONS.map((l) => l.id);
  assert.ok(limitIds.includes('decision-support'));
  assert.ok(limitIds.includes('inconclusive-safety'));
  assert.ok(limitIds.includes('privacy-non-custodial'));

  for (const limit of PROTOTYPE_LIMITATIONS) {
    assert.ok(limit.title);
    assert.ok(limit.detail);
  }
});

test('PROJECT_LINKS contains source repository and contributing links', () => {
  assert.ok(PROJECT_LINKS.sourceRepo.startsWith('https://github.com/'));
  assert.ok(PROJECT_LINKS.issues.startsWith('https://github.com/'));
  assert.ok(PROJECT_LINKS.contributing.includes('CONTRIBUTING'));
});

