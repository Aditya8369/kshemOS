"""
Syndicate Mule Ring Money-Trail Visualizer & Flow Hop Reconstructor Service.

Provides:
- Ingestion and normalization of multi-hop transaction logs (CSV, Excel, CFCFRMS).
- Multi-hop reconstruction: Hop 0 (Victims) -> Hop 1 (Layer 1 Intake) -> Hop 2 (Mule Hubs) -> Hop 3 (Exit Channels).
- Bottleneck Mule Hub identification (high fan-in/fan-out and round-sum dispersion).
- Transfer velocity calculation (elapsed minutes between deposit & withdrawal).
- Resting balance analysis to prioritize freeze orders on accounts where money is still resting.
- Directional node-link and Sankey flow diagram structuring.
- Single-click Section 102 CrPC asset attachment schedule generation with SHA-256 verification hash.
"""
from __future__ import annotations

import csv
import hashlib
import io
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.models import (
    MoneyTrailAnalysisResponse,
    MoneyTrailHopFlow,
    MoneyTrailIngestionRequest,
    MoneyTrailNode,
    MoneyTrailTransaction,
    SankeyDiagramData,
    SankeyLink,
    SankeyNode,
    Section102CrPCScheduleItem,
    Section102CrPCScheduleResponse,
)

# ---------------------------------------------------------------------
# PRE-SEEDED REALISTIC SYNDICATE MONEY TRAIL (DIGITAL ARREST CASE)
# ---------------------------------------------------------------------
DEFAULT_CASE_ID = "CASE-2026-DELHI-01"

DEFAULT_TRANSACTIONS: List[Dict[str, Any]] = [
    # Hop 0 -> Hop 1 (Victims to Layer 1 Intake Mules)
    {
        "utr_number": "UTR202611100001",
        "timestamp_iso": "2026-11-10T10:15:00Z",
        "sender_account": "VICTIM-DR-SEN",
        "sender_bank": "HDFC Bank",
        "sender_ifsc": "HDFC0001234",
        "receiver_account": "ACC-MULE-L1-01",
        "receiver_bank": "State Bank of India",
        "receiver_ifsc": "SBIN0000691",
        "amount": 2500000.0,
        "txn_type": "RTGS",
    },
    {
        "utr_number": "UTR202611100002",
        "timestamp_iso": "2026-11-10T10:30:00Z",
        "sender_account": "VICTIM-COL-KAPOOR",
        "sender_bank": "ICICI Bank",
        "sender_ifsc": "ICIC0000007",
        "receiver_account": "ACC-MULE-L1-02",
        "receiver_bank": "Punjab National Bank",
        "receiver_ifsc": "PUNB0012300",
        "amount": 2050000.0,
        "txn_type": "RTGS",
    },
    # Hop 1 -> Hop 2 (Layer 1 Intake Mules to Central Mule Hub)
    {
        "utr_number": "UTR202611100003",
        "timestamp_iso": "2026-11-10T10:28:00Z",  # 13 mins velocity
        "sender_account": "ACC-MULE-L1-01",
        "sender_bank": "State Bank of India",
        "sender_ifsc": "SBIN0000691",
        "receiver_account": "ACC-HUB-MULE-CENTRAL",
        "receiver_bank": "Canara Bank",
        "receiver_ifsc": "CNRB0001920",
        "amount": 2450000.0,
        "txn_type": "IMPS",
    },
    {
        "utr_number": "UTR202611100004",
        "timestamp_iso": "2026-11-10T10:48:00Z",  # 18 mins velocity
        "sender_account": "ACC-MULE-L1-02",
        "sender_bank": "Punjab National Bank",
        "sender_ifsc": "PUNB0012300",
        "receiver_account": "ACC-HUB-MULE-CENTRAL",
        "receiver_bank": "Canara Bank",
        "receiver_ifsc": "CNRB0001920",
        "amount": 2000000.0,
        "txn_type": "IMPS",
    },
    # Hop 2 -> Hop 3 (Central Mule Hub to Splitter Mules / Cash-out Channels)
    {
        "utr_number": "UTR202611100005",
        "timestamp_iso": "2026-11-10T11:15:00Z",  # Disbursed in round sums
        "sender_account": "ACC-HUB-MULE-CENTRAL",
        "sender_bank": "Canara Bank",
        "sender_ifsc": "CNRB0001920",
        "receiver_account": "ACC-CASH-MULE-01",
        "receiver_bank": "Bank of Baroda",
        "receiver_ifsc": "BARB0CONNAU",
        "amount": 1000000.0,
        "txn_type": "NEFT",
    },
    {
        "utr_number": "UTR202611100006",
        "timestamp_iso": "2026-11-10T11:20:00Z",
        "sender_account": "ACC-HUB-MULE-CENTRAL",
        "sender_bank": "Canara Bank",
        "sender_ifsc": "CNRB0001920",
        "receiver_account": "ACC-CRYPTO-OTC-GATEWAY",
        "receiver_bank": "Yes Bank",
        "receiver_ifsc": "YESB0000001",
        "amount": 1000000.0,
        "txn_type": "CRYPTO_OTC",
    },
    {
        "utr_number": "UTR202611100007",
        "timestamp_iso": "2026-11-10T11:25:00Z",
        "sender_account": "ACC-HUB-MULE-CENTRAL",
        "sender_bank": "Canara Bank",
        "sender_ifsc": "CNRB0001920",
        "receiver_account": "ACC-CASH-MULE-03",
        "receiver_bank": "Union Bank of India",
        "receiver_ifsc": "UBIN0531234",
        "amount": 1000000.0,
        "txn_type": "IMPS",
    },
    # Hop 3 Cash-outs (ACC-CASH-MULE-01 drained at ATM, MULE-03 still resting!)
    {
        "utr_number": "UTR202611100008",
        "timestamp_iso": "2026-11-10T11:32:00Z",  # 17 mins velocity
        "sender_account": "ACC-CASH-MULE-01",
        "sender_bank": "Bank of Baroda",
        "sender_ifsc": "BARB0CONNAU",
        "receiver_account": "ATM-CASH-WITHDRAWAL-CP",
        "receiver_bank": "Cash Dispenser",
        "receiver_ifsc": "ATM0001",
        "amount": 1000000.0,
        "txn_type": "ATM_CASH",
    },
]


def parse_csv_transactions(csv_content: str) -> List[MoneyTrailTransaction]:
    """Parses standard transaction CSV or CFCFRMS tab/comma export into structured models."""
    transactions: List[MoneyTrailTransaction] = []
    reader = csv.DictReader(io.StringIO(csv_content.strip()))

    for i, row in enumerate(reader):
        clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        utr = (
            clean_row.get("utr_number")
            or clean_row.get("utr")
            or clean_row.get("txn_id")
            or f"UTR-GEN-{i+1000}"
        )
        ts = clean_row.get("timestamp_iso") or clean_row.get("timestamp") or clean_row.get("date") or "2026-11-10T10:00:00Z"
        sender = clean_row.get("sender_account") or clean_row.get("sender") or clean_row.get("remitter") or "UNKNOWN_SENDER"
        receiver = clean_row.get("receiver_account") or clean_row.get("receiver") or clean_row.get("beneficiary") or "UNKNOWN_RECEIVER"
        amt_str = clean_row.get("amount") or clean_row.get("amount_inr") or "0"
        try:
            amt = float(amt_str.replace(",", "").replace("₹", ""))
        except ValueError:
            amt = 0.0

        txn = MoneyTrailTransaction(
            utr_number=utr,
            timestamp_iso=ts,
            sender_account=sender,
            sender_bank=clean_row.get("sender_bank") or "Originating Bank",
            sender_ifsc=clean_row.get("sender_ifsc"),
            receiver_account=receiver,
            receiver_bank=clean_row.get("receiver_bank") or "Beneficiary Bank",
            receiver_ifsc=clean_row.get("receiver_ifsc"),
            amount=amt,
            txn_type=clean_row.get("txn_type", "IMPS").upper(),
        )
        transactions.append(txn)

    return transactions


def parse_timestamp_iso(ts_str: str) -> float:
    """Parses ISO timestamp string to epoch seconds."""
    try:
        # Handle trailing Z
        cleaned = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt.timestamp()
    except Exception:
        return 0.0


def reconstruct_money_trail(
    case_id: str,
    transactions: List[MoneyTrailTransaction],
) -> MoneyTrailAnalysisResponse:
    """
    Reconstructs multi-hop money flow graph, detects bottleneck Mule Hubs,
    calculates transfer velocity, and identifies accounts with active resting balances.
    """
    if not transactions:
        # Load default transactions
        transactions = [MoneyTrailTransaction(**t) for t in DEFAULT_TRANSACTIONS]

    # Map accounts and edges
    all_senders: Set[str] = {t.sender_account for t in transactions}
    all_receivers: Set[str] = {t.receiver_account for t in transactions}
    all_accounts: Set[str] = all_senders.union(all_receivers)

    # Inflow and Outflow maps
    inflow_totals: Dict[str, float] = {acc: 0.0 for acc in all_accounts}
    outflow_totals: Dict[str, float] = {acc: 0.0 for acc in all_accounts}
    inflow_txns: Dict[str, List[MoneyTrailTransaction]] = {acc: [] for acc in all_accounts}
    outflow_txns: Dict[str, List[MoneyTrailTransaction]] = {acc: [] for acc in all_accounts}
    bank_names: Dict[str, str] = {}
    ifsc_codes: Dict[str, str] = {}

    for t in transactions:
        inflow_totals[t.receiver_account] += t.amount
        outflow_totals[t.sender_account] += t.amount
        inflow_txns[t.receiver_account].append(t)
        outflow_txns[t.sender_account].append(t)

        if t.sender_bank and t.sender_bank != "Originating Bank":
            bank_names[t.sender_account] = t.sender_bank
        if t.receiver_bank and t.receiver_bank != "Beneficiary Bank":
            bank_names[t.receiver_account] = t.receiver_bank
        if t.sender_ifsc:
            ifsc_codes[t.sender_account] = t.sender_ifsc
        if t.receiver_ifsc:
            ifsc_codes[t.receiver_account] = t.receiver_ifsc

    # Assign Hop Levels (BFS from zero-inflow nodes as Hop 0)
    hop_levels: Dict[str, int] = {}
    origin_nodes = [acc for acc in all_accounts if inflow_totals[acc] == 0.0]
    if not origin_nodes:
        # Fallback if circular
        origin_nodes = [transactions[0].sender_account]

    for orig in origin_nodes:
        hop_levels[orig] = 0

    # Layer propagation
    queue = list(origin_nodes)
    visited = set(origin_nodes)
    while queue:
        curr = queue.pop(0)
        curr_hop = hop_levels[curr]
        for t in outflow_txns[curr]:
            rec = t.receiver_account
            if rec not in hop_levels or hop_levels[rec] < curr_hop + 1:
                hop_levels[rec] = curr_hop + 1
            if rec not in visited:
                visited.add(rec)
                queue.append(rec)

    # Calculate velocities and node types
    nodes: List[MoneyTrailNode] = []
    mule_hubs: List[str] = []
    total_volume = sum(t.amount for t in transactions if hop_levels.get(t.sender_account, 0) == 0)
    if total_volume == 0:
        total_volume = sum(t.amount for t in transactions)

    active_resting_balance = 0.0

    for acc in sorted(all_accounts, key=lambda a: (hop_levels.get(a, 99), a)):
        in_amt = inflow_totals[acc]
        out_amt = outflow_totals[acc]
        resting = max(0.0, in_amt - out_amt)
        hop = hop_levels.get(acc, 1)

        in_cnt = len(inflow_txns[acc])
        out_cnt = len(outflow_txns[acc])

        # Velocity calculation: elapsed minutes between first deposit and first onward transfer
        velocity_mins: Optional[float] = None
        if in_cnt > 0 and out_cnt > 0:
            first_in_time = min(parse_timestamp_iso(t.timestamp_iso) for t in inflow_txns[acc])
            first_out_time = min(parse_timestamp_iso(t.timestamp_iso) for t in outflow_txns[acc])
            if first_out_time >= first_in_time and first_in_time > 0:
                velocity_mins = round((first_out_time - first_in_time) / 60.0, 1)

        # Mule Hub Detection:
        # An account that aggregates multiple inflows (fan-in >= 2) and disburses onward
        is_hub = False
        hub_score = 0.0
        if in_cnt >= 2 and (out_cnt >= 1 or in_amt >= 2000000.0):
            is_hub = True
            hub_score = round(min(100.0, (in_cnt * 25.0) + (in_amt / 100000.0) + (out_cnt * 10.0)), 1)
            mule_hubs.append(acc)

        # Node type classification
        if hop == 0:
            node_type = "victim"
            label = f"Victim: {acc}"
        elif "ATM" in acc.upper() or "CRYPTO" in acc.upper() or "DISPENSER" in acc.upper() or "ESCROW" in acc.upper():
            node_type = "exit_channel"
            label = f"Exit Point: {acc}"
        elif is_hub:
            node_type = "mule_hub"
            label = f"Mule Hub: {acc}"
        elif hop == 1:
            node_type = "primary_mule"
            label = f"Layer 1 Mule: {acc}"
        else:
            node_type = "splitter_mule"
            label = f"Splitter Mule: {acc}"

        # Freeze Priority Assignment:
        # Crucial for officers: focus freeze directives on accounts where money is CURRENTLY RESTING!
        if node_type != "victim" and node_type != "exit_channel" and resting > 10000.0:
            freeze_prio = "TIER_1_CRITICAL_RESTING"
            active_resting_balance += resting
        elif velocity_mins is not None and velocity_mins < 30.0 and out_cnt > 0:
            freeze_prio = "TIER_2_HIGH_VELOCITY"
        else:
            freeze_prio = "TIER_3_MONITOR"

        nodes.append(
            MoneyTrailNode(
                account_id=acc,
                label=label,
                bank_name=bank_names.get(acc, "Commercial Bank"),
                ifsc_code=ifsc_codes.get(acc, "IFSC0001"),
                node_type=node_type,
                hop_level=hop,
                total_inflow=in_amt,
                total_outflow=out_amt,
                resting_balance=resting,
                inflow_count=in_cnt,
                outflow_count=out_cnt,
                is_mule_hub=is_hub,
                mule_hub_score=hub_score,
                transfer_velocity_minutes=velocity_mins,
                freeze_priority=freeze_prio,
            )
        )

    # Edge creation with hop info
    edges: List[MoneyTrailHopFlow] = []
    for t in transactions:
        from_h = hop_levels.get(t.sender_account, 0)
        to_h = hop_levels.get(t.receiver_account, from_h + 1)
        edges.append(
            MoneyTrailHopFlow(
                from_hop=from_h,
                to_hop=to_h,
                source_node=t.sender_account,
                target_node=t.receiver_account,
                amount=t.amount,
                utr_number=t.utr_number,
                timestamp_iso=t.timestamp_iso,
            )
        )

    # Sankey Diagram Data
    sankey_nodes: List[SankeyNode] = [
        SankeyNode(
            id=n.account_id,
            name=n.label,
            hop=n.hop_level,
            category=n.node_type,
            amount=n.total_inflow if n.total_inflow > 0 else n.total_outflow,
        )
        for n in nodes
    ]
    sankey_links: List[SankeyLink] = [
        SankeyLink(
            source=t.sender_account,
            target=t.receiver_account,
            value=t.amount,
            utr=t.utr_number,
        )
        for t in transactions
    ]
    sankey_data = SankeyDiagramData(nodes=sankey_nodes, links=sankey_links)

    # Section 102 CrPC Asset Attachment Schedule Generation
    schedule_items: List[Section102CrPCScheduleItem] = []
    sched_idx = 1
    # Sort accounts by resting balance descending to prioritize freeze notices
    attachment_targets = [n for n in nodes if n.node_type not in ("victim", "exit_channel") and n.total_inflow > 0]
    attachment_targets.sort(key=lambda x: (x.freeze_priority == "TIER_1_CRITICAL_RESTING", x.resting_balance), reverse=True)

    for target in attachment_targets:
        related_utrs = [t.utr_number for t in transactions if t.receiver_account == target.account_id]
        statutory_reason = (
            f"Funds identified as proceeds of cybercrime under Section 102 CrPC / Section 107 BNSS. "
            f"Account received ₹{target.total_inflow:,.2f} via {len(related_utrs)} transactions; "
            f"estimated unwithdrawn resting balance of ₹{target.resting_balance:,.2f} is subject to immediate debit freeze."
        )
        schedule_items.append(
            Section102CrPCScheduleItem(
                schedule_index=sched_idx,
                beneficiary_account=target.account_id,
                bank_name=target.bank_name,
                ifsc_code=target.ifsc_code or "IFSC0001",
                branch_name=f"{target.bank_name} Main Branch",
                suspect_name=f"Holder of {target.account_id}",
                seized_amount_resting_inr=target.resting_balance,
                total_fraud_received_inr=target.total_inflow,
                utr_references=related_utrs,
                freeze_mandate_priority=target.freeze_priority,
                statutory_grounds=statutory_reason,
            )
        )
        sched_idx += 1

    schedule_id = f"SCHED-102-{case_id.replace('CASE-', '')}-{int(time.time())}"
    now_iso = datetime.now(timezone.utc).isoformat()
    sched_hash_seed = f"{schedule_id}|{case_id}|{active_resting_balance}|{len(schedule_items)}|{now_iso}"
    schedule_hash = hashlib.sha256(sched_hash_seed.encode("utf-8")).hexdigest()

    section_102 = Section102CrPCScheduleResponse(
        schedule_id=schedule_id,
        case_id=case_id,
        investigating_officer="Inspector R. K. Sharma (Cyber Crime Cell)",
        police_station="Special Cyber Crime Police Station, Central District",
        total_resting_amount_inr=active_resting_balance,
        total_dispersed_amount_inr=total_volume - active_resting_balance,
        accounts_count=len(schedule_items),
        mule_hubs_count=len(mule_hubs),
        items=schedule_items,
        statutory_declaration=(
            "I, the undersigned Investigating Officer, hereby certify that the electronic accounts specified in this "
            "Schedule have been identified through multi-hop cryptographic money-trail reconstruction as recipient "
            "conduits for stolen cybercrime funds. Under powers conferred by Section 102 Code of Criminal Procedure, 1973 "
            "(Section 107 Bharatiya Nagarik Suraksha Sanhita, 2023), immediate provisional freeze of all debit operations "
            "is hereby ordered to prevent dissipation of tainted assets."
        ),
        generated_at_iso=now_iso,
        schedule_hash=schedule_hash,
    )

    victims_count = sum(1 for n in nodes if n.node_type == "victim")
    mules_count = sum(1 for n in nodes if n.node_type in ("primary_mule", "mule_hub", "splitter_mule"))

    return MoneyTrailAnalysisResponse(
        case_id=case_id,
        total_volume_inr=total_volume,
        total_victims=victims_count,
        total_mules=mules_count,
        mule_hubs=mule_hubs,
        active_resting_balance_inr=active_resting_balance,
        nodes=nodes,
        edges=edges,
        sankey_data=sankey_data,
        section_102_schedule=section_102,
    )
