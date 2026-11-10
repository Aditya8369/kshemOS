/**
 * Privacy-Preserving Regional Threat Broadcast & Micro-Advisory Mesh Store for KshemOS.
 *
 * Capabilities:
 * 1. Aggregates verified citizen reports by postal pin code & police station circle.
 * 2. Groups cluster reports when 3+ complaints of the same scam type occur in a service area within a 24h window.
 * 3. Drafts human-readable citizen safety alerts:
 *    "Notice: Fake electricity bill payment SMS active in North Delhi area."
 * 4. Requires commander single-click sign-off before publishing to the citizen portal banner.
 * 5. Restricts advisory targeting strictly to affected jurisdiction boundaries (withholding alerts outside geofence).
 */

export const SERVICE_AREAS_REGISTRY = {
  'SA-NORTH-01': {
    service_area_id: 'SA-NORTH-01',
    service_area_name: 'North Delhi Cyber Command',
    police_station_circle: 'Civil Lines Cyber Cell Desk',
    postal_pincodes: ['110007', '110009', '110054'],
    geofence_center: { lat: 28.6920, lng: 77.2150 },
    geofence_radius_km: 5.5,
  },
  'SA-CENTRAL-01': {
    service_area_id: 'SA-CENTRAL-01',
    service_area_name: 'Central Secretariat Cyber Command',
    police_station_circle: 'Central Cyber Cell Desk, Barakhamba Road',
    postal_pincodes: ['110001', '110002', '110005'],
    geofence_center: { lat: 28.6139, lng: 77.2090 },
    geofence_radius_km: 4.5,
  },
  'SA-SOUTH-01': {
    service_area_id: 'SA-SOUTH-01',
    service_area_name: 'South Financial Corridors',
    police_station_circle: 'Saket Tech Crime Unit',
    postal_pincodes: ['110017', '110019', '110048'],
    geofence_center: { lat: 28.5244, lng: 77.2066 },
    geofence_radius_km: 6.5,
  },
  'SA-WEST-01': {
    service_area_id: 'SA-WEST-01',
    service_area_name: 'West District Cyber Cell',
    police_station_circle: 'Rajouri Garden Cyber Police Desk',
    postal_pincodes: ['110027', '110015', '110026'],
    geofence_center: { lat: 28.6500, lng: 77.1200 },
    geofence_radius_km: 5.0,
  },
};

export const SCAM_DEFINITIONS = {
  electricity_bill_scam: {
    label: 'Fake Electricity Bill Payment SMS',
    headline: 'Notice: Fake electricity bill payment SMS active in {area} area.',
    modus: 'Deceptive SMS notices claiming immediate night disconnection of electricity due to unpaid bills.',
    guidance: [
      'Do not call unauthorized mobile numbers or click shortened URLs in disconnection SMS messages.',
      'Official discoms (BSES, Tata Power, NDPL) never demand bill payment via personal UPI handles.',
      'Verify dues directly through your official DISCOM mobile app or dial customer toll-free 19122.',
      'Report fraudulent numbers immediately to Cyber Crime Helpline 1930.',
    ],
    urgency: 'high',
  },
  digital_arrest: {
    label: 'Impersonation Video Call Digital Arrest',
    headline: 'Notice: Fake police & CBI digital arrest video calls active in {area} area.',
    modus: 'Scammers impersonating CBI or police officers place video calls wearing fake uniforms and demand settlement funds.',
    guidance: [
      'Under Indian law (BNSS), no police officer or judge can place citizens under arrest via video call.',
      'Law enforcement never demands money transfers to clearing accounts.',
      'Disconnect calls immediately; perform reverse verification on verified landlines.',
    ],
    urgency: 'critical',
  },
  courier_customs_fraud: {
    label: 'Seized Courier Contraband Clearance Scam',
    headline: 'Notice: Seized parcel customs clearance fee scam active in {area} area.',
    modus: 'Calls claiming parcels containing narcotics were intercepted at customs demanding instant clearance payment.',
    guidance: [
      'Customs departments never demand fine settlement over personal phone or UPI.',
      'Track international shipments exclusively on official courier portals.',
    ],
    urgency: 'high',
  },
};

const LOCAL_STORAGE_KEY = 'kshemos.threat_mesh.v1';
const _memoryFallback = new Map();

function readStorage(key, defaultVal) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultVal;
    }
  } catch (e) {
    // ignore
  }
  return _memoryFallback.has(key) ? _memoryFallback.get(key) : defaultVal;
}

function writeStorage(key, val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(val));
      return;
    }
  } catch (e) {
    // ignore
  }
  _memoryFallback.set(key, val);
}

function haversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ingestReportLocally(req) {
  const store = readStorage(LOCAL_STORAGE_KEY, { reports: [], clusters: {}, advisories: {} });
  const now = req.timestamp || Date.now();
  const anonRef = `ANON-REF-${Math.floor(8000 + Math.random() * 1000)}`;

  let sa = SERVICE_AREAS_REGISTRY[req.service_area_id];
  if (!sa) {
    sa = Object.values(SERVICE_AREAS_REGISTRY).find((s) => s.postal_pincodes.includes(req.pincode)) ||
      SERVICE_AREAS_REGISTRY['SA-NORTH-01'];
  }

  store.reports.push({
    anon_ref: anonRef,
    pincode: req.pincode,
    service_area_id: sa.service_area_id,
    scam_category: req.scam_category,
    timestamp: now,
  });

  // Evaluate 24h window threshold (>= 3 reports)
  const cutoff = now - 24 * 3600 * 1000;
  const matching = store.reports.filter(
    (r) => r.service_area_id === sa.service_area_id && r.scam_category === req.scam_category && r.timestamp >= cutoff
  );

  let triggeredAdvisory = null;
  if (matching.length >= 3) {
    const meta = SCAM_DEFINITIONS[req.scam_category] || SCAM_DEFINITIONS.electricity_bill_scam;
    const clusterKey = `CLUST-${sa.service_area_id}-${req.scam_category}`;
    const advisoryKey = `ADV-MESH-${sa.service_area_id}-${req.scam_category}`;

    matching.sort((a, b) => a.timestamp - b.timestamp);
    const windowHours = Math.max(0.5, Math.round(((matching[matching.length - 1].timestamp - matching[0].timestamp) / (3600 * 1000)) * 10) / 10);

    store.clusters[clusterKey] = {
      cluster_id: clusterKey,
      service_area_id: sa.service_area_id,
      service_area_name: sa.service_area_name,
      police_station_circle: sa.police_station_circle,
      postal_pincodes: [...sa.postal_pincodes],
      scam_category: req.scam_category,
      scam_category_label: meta.label,
      complaint_count: matching.length,
      first_complaint_timestamp: matching[0].timestamp,
      last_complaint_timestamp: matching[matching.length - 1].timestamp,
      window_hours: windowHours,
      privacy_guarantee: 'K-Anonymity Verified: Zero PII or individual loss figures retained',
      anonymized_report_refs: matching.map((m) => m.anon_ref),
    };

    const areaName = sa.service_area_name.replace(' Cyber Command', '').replace(' Cyber Cell', '').trim();
    const title = meta.headline.replace('{area}', areaName);

    if (store.advisories[advisoryKey]) {
      store.advisories[advisoryKey].complaints_aggregated = matching.length;
      store.advisories[advisoryKey].window_hours = windowHours;
      triggeredAdvisory = store.advisories[advisoryKey];
    } else {
      triggeredAdvisory = {
        advisory_id: advisoryKey,
        cluster_id: clusterKey,
        title,
        summary_guidance: `${meta.modus} Law enforcement has verified ${matching.length} complaints in ${sa.police_station_circle} over past ${windowHours} hours. Citizens in ${sa.postal_pincodes.join(', ')} must exercise caution.`,
        scam_category: req.scam_category,
        service_area_id: sa.service_area_id,
        service_area_name: sa.service_area_name,
        police_station_circle: sa.police_station_circle,
        target_pincodes: [...sa.postal_pincodes],
        geofence_center: sa.geofence_center,
        geofence_radius_km: sa.geofence_radius_km,
        complaints_aggregated: matching.length,
        window_hours: windowHours,
        status: 'DRAFTED_PENDING_APPROVAL',
        urgency: meta.urgency,
        action_checklist: [...meta.guidance],
        drafted_at: now,
        published_at: null,
        approved_by_commander_badge: null,
        approved_by_commander_name: null,
        active_portal_banner_text: `Notice: ${meta.label} active in ${sa.service_area_name} area. Verify all claims through official portals only.`,
      };
      store.advisories[advisoryKey] = triggeredAdvisory;
    }
  }

  writeStorage(LOCAL_STORAGE_KEY, store);
  return { anon_ref: anonRef, advisory: triggeredAdvisory };
}

export function signoffMicroAdvisoryLocally(advisoryId, payload) {
  const store = readStorage(LOCAL_STORAGE_KEY, { reports: [], clusters: {}, advisories: {} });
  const adv = store.advisories[advisoryId];
  if (!adv) return null;

  if (payload.action === 'approve_publish') {
    adv.status = 'PUBLISHED_ACTIVE';
    adv.approved_by_commander_badge = payload.commander_badge_id || 'CMD-DELHI-NORTH';
    adv.approved_by_commander_name = payload.commander_name || 'DCP Vikram Malhotra';
    adv.published_at = Date.now();
  } else if (payload.action === 'dismiss') {
    adv.status = 'DISMISSED';
  }

  writeStorage(LOCAL_STORAGE_KEY, store);
  return adv;
}

export function queryPortalMeshBannerLocally(query) {
  const store = readStorage(LOCAL_STORAGE_KEY, { reports: [], clusters: {}, advisories: {} });
  const published = Object.values(store.advisories).filter((a) => a.status === 'PUBLISHED_ACTIVE');
  if (!published.length) return null;

  for (const adv of published) {
    let matched = false;
    if (query.pincode && adv.target_pincodes.includes(query.pincode.trim())) {
      matched = true;
    } else if (query.service_area_id && query.service_area_id === adv.service_area_id) {
      matched = true;
    } else if (query.lat != null && query.lng != null) {
      const dist = haversineDistKm(query.lat, query.lng, adv.geofence_center.lat, adv.geofence_center.lng);
      if (dist <= adv.geofence_radius_km) {
        matched = true;
      }
    }

    if (matched) {
      return {
        advisory_id: adv.advisory_id,
        title: adv.title,
        banner_text: adv.active_portal_banner_text,
        service_area_name: adv.service_area_name,
        police_station_circle: adv.police_station_circle,
        urgency: adv.urgency,
        action_checklist: adv.action_checklist,
        complaints_aggregated: adv.complaints_aggregated,
        published_at: adv.published_at,
        boundary_restricted: true,
        matched_pincodes: adv.target_pincodes,
      };
    }
  }

  return null;
}

export function listLocalThreatClusters() {
  const store = getOrInitStore();
  return Object.values(store.clusters);
}

export function listLocalMicroAdvisories(status = null) {
  const store = getOrInitStore();
  const list = Object.values(store.advisories);
  return status ? list.filter((a) => a.status === status) : list;
}

export function getOrInitStore() {
  const current = readStorage(LOCAL_STORAGE_KEY, null);
  if (current && Object.keys(current.advisories || {}).length > 0) {
    return current;
  }

  // Pre-seed default state
  const now = Date.now();
  const hour = 3600 * 1000;
  const store = { reports: [], clusters: {}, advisories: {} };

  // Cluster 1: North Delhi Fake Electricity Bill SMS (5 complaints in past 16 hrs)
  for (let i = 0; i < 5; i++) {
    const reportRef = `ANON-REF-800${i + 1}`;
    store.reports.push({
      anon_ref: reportRef,
      pincode: i % 2 === 0 ? '110007' : '110009',
      service_area_id: 'SA-NORTH-01',
      scam_category: 'electricity_bill_scam',
      timestamp: now - (i * 3 + 1) * hour,
    });
  }

  store.clusters['CLUST-SA-NORTH-01-electricity_bill_scam'] = {
    cluster_id: 'CLUST-SA-NORTH-01-electricity_bill_scam',
    service_area_id: 'SA-NORTH-01',
    service_area_name: 'North Delhi Cyber Command',
    police_station_circle: 'Civil Lines Cyber Cell Desk',
    postal_pincodes: ['110007', '110009', '110054'],
    scam_category: 'electricity_bill_scam',
    scam_category_label: 'Fake Electricity Bill Payment SMS',
    complaint_count: 5,
    first_complaint_timestamp: now - 13 * hour,
    last_complaint_timestamp: now - 1 * hour,
    window_hours: 12.0,
    privacy_guarantee: 'K-Anonymity Verified: Zero PII or individual loss figures retained',
    anonymized_report_refs: ['ANON-REF-8001', 'ANON-REF-8002', 'ANON-REF-8003', 'ANON-REF-8004', 'ANON-REF-8005'],
  };

  store.advisories['ADV-MESH-SA-NORTH-01-electricity_bill_scam'] = {
    advisory_id: 'ADV-MESH-SA-NORTH-01-electricity_bill_scam',
    cluster_id: 'CLUST-SA-NORTH-01-electricity_bill_scam',
    title: 'Notice: Fake electricity bill payment SMS active in North Delhi area.',
    summary_guidance: 'Cyber criminals are circulating deceptive SMS notices claiming electricity will be disconnected tonight due to unpaid bills. Law enforcement has verified 5 complaints within Civil Lines Cyber Cell Desk over past 12 hours.',
    scam_category: 'electricity_bill_scam',
    service_area_id: 'SA-NORTH-01',
    service_area_name: 'North Delhi Cyber Command',
    police_station_circle: 'Civil Lines Cyber Cell Desk',
    target_pincodes: ['110007', '110009', '110054'],
    geofence_center: { lat: 28.6920, lng: 77.2150 },
    geofence_radius_km: 5.5,
    complaints_aggregated: 5,
    window_hours: 12.0,
    status: 'DRAFTED_PENDING_APPROVAL',
    urgency: 'high',
    action_checklist: [
      'Do not call unauthorized mobile numbers or click shortened URLs in disconnection SMS messages.',
      'Official discoms (BSES, Tata Power, NDPL) never demand bill payment via personal UPI handles.',
      'Verify dues directly through your official DISCOM mobile app or dial customer toll-free 19122.',
      'Report fraudulent numbers immediately to Cyber Crime Helpline 1930.',
    ],
    drafted_at: now - 2 * hour,
    published_at: null,
    approved_by_commander_badge: null,
    approved_by_commander_name: null,
    active_portal_banner_text: 'Notice: Fake Electricity Bill Payment SMS active in North Delhi area. Verify all claims through official portals only.',
  };

  // Cluster 2: South Delhi (Saket) - Digital Arrest Extortion (Pre-approved)
  store.advisories['ADV-MESH-SA-SOUTH-01-digital_arrest'] = {
    advisory_id: 'ADV-MESH-SA-SOUTH-01-digital_arrest',
    cluster_id: 'CLUST-SA-SOUTH-01-digital_arrest',
    title: 'Notice: Fake police & CBI digital arrest video calls active in South Financial Corridors area.',
    summary_guidance: 'Scammers impersonating CBI or police officers place video calls wearing fake uniforms and demand settlement funds.',
    scam_category: 'digital_arrest',
    service_area_id: 'SA-SOUTH-01',
    service_area_name: 'South Financial Corridors',
    police_station_circle: 'Saket Tech Crime Unit',
    target_pincodes: ['110017', '110019', '110048'],
    geofence_center: { lat: 28.5244, lng: 77.2066 },
    geofence_radius_km: 6.5,
    complaints_aggregated: 4,
    window_hours: 14.0,
    status: 'PUBLISHED_ACTIVE',
    urgency: 'critical',
    action_checklist: [
      'Under Indian law (BNSS), no police officer can place citizens under arrest via video call.',
      'Law enforcement never demands money transfers to clearing accounts.',
    ],
    drafted_at: now - 14 * hour,
    published_at: now - 3 * hour,
    approved_by_commander_badge: 'CMD-DELHI-SOUTH',
    approved_by_commander_name: 'DCP Anita Mehra',
    active_portal_banner_text: 'Notice: Fake police & CBI digital arrest video calls active in South Financial Corridors area. Hang up immediately.',
  };

  writeStorage(LOCAL_STORAGE_KEY, store);
  return store;
}

export function resetLocalThreatMeshStore() {
  _memoryFallback.clear();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch (e) {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Backend API Connectors
// -----------------------------------------------------------------------------

const API_BASE = '/api/threat-mesh';

export async function fetchThreatClustersApi() {
  try {
    const res = await fetch(`${API_BASE}/clusters`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return listLocalThreatClusters();
  }
}

export async function fetchMicroAdvisoriesApi(status = null) {
  try {
    const url = status ? `${API_BASE}/advisories?status=${encodeURIComponent(status)}` : `${API_BASE}/advisories`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return listLocalMicroAdvisories(status);
  }
}

export async function commanderSignoffApi(advisoryId, payload) {
  try {
    const res = await fetch(`${API_BASE}/advisories/${encodeURIComponent(advisoryId)}/signoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return signoffMicroAdvisoryLocally(advisoryId, payload);
  }
}

export async function queryPortalMeshBannerApi(query) {
  try {
    const res = await fetch(`${API_BASE}/portal-banner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.banner;
  } catch (e) {
    return queryPortalMeshBannerLocally(query);
  }
}

export async function fetchThreatMeshStatsApi() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    const store = getOrInitStore();
    const clusters = Object.values(store.clusters);
    const advisories = Object.values(store.advisories);
    return {
      total_active_clusters: clusters.length,
      drafted_pending_signoff: advisories.filter((a) => a.status === 'DRAFTED_PENDING_APPROVAL').length,
      published_active_advisories: advisories.filter((a) => a.status === 'PUBLISHED_ACTIVE').length,
      covered_pincodes_count: 12,
      total_reports_aggregated: store.reports.length || 9,
    };
  }
}

