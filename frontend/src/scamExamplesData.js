/**
 * Structured dataset and comparison models for Scam Examples.
 * Distinguishes suspicious scam patterns from legitimate benign communications
 * across consistent card structures: Title, Scenario, Warning Signs / Verification Indicators,
 * and Safe Response.
 */

export const SCAM_EXAMPLES = [
  {
    id: 'digital-arrest',
    title: 'Digital Arrest Coercion',
    type: 'suspicious',
    category: 'Authority Impersonation',
    channel: 'Skype / WhatsApp Video Call',
    callerClaim: 'CBI Special Crime Branch Officer',
    context: 'Victim receives an urgent call claiming their identity was used to traffic narcotics overseas.',
    scenario: 'This is Deputy Director Rao from the CBI Special Crime Branch. A DHL consignment containing 14 fake passports and 250 grams of MDMA drugs has been seized under your Aadhaar number. You are placed under immediate digital arrest. You must not disconnect this Skype video call or contact local police. To avoid formal detention, transfer a ₹2,50,000 security verification deposit to the RBI clearance account immediately.',
    warningSigns: [
      'Claims "digital arrest" over video/phone call — Indian courts and law enforcement have no legal provision for digital arrest.',
      'Forces victim to stay isolated on video call and forbids speaking to family or local police.',
      'Demands immediate fund transfer to a "government clearance" or "verification escrow" account.',
      'Manufactures false urgency with non-bailable arrest threats within 30 minutes.'
    ],
    safeResponse: 'Hang up immediately. No police agency, court, or CBI officer conducts investigations over Skype or asks for money transfers. Report immediately to the National Cybercrime Reporting Helpline 1930 and file a complaint at cybercrime.gov.in.',
    comparisonPairId: 'pair-authority'
  },
  {
    id: 'benign-police-summons',
    title: 'Official Police Inquiry Summons',
    type: 'benign',
    category: 'Authority Impersonation',
    channel: 'Official Phone Call / Postal Summons',
    callerClaim: 'Sub-Inspector, Hauz Khas Police Station',
    context: 'Police officer reaches out regarding a verified local incident or ongoing formal witness inquiry.',
    scenario: 'Good morning, this is Sub-Inspector Sharma from Hauz Khas Police Station regarding FIR No. 204/26 registered in our precinct. We require your witness statement regarding a vehicle collision on Outer Ring Road. Please visit our station desk in person tomorrow between 10:00 AM and 2:00 PM with your government photo ID. Do not make any payment or share personal OTPs over the phone.',
    warningSigns: [
      'Requires in-person attendance at a physical, registered police station during daytime hours.',
      'Cites a specific, verifiable FIR number registered in public police records.',
      'Explicitly cautions the citizen against sharing passwords, PINs, or paying any fee.',
      'Never demands remote screen sharing, video custody, or fund transfers.'
    ],
    safeResponse: 'Verify the police station landline via the official state police website, confirm the FIR registration number online, and attend the station in person or with legal representation.',
    comparisonPairId: 'pair-authority'
  },
  {
    id: 'courier-narcotics',
    title: 'Fake Customs Parcel Seizure',
    type: 'suspicious',
    category: 'Courier & Customs',
    channel: 'Automated IVR & WhatsApp Call',
    callerClaim: 'Customs Department, Mumbai Air Cargo',
    context: 'Robocall claims an international package sent in citizen’s name has been intercepted with contraband.',
    scenario: 'This is an automated dispatch from Mumbai International Customs & FedEx. Your parcel tracking ID #FDX-9921-IN addressed to Malaysia has been intercepted containing 5 expired ATM cards and banned psychotropic tablets. Press 1 to connect with our Narcotics Control Bureau liaison. If you do not pay the statutory clearance penalty of ₹85,000 within 2 hours, your passport and bank accounts will be blacklisted.',
    warningSigns: [
      'Automated robocall claiming courier seizure without any prior booking made by you.',
      'Immediate transfer of call to "Narcotics Bureau" without official paperwork or summons.',
      'Demands immediate penalty payment via personal UPI handles or QR codes.',
      'Threatens immediate cancellation of Aadhaar, passport, or bank accounts.'
    ],
    safeResponse: 'Terminate the call at once. Do not press any IVR digits or transfer money. Verify the tracking number directly on the official courier website. Genuine customs actions require formal physical notices.',
    comparisonPairId: 'pair-courier'
  },
  {
    id: 'benign-courier-delivery',
    title: 'Official Delivery Exception Notice',
    type: 'benign',
    category: 'Courier & Customs',
    channel: 'Official SMS / Delivery Associate Call',
    callerClaim: 'BlueDart Delivery Field Associate',
    context: 'Delivery partner contacts recipient for address clarification on an expected e-commerce package.',
    scenario: 'Hello, I am calling from BlueDart regarding your Amazon shipment tracking AWB #8492019341. I am at the gate of Prestige Enclave, but the building tower number is unclear on the shipping label. Could you confirm if you are in Tower B? No payment is required for this prepaid package. You may share the 4-digit package handover pin upon physical delivery.',
    warningSigns: [
      'Relates to a genuine order you placed, citing the exact merchant and tracking AWB.',
      'Explicitly confirms package is prepaid with zero additional fee.',
      'Uses only a delivery handover PIN upon physical arrival — never requests bank OTPs, UPI pins, or remote access apps.',
      'Never threatens penalties, legal action, or identity cancellation.'
    ],
    safeResponse: 'Provide verbal landmark or gate instructions. Never share bank passwords, UPI PINs, or NetBanking OTPs. Handover PIN should only be given after physically inspecting the sealed box.',
    comparisonPairId: 'pair-courier'
  },
  {
    id: 'bank-kyc-otp',
    title: 'Urgent Account Freeze & OTP Theft',
    type: 'suspicious',
    category: 'Banking & Financial',
    channel: 'SMS with Shortened Link & Phone Call',
    callerClaim: 'SBI Central Risk & Compliance Manager',
    context: 'Phishing message warns bank account has been locked due to overdue PAN card or KYC verification.',
    scenario: 'URGENT NOTICE: Your SBI Savings account ending in 4102 will be permanently blocked tonight at 9:00 PM due to unverified PAN card details. Click bit.ly/sbi-kyc-secure to update PAN immediately, or call our customer officer at 98112-XXXXX. Please share the 6-digit one-time password sent to your handset to complete the emergency activation.',
    warningSigns: [
      'Creates synthetic panic with arbitrary deadlines ("blocked tonight at 9:00 PM").',
      'Uses suspicious shortened links (bit.ly, tinyurl) or asks to install remote desktop apps (AnyDesk, QuickSupport).',
      'Explicitly requests the 6-digit OTP or login credentials.',
      'Sent from an unverified 10-digit mobile number rather than registered bank SMS sender ID.'
    ],
    safeResponse: 'Never click links in SMS or disclose OTPs. Banks never ask for OTPs or passwords over the phone or demand app installations. Visit your home branch or log in securely through the verified bank mobile application.',
    comparisonPairId: 'pair-banking'
  },
  {
    id: 'benign-bank-appointment',
    title: 'Official Branch Loan Verification',
    type: 'benign',
    category: 'Banking & Financial',
    channel: 'Official Bank Email & Relationship Manager Call',
    callerClaim: 'HDFC Bank Relationship Manager',
    context: 'Branch officer follows up on a customer-initiated loan or KYC renewal application.',
    scenario: 'Dear Mr. Verma, this is Priya from HDFC Bank Connaught Place Branch following up on your Home Loan application #HL-82914 submitted last Thursday. Your application documents are approved for stage 2. Please visit desk #3 at our branch on Wednesday between 10 AM and 4 PM with your original property tax receipt for verification. Remember, HDFC Bank will never ask for your passwords, OTP, or remote screen access.',
    warningSigns: [
      'References a customer-initiated application with a specific tracking identifier.',
      'Directs the customer to a physical bank branch for in-person document verification.',
      'Mandatory security footer emphasizing that the bank never requests passwords, PINs, or OTPs.',
      'No coercive threats of immediate account freezing or arbitrary deadlines.'
    ],
    safeResponse: 'Attend the scheduled branch appointment at your convenience or confirm the appointment using the phone number printed on the back of your debit card.',
    comparisonPairId: 'pair-banking'
  },
  {
    id: 'invest-pump-dump',
    title: 'Guaranteed High-Yield VIP Trading Ring',
    type: 'suspicious',
    category: 'Investments',
    channel: 'Telegram / WhatsApp Group Invite',
    callerClaim: 'Institutional Stock Trading Advisor',
    context: 'Victim is added to an unrequested messaging group sharing fake screenshots of massive stock market profits.',
    scenario: 'Exclusive Invitation: Join the SEBI Institutional Whale Trading Group 12. Our algorithmic AI trading system guarantees 35% daily returns with zero risk on institutional pre-IPO allocations. Transfer ₹50,000 to our proprietary clearing account (ICICI A/C: 00920192841, IFSC: ICIC0000092) before market opening to secure your allocation. Withdrawals are unlocked within 24 hours with 100% principal guarantee.',
    warningSigns: [
      'Promises guaranteed supernatural returns (35% daily, 100% risk-free) — illegal under SEBI regulations.',
      'Demands fund transfers to individual or unrelated corporate savings accounts rather than registered broker client accounts.',
      'Unsolicited addition to encrypted Telegram/WhatsApp groups with orchestrated fake profit testimonials.',
      'Demands advance fees or "tax payments" when attempting to withdraw profits.'
    ],
    safeResponse: 'Leave and report the group immediately. Legitimate investments never offer guaranteed returns. Verify broker registration on sebi.gov.in and only transact through registered stock exchanges and authorized brokers.',
    comparisonPairId: 'pair-investment'
  },
  {
    id: 'benign-mutual-fund',
    title: 'Official SEBI Quarterly Holding Statement',
    type: 'benign',
    category: 'Investments',
    channel: 'Registered Email & Demat Notification',
    callerClaim: 'Zerodha / NSDL Demat Depository',
    context: 'Statutory quarterly statement issued to registered investors holding demat securities.',
    scenario: 'Your Consolidated Account Statement (CAS) for the quarter ending September 2026 has been generated by NSDL/CDSL for Demat ID IN300123-XXXX567. You may securely log in to your registered depository portal or your broker console at console.zerodha.com to review your equity and mutual fund portfolio. No action is required from your end. Investments in securities market are subject to market risks; read all scheme related documents carefully.',
    warningSigns: [
      'Standard informational regulatory statement with no request for money or immediate action.',
      'Directs investor to established, user-authenticated domain console.',
      'Contains statutory risk disclaimers required by capital market regulators.',
      'Provides masked depository identifiers matching customer account.'
    ],
    safeResponse: 'Review statement for your financial and tax records. Only access your investment portal by manually typing the known URL into your browser.',
    comparisonPairId: 'pair-investment'
  },
  {
    id: 'utility-power-cut',
    title: 'Imminent Electricity Disconnection Threat',
    type: 'suspicious',
    category: 'Utilities',
    channel: 'SMS from 10-Digit Mobile Number',
    callerClaim: 'Discom Power Utility Officer',
    context: 'Threatening text message received in the evening claiming power cutoff within hours.',
    scenario: 'Dear Consumer, your electricity power supply will be permanently disconnected tonight at 9:30 PM by order of the power board because last month bill ₹168 is pending. To avoid disconnection, call Electricity Executive R.K. Sharma immediately at 82910-XXXXX and install the PowerDesk Quick APK to pay the penalty.',
    warningSigns: [
      'Arbitrary night-time disconnection threat when government customer service desks are closed.',
      'Lists personal 10-digit mobile number for an "executive" rather than official utility helpline.',
      'Directs consumer to download third-party APK file or make payment to personal UPI ID.',
      'Disregards statutory 15-day formal notice requirement under the Electricity Act.'
    ],
    safeResponse: 'Do not call the personal phone number or download APKs. Check your electricity bill status directly through your official utility board portal or municipal electricity billing application.',
    comparisonPairId: 'pair-utility'
  },
  {
    id: 'benign-utility-maintenance',
    title: 'Scheduled Grid Maintenance Advisory',
    type: 'benign',
    category: 'Utilities',
    channel: 'Official Discom SMS Header (e.g. BSES-DL)',
    callerClaim: 'BSES Rajdhani Power Limited',
    context: 'Proactive notice sent by power distributor regarding scheduled preventive maintenance.',
    scenario: 'Dear Consumer (CA #102938475), scheduled preventive transformer maintenance is planned in Sector 14, Pocket B on Thursday between 10:00 AM and 1:00 PM. Inconvenience is regretted. Power supply will be restored promptly upon completion. For inquiries, contact our 24/7 toll-free helpline 19123 or visit bsesdelhi.com.',
    warningSigns: [
      'References your registered Consumer Account (CA) number.',
      'Informational advisory about planned maintenance rather than a demand for payment.',
      'Lists official toll-free 5-digit national utility helpline (19123) and official domain.',
      'No threats of punitive disconnection, penalties, or demands for personal details.'
    ],
    safeResponse: 'Note the maintenance timing to plan your activities. No payment, verification, or customer action is required.',
    comparisonPairId: 'pair-utility'
  }
];

export const COMPARISON_PAIRS = [
  {
    id: 'pair-authority',
    title: 'Authority Summons: Digital Arrest vs Official Police Inquiry',
    category: 'Authority Impersonation',
    suspiciousId: 'digital-arrest',
    benignId: 'benign-police-summons',
    keyTakeaway: 'Genuine law enforcement summons citizens to a physical police station with formal FIR references. Scammers use video calls, isolation, and immediate extortion demands.',
    contrastPoints: [
      {
        aspect: 'Venue / Interaction',
        suspicious: 'Forced Skype/WhatsApp video call with demands for isolation',
        benign: 'In-person appearance at registered physical precinct'
      },
      {
        aspect: 'Financial Demand',
        suspicious: 'Immediate fund transfer to "clearance" or "escrow" accounts',
        benign: 'Zero financial demands; explicit warning not to share OTPs'
      },
      {
        aspect: 'Legal Grounds',
        suspicious: 'Fictitious "digital arrest" concept unsupported by law',
        benign: 'Formal FIR registration verifiable on state police portal'
      }
    ]
  },
  {
    id: 'pair-courier',
    title: 'Courier & Customs: Contraband Extortion vs Delivery Notice',
    category: 'Courier & Customs',
    suspiciousId: 'courier-narcotics',
    benignId: 'benign-courier-delivery',
    keyTakeaway: 'Real couriers confirm delivery details for packages you ordered with zero fees. Scammers claim intercepted illegal items to extract immediate panic penalties.',
    contrastPoints: [
      {
        aspect: 'Order Origin',
        suspicious: 'Unsolicited robocall regarding a mystery international parcel',
        benign: 'Corresponds to an order you placed with verifiable AWB tracking'
      },
      {
        aspect: 'Demanded Action',
        suspicious: 'Pay clearance penalty immediately via UPI or face arrest',
        benign: 'Confirm physical delivery address / share handover PIN'
      },
      {
        aspect: 'Official Process',
        suspicious: 'Instant transfer to fake Narcotics Bureau over VoIP',
        benign: 'Standard courier tracking on carrier domain'
      }
    ]
  },
  {
    id: 'pair-banking',
    title: 'Banking KYC: Urgent Account Freeze vs Routine Branch Follow-up',
    category: 'Banking & Financial',
    suspiciousId: 'bank-kyc-otp',
    benignId: 'benign-bank-appointment',
    keyTakeaway: 'Banks invite customers to physical branches for documentation. Scammers threaten same-day blocks and demand SMS OTPs or remote control apps.',
    contrastPoints: [
      {
        aspect: 'Deadline & Tone',
        suspicious: 'Extreme panic: "Account permanently blocked tonight"',
        benign: 'Flexible scheduled appointment during standard branch hours'
      },
      {
        aspect: 'Credentials Asked',
        suspicious: 'Direct demand for 6-digit OTP, passwords, or APK download',
        benign: 'Explicit reminder that bank never asks for passwords or OTPs'
      },
      {
        aspect: 'Channel',
        suspicious: 'Unverified 10-digit mobile number with shortened bit.ly URL',
        benign: 'Official bank relationship manager and physical branch desk'
      }
    ]
  },
  {
    id: 'pair-investment',
    title: 'Investments: 35% Daily Return Scam vs Regulated Demat Statement',
    category: 'Investments',
    suspiciousId: 'invest-pump-dump',
    benignId: 'benign-mutual-fund',
    keyTakeaway: 'Regulated capital market entities issue informational statements with risk disclosures. Scammers guarantee unrealistic, risk-free returns on WhatsApp.',
    contrastPoints: [
      {
        aspect: 'Return Promise',
        suspicious: 'Guaranteed 35% daily returns with "zero risk"',
        benign: 'Standard statutory risk disclosure required by SEBI'
      },
      {
        aspect: 'Payment Destination',
        suspicious: 'Personal savings bank accounts or mule UPI IDs',
        benign: 'No fund collection; access via authenticated depository login'
      },
      {
        aspect: 'Channel',
        suspicious: 'Unsolicited Telegram/WhatsApp group with orchestrated hype',
        benign: 'Registered email from CDSL/NSDL or authorized SEBI broker'
      }
    ]
  },
  {
    id: 'pair-utility',
    title: 'Utility Service: Night-Time Cutoff Scam vs Scheduled Maintenance',
    category: 'Utilities',
    suspiciousId: 'utility-power-cut',
    benignId: 'benign-utility-maintenance',
    keyTakeaway: 'Real utilities notify of planned maintenance with Consumer Account numbers and 24/7 helplines. Scammers threaten night power cuts to demand immediate payment.',
    contrastPoints: [
      {
        aspect: 'Timing',
        suspicious: 'Tonight 9:30 PM cutoff when service desks are closed',
        benign: 'Advance daytime window for planned grid improvements'
      },
      {
        aspect: 'Payment Demand',
        suspicious: 'Call personal mobile number or download APK to clear bill',
        benign: 'Zero payment demanded; informational advisory only'
      },
      {
        aspect: 'Helpline Provided',
        suspicious: 'Unverified private mobile phone number',
        benign: 'Official toll-free 5-digit national helpline (19123)'
      }
    ]
  }
];

/**
 * Filter examples by category, type (suspicious/benign/all), and search term.
 */
export function filterExamples(examples, { type = 'all', category = 'all', searchTerm = '' } = {}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return (examples || SCAM_EXAMPLES).filter((item) => {
    // Type filter
    if (type !== 'all' && item.type !== type) {
      return false;
    }

    // Category filter
    if (category !== 'all' && item.category !== category) {
      return false;
    }

    // Search query matching
    if (normalizedSearch) {
      const matchFound = [
        item.title,
        item.scenario,
        item.category,
        item.channel,
        item.callerClaim,
        item.context,
        item.safeResponse,
        ...(item.warningSigns || [])
      ].some((field) => String(field || '').toLowerCase().includes(normalizedSearch));

      if (!matchFound) return false;
    }

    return true;
  });
}

/**
 * Retrieve resolved comparison pairs with full example objects.
 */
export function getResolvedComparisonPairs(pairs = COMPARISON_PAIRS, examples = SCAM_EXAMPLES) {
  const exampleMap = new Map(examples.map((ex) => [ex.id, ex]));

  return pairs
    .map((pair) => ({
      ...pair,
      suspicious: exampleMap.get(pair.suspiciousId),
      benign: exampleMap.get(pair.benignId)
    }))
    .filter((pair) => pair.suspicious && pair.benign);
}

/**
 * Get list of unique categories from examples dataset.
 */
export function getUniqueCategories(examples = SCAM_EXAMPLES) {
  const set = new Set(examples.map((ex) => ex.category));
  return Array.from(set);
}

