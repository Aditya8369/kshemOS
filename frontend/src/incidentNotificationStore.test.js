import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IncidentNotificationStore,
} from './incidentNotificationStore.js';

describe('IncidentNotificationStore & Role-Aware Notification Routing', () => {
  let store;

  beforeEach(() => {
    store = new IncidentNotificationStore();
  });

  it('notifies only authorised responders and supervisors for the relevant jurisdiction', () => {
    const incident = {
      id: 'INC-0101',
      category: 'scam_call',
      severity: 'medium',
      region: 'Central Zone', // JUR-DELHI-METRO
      assigned_to: 'OFF-DELHI-101',
      updated_at: Date.now(),
    };

    const outcomes = store.dispatchNotifications(incident, 'assignment');
    const recipientIds = outcomes.map((o) => o.recipient_id);

    // Delhi responder and Delhi supervisor must be notified
    assert.ok(recipientIds.includes('OFF-DELHI-101'));
    assert.ok(recipientIds.includes('OFF-SUP-DELHI'));

    // NCR officers must NOT be notified
    assert.ok(!recipientIds.includes('OFF-NCR-201'));
    assert.ok(!recipientIds.includes('OFF-SUP-NCR'));

    for (const o of outcomes) {
      assert.equal(o.delivery_status, 'delivered');
      assert.equal(o.jurisdiction_id, 'JUR-DELHI-METRO');
    }
  });

  it('blocks and records security boundary violations for unauthorized out-of-jurisdiction officers', () => {
    const incident = {
      id: 'INC-0102',
      category: 'counterfeit',
      severity: 'medium',
      region: 'Central Zone', // JUR-DELHI-METRO
      assigned_to: 'OFF-NCR-201', // JUR-NCR-SOUTH only
      updated_at: Date.now(),
    };

    const outcomes = store.dispatchNotifications(incident, 'assignment');
    const ncrOutcome = outcomes.find((o) => o.recipient_id === 'OFF-NCR-201');

    assert.ok(ncrOutcome);
    assert.equal(ncrOutcome.delivery_status, 'unauthorized_jurisdiction');
    assert.ok(ncrOutcome.error_message.includes('boundary violation'));
  });

  it('notifies both old and new responders plus supervisor on reassignment', () => {
    const incident = {
      id: 'INC-0103',
      category: 'fraud_tx',
      severity: 'high',
      region: 'Central Zone',
      assigned_to: 'OFF-DELHI-102', // Newly assigned
      updated_at: Date.now(),
    };

    const outcomes = store.dispatchNotifications(
      incident,
      'reassignment',
      'OFF-DELHI-101' // Previous responder
    );
    const recipientIds = outcomes.map((o) => o.recipient_id);

    assert.ok(recipientIds.includes('OFF-DELHI-102'));
    assert.ok(recipientIds.includes('OFF-DELHI-101'));
    assert.ok(recipientIds.includes('OFF-SUP-DELHI'));
  });

  it('routes escalation alerts to responders, supervisors, and commanders', () => {
    const incident = {
      id: 'INC-0104',
      category: 'digital_arrest',
      severity: 'critical',
      region: 'Central Zone',
      assigned_to: 'OFF-DELHI-101',
      updated_at: Date.now(),
    };

    const outcomes = store.dispatchNotifications(incident, 'escalation');
    const recipientIds = outcomes.map((o) => o.recipient_id);

    assert.ok(recipientIds.includes('OFF-DELHI-101')); // Responder
    assert.ok(recipientIds.includes('OFF-SUP-DELHI')); // Supervisor
    assert.ok(recipientIds.includes('OFF-CMD-METRO')); // Commander
  });

  it('sanitized email payload excludes sensitive evidence, transcripts, and citizen details', () => {
    const incident = {
      id: 'INC-0088',
      category: 'digital_arrest',
      severity: 'critical',
      region: 'Central Zone',
      reporter_name: 'Pooja Agarwal',
      reporter_phone: '+91 91234 56789',
      linked_account: 'MULE-8888',
      description: 'Extortionist pretending to be Mumbai Customs officer threatening narcotics arrest.',
      updated_at: Date.now(),
    };

    const recipient = store.getOfficer('OFF-DELHI-101');
    const { subject, bodySnippet, secureLink } = store.buildSanitizedContent(
      incident,
      'assignment',
      recipient,
      'TOKEN-XYZ'
    );

    // Minimal reference, priority, link included
    assert.ok(subject.includes('INC-0088'));
    assert.ok(subject.includes('CRITICAL'));
    assert.ok(subject.includes('Central Zone'));
    assert.ok(secureLink.includes('/dashboard/incidents/INC-0088'));
    assert.ok(secureLink.includes('TOKEN-XYZ'));

    // PII and raw evidence strictly excluded
    assert.ok(!bodySnippet.includes('Pooja Agarwal'));
    assert.ok(!bodySnippet.includes('+91 91234 56789'));
    assert.ok(!bodySnippet.includes('MULE-8888'));
    assert.ok(!bodySnippet.includes('Mumbai Customs'));
    assert.ok(!bodySnippet.includes('narcotics arrest'));
    assert.ok(bodySnippet.includes('Pursuant to SOP 24-B'));
  });

  it('suppresses non-critical notifications during configured quiet hours', () => {
    store.updateOfficerPreferences('OFF-DELHI-101', {
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    });

    const incident = {
      id: 'INC-0050',
      category: 'counterfeit',
      severity: 'medium', // Non-critical!
      region: 'Central Zone',
      assigned_to: 'OFF-DELHI-101',
      updated_at: Date.now(),
    };

    // 23:45 is inside quiet hours
    const outcomes = store.dispatchNotifications(
      incident,
      'assignment',
      null,
      null,
      Date.now(),
      '23:45'
    );

    const officerOutcome = outcomes.find((o) => o.recipient_id === 'OFF-DELHI-101');
    assert.ok(officerOutcome);
    assert.equal(officerOutcome.delivery_status, 'suppressed_quiet_hours');
  });

  it('overrides quiet hours for critical severity events', () => {
    store.updateOfficerPreferences('OFF-DELHI-101', {
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    });

    const incident = {
      id: 'INC-0051',
      category: 'digital_arrest',
      severity: 'critical', // CRITICAL overrides!
      region: 'Central Zone',
      assigned_to: 'OFF-DELHI-101',
      updated_at: Date.now(),
    };

    // 23:45 is inside quiet hours
    const outcomes = store.dispatchNotifications(
      incident,
      'escalation',
      null,
      null,
      Date.now(),
      '23:45'
    );

    const officerOutcome = outcomes.find((o) => o.recipient_id === 'OFF-DELHI-101');
    assert.ok(officerOutcome);
    assert.equal(officerOutcome.delivery_status, 'delivered');
  });

  it('records transient failure state and tracks retry history through successful delivery', () => {
    store.setSimulatedFailure('OFF-DELHI-101', true);

    const incident = {
      id: 'INC-0052',
      category: 'scam_call',
      severity: 'high',
      region: 'Central Zone',
      assigned_to: 'OFF-DELHI-101',
      updated_at: Date.now(),
    };

    const outcomes = store.dispatchNotifications(incident, 'assignment');
    const officerOutcome = outcomes.find((o) => o.recipient_id === 'OFF-DELHI-101');

    assert.ok(officerOutcome);
    assert.equal(officerOutcome.delivery_status, 'retrying');
    assert.equal(officerOutcome.attempts, 1);
    assert.equal(officerOutcome.retry_history.length, 1);

    // Disable simulated failure and trigger retry
    store.setSimulatedFailure('OFF-DELHI-101', false);
    const retried = store.retryNotification(officerOutcome.notification_id, true);

    assert.equal(retried.delivery_status, 'delivered');
    assert.equal(retried.attempts, 2);
    assert.equal(retried.error_message, null);
    assert.equal(retried.retry_history.length, 2);
  });
});

