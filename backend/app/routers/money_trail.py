"""
FastAPI Router for Syndicate Mule Ring Money-Trail Visualizer & Flow Hop Reconstructor.

Provides endpoints to:
1. Ingest multi-hop bank/UPI transaction logs (CSV, CFCFRMS).
2. Reconstruct hop-by-hop money flows (Victims -> Layer 1 Mules -> Mule Hubs -> Exit Channels).
3. Identify Mule Hub concentration bottlenecks and calculate transfer velocities.
4. Prioritize freeze orders on active accounts where funds are still resting.
5. Generate Section 102 CrPC / Section 107 BNSS asset attachment schedules.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models import (
    MoneyTrailAnalysisResponse,
    MoneyTrailIngestionRequest,
    Section102CrPCScheduleResponse,
)
from app.services import money_trail_service

router = APIRouter(prefix="/api/money-trail", tags=["Syndicate Money Trail & Hop Reconstructor"])


SAMPLE_CSV_DATA = """utr_number,timestamp_iso,sender_account,sender_bank,sender_ifsc,receiver_account,receiver_bank,receiver_ifsc,amount,txn_type
UTR202611100001,2026-11-10T10:15:00Z,VICTIM-DR-SEN,HDFC Bank,HDFC0001234,ACC-MULE-L1-01,State Bank of India,SBIN0000691,2500000.0,RTGS
UTR202611100002,2026-11-10T10:20:00Z,VICTIM-MRS-KAPOOR,ICICI Bank,ICIC0000456,ACC-MULE-L1-02,Punjab National Bank,PUNB0123400,2050000.0,RTGS
UTR202611100003,2026-11-10T10:28:00Z,ACC-MULE-L1-01,State Bank of India,SBIN0000691,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,2400000.0,IMPS
UTR202611100004,2026-11-10T10:38:00Z,ACC-MULE-L1-02,Punjab National Bank,PUNB0123400,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,2000000.0,IMPS
UTR202611100005,2026-11-10T10:55:00Z,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,ACC-CASH-MULE-01,Bank of Baroda,BARB0CONNAU,1000000.0,IMPS
UTR202611100006,2026-11-10T10:58:00Z,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,ACC-CASH-MULE-02,Axis Bank,UTIB0000888,1000000.0,IMPS
UTR202611100007,2026-11-10T11:02:00Z,ACC-HUB-MULE-CENTRAL,Canara Bank,CNRB0001920,ACC-CASH-MULE-03,Union Bank of India,UBIN0531234,1000000.0,IMPS
UTR202611100008,2026-11-10T11:15:00Z,ACC-CASH-MULE-01,Bank of Baroda,BARB0CONNAU,ATM-CASH-WITHDRAWAL-CP,Cash Dispenser,ATM0001,1000000.0,ATM_CASH
UTR202611100009,2026-11-10T11:20:00Z,ACC-CASH-MULE-02,Axis Bank,UTIB0000888,CRYPTO-P2P-ESCROW-X,P2P Exchange Desk,CRYP0001,1000000.0,CRYPTO_BUY
"""


@router.get("/analysis", response_model=MoneyTrailAnalysisResponse)
def get_money_trail_analysis(case_id: Optional[str] = Query(None, description="Case identifier")):
    """
    Retrieve full multi-hop money trail analysis, including layer distribution,
    Mule Hub bottleneck scoring, transfer velocity, and resting balance freeze priorities.
    """
    target_case = case_id or money_trail_service.DEFAULT_CASE_ID
    # Default pre-seeded analysis
    result = money_trail_service.reconstruct_money_trail(case_id=target_case, transactions=[])
    return result


@router.post("/ingest", response_model=MoneyTrailAnalysisResponse)
def ingest_transactions(payload: MoneyTrailIngestionRequest):
    """
    Ingest structured transaction logs (CSV text or list of transaction objects)
    and reconstruct the multi-hop money flow graph.
    """
    try:
        transactions = []
        if payload.raw_csv:
            transactions = money_trail_service.parse_csv_transactions(payload.raw_csv)
        elif payload.transactions:
            transactions = payload.transactions
        else:
            # Fallback to default pre-seeded transactions
            transactions = []

        result = money_trail_service.reconstruct_money_trail(
            case_id=payload.case_id or money_trail_service.DEFAULT_CASE_ID,
            transactions=transactions,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to ingest and reconstruct money trail: {str(exc)}",
        )


@router.get("/section-102-schedule", response_model=Section102CrPCScheduleResponse)
def get_section_102_schedule(case_id: Optional[str] = Query(None, description="Case identifier")):
    """
    Retrieve the court-ready Section 102 CrPC (Section 107 BNSS) asset attachment
    schedule for the specified case, sorted by resting balance descending.
    """
    target_case = case_id or money_trail_service.DEFAULT_CASE_ID
    analysis = money_trail_service.reconstruct_money_trail(case_id=target_case, transactions=[])
    return analysis.section_102_schedule


@router.get("/sample-csv")
def get_sample_csv():
    """Returns sample CSV format data for testing and one-click demonstration."""
    return {
        "format": "CSV",
        "csv_data": SAMPLE_CSV_DATA.strip(),
        "description": "Pre-configured digital arrest scam money trail with ₹45.5L dispersed across 4 hops.",
    }
