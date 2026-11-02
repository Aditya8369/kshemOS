import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLocationPing,
  haversineDistance,
  isPointInBoundary,
  isPointInPolygon,
  resetGeofenceEngine,
  getAlerts,
  acknowledgeAlert,
  getBoundaries,
  saveBoundary,
  getRules,
  saveRule,
} from './geofenceEngine.js';

test('haversine distance calculates accurate meters between coordinates', () => {
  // Distance from (28.6139, 77.2090) to (28.6239, 77.2090) is ~1.11 km
  const dist = haversineDistance(28.6139, 77.2090, 28.6239, 77.2090);
  assert.ok(dist > 1000 && dist < 1200, `Expected ~1110m, got ${dist}`);
});

test('point in polygon detects points inside and outside polygon boundary', () => {
  const polygon = [
    { lat: 10, lng: 10 },
    { lat: 10, lng: 20 },
    { lat: 20, lng: 20 },
    { lat: 20, lng: 10 },
  ];

  assert.equal(isPointInPolygon(15, 15, polygon), true, 'Point (15, 15) should be inside');
  assert.equal(isPointInPolygon(5, 5, polygon), false, 'Point (5, 5) should be outside');
  assert.equal(isPointInPolygon(25, 15, polygon), false, 'Point (25, 15) should be outside');
});

test('evaluates unit entry, exit, and dwell events with configured rules', () => {
  resetGeofenceEngine();

  // Financial corridor is around lat 28.6300, lng 77.2180
  const outsideLat = 28.7500;
  const outsideLng = 77.2180;
  const insideLat = 28.6300;
  const insideLng = 77.2180;

  // 1. Initial Ping Outside
  const res1 = evaluateLocationPing({
    entityId: 'TEST-UNIT-1',
    team: 'TEAM-ALPHA',
    lat: outsideLat,
    lng: outsideLng,
    timestamp: 1700000000000,
  });
  assert.equal(res1.currentGeofences.includes('GEO-FIN-01'), false);

  // 2. Ping moving inside -> Triggers ENTRY event
  const res2 = evaluateLocationPing({
    entityId: 'TEST-UNIT-1',
    team: 'TEAM-ALPHA',
    lat: insideLat,
    lng: insideLng,
    timestamp: 1700000010000,
  });
  assert.equal(res2.currentGeofences.includes('GEO-FIN-01'), true);
  const entryAlert = res2.newAlerts.find((a) => a.eventType === 'entry');
  assert.ok(entryAlert, 'Entry event alert should be generated');

  // 3. Ping remaining inside past dwell threshold (30s rule) -> Triggers DWELL event
  const res3 = evaluateLocationPing({
    entityId: 'TEST-UNIT-1',
    team: 'TEAM-ALPHA',
    lat: insideLat,
    lng: insideLng,
    timestamp: 1700000045000, // 35s later
  });
  const dwellAlert = res3.newAlerts.find((a) => a.eventType === 'dwell');
  assert.ok(dwellAlert, 'Dwell alert should be generated when dwell time exceeds threshold');
  assert.equal(dwellAlert.severity, 'warning');

  // 4. Ping moving outside -> Triggers EXIT event
  const res4 = evaluateLocationPing({
    entityId: 'TEST-UNIT-1',
    team: 'TEAM-ALPHA',
    lat: outsideLat,
    lng: outsideLng,
    timestamp: 1700000055000,
  });
  assert.equal(res4.currentGeofences.includes('GEO-FIN-01'), false);
  const exitAlert = res4.newAlerts.find((a) => a.eventType === 'exit');
  assert.ok(exitAlert, 'Exit event alert should be generated');
});

test('supports team-specific geofence rule filtering', () => {
  resetGeofenceEngine();

  // Add rule specific to CYBER-PATROL
  saveRule({
    id: 'RULE-SPECIAL-TEAM',
    name: 'Cyber Patrol Only Warning',
    geofenceId: 'GEO-TECH-02',
    team: 'CYBER-PATROL',
    eventTypes: ['entry'],
    dwellThresholdSeconds: 0,
    alertSeverity: 'critical',
    enabled: true,
  });

  // Ping inside Cyber Hub with TEAM-ALPHA -> Rule should NOT trigger
  const resAlpha = evaluateLocationPing({
    entityId: 'ALPHA-99',
    team: 'TEAM-ALPHA',
    lat: 28.5350,
    lng: 77.2250,
    timestamp: 1700000000000,
  });
  assert.equal(resAlpha.newAlerts.some((a) => a.ruleId === 'RULE-SPECIAL-TEAM'), false);

  // Ping inside Cyber Hub with CYBER-PATROL -> Rule triggers
  const resCyber = evaluateLocationPing({
    entityId: 'CYBER-99',
    team: 'CYBER-PATROL',
    lat: 28.5350,
    lng: 77.2250,
    timestamp: 1700000005000,
  });
  const cyberAlert = resCyber.newAlerts.find((a) => a.ruleId === 'RULE-SPECIAL-TEAM');
  assert.ok(cyberAlert, 'Rule targeting CYBER-PATROL should trigger');
  assert.equal(cyberAlert.severity, 'critical');
});

test('alerts can be retrieved and acknowledged', () => {
  resetGeofenceEngine();

  evaluateLocationPing({
    entityId: 'UNIT-ACK',
    team: 'VIP-ESCORT',
    lat: 28.6000,
    lng: 77.1900, // Inside Diplomatic Enclave
    timestamp: 1700000000000,
  });

  const alerts = getAlerts();
  assert.ok(alerts.length > 0);
  const firstId = alerts[0].id;

  acknowledgeAlert(firstId);
  const updatedAlerts = getAlerts();
  const acked = updatedAlerts.find((a) => a.id === firstId);
  assert.equal(acked.acknowledged, true);
});

