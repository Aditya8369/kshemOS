# KshemOS — Complete Feature Reference

> **KshemOS** (Sanskrit: *kṣema* — welfare, safety, protection) is an AI operating system for digital public safety. It sits between citizens, banks, telecom operators, and law enforcement — catching digital arrest scams, counterfeit currency, and fraud rings **in the moment they happen**, not after the FIR is filed.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Backend AI Agents](#2-backend-ai-agents)
3. [Frontend Rule Engine](#3-frontend-rule-engine)
4. [Cyber Feature Modules (60+)](#4-cyber-feature-modules-60)
   - [Group A: Communication Security](#group-a-communication-security)
   - [Group B: Financial Scam Detection](#group-b-financial-scam-detection)
   - [Group C: Identity & Document Security](#group-c-identity--document-security)
   - [Group D: Device & Browser Security](#group-d-device--browser-security)
   - [Group E: Psychological & Behavioral Analysis](#group-e-psychological--behavioral-analysis)
   - [Group F: Safety & Resilience](#group-f-safety--resilience)
5. [Frontend Pages & Views](#5-frontend-pages--views)
6. [API Endpoints](#6-api-endpoints)
7. [Data Model](#7-data-model)
8. [Scam Scenario Library](#8-scam-scenario-library)
9. [Security & Privacy](#9-security--privacy)
10. [Tech Stack](#10-tech-stack)

---

## 1. System Architecture

KshemOS follows a modular agent-based architecture with a FastAPI backend and a React frontend. All modules are designed as independent agents that can be extracted into standalone microservices.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│  ┌────────────────┐  ┌──────────────────────────────┐      │
│  │ Citizen Portal │  │    Officer Command Center     │      │
│  │ (React SPA)    │  │    (React SPA)               │      │
│  └───────┬────────┘  └─────────────┬────────────────┘      │
└──────────┼──────────────────────────┼──────────────────────┘
           │                          │
┌──────────▼──────────────────────────▼──────────────────────┐
│                    API GATEWAY (FastAPI)                     │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ │
│  │  Scam   │ │ Currency │ │  Graph   │ │Citiz.│ │Officer│ │
│  │ Service │ │ Service  │ │ Service  │ │Serv. │ │Serv.  │ │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──┬───┘ └───┬───┘ │
└───────┼───────────┼────────────┼───────────┼──────────┼─────┘
        │           │            │           │          │
┌───────▼───────────▼────────────▼───────────▼──────────▼─────┐
│                      AI SERVICES                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Keyword  │ │  Pillow  │ │NetworkX  │ │  Claude API    │  │
│  │  + BOW   │ │  Image   │ │  Graph   │ │  (LLM Bridge)  │  │
│  │Scoring   │ │Heuristics│ │  Queries │ │                │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The frontend also includes a **fully independent client-side rule engine** (`ruleEngine.js`) that powers all 60+ cyber features locally without requiring a backend connection.

---

## 2. Backend AI Agents

### 2.1 Digital Arrest Agent (`/api/scam/analyze`)

**Purpose:** Real-time scam call risk scoring from transcripts or text.

**Input:** `{ transcript: string, caller_claims_to_be?: string }`

**Output:** `{ risk_score: 0-100, risk_band: string, matched_patterns: string[], recommendation: string, explanation: string, matched_known_scam_similarity: float }`

**Detection Methodology (4 layers):**

| Layer | Technique | Weight |
|-------|-----------|--------|
| **Threat keywords** | Authority impersonation terms (CBI, police, court, customs, income tax, cyber cell) | Up to 32 pts |
| **Urgency keywords** | Time pressure words (immediately, now, within minutes, today itself) | Up to 21 pts |
| **Secrecy keywords** | Isolation requests (confidential, do not tell anyone, digital arrest) | Up to 20 pts |
| **Payment keywords** | OTP/money demands (OTP, transfer, UPI, verification amount, fine) | Up to 18 pts |
| **Script similarity** | Bag-of-words cosine similarity against 10+ known scam scripts | Up to 40 pts |
| **Caller claim** | Government authority claim bonus | +10 pts |

**Risk Bands:**
- **Critical** (≥75): Strong digital-arrest scam match. Do not transfer money/share OTP.
- **High** (50-74): Treat with suspicion. Verify through official channel.
- **Medium** (25-49): Some indicators present. Ask for written confirmation.
- **Low** (<25): No strong indicators detected.

**Production upgrade path:** Whisper (ASR) → Sentence-Transformers + FAISS over a continuously refreshed corpus.

---

### 2.2 Counterfeit Currency Agent (`/api/currency/scan`)

**Purpose:** Currency note authenticity verification from uploaded photos.

**Input:** Multipart image upload (JPEG/PNG)

**Output:** `{ verdict: string, confidence: float, reasons: string[], signals: object }`

**Verdict Types:** `likely_genuine`, `suspicious`, `inconclusive`

**Detection Pipeline:**
- Edge density analysis (sharpness of printed features)
- Texture uniformity measurement (consistent paper/print texture)
- Resolution check (sufficient pixel density for detail)
- Brightness/contrast normalization
- File name heuristic (scam-related keywords in name)
- Screenshot/shape detection (common in fake payment screenshots)
- Text-like pattern analysis (screenshot vs. natural photo)

**Production upgrade path:** YOLOv11 note/region detector + OCR serial number extraction + reference feature-matching.

---

### 2.3 Fraud Graph Agent (`/api/graph/ring/{account_id}`)

**Purpose:** Link accounts, phones, devices, and UPI IDs into fraud rings. Flag potential mule accounts.

**Input:** Account ID (path parameter)

**Output:** `{ account_id: string, is_flagged: boolean, mule_probability: float, ring_id: string, connected_accounts: string[], shared_signals: string[] }`

**Graph Model (NetworkX in-memory):**
- **Nodes:** Account, Phone, Device, UPI ID, Victim, Location
- **Edges:** `SHARED_DEVICE`, `TRANSACTED_WITH`, `SAME_IP`, `SAME_PHONE`
- **Signals:** Device fingerprint, beneficiary patterns, rapid small transfers

**Pre-seeded Demo Accounts:**
- `ACC-1001`: Flagged mule, 0.91 probability, Ring RNG-204
- `ACC-1002`: Flagged mule, 0.89 probability, Ring RNG-204
- `ACC-1009`: Flagged mule, 0.81 probability, Ring RNG-204
- `ACC-1012`: Flagged mule, 0.74 probability, Ring RNG-206

**Production upgrade path:** Neo4j AuraDB + Graph Neural Network for mule-probability scoring.

---

### 2.4 Citizen Assistant (`/api/citizen/ask`, `/api/citizen/report`)

**Purpose:** Multilingual safety guidance, scam explanation, guided reporting, and FIR drafting.

**`POST /api/citizen/ask`**

Input: `{ question: string, language: string }`

Output: `{ answer: string }`

Supports: Hindi, Bengali, Tamil, Telugu, Marathi, Kannada, and English

**`POST /api/citizen/report`**

Input: `{ reporter_name: string, language: string, category: string, description: string }`

Output: `{ report_id: string, acknowledgement: string, draft_fir: string }`

**Scenarios handled:**
- Digital arrest scam identification
- OTP/credential sharing warnings
- Counterfeit currency inspection advice
- Payment/refund fraud guidance
- Multilingual fallback responses (Hindi phrase: *"सावधानी से जांच करें..."*)
- FIR draft generation with structured case details

**Production upgrade path:** Claude API for richer, context-aware multilingual responses.

---

### 2.5 Officer Copilot (`/api/officer/case/{report_id}`)

**Purpose:** Case intelligence — summarizes a report, enriches it with fraud-graph context, and suggests next investigation steps.

**Input:** Report ID (path), optional Account ID (query param)

**Output:** `{ case_id: string, priority: string, summary: string, suggested_next_steps: string[] }`

**Capabilities:**
- Cross-references report with fraud graph data
- Computes priority based on graph flags and mule probability
- Generates structured investigation workflow (4+ steps)
- Links victim report to broader fraud ring context

**Example output:**
> Report RPT-XXXX was reviewed against the local fraud graph. The linked account ACC-1002 shows multiple suspicious links and a mule probability of 89%. The linked network includes 3 accounts and 3 shared signals, indicating a pattern consistent with coordinated suspicious activity.

---

### 2.6 LLM Bridge (`/api/llm/chat`)

**Purpose:** Raw LLM chat endpoint for extensibility.

**Input:** `{ prompt: string, max_tokens?: number }`

**Output:** `{ text: string }`

Supports both Claude API (Anthropic) and local LLM (llama-cpp-python) as fallback.

---

## 3. Frontend Rule Engine

The client-side rule engine (`frontend/src/ruleEngine.js`) powers all cyber features locally. It contains 6 major subsystems:

### 3.1 Scam Transcript Analyzer (`analyzeScamTranscript`)

A comprehensive rule-based scam detector that processes conversation/text transcripts and returns:

- **Risk score** (0-100) and **risk band** (low/medium/high/critical)
- **Entity extraction:** OTP codes, Aadhaar numbers, UPI IDs, bank details, card info, amounts, organizations, dates
- **Scam type classification:** Courier/parcel, authority impersonation, OTP capture, payment/refund, loan, bank payment, investment/prize, tech support
- **Tactic timeline:** Evidence of threat → urgency → secrecy → payment sequence
- **Evidence spans:** Contextual snippets with category labels
- **Score breakdown:** Per-category scoring with bonus analysis
- **Motive analysis:** What the scammer is trying to achieve
- **Plugin signals:** 10+ additional plugin categories from `scamRulePlugins.js`

**Keyword Libraries (160+ terms):**
- 16 authority/threat terms (CBI, police, customs, court, etc.)
- 39+ urgency terms (immediately, now, today itself, etc.)
- 24+ secrecy terms (confidential, digital arrest, do not tell anyone, etc.)
- 23+ payment terms (OTP, Aadhaar, bank details, UPI, crypto, etc.)
- 52+ known scam phrase patterns (digital arrest, verification amount, account will be frozen, etc.)

**Pattern Strength Scoring:**
12 high-signal phrases with weighted scoring (digital arrest = 16 pts, do not disconnect = 10 pts, etc.)

### 3.2 Currency Image Scanner (`scanCurrencyImageLocally`)

Client-side image analysis using Canvas API:
- Resamples image to 220px reference scale
- Calculates luminance, variance, and texture metrics
- Resolution quality scoring (pixel density)
- Blur detection (luminance variance)
- Brightness normalization
- Heuristic filename analysis (scam-related keywords)
- Screenshot shape detection (aspect ratio analysis)
- Text-like pattern recognition (contrast + shape)
- Returns: verdict, confidence, reasons array, detailed signal booleans

### 3.3 Citizen Assistant (`askCitizenAssistantLocally`)

Rule-based Q&A system with:
- Scenario library matching (2,200+ synthetic patterns)
- Pattern-based response rules (digital arrest, OTP, counterfeit, fraud, multilingual)
- Hindi fallback for Indian languages
- Safe-default recommendation

### 3.4 Report Submission (`submitCitizenReportLocally`)

Local report filing system that generates:
- Unique report ID (`RPT-XXXX`)
- Category-based acknowledgement
- Draft FIR with structured fields (Report ID, Reporter, Language, Category, Description, Observation, Recommended follow-up)
- Timestamp and status tracking

### 3.5 Fraud Graph & Case Engine

- **`lookupFraudRingLocally`:** Returns pre-seeded fraud ring data for 6 demo accounts
- **`getCaseSummaryLocally`:** Generates structured case summary with priority, narrative, and 4 follow-up steps
- **`getRuleLibrarySamplesLocally`:** Returns sample scam scenarios with metadata (authority, target, medium, issue patterns)

### 3.6 Plugin Architecture (`scamRulePlugins.js`)

10 signal categories analyzed for each transcript:

| Plugin | Signals Detected |
|--------|-----------------|
| Device/SIM compromise | Phone compromised, SIM blocking, suspension |
| Call recording/monitoring | Recording alerts, surveillance claims |
| Link manipulation | QR codes, shortlinks, WhatsApp/SMS push, app install |
| Identity/KYC pressure | KYC verification, personal data requests |
| Delivery/parcel | Parcel seized, customs holds |
| Gift card/crypto | Alternative payment demands |
| Language pressure | Threat pressure, deadline pressure |
| Evidence requests | Screenshot sharing, OTP sharing |
| Legal vibe | FIR references, court summons |
| Scam category | Auto-classification from multi-signal analysis |

---

## 4. Cyber Feature Modules (60+)

### Group A: Communication Security

#### A1. QR Guardian — QR Payment Fraud Detection
**File:** `cyberFeatures/qrGuardian.js`

Analyzes QR code metadata (UPI IDs, merchant names, amounts, URLs) for fraudulent patterns.

**Detection Capabilities:**
- **UPI ID analysis:** 12 suspicious patterns (pay@, merchant, random@, temp@, test@, scam@)
- **Merchant name analysis:** 16 suspicious keywords; brand impersonation detection (Amazon, Flipkart, Google, etc.)
- **Amount analysis:** High amount thresholds, zero-amount phishing detection
- **URL/domain analysis:** 14 link shortener services; IP address URL detection; typosquatting detection (g00gle, amaz0n, etc.)
- **Combo heuristics:** Anonymous payment, urgent+high-amount, refund/prize claims, fake payment confirmation
- **Risk scoring:** 0-100 with per-category breakdown

**Risk Bands:** Low (<20), Medium (20-44), High (45-69), Critical (≥70)

---

#### A2. LinkShield — Fake Website / URL Inspector
**File:** `cyberFeatures/linkShield.js`

URL phishing and typosquatting detection using deterministic rules.

**Detection Capabilities:**
- **Suspicious TLDs:** 24 risky TLDs (.xyz, .top, .club, .online, .site, .live, etc.)
- **Brand domain verification:** 19 major brands with their legitimate domains
- **Typosquatting:** Levenshtein distance (1-3) detection against all brand names; brand-embedded-in-wrong-domain checks
- **Suspicious keywords:** 42 phishing keywords in URL path
- **Phishing subdomains:** 15 commonly spoofed subdomains (secure, login, verify, etc.)
- **Known phishing patterns:** 16 regex patterns (login.secure, account.verify, free.recharge, etc.)
- **HTTPS enforcement check**
- **Country-code TLD + brand combo analysis**
- **URL length obfuscation detection** (>200 chars)
- **Special character analysis** (encoding, subdomain spoofing)

**Bonus:** `batchInspectURLs(urls)` for bulk URL analysis.

---

#### A3. SMS Analyzer — SMS & Message Scam Detection
**File:** `cyberFeatures/smsAnalyzer.js`

Comprehensive SMS message analysis across 7 keyword categories.

**Detection Capabilities:**
- **Sender analysis:** International scam numbers (7 high-risk country codes); scam sender name patterns (15 patterns: KYC-, ALERT-, WINNER-, etc.)
- **URL extraction:** 3 phishing URL patterns (shorteners, IP-based URLs, suspicious TLD URLs)
- **7-category keyword scoring:**
  - Financial (15 terms: bank, account, ATM, PIN, CVV, OTP)
  - Urgency (16 terms: immediately, urgent, blocked, suspended, frozen)
  - Gifts/Prizes (13 terms: won, winner, lottery, cashback, gift)
  - Phishing (14 terms: click, link, verify, login, KYC)
  - Personal (12 terms: Aadhaar, PAN, passport, voter)
  - Threats (15 terms: legal, court, police, arrest, warrant)
  - Money (14 terms: send, transfer, payment, loan, EMI)
- **Cross-category combo scoring:** Urgency+Financial (high risk), Personal info requests
- **Scam phrase detection:** 40 known scam phrases
- **All-caps urgency detection** (letter ratio > 60%)
- **Excessive special character detection**
- **Bulk analysis:** `batchAnalyzeSMS(messages)`

---

#### A4. PhishDetect — Email Phishing Analyzer
**File:** `cyberFeatures/phishDetect.js`

Comprehensive email header, body, link, and attachment analysis.

**Detection Capabilities:**
- **Subject pattern analysis:** 17 phishing subject patterns (urgent action, account suspended, security alert, password expired, payment failed, etc.)
- **Display name spoofing:** 22 impersonated display names (support, admin, security, Google, Microsoft, Amazon, etc.); brand domain mapping (10 brands with legitimate domains)
- **Header authentication:** SPF/DKIM/DMARC status checking
- **Link analysis:**
  - Consistency checking (link domain vs. sender domain)
  - Obfuscation detection (redirects, URL encoding, special chars)
  - 5 obfuscation patterns (@, %XX encoding, redirect, url=, link=)
- **Spammy phrase detection:** 40+ known phishing phrases
- **Attachment risk:** 15 risky file extensions (.exe, .bat, .vbs, .zip, .docm, .xlsm, etc.)
- **HTML-only email detection** (zero-content phishing)
- **Urgency + personal info combo detection**
- **Reply-To spoofing detection**
- **Header parser:** `analyzeEmailHeader()` extracts essential headers

---

#### A5. SocialEngShield — Social Engineering Detection
**File:** `cyberFeatures/socialEngShield.js`

Detects social engineering pressure tactics in messages.

**Detection Capabilities:**
- 12 suspicious social engineering terms (urgent, immediately, confidential, only between us, do not tell anyone, verify your account, security alert, your account will be blocked)
- Authority impersonation detection (police, CBI, court, bank, support)

---

#### A6. OTPGuard — OTP Fraud Detection
**File:** `cyberFeatures/otpGuard.js`

Detects OTP/sensitive code harvesting attempts.

**Detection Capabilities:**
- OTP/verification code request detection
- SIM swap / number porting mentions
- Urgency framing detection

---

#### A7. CourierGuard — Courier/Parcel Scam Detection
**File:** `cyberFeatures/courierGuard.js`

Detects fake courier/delivery scam messages.

**Detection Capabilities:**
- 14 suspicious courier scam terms (customs, parcel seized, delivery blocked, pay fee, release parcel)
- Tracking number presence analysis
- Payment/OTP request detection within courier context

---

### Group B: Financial Scam Detection

#### B1. UPI Fraud Shield — UPI Transaction Risk Checker
**File:** `cyberFeatures/upiFraudShield.js`

In-depth UPI transaction risk analysis.

**Detection Capabilities:**
- **UPI ID analysis:** 10 high-risk patterns (numeric-only usernames, temp/test/guest/user handles); handle type classification (bank vs. app vs. unknown); bank handle database (48+ bank handles); app handle database (12+ app handles)
- **Amount analysis:** High-value thresholds (₹50K/₹1L); odd amount detection (<₹1000 non-round)
- **Reason/purpose analysis:** 33 suspicious transaction reasons (refund, cashback, processing fee, loan approval, exam fee, customs clearance, etc.)
- **Time-based analysis:** Late night (12 AM-6 AM = 20 pts), Late evening (10 PM-12 AM = 10 pts)
- **Known scam UPI IDs:** 3 pre-identified scam UPI handles
- **Frequency analysis:** Multiple small transactions (5+ ≤₹500 in 60 min); rapid sequence (3+ in 5 min)
- **Wallet top-up layering detection**
- **History analysis:** `analyzeUPIHistory()` — batch transaction analysis with pattern detection (high avg value, multiple critical risks, repeated recipient)

---

#### B2. InvestScan — Investment Scam Detection
**File:** `cyberFeatures/investScan.js`

Detects fraudulent investment/pyramid scheme pitches.

**Detection Capabilities:**
- 14 suspicious investment terms (guaranteed, risk free, double, 100% return, daily profit, referral bonus, ponzi, bitcoin, crypto, get rich, passive income)
- Large promised return detection
- Urgency/pressure tactic detection

---

#### B3. JobScamRadar — Job Offer Fraud Detection
**File:** `cyberFeatures/jobScamRadar.js`

Detects fake job offer / recruitment scams.

**Detection Capabilities:**
- 17 suspicious job scam terms (registration fee, training fee, processing fee, guaranteed income, no interview, immediate placement, pay now, send money, work from home, urgent, quick cash)
- Unrealistic salary claim detection
- Urgency/pressure to accept quickly
- Upfront payment demand detection
- Missing interview/vetting process detection

---

#### B4. LoanTrapAlert — Loan Fraud Detection
**File:** `cyberFeatures/loanTrapAlert.js`

Detects predatory loan offers and advance-fee loan scams.

**Detection Capabilities:**
- 10 suspicious loan terms (processing fee, advance payment, instant approval, no documents, guaranteed approval, cash immediately, quick loan, pay now)
- Urgency pressure for rushed decision
- Upfront payment/transfer request detection

---

#### B5. InvoiceFraudDetector — Invoice Fraud Detection
**File:** `cyberFeatures/invoiceFraudDetector.js`

Detects fake invoice/BEC (Business Email Compromise) attempts.

**Detection Capabilities:**
- Urgency to force immediate payment
- Non-standard payment method detection (bank, UPI, wallet, crypto, gift card)
- Missing or invalid amount detection

---

#### B6. PaymentReceiptAuthenticity — Receipt Verification
**File:** `cyberFeatures/paymentReceiptAuthenticity.js`

Verifies authenticity of payment receipts/screenshots.

**Detection Capabilities:**
- Missing transaction ID detection
- Missing merchant name detection
- Unofficial/non-standard payment descriptions
- Refund/overpayment/claim bait language
- Missing bank or QR payment details

---

#### B7. SubscriptionFraudChecker — Subscription Trap Detection
**File:** `cyberFeatures/subscriptionFraudChecker.js`

Detects hidden subscription terms and billing traps.

**Detection Capabilities:**
- Auto-renewal without clear consent
- Free trial bait tactics
- Urgency for fast sign-up
- Premium/VIP/Exclusive language analysis

---

#### B8. MarketplaceFraudEvaluator — Online Marketplace Risk
**File:** `cyberFeatures/marketplaceFraudEvaluator.js`

Assesses risk of online marketplace listings.

**Detection Capabilities:**
- Urgency to rush buyer
- Low/no seller rating detection
- No transaction history flagging
- Non-standard payment requests (UPI, wallet, advance, deposit, outside platform)
- Bait language detection (too good, unbelievable, steal, below market, must sell)

---

#### B9. DeliveryScamPredictor — Delivery Fraud Analysis
**File:** `cyberFeatures/deliveryScamPredictor.js`

Detects fake delivery notification scams.

**Detection Capabilities:**
- Payment request before release (redelivery fee)
- OTP/personal code request (critical signal)
- Customs/penalty threat language
- Address confusion / update requests
- Missing tracking or courier details

---

#### B10. TravelBookingFraudDetector — Travel Scam Detection
**File:** `cyberFeatures/travelBookingFraudDetector.js`

Detects fraudulent travel booking offers.

**Detection Capabilities:**
- OTP/CVV request (never required for bookings — critical)
- Limited-time urgency for payment rush
- Non-standard payment method (outside platform, direct transfer, wallet, crypto, gift card)
- Bait offers (free upgrade, exclusive discount, limited seats, last minute)

---

#### B11. RentalScamChecker — Rental Property Fraud
**File:** `cyberFeatures/rentalScamChecker.js`

Detects fake rental listing scams.

**Detection Capabilities:**
- Advance payment before property viewing (critical signal)
- Urgency to decide without viewing
- No photos or virtual tour available
- Bait language (below market, too good, overseas landlord, can't visit, agent fee)
- Unusually high deposit amount

---

#### B12. CharityFraudEvaluator — Charity Fraud Detection
**File:** `cyberFeatures/charityFraudEvaluator.js`

Detects fraudulent charity/donation solicitations.

**Detection Capabilities:**
- Missing charity registration number
- Emotional urgency for immediate donation
- Non-standard payment method (UPI, wallet, crypto, gift card, personal account)
- Matching/double/limited-time bait tactics

---

#### B13. CrowdfundingLegitimacyChecker — Campaign Verification
**File:** `cyberFeatures/crowdfundingLegitimacyChecker.js`

Verifies legitimacy of crowdfunding campaigns.

**Detection Capabilities:**
- Unverified campaign creator
- No campaign updates or progress reports
- Emotional bait language (only you, urgent, help now)
- Off-platform donation requests (direct, UPI, wallet, personal account)

---

#### B14. FakeGiveawayDetector — Fake Promotion Detection
**File:** `cyberFeatures/fakeGiveawayDetector.js`

Detects fake social media giveaways and promotions.

**Detection Capabilities:**
- Prize/giveaway offer detection
- Follow/engagement requirement analysis
- Payment/fee requirement (critical signal)
- Classic giveaway bait language (winner, selected, claim, today, limited, free)

---

#### B15. RewardTemptationAnalyzer — Reward Bait Detection
**File:** `cyberFeatures/rewardTemptationAnalyzer.js`

Analyzes reward-based manipulation tactics.

**Detection Capabilities:**
- Prize incentive detection
- Cashback/reward bait analysis
- Bonus trust-building detection
- Limited/exclusive offer pressure
- Temptation language analysis (free, winner, claim, selected, congratulations, exclusive)

---

### Group C: Identity & Document Security

#### C1. IDShield — Identity Document Fraud Detection
**File:** `cyberFeatures/idShield.js`

Detects attempts to misuse identity documents.

**Detection Capabilities:**
- Sensitive document reference detection (Aadhaar, PAN, passport, voter, DL)
- Identity detail/OTP sharing request detection
- Urgency framing for compliance pressure

---

#### C2. FakeDocumentVerifier — Document Authenticity Check
**File:** `cyberFeatures/fakeDocumentVerifier.js`

Verifies authenticity of digital documents.

**Detection Capabilities:**
- Missing watermark detection
- Suspicious/urgent language in document (fake, urgent, verify now, download, claim)
- Missing or weak file metadata
- Combined document + metadata inconsistency analysis

---

#### C3. DigitalDocumentConsistency — Document Integrity Check
**File:** `cyberFeatures/digitalDocumentConsistency.js`

Checks digital document metadata and content consistency.

**Detection Capabilities:**
- Claimed vs. actual content mismatch (critical signal)
- Missing digital signature verification
- Created vs. modified date inconsistency
- Suspicious/scam-related term detection (bank, OTP, Aadhaar, PAN, payment, transfer, urgent, verify, notice, fine, legal)
- Tamper language detection (copy, fake, scam, tamper, unauthorized, illegal)

---

#### C4. FakeGovernmentNoticeVerifier — Government Notice Authenticity
**File:** `cyberFeatures/fakeGovernmentNoticeVerifier.js`

Detects fake government/fax communication scams.

**Detection Capabilities:**
- Payment demand detection (government never demands instant payment)
- OTP/bank detail request detection (official notices never ask)
- Missing official seal/watermark
- Missing authorized signatory
- Threat language analysis (urgent, immediate, final notice, legal action, arrest, penalty, fine, blocked, suspend)
- Unofficial payment channel detection (UPI, wallet, gift card, crypto, personal account)

---

#### C5. LegalNoticeAuthenticityChecker — Legal Notice Verification
**File:** `cyberFeatures/legalNoticeAuthenticityChecker.js`

Verifies authenticity of legal notices and court communications.

**Detection Capabilities:**
- Payment demand to resolve matter (critical signal)
- Personal/financial information request
- Missing court seal
- Missing verifiable lawyer/firm details
- Missing case number or reference ID
- Intimidation/threat language (urgent, immediate, arrest, warrant, contempt, penalty, fine, settle now, last chance)

---

#### C6. ScreenshotMetadataInspector — Metadata Analysis
**File:** `cyberFeatures/screenshotMetadataInspector.js`

Analyzes screenshot metadata for privacy risks.

**Detection Capabilities:**
- GPS location in metadata (critical exposure)
- Device model/software information leakage
- Missing creation timestamp
- Edit/tamper detection
- Sensitive content in visible screenshot text (OTP, password, bank, Aadhaar, PAN, UPI, transaction, payment, CVV, PIN, login, credential)

---

#### C7. DigitalIdentityExposure — Exposure Assessment
**File:** `cyberFeatures/digitalIdentityExposure.js`

Assesses overall digital identity exposure risk.

**Detection Capabilities:**
- Data leak count analysis (3+ = high risk)
- Public profile exposure assessment
- Social account footprint analysis
- Phone number exposure detection

---

#### C8. SuspiciousUsernameAnalyzer — Username Risk Analysis
**File:** `cyberFeatures/suspiciousUsernameAnalyzer.js`

Analyzes usernames for impersonation or scam indicators.

**Detection Capabilities:**
- Authority/reward bait words (admin, support, verify, security, official, bank, help, free, winner, prize, crypto, cash, loan)
- Short username length (<6 chars) — easy to impersonate
- Excessive digits (3+ numbers) — disposable username pattern

---

#### C9. FakeSocialProfileInspector — Profile Authenticity
**File:** `cyberFeatures/fakeSocialProfileInspector.js`

Assesses social media profile authenticity.

**Detection Capabilities:**
- Unverified profile detection
- Reward/money bait language in bio/handle
- Low follower count (<100)
- Missing profile photo

---

### Group D: Device & Browser Security

#### D1. BrowserPermissionAbuse — Permission Risk Assessment
**File:** `cyberFeatures/browserPermissionAbuse.js`

Assesses risk of over-broad browser permissions.

**Input:** Camera, microphone, location, notifications, clipboard, screen share enable states

**Detection Capabilities:**
- Over-broad permissions (4+ sensitive permissions)
- Per-permission risk scoring (camera=12, microphone=12, location=10, notifications=8, clipboard=10, screen share=15)
- Risk scoring and actionable recommendations

---

#### D2. ClipboardHijack — Clipboard Security
**File:** `cyberFeatures/clipboardHijack.js`

Detects clipboard monitoring and sensitive content risks.

**Detection Capabilities:**
- Active clipboard access by app/extension
- Sensitive content in clipboard (OTP, password, bank, UPI, Aadhaar, PAN, secret, token)
- Suspicious login/credential patterns in clipboard

---

#### D3. ScreenSharingSafety — Screen Share Risk Assessment
**File:** `cyberFeatures/screenSharingSafety.js`

Assesses risks during active screen sharing sessions.

**Detection Capabilities:**
- Active screen sharing detection
- Sensitive content exposure (private/financial info)
- Suspicious sharing context (bank, account, password, OTP, chat, email, document, invoice, receipt visible)

---

#### D4. WebcamMicAuditor — Camera/Microphone Auditor
**File:** `cyberFeatures/webcamMicAuditor.js`

Audits webcam and microphone access.

**Detection Capabilities:**
- Camera access enabled
- Microphone access enabled
- Sensitive usage context (meeting, interview, call, recording)

---

#### D5. ExtensionTrustAnalyzer — Browser Extension Safety
**File:** `cyberFeatures/extensionTrustAnalyzer.js`

Assesses browser extension trustworthiness.

**Detection Capabilities:**
- Unverified publisher detection
- Broad permission analysis (clipboard, tabs, history, downloads, storage, notifications, webRequest)
- Suspicious name detection (ad, VPN, cashback, coupon, tracker, helper)
- Low rating detection (<4 stars)

---

#### D6. WebSafeAnalyzer — Web Browsing Safety
**File:** `cyberFeatures/webSafeAnalyzer.js`

Assesses general web browsing safety.

**Detection Capabilities:**
- Non-secure/suspicious URL patterns (HTTP, localhost, IP address, risky TLDs)
- Public WiFi network context (airport, coffee shop, hotel)
- Browser privacy controls mentioned

---

#### D7. DeviceSecurityChecklist — Device Security Posture
**File:** `cyberFeatures/deviceSecurityChecklist.js`

Assesses device-level security configuration.

**Checked Protections (6):**
- Screen lock enabled
- System updates enabled
- Antivirus/security tooling installed
- Data backup configured
- VPN usage
- Multi-factor authentication enabled

**Risk Scoring:** Weak hygiene (<3 protections = high risk), per-missing-item scoring

---

#### D8. PassStrengthPro — Password Strength Analyzer
**File:** `cyberFeatures/passStrengthPro.js`

Analyzes password strength with detailed feedback.

**Detection Capabilities:**
- Length analysis (<8 = high risk, ≥14 with diversity = bonus)
- Complexity check (uppercase, number, symbol required)
- Common password detection (password, 123456, qwerty, admin, welcome)
- Positive scoring for strong passwords (14+ chars + all complexity)

---

#### D9. PrivacyExposureScanner — Privacy Exposure Scan
**File:** `cyberFeatures/privacyExposureScanner.js`

Scans for online privacy exposure.

**Detection Capabilities:**
- Public posts count analysis (>5 = medium risk)
- Location sharing detection
- Contacts/address exposure
- Public email detection
- Profile visibility assessment (public = risk)

---

### Group E: Psychological & Behavioral Analysis

#### E1. ScamPsychologyAnalyzer — Scam Psychology Analysis
**File:** `cyberFeatures/scamPsychologyAnalyzer.js`

Analyzes psychological manipulation tactics in messages.

**Detection Capabilities:**
- Urgency creation detection
- Reward/prize dangling detection
- Authority/official pretense detection
- Secrecy/silence request detection
- Persuasion language analysis (fear, panic, hurry, limited, exclusive, free, secret)

---

#### E2. EmotionalManipulationDetector — Emotion Exploitation Detection
**File:** `cyberFeatures/emotionalManipulationDetector.js`

Detects emotional exploitation tactics.

**Detection Capabilities:**
- Fear-based pressure (25 pts)
- Guilt/obligation tactics (20 pts)
- False empathy/sympathy (15 pts)
- Flattery to lower resistance (10 pts)
- Manipulation phrase detection (please, only you, help me, family, love, regret)

---

#### E3. FinancialUrgencyDetector — Financial Pressure Detection
**File:** `cyberFeatures/financialUrgencyDetector.js`

Detects financial pressure and scam urgency tactics.

**Detection Capabilities:**
- Time pressure language (today, now, immediately, within hours/minutes, last chance)
- High requested amount (>₹1000)
- Risky payment method (UPI, wallet, gift card, crypto, cash app)

---

#### E4. AuthorityImpersonationDetector — Authority Pretender Detection
**File:** `cyberFeatures/authorityImpersonationDetector.js`

Detects authority impersonation in messages.

**Detection Capabilities:**
- Official authority claims (police, CBI, court, income tax, customs, bank, government, official)
- Sensitive information requests (OTP, password, Aadhaar, PAN, bank details, verify)
- Urgency for compliance pressure

---

#### E5. ConversationPressureMeter — Pressure Measurement
**File:** `cyberFeatures/conversationPressureMeter.js`

Measures pressure tactics in conversations.

**Detection Capabilities:**
- Repeated request detection
- Interruption/disregard of hesitation
- Blame to force compliance
- Pressure language analysis (now, hurry, do it, immediately, must, cannot wait)

---

#### E6. ScamPersuasionBreakdown — Cialdini Persuasion Analysis
**File:** `cyberFeatures/scamPersuasionBreakdown.js`

Analyzes messages against Cialdini's 6 principles of persuasion.

**Detection Capabilities:**
- **Authority:** Police, bank, government claims (20 pts)
- **Scarcity:** Limited-time pressure (18 pts)
- **Social Proof:** "Others have participated" claims (15 pts)
- **Reciprocity:** Free offers creating obligation (15 pts)
- **Commitment:** Past action reference for consistency pressure (12 pts)
- **Liking:** Flattery/false rapport (10 pts)
- Phrase detection for each principle category

---

### Group F: Safety & Resilience

#### F1. SeniorProtectionMode — Senior Citizen Protection
**File:** `cyberFeatures/seniorProtectionMode.js`

Specialized protection for senior citizens against scams.

**Detection Capabilities:**
- OTP request (critical — seniors should never share)
- Money/payment request (critical)
- Remote device access request (critical)
- Personal info request (Aadhaar, PAN, bank details)
- Authority pressure (police, CBI, court, bank, income tax, customs, government, official, arrest, warrant, digital arrest, parcel)
- Family emergency exploitation (son, daughter, grandson, granddaughter, family, relative, friend, emergency, accident, hospital)

---

#### F2. ChildrenOnlineSafety — Children's Online Safety
**File:** `cyberFeatures/childrenOnlineSafety.js`

Assesses online safety measures for children.

**Checked Protections (6):**
- Parental controls installed
- Screen time limits configured
- Content/age-appropriate filters
- Location tracking (for children under 13)
- Online activity logs
- Safe search enforced

**Additional Detection:**
- Predator bait language (free, friend request, gift, prize, win, click, download, private)
- Age-appropriate risk scoring

---

#### F3. StudentScamAwareness — Student Scam Protection
**File:** `cyberFeatures/studentScamAwareness.js`

Detects scams targeting students.

**Detection Capabilities:**
- Upfront fee for internships/scholarships (high risk)
- OTP/password harvesting (critical)
- Personal document requests (Aadhaar, PAN, etc.)
- Urgency for rushed decision
- Student bait phrases (scholarship, internship, work from home, easy money, part time, data entry, online job, guaranteed)

---

#### F4. FamilyCyberSafety — Family Safety Assessment
**File:** `cyberFeatures/familyCyberSafety.js`

Assesses overall family cyber safety posture.

**Checked Areas (5):**
- Shared password management policy
- Agreed cyber safety rules
- Parental controls (for families with children)
- Open communication about online risks
- Cyber incident emergency plan

---

#### F5. DigitalInheritanceSafety — Digital Asset Inheritance
**File:** `cyberFeatures/digitalInheritanceSafety.js`

Assesses digital inheritance preparedness.

**Checked Areas (5):**
- Digital will / inheritance plan
- Executor assigned for digital assets
- Inventory of digital assets (accounts, crypto, subscriptions)
- Secure password sharing plan for heirs
- Beneficiary information for digital accounts

**Additional:** Inheritance scam language detection

---

#### F6. CyberIncidentImpact — Incident Impact Assessment
**File:** `cyberFeatures/cyberIncidentImpact.js`

Assesses the potential impact of a cyber incident.

**Detection Capabilities:**
- Data loss potential
- Financial/banking access risk
- Number of affected devices (2+ = elevated)
- Number of affected accounts (2+ = elevated)
- Sensitive context analysis (identity, bank, payment, OTP)

---

#### F7. AccountTakeoverEstimator — Account Takeover Risk
**File:** `cyberFeatures/accountTakeoverEstimator.js`

Estimates risk of account takeover based on security posture.

**Detection Capabilities:**
- MFA not enabled (critical — 25 pts)
- Weak/common password (20 pts)
- Password reuse across platforms (20 pts)
- Recent suspicious login activity (15 pts)
- Recent data breach involvement (10 pts)
- Missing recovery email/phone (10 pts)

---

#### F8. MFAReadinessChecker — Multi-Factor Readiness
**File:** `cyberFeatures/mfaReadinessChecker.js`

Assesses multi-factor authentication readiness.

**Detection Capabilities:**
- No MFA enabled (critical — 40 pts)
- Multiple accounts without MFA (3+ = 20 pts)
- SMS-only MFA (SIM-swap vulnerability = 15 pts)
- Missing backup codes (10 pts)
- Single MFA method only (10 pts)

---

#### F9. PersonalCyberHygiene — Cyber Hygiene Audit
**File:** `cyberFeatures/personalCyberHygiene.js`

Audits personal cyber hygiene against 8 best practices.

**Checked Habits (8):**
- Uses a password manager
- Changes passwords regularly
- Uses MFA on all accounts
- Avoids public WiFi (or uses VPN)
- Regularly updates software
- Reviews app permissions
- Logs out of sessions
- Never shares OTPs

---

#### F10. ScamResilienceAssessment — Personal Resilience Score
**File:** `cyberFeatures/scamResilienceAssessment.js`

Assesses personal resilience against scams across 8 traits.

**Checked Traits (8):**
- Recognizes phishing attempts
- Never shares OTPs
- Independently verifies caller identity
- Uses MFA
- Has strong passwords
- Reports suspicious activity
- Stays informed about scams
- Pauses before acting

**Special:** Previous scam victim flag (higher risk of repeat targeting)

---

#### F11. CyberPreparednessReport — Preparedness Report
**File:** `cyberFeatures/cyberPreparednessReport.js`

Generates comprehensive cyber preparedness report across 8 areas.

**Checked Areas (8):**
- Incident response plan in place
- Regular data backup system
- Cyber insurance coverage
- Knows how to report cyber incidents
- Security software/endpoint protection
- Emergency contact list for incidents
- Regular software updates
- Password manager usage

---

#### F12. DigitalTrustScore — Trustworthiness Score
**File:** `cyberFeatures/digitalTrustScore.js`

Calculates a digital trust score (0-100) for accounts/profiles.

**Positive Signals:**
- Secure, unique password (+10)
- MFA enabled (+10)
- No known data breaches (+8)
- Clean activity history (+8)
- Profile verified by platform (+7)
- Positive reviews/ratings (+5)
- Account age > 12 months (+5)
- Complete profile (+4)

**Negative Signals:**
- Known data breaches (-15)
- Suspicious activity detected (-15)
- Reported by other users (-20)

**Trust Bands:** Low (<40), Medium (40-69), High (≥70)

---

#### F13. OnlineReputationSafety — Reputation Risk Assessment
**File:** `cyberFeatures/onlineReputationSafety.js`

Assesses online reputation risks.

**Detection Capabilities:**
- Negative/defamatory content existence
- Fake account impersonation
- Doxxing (personal info exposed publicly — critical)
- Data leak involvement
- Fake profiles using name/image
- Review manipulation
- No active reputation monitoring
- No action taken on issues

---

#### F14. CyberCaseBuilder — Case Building Tool
**File:** `cyberFeatures/caseBuilder.js`

Tool for building cyber crime cases with collected evidence.

*(Located in cyberFeatures directory, used via CyberCaseBuilderView component)*

---

## 5. Frontend Pages & Views

### 5.1 Main Pages

| Route (`activeView`) | Component | Description |
|---------------------|-----------|-------------|
| `home` | `HomePage.jsx` | Landing page with hero, CTAs, feature highlights |
| `portal` (citizen) | `CitizenPortal.jsx` | Main citizen dashboard (scam check, currency scan, report) |
| `portal` (officer) | `OfficerCommandCenter.jsx` | Officer command center (graph, case, copilot) |
| `intelligence` | `ScamIntelligencePage.jsx` | Live scam analysis with entity extraction, evidence spans, score breakdown, timeline |
| `fraud-graph` | `FraudGraphView.jsx` | Visual fraud graph explorer |
| `toolbox` | `CyberToolboxPage.jsx` | All 60+ cyber tools organized by category |
| `meet` / `contributors` | `MeetPage.jsx` | Dedicated Open Source Contributors Hub & Core Team directory |
| `rule-library` | `ThreatLibraryPage.jsx` | Browse threat pattern library with categorized examples |
| `scam-examples` | `ScamExamplesPage.jsx` | 2,200+ synthetic scam scenario patterns |
| `safety-tips` | `SafetyTipsPage.jsx` | Digital safety best practices |
| `awareness` | `AwarenessPage.jsx` | Public awareness resources |
| `motivation` | `MotivationPage.jsx` | Problem statement and project motivation |
| `about` | `AboutPage.jsx` | Project background and team |
| `how-it-works` | `HowItWorksPage.jsx` | Technical explainer |
| `contact` | `ContactPage.jsx` | Contact form and incident reporting |

### 5.2 Cyber Tool Views (60+ Single-Page Tools)

Each cyber feature module has a dedicated view component that provides an interactive UI for its analysis functions. Views are categorized:

**Communication Security:** QRGuardianView, LinkShieldView, SMSAnalyzerView, PhishDetectView, SocialEngShieldView, OTPGuardView, CourierGuardView

**Financial Security:** UPIFraudShieldView, InvestScanView, JobScamRadarView, LoanTrapAlertView, InvoiceFraudDetectorView, PaymentReceiptAuthenticityView, SubscriptionFraudCheckerView, MarketplaceFraudEvaluatorView, DeliveryScamPredictorView, TravelBookingFraudDetectorView, RentalScamCheckerView, CharityFraudEvaluatorView, CrowdfundingLegitimacyCheckerView, FakeGiveawayDetectorView, RewardTemptationAnalyzerView

**Identity & Documents:** IDShieldView, FakeDocumentVerifierView, DigitalDocumentConsistencyView, FakeGovernmentNoticeVerifierView, LegalNoticeAuthenticityCheckerView, ScreenshotMetadataInspectorView, DigitalIdentityExposureView, SuspiciousUsernameAnalyzerView, FakeSocialProfileInspectorView

**Device & Browser:** BrowserPermissionAbuseView, ClipboardHijackView, ScreenSharingSafetyView, WebcamMicAuditorView, ExtensionTrustAnalyzerView, WebSafeAnalyzerView, DeviceSecurityChecklistView, PassStrengthProView, PrivacyExposureScannerView

**Psychology & Behavior:** ScamPsychologyAnalyzerView, EmotionalManipulationDetectorView, FinancialUrgencyDetectorView, AuthorityImpersonationDetectorView, ConversationPressureMeterView, ScamPersuasionBreakdownView

**Safety & Resilience:** SeniorProtectionModeView, ChildrenOnlineSafetyView, StudentScamAwarenessView, FamilyCyberSafetyView, DigitalInheritanceSafetyView, CyberIncidentImpactView, AccountTakeoverEstimatorView, MfaReadinessCheckerView, PersonalCyberHygieneView, ScamResilienceAssessmentView, CyberPreparednessReportView, DigitalTrustScoreView, OnlineReputationSafetyView, CyberCaseBuilderView

### 5.3 Shared Components

| Component | Description |
|-----------|-------------|
| `Shell.jsx` | App shell — nav bar, footer, portal toggle (Citizen/Officer) |
| `RiskGauge.jsx` | Live animated risk score gauge (0-100) |
| `CyberFeatureCard.jsx` | Feature card for toolbox grid display |

---

## 6. API Endpoints

| Method | Endpoint | Agent | Description |
|--------|----------|-------|-------------|
| Method | Endpoint | Agent | Description |
|--------|----------|-------|-------------|
| `GET` | `/` | Health | Service name, status, docs URL |
| `POST` | `/api/scam/analyze` | Digital Arrest | Analyzes transcript for scam signals → `{risk_score, risk_band, matched_patterns, recommendation}` |
| `POST` | `/api/currency/scan` | Counterfeit | Scans currency note image (multipart) → `{verdict, confidence, reasons[], signals{}}` |
| `GET` | `/api/graph/ring/{account_id}` | Fraud Graph | Looks up account in fraud graph → `{is_flagged, mule_probability, ring_id, connected_accounts[]}` |
| `POST` | `/api/citizen/ask` | Citizen Assistant | Asks safety question → `{answer}` (multilingual) |
| `POST` | `/api/citizen/report` | Citizen Assistant | Submits fraud/scam report → `{report_id, acknowledgement, draft_fir}` |
| `GET` | `/api/officer/case/{report_id}` | Officer Copilot | Generates case summary → `{priority, summary, suggested_next_steps[]}` |
| `POST` | `/api/llm/chat` | LLM Bridge | Raw LLM chat → `{text}` |
| `GET` | `/docs` | — | Swagger UI interactive API docs |

---

## 7. Data Model

### PostgreSQL (Relational Core — Production)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  role TEXT CHECK (role IN ('citizen','officer','bank','telecom')),
  name TEXT, phone TEXT UNIQUE, language TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY, user_id UUID REFERENCES users(id),
  type TEXT CHECK (type IN ('scam_call','counterfeit','fraud_tx')),
  risk_score NUMERIC, transcript TEXT, evidence_url TEXT,
  status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cases (
  id UUID PRIMARY KEY, officer_id UUID REFERENCES users(id),
  summary TEXT, priority TEXT, linked_report_ids UUID[]
);
```

### In-Memory Store (Current Prototype)

The prototype uses an in-memory Python dict (`store.py`) as a stand-in for PostgreSQL, storing reports and case data during a session. Each report gets a unique `RPT-XXXX` ID.

### Neo4j Graph Model (Production Vision)

Nodes: `Account`, `Phone`, `Device`, `UPI_ID`, `Victim`, `Location`

Relationships: `SHARED_DEVICE`, `TRANSACTED_WITH`, `SAME_IP`, `SAME_PHONE`, `USES`

---

## 8. Scam Scenario Library

The `ruleEngine.js` generates a synthetic library of **2,200+ unique scam scenario patterns** for reference, education, and pattern matching.

**Generator Components:**
- **Authorities (11):** CBI, police, customs, income tax, cyber cell, court, crime branch, revenue department, financial crime unit, enforcement team, anti-fraud cell, revenue officer, tax authority, public prosecutor
- **Targets (11):** Aadhaar, OTP, bank account, SIM card, mobile number, parcel, passport, wallet, UPI ID, device, KYC
- **Mediums (12):** Call, text message, WhatsApp message, missed call alert, SMS, email, screenshot, app notification, voice message, document image, notification
- **Actions (12):** Asked, requested, insisted, warned, claimed, reported, explained, mentioned, repeated, stated, confirmed, urged
- **Issues (12):** Blocked, frozen, suspended, sealed, flagged, monitored, investigated, scrutinized, arrested, reviewed, under digital arrest, linked to fraud
- **Endings (12):** To avoid legal trouble, to protect your account, to prevent arrest, to avoid a court notice, to complete verification, to release the parcel, to keep the account active, to avoid a notice, to stop a fine, to prevent a suspension
- **Urgency (39+):** Immediately, now, today, right away, urgent, within minutes, do not disconnect, hurry, quickly, asap, etc.
- **Payment terms (23+):** OTP, one time password, Aadhaar, bank details, transfer, payment, verification amount, pay, money, UPI, cash, send, refund, deposit, wallet, fee, fine, settlement, transaction, credit, crypto, bitcoin, gift card

**Sample Scenario Pattern:**
> *"A WhatsApp message claimed customs insisted that your passport is frozen, and you must transfer immediately to avoid legal trouble."*

The library is accessible via `getRuleLibrarySamplesLocally()`, which returns sample cases along with metadata counts (total authorities, targets, mediums, urgency terms, secrecy terms, payment terms).

---

## 9. Security & Privacy

### Authentication & Access Control

| Feature | Prototype Status | Production Plan |
|---------|-----------------|-----------------|
| Role-based access (citizen/officer/bank/telecom) | 🔜 Roadmap | JWT with Firebase Auth |
| Portal toggle (client-side) | ✅ Built | Client-side UI switch only |

### Data Protection

| Feature | Implementation |
|---------|---------------|
| Encryption in transit | HTTPS via Vercel/HF Spaces defaults |
| Evidence hashing | SHA-256 on upload (planned) |
| PII minimization | Store phone numbers hashed (planned) |
| API security | FastAPI CORS + input validation |

### Best Practices Documented

The platform encourages:
- Never sharing OTPs, passwords, or Aadhaar with unexpected callers
- Verifying identities through official channels independently
- Enabling MFA on all financial and social accounts
- Using password managers and unique passwords
- Keeping software updated
- Regular permission reviews for apps and browser extensions
- Maintaining data backups and incident response plans

---

## 10. Tech Stack

### Production Vision Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Oxlint |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **ASR** | Whisper |
| **Scam Similarity** | Sentence-Transformers + FAISS |
| **Risk Scoring** | LightGBM / XGBoost |
| **Currency CV** | YOLOv11 + OpenCV |
| **Graph Database** | Neo4j AuraDB + GNN |
| **LLM** | Anthropic Claude API (Sonnet 5) |
| **Vector Store** | FAISS / Chroma |
| **Relational DB** | PostgreSQL |
| **Streaming** | Apache Kafka |
| **Caching** | Redis |
| **Auth** | Firebase Auth / JWT |
| **Infra** | Docker, Kubernetes, AWS/Azure |

### Current Running Stack (Prototype)

| Component | Implementation |
|-----------|---------------|
| **Frontend** | Vite 8 + React 19 + Tailwind CSS 4 |
| **Frontend lint** | oxlint |
| **Backend** | FastAPI 0.115 + Uvicorn 0.30 |
| **Scam detection** | Keyword scoring + bag-of-words cosine similarity |
| **Currency scan** | Pillow 10.4 + numpy 1.26 image heuristics |
| **Fraud graph** | NetworkX 3.3 in-memory graph |
| **LLM** | Anthropic SDK 0.34 (fallback to placeholder) |
| **Data store** | In-memory Python dict |
| **API docs** | Auto-generated Swagger at `/docs` |
| **Email** | @emailjs/browser (optional) |

### Running the Prototype

**Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The frontend works fully standalone using the client-side rule engine. Backend integration adds Claude-powered responses and server-side processing.

---

> **Document Version:** 1.0  
> **Generated from:** Full codebase analysis of KshemOS (`/workspaces/KshemOS`)  
> **Total Features Documented:** 60+ cyber feature modules, 5 backend AI agents, 6 client-side rule engine subsystems, 15+ frontend pages, 60+ interactive tool views
