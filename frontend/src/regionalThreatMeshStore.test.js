import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  ingestReportLocally,
  signoffMicroAdvisoryLocally,
  queryPortalMeshBannerLocally,
  listLocalThreatClusters,
  listLocalMicroAdvisories,
  fetchThreatMeshStatsApi,
  resetLocalThreatMeshStore,
} from './regionalThreatMeshStore.js';

describe('Privacy-Preserving Regional Threat Broadcast & Micro-Advisory Mesh Store', () => {
  beforeEach(() => {
    resetLocalThreatMeshStore();
  });

  it('aggregates reports and triggers draft advisory when 3+ complaints occur within 24h', () => {
    // 1st complaint
    const r1 = ingestReportLocally({
      pincode: '110007',
      scam_category: 'electricity_bill_scam',
      service_area_id: 'SA-NORTH-01',
    });
    assert.strictEqual(r1.advisory, null);

    // 2nd complaint
    const r2 = ingestReportLocally({
      pincode: '110009',
      scam_category: 'electricity_bill_scam',
      service_area_id: 'SA-NORTH-01',
    });
    assert.strictEqual(r2.advisory, null);

    // 3rd complaint triggers threshold
    const r3 = ingestReportLocally({
      pincode: '110054',
      scam_category: 'electricity_bill_scam',
      service_area_id: 'SA-NORTH-01',
    });
    assert.ok(r3.advisory, 'Should trigger micro-advisory draft');
    assert.strictEqual(r3.advisory.complaints_aggregated, 3);
    assert.strictEqual(r3.advisory.status, 'DRAFTED_PENDING_APPROVAL');
    assert.strictEqual(r3.advisory.published_at, null);

    // Verify Title format
    assert.strictEqual(
      r3.advisory.title,
      'Notice: Fake electricity bill payment SMS active in North Delhi area.'
    );
    assert.ok(r3.advisory.target_pincodes.includes('110007'));
    assert.ok(r3.advisory.action_checklist.length >= 3);
  });

  it('preserves privacy with zero victim PII and k-anonymity tokens', () => {
    const r1 = ingestReportLocally({
      pincode: '110007',
      scam_category: 'electricity_bill_scam',
      service_area_id: 'SA-NORTH-01',
    });
    assert.ok(r1.anon_ref.startsWith('ANON-REF-'));

    const clusters = listLocalThreatClusters();
    for (const c of clusters) {
      assert.ok(c.privacy_guarantee.includes('K-Anonymity Verified'));
      assert.ok(c.anonymized_report_refs.every((ref) => ref.startsWith('ANON-REF-')));
    }
  });

  it('executes commander single-click sign-off to publish advisory', () => {
    // Ingest 3 reports to create draft
    ingestReportLocally({ pincode: '110007', scam_category: 'electricity_bill_scam', service_area_id: 'SA-NORTH-01' });
    ingestReportLocally({ pincode: '110009', scam_category: 'electricity_bill_scam', service_area_id: 'SA-NORTH-01' });
    const r3 = ingestReportLocally({ pincode: '110054', scam_category: 'electricity_bill_scam', service_area_id: 'SA-NORTH-01' });

    const advisoryId = r3.advisory.advisory_id;

    // Commander sign-off
    const signed = signoffMicroAdvisoryLocally(advisoryId, {
      commander_badge_id: 'CMD-DELHI-NORTH',
      commander_name: 'DCP Vikram Malhotra',
      action: 'approve_publish',
    });

    assert.ok(signed);
    assert.strictEqual(signed.status, 'PUBLISHED_ACTIVE');
    assert.strictEqual(signed.approved_by_commander_badge, 'CMD-DELHI-NORTH');
    assert.strictEqual(signed.approved_by_commander_name, 'DCP Vikram Malhotra');
    assert.ok(signed.published_at > 0);
  });

  it('strictly restricts portal banner to affected jurisdiction geofence', () => {
    // Pre-seeded south delhi advisory is published
    listLocalMicroAdvisories();

    // Query inside South Delhi (pincode 110017)
    const bannerInside = queryPortalMeshBannerLocally({ pincode: '110017' });
    assert.ok(bannerInside, 'Citizen in 110017 must receive advisory banner');
    assert.ok(bannerInside.title.includes('digital arrest'));
    assert.strictEqual(bannerInside.boundary_restricted, true);

    // Query outside geofence (Mumbai 400001 or Bengaluru 560001)
    const bannerOutside = queryPortalMeshBannerLocally({ pincode: '400001' });
    assert.strictEqual(bannerOutside, null, 'Advisory must be strictly withheld outside geofence');

    const bannerFarGps = queryPortalMeshBannerLocally({ lat: 19.0760, lng: 72.8777 });
    assert.strictEqual(bannerFarGps, null, 'Advisory must be withheld for coordinates outside geofence');
  });

  it('fetches aggregated threat mesh statistics', async () => {
    const stats = await fetchThreatMeshStatsApi();
    assert.ok(typeof stats.total_active_clusters === 'number');
    assert.ok(typeof stats.published_active_advisories === 'number');
    assert.ok(typeof stats.covered_pincodes_count === 'number');
  });
});

