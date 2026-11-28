/**
 * kshemOS Citizen Digital Safety Guardian - DOM Heuristic Shield
 *
 * Runs inside web pages to detect unauthorized lookalike banking portals
 * asking for Card PINs, CVVs, NetBanking passwords, or Aadhaar OTPs.
 */

(function () {
  'use strict';

  // 1. Authorized Indian Banking & Government Domain Whitelist
  const LEGITIMATE_DOMAINS = [
    'onlinesbi.sbi',
    'sbi.co.in',
    'hdfcbank.com',
    'icicibank.com',
    'axisbank.com',
    'pnbindia.in',
    'bankofbaroda.in',
    'canarabank.com',
    'kotak.com',
    'indusind.com',
    'yesbank.in',
    'idfcfirstbank.com',
    'unionbankofindia.co.in',
    'uidai.gov.in',
    'myaadhaar.uidai.gov.in',
    'cybercrime.gov.in',
    'incometax.gov.in',
    'epfindia.gov.in',
    'rbi.org.in',
    'npci.org.in',
    'digilocker.gov.in',
    'parivahan.gov.in',
    'localhost',
    '127.0.0.1',
  ];

  const currentHost = window.location.hostname.toLowerCase();

  // If already on an authorized banking domain or extension page, exit immediately
  const isWhitelisted = LEGITIMATE_DOMAINS.some(
    (d) => currentHost === d || currentHost.endsWith('.' + d)
  );
  if (isWhitelisted) {
    return;
  }

  // 2. DOM Field Patterns to Intercept
  const CREDENTIAL_SIGNATURES = {
    card_pin: {
      label: 'ATM / Debit Card PIN',
      patterns: ['pin', 'atm_pin', 'card_pin', 'atm-pin', 'mpin', 'tpin', 'cardpin'],
    },
    cvv: {
      label: 'Card CVV / Security Code',
      patterns: ['cvv', 'cvc', 'security_code', 'card_cvv', 'card-cvv', 'cardcode', 'securitycode'],
    },
    netbanking_pwd: {
      label: 'NetBanking / Profile Password',
      patterns: ['netbanking', 'txn_pwd', 'profile_password', 'profile_pwd', 'login_pwd', 'internet_banking'],
    },
    aadhaar_otp: {
      label: 'Aadhaar Biometric / UIDAI OTP',
      patterns: ['aadhaar_otp', 'uidai_otp', 'adhaar_otp', 'aadhaar.*otp', 'otp.*aadhaar', 'uidai.*code'],
    },
  };

  // 3. Scan DOM for suspicious forms and fields
  function scanPageDOM() {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    const detectedRisks = [];
    const detectedFieldNames = [];

    inputs.forEach((input) => {
      const id = (input.id || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
      const labelText = getAssociatedLabelText(input).toLowerCase();

      const combinedMeta = `${id} ${name} ${placeholder} ${ariaLabel} ${autocomplete} ${labelText}`;
      detectedFieldNames.push(name || id || 'input');

      // Check PIN
      if (CREDENTIAL_SIGNATURES.card_pin.patterns.some((p) => combinedMeta.includes(p))) {
        if (!detectedRisks.includes(CREDENTIAL_SIGNATURES.card_pin.label)) {
          detectedRisks.push(CREDENTIAL_SIGNATURES.card_pin.label);
        }
      }

      // Check CVV
      if (CREDENTIAL_SIGNATURES.cvv.patterns.some((p) => combinedMeta.includes(p))) {
        if (!detectedRisks.includes(CREDENTIAL_SIGNATURES.cvv.label)) {
          detectedRisks.push(CREDENTIAL_SIGNATURES.cvv.label);
        }
      }

      // Check NetBanking Password
      if (CREDENTIAL_SIGNATURES.netbanking_pwd.patterns.some((p) => combinedMeta.includes(p))) {
        if (!detectedRisks.includes(CREDENTIAL_SIGNATURES.netbanking_pwd.label)) {
          detectedRisks.push(CREDENTIAL_SIGNATURES.netbanking_pwd.label);
        }
      }

      // Check Aadhaar OTP
      const hasAadhaarRef = combinedMeta.includes('aadhaar') || combinedMeta.includes('uidai') || combinedMeta.includes('adhaar');
      const hasOtpRef = combinedMeta.includes('otp') || combinedMeta.includes('code') || combinedMeta.includes('auth');
      if (hasAadhaarRef && hasOtpRef) {
        if (!detectedRisks.includes(CREDENTIAL_SIGNATURES.aadhaar_otp.label)) {
          detectedRisks.push(CREDENTIAL_SIGNATURES.aadhaar_otp.label);
        }
      }
    });

    // Check Brand Impersonation In Title or Heading
    const pageTitle = (document.title || '').toLowerCase();
    const bodyText = (document.body ? document.body.innerText.slice(0, 3000) : '').toLowerCase();
    let impersonatedBrand = null;

    if (pageTitle.includes('sbi') || pageTitle.includes('state bank') || bodyText.includes('state bank of india')) {
      impersonatedBrand = 'State Bank of India (SBI)';
    } else if (pageTitle.includes('hdfc') || bodyText.includes('hdfc bank')) {
      impersonatedBrand = 'HDFC Bank';
    } else if (pageTitle.includes('icici') || bodyText.includes('icici bank')) {
      impersonatedBrand = 'ICICI Bank';
    } else if (pageTitle.includes('axis bank') || bodyText.includes('axis bank')) {
      impersonatedBrand = 'Axis Bank';
    } else if (pageTitle.includes('pnb') || bodyText.includes('punjab national bank')) {
      impersonatedBrand = 'Punjab National Bank (PNB)';
    } else if (pageTitle.includes('uidai') || pageTitle.includes('aadhaar') || bodyText.includes('unique identification authority of india')) {
      impersonatedBrand = 'UIDAI (Aadhaar Portal)';
    }

    // Trigger Takeover if sensitive credentials are being requested on an unauthorized domain
    if (detectedRisks.length > 0) {
      triggerTakeoverScreen(detectedRisks, impersonatedBrand);
    }
  }

  function getAssociatedLabelText(input) {
    if (!input) return '';
    let text = '';
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) text += ' ' + label.innerText;
    }
    const parentLabel = input.closest('label');
    if (parentLabel) text += ' ' + parentLabel.innerText;
    return text.trim();
  }

  // 4. Inject High-Visibility Red Takeover Screen
  function triggerTakeoverScreen(detectedRisks, impersonatedBrand) {
    if (document.getElementById('kshemos-phish-takeover-overlay')) return; // Avoid duplicates

    const overlay = document.createElement('div');
    overlay.id = 'kshemos-phish-takeover-overlay';
    overlay.className = 'kshemos-takeover-container';

    const brandNotice = impersonatedBrand
      ? `<div class="kshemos-takeover-brand">Target Impersonated: <strong>${impersonatedBrand}</strong></div>`
      : '';

    const risksListHtml = detectedRisks
      .map((r) => `<span class="kshemos-risk-pill">⚠️ ${r}</span>`)
      .join('');

    const killswitchUrl = `http://localhost:5173/?view=emergency-killswitch&suspect_domain=${encodeURIComponent(
      currentHost
    )}&brand=${encodeURIComponent(impersonatedBrand || 'Unknown')}`;

    overlay.innerHTML = `
      <div class="kshemos-takeover-modal">
        <div class="kshemos-takeover-header">
          <div class="kshemos-shield-icon">🚨</div>
          <div>
            <div class="kshemos-badge">KSHEMOS CITIZEN GUARDIAN // THREAT DEFENSE SHIELD</div>
            <h1 class="kshemos-takeover-title">Warning: Fake Bank Portal Detected by kshemOS</h1>
          </div>
        </div>

        <div class="kshemos-takeover-body">
          <p class="kshemos-takeover-lead">
            This untrusted website (<strong>${currentHost}</strong>) is not an official banking domain,
            yet it is requesting your confidential authentication credentials.
          </p>

          ${brandNotice}

          <div class="kshemos-takeover-risks">
            <div class="kshemos-risks-label">INTERCEPTED SENSITIVE FIELDS:</div>
            <div class="kshemos-pills-row">${risksListHtml}</div>
          </div>

          <div class="kshemos-warning-box">
            Official Indian banks and government portals <strong>NEVER</strong> request Card PINs, CVVs,
            or Aadhaar OTPs on third-party web domains. Entering data on this page will expose your bank account to immediate unauthorized theft.
          </div>
        </div>

        <div class="kshemos-takeover-actions">
          <a href="${killswitchUrl}" target="_blank" id="kshemos-btn-killswitch" class="kshemos-btn-primary">
            ⚡ ACTIVATE EMERGENCY KILL-SWITCH (Freeze Cards & Lock Aadhaar)
          </a>
          <button type="button" id="kshemos-btn-close-tab" class="kshemos-btn-secondary">
            🛑 Close Suspicious Tab Immediately
          </button>
          <button type="button" id="kshemos-btn-dismiss" class="kshemos-btn-dismiss">
            I understand the risk (Dismiss overlay)
          </button>
        </div>

        <div class="kshemos-takeover-footer">
          <span>Official National Cyber Crime Helpline: <strong>1930</strong></span>
          <span>AePS Instant Kill-Switch: <strong>*99*99*1#</strong></span>
          <span>Verified by kshemOS Takedown Mesh</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire action buttons
    document.getElementById('kshemos-btn-close-tab').addEventListener('click', () => {
      try {
        window.close();
      } catch {
        window.location.href = 'about:blank';
      }
      try {
        chrome.runtime.sendMessage({ action: 'CLOSE_CURRENT_TAB' });
      } catch {}
    });

    document.getElementById('kshemos-btn-dismiss').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    // Notify background worker of detected phishing
    try {
      chrome.runtime.sendMessage({
        action: 'PHISHING_PORTAL_DETECTED',
        data: {
          hostname: currentHost,
          url: window.location.href,
          detectedRisks,
          impersonatedBrand,
        },
      });
    } catch {}
  }

  // 5. Initial Scan & Mutation Observer (for dynamic Single Page Apps)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanPageDOM);
  } else {
    scanPageDOM();
  }

  // Re-scan if forms are dynamically rendered
  let timeoutId = null;
  const observer = new MutationObserver(() => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(scanPageDOM, 1000);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
