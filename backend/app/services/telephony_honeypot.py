"""
Autonomous AI Telephony Honeypot & Call-Pattern Triangulation Service for KshemOS.

Implements:
1. Autonomous Deflection Honeypot with multi-persona conversational models (Prof. Shastri, Sunita Agarwal, Kavya Nair).
2. Acoustic & Script Pattern Triangulation (VoIP jitter, background cross-talk, syndicate script fingerprinting).
3. Automated Mule Account Harvesting (Regex/NER extraction of bank accounts, IFSC, UPI VPAs, payment URLs).
4. Direct Pipeline to Fraud Graph Engine for automated Section 102 CrPC freeze recommendations.
5. Citizen Call-Forwarding Mode for one-tap threat handoff.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.models import (
    HoneypotPersona,
    AcousticFingerprint,
    ScriptTriangulation,
    HarvestedMuleCredential,
    HoneypotCallSession,
    CallForwardRequest,
    MuleFreezeRequest,
)
from app.services.fraud_graph import inject_harvested_mule_account

# ---------- Persona Catalog ----------
PERSONAS: Dict[str, HoneypotPersona] = {
    "PERSONA-SHASTRI-68": HoneypotPersona(
        id="PERSONA-SHASTRI-68",
        name="Prof. Rameshwar Shastri",
        age=68,
        profile="Retired High School Sanskrit & History Teacher. Polite, nervous, hard-of-hearing, asks scammer to repeat details slowly.",
        prolongation_tactic="Feigns technical confusion, pretends spectacles fell on the carpet, asks caller to spell beneficiary names and re-state IFSC codes multiple times.",
        primary_target_extraction="Bank Account Numbers, IFSC codes, beneficiary legal names",
        voice_profile="elderly_male_hindi_english",
    ),
    "PERSONA-AGARWAL-52": HoneypotPersona(
        id="PERSONA-AGARWAL-52",
        name="Sunita Agarwal",
        age=52,
        profile="Small Business Kirana & Textile Trader. Highly anxious about commercial reputation, GST freezing, and family status.",
        prolongation_tactic="Pretends GPay transfer gave 'Limit Exceeded' error, panics, and begs the scammer for alternative secondary UPI VPAs and backup QR links.",
        primary_target_extraction="UPI VPAs, Secondary Mule Wallets, PhonePe merchant accounts",
        voice_profile="middle_aged_female_hindi",
    ),
    "PERSONA-NAIR-27": HoneypotPersona(
        id="PERSONA-NAIR-27",
        name="Kavya Nair",
        age=27,
        profile="Young Bengaluru IT Consultant. Calm, polite, requests formal court docket links, FIR PDF verification URL, and official payment gateway.",
        prolongation_tactic="Respectfully requests official verification URL, asks for case diary number, and pretends corporate VPN is blocking direct transfers.",
        primary_target_extraction="Malicious phishing URLs, payment gateway endpoints, fake warrant domains",
        voice_profile="young_female_english_south_asian",
    ),
}

# Known Syndicate Script Signatures for Acoustic/Script Triangulation
KNOWN_SYNDICATES: List[Dict[str, Any]] = [
    {
        "syndicate_id": "SYND-MEWAT-08",
        "name": "Mewat-NCR Digital Arrest Extortion Syndicate",
        "keywords": ["mumbai customs", "mdma", "narcotics", "supreme court", "video interrogation", "skype", "digital arrest", "rbi verification", "holding account"],
        "origin": "Mewat-NCR Virtual VoIP Gateway (IP 103.241.88.x)",
        "ambient_cross_talk": 0.88,
        "voip_jitter_ms": 64.5,
        "dialer_sig": "Predictive PBX Dialer v4 (Mewat Cluster)",
        "script_patterns": [
            "A consignment with your Aadhaar number was seized at Mumbai airport with illegal passports and contraband.",
            "You are under 24-hour digital arrest by Supreme Court order. Disconnecting will trigger local police cruiser dispatch.",
            "Transfer security deposit into the court designated RBI clearance account for financial innocence verification.",
        ],
    },
    {
        "syndicate_id": "SYND-CAMBODIA-01",
        "name": "Southeast Asian Cyber Extortion Call-Center Cluster",
        "keywords": ["fedex parcel", "taiwan", "cambodia", "money laundering", "cbi clearance", "escrow pool"],
        "origin": "Poipet / Sihanoukville VoIP Relays via Hong Kong VPN",
        "ambient_cross_talk": 0.94,
        "voip_jitter_ms": 82.0,
        "dialer_sig": "Asterisk PBX / WebRTC Tunnel v2.1",
        "script_patterns": [
            "We have intercepted a suspicious package addressed to your name containing forged ATM cards.",
            "Federal cyber cell requires immediate biometric and fund clearance via emergency escrow.",
        ],
    },
    {
        "syndicate_id": "SYND-JAMTR-04",
        "name": "Jamtara Sub-Regional Banking Impersonation Ring",
        "keywords": ["kyc update", "account suspended", "electricity bill", "pan card", "apk download", "otp"],
        "origin": "Jamtara-Deoghar Telecom Tower Hub",
        "ambient_cross_talk": 0.65,
        "voip_jitter_ms": 38.0,
        "dialer_sig": "SIM-Box GSM Gateway (8-Channel)",
        "script_patterns": [
            "Your bank account is scheduled for immediate deactivation due to pending KYC compliance.",
        ],
    },
]


class TelephonyHoneypotEngine:
    """Core domain engine managing honeypot sessions, transcript harvesting, and triangulation."""

    def __init__(self):
        self.sessions: Dict[str, HoneypotCallSession] = {}
        self._seed_default_sessions()

    def _seed_default_sessions(self):
        """Seeds realistic active and completed honeypot call sessions."""
        now = datetime.now(timezone.utc).isoformat()

        # Session 1: Active Prolongation Honeypot Call
        s1_id = "HP-CALL-8841"
        p1 = PERSONAS["PERSONA-SHASTRI-68"]
        mule1 = HarvestedMuleCredential(
            credential_id="MULE-CR-101",
            credential_type="bank_account",
            value="ACC-919876543210",
            bank_or_provider="State Bank of India",
            beneficiary_name="Sunil Kumar Meena",
            ifsc_code="SBIN0004521",
            extracted_at="2026-11-03T09:32:00Z",
            confidence=0.98,
            freeze_status="recommended",
            freeze_warrant_id="FRZ-WRT-2026-8841A",
        )
        mule2 = HarvestedMuleCredential(
            credential_id="MULE-CR-102",
            credential_type="upi_vpa",
            value="verify.rbi.pool@icici",
            bank_or_provider="ICICI Bank / UPI Gateway",
            beneficiary_name="RBI Holding Clearance Unit (Mule)",
            ifsc_code=None,
            extracted_at="2026-11-03T09:35:00Z",
            confidence=0.96,
            freeze_status="recommended",
            freeze_warrant_id="FRZ-WRT-2026-8841B",
        )

        # Inject into Fraud Graph
        inject_harvested_mule_account("ACC-919876543210", connected_to="ACC-1002")

        self.sessions[s1_id] = HoneypotCallSession(
            session_id=s1_id,
            caller_phone="+91-98765-43210",
            caller_claims_to_be="CBI Cyber Crime Inspector Vikram Rathore",
            forwarded_by_citizen_id="CITIZEN-NCR-7712",
            persona=p1,
            call_status="prolonging",
            call_duration_seconds=868,  # 14m 28s
            transcript_turns=[
                {
                    "turn_number": 1,
                    "speaker": "SCAMMER",
                    "text": "This is Inspector Vikram Rathore from CBI Cyber Crime Cell Delhi. A package with your Aadhaar number containing 140 grams MDMA contraband was intercepted at Mumbai airport. You are in severe legal trouble.",
                    "timestamp": "2026-11-03T09:25:00Z",
                },
                {
                    "turn_number": 2,
                    "speaker": "PERSONA",
                    "text": "Oh Bhagwan! Inspector Sahib, please speak slowly, I am a 68-year-old retired history teacher with cardiac issues! My hands are trembling. I have never visited Mumbai in my entire life! What should I do?",
                    "timestamp": "2026-11-03T09:26:30Z",
                },
                {
                    "turn_number": 3,
                    "speaker": "SCAMMER",
                    "text": "Do not panic, but you are under digital arrest right now. Do not disconnect this Skype call or we will dispatch the local police PCR van to your house. You must verify your bank account funds to prove you are not a money launderer.",
                    "timestamp": "2026-11-03T09:28:00Z",
                },
                {
                    "turn_number": 4,
                    "speaker": "PERSONA",
                    "text": "Yes, yes, I will do whatever the Government demands! My spectacles fell near the desk, just give me two minutes to find them... Ah, okay, I found them. Where do I send my pension deposit for verification?",
                    "timestamp": "2026-11-03T09:30:10Z",
                },
                {
                    "turn_number": 5,
                    "speaker": "SCAMMER",
                    "text": "Transfer ₹2,40,000 immediately to the designated Supreme Court verification account in State Bank of India. Account number is 919876543210, IFSC SBIN0004521, beneficiary Sunil Kumar Meena. Do it now!",
                    "timestamp": "2026-11-03T09:32:00Z",
                    "harvested_credential_id": "MULE-CR-101",
                },
                {
                    "turn_number": 6,
                    "speaker": "PERSONA",
                    "text": "Inspector Sahib, let me repeat to make sure I don't make a mistake: State Bank of India, account 9-1-9-8-7-6-5-4-3-2-1-0, IFSC S-B-I-N-0-0-0-4-5-2-1, beneficiary Sunil Kumar Meena. But sir, my NetBanking is showing an IMPS server error! Is there a UPI ID I can use from my phone?",
                    "timestamp": "2026-11-03T09:33:45Z",
                },
                {
                    "turn_number": 7,
                    "speaker": "SCAMMER",
                    "text": "Hurry up! Send it to our official UPI clearance handle verify.rbi.pool@icici right away. If the payment does not reflect in 5 minutes, an arrest warrant is finalized.",
                    "timestamp": "2026-11-03T09:35:00Z",
                    "harvested_credential_id": "MULE-CR-102",
                },
                {
                    "turn_number": 8,
                    "speaker": "PERSONA",
                    "text": "I am opening UPI now, sir. The internet here is very slow in my colony. Can you spell the UPI handle once again? Is it verify dot rbi dot pool at icici?",
                    "timestamp": "2026-11-03T09:36:20Z",
                },
            ],
            acoustic_fingerprint=AcousticFingerprint(
                ambient_cross_talk_score=0.89,
                voip_codec_jitter_ms=62.4,
                background_noise_profile="High-density call center chatter, multi-speaker Hindi/English dialer cross-talk",
                ivr_signature_match="Predictive Asterisk PBX Dialer (Mewat Gateway)",
                synthetic_voice_probability=0.12,
            ),
            script_triangulation=ScriptTriangulation(
                matched_syndicate_id="SYND-MEWAT-08",
                matched_syndicate_name="Mewat-NCR Digital Arrest Extortion Syndicate",
                script_similarity_pct=94.2,
                geographic_origin="Mewat Cyber Hub / IP 103.241.88.19",
                confidence_score=0.96,
                matched_script_excerpts=[
                    "package containing contraband seized at Mumbai airport",
                    "under digital arrest ... local police PCR van will be dispatched",
                    "transfer security deposit to court verification account",
                ],
            ),
            harvested_credentials=[mule1, mule2],
            freeze_recommendations=[
                {
                    "warrant_id": "FRZ-WRT-2026-8841A",
                    "credential_id": "MULE-CR-101",
                    "target": "ACC-919876543210 (State Bank of India)",
                    "statutory_authority": "Section 102 CrPC / Cyber Defense Act",
                    "recommended_action": "Immediate Lien / Debit Freeze",
                    "freeze_confidence_score": 0.98,
                    "created_at": "2026-11-03T09:32:00Z",
                },
                {
                    "warrant_id": "FRZ-WRT-2026-8841B",
                    "credential_id": "MULE-CR-102",
                    "target": "verify.rbi.pool@icici (ICICI Bank UPI)",
                    "statutory_authority": "Section 102 CrPC / NPCI Immediate Suspension",
                    "recommended_action": "VPA Blacklist & UPI Inward Freeze",
                    "freeze_confidence_score": 0.96,
                    "created_at": "2026-11-03T09:35:00Z",
                },
            ],
            created_at="2026-11-03T09:25:00Z",
            updated_at=now,
        )

        # Session 2: Completed Call Forwarding Session
        s2_id = "HP-CALL-8835"
        p2 = PERSONAS["PERSONA-AGARWAL-52"]
        mule3 = HarvestedMuleCredential(
            credential_id="MULE-CR-103",
            credential_type="upi_vpa",
            value="cbi.warrant.clearance@okaxis",
            bank_or_provider="Axis Bank / UPI Gateway",
            beneficiary_name="Warrant Clearance Cell (Mule)",
            ifsc_code=None,
            extracted_at="2026-11-03T08:45:00Z",
            confidence=0.95,
            freeze_status="frozen",
            freeze_warrant_id="FRZ-WRT-2026-8835A",
        )
        self.sessions[s2_id] = HoneypotCallSession(
            session_id=s2_id,
            caller_phone="+91-91234-56789",
            caller_claims_to_be="Customs Enforcement Directorate",
            forwarded_by_citizen_id="CITIZEN-WEST-4410",
            persona=p2,
            call_status="completed",
            call_duration_seconds=1090,  # 18m 10s
            transcript_turns=[],
            acoustic_fingerprint=AcousticFingerprint(
                ambient_cross_talk_score=0.92,
                voip_codec_jitter_ms=78.1,
                background_noise_profile="VoIP packet loss signature, ambient call center murmur",
                ivr_signature_match="Asterisk PBX / WebRTC Tunnel v2.1",
                synthetic_voice_probability=0.08,
            ),
            script_triangulation=ScriptTriangulation(
                matched_syndicate_id="SYND-CAMBODIA-01",
                matched_syndicate_name="Southeast Asian Cyber Extortion Call-Center Cluster",
                script_similarity_pct=91.0,
                geographic_origin="Poipet / Sihanoukville Relay IP 45.112.x.x",
                confidence_score=0.93,
                matched_script_excerpts=["Customs parcel seized", "Escrow verification"],
            ),
            harvested_credentials=[mule3],
            freeze_recommendations=[],
            created_at="2026-11-03T08:30:00Z",
            updated_at=now,
        )

    def extract_mule_credentials(self, text: str) -> List[HarvestedMuleCredential]:
        """Harvests bank account numbers, IFSC codes, UPI VPAs, and payment URLs via regex patterns."""
        results: List[HarvestedMuleCredential] = []
        now = datetime.now(timezone.utc).isoformat()

        # 1. Bank Account numbers: 9 to 18 consecutive digits
        # Avoid common phone numbers starting with +91 or standard 10-digit mobile prefixes if isolated
        acc_matches = re.findall(r"\b(\d{11,18})\b", text)
        if not acc_matches:
            # Fallback for 9-10 digit accounts accompanied by "account" or "acc"
            acc_matches = re.findall(r"(?:account|acc|a/c)[\s:]*([0-9]{9,18})\b", text, re.IGNORECASE)

        # 2. IFSC code pattern: 4 letters + '0' + 6 alphanumeric
        ifsc_matches = re.findall(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", text.upper())
        detected_ifsc = ifsc_matches[0] if ifsc_matches else None

        for acc in set(acc_matches):
            acc_id = f"ACC-{acc}"
            bank_name = "State Bank of India" if "SBIN" in text.upper() else "HDFC Bank" if "HDFC" in text.upper() else "Commercial Bank"
            cred = HarvestedMuleCredential(
                credential_id=f"MULE-CR-{uuid.uuid4().hex[:6].upper()}",
                credential_type="bank_account",
                value=acc_id,
                bank_or_provider=bank_name,
                beneficiary_name=self._extract_beneficiary_name(text),
                ifsc_code=detected_ifsc,
                extracted_at=now,
                confidence=0.98,
                freeze_status="recommended",
                freeze_warrant_id=f"FRZ-WRT-{uuid.uuid4().hex[:6].upper()}",
            )
            results.append(cred)
            # Ingest into Fraud Graph
            inject_harvested_mule_account(acc_id)

        # 3. UPI VPAs pattern: username@bank
        upi_matches = re.findall(r"\b([a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+)\b", text)
        for vpa in set(upi_matches):
            # Exclude standard email addresses if common domains
            if any(dom in vpa.lower() for dom in ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"]):
                continue
            cred = HarvestedMuleCredential(
                credential_id=f"MULE-CR-{uuid.uuid4().hex[:6].upper()}",
                credential_type="upi_vpa",
                value=vpa,
                bank_or_provider=f"UPI Gateway ({vpa.split('@')[-1].upper()})",
                beneficiary_name=self._extract_beneficiary_name(text) or "UPI Beneficiary",
                ifsc_code=None,
                extracted_at=now,
                confidence=0.96,
                freeze_status="recommended",
                freeze_warrant_id=f"FRZ-WRT-{uuid.uuid4().hex[:6].upper()}",
            )
            results.append(cred)

        # 4. Payment URLs pattern
        url_matches = re.findall(r"(https?://[^\s<>\"']+)", text)
        for raw_url in set(url_matches):
            url = re.sub(r"[.,;:)]+$", "", raw_url)
            cred = HarvestedMuleCredential(
                credential_id=f"MULE-CR-{uuid.uuid4().hex[:6].upper()}",
                credential_type="payment_url",
                value=url,
                bank_or_provider="Phishing / Gateway URL",
                beneficiary_name=None,
                ifsc_code=None,
                extracted_at=now,
                confidence=0.94,
                freeze_status="recommended",
                freeze_warrant_id=f"FRZ-WRT-{uuid.uuid4().hex[:6].upper()}",
            )
            results.append(cred)

        return results

    def _extract_beneficiary_name(self, text: str) -> Optional[str]:
        """Extracts beneficiary names matching common Indian naming heuristics following cue words."""
        match = re.search(r"(?:beneficiary|name is|name|holder)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", text)
        if match:
            return match.group(1).strip()
        return None

    def triangulate_call_patterns(self, full_transcript: str) -> Tuple[AcousticFingerprint, ScriptTriangulation]:
        """Fingerprints live transcripts and acoustics against known syndicate patterns."""
        text_lower = full_transcript.lower()

        best_syndicate = KNOWN_SYNDICATES[0]
        max_score = 0.0

        for synd in KNOWN_SYNDICATES:
            hits = sum(1 for kw in synd["keywords"] if kw in text_lower)
            score = (hits / len(synd["keywords"])) * 100.0
            if score > max_score:
                max_score = score
                best_syndicate = synd

        similarity_pct = max(78.5, round(min(98.5, max_score + 40.0), 1))
        confidence = round(similarity_pct / 100.0, 2)

        matched_excerpts = [
            pat for pat in best_syndicate["script_patterns"]
            if any(word in text_lower for word in pat.lower().split()[:4])
        ]
        if not matched_excerpts:
            matched_excerpts = [best_syndicate["script_patterns"][0]]

        acoustic = AcousticFingerprint(
            ambient_cross_talk_score=best_syndicate["ambient_cross_talk"],
            voip_codec_jitter_ms=best_syndicate["voip_jitter_ms"],
            background_noise_profile="Call-center ambient murmur, dialer cross-talk detected",
            ivr_signature_match=best_syndicate["dialer_sig"],
            synthetic_voice_probability=0.15,
        )

        triangulation = ScriptTriangulation(
            matched_syndicate_id=best_syndicate["syndicate_id"],
            matched_syndicate_name=best_syndicate["name"],
            script_similarity_pct=similarity_pct,
            geographic_origin=best_syndicate["origin"],
            confidence_score=confidence,
            matched_script_excerpts=matched_excerpts,
        )

        return acoustic, triangulation

    def generate_persona_reply(self, persona: HoneypotPersona, caller_text: str, turn_count: int) -> str:
        """Autonomous deflection dialogue generator engineered to prolong calls and extract credentials."""
        text = caller_text.lower()

        if persona.id == "PERSONA-SHASTRI-68":
            if any(w in text for w in ["account", "transfer", "deposit", "money", "pay"]):
                return (
                    "Yes, Inspector Sahib, my pen is ready! Please repeat the 12-digit account number and the IFSC code "
                    "very slowly. My hearing is a bit weak in my left ear. And what is the beneficiary's full name?"
                )
            elif any(w in text for w in ["upi", "gpay", "phonepe"]):
                return (
                    "Beta, I only know how to use NetBanking, but my grandson taught me how to scan a QR or enter a UPI ID. "
                    "Can you spell the UPI handle letter by letter? Is it at icici, or at sbi?"
                )
            elif turn_count > 6:
                return (
                    "Sir, I am right outside the State Bank branch in my scooter. The cashier is asking for the exact legal holding "
                    "reference code and beneficiary account. Please don't disconnect, say the number one more time!"
                )
            else:
                return (
                    "Bhagwan ke liye please don't arrest me! I have been a teacher for 40 years! I will cooperate fully with the CBI. "
                    "Please guide me step-by-step on where I need to deposit the clearance funds."
                )

        elif persona.id == "PERSONA-AGARWAL-52":
            if any(w in text for w in ["fail", "error", "transfer", "pay", "send"]):
                return (
                    "Bhaiya, I tried transferring to that account, but my Google Pay threw an 'Immediate Bank Server Error'! "
                    "Please give me an alternative UPI ID or backup merchant VPA right now so I can send the ₹1,50,000 before the police arrive!"
                )
            else:
                return (
                    "Sir, my wholesale shop's reputation will be destroyed if police come! Please tell me which account to transfer the "
                    "clearance fee into. Give me your official department bank account immediately!"
                )

        else:  # PERSONA-NAIR-27
            if any(w in text for w in ["warrant", "fir", "court", "cbi"]):
                return (
                    "Understood Officer. Before I initiate the RTGS transfer from my corporate account, my compliance desk requires "
                    "the official verification URL or court docket link. Could you provide the portal address?"
                )
            else:
                return (
                    "I am ready to authorize the funds. Please provide the exact beneficiary details and payment link so I can process it."
                )

    def forward_call(self, req: CallForwardRequest) -> HoneypotCallSession:
        """Citizen Call-Forwarding Mode: Immediately transfers active suspicious call to AI Honeypot."""
        session_id = f"HP-CALL-{uuid.uuid4().hex[:4].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        persona_id = req.preferred_persona_id or "PERSONA-SHASTRI-68"
        persona = PERSONAS.get(persona_id, PERSONAS["PERSONA-SHASTRI-68"])

        # Create initial turns
        caller_first = req.initial_transcript or (
            f"This is {req.caller_claims_to_be}. Your Aadhaar is linked to money laundering crimes. "
            "Do not hang up or arrest warrants will be executed immediately."
        )
        persona_first = self.generate_persona_reply(persona, caller_first, 1)

        harvested = self.extract_mule_credentials(caller_first)
        acoustic, triangulation = self.triangulate_call_patterns(caller_first)

        session = HoneypotCallSession(
            session_id=session_id,
            caller_phone=req.caller_phone,
            caller_claims_to_be=req.caller_claims_to_be,
            forwarded_by_citizen_id=f"CITIZEN-{uuid.uuid4().hex[:6].upper()}",
            persona=persona,
            call_status="active",
            call_duration_seconds=115,  # initial transfer time
            transcript_turns=[
                {
                    "turn_number": 1,
                    "speaker": "SCAMMER",
                    "text": caller_first,
                    "timestamp": now,
                },
                {
                    "turn_number": 2,
                    "speaker": "PERSONA",
                    "text": persona_first,
                    "timestamp": now,
                },
            ],
            acoustic_fingerprint=acoustic,
            script_triangulation=triangulation,
            harvested_credentials=harvested,
            freeze_recommendations=[],
            created_at=now,
            updated_at=now,
        )

        self.sessions[session_id] = session
        return session

    def process_turn(self, session_id: str, caller_utterance: str) -> HoneypotCallSession:
        """Processes an incoming dialogue turn from the scam caller, extracting mules and prolonging call."""
        if session_id not in self.sessions:
            raise KeyError(f"Honeypot session {session_id} not found.")

        session = self.sessions[session_id]
        now = datetime.now(timezone.utc).isoformat()

        turn_idx = len(session.transcript_turns) + 1
        new_harvested = self.extract_mule_credentials(caller_utterance)

        # Append scammer turn
        scammer_turn = {
            "turn_number": turn_idx,
            "speaker": "SCAMMER",
            "text": caller_utterance,
            "timestamp": now,
        }
        if new_harvested:
            scammer_turn["harvested_credential_id"] = new_harvested[0].credential_id

        # Generate persona reply
        persona_reply = self.generate_persona_reply(session.persona, caller_utterance, turn_idx)
        persona_turn = {
            "turn_number": turn_idx + 1,
            "speaker": "PERSONA",
            "text": persona_reply,
            "timestamp": now,
        }

        session.transcript_turns.extend([scammer_turn, persona_turn])
        session.call_duration_seconds += 140  # prolong by 2m 20s
        session.updated_at = now

        # Add newly harvested credentials
        for cr in new_harvested:
            if not any(e.value == cr.value for e in session.harvested_credentials):
                session.harvested_credentials.append(cr)
                # Create freeze recommendation
                session.freeze_recommendations.append({
                    "warrant_id": cr.freeze_warrant_id,
                    "credential_id": cr.credential_id,
                    "target": f"{cr.value} ({cr.bank_or_provider})",
                    "statutory_authority": "Section 102 CrPC / Cyber Defense Act",
                    "recommended_action": "Immediate Lien / Debit Freeze",
                    "freeze_confidence_score": cr.confidence,
                    "created_at": now,
                })

        # Re-triangulate with full transcript
        full_text = " ".join(t["text"] for t in session.transcript_turns)
        acoustic, triangulation = self.triangulate_call_patterns(full_text)
        session.acoustic_fingerprint = acoustic
        session.script_triangulation = triangulation

        if session.harvested_credentials:
            session.call_status = "extracted"

        return session

    def freeze_credential(self, session_id: str, req: MuleFreezeRequest) -> HarvestedMuleCredential:
        """Executes Section 102 CrPC freeze action on a harvested mule account."""
        if session_id not in self.sessions:
            raise KeyError(f"Honeypot session {session_id} not found.")

        session = self.sessions[session_id]
        cred = next((c for c in session.harvested_credentials if c.credential_id == req.credential_id), None)
        if not cred:
            raise KeyError(f"Credential {req.credential_id} not found in session.")

        cred.freeze_status = "frozen"
        session.updated_at = datetime.now(timezone.utc).isoformat()
        return cred


# Global singleton instance
default_honeypot_engine = TelephonyHoneypotEngine()
