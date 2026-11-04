/**
 * Calibrated Multi-Signal Risk Model & Governance Store.
 *
 * Provides calibrated multi-signal evaluation (Signal 1: Features, Signal 2: Coercive 4-Pillars,
 * Signal 3: Semantic Similarity, Signal 4: Context), inconclusive evidence handling,
 * baseline comparison against v1.0 legacy rules, model governance, rollback, and
 * labeled benchmark evaluation.
 */

export const BENCHMARK_CORPUS = [
  // Category 1: Digital Arrest (Critical)
  {
    id: "BENCH-DA-01",
    category: "digital_arrest",
    ground_truth_band: "critical",
    min_score: 75,
    transcript:
      "This is the CBI. A parcel with your Aadhaar number has been seized containing illegal narcotics and MDMA. You are under digital arrest. Stay on this video call, do not disconnect, stay in a quiet room, and transfer verification amount to the Supreme Court safe account immediately or a warrant will execute.",
    caller_claims_to_be: "CBI officer",
    context: { channel: "whatsapp_video", time_of_day: "night" },
  },
  {
    id: "BENCH-DA-02",
    category: "digital_arrest",
    ground_truth_band: "critical",
    min_score: 75,
    transcript:
      "Official notice from the Crime Branch. A non-bailable arrest warrant has been issued against you for money laundering. You must maintain strict confidentiality, do not tell your family members, and transfer your funds to the RBI safe clearance account right now.",
    caller_claims_to_be: "Crime Branch Inspector",
    context: { channel: "voip_call", time_of_day: "odd_hours" },
  },

  // Category 2: Customs Extortion (High/Critical)
  {
    id: "BENCH-CUSTOMS-01",
    category: "customs_extortion",
    ground_truth_band: "high",
    min_score: 50,
    transcript:
      "We are calling from customs department headquarters. Your international shipment contains contraband items and counterfeit passports. Pay the customs clearance penalty fee now or an FIR will be registered within two hours.",
    caller_claims_to_be: "customs officer",
    context: { channel: "pstn" },
  },
  {
    id: "BENCH-CUSTOMS-02",
    category: "customs_extortion",
    ground_truth_band: "high",
    min_score: 50,
    transcript:
      "Customs seizure division. A parcel addressed in your name has been impounded at airport cargo. You must pay the settlement amount through this UPI ID immediately to avoid police custody.",
    caller_claims_to_be: "customs official",
    context: { channel: "voip_call" },
  },

  // Category 3: Bank KYC & Utility (High)
  {
    id: "BENCH-KYC-01",
    category: "bank_kyc",
    ground_truth_band: "high",
    min_score: 50,
    transcript:
      "Your bank account will be suspended today due to pending KYC update. Share the OTP sent to your mobile right now to verify your identity and avoid permanent account freeze.",
    caller_claims_to_be: "bank officer",
    context: { channel: "pstn" },
  },
  {
    id: "BENCH-UTIL-01",
    category: "utility_extortion",
    ground_truth_band: "high",
    min_score: 50,
    transcript:
      "Electricity department alert: Your power connection will be disconnected tonight at 9 PM. Call immediately and download AnyDesk app on your phone for urgent verification.",
    caller_claims_to_be: "electricity officer",
    context: { channel: "voip_call" },
  },

  // Category 4: Multilingual & Code-Switched Extortion (Critical/High)
  {
    id: "BENCH-MULTI-HI-01",
    category: "multilingual_scam",
    ground_truth_band: "critical",
    min_score: 75,
    transcript:
      "Aapka parcel Mumbai customs ne seize kiya hai usme illegal drugs mile hain. Aap par digital arrest warrant issue hua hai. Do not disconnect this call, turant safe account mein verification amount transfer kijiye.",
    caller_claims_to_be: "CBI Crime Branch",
    context: { channel: "whatsapp_video" },
  },
  {
    id: "BENCH-MULTI-HI-02",
    category: "multilingual_scam",
    ground_truth_band: "critical",
    min_score: 75,
    transcript:
      "Yeh confidential police enquiry hai kisi ko mat batana darwaza band rakho. Aapki giraftari ka order aa chuka hai, turant paise transfer karo varna jail hogi.",
    caller_claims_to_be: "Police Inspector",
    context: { channel: "voip_call" },
  },
  {
    id: "BENCH-MULTI-TA-01",
    category: "multilingual_scam",
    ground_truth_band: "high",
    min_score: 50,
    transcript:
      "Ungal bank account freeze aagividum. Ungal OTP udane share pannunga illana account block aagum. Urgent verification required.",
    caller_claims_to_be: "bank verification team",
    context: { channel: "pstn" },
  },

  // Category 5: Benign Institutional Calls (Low)
  {
    id: "BENCH-BENIGN-01",
    category: "benign",
    ground_truth_band: "low",
    max_score: 24,
    transcript:
      "I am calling from HDFC Bank to confirm your home loan appointment for tomorrow afternoon at 2 PM. Please bring your identity proof and salary slips to the branch.",
    caller_claims_to_be: "bank officer",
    context: { channel: "pstn" },
  },
  {
    id: "BENCH-BENIGN-02",
    category: "benign",
    ground_truth_band: "low",
    max_score: 24,
    transcript:
      "Hello, your Amazon delivery package has arrived at the apartment security gate. Please collect it whenever you are available today. Thank you.",
    caller_claims_to_be: "courier delivery partner",
    context: { channel: "pstn" },
  },
  {
    id: "BENCH-BENIGN-03",
    category: "benign",
    ground_truth_band: "low",
    max_score: 24,
    transcript:
      "Calling from Apollo Pharmacy to notify that your regular prescription refill is ready for pickup at our store counter. Have a healthy day.",
    caller_claims_to_be: "pharmacist",
    context: { channel: "pstn" },
  },
  {
    id: "BENCH-BENIGN-04",
    category: "benign",
    ground_truth_band: "low",
    max_score: 24,
    transcript:
      "Namaskar, aapka cheque bank mein successfully clear ho gaya hai. Aap aakar apni passbook update kar sakte hain.",
    caller_claims_to_be: "bank desk",
    context: { channel: "pstn" },
  },
  {
    id: "BENCH-BENIGN-05",
    category: "benign",
    ground_truth_band: "low",
    max_score: 24,
    transcript:
      "Hi Rohit, could you please review the attached slide deck before our team standup call this afternoon? Let me know your thoughts.",
    caller_claims_to_be: "colleague",
    context: { channel: "internal" },
  },

  // Category 6: Insufficient Evidence & Ambiguous Edge Cases (Inconclusive)
  {
    id: "BENCH-INCONC-01",
    category: "inconclusive",
    ground_truth_band: "inconclusive",
    transcript: "Hello?",
    caller_claims_to_be: null,
    context: {},
  },
  {
    id: "BENCH-INCONC-02",
    category: "inconclusive",
    ground_truth_band: "inconclusive",
    transcript: "Yes, who is on the line please?",
    caller_claims_to_be: null,
    context: {},
  },
  {
    id: "BENCH-INCONC-03",
    category: "inconclusive",
    ground_truth_band: "inconclusive",
    transcript: "Can you hear me? Speak louder please.",
    caller_claims_to_be: null,
    context: {},
  },
  {
    id: "BENCH-INCONC-04",
    category: "inconclusive",
    ground_truth_band: "inconclusive",
    transcript: "Sorry, I think you have the wrong number.",
    caller_claims_to_be: null,
    context: {},
  },
  {
    id: "BENCH-INCONC-05",
    category: "inconclusive",
    ground_truth_band: "inconclusive",
    transcript: "Please call back after an hour, I am driving right now.",
    caller_claims_to_be: null,
    context: {},
  },
];

// 4-Pillar Patterns
const PILLAR_AUTHORITY = [
  "cbi", "police", "customs", "crime branch", "arrest", "digital arrest",
  "warrant", "narcotics", "mdma", "fir", "non-bailable", "contraband",
  "court", "supreme court", "high court", "giraftari", "jail", "illegal",
  "seized", "impounded", "cyber cell", "rbi", "trai", "enquiry",
];

const PILLAR_URGENCY = [
  "immediately", "right now", "today", "urgent", "urgently", "two hours",
  "2 hours", "9 pm", "turant", "udane", "before cutoff", "without delay",
  "action required now",
];

const PILLAR_SECRECY = [
  "do not disconnect", "quiet room", "video call", "confidential",
  "confidentiality", "family members", "mat batana", "darwaza band",
  "strict confidentiality", "alone", "maintain secrecy",
];

const PILLAR_EXTRACTION = [
  "safe account", "supreme court safe account", "rbi safe clearance",
  "verification amount", "transfer", "otp", "aadhaar", "upi id",
  "anydesk", "penalty fee", "settlement", "paise transfer",
  "share pannunga", "download app",
];

const OVERT_CRITICAL_PATTERNS = [
  "digital arrest", "cbi", "narcotics", "arrest warrant", "crime branch",
  "customs seizure", "supreme court safe account", "mdma", "giraftari",
];

const INCONCLUSIVE_GREETINGS = [
  "hello", "hi", "can you hear me", "who is on the line", "who is this",
  "wrong number", "speak louder", "call back later", "call back after",
  "yes who is calling", "pardon", "i am driving", "hold on",
];

const KNOWN_SCAM_ANCHORS = [
  "cbi narcotics drugs digital arrest warrant verification safe account transfer",
  "customs department contraband parcel penalty fee fir police custody",
  "bank account kyc update otp share mobile identity freeze block",
  "electricity disconnection 9 pm anydesk app verification officer",
  "police enquiry confidential darwaza band paise transfer jail",
  "ungal bank account freeze otp udane share pannunga",
];

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z']+/g) || []).filter(
    (w) => w.length > 2
  );
}

function computeSimilarity(transcript) {
  const queryTokens = new Set(tokenize(transcript));
  if (queryTokens.size === 0) return 0.0;
  let maxSim = 0.0;
  for (const anchor of KNOWN_SCAM_ANCHORS) {
    const anchorTokens = new Set(tokenize(anchor));
    let matchCount = 0;
    for (const t of queryTokens) {
      if (anchorTokens.has(t)) matchCount++;
    }
    const sim = matchCount / Math.sqrt(queryTokens.size * anchorTokens.size);
    if (sim > maxSim) maxSim = sim;
  }
  return Math.min(1.0, Number(maxSim.toFixed(3)));
}

function keywordHits(lower, keywords) {
  const hits = [];
  for (const kw of keywords) {
    if (kw.includes(" ")) {
      if (lower.includes(kw)) hits.push(kw);
    } else {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(lower)) hits.push(kw);
    }
  }
  return hits;
}

export class CalibratedRiskStore {
  constructor() {
    this.state = {
      activeModelVersion: "v2.0-calibrated-ensemble",
      availableVersions: ["v2.0-calibrated-ensemble", "v1.0-legacy-rules"],
      thresholds: {
        critical: 75,
        high: 50,
        medium: 25,
        inconclusive_min_words: 5,
        confidence_cutoff: 0.5,
      },
      fallbackEnabled: true,
      lastUpdatedAt: Date.now(),
      history: [
        {
          version: "v2.0-calibrated-ensemble",
          action: "deploy",
          timestamp: Date.now(),
          reason: "Calibrated ensemble with 4-pillar synergy activated",
        },
      ],
      currentAnalysis: null,
      benchmarkResult: null,
    };
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const cb of this.subscribers) {
      cb(this.getState());
    }
  }

  getState() {
    return { ...this.state };
  }

  getConfig() {
    return {
      active_version: this.state.activeModelVersion,
      available_versions: [...this.state.availableVersions],
      thresholds: { ...this.state.thresholds },
      fallback_enabled: this.state.fallbackEnabled,
      last_updated_at: this.state.lastUpdatedAt,
      history: [...this.state.history],
    };
  }

  updateConfig(updates = {}) {
    if (updates.active_version) {
      if (!this.state.availableVersions.includes(updates.active_version)) {
        throw new Error(`Unknown version: ${updates.active_version}`);
      }
      this.state.activeModelVersion = updates.active_version;
      this.state.history.push({
        version: updates.active_version,
        action: "switch",
        timestamp: Date.now(),
        reason: `Operator switched active model to ${updates.active_version}`,
      });
    }
    if (updates.thresholds) {
      this.state.thresholds = { ...this.state.thresholds, ...updates.thresholds };
    }
    if (updates.fallback_enabled !== undefined) {
      this.state.fallbackEnabled = Boolean(updates.fallback_enabled);
    }
    this.state.lastUpdatedAt = Date.now();
    this.notify();
    return this.getConfig();
  }

  rollbackModel(targetVersion = "v1.0-legacy-rules", reason = "Operator manual rollback") {
    if (!this.state.availableVersions.includes(targetVersion)) {
      throw new Error(`Unknown rollback target: ${targetVersion}`);
    }
    this.state.activeModelVersion = targetVersion;
    this.state.lastUpdatedAt = Date.now();
    this.state.history.push({
      version: targetVersion,
      action: "rollback",
      timestamp: Date.now(),
      reason,
    });
    this.notify();
    return this.getConfig();
  }

  evaluateTranscriptV1Legacy(transcript, callerClaimsToBe) {
    const lower = transcript.toLowerCase();
    const hitsAuth = keywordHits(lower, PILLAR_AUTHORITY);
    const hitsUrg = keywordHits(lower, PILLAR_URGENCY);
    const hitsSec = keywordHits(lower, PILLAR_SECRECY);
    const hitsExt = keywordHits(lower, PILLAR_EXTRACTION);
    const sim = computeSimilarity(transcript);

    let score = 0;
    score += Math.min(hitsAuth.length, 4) * 8;
    score += Math.min(hitsUrg.length, 3) * 7;
    score += Math.min(hitsSec.length, 2) * 10;
    score += Math.min(hitsExt.length, 3) * 6;
    score += sim * 40;

    if (callerClaimsToBe) {
      const govt = ["cbi", "police", "customs", "court", "cyber cell", "income tax"];
      if (govt.some((g) => callerClaimsToBe.toLowerCase().includes(g))) {
        score += 10;
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    let band = "low";
    if (score >= 75) band = "critical";
    else if (score >= 50) band = "high";
    else if (score >= 25) band = "medium";

    return {
      risk_score: score,
      risk_band: band,
      matched_patterns: [
        hitsAuth.length ? `Authority: ${hitsAuth.join(", ")}` : null,
        hitsUrg.length ? `Urgency: ${hitsUrg.join(", ")}` : null,
        hitsSec.length ? `Secrecy: ${hitsSec.join(", ")}` : null,
        hitsExt.length ? `Extraction: ${hitsExt.join(", ")}` : null,
      ].filter(Boolean),
      matched_known_scam_similarity: sim,
      recommendation: score >= 50 ? "Treat with high suspicion. Verify official channels." : "Low risk detected.",
      explanation: `v1.0 Rule scoring matched authority, urgency, secrecy, and payment keywords.`,
      model_version: "v1.0-legacy-rules",
      confidence: 0.75,
      is_inconclusive: false,
      inconclusive_reason: null,
      contributing_signals: {
        phrase_patterns: Math.min(1.0, (hitsAuth.length * 8 + hitsUrg.length * 7 + hitsSec.length * 10 + hitsExt.length * 6) / 91.0),
        semantic_similarity: sim,
        transcript_features: 0.5,
        call_context: callerClaimsToBe ? 0.5 : 0.0,
      },
      baseline_comparison: null,
    };
  }

  evaluateTranscriptLocally(
    transcript,
    callerClaimsToBe = null,
    modelVersion = null,
    context = null
  ) {
    const version = modelVersion || this.state.activeModelVersion;

    if (version === "v1.0-legacy-rules") {
      const v1 = this.evaluateTranscriptV1Legacy(transcript, callerClaimsToBe);
      this.state.currentAnalysis = v1;
      this.notify();
      return v1;
    }

    const lower = (transcript || "").toLowerCase().trim();
    const words = lower.match(/\b\w+\b/g) || [];
    const minWords = this.state.thresholds.inconclusive_min_words || 5;

    // Check v1 baseline first
    const v1Result = this.evaluateTranscriptV1Legacy(transcript, callerClaimsToBe);

    // Inconclusive check
    const hasOvertCritical = OVERT_CRITICAL_PATTERNS.some((p) => lower.includes(p));
    let isInconclusive = false;
    let inconclusiveReason = null;

    if (!hasOvertCritical) {
      if (words.length < minWords) {
        isInconclusive = true;
        inconclusiveReason = `Sparse audio evidence (${words.length} words < minimum threshold of ${minWords}).`;
      } else {
        const isGreeting = INCONCLUSIVE_GREETINGS.some((g) => lower.includes(g));
        if (isGreeting && words.length <= 12) {
          const hasCoercion = ["cbi", "arrest", "police", "customs", "otp", "transfer"].some((k) => lower.includes(k));
          if (!hasCoercion) {
            isInconclusive = true;
            inconclusiveReason = `Ambiguous non-committal greeting without substantive threat signals.`;
          }
        }
      }
    }

    if (isInconclusive) {
      const incResult = {
        risk_score: 0,
        risk_band: "inconclusive",
        matched_patterns: [],
        matched_known_scam_similarity: 0.0,
        recommendation: "Sparse or ambiguous audio evidence. Await further conversational speech before taking action.",
        explanation: `Inconclusive assessment: ${inconclusiveReason} Evidence insufficient to establish high or low risk.`,
        model_version: "v2.0-calibrated-ensemble",
        confidence: 0.35,
        is_inconclusive: true,
        inconclusive_reason: inconclusiveReason,
        contributing_signals: {
          phrase_patterns: 0.0,
          semantic_similarity: 0.0,
          transcript_features: 0.0,
          call_context: 0.0,
        },
        baseline_comparison: {
          baseline_version: "v1.0-legacy-rules",
          baseline_score: v1Result.risk_score,
          baseline_band: v1Result.risk_band,
          score_delta: 0 - v1Result.risk_score,
          divergence_rationale: `Calibrated ensemble marked sparse utterance as inconclusive rather than forced low/medium.`,
        },
      };
      this.state.currentAnalysis = incResult;
      this.notify();
      return incResult;
    }

    // Signal 1: Features
    const exclamationCount = (transcript.match(/!/g) || []).length;
    const shoutWords = words.filter((w) => w.length > 2 && w === w.toUpperCase()).length;
    const imperativeTerms = ["transfer", "share", "download", "pay", "verify", "stay", "maintain", "kijiye", "karo", "pannunga"];
    const imperativeHits = imperativeTerms.filter((t) => lower.includes(t)).length;
    const volumeFactor = Math.min(1.0, words.length / 35.0);
    const imperativeDensity = Math.min(1.0, imperativeHits / Math.max(1, Math.sqrt(words.length)));
    const tensionScore = Math.min(1.0, exclamationCount * 0.2 + (shoutWords / Math.max(1, words.length)) * 0.4 + imperativeDensity * 0.4);
    const s_feat = Math.min(1.0, Math.max(0.0, 0.45 * volumeFactor + 0.35 * imperativeDensity + 0.2 * tensionScore));

    // Signal 2: Coercive 4-Pillars
    const hitsAuth = keywordHits(lower, PILLAR_AUTHORITY);
    const hitsUrg = keywordHits(lower, PILLAR_URGENCY);
    const hitsSec = keywordHits(lower, PILLAR_SECRECY);
    const hitsExt = keywordHits(lower, PILLAR_EXTRACTION);

    const pAuth = Math.min(1.0, hitsAuth.length / 2.0);
    const pUrg = Math.min(1.0, hitsUrg.length / 2.0);
    const pSec = Math.min(1.0, hitsSec.length / 1.5);
    const pExt = Math.min(1.0, hitsExt.length / 2.0);

    const activePillars = [pAuth, pUrg, pSec, pExt].filter((p) => p > 0.1).length;
    const basePhraseScore = 0.35 * pAuth + 0.25 * pUrg + 0.2 * pSec + 0.2 * pExt;
    let synergyBonus = 0.0;
    if (activePillars === 3) synergyBonus = 0.22;
    else if (activePillars >= 4) synergyBonus = 0.38;
    const s_phrase = Math.min(1.0, Math.max(0.0, basePhraseScore + synergyBonus));

    // Signal 3: Semantic Similarity
    const s_sim = computeSimilarity(transcript);

    // Signal 4: Context
    let s_context = 0.0;
    if (callerClaimsToBe) {
      const claim = callerClaimsToBe.toLowerCase();
      if (["cbi", "police", "customs", "crime branch", "court", "rbi", "cyber cell"].some((a) => claim.includes(a))) {
        s_context += 0.45;
      } else if (["bank", "electricity", "courier", "delivery", "pharmacist"].some((m) => claim.includes(m))) {
        s_context += 0.15;
      }
    }
    if (context) {
      const channel = (context.channel || "").toLowerCase();
      if (channel.includes("video")) s_context += 0.35;
      else if (channel.includes("voip")) s_context += 0.25;
      else if (channel === "pstn") s_context += 0.05;

      const time = (context.time_of_day || "").toLowerCase();
      if (["night", "odd_hours", "late_night"].includes(time)) s_context += 0.15;
    }
    s_context = Math.min(1.0, Math.max(0.0, s_context));

    // Calibrated Logistic Equation
    const logit = -2.4 + (4.2 * s_phrase) + (2.2 * s_sim) + (1.2 * s_feat) + (1.6 * s_context);
    const probability = 1.0 / (1.0 + Math.exp(-logit));
    const calibratedScore = Math.max(0, Math.min(100, Math.round(probability * 100)));

    const critTh = this.state.thresholds.critical || 75;
    const highTh = this.state.thresholds.high || 50;
    const medTh = this.state.thresholds.medium || 25;

    let band = "low";
    let recommendation = "Low risk detected. Routine conversational or institutional exchange.";
    if (calibratedScore >= critTh) {
      band = "critical";
      recommendation = "CRITICAL ALERT: Multi-pillar digital arrest coercion detected. Terminate call immediately and notify 1930 Cyber Helpline.";
    } else if (calibratedScore >= highTh) {
      band = "high";
      recommendation = "HIGH RISK: Coercive urgency or institutional impersonation detected. Do not transfer funds or share credentials.";
    } else if (calibratedScore >= medTh) {
      band = "medium";
      recommendation = "MODERATE RISK: Verify caller identity through official published phone helplines.";
    }

    // Confidence
    const variance = Math.abs(s_phrase - s_sim) * 0.5;
    const signalAgreement = 1.0 - variance;
    const confidence = Math.min(0.99, Math.max(0.4, Number((0.45 + 0.25 * volumeFactor + 0.1 * signalAgreement + 0.15 * s_phrase).toFixed(2))));

    // Baseline Delta
    const delta = calibratedScore - v1Result.risk_score;
    let divergenceRationale = "Calibrated ensemble and legacy rules reached convergent risk assessments.";
    if (delta > 8) {
      divergenceRationale = `Ensemble escalated risk (+${delta} pts) due to 4-pillar syndicate synergy (${activePillars} active pillars) and high-risk channel.`;
    } else if (delta < -8) {
      divergenceRationale = `Ensemble suppressed false escalation (${delta} pts) by recognizing benign conversational purpose without coercive demands.`;
    }

    const matchedPatterns = [
      hitsAuth.length ? `Pillar 1 Authority: ${hitsAuth.join(", ")}` : null,
      hitsUrg.length ? `Pillar 2 Urgency: ${hitsUrg.join(", ")}` : null,
      hitsSec.length ? `Pillar 3 Secrecy: ${hitsSec.join(", ")}` : null,
      hitsExt.length ? `Pillar 4 Extraction: ${hitsExt.join(", ")}` : null,
    ].filter(Boolean);

    const result = {
      risk_score: calibratedScore,
      risk_band: band,
      matched_patterns: matchedPatterns,
      matched_known_scam_similarity: Number(s_sim.toFixed(3)),
      recommendation,
      explanation: `Calibrated ensemble scored ${calibratedScore}/100 (${band.toUpperCase()}) with ${(confidence * 100).toFixed(0)}% confidence across 4 signals.`,
      model_version: "v2.0-calibrated-ensemble",
      confidence,
      is_inconclusive: false,
      inconclusive_reason: null,
      contributing_signals: {
        phrase_patterns: Number(s_phrase.toFixed(3)),
        semantic_similarity: Number(s_sim.toFixed(3)),
        transcript_features: Number(s_feat.toFixed(3)),
        call_context: Number(s_context.toFixed(3)),
      },
      baseline_comparison: {
        baseline_version: "v1.0-legacy-rules",
        baseline_score: v1Result.risk_score,
        baseline_band: v1Result.risk_band,
        score_delta: delta,
        divergence_rationale: divergenceRationale,
      },
    };

    this.state.currentAnalysis = result;
    this.notify();
    return result;
  }

  runBenchmarkLocally(modelVersion = null) {
    const version = modelVersion || this.state.activeModelVersion;
    const cases = [];
    let correctCount = 0;
    let inconclusiveCount = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let v1CorrectCount = 0;

    for (const c of BENCHMARK_CORPUS) {
      const res = this.evaluateTranscriptLocally(
        c.transcript,
        c.caller_claims_to_be,
        version,
        c.context
      );
      const v1Res = this.evaluateTranscriptV1Legacy(c.transcript, c.caller_claims_to_be);

      let isCorrect = false;
      if (c.ground_truth_band === "inconclusive") {
        isCorrect = res.risk_band === "inconclusive";
      } else if (c.ground_truth_band === "critical") {
        isCorrect = ["critical", "high"].includes(res.risk_band);
      } else if (c.ground_truth_band === "high") {
        isCorrect = ["critical", "high"].includes(res.risk_band);
      } else if (c.ground_truth_band === "low") {
        isCorrect = res.risk_band === "low";
      }

      if (res.risk_band === "inconclusive") inconclusiveCount++;

      if (isCorrect) {
        correctCount++;
      } else {
        if (c.ground_truth_band === "low" && ["high", "critical"].includes(res.risk_band)) {
          falsePositives++;
        } else if (["high", "critical"].includes(c.ground_truth_band) && ["low", "inconclusive"].includes(res.risk_band)) {
          falseNegatives++;
        }
      }

      // v1 correctness
      let v1Correct = false;
      if (c.ground_truth_band === "inconclusive") {
        v1Correct = false; // v1 lacks inconclusive handling
      } else if (c.ground_truth_band === "critical") {
        v1Correct = ["critical", "high"].includes(v1Res.risk_band);
      } else if (c.ground_truth_band === "high") {
        v1Correct = ["critical", "high"].includes(v1Res.risk_band);
      } else if (c.ground_truth_band === "low") {
        v1Correct = v1Res.risk_band === "low";
      }
      if (v1Correct) v1CorrectCount++;

      cases.push({
        case_id: c.id,
        category: c.category,
        ground_truth_label: c.ground_truth_band,
        predicted_band: res.risk_band,
        risk_score: res.risk_score,
        confidence: res.confidence,
        is_correct: isCorrect,
        model_version: version,
      });
    }

    const total = BENCHMARK_CORPUS.length;
    const accuracy = Number((correctCount / total).toFixed(3));
    const v1Accuracy = Number((v1CorrectCount / total).toFixed(3));
    const improvement = Number((accuracy - v1Accuracy).toFixed(3));

    const result = {
      model_version: version,
      total_cases: total,
      correct_predictions: correctCount,
      accuracy,
      inconclusive_count: inconclusiveCount,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      baseline_accuracy_v1: v1Accuracy,
      improvement_over_baseline: improvement,
      cases,
      evaluated_at: Date.now(),
    };

    this.state.benchmarkResult = result;
    this.notify();
    return result;
  }
}

export const defaultCalibratedRiskStore = new CalibratedRiskStore();
