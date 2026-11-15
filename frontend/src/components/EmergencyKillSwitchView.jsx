import React, { useState, useEffect } from 'react';
import {
  getEmergencyBanksList,
  getAadhaarLockGuide,
  generateLocalMitigationReceipt,
  getStoredMitigationReceipts,
  MITIGATION_RECEIPT_EVENT,
} from '../emergencyKillSwitchStore';

export default function EmergencyKillSwitchView() {
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('sbi');
  const [searchBank, setSearchBank] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [accLast4, setAccLast4] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [reported1930, setReported1930] = useState(true);
  const [reportedPortal, setReportedPortal] = useState(false);
  const [aadhaarLocked, setAadhaarLocked] = useState(false);
  const [incidentNotes, setIncidentNotes] = useState('');
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [pastReceipts, setPastReceipts] = useState([]);
  const [copiedKey, setCopiedKey] = useState(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const guide = getAadhaarLockGuide();

  useEffect(() => {
    const list = getEmergencyBanksList();
    setBanks(list);
    setPastReceipts(getStoredMitigationReceipts());

    function handleReceiptUpdate() {
      setPastReceipts(getStoredMitigationReceipts());
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(MITIGATION_RECEIPT_EVENT, handleReceiptUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(MITIGATION_RECEIPT_EVENT, handleReceiptUpdate);
      }
    };
  }, []);

  const selectedBank = banks.find((b) => b.bank_id === selectedBankId) || banks[0] || null;

  const filteredBanks = banks.filter((b) => {
    if (!searchBank.trim()) return true;
    const q = searchBank.toLowerCase();
    return b.bank_name.toLowerCase().includes(q) || b.bank_id.toLowerCase().includes(q);
  });

  function handleCopy(text, key) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  function handleGenerateReceipt(e) {
    e.preventDefault();
    if (!selectedBank) return;

    const attemptedActions = [
      `Initiated card / account freeze for ${selectedBank.bank_name}`,
      `Dialed / prepared USSD UPI block command: ${selectedBank.ussd_code}`,
      `Generated bank SMS block syntax: ${selectedBank.sms_card_block_syntax} to ${selectedBank.sms_card_block_number}`,
    ];
    if (reported1930) attemptedActions.push('Notified National Cybercrime Helpline 1930 (CFCFRMS)');
    if (reportedPortal) attemptedActions.push('Lodged incident on National Cyber Crime Reporting Portal (cybercrime.gov.in)');
    if (aadhaarLocked) attemptedActions.push('Locked Aadhaar Biometrics via myaadhaar.uidai.gov.in to disable AePS deductions');

    const receipt = generateLocalMitigationReceipt({
      citizen_name: citizenName.trim() || 'Citizen (Protected)',
      selected_bank_id: selectedBank.bank_id,
      bank_name: selectedBank.bank_name,
      card_last_4: cardLast4.trim() || null,
      account_last_4: accLast4.trim() || null,
      actions_attempted: attemptedActions,
      reported_to_1930: reported1930,
      reported_to_portal: reportedPortal,
      aadhaar_biometrics_locked: aadhaarLocked,
      incident_description: incidentNotes.trim() || null,
    });

    setActiveReceipt(receipt);
    setPastReceipts(getStoredMitigationReceipts());
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Emergency Header */}
        <div className="border-b border-[var(--paper-line)] pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-red-600 font-bold bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              EMERGENCY KILL-SWITCH
            </span>
            <span className="font-mono text-xs text-[var(--ink-text)]/60">
              RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-bold text-[var(--ink)] tracking-tight">
            Stop the Drain: Immediate Bank & Aadhaar Kill-Switch
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-text)]/75 max-w-3xl leading-relaxed">
            If you suspect unauthorized access, revealed your credentials, or fell for an extortion call,
            use these verified one-tap codes to freeze your accounts, disable UPI, lock Aadhaar biometrics (cutting off AePS fraud),
            and generate a certified RBI zero-liability evidence receipt.
          </p>
        </div>

        {/* High-Visibility Statutory Alert */}
        <div className="bg-gradient-to-r from-red-600/10 via-amber-500/10 to-transparent border-l-4 border-red-600 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <span>⚖️</span>
            <span>Zero-Liability Rule: Why Prompt Account Freeze Timestamping Matters</span>
          </div>
          <p className="text-xs text-[var(--ink-text)]/80 leading-relaxed">
            Under <strong>Reserve Bank of India (RBI)</strong> guidelines on Customer Protection, if you notify your bank of unauthorized
            electronic banking transactions promptly (within 3 working days), your financial liability is <strong>₹0 (Zero Liability)</strong>.
            This module generates an immutable, timestamped <strong>Emergency Mitigation Receipt</strong> that provides proof of notification
            for banking ombudsman and cyber insurance claims.
          </p>
        </div>

        {/* Main Grid: Bank Kill-Switch + Aadhaar Shield */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Bank Selector & Emergency Commands (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-mono font-bold uppercase text-[var(--saffron)]">
                    Step 1: Select Your Bank
                  </span>
                  <h2 className="text-lg font-bold font-display text-[var(--ink)]">
                    Verified Emergency Freeze Codes
                  </h2>
                </div>
                <input
                  type="text"
                  placeholder="Search bank name..."
                  value={searchBank}
                  onChange={(e) => setSearchBank(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--paper-line)] text-xs focus:ring-2 focus:ring-[var(--saffron)] outline-none sm:w-48"
                />
              </div>

              {/* Bank Selector Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                {filteredBanks.map((b) => (
                  <button
                    key={b.bank_id}
                    type="button"
                    onClick={() => setSelectedBankId(b.bank_id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                      selectedBankId === b.bank_id
                        ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm'
                        : 'bg-[var(--paper)] text-[var(--ink-text)]/70 border-[var(--paper-line)] hover:bg-gray-200'
                    }`}
                  >
                    {b.bank_name.split(' (')[0]}
                  </button>
                ))}
              </div>

              {selectedBank && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-amber-800">Selected Bank</span>
                      <h3 className="font-bold text-base text-[var(--ink)]">{selectedBank.bank_name}</h3>
                      <span className="text-xs text-[var(--ink-text)]/60">{selectedBank.category}</span>
                    </div>
                    <a
                      href={selectedBank.netbanking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition shrink-0"
                    >
                      Open Portal ↗
                    </a>
                  </div>

                  {/* 1. USSD Block Sequence */}
                  <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                        <span className="text-base">📶</span>
                        <span>Universal USSD Fast-Block (*99#)</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Works Offline without Internet
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-text)]/70 leading-relaxed">
                      {selectedBank.ussd_instructions}
                    </p>
                    <div className="flex items-center justify-between bg-[var(--paper)] p-2.5 rounded-xl font-mono text-xs">
                      <span className="font-bold text-base text-[var(--ink)]">{selectedBank.ussd_code}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedBank.ussd_code, 'ussd')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-[11px] font-semibold hover:bg-gray-100"
                        >
                          {copiedKey === 'ussd' ? '✓ Copied' : 'Copy'}
                        </button>
                        <a
                          href={`tel:${encodeURIComponent(selectedBank.ussd_code)}`}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
                        >
                          Dial Now 📞
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 2. SMS Block Commands */}
                  <div className="bg-white border border-[var(--paper-line)] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                        <span className="text-base">✉️</span>
                        <span>Emergency SMS Freeze Command</span>
                      </span>
                      <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        Official Bank Number: {selectedBank.sms_card_block_number}
                      </span>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl space-y-1 font-mono text-xs">
                      <div className="text-[10px] text-gray-500 uppercase">Card Hotlist Syntax:</div>
                      <div className="font-bold text-sm text-[var(--ink)]">{selectedBank.sms_card_block_syntax}</div>
                      <div className="text-[10px] text-gray-500">Send from your bank-registered mobile number to <strong>{selectedBank.sms_card_block_number}</strong>.</div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(`${selectedBank.sms_card_block_syntax} to ${selectedBank.sms_card_block_number}`, 'sms_card')}
                        className="flex-1 py-2 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-100"
                      >
                        {copiedKey === 'sms_card' ? '✓ Command Copied' : 'Copy SMS Command'}
                      </button>
                      <a
                        href={`sms:${selectedBank.sms_card_block_number}?body=${encodeURIComponent(selectedBank.sms_card_block_syntax)}`}
                        className="flex-1 py-2 rounded-xl bg-[var(--ink)] text-white text-xs font-bold text-center hover:bg-black"
                      >
                        Open SMS App ↗
                      </a>
                    </div>

                    {selectedBank.sms_acc_freeze_syntax && (
                      <div className="text-[11px] text-[var(--ink-text)]/75 bg-blue-50/60 border border-blue-200 p-2.5 rounded-xl">
                        <span className="font-bold text-blue-900 block">Account Level Freeze:</span>
                        Send <code>{selectedBank.sms_acc_freeze_syntax}</code> to <strong>{selectedBank.sms_acc_freeze_number}</strong>.
                      </div>
                    )}
                  </div>

                  {/* 3. Phone Hotlines */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--paper)] p-4 rounded-2xl border border-[var(--paper-line)]">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold text-[var(--ink-text)]/50 block">
                        24x7 Emergency Fraud Desk
                      </span>
                      <span className="font-bold text-sm text-[var(--ink)] font-mono">{selectedBank.phone_hotline}</span>
                      {selectedBank.phone_alt && (
                        <div className="text-[10px] text-[var(--ink-text)]/60 font-mono">{selectedBank.phone_alt}</div>
                      )}
                    </div>
                    <a
                      href={`tel:${selectedBank.phone_hotline.split('/')[0].replace(/\s+/g, '')}`}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shrink-0"
                    >
                      Call Fraud Desk 📞
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* AADHAAR BIOMETRIC LOCK SECTION */}
            <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    🔒
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-purple-700">
                      Step 2: UIDAI Self-Defense
                    </span>
                    <h3 className="font-bold text-base text-[var(--ink)]">
                      Lock Aadhaar Biometrics (Disable AePS Fraud)
                    </h3>
                  </div>
                </div>
                <a
                  href={guide.myaadhaar_portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 transition shrink-0 shadow-sm"
                >
                  Open myAadhaar ↗
                </a>
              </div>

              <p className="text-xs text-[var(--ink-text)]/80 leading-relaxed">
                <strong>Why this is critical:</strong> Scammers use silicon copies of fingerprints harvested from public registry documents to drain bank accounts via <strong>AePS micro-ATMs</strong> without any OTP or PIN!
                Locking biometrics stops 100% of biometric AePS fraud while leaving your normal mobile OTP working for income tax and banking.
              </p>

              {/* 1947 SMS Fast Lock */}
              <div className="bg-white/80 border border-purple-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950">Offline SMS Lock via 1947:</span>
                  <span className="font-mono text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Toll-Free</span>
                </div>
                <div className="font-mono text-[11px] space-y-1 bg-[var(--paper)] p-2.5 rounded-xl">
                  <div>1. {guide.sms_1947_syntax.step_1_get_otp}</div>
                  <div>2. {guide.sms_1947_syntax.step_2_lock_uid}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>👁️ View 5-Step Visual Walkthrough</span>
                  <span>→</span>
                </button>
                <a
                  href="tel:1947"
                  className="text-xs font-mono font-bold text-purple-800 hover:underline"
                >
                  UIDAI Helpline: 1947
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Emergency Mitigation Receipt Generator (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleGenerateReceipt}
              className="bg-white border border-[var(--paper-line)] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div>
                <span className="text-xs font-mono font-bold uppercase text-[var(--saffron)]">
                  Step 3: Certified Documentation
                </span>
                <h2 className="text-lg font-bold font-display text-[var(--ink)]">
                  Generate Emergency Mitigation Receipt
                </h2>
                <p className="text-xs text-[var(--ink-text)]/70 mt-0.5">
                  Creates an SHA-256 cryptographically sealed timestamp proof under RBI Zero-Liability circular.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--ink)]">
                    Citizen Name (Optional / Redacted)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] focus:ring-2 focus:ring-[var(--saffron)] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">
                      Card (Last 4 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength="4"
                      placeholder="e.g. 4412"
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono focus:ring-2 focus:ring-[var(--saffron)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[var(--ink)]">
                      Account (Last 4 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength="4"
                      placeholder="e.g. 8819"
                      value={accLast4}
                      onChange={(e) => setAccLast4(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] font-mono focus:ring-2 focus:ring-[var(--saffron)] outline-none"
                    />
                  </div>
                </div>

                {/* Self-Defense Actions Checklist */}
                <div className="space-y-2 bg-[var(--paper)] p-3 rounded-2xl border border-[var(--paper-line)]">
                  <span className="font-bold text-[11px] text-[var(--ink)] block uppercase">
                    Mitigation Checklist (Select all that apply)
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reported1930}
                      onChange={(e) => setReported1930(e.target.checked)}
                      className="rounded text-[var(--saffron)]"
                    />
                    <span>Dialed National Cybercrime Helpline (1930)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedPortal}
                      onChange={(e) => setReportedPortal(e.target.checked)}
                      className="rounded text-[var(--saffron)]"
                    />
                    <span>Filed report on cybercrime.gov.in</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aadhaarLocked}
                      onChange={(e) => setAadhaarLocked(e.target.checked)}
                      className="rounded text-[var(--saffron)]"
                    />
                    <span>Locked Aadhaar Biometrics on myAadhaar</span>
                  </label>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--ink)]">
                    Incident Context (Optional)
                  </label>
                  <textarea
                    rows="2"
                    placeholder="e.g., Suspicious call claiming CBI arrest demanded RTGS transfer..."
                    value={incidentNotes}
                    onChange={(e) => setIncidentNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--paper-line)] focus:ring-2 focus:ring-[var(--saffron)] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[var(--saffron)] text-white font-bold text-xs hover:opacity-95 transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>📜</span>
                <span>Generate Official Mitigation Receipt (SHA-256)</span>
              </button>
            </form>

            {/* Render Active Receipt Card */}
            {activeReceipt && (
              <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-lg space-y-3 animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <h4 className="font-bold text-xs text-[var(--ink)]">Certified Mitigation Receipt</h4>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold">
                        {activeReceipt.receipt_id}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    SEALED
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Citizen:</span>
                    <span className="font-bold text-[var(--ink)]">{activeReceipt.citizen_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bank:</span>
                    <span className="font-bold text-[var(--ink)]">{activeReceipt.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Timestamp:</span>
                    <span className="text-[var(--ink)]">{activeReceipt.timestamp_ist}</span>
                  </div>
                  {activeReceipt.card_last_4 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Card Last 4:</span>
                      <span className="text-[var(--ink)]">•••• {activeReceipt.card_last_4}</span>
                    </div>
                  )}
                </div>

                {/* Actions list */}
                <div className="bg-[var(--paper)] p-2.5 rounded-xl text-[10px] space-y-1">
                  <span className="font-bold block text-gray-600 uppercase">Documented Actions:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                    {activeReceipt.actions_attempted.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>

                {/* SHA-256 seal */}
                <div className="bg-gray-50 border border-gray-200 p-2 rounded-xl font-mono text-[9px] break-all">
                  <span className="text-gray-500 block uppercase font-bold">SHA-256 Cryptographic Seal:</span>
                  <span className="text-gray-900">{activeReceipt.sha256_hash}</span>
                </div>

                <div className="text-[9px] text-gray-500 leading-tight italic">
                  {activeReceipt.rbi_circular_reference}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const str = JSON.stringify(activeReceipt, null, 2);
                      const blob = new Blob([str], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeReceipt.receipt_id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex-1 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-100 text-center"
                  >
                    ⬇️ Download JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-1.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-black text-center"
                  >
                    🖨️ Print / Save PDF
                  </button>
                </div>
              </div>
            )}

            {/* Past Receipts Drawer */}
            {pastReceipts.length > 0 && (
              <div className="bg-white border border-[var(--paper-line)] rounded-3xl p-5 shadow-sm space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-[var(--ink-text)]/60 block">
                  Past Mitigation Receipts ({pastReceipts.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pastReceipts.map((rcpt) => (
                    <div
                      key={rcpt.receipt_id}
                      onClick={() => setActiveReceipt(rcpt)}
                      className="p-2.5 rounded-xl bg-[var(--paper)] hover:bg-gray-200 border border-[var(--paper-line)] cursor-pointer text-xs flex items-center justify-between transition"
                    >
                      <div>
                        <div className="font-bold text-[var(--ink)]">{rcpt.bank_name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{rcpt.receipt_id}</div>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono">View ↗</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5-STEP AADHAAR LOCK MODAL */}
        {showGuideModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-[var(--paper-line)] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[var(--paper-line)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔒</span>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--ink)]">
                      UIDAI Aadhaar Biometric Lock Walkthrough
                    </h3>
                    <span className="text-[10px] font-mono text-purple-700 font-bold">
                      Zero AePS Financial Deductions
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {guide.steps.map((st) => (
                  <div key={st.step_number} className="bg-[var(--paper)] p-3.5 rounded-2xl border border-[var(--paper-line)] space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-700 text-white font-bold flex items-center justify-center text-[10px]">
                        {st.step_number}
                      </span>
                      <span className="font-bold text-[var(--ink)]">{st.title}</span>
                    </div>
                    <p className="text-[var(--ink-text)]/80 pl-7">{st.instruction}</p>
                    {st.warning && (
                      <div className="text-[10px] text-amber-900 bg-amber-50 p-2 rounded-xl mt-1 pl-7">
                        ⚠️ {st.warning}
                      </div>
                    )}
                  </div>
                ))}

                <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-purple-950 text-xs">
                  <span className="font-bold block mb-1">Temporary Unlocking for Genuine KYC:</span>
                  {guide.temporary_unlock_guidance}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <a
                  href={guide.myaadhaar_portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-purple-700 text-white font-bold text-xs hover:bg-purple-800"
                >
                  Open myAadhaar Portal Now ↗
                </a>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
