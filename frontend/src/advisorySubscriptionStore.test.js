import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AdvisorySubscriptionStore,
  AVAILABLE_ZONES,
  AVAILABLE_TOPICS,
  DEFAULT_SEED_SUBSCRIBERS,
} from './advisorySubscriptionStore.js';

describe('AdvisorySubscriptionStore & Public Advisory Subscriptions (Issue #43)', () => {
  it('provides available zones and threat topics for preference selection', () => {
    assert.ok(AVAILABLE_ZONES.length >= 6);
    assert.ok(AVAILABLE_TOPICS.length >= 6);
    assert.ok(AVAILABLE_ZONES.some((z) => z.id === 'Central Zone'));
    assert.ok(AVAILABLE_TOPICS.some((t) => t.id === 'digital_arrest'));
  });

  it('rejects subscription requests without explicit consent', () => {
    const store = new AdvisorySubscriptionStore();
    assert.throws(
      () => {
        store.subscribeLocal({
          email: 'citizen@example.com',
          areas: ['Central Zone'],
          topics: ['digital_arrest'],
          consent_given: false,
        });
      },
      {
        message: /Explicit consent is required/,
      }
    );
  });

  it('registers subscriber with unique token and verified consent', () => {
    const store = new AdvisorySubscriptionStore();
    const sub = store.subscribeLocal({
      email: 'verified.citizen@example.com',
      areas: ['Central Zone', 'South Zone'],
      topics: ['digital_arrest', 'counterfeit_currency'],
      channels: ['email', 'in_app'],
      consent_given: true,
    });

    assert.ok(sub.id.startsWith('SUB-'));
    assert.equal(sub.email, 'verified.citizen@example.com');
    assert.equal(sub.is_active, true);
    assert.equal(sub.consent_given, true);
    assert.ok(sub.management_token.startsWith('tok-'));
    assert.deepEqual(sub.areas, ['Central Zone', 'South Zone']);
    assert.deepEqual(sub.topics, ['digital_arrest', 'counterfeit_currency']);
  });

  it('allows subscribers to withdraw consent (unsubscribe)', () => {
    const store = new AdvisorySubscriptionStore();
    const sub = store.subscribeLocal({
      email: 'optout@example.com',
      areas: ['North Zone'],
      topics: ['mule_account'],
      consent_given: true,
    });

    const token = sub.management_token;
    assert.equal(store.getPreferencesLocal(token).is_active, true);

    const unsubscribed = store.unsubscribeLocal(token);
    assert.equal(unsubscribed.is_active, false);
    assert.ok(unsubscribed.unsubscribed_at);

    // Verify preference retrieval reflects inactive status
    const pref = store.getPreferencesLocal(token);
    assert.equal(pref.is_active, false);
  });

  it('allows updating location and topic preferences via private management token', () => {
    const store = new AdvisorySubscriptionStore();
    const sub = store.subscribeLocal({
      email: 'preferences.user@example.com',
      areas: ['East Zone'],
      topics: ['atm_skimming'],
      channels: ['email'],
      consent_given: true,
    });

    const token = sub.management_token;
    const updated = store.updatePreferencesLocal(token, {
      areas: ['East Zone', 'West Zone'],
      topics: ['atm_skimming', 'cyber_extortion'],
      channels: ['email', 'in_app'],
    });

    assert.deepEqual(updated.areas, ['East Zone', 'West Zone']);
    assert.deepEqual(updated.topics, ['atm_skimming', 'cyber_extortion']);
    assert.deepEqual(updated.channels, ['email', 'in_app']);
  });

  it('computes subscriber summary metrics without exposing citizen PII', () => {
    const store = new AdvisorySubscriptionStore();
    const summary = store.getSummaryLocal();

    assert.ok(summary.total_active_subscribers >= 3);
    assert.ok(summary.by_channel.email >= 2);
    assert.ok(summary.by_channel.in_app >= 2);
    assert.ok(summary.by_area['Central Zone'] >= 1);
  });
});

