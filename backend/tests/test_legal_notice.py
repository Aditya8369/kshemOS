"""
Unit and integration tests for Automated Section 102 CrPC / Section 106 BNSS
statutory legal notice and PDF generation service.
"""
import io
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import legal_notice_service


@pytest.fixture
def client():
    return TestClient(app)


SAMPLE_ACCOUNTS = [
    {
        "account_id": "ACC-HUB-MULE-CENTRAL",
        "bank_name": "Canara Bank",
        "ifsc_code": "CNRB0001920",
        "resting_balance": 1400000.0,
        "total_inflow": 4400000.0,
        "utr_references": ["UTR202611100003", "UTR202611100004"],
        "freeze_priority": "TIER_1_CRITICAL_RESTING",
        "is_mule_hub": True,
        "transfer_velocity_minutes": 17.5,
    },
    {
        "account_id": "ACC-MULE-L1-01",
        "bank_name": "State Bank of India",
        "ifsc_code": "SBIN0000691",
        "resting_balance": 100000.0,
        "total_inflow": 2500000.0,
        "utr_references": ["UTR202611100001"],
        "freeze_priority": "TIER_1_CRITICAL_RESTING",
        "is_mule_hub": False,
        "transfer_velocity_minutes": 13.0,
    },
]


def test_bank_nodal_directory_loading_and_lookup():
    """Verify that Indian bank nodal directory loads and provides accurate routing."""
    directory = legal_notice_service.load_bank_nodal_directory()
    assert "banks" in directory
    assert len(directory["banks"]) >= 5

    # Test lookup by IFSC prefix for SBI
    sbi = legal_notice_service.lookup_bank_nodal_info(ifsc="SBIN0000691")
    assert sbi["bank_code"] == "SBIN"
    assert "sbi.co.in" in sbi["cyber_desk_email"]
    assert "State Bank of India" in sbi["bank_name"]

    # Test lookup by IFSC prefix for Canara Bank
    canara = legal_notice_service.lookup_bank_nodal_info(ifsc="CNRB0001920")
    assert canara["bank_code"] == "CNRB"
    assert "canarabank.com" in canara["cyber_desk_email"]

    # Test lookup by bank name substring
    hdfc = legal_notice_service.lookup_bank_nodal_info(bank_name="HDFC Bank")
    assert hdfc["bank_code"] == "HDFC"
    assert "hdfcbank.com" in hdfc["cyber_desk_email"]

    # Test generic fallback for unknown bank
    fallback = legal_notice_service.lookup_bank_nodal_info(ifsc="XYZB0001111", bank_name="XYZ Rural Bank")
    assert fallback["bank_code"] == "XYZB"
    assert "@xyzb.co.in" in fallback["cyber_desk_email"]


def test_section_102_notice_data_construction():
    """Verify construction of canonical notice metadata, statutory language, and SHA-256 digest."""
    notice_data = legal_notice_service.generate_section_102_notice_data(
        case_id="CASE-2026-DELHI-01",
        accounts=SAMPLE_ACCOUNTS,
        officer_name="Inspector R. K. Sharma",
        officer_badge_id="CYBER-INV-7749",
        police_station="Special Cyber Crime Police Station, Central District, Delhi",
        fir_number="FIR-2026-DELHI-01-CYBER",
        court_jurisdiction="IN THE COURT OF CHIEF METROPOLITAN MAGISTRATE, TIS HAZARI COURTS, DELHI",
    )

    # Statutory references
    assert "Section 102 Cr.P.C." in notice_data["statutory_authority"]
    assert "Section 106 BNSS" in notice_data["statutory_authority"]
    assert "Section 91 Cr.P.C." in notice_data["statutory_authority"]
    assert "Section 94 BNSS" in notice_data["statutory_authority"]

    # Officer & Court details
    assert notice_data["issuing_authority"]["officer_name"] == "Inspector R. K. Sharma"
    assert notice_data["issuing_authority"]["officer_badge_id"] == "CYBER-INV-7749"
    assert "Tis Hazari" in notice_data["court_jurisdiction"]
    assert notice_data["fir_number"] == "FIR-2026-DELHI-01-CYBER"

    # Accounts and financial verification
    assert len(notice_data["accounts"]) == 2
    assert notice_data["total_freeze_amount_inr"] == 1500000.0

    hub_acc = next(a for a in notice_data["accounts"] if a["account_id"] == "ACC-HUB-MULE-CENTRAL")
    assert hub_acc["is_mule_hub"] is True
    assert "UTR202611100003" in hub_acc["utr_references"]
    assert "canarabank.com" in hub_acc["cyber_desk_email"]

    # SHA-256 genesis digest
    assert "sha256_digest" in notice_data
    assert len(notice_data["sha256_digest"]) == 64


def test_section_102_pdf_generation():
    """Verify official PDF document rendering with ReportLab and embedded QR code."""
    notice_data = legal_notice_service.generate_section_102_notice_data(
        case_id="CASE-2026-DELHI-01",
        accounts=SAMPLE_ACCOUNTS,
        officer_name="Inspector R. K. Sharma",
        officer_badge_id="CYBER-INV-7749",
    )

    pdf_bytes = legal_notice_service.generate_section_102_pdf(notice_data)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    # PDF magic byte signature
    assert pdf_bytes.startswith(b"%PDF-")
    # PDF trailer
    assert b"%%EOF" in pdf_bytes


def test_api_nodal_directory_endpoint(client):
    """Verify GET /api/money-trail/nodal-directory endpoint."""
    response = client.get("/api/money-trail/nodal-directory")
    assert response.status_code == 200
    data = response.json()
    assert "banks" in data
    assert any(b.get("bank_code") == "SBIN" for b in data["banks"])


def test_api_preview_notice_endpoint(client):
    """Verify POST /api/money-trail/preview-notice endpoint."""
    payload = {
        "case_id": "CASE-2026-DELHI-01",
        "officer_name": "Inspector R. K. Sharma",
        "officer_badge_id": "CYBER-INV-7749",
        "account_ids": ["ACC-HUB-MULE-CENTRAL"],
    }
    response = client.post("/api/money-trail/preview-notice", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "requisition_id" in data
    assert "sha256_digest" in data
    assert len(data["accounts"]) >= 1
    assert "Section 102" in data["statutory_authority"]


def test_api_generate_notice_pdf_endpoint(client):
    """Verify POST /api/money-trail/generate-notice-pdf returns court-ready PDF attachment."""
    payload = {
        "case_id": "CASE-2026-DELHI-01",
        "officer_name": "Inspector R. K. Sharma",
        "officer_badge_id": "CYBER-INV-7749",
        "resting_balance_threshold_inr": 50000.0,
    }
    response = client.post("/api/money-trail/generate-notice-pdf", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment;" in response.headers["content-disposition"]
    assert "Section_102_CrPC_Freeze_Order_" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 1000
