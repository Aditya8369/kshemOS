"""
Documented labeled benchmark corpus for calibrated risk model evaluation.

Includes:
- High-severity digital arrest & law enforcement impersonation (English & Multilingual/Hinglish).
- Customs contraband & fake courier extortion.
- Bank KYC / Utility disconnection traps.
- Benign daily institutional calls (bank appointment, pharmacy, delivery, workplace).
- Insufficient conversational evidence & ambiguous edge cases (inconclusive).
"""
from __future__ import annotations

BENCHMARK_CASES = [
    # Category 1: Digital Arrest & Coercive Law Enforcement (Expected: critical)
    {
        "id": "BENCH-DA-01",
        "category": "digital_arrest",
        "ground_truth_band": "critical",
        "min_expected_score": 75,
        "transcript": (
            "This is the CBI. A parcel with your Aadhaar number has been seized containing "
            "illegal narcotics and MDMA. You are under digital arrest. Stay on this video call, "
            "do not disconnect, stay in a quiet room, and transfer verification amount to the "
            "Supreme Court safe account immediately or a warrant will execute."
        ),
        "caller_claims_to_be": "CBI officer",
        "context": {"channel": "whatsapp_video", "time_of_day": "night"},
    },
    {
        "id": "BENCH-DA-02",
        "category": "digital_arrest",
        "ground_truth_band": "critical",
        "min_expected_score": 75,
        "transcript": (
            "Official notice from the Crime Branch. A non-bailable arrest warrant has been "
            "issued against you for money laundering. You must maintain strict confidentiality, "
            "do not tell your family members, and transfer your funds to the RBI safe clearance "
            "account right now."
        ),
        "caller_claims_to_be": "Crime Branch Inspector",
        "context": {"channel": "voip_call", "time_of_day": "odd_hours"},
    },

    # Category 2: Customs & Illegal Courier Parcel Extortion (Expected: high or critical)
    {
        "id": "BENCH-CUSTOMS-01",
        "category": "customs_extortion",
        "ground_truth_band": "high",
        "min_expected_score": 50,
        "transcript": (
            "We are calling from customs department headquarters. Your international shipment "
            "contains contraband items and counterfeit passports. Pay the customs clearance "
            "penalty fee now or an FIR will be registered within two hours."
        ),
        "caller_claims_to_be": "customs officer",
        "context": {"channel": "pstn"},
    },
    {
        "id": "BENCH-CUSTOMS-02",
        "category": "customs_extortion",
        "ground_truth_band": "high",
        "min_expected_score": 50,
        "transcript": (
            "Customs seizure division. A parcel addressed in your name has been impounded at "
            "airport cargo. You must pay the settlement amount through this UPI ID immediately "
            "to avoid police custody."
        ),
        "caller_claims_to_be": "customs official",
        "context": {"channel": "voip_call"},
    },

    # Category 3: Bank KYC & Utility Impersonation (Expected: high)
    {
        "id": "BENCH-KYC-01",
        "category": "bank_kyc",
        "ground_truth_band": "high",
        "min_expected_score": 50,
        "transcript": (
            "Your bank account will be suspended today due to pending KYC update. Share the "
            "OTP sent to your mobile right now to verify your identity and avoid permanent "
            "account freeze."
        ),
        "caller_claims_to_be": "bank officer",
        "context": {"channel": "pstn"},
    },
    {
        "id": "BENCH-UTIL-01",
        "category": "utility_extortion",
        "ground_truth_band": "high",
        "min_expected_score": 50,
        "transcript": (
            "Electricity department alert: Your power connection will be disconnected tonight "
            "at 9 PM. Call immediately and download AnyDesk app on your phone for urgent verification."
        ),
        "caller_claims_to_be": "electricity officer",
        "context": {"channel": "voip_call"},
    },

    # Category 4: Multilingual & Code-Switched Extortion (Expected: critical or high)
    {
        "id": "BENCH-MULTI-HI-01",
        "category": "multilingual_scam",
        "ground_truth_band": "critical",
        "min_expected_score": 75,
        "transcript": (
            "Aapka parcel Mumbai customs ne seize kiya hai usme illegal drugs mile hain. "
            "Aap par digital arrest warrant issue hua hai. Do not disconnect this call, "
            "turant safe account mein verification amount transfer kijiye."
        ),
        "caller_claims_to_be": "CBI Crime Branch",
        "context": {"channel": "whatsapp_video"},
    },
    {
        "id": "BENCH-MULTI-HI-02",
        "category": "multilingual_scam",
        "ground_truth_band": "critical",
        "min_expected_score": 75,
        "transcript": (
            "Yeh confidential police enquiry hai kisi ko mat batana darwaza band rakho. "
            "Aapki giraftari ka order aa chuka hai, turant paise transfer karo varna jail hogi."
        ),
        "caller_claims_to_be": "Police Inspector",
        "context": {"channel": "voip_call"},
    },
    {
        "id": "BENCH-MULTI-TA-01",
        "category": "multilingual_scam",
        "ground_truth_band": "high",
        "min_expected_score": 50,
        "transcript": (
            "Ungal bank account freeze aagividum. Ungal OTP udane share pannunga illana "
            "account block aagum. Urgent verification required."
        ),
        "caller_claims_to_be": "bank verification team",
        "context": {"channel": "pstn"},
    },

    # Category 5: Benign Institutional & Daily Calls (Expected: low)
    {
        "id": "BENCH-BENIGN-01",
        "category": "benign",
        "ground_truth_band": "low",
        "max_expected_score": 24,
        "transcript": (
            "I am calling from HDFC Bank to confirm your home loan appointment for tomorrow "
            "afternoon at 2 PM. Please bring your identity proof and salary slips to the branch."
        ),
        "caller_claims_to_be": "bank officer",
        "context": {"channel": "pstn"},
    },
    {
        "id": "BENCH-BENIGN-02",
        "category": "benign",
        "ground_truth_band": "low",
        "max_expected_score": 24,
        "transcript": (
            "Hello, your Amazon delivery package has arrived at the apartment security gate. "
            "Please collect it whenever you are available today. Thank you."
        ),
        "caller_claims_to_be": "courier delivery partner",
        "context": {"channel": "pstn"},
    },
    {
        "id": "BENCH-BENIGN-03",
        "category": "benign",
        "ground_truth_band": "low",
        "max_expected_score": 24,
        "transcript": (
            "Calling from Apollo Pharmacy to notify that your regular prescription refill is ready "
            "for pickup at our store counter. Have a healthy day."
        ),
        "caller_claims_to_be": "pharmacist",
        "context": {"channel": "pstn"},
    },
    {
        "id": "BENCH-BENIGN-04",
        "category": "benign",
        "ground_truth_band": "low",
        "max_expected_score": 24,
        "transcript": (
            "Namaskar, aapka cheque bank mein successfully clear ho gaya hai. Aap aakar apni "
            "passbook update kar sakte hain."
        ),
        "caller_claims_to_be": "bank desk",
        "context": {"channel": "pstn"},
    },
    {
        "id": "BENCH-BENIGN-05",
        "category": "benign",
        "ground_truth_band": "low",
        "max_expected_score": 24,
        "transcript": (
            "Hi Rohit, could you please review the attached slide deck before our team standup "
            "call this afternoon? Let me know your thoughts."
        ),
        "caller_claims_to_be": "colleague",
        "context": {"channel": "internal"},
    },

    # Category 6: Insufficient Evidence & Ambiguous Edge Cases (Expected: inconclusive)
    {
        "id": "BENCH-INCONC-01",
        "category": "inconclusive",
        "ground_truth_band": "inconclusive",
        "transcript": "Hello?",
        "caller_claims_to_be": None,
        "context": {},
    },
    {
        "id": "BENCH-INCONC-02",
        "category": "inconclusive",
        "ground_truth_band": "inconclusive",
        "transcript": "Yes, who is on the line please?",
        "caller_claims_to_be": None,
        "context": {},
    },
    {
        "id": "BENCH-INCONC-03",
        "category": "inconclusive",
        "ground_truth_band": "inconclusive",
        "transcript": "Can you hear me? Speak louder please.",
        "caller_claims_to_be": None,
        "context": {},
    },
    {
        "id": "BENCH-INCONC-04",
        "category": "inconclusive",
        "ground_truth_band": "inconclusive",
        "transcript": "Sorry, I think you have the wrong number.",
        "caller_claims_to_be": None,
        "context": {},
    },
    {
        "id": "BENCH-INCONC-05",
        "category": "inconclusive",
        "ground_truth_band": "inconclusive",
        "transcript": "Please call back after an hour, I am driving right now.",
        "caller_claims_to_be": None,
        "context": {},
    },
]
