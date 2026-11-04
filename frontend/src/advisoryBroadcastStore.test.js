import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AdvisoryBroadcastStore,
  SERVICE_AREAS_DEMOGRAPHICS,
  EMERGENCY_TEMPLATES,
} from './advisoryBroadcastStore.js';

describe('AdvisoryBroadcastStore & Emergency Broadcast Logic', () => {
  it('reverse-geocodes service areas to identify citizens, senior centers, and merchants', () => {
    const store = new AdvisoryBroadcastStore();

    // 1. Central Zone
    const central = store.estimateAudience({ targeting_type: 'service_area', service_area_id: 'SA-CENTRAL-01' });
    assert.equal(central.service_area_id, 'SA-CENTRAL-01');
    assert.equal(central.region, 'Central Zone');
    assert.equal(central.estimated_citizens, 14500);
    assert.equal(central.senior_centers_count, 6);
    assert.equal(central.merchant_nodes_count, 195);
    assert.equal(central.bank_branches_count, 48);
    assert.ok(central.postal_pincodes.includes('110001'));
    assert.equal(central.senior_centers[0].name, 'Barakhamba Elder Haven');

    // 2. South Zone
    const south = store.estimateAudience({ targeting_type: 'service_area', service_area_id: 'SA-SOUTH-01' });
    assert.equal(south.estimated_citizens, 22000);
    assert.equal(south.senior_centers_count, 8);

    // 3. Custom Perimeter
    const custom = store.estimateAudience({
      targeting_type: 'custom_perimeter',
      center_lat: 28.6315,
      center_lng: 77.2167,
      radius_km: 3.5,
    });
    assert.equal(custom.targeting_type, 'custom_perimeter');
    assert.ok(custom.estimated_citizens > 2000);
    assert.ok(custom.senior_centers_count >= 2);
  });

  it('formats channel-adapted payloads for SMS, WhatsApp, Push, and Portal Banner', () => {
    const store = new AdvisoryBroadcastStore();
    const title = 'Extortion Alert: Fake Law Enforcement Calls';
    const desc = 'Scammers claiming to be CBI officers are demanding immediate fund transfers over video call.';
    const refId = 'ADV-9104';

    // SMS: Strict TRAI/CDAC limit <= 160 characters
    const sms = store.adaptSmsPayload(title, desc, refId);
    assert.ok(sms.length <= 160, `SMS exceeded 160 characters: ${sms.length}`);
    assert.ok(sms.includes('[KSHEM-POLICE'));
    assert.ok(sms.includes('1930'));

    // WhatsApp: Rich emergency card with interactive buttons
    const wa = store.adaptWhatsAppPayload(title, desc, refId, 'Central Zone');
    assert.equal(wa.template, 'emergency_public_safety_siren_v2');
    assert.ok(wa.header.includes('LAW ENFORCEMENT'));
    assert.equal(wa.buttons.length, 2);

    // Push: APNS/FCM priority alert
    const push = store.adaptPushPayload(title, desc, 'critical', refId);
    assert.ok(push.title.includes('EMERGENCY SIREN'));
    assert.equal(push.sound, 'emergency_siren.wav');
    assert.equal(push.priority, 'high');

    // Portal Banner
    const banner = store.adaptPortalBannerPayload(title, desc, 'critical', refId, 'Central Zone');
    assert.equal(banner.active, true);
    assert.ok(banner.marquee_text.includes('CRITICAL ADVISORY'));
  });

  it('enforces commander approval guardrail with dual-authorization for critical sirens', () => {
    const store = new AdvisoryBroadcastStore();
    const targeting = store.estimateAudience({ targeting_type: 'service_area', service_area_id: 'SA-CENTRAL-01' });

    // Create a Critical advisory
    const adv = store.createBroadcast({
      title: 'CRITICAL SIREN: Fake Arrest Syndicate',
      description: 'Extortion ring targeting residents with fake arrest warrants.',
      severity: 'critical',
      affected_location: 'Central Zone',
      target_audience: 'citizens',
      targeting,
      created_by_badge: 'BADGE-CMD-701',
      created_by_name: 'Commander Rajesh Varma',
    });

    assert.equal(adv.dual_auth.requires_dual_auth, true);
    assert.equal(adv.dual_auth.is_fully_authorized, false);
    assert.equal(adv.dual_auth.authorizer_1_badge, 'BADGE-CMD-701');
    assert.equal(adv.dual_auth.authorizer_2_badge, null);

    // Dispatching before second authorization MUST throw guardrail error
    assert.throws(
      () => store.dispatchBroadcast(adv.id),
      /Commander Guardrail Violation/
    );

    // Same officer signing second authorization MUST throw error
    assert.throws(
      () =>
        store.authorizeBroadcast(adv.id, {
          authorizer_badge: 'BADGE-CMD-701', // Duplicate officer!
          authorizer_name: 'Commander Rajesh Varma',
          decision: 'approve',
        }),
      /Second authorizer must be a distinct officer/
    );

    // Independent second commanding officer signs off
    const auth2 = store.authorizeBroadcast(adv.id, {
      authorizer_badge: 'BADGE-DCP-402',
      authorizer_name: 'Deputy Commissioner Ananya Sen',
      authorizer_role: 'Joint Director, Cyber Public Safety',
      decision: 'approve',
    });

    assert.equal(auth2.dual_auth.authorizer_2_badge, 'BADGE-DCP-402');
    assert.equal(auth2.dual_auth.is_fully_authorized, true);
    assert.equal(auth2.status, 'approved');

    // Dispatch now succeeds
    const dispatched = store.dispatchBroadcast(adv.id);
    assert.equal(dispatched.status, 'published');
    assert.ok(dispatched.telemetry.dispatched > 0);
    assert.ok(dispatched.telemetry.delivered > 0);
    assert.ok(dispatched.telemetry.delivery_rate_pct >= 95.0);
  });

  it('tracks delivery telemetry and simulates incoming citizen report acknowledgments', () => {
    const store = new AdvisoryBroadcastStore();
    const broadcasts = store.getBroadcasts();
    const published = broadcasts.find((b) => b.status === 'published');
    assert.ok(published, 'Should have seeded published broadcast');

    const initialRead = published.telemetry.read;
    const initialReports = published.telemetry.linked_citizen_reports;

    // Advance telemetry
    const updated = store.advanceTelemetry(published.id, 250);
    assert.equal(updated.read, initialRead + 250);
    assert.ok(updated.linked_citizen_reports > initialReports);
    assert.ok(updated.read_rate_pct > 0.0);
  });

  it('returns the active emergency portal header marquee banner', () => {
    const store = new AdvisoryBroadcastStore();
    const banner = store.getActiveBanner();
    assert.ok(banner !== null);
    assert.equal(banner.active, true);
    assert.ok(banner.advisory_id.startsWith('ADV-'));
    assert.ok(banner.marquee_text.includes('ADVISORY'));
  });
});
