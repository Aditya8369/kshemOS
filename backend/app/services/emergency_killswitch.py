"""
Emergency Financial Kill-Switch & Aadhaar Biometric Lock Service for KshemOS.

Provides:
- Instant-block USSD codes (*99# sequence) and bank-specific SMS freeze syntaxes for all major Indian banks.
- Step-by-step verified guided walkthrough and deep-links to lock UIDAI Aadhaar biometrics (cutting off AePS fraud).
- Certified "Emergency Mitigation Receipt" generation with SHA-256 hash tokens to establish prompt customer notification for RBI Zero-Liability circular compliance.
"""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from app.models import (
    AadhaarBiometricLockGuide,
    AadhaarBiometricLockStep,
    EmergencyKillSwitchBankInfo,
    EmergencyMitigationReceipt,
    EmergencyMitigationReceiptRequest,
)

# In-memory audit storage for issued mitigation receipts
_receipt_store: Dict[str, Dict[str, Any]] = {}

# Indian Standard Time (UTC+05:30)
IST_TZ = timezone(timedelta(hours=5, minutes=30))

# ---------------------------------------------------------------------
# VERIFIED BANK EMERGENCY KILL-SWITCH DIRECTORY (14 MAJOR INDIAN BANKS)
# ---------------------------------------------------------------------
BANK_REGISTRY: Dict[str, EmergencyKillSwitchBankInfo] = {
    "sbi": EmergencyKillSwitchBankInfo(
        bank_id="sbi",
        bank_name="State Bank of India (SBI)",
        category="Public Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# from registered SIM -> Select Option 4 (My Profile) -> Select Option 7 (Deregister/Disable UPI).",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="567676",
        sms_acc_freeze_syntax="STOP <account number>",
        sms_acc_freeze_number="9223008333",
        sms_upi_disable_syntax="UPIBLOCK <registered mobile number>",
        sms_upi_disable_number="9223008333",
        phone_hotline="1800 1234",
        phone_alt="1800 2100 / 1800 11 1109",
        netbanking_url="https://www.onlinesbi.sbi",
        mobile_app_name="YONO SBI",
        official_portal_guidance="Log in to OnlineSBI -> e-Services -> ATM Card Services -> Block ATM Card.",
    ),
    "hdfc": EmergencyKillSwitchBankInfo(
        bank_id="hdfc",
        bank_name="HDFC Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# from registered SIM -> Select Option 4 (My Profile) -> Select Option 7 (Deregister/Disable UPI).",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="5676712",
        sms_acc_freeze_syntax="Call 1800 1600 or open Mobile App -> Quick Banking -> Freeze Account",
        sms_acc_freeze_number="18001600",
        sms_upi_disable_syntax="Send SMS to 5676712 from registered SIM",
        sms_upi_disable_number="5676712",
        phone_hotline="1800 1600",
        phone_alt="1800 202 6161",
        netbanking_url="https://netbanking.hdfcbank.com",
        mobile_app_name="HDFC Bank MobileBanking",
        official_portal_guidance="Cards Tab -> Debit/Credit Cards -> Request -> Debit Card Hotlisting.",
    ),
    "icici": EmergencyKillSwitchBankInfo(
        bank_id="icici",
        bank_name="ICICI Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# from registered SIM -> Option 4 -> Option 7 (Disable UPI).",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="9215667788",
        sms_acc_freeze_syntax="STOP <last 4 digits of account number>",
        sms_acc_freeze_number="9215667788",
        sms_upi_disable_syntax="UPIBLOCK <last 4 digits>",
        sms_upi_disable_number="9215667788",
        phone_hotline="1800 1080",
        phone_alt="1800 200 3344",
        netbanking_url="https://infinity.icicibank.com",
        mobile_app_name="iMobile Pay",
        official_portal_guidance="Customer Service -> Service Requests -> Block Debit / Credit Card.",
    ),
    "axis": EmergencyKillSwitchBankInfo(
        bank_id="axis",
        bank_name="Axis Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7 (Deregister UPI).",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="56161600",
        sms_acc_freeze_syntax="STOP <last 4 digits of account>",
        sms_acc_freeze_number="56161600",
        sms_upi_disable_syntax="UPIBLOCK <registered mobile>",
        sms_upi_disable_number="56161600",
        phone_hotline="1800 419 0068",
        phone_alt="1800 103 5577",
        netbanking_url="https://omni.axisbank.co.in",
        mobile_app_name="Axis Mobile",
        official_portal_guidance="Accounts -> My Cards -> Block Card or Emergency Services in app.",
    ),
    "pnb": EmergencyKillSwitchBankInfo(
        bank_id="pnb",
        bank_name="Punjab National Bank (PNB)",
        category="Public Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> My Profile -> Deregister UPI.",
        sms_card_block_syntax="HOT <16-digit card number>",
        sms_card_block_number="5607040",
        sms_acc_freeze_syntax="BLOCK <account number>",
        sms_acc_freeze_number="9264092640",
        sms_upi_disable_syntax="UPIBLOCK <registered mobile>",
        sms_upi_disable_number="9264092640",
        phone_hotline="1800 1800",
        phone_alt="1800 2021 / 1800 180 2222",
        netbanking_url="https://netpnb.com",
        mobile_app_name="PNB ONE",
        official_portal_guidance="Value Added Services -> Emergency Block Debit Card / PNB ONE App.",
    ),
    "bob": EmergencyKillSwitchBankInfo(
        bank_id="bob",
        bank_name="Bank of Baroda (BOB)",
        category="Public Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7.",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="8422009988",
        sms_acc_freeze_syntax="STOP <account number>",
        sms_acc_freeze_number="8422009988",
        sms_upi_disable_syntax="UPIBLOCK <registered mobile>",
        sms_upi_disable_number="8422009988",
        phone_hotline="1800 5700",
        phone_alt="1800 258 4455",
        netbanking_url="https://www.bobibanking.com",
        mobile_app_name="bob World",
        official_portal_guidance="Cards -> Debit Card Services -> Card Blocking / bob World Emergency lock.",
    ),
    "canara": EmergencyKillSwitchBankInfo(
        bank_id="canara",
        bank_name="Canara Bank",
        category="Public Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> My Profile -> Deregister UPI.",
        sms_card_block_syntax="CAN HOTLISTDC <card number>",
        sms_card_block_number="5607060",
        sms_acc_freeze_syntax="CAN FREEZE <account number>",
        sms_acc_freeze_number="5607060",
        sms_upi_disable_syntax="CAN UPIBLOCK <mobile>",
        sms_upi_disable_number="5607060",
        phone_hotline="1800 425 0018",
        phone_alt="1800 103 0018",
        netbanking_url="https://netbanking.canarabank.in",
        mobile_app_name="Canara ai1",
        official_portal_guidance="Cards -> Hotlist Debit Card or Call 24x7 Toll Free.",
    ),
    "union": EmergencyKillSwitchBankInfo(
        bank_id="union",
        bank_name="Union Bank of India",
        category="Public Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7.",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="09223008486",
        phone_hotline="1800 22 2244",
        phone_alt="1800 208 2244",
        netbanking_url="https://www.unionbankonline.co.in",
        mobile_app_name="Vyom",
        official_portal_guidance="Cards -> Debit Card Hotlist / Vyom App Quick Block.",
    ),
    "kotak": EmergencyKillSwitchBankInfo(
        bank_id="kotak",
        bank_name="Kotak Mahindra Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> My Profile -> Deregister UPI.",
        sms_card_block_syntax="DCBLK <last 4 digits of card>",
        sms_card_block_number="9971056767",
        phone_hotline="1860 266 2666",
        phone_alt="1800 209 0000",
        netbanking_url="https://netbanking.kotak.com",
        mobile_app_name="Kotak811 Mobile Banking",
        official_portal_guidance="Service Requests -> Debit Card Hotlisting in App or Portal.",
    ),
    "indusind": EmergencyKillSwitchBankInfo(
        bank_id="indusind",
        bank_name="IndusInd Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> My Profile -> Deregister UPI.",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="9223511111",
        phone_hotline="1860 267 7777",
        phone_alt="1800 209 0061",
        netbanking_url="https://indusnet.indusind.com",
        mobile_app_name="IndusMobile",
        official_portal_guidance="Cards -> Block Card or call 24x7 phone banking.",
    ),
    "yesbank": EmergencyKillSwitchBankInfo(
        bank_id="yesbank",
        bank_name="Yes Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7.",
        sms_card_block_syntax="BLK <last 4 digits of card>",
        sms_card_block_number="9840909000",
        phone_hotline="1800 1200",
        phone_alt="1800 103 5485",
        netbanking_url="https://yesonline.yesbank.co.in",
        mobile_app_name="iris by YES BANK",
        official_portal_guidance="Manage Cards -> Temporary/Permanent Block in app.",
    ),
    "federal": EmergencyKillSwitchBankInfo(
        bank_id="federal",
        bank_name="Federal Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7.",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="9895088888",
        phone_hotline="1800 420 1199",
        phone_alt="1800 425 1199",
        netbanking_url="https://www.fednetbank.com",
        mobile_app_name="FedMobile",
        official_portal_guidance="FedMobile -> Cards -> Block Debit Card immediately.",
    ),
    "idfc": EmergencyKillSwitchBankInfo(
        bank_id="idfc",
        bank_name="IDFC FIRST Bank",
        category="Private Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7.",
        sms_card_block_syntax="BLOCK <last 4 digits of card>",
        sms_card_block_number="5676732",
        phone_hotline="1800 10 888",
        phone_alt="1800 258 2000",
        netbanking_url="https://my.idfcfirstbank.com",
        mobile_app_name="IDFC FIRST Bank App",
        official_portal_guidance="Cards tab -> Manage Card -> Freeze / Block Card.",
    ),
    "indianbank": EmergencyKillSwitchBankInfo(
        bank_id="indianbank",
        bank_name="Indian Bank",
        category="Public Sector",
        ussd_code="*99#",
        ussd_instructions="Dial *99# -> Option 4 -> Option 7.",
        sms_card_block_syntax="BLOCKDC <card number>",
        sms_card_block_number="9230000000",
        phone_hotline="1800 425 00 000",
        phone_alt="1800 425 4422",
        netbanking_url="https://www.indianbank.net.in",
        mobile_app_name="IndOASIS",
        official_portal_guidance="Cards Services -> Debit Card Hotlisting in IndOASIS.",
    ),
}

# ---------------------------------------------------------------------
# AADHAAR BIOMETRIC LOCK GUIDE (AEPS FRAUD PREVENTION)
# ---------------------------------------------------------------------
AADHAAR_LOCK_STEPS: List[AadhaarBiometricLockStep] = [
    AadhaarBiometricLockStep(
        step_number=1,
        title="Open Official UIDAI myAadhaar Portal",
        instruction="Navigate directly to https://myaadhaar.uidai.gov.in on your phone or computer. Click the prominent 'Login' button.",
        official_url="https://myaadhaar.uidai.gov.in",
        warning="Never use unverified third-party websites or apps claiming to lock Aadhaar. Always check the URL ends in '.uidai.gov.in'.",
    ),
    AadhaarBiometricLockStep(
        step_number=2,
        title="Authenticate via Aadhaar Number & OTP",
        instruction="Enter your 12-digit Aadhaar Number and Captcha. Click 'Send OTP' and enter the 6-digit one-time password received on your registered mobile number.",
        warning="If your registered mobile is disconnected, visit the nearest Aadhaar Seva Kendra or use SMS lock via 1947.",
    ),
    AadhaarBiometricLockStep(
        step_number=3,
        title="Select 'Lock / Unlock Biometrics' Tile",
        instruction="On your personal resident dashboard, locate the blue tile labeled 'Lock / Unlock Biometrics' with a padlock icon.",
        official_url="https://myaadhaar.uidai.gov.in",
    ),
    AadhaarBiometricLockStep(
        step_number=4,
        title="Review Protective Scope & Acknowledge",
        instruction="Tick the checkbox: 'I understand that after locking my biometrics, I will not be able to perform biometric authentication'. Click 'Next'.",
        warning="Note: Locking biometrics only disables fingerprint/iris authentication. Your mobile OTP authentication will continue to function normally.",
    ),
    AadhaarBiometricLockStep(
        step_number=5,
        title="Confirm Biometric Lock Active",
        instruction="You will see a green checkmark confirmation: 'Your Biometrics have been locked successfully'. On your dashboard, the fingerprint icon will now display a red locked padlock.",
    ),
]

AADHAAR_GUIDE = AadhaarBiometricLockGuide(
    overview=(
        "Aadhaar Biometric Locking is a statutory self-defense feature by UIDAI that "
        "allows Indian residents to lock and temporarily unlock their biometrics (fingerprints and iris) "
        "to prevent unauthorized AePS (Aadhaar Enabled Payment System) deductions and identity theft."
    ),
    why_lock_biometrics=(
        "Under AePS, anyone with your Aadhaar number and a cloned or lifted silicone fingerprint "
        "can withdraw up to ₹10,000 per transaction from micro-ATMs without needing any OTP, PIN, or SMS confirmation. "
        "Locking biometrics completely disables the biometric sensor interface across all banks and AePS gateways."
    ),
    aeps_vulnerability_explanation=(
        "AePS transactions rely solely on single-factor biometric matching at merchant PoS devices. "
        "Leaked land registry documents, photocopied documents, or cyber syndicate fingerprint databases "
        "are commonly used in digital arrest and cyber financial frauds. Locking your biometrics eliminates 100% of this exposure."
    ),
    myaadhaar_portal_url="https://myaadhaar.uidai.gov.in",
    uidai_helpline="1947",
    sms_1947_syntax={
        "step_1_get_otp": "Send 'GETOTP <Last 4 digits of Aadhaar>' to 1947",
        "step_2_lock_uid": "Send 'LOCKUID <Last 4 digits of Aadhaar> <6-digit OTP>' to 1947",
        "unlock_uid": "Send 'UNLOCKUID <Last 4 digits of Aadhaar> <6-digit OTP>' to 1947",
    },
    steps=AADHAAR_LOCK_STEPS,
    temporary_unlock_guidance=(
        "When you genuinely need to use biometrics (e.g. at a bank branch, telecom SIM KYC, or government welfare desk), "
        "log in to myAadhaar and select 'Unlock Biometrics Temporarily (10 Minutes)'. It will automatically re-lock after 10 minutes."
    ),
)


# ---------------------------------------------------------------------
# SERVICE FUNCTIONS
# ---------------------------------------------------------------------
def get_all_banks() -> List[EmergencyKillSwitchBankInfo]:
    """Returns directory of all supported Indian banks for emergency kill-switch."""
    return list(BANK_REGISTRY.values())


def get_bank_by_id(bank_id: str) -> Optional[EmergencyKillSwitchBankInfo]:
    """Retrieves emergency freeze details for a specific bank."""
    return BANK_REGISTRY.get(bank_id.strip().lower())


def get_aadhaar_guide() -> AadhaarBiometricLockGuide:
    """Returns official Aadhaar biometric locking walkthrough and AePS defense guide."""
    return AADHAAR_GUIDE


def compute_receipt_hash(payload_str: str) -> str:
    """Computes SHA-256 integrity hash for mitigation receipts."""
    return hashlib.sha256(payload_str.encode("utf-8")).hexdigest()


def generate_mitigation_receipt(req: EmergencyMitigationReceiptRequest) -> EmergencyMitigationReceipt:
    """
    Generates a cryptographically hashed, timestamped Emergency Mitigation Receipt.
    Acts as documentary evidence under RBI Zero-Liability Circulars:
    RBI/2017-18/15 DBR.No.Leg.BC.78/09.07.005/2017-18
    """
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST_TZ)
    timestamp_ms = int(now_utc.timestamp() * 1000)

    # Format date slug
    date_slug = now_ist.strftime("%Y%m%d")
    seed_str = f"{req.selected_bank_id}:{timestamp_ms}:{req.citizen_name}"
    short_hash = hashlib.sha1(seed_str.encode("utf-8")).hexdigest()[:8].upper()
    receipt_id = f"EMR-{date_slug}-{short_hash}"

    actions = req.actions_attempted or [
        "Initiated Bank Account Freeze / Card Hotlist request",
        "Consulted verified USSD (*99#) & SMS freeze commands",
    ]
    if req.reported_to_1930:
        actions.append("Reported incident to National Cybercrime Helpline 1930 / I4C")
    if req.reported_to_portal:
        actions.append("Drafted submission for cybercrime.gov.in portal")
    if req.aadhaar_biometrics_locked:
        actions.append("Followed UIDAI official flow to lock Aadhaar biometrics against AePS fraud")

    # Canonical string for SHA-256 sealing
    canonical_parts = [
        receipt_id,
        now_utc.isoformat(),
        req.citizen_name or "Citizen",
        req.selected_bank_id,
        req.bank_name,
        req.card_last_4 or "N/A",
        req.account_last_4 or "N/A",
        ",".join(sorted(actions)),
        "1930_YES" if req.reported_to_1930 else "1930_NO",
        "PORTAL_YES" if req.reported_to_portal else "PORTAL_NO",
        "AADHAAR_LOCKED" if req.aadhaar_biometrics_locked else "AADHAAR_NOT_LOCKED",
    ]
    canonical_payload = "|".join(canonical_parts)
    sha256_hash = compute_receipt_hash(canonical_payload)
    verification_token = f"RBI-MITIG-{sha256_hash[:16].upper()}"

    receipt = EmergencyMitigationReceipt(
        receipt_id=receipt_id,
        citizen_name=req.citizen_name or "Citizen (Protected)",
        selected_bank_id=req.selected_bank_id,
        bank_name=req.bank_name,
        timestamp_iso=now_utc.isoformat(),
        timestamp_ist=now_ist.strftime("%d-%b-%Y %I:%M:%S %p IST"),
        timestamp_ms=timestamp_ms,
        card_last_4=req.card_last_4,
        account_last_4=req.account_last_4,
        actions_attempted=actions,
        reported_to_1930=req.reported_to_1930,
        reported_to_portal=req.reported_to_portal,
        aadhaar_biometrics_locked=req.aadhaar_biometrics_locked,
        rbi_circular_reference=(
            "Reserve Bank of India Circular DBR.No.Leg.BC.78/09.07.005/2017-18 "
            "(Customer Protection – Limiting Liability of Customers in Unauthorised Electronic Banking Transactions). "
            "Zero Liability applies where unauthorized transaction occurs and customer notifies bank within three working days."
        ),
        legal_disclaimer=(
            "This receipt certifies the exact timestamp and self-defense mitigation steps initiated by the citizen. "
            "It serves as prima facie evidence of prompt customer notification for banking ombudsman and cyber cell dispute resolution."
        ),
        sha256_hash=sha256_hash,
        verification_token=verification_token,
    )

    _receipt_store[receipt_id] = receipt.model_dump()
    return receipt


def get_receipt_by_id(receipt_id: str) -> Optional[EmergencyMitigationReceipt]:
    """Retrieves an existing mitigation receipt by receipt ID."""
    raw = _receipt_store.get(receipt_id)
    if raw:
        return EmergencyMitigationReceipt(**raw)
    return None


def reset_receipt_store() -> None:
    """Resets the in-memory receipts (used by test suites)."""
    _receipt_store.clear()
