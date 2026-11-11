import { useState } from 'react';
import Shell from './components/Shell';
import CitizenPortal from './components/CitizenPortal';
import OfficerCommandCenter from './components/OfficerCommandCenter';
import AwarenessPage from './components/AwarenessPage';
import MotivationPage from './components/MotivationPage';
import AboutPage from './components/AboutPage';
import HomePage from './components/HomePage';
import ContactPage from './components/ContactPage';
import HowItWorksPage from './components/HowItWorksPage';
import ScamExamplesPage from './components/ScamExamplesPage';
import SafetyTipsPage from './components/SafetyTipsPage';
import ThreatLibraryPage from './components/ThreatLibraryPage';
import ScamIntelligencePage from './components/ScamIntelligencePage';
import QRGuardianView from './components/QRGuardianView';
import LinkShieldView from './components/LinkShieldView';
import SMSAnalyzerView from './components/SMSAnalyzerView';
import PhishDetectView from './components/PhishDetectView';
import UPIFraudShieldView from './components/UPIFraudShieldView';
import JobScamRadarView from './components/JobScamRadarView';
import InvestScanView from './components/InvestScanView';
import LoanTrapAlertView from './components/LoanTrapAlertView';
import CourierGuardView from './components/CourierGuardView';
import IDShieldView from './components/IDShieldView';
import PassStrengthProView from './components/PassStrengthProView';
import SocialEngShieldView from './components/SocialEngShieldView';
import OTPGuardView from './components/OTPGuardView';
import WebSafeAnalyzerView from './components/WebSafeAnalyzerView';
import CyberCaseBuilderView from './components/CyberCaseBuilderView';
import CyberToolboxPage from './components/CyberToolboxPage';
// Phase 1: 21 New View Components for existing JS features
import BrowserPermissionAbuseView from './components/BrowserPermissionAbuseView';
import ClipboardHijackView from './components/ClipboardHijackView';
import ScreenSharingSafetyView from './components/ScreenSharingSafetyView';
import WebcamMicAuditorView from './components/WebcamMicAuditorView';
import ExtensionTrustAnalyzerView from './components/ExtensionTrustAnalyzerView';
import FakeDocumentVerifierView from './components/FakeDocumentVerifierView';
import InvoiceFraudDetectorView from './components/InvoiceFraudDetectorView';
import DigitalIdentityExposureView from './components/DigitalIdentityExposureView';
import ScamPsychologyAnalyzerView from './components/ScamPsychologyAnalyzerView';
import EmotionalManipulationDetectorView from './components/EmotionalManipulationDetectorView';
import FinancialUrgencyDetectorView from './components/FinancialUrgencyDetectorView';
import ConversationPressureMeterView from './components/ConversationPressureMeterView';
import AuthorityImpersonationDetectorView from './components/AuthorityImpersonationDetectorView';
import RewardTemptationAnalyzerView from './components/RewardTemptationAnalyzerView';
import CyberIncidentImpactView from './components/CyberIncidentImpactView';
import DeviceSecurityChecklistView from './components/DeviceSecurityChecklistView';
import PrivacyExposureScannerView from './components/PrivacyExposureScannerView';
import FakeSocialProfileInspectorView from './components/FakeSocialProfileInspectorView';
import SuspiciousUsernameAnalyzerView from './components/SuspiciousUsernameAnalyzerView';
import FakeGiveawayDetectorView from './components/FakeGiveawayDetectorView';
import SubscriptionFraudCheckerView from './components/SubscriptionFraudCheckerView';
// Phase 2B: 24 New View Components for 24 new features
import ScamPersuasionBreakdownView from './components/ScamPersuasionBreakdownView';
import MarketplaceFraudEvaluatorView from './components/MarketplaceFraudEvaluatorView';
import DeliveryScamPredictorView from './components/DeliveryScamPredictorView';
import TravelBookingFraudDetectorView from './components/TravelBookingFraudDetectorView';
import RentalScamCheckerView from './components/RentalScamCheckerView';
import CharityFraudEvaluatorView from './components/CharityFraudEvaluatorView';
import CrowdfundingLegitimacyCheckerView from './components/CrowdfundingLegitimacyCheckerView';
import DigitalInheritanceSafetyView from './components/DigitalInheritanceSafetyView';
import FamilyCyberSafetyView from './components/FamilyCyberSafetyView';
import SeniorProtectionModeView from './components/SeniorProtectionModeView';
import StudentScamAwarenessView from './components/StudentScamAwarenessView';
import ChildrenOnlineSafetyView from './components/ChildrenOnlineSafetyView';
import FakeGovernmentNoticeVerifierView from './components/FakeGovernmentNoticeVerifierView';
import LegalNoticeAuthenticityCheckerView from './components/LegalNoticeAuthenticityCheckerView';
import DigitalDocumentConsistencyView from './components/DigitalDocumentConsistencyView';
import PaymentReceiptAuthenticityView from './components/PaymentReceiptAuthenticityView';
import ScreenshotMetadataInspectorView from './components/ScreenshotMetadataInspectorView';
import AccountTakeoverEstimatorView from './components/AccountTakeoverEstimatorView';
import MfaReadinessCheckerView from './components/MfaReadinessCheckerView';
import PersonalCyberHygieneView from './components/PersonalCyberHygieneView';
import ScamResilienceAssessmentView from './components/ScamResilienceAssessmentView';
import CyberPreparednessReportView from './components/CyberPreparednessReportView';
import EvidenceVaultView from './components/EvidenceVaultView';
import CitizenEvidenceUploadPortal from './components/evidence/CitizenEvidenceUploadPortal';
import AlertDispatchView from './components/AlertDispatchView';
import DigitalTrustScoreView from './components/DigitalTrustScoreView';
import OnlineReputationSafetyView from './components/OnlineReputationSafetyView';
import PublicAdvisoryComposer from './components/PublicAdvisoryComposer';
import TelephonyHoneypotView from './components/telephony/TelephonyHoneypotView';
import JurisdictionConfigView from './components/jurisdiction/JurisdictionConfigView';
import MultilingualSpeechSafetyView from './components/speech/MultilingualSpeechSafetyView';
import LiveCallSafetyView from './components/livecall/LiveCallSafetyView';
import IncidentNotificationConsole from './components/incidentDashboard/IncidentNotificationConsole';
import SyndicateTriageView from './components/SyndicateTriageView';
import MuleFreezeDispatchView from './components/MuleFreezeDispatchView';
import MeetPage from './components/MeetPage';
import DpdpRedactionView from './components/DpdpRedactionView';
import Section63AffidavitCompilerView from './components/evidence/Section63AffidavitCompilerView';
import CliSpoofDetectorView from './components/CliSpoofDetectorView';
import TakedownNoticeGeneratorView from './components/TakedownNoticeGeneratorView';

export default function App() {
  const [portal, setPortal] = useState('citizen');
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('token') || params.get('view') === 'evidence-upload') {
        return 'evidence-upload';
      }
    }
    return 'home';
  });

  function renderContent() {
    if (activeView === 'home') return <HomePage setActiveView={setActiveView} />;
    if (activeView === 'awareness') return <AwarenessPage setActiveView={setActiveView} />;
    if (activeView === 'motivation') return <MotivationPage setActiveView={setActiveView} />;
    if (activeView === 'about') return <AboutPage setActiveView={setActiveView} />;
    if (activeView === 'contact') return <ContactPage setActiveView={setActiveView} />;
    if (activeView === 'how-it-works') return <HowItWorksPage setActiveView={setActiveView} />;
    if (activeView === 'scam-examples') return <ScamExamplesPage setActiveView={setActiveView} />;
    if (activeView === 'rule-library') return <ThreatLibraryPage setActiveView={setActiveView} />;
    if (activeView === 'meet') return <MeetPage />;
    if (activeView === 'intelligence') return <ScamIntelligencePage setActiveView={setActiveView} />;
    if (activeView === 'safety-tips') return <SafetyTipsPage setActiveView={setActiveView} />;
    if (activeView === 'toolbox') return <CyberToolboxPage setActiveView={setActiveView} />;
    if (activeView === 'qr-guardian') return <QRGuardianView />;
    if (activeView === 'link-shield') return <LinkShieldView />;
    if (activeView === 'sms-analyzer') return <SMSAnalyzerView />;
    if (activeView === 'phish-detect') return <PhishDetectView />;
    if (activeView === 'upi-fraud-shield') return <UPIFraudShieldView />;
    if (activeView === 'job-scam-radar') return <JobScamRadarView />;
    if (activeView === 'invest-scan') return <InvestScanView />;
    if (activeView === 'loan-trap-alert') return <LoanTrapAlertView />;
    if (activeView === 'courier-guard') return <CourierGuardView />;
    if (activeView === 'id-shield') return <IDShieldView />;
    if (activeView === 'pass-strength-pro') return <PassStrengthProView />;
    if (activeView === 'social-eng-shield') return <SocialEngShieldView />;
    if (activeView === 'otp-guard') return <OTPGuardView />;
    if (activeView === 'web-safe-analyzer') return <WebSafeAnalyzerView />;
    if (activeView === 'cyber-case-builder') return <CyberCaseBuilderView />;
    // Phase 1 views (21 existing JS features)
    if (activeView === 'browser-permission-abuse') return <BrowserPermissionAbuseView />;
    if (activeView === 'clipboard-hijack') return <ClipboardHijackView />;
    if (activeView === 'screen-sharing-safety') return <ScreenSharingSafetyView />;
    if (activeView === 'webcam-mic-auditor') return <WebcamMicAuditorView />;
    if (activeView === 'extension-trust-analyzer') return <ExtensionTrustAnalyzerView />;
    if (activeView === 'fake-document-verifier') return <FakeDocumentVerifierView />;
    if (activeView === 'invoice-fraud-detector') return <InvoiceFraudDetectorView />;
    if (activeView === 'digital-identity-exposure') return <DigitalIdentityExposureView />;
    if (activeView === 'scam-psychology-analyzer') return <ScamPsychologyAnalyzerView />;
    if (activeView === 'emotional-manipulation-detector') return <EmotionalManipulationDetectorView />;
    if (activeView === 'financial-urgency-detector') return <FinancialUrgencyDetectorView />;
    if (activeView === 'conversation-pressure-meter') return <ConversationPressureMeterView />;
    if (activeView === 'authority-impersonation-detector') return <AuthorityImpersonationDetectorView />;
    if (activeView === 'reward-temptation-analyzer') return <RewardTemptationAnalyzerView />;
    if (activeView === 'cyber-incident-impact') return <CyberIncidentImpactView />;
    if (activeView === 'device-security-checklist') return <DeviceSecurityChecklistView />;
    if (activeView === 'privacy-exposure-scanner') return <PrivacyExposureScannerView />;
    if (activeView === 'fake-social-profile-inspector') return <FakeSocialProfileInspectorView />;
    if (activeView === 'suspicious-username-analyzer') return <SuspiciousUsernameAnalyzerView />;
    if (activeView === 'fake-giveaway-detector') return <FakeGiveawayDetectorView />;
    if (activeView === 'subscription-fraud-checker') return <SubscriptionFraudCheckerView />;
    // Phase 2B views (24 new features)
    if (activeView === 'scam-persuasion-breakdown') return <ScamPersuasionBreakdownView />;
    if (activeView === 'marketplace-fraud-evaluator') return <MarketplaceFraudEvaluatorView />;
    if (activeView === 'delivery-scam-predictor') return <DeliveryScamPredictorView />;
    if (activeView === 'travel-booking-fraud-detector') return <TravelBookingFraudDetectorView />;
    if (activeView === 'rental-scam-checker') return <RentalScamCheckerView />;
    if (activeView === 'charity-fraud-evaluator') return <CharityFraudEvaluatorView />;
    if (activeView === 'crowdfunding-legitimacy-checker') return <CrowdfundingLegitimacyCheckerView />;
    if (activeView === 'digital-inheritance-safety') return <DigitalInheritanceSafetyView />;
    if (activeView === 'family-cyber-safety') return <FamilyCyberSafetyView />;
    if (activeView === 'senior-protection-mode') return <SeniorProtectionModeView />;
    if (activeView === 'student-scam-awareness') return <StudentScamAwarenessView />;
    if (activeView === 'children-online-safety') return <ChildrenOnlineSafetyView />;
    if (activeView === 'fake-government-notice-verifier') return <FakeGovernmentNoticeVerifierView />;
    if (activeView === 'legal-notice-authenticity-checker') return <LegalNoticeAuthenticityCheckerView />;
    if (activeView === 'digital-document-consistency') return <DigitalDocumentConsistencyView />;
    if (activeView === 'payment-receipt-authenticity') return <PaymentReceiptAuthenticityView />;
    if (activeView === 'screenshot-metadata-inspector') return <ScreenshotMetadataInspectorView />;
    if (activeView === 'account-takeover-estimator') return <AccountTakeoverEstimatorView />;
    if (activeView === 'mfa-readiness-checker') return <MfaReadinessCheckerView />;
    if (activeView === 'personal-cyber-hygiene') return <PersonalCyberHygieneView />;
    if (activeView === 'scam-resilience-assessment') return <ScamResilienceAssessmentView />;
    if (activeView === 'cyber-preparedness-report') return <CyberPreparednessReportView />;
    if (activeView === 'digital-trust-score') return <DigitalTrustScoreView />;
    if (activeView === 'advisory') return <PublicAdvisoryComposer />;
    if (activeView === 'multilingual-speech') return <MultilingualSpeechSafetyView />;
    if (activeView === 'live-call-safety') return <LiveCallSafetyView />;
    if (activeView === 'incident-notifications') return <IncidentNotificationConsole />;
    if (activeView === 'evidence') return <EvidenceVaultView/>;
    if (activeView === 'mule-freeze') return <MuleFreezeDispatchView />;
    if (activeView === 'evidence-upload') return <CitizenEvidenceUploadPortal setActiveView={setActiveView} />;
    if (activeView === 'syndicate-triage') return <SyndicateTriageView />;
    if (activeView === 'alerts') return <AlertDispatchView />;
    if (activeView === 'online-reputation-safety') return <OnlineReputationSafetyView />;
    if (activeView === 'evidence-affidavit-compiler') return <Section63AffidavitCompilerView />;
    if (activeView === 'cli-spoof-detector') return <CliSpoofDetectorView />;
    if (activeView === 'takedown-generator') return <TakedownNoticeGeneratorView />;
    if (activeView === 'jurisdiction') return <JurisdictionConfigView />;
    if (activeView === 'dpdp-redaction') return <DpdpRedactionView />;
    if (activeView === 'voice-hotline') return <VoiceSafetyHotlineView />;
    if (activeView === 'officer') return <OfficerCommandCenter />;
    if (activeView === 'portal') {
      return portal === 'citizen' ? <CitizenPortal setActiveView={setActiveView} /> : <OfficerCommandCenter />;
    }
    return <HomePage setActiveView={setActiveView} />;
  }

  return (
    <Shell portal={portal} setPortal={setPortal} activeView={activeView} setActiveView={setActiveView}>
      {renderContent()}
    </Shell>
  );
}
