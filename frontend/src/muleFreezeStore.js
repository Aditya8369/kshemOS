/**
 * MuleFreezeStore – Client-side Store & Offline Fallback for UPI Mule Account Freeze Dispatch
 * Compatible with I4C CFCFRMS and NPCI Priority Stop Protocols.
 */

const VPA_REGEX = /\b([a-zA-Z0-9.\-_]{2,256})@([a-zA-Z]{2,64})\b/g;
const PHONE_VPA_REGEX = /^[6-9]\d{9}@[a-zA-Z]{2,64}$/;
const UTR_REGEX = /\b(\d{12})\b/g;
const IFSC_REGEX = /\b([A-Z]{4}0[A-Z0-9]{6})\b/g;
const ACCOUNT_NUM_REGEX = /\b([0-9]{9,18})\b/g;

export const MULE_FREEZE_STORAGE_KEY = 'kshemos_mule_freeze_registry_v1';
export const MULE_FREEZE_CHANGED_EVENT = 'kshemos:mule-freeze:changed';

export function validateVpa(vpa) {
  const normalized = (vpa || '').trim().toLowerCase();
  const match = normalized.match(/^([a-zA-Z0-9.\-_]{2,256})@([a-zA-Z]{2,64})$/);
  if (!match) {
    return {
      vpa,
      isValid: false,
      username: null,
      handle: null,
      isPhoneLinked: false,
      error: 'Invalid VPA format. Must be username@handle',
    };
  }

  return {
    vpa: normalized,
    isValid: true,
    username: match[1],
    handle: match[2],
    isPhoneLinked: PHONE_VPA_REGEX.test(normalized),
    error: null,
  };
}

export function validateUtr(utr) {
  const cleaned = (utr || '').trim();
  return /^\d{12}$/.test(cleaned);
}

export function validateIfsc(ifsc) {
  const cleaned = (ifsc || '').trim().toUpperCase();
  const isValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
  return {
    ifsc: cleaned,
    isValid,
    bankCode: isValid ? cleaned.slice(0, 4) : null,
    branchCode: isValid ? cleaned.slice(5) : null,
    error: isValid ? null : 'IFSC must be 11 characters (4 letters, 0, 6 alphanumeric)',
  };
}

export function parseFinancialEntities(text) {
  if (!text) {
    return {
      vpas: [],
      phoneLinkedVpas: [],
      utrs: [],
      ifscCodes: [],
      accountNumbers: [],
      extractedCount: 0,
    };
  }

  const vpaMatches = text.match(VPA_REGEX) || [];
  const validVpas = [];
  const phoneVpas = [];
  for (const raw of vpaMatches) {
    const val = validateVpa(raw);
    if (val.isValid) {
      validVpas.push(val.vpa);
      if (val.isPhoneLinked) phoneVpas.push(val.vpa);
    }
  }

  const uniqueVpas = [...new Set(validVpas)].sort();
  const uniquePhoneVpas = [...new Set(phoneVpas)].sort();

  const utrMatches = text.match(UTR_REGEX) || [];
  const uniqueUtrs = [...new Set(utrMatches)].sort();

  const ifscMatches = (text.toUpperCase().match(IFSC_REGEX) || []);
  const uniqueIfscs = [...new Set(ifscMatches)].sort();

  const accMatches = text.match(ACCOUNT_NUM_REGEX) || [];
  const candidateAccs = accMatches.filter((acc) => !uniqueUtrs.includes(acc) && acc.length !== 10);
  const uniqueAccs = [...new Set(candidateAccs)].sort();

  return {
    vpas: uniqueVpas,
    phoneLinkedVpas: uniquePhoneVpas,
    utrs: uniqueUtrs,
    ifscCodes: uniqueIfscs,
    accountNumbers: uniqueAccs,
    extractedCount: uniqueVpas.length + uniqueUtrs.length + uniqueIfscs.length + uniqueAccs.length,
  };
}

export function generateSection102NoticeText({
  freezeId,
  incidentId,
  suspectVpa,
  suspectAccount,
  suspectIfsc,
  utrNumber,
  transactionAmount,
  officerName,
  officerBadgeId,
  policeStation = 'Cyber Crime Police Station, Central Delhi',
  nowIso = new Date().toISOString(),
}) {
  return `STATUTORY PROVISIONAL DEBIT FREEZE NOTICE
UNDER SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE, 1973
(READ WITH SECTION 91 Cr.P.C. & SECTION 106 BHARATIYA NAGARIK SURAKSHA SANHITA, 2023)
--------------------------------------------------------------------------------
NOTICE REFERENCE NO: ${freezeId}
POLICE STATION: ${policeStation}
CYBER CRIME INCIDENT/FIR REF: ${incidentId}
DATE OF ISSUE: ${nowIso}

TO:
The Nodal Officer / Fraud Risk Management Team / Legal Cell,
Beneficiary Bank / Payment Service Provider / NPCI Central Switch.

SUBJECT: URGENT PROVISIONAL DEBIT FREEZE ORDER ON MULE/BENEFICIARY ACCOUNT / VPA
IN RE: CYBERCRIME FINANCIAL FRAUD INVESTIGATION.

WHEREAS, an urgent cyber financial crime report has been registered at ${policeStation}
wherein fraudulent debit of Rs. ${Number(transactionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} was executed
under transaction reference UTR: ${utrNumber || 'UNDER_TRACING'}.

AND WHEREAS, investigation and network fraud graph telemetry reveal that the funds have been
credited into the following beneficiary/mule account channel:
  • Suspect UPI VPA: ${suspectVpa}
  • Suspect Bank Account No: ${suspectAccount || 'VPA-LINKED'}
  • Suspect Bank IFSC: ${suspectIfsc || 'TO BE PROVIDED BY PSP'}

NOW THEREFORE, by virtue of statutory powers conferred under Section 102 Cr.P.C.,
YOU ARE HEREBY DIRECTED TO IMMEDIATELY EXECUTE A PROVISIONAL DEBIT FREEZE / LIEN MARK
on the aforesaid account/VPA to prevent further layering and siphon of proceeds of crime.

FURTHER, under Section 91 Cr.P.C., you are requisitioned to furnish within 24 hours:
1. Complete account opening KYC records, mobile number, and IP address logs.
2. Certified statement of accounts from credit date to present timestamp.
3. Inward and outward transaction trail with destination VPAs/accounts.

Failure to comply with this statutory order invites penal consequences under Section 188 IPC /
Section 223 BNS and relevant sections of the Information Technology Act, 2000.

ISSUED UNDER OFFICIAL SEAL AND SIGNATURE:
Investigating Officer: ${officerName}
Badge/Rank ID: ${officerBadgeId}
Cyber Operations Desk: KshemOS National Financial Fraud Triage Unit`;
}

export function generateCfcfrmsPayload({
  freezeId,
  incidentId,
  suspectVpa,
  suspectAccount,
  suspectIfsc,
  utrNumber,
  transactionAmount,
  priorityTier,
  slaMinutes,
  officerBadgeId,
  officerName,
}) {
  return {
    cfcfrms_header: {
      portal: 'Citizen Financial Cyber Fraud Reporting and Management System (CFCFRMS)',
      gateway_protocol: 'I4C-NPCI-PRIORITY-FREEZE-v2.4',
      cfcfrms_ticket_id: `CFCFRMS-1930-${freezeId.replace('FRZ-', '')}`,
      originating_system: 'KshemOS Digital Public Safety Platform',
      dispatch_timestamp: new Date().toISOString(),
      priority_tier: priorityTier,
      sla_minutes: slaMinutes,
    },
    transaction_mandate: {
      utr_number: utrNumber || 'N/A',
      amount: Number(transactionAmount) || 0,
      currency: 'INR',
      transaction_type: 'UPI',
    },
    suspect_beneficiary: {
      vpa: suspectVpa,
      account_number: suspectAccount || null,
      ifsc: suspectIfsc || null,
      freeze_type: 'PROVISIONAL_DEBIT_FREEZE',
      action_directive: priorityTier === 'TIER_1_IMMEDIATE_STOP' ? 'IMMEDIATE_DEBIT_FREEZE_AND_HOTLIST' : 'PROVISIONAL_DEBIT_FREEZE_AND_LIEN',
    },
    authorizing_authority: {
      officer_name: officerName,
      badge_id: officerBadgeId,
      statutory_act: 'Section 102 CrPC / Section 106 BNSS 2023',
    },
  };
}

export function evaluateMuleRisk({
  vpa,
  accountNumber,
  transactionAmount = 0,
  recentTransactions = [],
  isDigitalArrest = false,
}) {
  const amount = Number(transactionAmount) || 0;
  const txCount = recentTransactions.length + 1;
  const isLargeAmount = amount >= 50000;
  const isHighVelocity = txCount >= 3 || isLargeAmount;

  let priorityTier = 'TIER_3_MONITOR';
  let slaMinutes = 1440;
  let actionDirective = 'MONITOR_AND_KYC_VERIFICATION';

  // Seed known flagged check
  const isKnownMule = accountNumber === 'ACC-1002' || vpa.includes('mule') || isDigitalArrest;

  if (isKnownMule || isLargeAmount || isHighVelocity) {
    priorityTier = 'TIER_1_IMMEDIATE_STOP';
    slaMinutes = 15;
    actionDirective = 'IMMEDIATE_DEBIT_FREEZE_AND_HOTLIST';
  } else if (amount >= 10000 || txCount >= 2) {
    priorityTier = 'TIER_2_PROVISIONAL_FREEZE';
    slaMinutes = 120;
    actionDirective = 'PROVISIONAL_DEBIT_FREEZE_AND_LIEN';
  }

  const velocityScore = Math.min(1.0, txCount * 0.2 + (isLargeAmount ? 0.4 : 0.1));

  return {
    vpa,
    accountNumber: accountNumber || null,
    transactionAmount: amount,
    priorityTier,
    slaMinutes,
    actionDirective,
    graphHopDistance: isKnownMule ? 0 : 2,
    muleProbability: isKnownMule ? 0.95 : 0.45,
    velocityScore: Number(velocityScore.toFixed(2)),
    hasRapidBurst: txCount >= 3,
    evaluationRationale: `Priority evaluated based on transaction magnitude (₹${amount.toLocaleString('en-IN')}) and syndicate graph proximity.`,
    evaluatedAt: new Date().toISOString(),
  };
}

// Pre-seeded default records for rapid visualization and testing
export const DEFAULT_SAMPLE_FREEZE_REQUESTS = [
  {
    freeze_id: 'FRZ-UPI-2026-1001',
    incident_id: 'INC-2026-DELHI-889',
    suspect_vpa: 'quickrecovery.fund@okaxis',
    suspect_account: 'ACC-1002',
    suspect_ifsc: 'UTIB0000124',
    utr_number: '431209876543',
    transaction_amount: 85000.0,
    status: 'FROZEN',
    priority_tier: 'TIER_1_IMMEDIATE_STOP',
    sla_minutes: 15,
    action_directive: 'IMMEDIATE_DEBIT_FREEZE_AND_HOTLIST',
    officer_badge_id: 'OFF-DELHI-101',
    officer_name: 'Inspector Rajesh Sharma',
    police_station: 'Cyber Crime Police Station, Central Delhi',
    dispatched_at: '2026-11-09T08:15:00.000Z',
    dispatched_at_ms: Date.now() - 3600000,
    acknowledged_at: '2026-11-09T08:18:22.000Z',
    acknowledged_at_ms: Date.now() - 3400000,
    bank_nodal_ref: 'AXIS-NODAL-FRZ-88912',
    bank_response_time_ms: 3420,
    evaluation: {
      graph_hop_distance: 0,
      mule_probability: 0.96,
      velocity_score: 0.88,
    },
    statutory_notice: {
      statutory_authority: 'Section 102 CrPC / Section 106 BNSS 2023',
      content_hash: 'c8f12a9e884210a4421b87612c019a823e44129841bbce82910fa842b109e231',
      legal_text: generateSection102NoticeText({
        freezeId: 'FRZ-UPI-2026-1001',
        incidentId: 'INC-2026-DELHI-889',
        suspectVpa: 'quickrecovery.fund@okaxis',
        suspectAccount: 'ACC-1002',
        suspectIfsc: 'UTIB0000124',
        utrNumber: '431209876543',
        transactionAmount: 85000.0,
        officerName: 'Inspector Rajesh Sharma',
        officerBadgeId: 'OFF-DELHI-101',
      }),
    },
    cfcfrms_payload: generateCfcfrmsPayload({
      freezeId: 'FRZ-UPI-2026-1001',
      incidentId: 'INC-2026-DELHI-889',
      suspectVpa: 'quickrecovery.fund@okaxis',
      suspectAccount: 'ACC-1002',
      suspectIfsc: 'UTIB0000124',
      utrNumber: '431209876543',
      transactionAmount: 85000.0,
      priorityTier: 'TIER_1_IMMEDIATE_STOP',
      slaMinutes: 15,
      officerBadgeId: 'OFF-DELHI-101',
      officerName: 'Inspector Rajesh Sharma',
    }),
    audit_events: [
      {
        event_id: 'EVT-1001-GEN',
        event_type: 'FREEZE_ORDER_CREATED',
        timestamp: '2026-11-09T08:15:00.000Z',
        actor_id: 'OFF-DELHI-101',
        details: 'Section 102 CrPC provisional debit freeze order initiated.',
      },
      {
        event_id: 'EVT-1001-ACK',
        event_type: 'BANK_ACKNOWLEDGMENT_FROZEN',
        timestamp: '2026-11-09T08:18:22.000Z',
        actor_id: 'BANK_NODAL_DESK',
        details: 'Bank acknowledged reference AXIS-NODAL-FRZ-88912 with status FROZEN.',
      },
    ],
  },
  {
    freeze_id: 'FRZ-UPI-2026-1002',
    incident_id: 'INC-2026-DELHI-904',
    suspect_vpa: '9876543210@paytm',
    suspect_account: '91827491029',
    suspect_ifsc: 'PYTM0123456',
    utr_number: '998877665544',
    transaction_amount: 32000.0,
    status: 'DISPATCHED',
    priority_tier: 'TIER_1_IMMEDIATE_STOP',
    sla_minutes: 15,
    action_directive: 'IMMEDIATE_DEBIT_FREEZE_AND_HOTLIST',
    officer_badge_id: 'OFF-DELHI-102',
    officer_name: 'Sub-Inspector Amit Patel',
    police_station: 'Cyber Crime Police Station, Central Delhi',
    dispatched_at: '2026-11-09T10:30:00.000Z',
    dispatched_at_ms: Date.now() - 600000,
    acknowledged_at: null,
    acknowledged_at_ms: null,
    bank_nodal_ref: null,
    bank_response_time_ms: null,
    evaluation: {
      graph_hop_distance: 1,
      mule_probability: 0.82,
      velocity_score: 0.74,
    },
    statutory_notice: {
      statutory_authority: 'Section 102 CrPC / Section 106 BNSS 2023',
      content_hash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
      legal_text: generateSection102NoticeText({
        freezeId: 'FRZ-UPI-2026-1002',
        incidentId: 'INC-2026-DELHI-904',
        suspectVpa: '9876543210@paytm',
        suspectAccount: '91827491029',
        suspectIfsc: 'PYTM0123456',
        utrNumber: '998877665544',
        transactionAmount: 32000.0,
        officerName: 'Sub-Inspector Amit Patel',
        officerBadgeId: 'OFF-DELHI-102',
      }),
    },
    cfcfrms_payload: generateCfcfrmsPayload({
      freezeId: 'FRZ-UPI-2026-1002',
      incidentId: 'INC-2026-DELHI-904',
      suspectVpa: '9876543210@paytm',
      suspectAccount: '91827491029',
      suspectIfsc: 'PYTM0123456',
      utrNumber: '998877665544',
      transactionAmount: 32000.0,
      priorityTier: 'TIER_1_IMMEDIATE_STOP',
      slaMinutes: 15,
      officerBadgeId: 'OFF-DELHI-102',
      officerName: 'Sub-Inspector Amit Patel',
    }),
    audit_events: [
      {
        event_id: 'EVT-1002-GEN',
        event_type: 'FREEZE_ORDER_CREATED',
        timestamp: '2026-11-09T10:30:00.000Z',
        actor_id: 'OFF-DELHI-102',
        details: 'Section 102 CrPC provisional debit freeze dispatched via CFCFRMS Priority gateway.',
      },
    ],
  },
];

export class MuleFreezeStore {
  constructor(initialRequests = DEFAULT_SAMPLE_FREEZE_REQUESTS) {
    this.requests = new Map();
    this.load(initialRequests);
  }

  load(fallbackRequests) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(MULE_FREEZE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const r of parsed) this.requests.set(r.freeze_id, r);
            return;
          }
        }
      } catch {
        // Fallback to initial
      }
    }

    for (const r of fallbackRequests) {
      this.requests.set(r.freeze_id, r);
    }
  }

  save() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          MULE_FREEZE_STORAGE_KEY,
          JSON.stringify(Array.from(this.requests.values()))
        );
      } catch {
        // Ignore quota
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MULE_FREEZE_CHANGED_EVENT));
    }
  }

  dispatchFreeze({
    incidentId,
    suspectVpa,
    suspectAccount,
    suspectIfsc,
    utrNumber,
    transactionAmount = 0,
    officerName = 'Inspector Rajesh Sharma',
    officerBadgeId = 'OFF-DELHI-101',
    policeStation = 'Cyber Crime Police Station, Central Delhi',
    isDigitalArrest = false,
  }) {
    const freezeSeq = 1000 + this.requests.size + 1;
    const freezeId = `FRZ-UPI-2026-${freezeSeq}`;
    const evaluation = evaluateMuleRisk({
      vpa: suspectVpa,
      accountNumber: suspectAccount,
      transactionAmount,
      isDigitalArrest,
    });

    const nowStr = new Date().toISOString();
    const nowMs = Date.now();

    const noticeText = generateSection102NoticeText({
      freezeId,
      incidentId,
      suspectVpa,
      suspectAccount,
      suspectIfsc,
      utrNumber,
      transactionAmount,
      officerName,
      officerBadgeId,
      policeStation,
      nowIso: nowStr,
    });

    const cfcfrmsPayload = generateCfcfrmsPayload({
      freezeId,
      incidentId,
      suspectVpa,
      suspectAccount,
      suspectIfsc,
      utrNumber,
      transactionAmount,
      priorityTier: evaluation.priorityTier,
      slaMinutes: evaluation.slaMinutes,
      officerBadgeId,
      officerName,
    });

    const record = {
      freeze_id: freezeId,
      incident_id: incidentId,
      suspect_vpa: suspectVpa,
      suspect_account: suspectAccount || null,
      suspect_ifsc: suspectIfsc || null,
      utr_number: utrNumber || null,
      transaction_amount: Number(transactionAmount) || 0,
      status: 'DISPATCHED',
      priority_tier: evaluation.priorityTier,
      sla_minutes: evaluation.slaMinutes,
      action_directive: evaluation.actionDirective,
      officer_badge_id: officerBadgeId,
      officer_name: officerName,
      police_station: policeStation,
      dispatched_at: nowStr,
      dispatched_at_ms: nowMs,
      acknowledged_at: null,
      acknowledged_at_ms: null,
      bank_nodal_ref: null,
      bank_response_time_ms: null,
      evaluation,
      statutory_notice: {
        statutory_authority: 'Section 102 CrPC / Section 106 BNSS 2023',
        content_hash: 'simulated_sha256_' + freezeId,
        legal_text: noticeText,
      },
      cfcfrms_payload: cfcfrmsPayload,
      audit_events: [
        {
          event_id: `EVT-${freezeId}-GEN`,
          event_type: 'FREEZE_ORDER_CREATED',
          timestamp: nowStr,
          actor_id: officerBadgeId,
          details: `Provisional debit freeze authorized for VPA ${suspectVpa} under Section 102 CrPC.`,
        },
        {
          event_id: `EVT-${freezeId}-DISPATCH`,
          event_type: 'CFCFRMS_DISPATCHED',
          timestamp: nowStr,
          actor_id: 'SYSTEM_NPCI_GATEWAY',
          details: `Dispatched via CFCFRMS Priority Gateway (Tier: ${evaluation.priorityTier}).`,
        },
      ],
    };

    this.requests.set(freezeId, record);
    this.save();
    return record;
  }

  recordBankAcknowledgment(freezeId, bankNodalRef, freezeOutcome = 'FROZEN', notes = 'Debit freeze placed.') {
    const record = this.requests.get(freezeId);
    if (!record) throw new Error(`Freeze request not found: ${freezeId}`);

    const nowStr = new Date().toISOString();
    const nowMs = Date.now();
    const latency = Math.max(0, nowMs - record.dispatched_at_ms);

    record.status = freezeOutcome;
    record.acknowledged_at = nowStr;
    record.acknowledged_at_ms = nowMs;
    record.bank_nodal_ref = bankNodalRef;
    record.bank_response_time_ms = latency;

    record.audit_events.push({
      event_id: `EVT-${freezeId}-ACK`,
      event_type: `BANK_ACKNOWLEDGMENT_${freezeOutcome}`,
      timestamp: nowStr,
      actor_id: 'BANK_NODAL_DESK',
      details: `Bank acknowledged with status ${freezeOutcome} in ${latency}ms. Ref: ${bankNodalRef}`,
    });

    this.save();
    return record;
  }

  revokeFreeze(freezeId, revokingOfficerBadgeId, revocationReason) {
    const record = this.requests.get(freezeId);
    if (!record) throw new Error(`Freeze request not found: ${freezeId}`);

    const nowStr = new Date().toISOString();
    record.status = 'REVOKED';
    record.audit_events.push({
      event_id: `EVT-${freezeId}-REVOKE`,
      event_type: 'FREEZE_REVOKED',
      timestamp: nowStr,
      actor_id: revokingOfficerBadgeId,
      details: `Provisional freeze revoked by ${revokingOfficerBadgeId}. Reason: ${revocationReason}`,
    });

    this.save();
    return record;
  }

  getRequests(filters = {}) {
    let list = Array.from(this.requests.values()).reverse();
    if (filters.status) {
      list = list.filter((r) => r.status.toUpperCase() === filters.status.toUpperCase());
    }
    if (filters.priorityTier) {
      list = list.filter((r) => r.priority_tier.toUpperCase() === filters.priorityTier.toUpperCase());
    }
    if (filters.vpa) {
      list = list.filter((r) => r.suspect_vpa.toLowerCase().includes(filters.vpa.toLowerCase()));
    }
    return list;
  }

  getRequest(freezeId) {
    return this.requests.get(freezeId) || null;
  }

  getStats() {
    const list = Array.from(this.requests.values());
    const total = list.length;
    const dispatched = list.filter((r) => r.status === 'DISPATCHED').length;
    const frozen = list.filter((r) => r.status === 'FROZEN' || r.status === 'LIEN_MARKED').length;
    const rejected = list.filter((r) => r.status.includes('REJECTED')).length;
    const revoked = list.filter((r) => r.status === 'REVOKED').length;

    const tier1 = list.filter((r) => r.priority_tier === 'TIER_1_IMMEDIATE_STOP').length;
    const tier2 = list.filter((r) => r.priority_tier === 'TIER_2_PROVISIONAL_FREEZE').length;
    const tier3 = list.filter((r) => r.priority_tier === 'TIER_3_MONITOR').length;

    const latencies = list.map((r) => r.bank_response_time_ms).filter((ms) => ms !== null && ms !== undefined);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const totalProtected = list
      .filter((r) => r.status === 'FROZEN' || r.status === 'LIEN_MARKED')
      .reduce((sum, r) => sum + (Number(r.transaction_amount) || 0), 0);

    return {
      totalRequests: total,
      dispatched,
      frozen,
      rejected,
      revoked,
      tier1ImmediateStop: tier1,
      tier2ProvisionalFreeze: tier2,
      tier3Monitor: tier3,
      averageBankLatencyMs: avgLatency,
      totalAmountProtectedInr: totalProtected,
    };
  }
}

export const defaultMuleFreezeStore = new MuleFreezeStore();

