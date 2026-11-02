/*
 * Geofencing & Spatial Alerts Engine for KshemOS.
 *
 * Supports:
 * - Circular and polygonal geofence boundaries
 * - Entry, exit, and dwell event detection
 * - Configurable rules by team or location
 * - Full offline operation with backend sync when available
 */

export const GEOFENCES_KEY = 'kshemos.geofences.v1';
export const GEOFENCE_RULES_KEY = 'kshemos.geofence_rules.v1';
export const GEOFENCE_ALERTS_KEY = 'kshemos.geofence_alerts.v1';
export const GEOFENCE_UNITS_KEY = 'kshemos.geofence_units.v1';
export const GEOFENCE_CHANGED_EVENT = 'kshemos:geofence-changed';

const BASE_URL = import.meta.env?.VITE_API_URL || '';

function safeStorage() {
  try {
    if (typeof globalThis.localStorage?.getItem === 'function') {
      return globalThis.localStorage;
    }
  } catch {
    // fallback
  }
  const mem = new Map();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

const storage = safeStorage();

function read(key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // storage fallback
  }
  emitChange();
}

export function emitChange() {
  if (typeof globalThis.dispatchEvent === 'function' && typeof Event === 'function') {
    globalThis.dispatchEvent(new Event(GEOFENCE_CHANGED_EVENT));
  }
}

// ---------- Spatial Mathematics ----------

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000.0; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPointInPolygon(lat, lng, polygon = []) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  let p1 = polygon[0];

  for (let i = 1; i <= n; i++) {
    const p2 = polygon[i % n];
    if (lng > Math.min(p1.lng, p2.lng) && lng <= Math.max(p1.lng, p2.lng)) {
      if (lat <= Math.max(p1.lat, p2.lat)) {
        let xinters;
        if (p1.lng !== p2.lng) {
          xinters = ((lng - p1.lng) * (p2.lat - p1.lat)) / (p2.lng - p1.lng) + p1.lat;
        } else {
          xinters = p1.lat;
        }
        if (p1.lat === p2.lat || lat <= xinters) {
          inside = !inside;
        }
      }
    }
    p1 = p2;
  }
  return inside;
}

export function isPointInBoundary(lat, lng, boundary) {
  if (!boundary || boundary.isActive === false || boundary.is_active === false) return false;

  const type = boundary.type || 'circle';
  if (type === 'circle') {
    const center = boundary.center || {};
    const radius = boundary.radiusMeters || boundary.radius_meters || 1000;
    const dist = haversineDistance(lat, lng, center.lat, center.lng);
    return dist <= radius;
  } else if (type === 'polygon') {
    const coords = boundary.coordinates || [];
    return isPointInPolygon(lat, lng, coords);
  }
  return false;
}

// ---------- Default Boundaries & Rules ----------

export const DEFAULT_BOUNDARIES = [
  {
    id: 'GEO-CENTRAL',
    name: 'Central Zone HQ',
    type: 'circle',
    category: 'operational_sector',
    color: '#3b82f6',
    center: { lat: 28.6139, lng: 77.2090 },
    radiusMeters: 2000,
    coordinates: null,
    assignedTeams: ['TEAM-ALPHA', 'COMMAND-HQ'],
    isActive: true,
  },
  {
    id: 'GEO-FIN-01',
    name: 'Financial & Banking Corridor',
    type: 'polygon',
    category: 'high_risk',
    color: '#ef4444',
    center: { lat: 28.6300, lng: 77.2180 },
    radiusMeters: null,
    coordinates: [
      { lat: 28.6350, lng: 77.2100 },
      { lat: 28.6370, lng: 77.2250 },
      { lat: 28.6250, lng: 77.2280 },
      { lat: 28.6230, lng: 77.2120 },
    ],
    assignedTeams: ['CYBER-PATROL', 'TEAM-ALPHA'],
    isActive: true,
  },
  {
    id: 'GEO-TECH-02',
    name: 'Cyber Hub & Data Parks',
    type: 'circle',
    category: 'critical_infra',
    color: '#8b5cf6',
    center: { lat: 28.5350, lng: 77.2250 },
    radiusMeters: 1800,
    coordinates: null,
    assignedTeams: ['CYBER-PATROL', 'TEAM-BRAVO'],
    isActive: true,
  },
  {
    id: 'GEO-RESTRICT-03',
    name: 'Diplomatic & Government Enclave',
    type: 'polygon',
    category: 'restricted',
    color: '#dc2626',
    center: { lat: 28.6000, lng: 77.1900 },
    radiusMeters: null,
    coordinates: [
      { lat: 28.6080, lng: 77.1800 },
      { lat: 28.6100, lng: 77.2000 },
      { lat: 28.5920, lng: 77.2020 },
      { lat: 28.5900, lng: 77.1820 },
    ],
    assignedTeams: ['VIP-ESCORT', 'COMMAND-HQ'],
    isActive: true,
  },
  {
    id: 'GEO-TRANS-04',
    name: 'Transit Hub & Airport Checkpoint',
    type: 'circle',
    category: 'transit_checkpoint',
    color: '#f59e0b',
    center: { lat: 28.5600, lng: 77.1000 },
    radiusMeters: 2500,
    coordinates: null,
    assignedTeams: ['FIELD-UNIT-1', 'TEAM-BRAVO'],
    isActive: true,
  },
];

export const DEFAULT_RULES = [
  {
    id: 'RULE-RESTRICTED-ENTRY',
    name: 'Critical Alert on Entry to Restricted Enclave',
    geofenceId: 'GEO-RESTRICT-03',
    team: '*',
    eventTypes: ['entry'],
    dwellThresholdSeconds: 0,
    alertSeverity: 'critical',
    enabled: true,
  },
  {
    id: 'RULE-FIN-DWELL',
    name: 'Dwell Alert in High-Risk Financial Corridor (>30s)',
    geofenceId: 'GEO-FIN-01',
    team: '*',
    eventTypes: ['dwell'],
    dwellThresholdSeconds: 30,
    alertSeverity: 'warning',
    enabled: true,
  },
  {
    id: 'RULE-PATROL-EXIT',
    name: 'Boundary Exit Alert for Patrol Teams',
    geofenceId: '*',
    team: 'CYBER-PATROL',
    eventTypes: ['exit'],
    dwellThresholdSeconds: 0,
    alertSeverity: 'info',
    enabled: true,
  },
];

export const INITIAL_UNITS = [
  {
    id: 'UNIT-101',
    name: 'Patrol Car Alpha 1',
    team: 'TEAM-ALPHA',
    lat: 28.6140,
    lng: 77.2092,
    status: 'on_patrol',
    heading: 45,
    speedKm: 32,
    activeGeofences: { 'GEO-CENTRAL': Date.now() - 60000 },
    dwellFired: [],
  },
  {
    id: 'UNIT-102',
    name: 'Cyber Taskforce Unit 2',
    team: 'CYBER-PATROL',
    lat: 28.5352,
    lng: 77.2248,
    status: 'investigating',
    heading: 180,
    speedKm: 0,
    activeGeofences: { 'GEO-TECH-02': Date.now() - 120000 },
    dwellFired: [],
  },
  {
    id: 'UNIT-103',
    name: 'Rapid Response Unit 3',
    team: 'TEAM-BRAVO',
    lat: 28.5605,
    lng: 77.1005,
    status: 'standby',
    heading: 90,
    speedKm: 5,
    activeGeofences: { 'GEO-TRANS-04': Date.now() - 30000 },
    dwellFired: [],
  },
  {
    id: 'UNIT-104',
    name: 'VIP Escort Delta',
    team: 'VIP-ESCORT',
    lat: 28.5950,
    lng: 77.1850,
    status: 'en_route',
    heading: 15,
    speedKm: 45,
    activeGeofences: { 'GEO-RESTRICT-03': Date.now() - 15000 },
    dwellFired: [],
  },
];

// ---------- Store Accessors ----------

export function getBoundaries() {
  const saved = read(GEOFENCES_KEY, null);
  if (!saved || saved.length === 0) {
    write(GEOFENCES_KEY, DEFAULT_BOUNDARIES);
    return DEFAULT_BOUNDARIES;
  }
  return saved;
}

export function saveBoundary(boundary) {
  const current = getBoundaries();
  const exists = current.find((b) => b.id === boundary.id);
  let updated;
  if (exists) {
    updated = current.map((b) => (b.id === boundary.id ? { ...b, ...boundary } : b));
  } else {
    const id = boundary.id || `GEO-CUSTOM-${Date.now().toString().slice(-4)}`;
    updated = [...current, { ...boundary, id, isActive: true }];
  }
  write(GEOFENCES_KEY, updated);
  return boundary;
}

export function deleteBoundary(id) {
  const current = getBoundaries();
  write(GEOFENCES_KEY, current.filter((b) => b.id !== id));
}

export function getRules() {
  const saved = read(GEOFENCE_RULES_KEY, null);
  if (!saved || saved.length === 0) {
    write(GEOFENCE_RULES_KEY, DEFAULT_RULES);
    return DEFAULT_RULES;
  }
  return saved;
}

export function saveRule(rule) {
  const current = getRules();
  const exists = current.find((r) => r.id === rule.id);
  let updated;
  if (exists) {
    updated = current.map((r) => (r.id === rule.id ? { ...r, ...rule } : r));
  } else {
    const id = rule.id || `RULE-${Date.now().toString().slice(-4)}`;
    updated = [...current, { ...rule, id, enabled: true }];
  }
  write(GEOFENCE_RULES_KEY, updated);
  return rule;
}

export function deleteRule(id) {
  const current = getRules();
  write(GEOFENCE_RULES_KEY, current.filter((r) => r.id !== id));
}

export function getAlerts() {
  return read(GEOFENCE_ALERTS_KEY, []);
}

export function acknowledgeAlert(alertId) {
  const alerts = getAlerts();
  const updated = alerts.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a));
  write(GEOFENCE_ALERTS_KEY, updated);
}

export function clearAlerts() {
  write(GEOFENCE_ALERTS_KEY, []);
}

export function getUnits() {
  const saved = read(GEOFENCE_UNITS_KEY, null);
  if (!saved || saved.length === 0) {
    write(GEOFENCE_UNITS_KEY, INITIAL_UNITS);
    return INITIAL_UNITS;
  }
  return saved;
}

export function setUnits(units) {
  write(GEOFENCE_UNITS_KEY, units);
}

// ---------- Telemetry & Event Evaluation Engine ----------

let alertSeq = 2000;

export function evaluateLocationPing({ entityId, team, lat, lng, timestamp = Date.now() }) {
  const boundaries = getBoundaries();
  const rules = getRules();
  const units = getUnits();
  const existingAlerts = getAlerts();

  // Find or create unit state
  let unit = units.find((u) => u.id === entityId);
  if (!unit) {
    unit = {
      id: entityId,
      name: `Unit ${entityId}`,
      team: team || 'TEAM-ALPHA',
      lat,
      lng,
      status: 'active',
      heading: 0,
      speedKm: 25,
      activeGeofences: {},
      dwellFired: [],
    };
  }

  // Which boundaries contain the new position?
  const currentMatching = boundaries.filter((b) => isPointInBoundary(lat, lng, b));
  const currentGeoIds = new Set(currentMatching.map((b) => b.id));

  const prevActive = unit.activeGeofences || {};
  const prevGeoIds = new Set(Object.keys(prevActive));
  const updatedActive = { ...prevActive };
  const dwellFired = new Set(unit.dwellFired || []);

  const generatedEvents = []; // { eventType, geofenceId, geofenceName, message }

  // 1. Check ENTRY events
  for (const b of currentMatching) {
    if (!prevGeoIds.has(b.id)) {
      updatedActive[b.id] = timestamp;
      generatedEvents.push({
        eventType: 'entry',
        geofenceId: b.id,
        geofenceName: b.name,
        message: `Unit ${unit.name} (${unit.team}) entered ${b.name}`,
      });
    }
  }

  // 2. Check EXIT events
  for (const gId of prevGeoIds) {
    if (!currentGeoIds.has(gId)) {
      const bObj = boundaries.find((b) => b.id === gId);
      const bName = bObj ? bObj.name : gId;
      delete updatedActive[gId];
      // clear dwell flag for this zone
      for (const item of Array.from(dwellFired)) {
        if (item.startsWith(`${gId}_`)) dwellFired.delete(item);
      }
      generatedEvents.push({
        eventType: 'exit',
        geofenceId: gId,
        geofenceName: bName,
        message: `Unit ${unit.name} (${unit.team}) exited ${bName}`,
      });
    }
  }

  // 3. Check DWELL events
  for (const b of currentMatching) {
    const entryTime = updatedActive[b.id] || timestamp;
    const dwellSeconds = (timestamp - entryTime) / 1000.0;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.geofenceId !== '*' && rule.geofenceId !== b.id) continue;
      if (rule.team !== '*' && rule.team !== unit.team) continue;
      if (!rule.eventTypes.includes('dwell')) continue;

      const threshold = rule.dwellThresholdSeconds || 30;
      const dwellKey = `${b.id}_${rule.id}`;

      if (dwellSeconds >= threshold && !dwellFired.has(dwellKey)) {
        dwellFired.add(dwellKey);
        generatedEvents.push({
          eventType: 'dwell',
          geofenceId: b.id,
          geofenceName: b.name,
          message: `Unit ${unit.name} dwelling in ${b.name} for ${Math.round(dwellSeconds)}s (threshold: ${threshold}s)`,
        });
      }
    }
  }

  // Turn triggered events into alerts matching configured rules
  const newAlerts = [];

  for (const evt of generatedEvents) {
    // Match rules
    const matchingRules = rules.filter((r) => {
      if (!r.enabled) return false;
      if (r.geofenceId !== '*' && r.geofenceId !== evt.geofenceId) return false;
      if (r.team !== '*' && r.team !== unit.team) return false;
      return r.eventTypes.includes(evt.eventType);
    });

    if (matchingRules.length > 0) {
      for (const rule of matchingRules) {
        alertSeq += 1;
        newAlerts.push({
          id: `ALT-${alertSeq}`,
          ruleId: rule.id,
          geofenceId: evt.geofenceId,
          geofenceName: evt.geofenceName,
          entityId: unit.id,
          team: unit.team,
          eventType: evt.eventType,
          severity: rule.alertSeverity || 'warning',
          message: `[${rule.name}] ${evt.message}`,
          timestamp,
          lat,
          lng,
          acknowledged: false,
        });
      }
    } else {
      alertSeq += 1;
      newAlerts.push({
        id: `ALT-${alertSeq}`,
        ruleId: 'DEFAULT',
        geofenceId: evt.geofenceId,
        geofenceName: evt.geofenceName,
        entityId: unit.id,
        team: unit.team,
        eventType: evt.eventType,
        severity: 'info',
        message: evt.message,
        timestamp,
        lat,
        lng,
        acknowledged: false,
      });
    }
  }

  // Update unit in store
  const updatedUnit = {
    ...unit,
    lat,
    lng,
    activeGeofences: updatedActive,
    dwellFired: Array.from(dwellFired),
    lastPing: timestamp,
  };

  const updatedUnits = units.some((u) => u.id === entityId)
    ? units.map((u) => (u.id === entityId ? updatedUnit : u))
    : [...units, updatedUnit];

  setUnits(updatedUnits);

  if (newAlerts.length > 0) {
    write(GEOFENCE_ALERTS_KEY, [...newAlerts, ...existingAlerts].slice(0, 100));
  }

  return {
    unit: updatedUnit,
    currentGeofences: Array.from(currentGeoIds),
    newAlerts,
  };
}

export function resetGeofenceEngine() {
  write(GEOFENCES_KEY, DEFAULT_BOUNDARIES);
  write(GEOFENCE_RULES_KEY, DEFAULT_RULES);
  write(GEOFENCE_ALERTS_KEY, []);
  write(GEOFENCE_UNITS_KEY, INITIAL_UNITS);
}

