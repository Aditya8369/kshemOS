import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCsvTransactions,
  reconstructMoneyTrail,
  MoneyTrailStore,
  SAMPLE_CSV_DATA,
} from './moneyTrailStore.js';

test('parseCsvTransactions correctly parses formatted transaction rows', () => {
  const csv = `utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type
UTR001,2026-11-10T10:00:00Z,VICTIM_1,HDFC,HDFC001,MULE_1,SBI,SBIN001,"1,25,000",RTGS
UTR002,2026-11-10T10:15:00Z,MULE_1,SBI,SBIN001,MULE_2,ICICI,ICIC001,₹120000,IMPS
`;
  const txns = parseCsvTransactions(csv);
  assert.equal(txns.length, 2);
  assert.equal(txns[0].utr_number, 'UTR001');
  assert.equal(txns[0].amount, 125000);
  assert.equal(txns[0].sender_account, 'VICTIM_1');
  assert.equal(txns[0].receiver_account, 'MULE_1');

  assert.equal(txns[1].utr_number, 'UTR002');
  assert.equal(txns[1].amount, 120000);
  assert.equal(txns[1].txn_type, 'IMPS');
});

test('reconstructMoneyTrail builds complete multi-hop hierarchy and detects Mule Hubs', () => {
  const analysis = reconstructMoneyTrail('CASE-TEST-DELHI');
  assert.equal(analysis.case_id, 'CASE-TEST-DELHI');
  assert.equal(analysis.total_volume_inr, 4550000);
  assert.equal(analysis.total_victims, 2);
  assert.ok(analysis.total_mules >= 4);

  // Mule Hub verification
  assert.ok(analysis.mule_hubs.includes('ACC-HUB-MULE-CENTRAL'));
  const hubNode = analysis.nodes.find((n) => n.account_id === 'ACC-HUB-MULE-CENTRAL');
  assert.ok(hubNode);
  assert.equal(hubNode.is_mule_hub, true);
  assert.ok(hubNode.mule_hub_score >= 60);
  assert.equal(hubNode.inflow_count, 2);
  assert.equal(hubNode.outflow_count, 3);
  assert.equal(hubNode.resting_balance, 1450000);
  assert.equal(hubNode.freeze_priority, 'TIER_1_CRITICAL_RESTING');
});

test('reconstructMoneyTrail calculates transfer velocity and resting balances accurately', () => {
  const analysis = reconstructMoneyTrail('CASE-VELOCITY-TEST');
  const l1_01 = analysis.nodes.find((n) => n.account_id === 'ACC-MULE-L1-01');
  assert.ok(l1_01);
  assert.equal(l1_01.transfer_velocity_minutes, 13);
  assert.equal(l1_01.resting_balance, 50000);

  const cashMule01 = analysis.nodes.find((n) => n.account_id === 'ACC-CASH-MULE-01');
  assert.ok(cashMule01);
  assert.equal(cashMule01.resting_balance, 0);
  assert.equal(cashMule01.freeze_priority, 'TIER_2_HIGH_VELOCITY');

  const cashMule03 = analysis.nodes.find((n) => n.account_id === 'ACC-CASH-MULE-03');
  assert.ok(cashMule03);
  assert.equal(cashMule03.resting_balance, 1000000);
  assert.equal(cashMule03.freeze_priority, 'TIER_1_CRITICAL_RESTING');
});

test('Section 102 CrPC schedule exports with prioritized accounts and statutory grounds', () => {
  const store = new MoneyTrailStore('test_store_102');
  const schedule = store.getSection102Schedule('CASE-DELHI-01');

  assert.ok(schedule.schedule_id.startsWith('SCHED-102-'));
  assert.ok(schedule.total_resting_amount_inr > 0);
  assert.ok(schedule.items.length > 0);

  // Highest resting balance or tier 1 critical at top
  const first = schedule.items[0];
  assert.equal(first.freeze_mandate_priority, 'TIER_1_CRITICAL_RESTING');
  assert.ok(first.seized_amount_resting_inr > 0);
  assert.ok(first.statutory_grounds.includes('Section 102 CrPC'));

  const csvExport = store.exportScheduleAsCsv('CASE-DELHI-01');
  assert.ok(csvExport.includes('Beneficiary Account'));
  assert.ok(csvExport.includes('ACC-HUB-MULE-CENTRAL'));
});

test('MoneyTrailStore ingests custom CSV and notifies subscribers', () => {
  const store = new MoneyTrailStore('test_store_ingest');
  let notified = false;
  store.subscribe((data) => {
    if (data) notified = true;
  });

  const customCsv = `utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type
TXN001,2026-11-10T11:00:00Z,VICTIM_Z,SBI,SBIN001,MULE_Z,HDFC,HDFC001,600000,IMPS
`;
  const result = store.ingest('CASE-CUSTOM-INGEST', customCsv, null);
  assert.equal(result.case_id, 'CASE-CUSTOM-INGEST');
  assert.equal(result.total_volume_inr, 600000);
  assert.equal(notified, true);
});

