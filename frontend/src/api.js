import emailjs from '@emailjs/browser';

import {
  analyzeScamTranscript as analyzeLocally,
  scanCurrencyImageLocally,
  askCitizenAssistantLocally,
  submitCitizenReportLocally,
  lookupFraudRingLocally,
  getCaseSummaryLocally,
  getRuleLibrarySamplesLocally,
} from './ruleEngine.js';

import { recordIncident } from './incidentStore.js';

// Offline synchronization
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
  discardQueueItem,
  retryQueueItem,
  resolveConflict,
  clearSyncHistory,
  setSyncStorage,
  SYNC_QUEUE_KEY,
  SYNC_HISTORY_KEY,
  SYNC_STATUS_CHANGED_EVENT,
} from './syncQueue.js';

// Cybersecurity feature imports
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

// Phase 2
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

// Phase 3
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
const EMAILJS_SERVICE_ID =
  import.meta.env.VITE_EMAILJS_SERVICE_ID || '';

const EMAILJS_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';

const EMAILJS_PUBLIC_KEY =
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';


// ======================================================
// CITIZEN SERVICES
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
  return lookupFraudRingLocally(accountId);
}

export async function askCitizenAssistant({ question, language }) {
  return {
    answer: askCitizenAssistantLocally(question, language),
  };
}

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
// INCIDENT DASHBOARD
// ======================================================

export {
  fetchIncidentFeed,
  updateIncident,
  setRegionStaffing,
  INCIDENTS_CHANGED_EVENT,
} from './incidentStore.js';


// ======================================================
// GEOFENCE ENGINE
// ======================================================

export {
  getBoundaries,
  saveBoundary,
  deleteBoundary,
  getRules as getGeofenceRules,
  saveRule as saveGeofenceRule,
  deleteRule as deleteGeofenceRule,
  getAlerts as getGeofenceAlerts,
  acknowledgeAlert as acknowledgeGeofenceAlert,
  clearAlerts as clearGeofenceAlerts,
  getUnits as getGeofenceUnits,
  evaluateLocationPing,
  GEOFENCE_CHANGED_EVENT,
} from './geofenceEngine.js';


// ======================================================
// EMAIL CONFIRMATION
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
// RULE LIBRARY AND CASE SUMMARY
// ======================================================

export async function getRuleLibrarySamples(limit) {
  return getRuleLibrarySamplesLocally(limit);
}

export async function getCaseSummary(reportId, accountId) {
  return getCaseSummaryLocally(reportId, accountId);
}


// ======================================================
// PHASE 1 - CYBERSECURITY ANALYZERS
// ======================================================

export async function inspectLink(url) {
  return inspectURL(url);
}

export async function analyzeQRPayload(payload) {
  return scanQRCode(payload);
}

export async function analyzeSMSPayload(sender, message, timestamp) {
  return analyzeSMS(sender, message, timestamp);
}

export async function analyzeEmailPayload(from, subject, body, headers) {
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
// PHASE 2 - ADVANCED CYBERSECURITY ANALYZERS
// ======================================================

export async function analyzeBrowserPermissionsPayload(payload) {
  return analyzeBrowserPermissions(payload);
}

export async function analyzeClipboardRiskPayload(payload) {
  return analyzeClipboardRisk(payload);
}

export async function analyzeScreenSharingPayload(payload) {
  return analyzeScreenSharing(payload);
}

export async function analyzeWebcamMicPayload(payload) {
  return analyzeWebcamMic(payload);
}

export async function analyzeExtensionTrustPayload(payload) {
  return analyzeExtensionTrust(payload);
}

export async function analyzeFakeDocumentPayload(payload) {
  return analyzeFakeDocument(payload);
}

export async function analyzeInvoiceFraudPayload(payload) {
  return analyzeInvoiceFraud(payload);
}

export async function analyzeIdentityExposurePayload(payload) {
  return analyzeIdentityExposure(payload);
}

export async function analyzeScamPsychologyPayload(payload) {
  return analyzeScamPsychology(payload);
}

export async function analyzeEmotionalManipulationPayload(payload) {
  return analyzeEmotionalManipulation(payload);
}

export async function analyzeFinancialUrgencyPayload(payload) {
  return analyzeFinancialUrgency(payload);
}

export async function analyzeConversationPressurePayload(payload) {
  return analyzeConversationPressure(payload);
}

export async function analyzeAuthorityImpersonationPayload(payload) {
  return analyzeAuthorityImpersonation(payload);
}

export async function analyzeRewardTemptationPayload(payload) {
  return analyzeRewardTemptation(payload);
}

export async function analyzeIncidentImpactPayload(payload) {
  return analyzeIncidentImpact(payload);
}

export async function analyzeDeviceChecklistPayload(payload) {
  return analyzeDeviceChecklist(payload);
}

export async function analyzePrivacyExposurePayload(payload) {
  return analyzePrivacyExposure(payload);
}

export async function analyzeSocialProfilePayload(payload) {
  return analyzeSocialProfile(payload);
}

export async function analyzeUsernamePayload(payload) {
  return analyzeUsername(payload);
}

export async function analyzeGiveawayPayload(payload) {
  return analyzeGiveaway(payload);
}

export async function analyzeSubscriptionFraudPayload(payload) {
  return analyzeSubscriptionFraud(payload);
}


// ======================================================
// PHASE 3 - ADDITIONAL CYBERSECURITY ANALYZERS
// ======================================================

export async function analyzeMarketplaceListingPayload(payload) {
  return analyzeMarketplaceListing(payload);
}

export async function analyzeDeliveryScamPayload(payload) {
  return analyzeDeliveryScam(payload);
}

export async function analyzeTravelBookingPayload(payload) {
  return analyzeTravelBooking(payload);
}

export async function analyzeRentalListingPayload(payload) {
  return analyzeRentalListing(payload);
}

export async function analyzeCharityClaimPayload(payload) {
  return analyzeCharityClaim(payload);
}

export async function analyzeCrowdfundingPayload(payload) {
  return analyzeCrowdfunding(payload);
}

export async function analyzeDigitalInheritancePayload(payload) {
  return analyzeDigitalInheritance(payload);
}

export async function analyzeFamilySafetyPayload(payload) {
  return analyzeFamilySafety(payload);
}

export async function analyzeSeniorRiskPayload(payload) {
  return analyzeSeniorRisk(payload);
}

export async function analyzeStudentScamRiskPayload(payload) {
  return analyzeStudentScamRisk(payload);
}

export async function analyzeChildrenOnlineRiskPayload(payload) {
  return analyzeChildrenOnlineRisk(payload);
}

export async function analyzeGovernmentNoticePayload(payload) {
  return analyzeGovernmentNotice(payload);
}

export async function analyzeLegalNoticePayload(payload) {
  return analyzeLegalNotice(payload);
}

export async function analyzeDocumentConsistencyPayload(payload) {
  return analyzeDocumentConsistency(payload);
}

export async function analyzePaymentReceiptPayload(payload) {
  return analyzePaymentReceipt(payload);
}

export async function analyzeScreenshotMetadataPayload(payload) {
  return analyzeScreenshotMetadata(payload);
}

export async function analyzeAccountTakeoverRiskPayload(payload) {
  return analyzeAccountTakeoverRisk(payload);
}

export async function analyzeMFAReadinessPayload(payload) {
  return analyzeMFAReadiness(payload);
}

export async function analyzeCyberHygienePayload(payload) {
  return analyzeCyberHygiene(payload);
}

export async function assessScamResiliencePayload(payload) {
  return assessScamResilience(payload);
}

export async function generatePreparednessReportPayload(payload) {
  return generatePreparednessReport(payload);
}

export async function calculateDigitalTrustScorePayload(payload) {
  return calculateDigitalTrustScore(payload);
}

export async function analyzeOnlineReputationPayload(payload) {
  return analyzeOnlineReputation(payload);
}

export async function analyzePersuasionBreakdownPayload(payload) {
  return analyzePersuasionBreakdown(payload);
}
