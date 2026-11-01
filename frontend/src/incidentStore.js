/*
 * Live incident feed for the Operational Incident Dashboard.
 *
 * Uses the FastAPI backend (`/api/incidents`) when it is reachable so every
 * officer sees the same incidents. When it is not, falls back to this
 * browser's localStorage so the app still works without a backend — in that
 * mode the feed is shared across tabs on this device only.
 */
import { analyzeScamTranscript } from './ruleEngine.js';
import { applyIncidentUpdate, createIncident, defaultStaffing, REGIONS } from './incidentDashboard.js';

const BASE_URL = import.meta.env?.VITE_API_URL || '';

const INCIDENTS_KEY = 'kshemos.incidents.v1';
const STAFFING_KEY = 'kshemos.staffing.v1';

// Fired on `window` after a local write, so other components in this tab refresh.
// Other tabs hear about it through the browser's `storage` event.
export const INCIDENTS_CHANGED_EVENT = 'kshemos:incidents-changed';

// After the backend fails, use local storage for this long before trying it again.
const BACKEND_RETRY_MS = 30 * 1000;

let backendDownUntil = 0;

async function backendRequest(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  // A static host without the API answers with index.html, not JSON.
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    throw Object.assign(new Error('Incident backend is not available'), { unavailable: true });
  }
  const body = await res.json();
  if (!res.ok) {
    const message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body);
    throw Object.assign(new Error(message), { status: res.status });
  }
  return body;
}

// Only used for the feed and create calls: there a 404 means this server has no
// incidents API (another app on the port, or an older backend), not a missing incident.
const UNAVAILABLE_STATUSES = [404, 502, 503, 504];

function isUnavailable(error) {
  // fetch rejects with a TypeError when the server cannot be reached at all.
  return error.unavailable || error instanceof TypeError || UNAVAILABLE_STATUSES.includes(error.status);
}

async function withBackend(remote, local) {
  if (Date.now() >= backendDownUntil) {
    try {
      const result = await remote();
      backendDownUntil = 0;
      return { ...result, source: 'backend' };
    } catch (error) {
      if (!isUnavailable(error)) throw error;
      backendDownUntil = Date.now() + BACKEND_RETRY_MS;
    }
  }
  return { ...local(), source: 'local' };
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw in private mode or with storage blocked.
  }
}

export function createLocalIncidentStore(storage = safeLocalStorage(), { notify = () => {} } = {}) {
  function read(key, fallback) {
    try {
      const raw = storage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      throw new Error('Could not save to browser storage');
    }
    notify();
  }

  function incidents() {
    return read(INCIDENTS_KEY, []);
  }

  function staffing() {
    const saved = read(STAFFING_KEY, []);
    return defaultStaffing().map((s) => saved.find((x) => x.region === s.region) || s);
  }

  return {
    feed() {
      return { regions: REGIONS, staffing: staffing(), incidents: incidents() };
    },

    create(input, now = Date.now()) {
      const all = incidents();
      const next = all.reduce((max, i) => Math.max(max, Number(i.id.replace(/\D/g, '')) || 0), 0) + 1;
      const severity = analyzeScamTranscript(input.description || '').risk_band;
      const incident = createIncident(input, { id: `INC-L${String(next).padStart(4, '0')}`, severity, now });
      write(INCIDENTS_KEY, [...all, incident]);
      return incident;
    },

    update(id, changes, now = Date.now()) {
      const all = incidents();
      const current = all.find((i) => i.id === id);
      if (!current) throw new Error('Incident not found');
      const updated = applyIncidentUpdate(current, changes, now);
      write(INCIDENTS_KEY, all.map((i) => (i.id === id ? updated : i)));
      return updated;
    },

    setStaffing(region, officersOnDuty) {
      if (!REGIONS.includes(region)) throw new Error('Unknown region');
      write(
        STAFFING_KEY,
        staffing().map((s) => (s.region === region ? { region, officers_on_duty: officersOnDuty } : s))
      );
      return { region, officers_on_duty: officersOnDuty };
    },
  };
}

const local = createLocalIncidentStore(undefined, {
  notify: () => globalThis.dispatchEvent?.(new Event(INCIDENTS_CHANGED_EVENT)),
});

export function fetchIncidentFeed() {
  return withBackend(() => backendRequest('/api/incidents'), () => local.feed());
}

export async function recordIncident(input) {
  const { source, ...incident } = await withBackend(
    () => backendRequest('/api/incidents', { method: 'POST', body: JSON.stringify(input) }),
    () => local.create(input)
  );
  return { incident, source };
}

// `source` is where the incident was read from, so a change made while the
// backend is offline is not sent to a server that has never seen the incident.
export async function updateIncident(id, changes, source) {
  if (source === 'local') return local.update(id, changes);
  return backendRequest(`/api/incidents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export async function setRegionStaffing(region, officersOnDuty, source) {
  if (source === 'local') return local.setStaffing(region, officersOnDuty);
  return backendRequest(`/api/incidents/staffing/${encodeURIComponent(region)}`, {
    method: 'PUT',
    body: JSON.stringify({ officers_on_duty: officersOnDuty }),
  });
}
