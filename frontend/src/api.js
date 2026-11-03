import emailjs from '@emailjs/browser';

import {
  analyzeScamTranscript as analyzeLocally,
  scanCurrencyImageLocally,
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

export async function scanCurrencyImage(file) {
  return scanCurrencyImageLocally(file);
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

  // Every report becomes a live incident on the officer dashboard.
  // A failure here must not lose the citizen's acknowledgement.
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
