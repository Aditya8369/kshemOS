"""
Unit and Integration Tests for Syndicate Mule Ring Money-Trail Visualizer & Flow Hop Reconstructor.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models import MoneyTrailIngestionRequest, MoneyTrailTransaction
from app.routers.money_trail import (
    get_money_trail_analysis,
    get_sample_csv,
    get_section_102_schedule,
    ingest_transactions,
)
from app.services import money_trail_service
from app.services.money_trail_service import (
    DEFAULT_CASE_ID,
    parse_csv_transactions,
    reconstruct_money_trail,
)


def test_parse_csv_transactions():
    """Verify robust parsing of transaction logs formatted with variations."""
    csv_input = """utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type
UTR990001,2026-11-10T09:00:00Z,VIC-101,Axis Bank,UTIB0001,MULE-L1,ICICI Bank,ICIC0002,"1,50,000",IMPS
UTR990002,2026-11-10T09:12:00Z,MULE-L1,ICICI Bank,ICIC0002,MULE-L2,SBI,SBIN0001,₹140000,NEFT
"""
    txns = parse_csv_transactions(csv_input)
    assert len(txns) == 2
    assert txns[0].utr_number == "UTR990001"
    assert txns[0].sender_account == "VIC-101"
    assert txns[0].receiver_account == "MULE-L1"
    assert txns[0].amount == 150000.0
    assert txns[0].txn_type == "IMPS"

    assert txns[1].utr_number == "UTR990002"
    assert txns[1].amount == 140000.0
    assert txns[1].sender_account == "MULE-L1"
    assert txns[1].receiver_account == "MULE-L2"


def test_reconstruct_money_trail_default_case():
    """Verify default pre-seeded digital arrest money trail graph reconstruction."""
    analysis = reconstruct_money_trail(DEFAULT_CASE_ID, [])
    assert analysis.case_id == DEFAULT_CASE_ID
    assert analysis.total_volume_inr == 4550000.0
    assert analysis.total_victims == 2
    assert analysis.total_mules >= 4

    # Mule Hub identification
    assert "ACC-HUB-MULE-CENTRAL" in analysis.mule_hubs

    # Node validation
    nodes_by_acc = {n.account_id: n for n in analysis.nodes}
    assert "VICTIM-DR-SEN" in nodes_by_acc
    assert nodes_by_acc["VICTIM-DR-SEN"].hop_level == 0
    assert nodes_by_acc["VICTIM-DR-SEN"].node_type == "victim"

    hub_node = nodes_by_acc["ACC-HUB-MULE-CENTRAL"]
    assert hub_node.hop_level == 2
    assert hub_node.node_type == "mule_hub"
    assert hub_node.is_mule_hub is True
    assert hub_node.mule_hub_score >= 60.0
    assert hub_node.inflow_count == 2
    assert hub_node.outflow_count == 3
    # Inflow = 24L + 20L = 44L; Outflow = 10L + 9.5L + 10L = 29.5L => Resting = 14.5L
    assert hub_node.resting_balance == 1450000.0
    assert hub_node.freeze_priority == "TIER_1_CRITICAL_RESTING"


def test_transfer_velocity_and_resting_balances():
    """Verify velocity minutes between deposit and onward disbursement, and zero resting balances for drained accounts."""
    analysis = reconstruct_money_trail("CASE-TEST-01", [])
    nodes_by_acc = {n.account_id: n for n in analysis.nodes}

    # ACC-MULE-L1-01 received at 10:15:00 and dispersed at 10:28:00 => 13 minutes velocity
    l1_01 = nodes_by_acc["ACC-MULE-L1-01"]
    assert l1_01.transfer_velocity_minutes == 13.0
    assert l1_01.resting_balance == 50000.0  # 25L in - 24.5L out

    # ACC-MULE-L1-02 received at 10:20:00 and dispersed at 10:38:00 => 18 minutes velocity
    l1_02 = nodes_by_acc["ACC-MULE-L1-02"]
    assert l1_02.transfer_velocity_minutes == 18.0
    assert l1_02.resting_balance == 50000.0  # 20.5L in - 20.0L out

    # ACC-CASH-MULE-01 received 10L, withdrew 10L at ATM => resting balance 0, high velocity
    cash_mule_01 = nodes_by_acc["ACC-CASH-MULE-01"]
    assert cash_mule_01.resting_balance == 0.0
    assert cash_mule_01.freeze_priority == "TIER_2_HIGH_VELOCITY"

    # ACC-CASH-MULE-03 received 10L, no onward transfer => 10L resting, critical freeze!
    cash_mule_03 = nodes_by_acc["ACC-CASH-MULE-03"]
    assert cash_mule_03.resting_balance == 1000000.0
    assert cash_mule_03.freeze_priority == "TIER_1_CRITICAL_RESTING"


def test_sankey_diagram_structure():
    """Verify Sankey nodes and links are properly indexed and matched."""
    analysis = reconstruct_money_trail("CASE-SANKEY", [])
    sankey = analysis.sankey_data

    assert len(sankey.nodes) > 0
    assert len(sankey.links) > 0

    node_ids = {n.id for n in sankey.nodes}
    for link in sankey.links:
        assert link.source in node_ids
        assert link.target in node_ids
        assert link.value > 0
        assert link.utr.startswith("UTR")


def test_section_102_crpc_schedule():
    """Verify Section 102 CrPC schedule output conforms to police freezing requisitions."""
    analysis = reconstruct_money_trail("CASE-2026-DELHI-01", [])
    schedule = analysis.section_102_schedule

    assert schedule.case_id == "CASE-2026-DELHI-01"
    assert schedule.schedule_id.startswith("SCHED-102-")
    assert len(schedule.schedule_hash) == 64  # SHA-256
    assert schedule.total_resting_amount_inr > 0
    assert len(schedule.items) > 0

    # Ensure items are sorted with critical resting accounts at the top
    first_item = schedule.items[0]
    assert first_item.freeze_mandate_priority == "TIER_1_CRITICAL_RESTING"
    assert first_item.seized_amount_resting_inr > 0
    assert "Section 102 CrPC" in first_item.statutory_grounds


def test_api_get_analysis():
    """Test get_money_trail_analysis router handler."""
    data = get_money_trail_analysis(case_id=DEFAULT_CASE_ID)
    assert data.case_id == DEFAULT_CASE_ID
    assert data.total_volume_inr == 4550000.0
    assert "ACC-HUB-MULE-CENTRAL" in data.mule_hubs
    assert len(data.nodes) > 0
    assert len(data.edges) > 0
    assert len(data.sankey_data.links) > 0


def test_api_ingest_custom_csv():
    """Test ingest_transactions router handler with custom CSV."""
    custom_csv = """utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type
TXN001,2026-11-10T08:00:00Z,VICTIM_A,SBI,SBIN001,MULE_LAYER1,HDFC,HDFC001,500000,IMPS
TXN002,2026-11-10T08:15:00Z,MULE_LAYER1,HDFC,HDFC001,MULE_EXIT,ICICI,ICIC001,500000,RTGS
"""
    payload = MoneyTrailIngestionRequest(
        case_id="CASE-CUSTOM-INGEST-01",
        raw_csv=custom_csv,
        format="CSV",
    )
    data = ingest_transactions(payload=payload)
    assert data.case_id == "CASE-CUSTOM-INGEST-01"
    assert data.total_volume_inr == 500000.0
    assert data.total_victims == 1
    assert len(data.edges) == 2


def test_api_get_section_102_schedule():
    """Test get_section_102_schedule router handler."""
    data = get_section_102_schedule(case_id="CASE-DELHI-ATTACH")
    assert data.case_id == "CASE-DELHI-ATTACH"
    assert data.accounts_count > 0
    assert "Section 102 Code of Criminal Procedure" in data.statutory_declaration


def test_api_sample_csv():
    """Test get_sample_csv router handler."""
    data = get_sample_csv()
    assert data["format"] == "CSV"
    assert "UTR202611100001" in data["csv_data"]
