import { useState, useMemo } from 'react';

const TOOLBOX_ITEMS = [
  // === Original 15 tools ===
  { key: 'qr-guardian', title: 'QR Guardian', description: 'Inspect QR payment requests for suspicious UPI ids, merchant impersonation, and risky links.', accent: 'var(--saffron)' },
  { key: 'link-shield', title: 'LinkShield', description: 'Check URLs for typosquatting, HTTPS issues, and common phishing patterns.', accent: 'var(--navy)' },
  { key: 'sms-analyzer', title: 'SMS Analyzer', description: 'Review SMS messages for urgency, payment pressure, and scam links.', accent: 'var(--alert)' },
  { key: 'phish-detect', title: 'PhishDetect', description: 'Analyze suspicious emails for spoofed senders, aggressive subjects, and risky links.', accent: 'var(--safe)' },
  { key: 'upi-fraud-shield', title: 'UPI Fraud Shield', description: 'Evaluate UPI payments for odd amounts, suspect handles, and unusual reasons.', accent: 'var(--caution)' },
  { key: 'mule-freeze', title: 'UPI Mule Freeze (1930)', description: 'Fast-track Section 102 CrPC provisional debit freeze mandates and CFCFRMS dispatch.', accent: 'var(--alert)' },
  { key: 'money-trail', title: 'Money Trail & Hop Reconstructor', description: 'Reconstruct multi-hop money flow graph, pinpoint Mule Hubs, and generate Section 102 CrPC attachment schedules.', accent: 'var(--saffron)' },
  { key: 'job-scam-radar', title: 'JobScam Radar', description: 'Spot fake job offers that ask for upfront fees or pressure you to act fast.', accent: 'var(--saffron)' },
  { key: 'invest-scan', title: 'InvestScan', description: 'Flag investment pitches with guaranteed returns and Ponzi-style pressure.', accent: 'var(--navy)' },
  { key: 'loan-trap-alert', title: 'LoanTrap Alert', description: 'Review loan offers for fake approvals, processing fees, and payment demands.', accent: 'var(--alert)' },
  { key: 'courier-guard', title: 'CourierGuard', description: 'Check parcel alerts for customs or courier impersonation and release fees.', accent: 'var(--safe)' },
  { key: 'id-shield', title: 'IDShield', description: 'Assess requests for Aadhaar, PAN, or other identity numbers and OTPs.', accent: 'var(--caution)' },
  { key: 'pass-strength-pro', title: 'PassStrength Pro', description: 'Test password strength for common patterns and weak complexity.', accent: 'var(--saffron)' },
  { key: 'social-eng-shield', title: 'SocialEng Shield', description: 'Identify social engineering tactics such as secrecy and authority pressure.', accent: 'var(--navy)' },
  { key: 'otp-guard', title: 'OTP Guard', description: 'Warn about OTP harvesting and SIM-swap style requests.', accent: 'var(--alert)' },
  { key: 'web-safe-analyzer', title: 'WebSafe Analyzer', description: 'Evaluate browsing context and public Wi-Fi risk before transacting online.', accent: 'var(--safe)' },
  { key: 'cyber-case-builder', title: 'CyberCase Builder', description: 'Organize incident details and evidence for fast reporting and escalation.', accent: 'var(--caution)' },
  // === Phase 1: 21 existing JS features with new views ===
  { key: 'browser-permission-abuse', title: 'Browser Permission Abuse', description: 'Audit which sensitive browser permissions are enabled.', accent: 'var(--saffron)' },
  { key: 'clipboard-hijack', title: 'Clipboard Hijack Detector', description: 'Check clipboard content for sensitive stolen data like OTPs.', accent: 'var(--navy)' },
  { key: 'screen-sharing-safety', title: 'Screen Sharing Safety', description: 'Assess screen sharing risks for sensitive content exposure.', accent: 'var(--alert)' },
  { key: 'webcam-mic-auditor', title: 'Webcam & Mic Auditor', description: 'Audit camera and microphone access permissions.', accent: 'var(--safe)' },
  { key: 'extension-trust-analyzer', title: 'Extension Trust Analyzer', description: 'Evaluate browser extension safety based on permissions and publisher.', accent: 'var(--caution)' },
  { key: 'fake-document-verifier', title: 'Fake Document Verifier', description: 'Check documents for fake watermarks and suspicious language.', accent: 'var(--saffron)' },
  { key: 'invoice-fraud-detector', title: 'Invoice Fraud Detector', description: 'Spot fake invoices using urgency and non-standard payment methods.', accent: 'var(--navy)' },
  { key: 'digital-identity-exposure', title: 'Digital Identity Exposure', description: 'Assess how exposed your identity is from leaks and public profiles.', accent: 'var(--alert)' },
  { key: 'scam-psychology-analyzer', title: 'Scam Psychology Analyzer', description: 'Understand how scams use urgency, reward, authority, and secrecy.', accent: 'var(--safe)' },
  { key: 'emotional-manipulation-detector', title: 'Emotional Manipulation Detector', description: 'Detect fear, guilt, empathy, and flattery manipulation in messages.', accent: 'var(--caution)' },
  { key: 'financial-urgency-detector', title: 'Financial Urgency Detector', description: 'Flag high-pressure financial demands with fake deadlines.', accent: 'var(--saffron)' },
  { key: 'conversation-pressure-meter', title: 'Conversation Pressure Meter', description: 'Measure pressure tactics like repetition, interruptions, and blame.', accent: 'var(--navy)' },
  { key: 'authority-impersonation-detector', title: 'Authority Impersonation Detector', description: 'Detect fake government, bank, or police impersonation attempts.', accent: 'var(--alert)' },
  { key: 'reward-temptation-analyzer', title: 'Reward Temptation Analyzer', description: 'Spot reward-based bait like prizes, cashback, and bonuses.', accent: 'var(--safe)' },
  { key: 'cyber-incident-impact', title: 'Cyber Incident Impact Calculator', description: 'Calculate incident severity based on data loss and financial risk.', accent: 'var(--caution)' },
  { key: 'device-security-checklist', title: 'Device Security Checklist', description: 'Run through fundamental device security checks.', accent: 'var(--saffron)' },
  { key: 'privacy-exposure-scanner', title: 'Privacy Exposure Scanner', description: 'Check how much personal info is exposed through public profiles.', accent: 'var(--navy)' },
  { key: 'fake-social-profile-inspector', title: 'Fake Social Profile Inspector', description: 'Spot fake social media profiles based on trust signals.', accent: 'var(--alert)' },
  { key: 'suspicious-username-analyzer', title: 'Suspicious Username Analyzer', description: 'Check if a username uses authority or reward bait words.', accent: 'var(--safe)' },
  { key: 'fake-giveaway-detector', title: 'Fake Giveaway Detector', description: 'Spot fake giveaways requiring payment or engagement.', accent: 'var(--caution)' },
  { key: 'subscription-fraud-checker', title: 'Subscription Fraud Checker', description: 'Check subscription plans for auto-renewal traps and free trial tricks.', accent: 'var(--saffron)' },
  // === Phase 2B: 24 brand new cyber features ===
  { key: 'scam-persuasion-breakdown', title: 'Scam Persuasion Breakdown', description: 'Analyze which Cialdini persuasion techniques a scam uses.', accent: 'var(--navy)' },
  { key: 'marketplace-fraud-evaluator', title: 'Marketplace Fraud Evaluator', description: 'Evaluate online marketplace listings for fraud signals.', accent: 'var(--alert)' },
  { key: 'delivery-scam-predictor', title: 'Delivery Scam Predictor', description: 'Predict delivery scams based on customs threats and payment requests.', accent: 'var(--safe)' },
  { key: 'travel-booking-fraud-detector', title: 'Travel Booking Fraud Detector', description: 'Check travel bookings for OTP requests and non-standard payments.', accent: 'var(--caution)' },
  { key: 'rental-scam-checker', title: 'Rental Scam Checker', description: 'Spot rental scams with advance fees and overseas landlord claims.', accent: 'var(--saffron)' },
  { key: 'charity-fraud-evaluator', title: 'Charity Fraud Evaluator', description: 'Verify charity registration and spot emotional urgency tactics.', accent: 'var(--navy)' },
  { key: 'crowdfunding-legitimacy-checker', title: 'Crowdfunding Legitimacy Checker', description: 'Check campaign verification and off-platform payment requests.', accent: 'var(--alert)' },
  { key: 'digital-inheritance-safety', title: 'Digital Inheritance Safety', description: 'Plan digital asset transfer with wills and executor assignments.', accent: 'var(--safe)' },
  { key: 'family-cyber-safety', title: 'Family Cyber Safety', description: 'Assess household cyber rules, parental controls, and emergency plans.', accent: 'var(--caution)' },
  { key: 'senior-protection-mode', title: 'Senior Protection Mode', description: 'Protect seniors from family emergency scams and authority impersonation.', accent: 'var(--saffron)' },
  { key: 'student-scam-awareness', title: 'Student Scam Awareness', description: 'Check job offers, scholarships, and internships for fraud signals.', accent: 'var(--navy)' },
  { key: 'children-online-safety', title: "Children's Online Safety", description: 'Assess parental controls, content filters, and safe search settings.', accent: 'var(--alert)' },
  { key: 'fake-government-notice-verifier', title: 'Fake Government Notice Verifier', description: 'Verify tax, customs, and regulatory notices for authenticity.', accent: 'var(--safe)' },
  { key: 'legal-notice-authenticity-checker', title: 'Legal Notice Authenticity Checker', description: 'Check legal notices for intimidation, missing case numbers, and payment demands.', accent: 'var(--caution)' },
  { key: 'digital-document-consistency', title: 'Digital Document Consistency', description: 'Compare claimed vs actual document content for tampering.', accent: 'var(--saffron)' },
  { key: 'payment-receipt-authenticity', title: 'Payment Receipt Authenticity', description: 'Analyze receipts for missing IDs, refund bait, and unofficial methods.', accent: 'var(--navy)' },
  { key: 'screenshot-metadata-inspector', title: 'Screenshot Metadata Inspector', description: 'Check screenshots for GPS, device info, and visible credentials.', accent: 'var(--alert)' },
  { key: 'account-takeover-estimator', title: 'Account Takeover Estimator', description: 'Estimate takeover risk based on MFA, password, and breach status.', accent: 'var(--safe)' },
  { key: 'mfa-readiness-checker', title: 'MFA Readiness Checker', description: 'Evaluate multi-factor authentication across all accounts.', accent: 'var(--caution)' },
  { key: 'personal-cyber-hygiene', title: 'Personal Cyber Hygiene', description: 'Score your cyber hygiene habits from password manager to OTP safety.', accent: 'var(--saffron)' },
  { key: 'scam-resilience-assessment', title: 'Scam Resilience Assessment', description: 'Assess resilience against phishing, OTP sharing, and social engineering.', accent: 'var(--navy)' },
  { key: 'cyber-preparedness-report', title: 'Cyber Preparedness Report', description: 'Generate a preparedness report for handling cyber incidents.', accent: 'var(--alert)' },
  { key: 'digital-trust-score', title: 'Digital Trust Score', description: 'Calculate trustworthiness of an online account or profile.', accent: 'var(--safe)' },
  { key: 'online-reputation-safety', title: 'Online Reputation Safety', description: 'Detect impersonation, doxxing, and fake profiles affecting reputation.', accent: 'var(--caution)' },
  { key: 'dpdp-redaction', title: 'DPDP Act Redaction & Identity Masking', description: 'Detect, mask, and tokenize citizen identifiers (Aadhaar, PAN, Bank accounts) with supervisory unmask workflows.', accent: 'var(--saffron)' },
  { key: 'evidence-affidavit-compiler', title: 'Section 63 BSA Affidavit Compiler', description: 'Compile court-ready electronic evidence certificates with SHA-256 hashes, Stratum 1 NTP records, and dual-officer declarations.', accent: 'var(--saffron)' },
  { key: 'cli-spoof-detector', title: 'CLI Spoof & SIM Box Detector', description: 'Cross-reference caller ID metadata, TRAI numbering plans, and VoIP gateways to detect spoofed calls.', accent: 'var(--saffron)' },
  { key: 'voice-deepfake', title: 'Voice Deepfake & Audio Detector', description: 'Analyze pitch jitter, amplitude shimmer, neural vocoder artifacts, and receive reverse verification guidance for cloned voices.', accent: 'var(--saffron)' },
  { key: 'syndicate-triage', title: 'Syndicate & APK Triage', description: 'Extract WhatsApp/Telegram syndicate recruitment groups, admin numbers, crypto wallets, and APK trojan permissions.', accent: 'var(--alert)' },
  { key: 'regional-threat-mesh', title: 'Regional Threat Mesh & Advisories', description: 'Localized geofenced threat alerts aggregated by pin code and circle with commander sign-off.', accent: 'var(--safe)' },
];

function ToolCard({ item, index, setActiveView }) {
  const delay = (index % 12) * 60;
  return (
    <div
      className="group rounded-3xl border border-[var(--paper-line)] bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[var(--saffron)]/40 animate-fade-up cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => setActiveView(item.key)}
    >
      <div className="text-[11px] font-mono uppercase tracking-[0.3em]" style={{ color: item.accent }}>
        Safety tool
      </div>
      <h3 className="mt-2 font-display text-xl font-semibold text-[var(--ink)] group-hover:text-[var(--saffron)] transition-colors duration-200">
        {item.title}
      </h3>
      <p className="mt-2 text-sm text-[var(--ink-text)]/70">{item.description}</p>
      <div className="mt-4 flex justify-between items-center">
        <span className="text-xs font-mono text-[var(--ink-text)]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Click to open →
        </span>
        <div className="h-8 w-8 rounded-full bg-[var(--ink)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:scale-110">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7" /><path d="M7 7h10v10" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function CyberToolboxPage({ setActiveView }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return TOOLBOX_ITEMS;
    const q = search.toLowerCase();
    return TOOLBOX_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 w-full">
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.25em] font-semibold text-[var(--saffron)]">Cyber Toolbox</div>
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)] leading-tight">All protection tools in one place</h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base text-[var(--ink-text)]/75 leading-relaxed">
          Pick the scenario that matches what you need to check and open the relevant safety tool.
        </p>

        {/* Search bar */}
        <div className="relative mt-5 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--mist)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools by name or keyword…"
            className="w-full rounded-2xl border border-[var(--paper-line)] bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] focus:border-transparent transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--mist)] hover:text-[var(--ink)]"
            >
              ✕
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-[var(--ink-text)]/40 font-mono">
          {filtered.length} of {TOOLBOX_ITEMS.length} tools
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--paper-line)] p-12 text-center">
          <p className="text-sm text-[var(--ink-text)]/50 font-mono">No tools match "{search}"</p>
          <button onClick={() => setSearch('')} className="mt-3 text-sm text-[var(--saffron)] underline">Clear search</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item, index) => (
            <ToolCard key={item.key} item={item} index={index} setActiveView={setActiveView} />
          ))}
        </div>
      )}
    </div>
  );
}
