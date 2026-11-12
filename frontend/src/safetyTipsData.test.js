import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMERGENCY_ACTIONS,
  SAFETY_CATEGORIES,
  TRUSTED_REPORTING_DIRECTORY,
  MAJOR_BANKS_HOTLINES
} from './safetyTipsData.js';

test('EMERGENCY_ACTIONS provides structured critical steps for stressed visitors', () => {
  assert.ok(EMERGENCY_ACTIONS.length >= 5, 'Should have at least 5 immediate emergency steps');

  const requiredIds = ['disconnect-now', 'never-enter-pin', 'block-and-freeze', 'call-1930', 'preserve-evidence'];
  for (const id of requiredIds) {
    const found = EMERGENCY_ACTIONS.find((a) => a.id === id);
    assert.ok(found, `Missing required emergency action ${id}`);
    assert.ok(found.stepNumber, `Missing stepNumber in ${id}`);
    assert.ok(found.actionVerb, `Missing actionVerb in ${id}`);
    assert.ok(found.description, `Missing description in ${id}`);
    assert.ok(found.timeframe, `Missing timeframe in ${id}`);
  }
});

test('SAFETY_CATEGORIES organises guidance into calls, messages, payments, accounts, and reporting', () => {
  const expectedCategories = ['calls', 'messages', 'payments', 'accounts', 'reporting'];

  for (const catKey of expectedCategories) {
    const cat = SAFETY_CATEGORIES[catKey];
    assert.ok(cat, `Missing category ${catKey}`);
    assert.ok(cat.name, `Missing name in category ${catKey}`);
    assert.ok(cat.summary, `Missing summary in category ${catKey}`);

    // Verify immediate actions are highlighted separately from prevention tips
    assert.ok(Array.isArray(cat.immediateActions) && cat.immediateActions.length > 0, `Missing immediateActions in ${catKey}`);
    assert.ok(Array.isArray(cat.preventionTips) && cat.preventionTips.length > 0, `Missing preventionTips in ${catKey}`);

    for (const action of cat.immediateActions) {
      assert.ok(action.rule, `Missing rule in immediateAction of ${catKey}`);
      assert.ok(action.why, `Missing explanation why in immediateAction of ${catKey}`);
    }
  }
});

test('TRUSTED_REPORTING_DIRECTORY includes primary hotlines and official portals', () => {
  assert.ok(TRUSTED_REPORTING_DIRECTORY.length >= 4, 'Should include multiple trusted reporting channels');

  const helpline1930 = TRUSTED_REPORTING_DIRECTORY.find((d) => d.id === 'helpline-1930');
  assert.ok(helpline1930, 'Must include Helpline 1930');
  assert.equal(helpline1930.contact, '1930');
  assert.ok(helpline1930.actionHref.includes('1930'));

  const portal = TRUSTED_REPORTING_DIRECTORY.find((d) => d.id === 'portal-cybercrime');
  assert.ok(portal, 'Must include cybercrime.gov.in portal');
  assert.ok(portal.actionHref.includes('cybercrime.gov.in'));

  const telecom = TRUSTED_REPORTING_DIRECTORY.find((d) => d.id === 'chakshu-sancharsaathi');
  assert.ok(telecom, 'Must include Chakshu / Sanchar Saathi');
});

test('MAJOR_BANKS_HOTLINES provides emergency numbers for immediate freezing', () => {
  assert.ok(MAJOR_BANKS_HOTLINES.length >= 5, 'Should include top Indian banks');
  for (const item of MAJOR_BANKS_HOTLINES) {
    assert.ok(item.bank, 'Bank name is required');
    assert.ok(item.phone, 'Emergency phone is required');
  }
});

