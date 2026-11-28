# kshemOS Citizen Digital Safety Guardian Browser Extension

A Manifest V3 browser extension providing real-time client-side protection against fake bank portals, credential harvesters, and Aadhaar OTP phishing. Backed by kshemOS's live Takedown Database and Regional Threat Mesh.

## Key Features

1. **Manifest V3 Dynamic Blocking**:
   - `declarativeNetRequest` rules compiled dynamically from kshemOS's active takedown database and regional threat mesh (`/api/extension/rules`).
   - Automatically drops connections to known phishing domains before network requests leave the browser.

2. **DOM Heuristic Shield**:
   - Analyzes DOM input fields in real time for sensitive Indian banking patterns:
     - ATM / Debit Card PINs
     - Card CVV / CVC numbers
     - NetBanking login & transaction passwords
     - Aadhaar / UIDAI OTP verification fields
   - If detected on an unauthorized, non-bank domain, triggers an immediate high-visibility red takeover screen: **"Warning: Fake Bank Portal Detected by kshemOS"**.

3. **Emergency Kill-Switch Bridge**:
   - Dedicated toolbar button that links directly to the local `EmergencyKillSwitchView.jsx` (`http://localhost:5173/?view=emergency-killswitch`) to freeze cards and lock Aadhaar biometrics if the user suspects they were deceived.
   - Pre-fills the suspect domain and impersonated brand into the mitigation receipt context.

## Installation Instructions

1. Open Google Chrome, Microsoft Edge, or Brave Browser.
2. Navigate to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer Mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked**.
5. Select the `kshemOS/frontend-extension` directory.
6. The extension is now active and monitoring all browser tabs for fraudulent banking portals.
