/**
 * MoneyTrailStore – Client-side Store & Offline Flow Hop Reconstructor
 * Visualizes syndicate mule rings, detects bottleneck Mule Hubs,
 * calculates transfer velocity, and generates Section 102 CrPC asset freeze schedules.
 */

export const MONEY_TRAIL_STORAGE_KEY = 'kshemos_money_trail_v1';
export const MONEY_TRAIL_CHANGED_EVENT = 'kshemos:money-trail:changed';

export const SAMPLE_CSV_DATA = `utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type
UTR202611100001,2026-11-10T10:15:00Z,VICTIM-DR-SEN,HDFC Bank,HDFC0001234,ACC-MULE-L1-01,State Bank of India,SBIN0000691,2500000.0,RTGS
UTR202611100002,2026-11-10T10:20:00Z,VICTIM-MRS-KAPOOR,ICICI Bank,ICIC0000456,ACC-MULE-L1-02,Punjab National Bank,PUNB0123400,2050000.0,RTGS
UTR202611100003,2026-11-10T10:28:00Z,ACC-MULE-L1-01,State Bank of India,SBIN0000691,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,2450000.0,IMPS
UTR202611100004,2026-11-10T10:48:00Z,ACC-MULE-L1-02,Punjab National Bank,PUNB0123400,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,2000000.0,IMPS
UTR202611100005,2026-11-10T10:55:00Z,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,ACC-CASH-MULE-01,Bank of Baroda,BARB0CONNAU,1000000.0,IMPS
UTR202611100006,2026-11-10T10:58:00Z,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,ACC-CASH-MULE-02,Axis Bank,UTIB0000888,1000000.0,IMPS
UTR202611100007,2026-11-10T11:02:00Z,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,ACC-CASH-MULE-03,Union Bank of India,UBIN0531234,1000000.0,IMPS
UTR202611100008,2026-11-10T11:15:00Z,ACC-CASH-MULE-01,Bank of Baroda,BARB0CONNAU,ATM-CASH-WITHDRAWAL-CP,Cash Dispenser,ATM0001,1000000.0,ATM_CASH
UTR202611100009,2026-11-10T11:20:00Z,ACC-CASH-MULE-02,Axis Bank,UTIB0000888,CRYPTO-P2P-ESCROW-X,P2P Exchange Desk,CRYP0001,1000000.0,CRYPTO_BUY
`;

export function parseCsvTransactions(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') return [];
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas
    const values = [];
    let insideQuotes = false;
    let curVal = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(curVal.trim());
        curVal = '';
      } else {
        curVal += char;
      }
    }
    values.push(curVal.trim());

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ? values[idx].replace(/^["']|["']$/g, '') : '';
    });

    const utr = row.utr_number || row.utr || row.txn_id || `UTR-GEN-${1000 + i}`;
    const ts = row.timestamp_iso || row.timestamp || row.date || new Date().toISOString();
    const sender = row.sender_account || row.sender || row.remitter || 'UNKNOWN_SENDER';
    const receiver = row.receiver_account || row.receiver || row.beneficiary || 'UNKNOWN_RECEIVER';
    const rawAmt = row.amount || row.amount_inr || '0';
    const amount = parseFloat(rawAmt.replace(/[₹,\s]/g, '')) || 0;

    transactions.push({
      utr_number: utr,
      timestamp_iso: ts,
      sender_account: sender,
      sender_bank: row.sender_bank || 'Originating Bank',
      sender_ifsc: row.sender_ifsc || 'IFSC0001',
      receiver_account: receiver,
      receiver_bank: row.receiver_bank || 'Beneficiary Bank',
      receiver_ifsc: row.receiver_ifsc || 'IFSC0001',
      amount,
      txn_type: (row.txn_type || 'IMPS').toUpperCase(),
    });
  }

  return transactions;
}

export function parseTimestamp(tsStr) {
  try {
    const t = Date.parse(tsStr);
    return isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

export function reconstructMoneyTrail(caseId = 'CASE-2026-DELHI-01', transactions = []) {
  const txns = transactions && transactions.length > 0 ? transactions : parseCsvTransactions(SAMPLE_CSV_DATA);

  const allAccounts = new Set();
  const inflowTotals = {};
  const outflowTotals = {};
  const inflowTxns = {};
  const outflowTxns = {};
  const bankNames = {};
  const ifscCodes = {};

  txns.forEach((t) => {
    allAccounts.add(t.sender_account);
    allAccounts.add(t.receiver_account);

    inflowTotals[t.receiver_account] = (inflowTotals[t.receiver_account] || 0) + t.amount;
    outflowTotals[t.sender_account] = (outflowTotals[t.sender_account] || 0) + t.amount;

    if (!inflowTxns[t.receiver_account]) inflowTxns[t.receiver_account] = [];
    inflowTxns[t.receiver_account].push(t);

    if (!outflowTxns[t.sender_account]) outflowTxns[t.sender_account] = [];
    outflowTxns[t.sender_account].push(t);

    if (t.sender_bank && t.sender_bank !== 'Originating Bank') bankNames[t.sender_account] = t.sender_bank;
    if (t.receiver_bank && t.receiver_bank !== 'Beneficiary Bank') bankNames[t.receiver_account] = t.receiver_bank;
    if (t.sender_ifsc) ifscCodes[t.sender_account] = t.sender_ifsc;
    if (t.receiver_ifsc) ifscCodes[t.receiver_account] = t.receiver_ifsc;
  });

  // Assign Hop Levels (BFS from zero-inflow nodes as Hop 0)
  const hopLevels = {};
  const accountsList = Array.from(allAccounts);
  let originNodes = accountsList.filter((acc) => !inflowTotals[acc]);
  if (originNodes.length === 0 && txns.length > 0) {
    originNodes = [txns[0].sender_account];
  }

  originNodes.forEach((orig) => {
    hopLevels[orig] = 0;
  });

  const queue = [...originNodes];
  const visited = new Set(originNodes);

  while (queue.length > 0) {
    const curr = queue.shift();
    const currHop = hopLevels[curr] || 0;
    const outList = outflowTxns[curr] || [];

    outList.forEach((t) => {
      const rec = t.receiver_account;
      if (hopLevels[rec] === undefined || hopLevels[rec] < currHop + 1) {
        hopLevels[rec] = currHop + 1;
      }
      if (!visited.has(rec)) {
        visited.add(rec);
        queue.push(rec);
      }
    });
  }

  const nodes = [];
  const muleHubs = [];
  let totalVolume = txns
    .filter((t) => (hopLevels[t.sender_account] || 0) === 0)
    .reduce((sum, t) => sum + t.amount, 0);

  if (totalVolume === 0) {
    totalVolume = txns.reduce((sum, t) => sum + t.amount, 0);
  }

  let activeRestingBalance = 0;

  accountsList.sort((a, b) => (hopLevels[a] || 99) - (hopLevels[b] || 99) || a.localeCompare(b));

  accountsList.forEach((acc) => {
    const inAmt = inflowTotals[acc] || 0;
    const outAmt = outflowTotals[acc] || 0;
    const resting = Math.max(0, inAmt - outAmt);
    const hop = hopLevels[acc] !== undefined ? hopLevels[acc] : 1;

    const inCnt = (inflowTxns[acc] || []).length;
    const outCnt = (outflowTxns[acc] || []).length;

    let velocityMinutes = null;
    if (inCnt > 0 && outCnt > 0) {
      const firstIn = Math.min(...inflowTxns[acc].map((t) => parseTimestamp(t.timestamp_iso)));
      const firstOut = Math.min(...outflowTxns[acc].map((t) => parseTimestamp(t.timestamp_iso)));
      if (firstOut >= firstIn && firstIn > 0) {
        velocityMinutes = Math.round(((firstOut - firstIn) / (60 * 1000)) * 10) / 10;
      }
    }

    // Mule Hub detection
    let isHub = false;
    let hubScore = 0;
    if (inCnt >= 2 && (outCnt >= 1 || inAmt >= 2000000)) {
      isHub = true;
      hubScore = Math.min(100, Math.round((inCnt * 25 + inAmt / 100000 + outCnt * 10) * 10) / 10);
      muleHubs.push(acc);
    }

    let nodeType = 'splitter_mule';
    let label = `Mule: ${acc}`;
    const upperAcc = acc.toUpperCase();

    if (hop === 0) {
      nodeType = 'victim';
      label = `Victim: ${acc}`;
    } else if (
      upperAcc.includes('ATM') ||
      upperAcc.includes('CRYPTO') ||
      upperAcc.includes('DISPENSER') ||
      upperAcc.includes('ESCROW')
    ) {
      nodeType = 'exit_channel';
      label = `Exit Point: ${acc}`;
    } else if (isHub) {
      nodeType = 'mule_hub';
      label = `Mule Hub: ${acc}`;
    } else if (hop === 1) {
      nodeType = 'primary_mule';
      label = `Layer 1 Mule: ${acc}`;
    } else {
      nodeType = 'splitter_mule';
      label = `Splitter Mule: ${acc}`;
    }

    let freezePriority = 'TIER_3_MONITOR';
    if (nodeType !== 'victim' && nodeType !== 'exit_channel' && resting > 10000) {
      freezePriority = 'TIER_1_CRITICAL_RESTING';
      activeRestingBalance += resting;
    } else if (velocityMinutes !== null && velocityMinutes < 30 && outCnt > 0) {
      freezePriority = 'TIER_2_HIGH_VELOCITY';
    }

    nodes.push({
      account_id: acc,
      label,
      bank_name: bankNames[acc] || 'Commercial Bank',
      ifsc_code: ifscCodes[acc] || 'IFSC0001',
      node_type: nodeType,
      hop_level: hop,
      total_inflow: inAmt,
      total_outflow: outAmt,
      resting_balance: resting,
      inflow_count: inCnt,
      outflow_count: outCnt,
      is_mule_hub: isHub,
      mule_hub_score: hubScore,
      transfer_velocity_minutes: velocityMinutes,
      freeze_priority: freezePriority,
    });
  });

  const edges = txns.map((t) => {
    const sHop = hopLevels[t.sender_account] || 0;
    const rHop = hopLevels[t.receiver_account] || sHop + 1;
    const sNode = nodes.find((n) => n.account_id === t.sender_account);

    return {
      from_hop: sHop,
      to_hop: rHop,
      source_node: t.sender_account,
      target_node: t.receiver_account,
      amount: t.amount,
      utr_number: t.utr_number,
      timestamp_iso: t.timestamp_iso,
      velocity_minutes: sNode ? sNode.transfer_velocity_minutes : null,
    };
  });

  // Build Sankey Data
  const sankeyNodes = nodes.map((n) => ({
    id: n.account_id,
    name: n.label,
    hop: n.hop_level,
    category: n.node_type,
    amount: Math.max(n.total_inflow, n.total_outflow),
  }));

  const sankeyLinks = txns.map((t) => ({
    source: t.sender_account,
    target: t.receiver_account,
    value: t.amount,
    utr: t.utr_number,
  }));

  // Build Section 102 CrPC Schedule
  const attachmentTargets = nodes.filter(
    (n) => n.node_type !== 'victim' && n.node_type !== 'exit_channel' && n.total_inflow > 0
  );
  attachmentTargets.sort((a, b) => {
    if (a.freeze_priority === 'TIER_1_CRITICAL_RESTING' && b.freeze_priority !== 'TIER_1_CRITICAL_RESTING') return -1;
    if (b.freeze_priority === 'TIER_1_CRITICAL_RESTING' && a.freeze_priority !== 'TIER_1_CRITICAL_RESTING') return 1;
    return b.resting_balance - a.resting_balance;
  });

  const scheduleItems = attachmentTargets.map((target, idx) => {
    const utrRefs = txns.filter((t) => t.receiver_account === target.account_id).map((t) => t.utr_number);
    return {
      schedule_index: idx + 1,
      beneficiary_account: target.account_id,
      bank_name: target.bank_name,
      ifsc_code: target.ifsc_code,
      branch_name: `${target.bank_name} Main Branch`,
      suspect_name: `Beneficiary Account Holder of ${target.account_id}`,
      seized_amount_resting_inr: target.resting_balance,
      total_fraud_received_inr: target.total_inflow,
      utr_references: utrRefs,
      freeze_mandate_priority: target.freeze_priority,
      statutory_grounds: `Funds identified as proceeds of cybercrime under Section 102 CrPC / Section 107 BNSS. Account received ₹${target.total_inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })} across ${utrRefs.length} transactions; resting balance of ₹${target.resting_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} subject to immediate debit freeze.`,
    };
  });

  const scheduleId = `SCHED-102-${caseId.replace(/^CASE-/, '')}-${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Pseudo hash generator for offline compatibility
  const pseudoHash = Array.from(`${scheduleId}-${activeRestingBalance}-${scheduleItems.length}`)
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0)
    .toString(16)
    .padStart(64, 'a');

  const section102Schedule = {
    schedule_id: scheduleId,
    case_id: caseId,
    investigating_officer: 'Inspector R. K. Sharma (Cyber Crime Cell)',
    police_station: 'Special Cyber Crime Police Station, Central District',
    total_resting_amount_inr: activeRestingBalance,
    total_dispersed_amount_inr: totalVolume - activeRestingBalance,
    accounts_count: scheduleItems.length,
    mule_hubs_count: muleHubs.length,
    items: scheduleItems,
    statutory_declaration:
      'I, the undersigned Investigating Officer, hereby certify that the electronic accounts specified in this Schedule have been identified through multi-hop cryptographic money-trail reconstruction as recipient conduits for stolen cybercrime funds. Under powers conferred by Section 102 Code of Criminal Procedure, 1973 (Section 107 Bharatiya Nagarik Suraksha Sanhita, 2023), immediate provisional freeze of all debit operations is hereby ordered to prevent dissipation of tainted assets.',
    generated_at_iso: nowIso,
    schedule_hash: pseudoHash,
  };

  return {
    case_id: caseId,
    total_volume_inr: totalVolume,
    total_victims: nodes.filter((n) => n.node_type === 'victim').length,
    total_mules: nodes.filter((n) => ['primary_mule', 'mule_hub', 'splitter_mule'].includes(n.node_type)).length,
    mule_hubs: muleHubs,
    active_resting_balance_inr: activeRestingBalance,
    nodes,
    edges,
    sankey_data: {
      nodes: sankeyNodes,
      links: sankeyLinks,
    },
    section_102_schedule: section102Schedule,
  };
}

export class MoneyTrailStore {
  constructor(storageKey = MONEY_TRAIL_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.listeners = new Set();
    this.cachedAnalysis = null;
  }

  getAnalysis(caseId = 'CASE-2026-DELHI-01') {
    if (!this.cachedAnalysis || this.cachedAnalysis.case_id !== caseId) {
      this.cachedAnalysis = reconstructMoneyTrail(caseId);
    }
    return this.cachedAnalysis;
  }

  ingest(caseId, rawCsv, transactions) {
    let txns = [];
    if (rawCsv) {
      txns = parseCsvTransactions(rawCsv);
    } else if (transactions && transactions.length > 0) {
      txns = transactions;
    }

    this.cachedAnalysis = reconstructMoneyTrail(caseId, txns);
    this.notify();
    return this.cachedAnalysis;
  }

  getSection102Schedule(caseId = 'CASE-2026-DELHI-01') {
    const analysis = this.getAnalysis(caseId);
    return analysis.section_102_schedule;
  }

  getSampleCsv() {
    return SAMPLE_CSV_DATA.trim();
  }

  exportScheduleAsCsv(caseId = 'CASE-2026-DELHI-01') {
    const schedule = this.getSection102Schedule(caseId);
    const headers = [
      'Schedule Index',
      'Beneficiary Account',
      'Bank Name',
      'IFSC Code',
      'Branch Name',
      'Suspect Name',
      'Resting Amount INR',
      'Total Received INR',
      'Priority',
      'UTR References',
      'Statutory Grounds',
    ];

    const rows = schedule.items.map((item) => [
      item.schedule_index,
      `"${item.beneficiary_account}"`,
      `"${item.bank_name}"`,
      `"${item.ifsc_code}"`,
      `"${item.branch_name}"`,
      `"${item.suspect_name}"`,
      item.seized_amount_resting_inr,
      item.total_fraud_received_inr,
      item.freeze_mandate_priority,
      `"${item.utr_references.join('; ')}"`,
      `"${item.statutory_grounds.replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.cachedAnalysis);
      } catch (err) {
        console.error('MoneyTrailStore listener error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MONEY_TRAIL_CHANGED_EVENT, { detail: this.cachedAnalysis }));
    }
  }
}

export const defaultMoneyTrailStore = new MoneyTrailStore();
