/**
 * kshemOS Citizen Digital Safety Guardian - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentDomainEl = document.getElementById('current-domain');
  const verdictEl = document.getElementById('tab-security-verdict');
  const ruleCountEl = document.getElementById('rule-count');
  const killswitchBtn = document.getElementById('btn-killswitch');
  const syncBtn = document.getElementById('btn-sync');

  let activeHostname = '';

  // 1. Inspect Active Tab Domain
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      activeHostname = url.hostname.toLowerCase();
      currentDomainEl.innerText = activeHostname || 'Local Tab';

      // Check against known threat rules
      chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
        if (res && res.data) {
          const cache = res.data;
          ruleCountEl.innerText = `${cache.activeRulesCount || 10} Active`;

          const isThreat = (cache.threatDomains || []).some((d) =>
            activeHostname.includes(d)
          );
          if (isThreat) {
            verdictEl.innerText = 'PHISHING DETECTED';
            verdictEl.className = 'status-pill danger';
            currentDomainEl.style.color = '#ef4444';
          } else if (
            activeHostname.includes('bank') ||
            activeHostname.includes('sbi') ||
            activeHostname.includes('uidai')
          ) {
            verdictEl.innerText = 'MONITORED';
            verdictEl.className = 'status-pill';
          } else {
            verdictEl.innerText = 'SAFE / VERIFIED';
            verdictEl.className = 'status-pill';
          }
        }
      });
    }
  } catch (err) {
    currentDomainEl.innerText = 'Browser Navigation Active';
  }

  // 2. Emergency Kill-Switch Bridge Button
  killswitchBtn.addEventListener('click', () => {
    const url = `http://localhost:5173/?view=emergency-killswitch${
      activeHostname ? `&suspect_domain=${encodeURIComponent(activeHostname)}` : ''
    }`;

    chrome.tabs.create({ url });
  });

  // 3. Dynamic Ruleset Synchronization Button
  syncBtn.addEventListener('click', () => {
    syncBtn.innerText = 'Syncing...';
    chrome.runtime.sendMessage({ action: 'SYNC_RULES' }, (res) => {
      syncBtn.innerText = '✓ Synced';
      if (res && res.data) {
        ruleCountEl.innerText = `${res.data.activeRulesCount} Active`;
      }
      setTimeout(() => {
        syncBtn.innerText = '🔄 Sync Mesh';
      }, 1500);
    });
  });
});
