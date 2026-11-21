import assert from 'node:assert/strict';
import test from 'node:test';

import {
  booleanPointInPolygon,
  matchPolygonToJurisdictions,
  validatePolygonVertices,
  PIN_CENTROIDS,
  STATION_CIRCLES,
} from './spatialPolygonMatcher.js';

test('booleanPointInPolygon correctly detects interior and exterior points', () => {
  const polygon = [
    [77.185, 28.718],
    [77.245, 28.712],
    [77.248, 28.625],
    [77.180, 28.628],
    [77.185, 28.718],
  ];

  // Civil Lines (110007: 28.6920, 77.2150)
  assert.equal(booleanPointInPolygon({ lat: 28.6920, lng: 77.2150 }, polygon), true);

  // Connaught Place (110001: 28.6304, 77.2177)
  assert.equal(booleanPointInPolygon({ lat: 28.6304, lng: 77.2177 }, polygon), true);

  // Saket (110017: 28.5244, 77.2066) is outside
  assert.equal(booleanPointInPolygon({ lat: 28.5244, lng: 77.2066 }, polygon), false);
});

test('matchPolygonToJurisdictions auto-populates 4 postal sectors across 2 police circles', () => {
  const polygon = [
    { lat: 28.718, lng: 77.185 },
    { lat: 28.712, lng: 77.245 },
    { lat: 28.625, lng: 77.248 },
    { lat: 28.628, lng: 77.180 },
  ];

  const match = matchPolygonToJurisdictions(polygon);

  assert.equal(match.postal_sector_count, 4);
  assert.deepEqual(match.matched_pincodes.sort(), ['110001', '110007', '110009', '110054']);
  assert.equal(match.police_circle_count, 2);
  assert.ok(match.matched_circles.includes('Civil Lines Cyber Cell Desk'));
  assert.ok(match.matched_circles.includes('Central Cyber Cell Desk, Barakhamba Road'));
  assert.equal(match.estimated_citizen_reach, 18500);
  assert.equal(
    match.multi_zone_summary,
    'Targets 4 postal sectors across 2 police circles (Est. reach: 18,500 citizens)'
  );
});

test('validatePolygonVertices validates vertex limits (min 3, max 500)', () => {
  // Fewer than 3 vertices
  const twoPoints = [
    { lat: 28.70, lng: 77.20 },
    { lat: 28.71, lng: 77.21 },
  ];
  assert.equal(validatePolygonVertices(twoPoints).valid, false);

  // Valid 4 vertices
  const fourPoints = [
    { lat: 28.70, lng: 77.20 },
    { lat: 28.71, lng: 77.21 },
    { lat: 28.65, lng: 77.22 },
    { lat: 28.64, lng: 77.19 },
  ];
  assert.equal(validatePolygonVertices(fourPoints).valid, true);

  // Out of bounds coordinate
  const oobPoints = [
    { lat: 95.0, lng: 77.20 },
    { lat: 28.71, lng: 77.21 },
    { lat: 28.65, lng: 77.22 },
  ];
  assert.equal(validatePolygonVertices(oobPoints).valid, false);
});
