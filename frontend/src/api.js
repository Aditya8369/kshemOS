import emailjs from '@emailjs/browser';

import {
  analyzeScamTranscript as analyzeLocally,
  askCitizenAssistantLocally,
  submitCitizenReportLocally,
  getCaseSummaryLocally,
  getRuleLibrarySamplesLocally,
} from './ruleEngine.js';

import { recordIncident } from './incidentStore.js';

import { scanQRCode } from './cyberFeatures/qrGuardian.js';
import { inspectURL } from './cyberFeatures/linkShield.js';
import { analyzeSMS } from './cyberFeatures/smsAnalyzer.js';
import { analyzeEmail } from './cyberFeatures/phishDetect.js';
import {
  analyzeTransaction,
  analyzeUPIHistory,
} from './cyberFeatures/upiFraudShield.js';

import { analyzeJobOffer } from './cyberFeatures/jobScamRadar.js';
import { analyzeInvestment } from './cyberFeatures/investScan.js';
import { analyzeLoanOffer } from './cyberFeatures/loanTrapAlert.js';
import { analyzeCourier } from './cyberFeatures/courierGuard.js';
import { analyzeIdentity } from './cyberFeatures/idShield.js';
import { analyzePasswordStrength } from './cyberFeatures/passStrengthPro.js';
import { analyzeSocialEngineering } from './cyberFeatures/socialEngShield.js';
import { analyzeOTPRequest } from './cyberFeatures/otpGuard.js';
import { analyzeWebSafety } from './cyberFeatures/webSafeAnalyzer.js';
import { buildCyberCase } from './cyberFeatures/caseBuilder.js';

// Phase 2 - Cyber Features
import { analyzeBrowserPermissions } from './cyberFeatures/browserPermissionAbuse.js';
import { analyzeClipboardRisk } from './cyberFeatures/clipboardHijack.js';
import { analyzeScreenSharing } from './cyberFeatures/screenSharingSafety.js';
import { analyzeWebcamMic } from './cyberFeatures/webcamMicAuditor.js';
import { analyzeExtensionTrust } from './cyberFeatures/extensionTrustAnalyzer.js';
import { analyzeFakeDocument } from './cyberFeatures/fakeDocumentVerifier.js';
import { analyzeInvoiceFraud } from './cyberFeatures/invoiceFraudDetector.js';
import { analyzeIdentityExposure } from './cyberFeatures/digitalIdentityExposure.js';
import { analyzeScamPsychology } from './cyberFeatures/scamPsychologyAnalyzer.js';
import { analyzeEmotionalManipulation } from './cyberFeatures/emotionalManipulationDetector.js';
import { analyzeFinancialUrgency } from './cyberFeatures/financialUrgencyDetector.js';
import { analyzeConversationPressure } from './cyberFeatures/conversationPressureMeter.js';
import { analyzeAuthorityImpersonation } from './cyberFeatures/authorityImpersonationDetector.js';
import { analyzeRewardTemptation } from './cyberFeatures/rewardTemptationAnalyzer.js';
import { analyzeIncidentImpact } from './cyberFeatures/cyberIncidentImpact.js';
import { analyzeDeviceChecklist } from './cyberFeatures/deviceSecurityChecklist.js';
import { analyzePrivacyExposure } from './cyberFeatures/privacyExposureScanner.js';
import { analyzeSocialProfile } from './cyberFeatures/fakeSocialProfileInspector.js';
import { analyzeUsername } from './cyberFeatures/suspiciousUsernameAnalyzer.js';
import { analyzeGiveaway } from './cyberFeatures/fakeGiveawayDetector.js';
import { analyzeSubscriptionFraud } from './cyberFeatures/subscriptionFraudChecker.js';

// Phase 3 - Cyber Features
import { analyzeMarketplaceListing } from './cyberFeatures/marketplaceFraudEvaluator.js';
import { analyzeDeliveryScam } from './cyberFeatures/deliveryScamPredictor.js';
import { analyzeTravelBooking } from './cyberFeatures/travelBookingFraudDetector.js';
import { analyzeRentalListing } from './cyberFeatures/rentalScamChecker.js';
import { analyzeCharityClaim } from './cyberFeatures/charityFraudEvaluator.js';
import { analyzeCrowdfunding } from './cyberFeatures/crowdfundingLegitimacyChecker.js';
import { analyzeDigitalInheritance } from './cyberFeatures/digitalInheritanceSafety.js';
import { analyzeFamilySafety } from './cyberFeatures/familyCyberSafety.js';
import { analyzeSeniorRisk } from './cyberFeatures/seniorProtectionMode.js';
import { analyzeStudentScamRisk } from './cyberFeatures/studentScamAwareness.js';
import { analyzeChildrenOnlineRisk } from './cyberFeatures/childrenOnlineSafety.js';
import { analyzeGovernmentNotice } from './cyberFeatures/fakeGovernmentNoticeVerifier.js';
import { analyzeLegalNotice } from './cyberFeatures/legalNoticeAuthenticityChecker.js';
import { analyzeDocumentConsistency } from './cyberFeatures/digitalDocumentConsistency.js';
import { analyzePaymentReceipt } from './cyberFeatures/paymentReceiptAuthenticity.js';
import { analyzeScreenshotMetadata } from './cyberFeatures/screenshotMetadataInspector.js';
import { analyzeAccountTakeoverRisk } from './cyberFeatures/accountTakeoverEstimator.js';
import { analyzeMFAReadiness } from './cyberFeatures/mfaReadinessChecker.js';
import { analyzeCyberHygiene } from './cyberFeatures/personalCyberHygiene.js';
import { assessScamResilience } from './cyberFeatures/scamResilienceAssessment.js';
import { generatePreparednessReport } from './cyberFeatures/cyberPreparednessReport.js';
import { calculateDigitalTrustScore } from './cyberFeatures/digitalTrustScore.js';
import { analyzeOnlineReputation } from './cyberFeatures/onlineReputationSafety.js';
import { analyzePersuasionBreakdown } from './cyberFeatures/scamPersuasionBreakdown.js';

// Environment configuration
const BASE_URL = import.meta.env.VITE_API_URL || '';

const EMAILJS_SERVICE_ID =
  import.meta.env.VITE_EMAILJS_SERVICE_ID || '';

const EMAILJS_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';

const EMAILJS_PUBLIC_KEY =
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;

    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch (_) {
      // Ignore JSON parsing errors.
    }

    throw new Error(detail);
  }

  return res.json();
}

// ======================================================
// CITIZEN AND SCAM ANALYSIS APIs
// ======================================================

export async function analyzeScamTranscript({
  transcript,
  callerClaimsToBe,
  callerNumber,
}) {
  return analyzeLocally(transcript, callerClaimsToBe);
}

// Currency image scanning - backend API
export async function scanCurrencyImage(file) {
  if (!file) {
    throw new Error('Please select an image first.');
  }

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(
    `${BASE_URL.replace(/\/+$/, '')}/api/currency/scan`,
    {
      method: 'POST',
      body: formData,
    }
  );

  return handle(response);
}

export async function lookupFraudRing(accountId) {
  const normalizedAccountId = String(accountId ?? '').trim();

  if (!normalizedAccountId) {
    throw new Error('Account ID is required');
  }

  const response = await fetch(
    `${BASE_URL.replace(/\/+$/, '')}/api/graph/ring/${encodeURIComponent(normalizedAccountId)}`
  );

  return handle(response);
}

// ======================================================
// FRAUD GRAPH ANALYST REVIEW APIs
// ======================================================

async function graphReviewRequest(path, analystToken, options = {}) {
  const token = String(analystToken ?? '').trim();

  if (!token) {
    throw new Error('Analyst token is required');
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(
    `${BASE_URL.replace(/\/+$/, '')}/api/graph${path}`,
    {
      ...options,
      headers,
    }
  );

  return handle(response);
}

export async function submitFraudGraphReview(
  edgeId,
  { decision, reason },
  analystToken
) {
  const id = String(edgeId ?? '').trim();

  if (!id) {
    throw new Error('Edge ID is required');
  }

  return graphReviewRequest(
    `/edges/${encodeURIComponent(id)}/reviews`,
    analystToken,
    {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }
  );
}

export async function getFraudGraphReviewHistory(
  edgeId,
  analystToken
) {
  const id = String(edgeId ?? '').trim();

  if (!id) {
    throw new Error('Edge ID is required');
  }

  return graphReviewRequest(
    `/edges/${encodeURIComponent(id)}/reviews`,
    analystToken
  );
}

export async function reverseFraudGraphReview(
  edgeId,
  eventId,
  reason,
  analystToken
) {
  const id = String(edgeId ?? '').trim();
  const event = String(eventId ?? '').trim();

  if (!id || !event) {
    throw new Error('Edge ID and review event ID are required');
  }

  return graphReviewRequest(
    `/edges/${encodeURIComponent(id)}/reviews/${encodeURIComponent(event)}/reverse`,
    analystToken,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}

export async function verifyFraudGraphReviewIntegrity(
  edgeId,
  analystToken
) {
  const id = String(edgeId ?? '').trim();

  if (!id) {
    throw new Error('Edge ID is required');
  }

  return graphReviewRequest(
    `/edges/${encodeURIComponent(id)}/reviews/integrity`,
    analystToken
  );
}

export async function exportFraudGraphReviews(analystToken) {
  return graphReviewRequest('/reviews/export', analystToken);
}

export async function askCitizenAssistant({ question, language }) {
  return {
    answer: askCitizenAssistantLocally(question, language),
  };
}

// ======================================================
// CITIZEN REPORT APIs
// ======================================================

export async function submitCitizenReport(payload) {
  const report = submitCitizenReportLocally(payload);

  try {
    const { incident, source } = await recordIncident({
      ...payload,
      report_id: report.report_id,
    });

    return {
      ...report,
      incident_id: incident.id,
      incident_source: source,
    };
  } catch (error) {
    return {
      ...report,
      incident_error: error.message,
    };
  }
}

// ======================================================
// INCIDENT MANAGEMENT APIs
// ======================================================

export {
  fetchIncidentFeed,
  updateIncident,
  setRegionStaffing,
  INCIDENTS_CHANGED_EVENT,
} from './incidentStore.js';

// ======================================================
// OFFLINE SYNC QUEUE APIs
// ======================================================

export {
  getSyncQueue,
  getSyncHistory,
  getPendingCount,
  getConflictCount,
  getFailedCount,
  isOnline,
  isSimulatedOffline,
  setSimulatedOffline,
  processSyncQueue,
  enqueueUpdate,
  enqueueCreate,
  discardQueueItem,
  retryQueueItem,
  resolveConflict,
  clearSyncHistory,
  setSyncStorage,
  emitSyncChange,
  SYNC_QUEUE_KEY,
  SYNC_HISTORY_KEY,
  SIMULATED_OFFLINE_KEY,
  SYNC_STATUS_CHANGED_EVENT,
} from './syncQueue.js';

// ======================================================
// EMAIL CONFIRMATION API
// ======================================================

export async function sendReportConfirmationEmail({
  reportId,
  reporterName,
  recipientEmail,
  category,
  description,
  acknowledgement,
}) {
  if (
    !EMAILJS_SERVICE_ID ||
    !EMAILJS_TEMPLATE_ID ||
    !EMAILJS_PUBLIC_KEY
  ) {
    return {
      success: false,
      message:
        'EmailJS configuration is missing. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY.',
    };
  }

  try {
    const templateParams = {
      report_id: reportId,
      reporter_name: reporterName,
      recipient_email: recipientEmail,
      report_category: category,
      report_description: description,
      acknowledgement,
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    return {
      success: true,
      message: 'Confirmation email sent successfully.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error?.text ||
        error?.message ||
        'EmailJS failed to send confirmation.',
    };
  }
}

// ======================================================
// RULE LIBRARY AND CASE APIs
// ======================================================

export async function getRuleLibrarySamples(limit) {
  return getRuleLibrarySamplesLocally(limit);
}

export async function getCaseSummary(reportId, accountId) {
  return getCaseSummaryLocally(reportId, accountId);
}

// ======================================================
// CYBER SECURITY ANALYSIS APIs
// ======================================================

export async function inspectLink(url) {
  return inspectURL(url);
}

export async function analyzeQRPayload(payload) {
  return scanQRCode(payload);
}

export async function analyzeSMSPayload(
  sender,
  message,
  timestamp
) {
  return analyzeSMS(sender, message, timestamp);
}

export async function analyzeEmailPayload(
  from,
  subject,
  body,
  headers
) {
  return analyzeEmail(from, subject, body, headers);
}

export async function analyzeUPIPayment(
  upiId,
  amount,
  reason,
  timestamp,
  recentTransactions
) {
  return analyzeTransaction(
    upiId,
    amount,
    reason,
    timestamp,
    recentTransactions
  );
}

export async function analyzeUPIHistoryPayload(transactions) {
  return analyzeUPIHistory(transactions);
}

export async function analyzeJobOfferPayload(payload) {
  return analyzeJobOffer(payload);
}

export async function analyzeInvestmentPayload(payload) {
  return analyzeInvestment(payload);
}

export async function analyzeLoanOfferPayload(payload) {
  return analyzeLoanOffer(payload);
}

export async function analyzeCourierPayload(payload) {
  return analyzeCourier(payload);
}

export async function analyzeIdentityPayload(payload) {
  return analyzeIdentity(payload);
}

export async function analyzePasswordPayload(password) {
  return analyzePasswordStrength(password);
}

export async function analyzeSocialEngineeringPayload(payload) {
  return analyzeSocialEngineering(payload);
}

export async function analyzeOTPRequestPayload(payload) {
  return analyzeOTPRequest(payload);
}

export async function analyzeWebSafetyPayload(payload) {
  return analyzeWebSafety(payload);
}

export async function buildCyberCasePayload(payload) {
  return buildCyberCase(payload);
}

// ======================================================
// JURISDICTION AND ZONE CONFIGURATION APIs
// ======================================================

export {
  fetchJurisdictionData,
  validateBoundaryApi,
  saveServiceAreaApi,
  reviewProposalApi,
  restoreSnapshotApi,
  saveDispatchRuleApi,
  deleteDispatchRuleApi,
  defaultJurisdictionStore,
} from './jurisdictionStore.js';

// ======================================================
// CROSS-JURISDICTION MUTUAL AID & REBALANCING APIs
// ======================================================

export {
  fetchMutualAidDataApi,
  declareMutualAidApi,
  deescalateDeclarationApi,
  delegateGuestUnitApi,
  revokeGuestUnitApi,
  createJointTaskforceApi,
  getJointTaskforceWorkspaceApi,
  logGuestActionApi,
  getSunsetAuditLogApi,
  defaultMutualAidStore,
} from './mutualAidStore.js';

// ======================================================
// MULTILINGUAL SPEECH RECOGNITION & REGIONAL ASR APIs
// ======================================================

export {
  fetchAsrProviders,
  fetchAsrSamples,
  transcribeSpeechApi,
  correctTurnApi,
  analyzeMultilingualScamApi,
  detectCodeSwitching,
  localMultilingualASRManager,
  ASR_PROVIDERS,
  REGIONAL_LANGUAGES,
  MULTILINGUAL_SAMPLES,
  MULTILINGUAL_SCAM_LEXICON,
} from './multilingualSpeechStore.js';

// CONSENT-BASED LIVE SCAM-CALL TRANSCRIPTION & RISK ALERTS
// ======================================================

export {
  createLiveCallSession,
  ingestLiveCallChunk,
  pauseLiveCallSession,
  resumeLiveCallSession,
  stopLiveCallSession,
  purgeLiveCallSession,
  detectSuspiciousPhrases,
  calculateRiskAssessment,
  localLiveCallManager,
  SCAM_LEXICON,
  OFFICIAL_HELPLINES,
  SAMPLE_CALL_SIMULATIONS,
} from './liveCallSafetyStore.js';

// ======================================================
// PUBLIC ADVISORY & EMERGENCY BROADCAST APIs
// ======================================================

export {
  fetchAdvisoriesApi,
  createBroadcastApi,
  authorizeBroadcastApi,
  dispatchBroadcastApi,
  advanceTelemetryApi,
  estimateAudienceApi,
  fetchAdvisoryTemplatesApi,
  fetchActiveBannerApi,
  SERVICE_AREAS_DEMOGRAPHICS,
  EMERGENCY_TEMPLATES,
  BROADCAST_CHANGED_EVENT,
  BROADCAST_STORAGE_KEY,
  DEFAULT_SEED_BROADCASTS,
  AdvisoryBroadcastStore,
  defaultBroadcastStore,
} from './advisoryBroadcastStore.js';

// ======================================================
// AI TELEPHONY HONEYPOT & CALL-PATTERN TRIANGULATION APIs
// ======================================================

export {
  fetchHoneypotPersonasApi,
  fetchHoneypotSessionsApi,
  forwardCallApi,
  processCallTurnApi,
  freezeMuleAccountApi,
  defaultHoneypotStore,
  TelephonyHoneypotStore,
  HONEYPOT_STORAGE_KEY,
  HONEYPOT_CHANGED_EVENT,
  HONEYPOT_PERSONAS,
  KNOWN_SYNDICATES_DB,
  DEFAULT_SEED_SESSIONS,
} from './telephonyHoneypotStore.js';

// ======================================================
// PREDICTIVE SPATIAL INTELLIGENCE & THREAT HEATMAP APIs
// ======================================================

export {
  fetchThreatHeatmapDataApi,
  fetchCitizenMicroAdvisoryApi,
  addSpatialIncidentApi,
  SPATIAL_INCIDENTS_KEY,
  FINANCIAL_POIS_KEY,
  PATROL_RECS_KEY,
  SPATIAL_CHANGED_EVENT,
  SEVERITY_WEIGHTS,
  DEFAULT_FINANCIAL_POIS,
  DEFAULT_SPATIAL_INCIDENTS,
  CITIZEN_LOCATION_PRESETS,
  haversineDistance,
  calculateHeading,
  SpatialIntelligenceStore,
  defaultSpatialStore,
} from './spatialIntelligenceStore.js';

// ======================================================
// DIGITAL EVIDENCE VAULT & SECURE UPLOAD LINK APIs
// ======================================================

export {
  fetchEvidenceItems,
  fetchEvidenceItem,
  ingestEvidenceApi,
  fetchCustodialLedgerApi,
  logCustodialActionApi,
  toggleLegalHoldApi,
  verifyEvidenceIntegrityApi,
  generateForensicBundleApi,
  fetchRetentionPoliciesApi,
  fetchUploadLinksApi,
  createUploadLinkApi,
  getUploadLinkApi,
  revokeUploadLinkApi,
  validateUploadTokenApi,
  fulfillEvidenceUploadApi,
  createLocalEvidenceStore,
  defaultEvidenceStore,
  sha256Sync,
  generateRfc3161Token,
  computeLogHash,
  EVIDENCE_CHANGED_EVENT,
  EVIDENCE_STORE_KEY,
  CUSTODIAL_LEDGER_KEY,
  EVIDENCE_UPLOAD_LINKS_KEY,
  DEFAULT_SAMPLE_UPLOAD_LINKS,
} from './evidenceStore.js';

// ======================================================
// INCIDENT NOTIFICATION & OFFICER ESCALATION APIs
// ======================================================

export {
  IncidentNotificationStore,
  defaultIncidentNotificationStore,
  INITIAL_OFFICER_DIRECTORY,
  JURISDICTION_REGION_MAP,
} from './incidentNotificationStore.js';

export async function fetchIncidentNotificationsApi() {
  const state = defaultIncidentNotificationStore.getState();

  return {
    notifications: state.notifications,
    ...state.stats,
  };
}

export async function fetchNotificationDirectoryApi() {
  return defaultIncidentNotificationStore.getState().officers;
}

export async function updateOfficerPreferencesApi(officerId, preferences) {
  return defaultIncidentNotificationStore.updateOfficerPreferences(
    officerId,
    preferences
  );
}

export async function retryIncidentNotificationApi(notificationId) {
  try {
    const notification =
      defaultIncidentNotificationStore.retryNotification(notificationId);

    return {
      success: notification.delivery_status === 'delivered',
      notification,
      message: notification.delivery_status,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function dispatchIncidentNotificationApi(
  incident,
  eventType,
  previousAssignedTo = null,
  actorId = null,
  nowMs = Date.now()
) {
  const notifications =
    defaultIncidentNotificationStore.dispatchNotifications(
      incident,
      eventType,
      previousAssignedTo,
      actorId,
      nowMs
    );

  return {
    success: true,
    notifications,
    count: notifications.length,
  };
}

// ======================================================
// EVIDENCE-GROUNDED OFFICER COPILOT APIs
// ======================================================

export {
  OfficerCopilotStore,
  defaultOfficerCopilotStore,
  COPILOT_STORAGE_KEY,
  COPILOT_CHANGED_EVENT,
  APPROVED_OPERATING_PROCEDURES,
  fetchGroundedCopilotAnalysisApi,
  submitCopilotFeedbackApi,
  submitCopilotApprovalApi,
} from './officerCopilotStore.js';

// ======================================================
// VERIFIED OFFICIAL EMERGENCY & CYBERCRIME CONTACTS API
// ======================================================

export async function fetchOfficialContactsApi(category = '') {
  const params = new URLSearchParams();

  if (category) {
    params.set('category', category);
  }

  const query = params.toString();

  const response = await fetch(
    `${BASE_URL.replace(/\/+$/, '')}/api/official-contacts${query ? `?${query}` : ''}`
  );

  return handle(response);
}

// ======================================================
// DPDP ACT REDACTION & IDENTITY MASKING PIPELINE APIs
// ======================================================

export {
  maskAadhaar,
  maskPan,
  maskBankAccount,
  maskMobile,
  maskEmail,
  generatePersistentToken,
  sanitizeTextLocally,
  pseudonymizeThreatFeedLocally,
  listUnmaskRequestsLocally,
  submitUnmaskRequestLocally,
  reviewUnmaskRequestLocally,
  revealUnmaskedValueLocally,
  getDpdpAuditTrailLocally,
  DEMO_UNMASK_REQUESTS,
  sanitizePiiApi,
  pseudonymizeThreatFeedApi,
  submitUnmaskRequestApi,
  listUnmaskRequestsApi,
  reviewUnmaskRequestApi,
  revealUnmaskedValueApi,
  fetchDpdpAuditTrailApi,
} from './dpdpSanitizationStore.js';

// ======================================================
// SECTION 63 BSA / 65B IEA ELECTRONIC EVIDENCE AFFIDAVIT COMPILER APIs
// ======================================================

export {
  OFFICIAL_NTP_RECORD,
  HARDWARE_SIGNATURE_PROFILES,
  DEMO_CASE_PRESETS,
  compileSection63AffidavitLocally,
  compileSection63AffidavitApi,
  fetchNtpStatusApi,
  fetchHardwareProfilesApi,
  getAffidavitPreviewHtmlUrl,
} from './evidenceAffidavitStore.js';

// ======================================================
// SIM BOX & SPOOFED CLI DETECTION ENGINE APIs
// ======================================================

export {
  MANDATORY_WARNING_BANNER,
  TRAI_STD_CIRCLES,
  OFFICIAL_POLICE_DIRECTORIES,
  DEMO_CALL_PRESETS,
  normalizeCliNumber,
  verifyTelephonyRouteLocally,
  verifyCliRouteApi,
  fetchTelecomTriageFeedApi,
  updateTriageIncidentActionApi,
  fetchTelecomTriageSummaryApi,
  fetchTraiDirectoryApi,
} from './cliSpoofStore.js';

// ======================================================
// SYNDICATE GROUP PARSER & APK TRIAGE APIs
// ======================================================

export {
  parseChatLocally,
  analyzeApkLocally,
  parseSyndicateChatApi,
  analyzeApkApi,
  uploadApkApi,
  fetchSyndicateCorrelationsApi,
  fetchSyndicateStatsApi,
  fetchSyndicateChatsApi,
  fetchSyndicateApksApi,
  SAMPLE_CHAT_WHATSAPP,
  SAMPLE_CHAT_TELEGRAM,
  SAMPLE_APK_PAYLOAD,
  SYNDICATE_COUNTRY_CODES,
  DANGEROUS_PERMISSIONS_MAP,
} from './syndicateTriageStore.js';

// ======================================================
// AUTOMATED UPI MULE ACCOUNT FREEZE DISPATCH (CFCFRMS / 1930)
// ======================================================

export {
  MuleFreezeStore,
  defaultMuleFreezeStore,
  MULE_FREEZE_STORAGE_KEY,
  MULE_FREEZE_CHANGED_EVENT,
  DEFAULT_SAMPLE_FREEZE_REQUESTS,
  validateVpa,
  validateUtr,
  validateIfsc,
  parseFinancialEntities,
  evaluateMuleRisk,
  generateSection102NoticeText,
  generateCfcfrmsPayload,
} from './muleFreezeStore.js';

import {
  defaultMuleFreezeStore,
  parseFinancialEntities as parseFinancialEntitiesLocal,
  evaluateMuleRisk as evaluateMuleRiskLocal,
} from './muleFreezeStore.js';

export async function parseFinancialEntitiesApi(text) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local
  }
  return parseFinancialEntitiesLocal(text);
}

export async function evaluateMuleFreezeApi(data) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local
  }
  return evaluateMuleRiskLocal(data);
}

export async function dispatchMuleFreezeApi(data) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return defaultMuleFreezeStore.dispatchFreeze(data);
}

export async function fetchMuleFreezeRequestsApi(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/requests${query ? `?${query}` : ''}`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return defaultMuleFreezeStore.getRequests(params);
}

export async function fetchMuleFreezeRequestApi(freezeId) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/requests/${freezeId}`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return defaultMuleFreezeStore.getRequest(freezeId);
}

export async function acknowledgeMuleFreezeApi(freezeId, bankNodalRef, freezeOutcome = 'FROZEN', notes = '') {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/requests/${freezeId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_nodal_ref: bankNodalRef, freeze_outcome: freezeOutcome, notes }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return defaultMuleFreezeStore.recordBankAcknowledgment(freezeId, bankNodalRef, freezeOutcome, notes);
}

export async function revokeMuleFreezeApi(freezeId, revokingOfficerBadgeId, revocationReason) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/requests/${freezeId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revoking_officer_badge_id: revokingOfficerBadgeId,
        revocation_reason: revocationReason,
      }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return defaultMuleFreezeStore.revokeFreeze(freezeId, revokingOfficerBadgeId, revocationReason);
}

export async function fetchMuleFreezeStatsApi() {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/mule-freeze/stats`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return defaultMuleFreezeStore.getStats();
}

// ============================================================
// EMERGENCY FINANCIAL KILL-SWITCH & AADHAAR LOCK APIS
// ============================================================

export async function fetchEmergencyBanksApi() {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/emergency-killswitch/banks`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return null;
}

export async function fetchEmergencyBankByIdApi(bankId) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/emergency-killswitch/banks/${bankId}`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return null;
}

export async function fetchAadhaarLockGuideApi() {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/emergency-killswitch/aadhaar-guide`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local store
  }
  return null;
}

export async function generateEmergencyMitigationReceiptApi(payload) {
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/emergency-killswitch/generate-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback handled by store
  }
  return null;
}

// -----------------------------------------------------------------------------
// Voice Deepfake & Synthetic Audio Impersonation Detector
// -----------------------------------------------------------------------------

export {
  analyzeVoiceRecordingApi,
  listVoiceDeepfakeInspectionsApi,
  getVoiceDeepfakeInspectionApi,
  fetchVoiceDeepfakeStatsApi,
} from './voiceDeepfakeStore.js';