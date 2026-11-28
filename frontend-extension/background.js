/**
 * kshemOS Citizen Digital Safety Guardian - Background Service Worker (Manifest V3)
 *
 * Synchronizes dynamic declarativeNetRequest rules from kshemOS Takedown Database
 * and handles Emergency Kill-Switch navigation bridges.
 */

const API_BASE = 'http://localhost:8000/api/extension';
const FALLBACK_API_BASE = 'http://127.0.0.1:8000/api/extension';
const KILLSWITCH_FRONTEND_URL = 'http://localhost:5173/?view=emergency-killswitch';

// Cache of active threat domains
let _threatCache = {
  activeRulesCount: 10,
  lastSyncTime: Date.now(),
  threatDomains: [],
};

// 1. Synchronize DeclarativeNetRequest Rules from kshemOS Backend
async function syncDeclarativeRules() {
  let data = null;

  try {
    const res = await fetch(`${API_BASE}/rules`);
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    try {
      const resFallback = await fetch(`${FALLBACK_API_BASE}/rules`);
      if (resFallback.ok) {
        data = await resFallback.json();
      }
    } catch (fallbackErr) {
      console.warn('[kshemOS Guardian] Backend unreachable, retaining static ruleset.');
    }
  }

  if (data && data.rules) {
    _threatCache.activeRulesCount = data.total_rules;
    _threatCache.lastSyncTime = Date.now();
    _threatCache.threatDomains = data.active_threat_domains || [];

    // Dynamically update Chrome declarativeNetRequest rules
    try {
      const currentDynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = currentDynamicRules.map((r) => r.id);

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: data.rules,
      });

      console.log(`[kshemOS Guardian] Synced ${data.rules.length} dynamic blocking rules.`);
    } catch (dnrErr) {
      console.error('[kshemOS Guardian] Failed to update declarative rules:', dnrErr);
    }
  }

  // Save state to chrome storage
  try {
    await chrome.storage.local.set({
      threatCache: _threatCache,
      lastSync: Date.now(),
    });
  } catch {}

  return _threatCache;
}

// 2. Lifecycle Events
chrome.runtime.onInstalled.addListener(() => {
  console.log('[kshemOS Guardian] Extension installed.');
  syncDeclarativeRules();
});

chrome.runtime.onStartup.addListener(() => {
  syncDeclarativeRules();
});

// Periodic background sync every 30 minutes
if (chrome.alarms) {
  chrome.alarms.create('kshemos_threat_sync', { periodInMinutes: 30 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'kshemos_threat_sync') {
      syncDeclarativeRules();
    }
  });
}

// 3. Message Dispatcher
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_KILLSWITCH') {
    const suspectDomain = request.suspectDomain || '';
    const brand = request.brand || '';
    const url = `${KILLSWITCH_FRONTEND_URL}${
      suspectDomain ? `&suspect_domain=${encodeURIComponent(suspectDomain)}` : ''
    }${brand ? `&brand=${encodeURIComponent(brand)}` : ''}`;

    chrome.tabs.create({ url }, (tab) => {
      sendResponse({ status: 'OPENED', tabId: tab.id });
    });
    return true;
  }

  if (request.action === 'CLOSE_CURRENT_TAB') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    sendResponse({ status: 'CLOSED' });
    return true;
  }

  if (request.action === 'SYNC_RULES') {
    syncDeclarativeRules().then((result) => {
      sendResponse({ status: 'SYNCED', data: result });
    });
    return true;
  }

  if (request.action === 'GET_STATUS') {
    chrome.storage.local.get(['threatCache'], (result) => {
      const cache = result.threatCache || _threatCache;
      sendResponse({ status: 'OK', data: cache });
    });
    return true;
  }

  if (request.action === 'PHISHING_PORTAL_DETECTED') {
    console.warn('[kshemOS Guardian Alert] Phishing portal detected:', request.data);
    // Optionally create badge or notification
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '!', tabId: sender.tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: sender.tab?.id });
    }
    sendResponse({ status: 'ACKNOWLEDGED' });
    return true;
  }
});
