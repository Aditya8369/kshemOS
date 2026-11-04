import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  SpatialIntelligenceStore,
  haversineDistance,
  calculateHeading,
} from './spatialIntelligenceStore.js';

describe('SpatialIntelligenceStore & Threat Heatmap Engine', () => {
  let store;

  beforeEach(() => {
    store = new SpatialIntelligenceStore();
    store._incidents = [
      {
        id: 'TEST-INC-1',
        title: 'Digital Arrest Call 1',
        category: 'scam_call',
        severity: 'critical',
        lat: 28.631,
        lng: 77.2175,
        region: 'Central Zone',
      },
      {
        id: 'TEST-INC-2',
        title: 'Digital Arrest Call 2',
        category: 'scam_call',
        severity: 'critical',
        lat: 28.632,
        lng: 77.219,
        region: 'Central Zone',
      },
      {
        id: 'TEST-INC-3',
        title: 'ATM Skimming Attempt',
        category: 'fraud_tx',
        severity: 'high',
        lat: 28.6295,
        lng: 77.221,
        region: 'Central Zone',
      },
      {
        id: 'TEST-INC-4',
        title: 'South Zone Mule Cashout',
        category: 'fraud_tx',
        severity: 'critical',
        lat: 28.528,
        lng: 77.219,
        region: 'South Zone',
      },
      {
        id: 'TEST-INC-5',
        title: 'South Zone Parcel Scam',
        category: 'scam_call',
        severity: 'high',
        lat: 28.526,
        lng: 77.217,
        region: 'South Zone',
      },
    ];
  });

  it('calculates great-circle distance and compass heading accurately', () => {
    // Distance between Connaught Place (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is approx 2.4 km
    const dist = haversineDistance(28.6315, 77.2167, 28.6129, 77.2295);
    assert.ok(dist > 2000 && dist < 3000, `Expected ~2.4km, got ${dist}`);

    // Heading South-East
    const heading = calculateHeading(28.6315, 77.2167, 28.6129, 77.2295);
    assert.equal(heading.cardinal, 'SE');
    assert.ok(heading.degrees >= 120 && heading.degrees <= 170);
  });

  it('clusters spatial incidents into high-density threat hotspots with POI overlay', () => {
    const clusters = store.runSpatialClustering(1600.0, 2);
    assert.equal(clusters.length, 2);

    const central = clusters.find((c) => c.region === 'Central Zone');
    assert.ok(central, 'Central cluster missing');
    assert.equal(central.incident_count, 3);
    assert.ok(central.severity_density > 0);
    assert.ok(central.radius_meters >= 500);
    assert.equal(central.threat_level, 'critical');
    assert.ok(central.nearby_atms.length >= 1);

    const south = clusters.find((c) => c.region === 'South Zone');
    assert.ok(south, 'South cluster missing');
    assert.equal(south.incident_count, 2);
  });

  it('computes velocity and migration vectors toward adjacent service areas', () => {
    const clusters = store.runSpatialClustering();
    const vectors = store.calculateMigrationVectors(clusters);

    assert.equal(vectors.length, clusters.length);
    const centralVec = vectors.find((v) => v.target_region === 'North Zone');
    assert.ok(centralVec);
    assert.equal(centralVec.trend, 'migrating');
    assert.ok(centralVec.velocity_km_per_day > 0);
    assert.ok(centralVec.risk_narrative.includes('North Zone'));
  });

  it('generates smart preventative patrol recommendations for field units', () => {
    const clusters = store.runSpatialClustering();
    const vectors = store.calculateMigrationVectors(clusters);
    const recs = store.generateSmartPatrolRecommendations(clusters, vectors);

    assert.equal(recs.length, clusters.length);
    for (const rec of recs) {
      assert.ok(rec.recommendation_id.startsWith('PATROL-REC-'));
      assert.ok(rec.lat !== 0 && rec.lng !== 0);
      assert.ok(['urgent_deterrence', 'preventative_check', 'surveillance_stakeout'].includes(rec.suggested_priority));
      assert.ok(rec.action_checklist.length >= 2);
    }
  });

  it('evaluates citizen micro-advisories based on proximity to active clusters', () => {
    // 1. User located inside Central Zone cluster (28.6315, 77.2167)
    const closeAdv = store.evaluateCitizenMicroAdvisory(28.6315, 77.2167);
    assert.ok(closeAdv.proximity_meters < 500);
    assert.equal(closeAdv.threat_level, 'critical');
    assert.ok(closeAdv.localized_risk_score >= 80);
    assert.ok(closeAdv.safety_guidance.length >= 2);
    assert.ok(closeAdv.nearest_safe_precinct.includes('Barakhamba'));

    // 2. User located far away in safe perimeter (28.4000, 77.0200)
    const farAdv = store.evaluateCitizenMicroAdvisory(28.4, 77.02);
    assert.ok(farAdv.proximity_meters > 15000);
    assert.equal(farAdv.threat_level, 'low');
    assert.ok(farAdv.localized_risk_score <= 30);
  });

  it('ingests live spatial incidents and dynamically updates cluster calculations', () => {
    store.addIncident({
      title: 'North Phishing Event',
      category: 'scam_call',
      severity: 'critical',
      lat: 28.682,
      lng: 77.212,
      region: 'North Zone',
    });
    store.addIncident({
      title: 'North ATM Skim',
      category: 'fraud_tx',
      severity: 'high',
      lat: 28.683,
      lng: 77.213,
      region: 'North Zone',
    });

    const clusters = store.runSpatialClustering();
    assert.equal(clusters.length, 3);
    const north = clusters.find((c) => c.region === 'North Zone');
    assert.ok(north);
    assert.equal(north.incident_count, 2);
  });
});
