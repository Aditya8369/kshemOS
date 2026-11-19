import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTALS,
  SECTIONS,
  PORTAL_LABELS,
  SECTION_LABELS,
  getViewMeta,
  getNavigationContext,
  OFFICER_VIEWS,
  CITIZEN_VIEWS,
} from './navigationMeta.js';

test('getNavigationContext identifies current destination and portal for primary destinations', () => {
  // Home
  const homeCtx = getNavigationContext('home', 'citizen');
  assert.equal(homeCtx.destinationLabel, 'Home');
  assert.equal(homeCtx.parentSectionKey, SECTIONS.HOME);
  assert.equal(homeCtx.parentSectionLabel, 'Home');

  // Citizen Portal
  const citizenCtx = getNavigationContext('portal', 'citizen');
  assert.equal(citizenCtx.destinationLabel, 'Citizen Verification Portal');
  assert.equal(citizenCtx.effectivePortal, PORTALS.CITIZEN);
  assert.equal(citizenCtx.portalLabel, PORTAL_LABELS[PORTALS.CITIZEN]);
  assert.equal(citizenCtx.parentSectionKey, SECTIONS.CITIZEN_SAFETY);
  assert.equal(citizenCtx.isCitizenView, true);
  assert.equal(citizenCtx.isOfficerView, false);

  // Officer Command Center
  const officerCtx = getNavigationContext('officer', 'officer');
  assert.equal(officerCtx.destinationLabel, 'Officer Command Center');
  assert.equal(officerCtx.effectivePortal, PORTALS.OFFICER);
  assert.equal(officerCtx.portalLabel, PORTAL_LABELS[PORTALS.OFFICER]);
  assert.equal(officerCtx.parentSectionKey, SECTIONS.OFFICER_OPERATIONS);
  assert.equal(officerCtx.isOfficerView, true);
  assert.equal(officerCtx.isCitizenView, false);

  // Live Call Shield
  const callShieldCtx = getNavigationContext('live-call-safety', 'citizen');
  assert.equal(callShieldCtx.destinationLabel, 'Live Call Shield');
  assert.equal(callShieldCtx.effectivePortal, PORTALS.CITIZEN);
  assert.equal(callShieldCtx.parentSectionKey, SECTIONS.CITIZEN_SAFETY);
});

test('Officer specialist views preserve parent navigation context and officer portal state', () => {
  const officerTools = [
    { key: 'mule-freeze', label: 'Mule Account Freeze' },
    { key: 'money-trail', label: 'Money Trail & Hop Reconstructor' },
    { key: 'triage', label: 'Triage Engine' },
    { key: 'evidence-affidavit-compiler', label: 'Section 63 BSA Affidavit' },
    { key: 'cli-spoof-detector', label: 'CLI Spoof & Telecom Triage' },
    { key: 'syndicate-triage', label: 'Syndicate & APK Triage' },
    { key: 'stage-inspector', label: 'Stage & Uniform Inspector' },
    { key: 'dpdp-redaction', label: 'DPDP Redaction & Masking' },
    { key: 'evidence', label: 'Evidence Vault' },
  ];

  for (const tool of officerTools) {
    const ctx = getNavigationContext(tool.key, 'citizen'); // Even if initial state was citizen
    assert.equal(ctx.destinationLabel, tool.label, `Label match for ${tool.key}`);
    assert.equal(ctx.effectivePortal, PORTALS.OFFICER, `Portal should be officer for ${tool.key}`);
    assert.equal(ctx.isOfficerView, true, `isOfficerView should be true for ${tool.key}`);
    assert.equal(ctx.parentSectionKey, SECTIONS.OFFICER_OPERATIONS, `Section should be officer-operations for ${tool.key}`);
    assert.equal(ctx.parentSectionLabel, 'Officer Operations', `Section label should match for ${tool.key}`);
    assert.equal(ctx.activeDropdownKey, 'officer-operations', `Dropdown parent should be officer-operations for ${tool.key}`);
  }
});

test('Citizen specialist views preserve parent navigation context and citizen portal state', () => {
  const citizenTools = [
    { key: 'emergency-killswitch', label: 'Emergency Kill-Switch' },
    { key: 'regional-threat-mesh', label: 'Regional Threat Mesh' },
    { key: 'voice-deepfake', label: 'Voice Deepfake Detector' },
    { key: 'takedown-generator', label: 'Domain Abuse Takedown' },
    { key: 'field-seizure', label: 'Field Seizure Companion' },
    { key: 'multilingual-speech', label: 'Indic Speech ASR' },
    { key: 'advisory-subscriptions', label: 'Advisory Subscriptions' },
    { key: 'toolbox', label: 'Cyber Toolbox' },
  ];

  for (const tool of citizenTools) {
    const ctx = getNavigationContext(tool.key, 'officer'); // Even if portal was set to officer
    assert.equal(ctx.destinationLabel, tool.label, `Label match for ${tool.key}`);
    assert.equal(ctx.effectivePortal, PORTALS.CITIZEN, `Portal should be citizen for ${tool.key}`);
    assert.equal(ctx.isCitizenView, true, `isCitizenView should be true for ${tool.key}`);
    assert.equal(ctx.parentSectionKey, SECTIONS.CITIZEN_TOOLS, `Section should be citizen-tools for ${tool.key}`);
    assert.equal(ctx.parentSectionLabel, 'Citizen Tools', `Section label should match for ${tool.key}`);
    assert.equal(ctx.activeDropdownKey, 'citizen-tools', `Dropdown parent should be citizen-tools for ${tool.key}`);
  }
});

test('Cyber Toolbox sub-features gracefully fall back to Citizen Tools parent context', () => {
  const subFeatures = ['qr-guardian', 'link-shield', 'sms-analyzer', 'phish-detect', 'upi-fraud-shield'];

  for (const sub of subFeatures) {
    const ctx = getNavigationContext(sub, 'citizen');
    assert.ok(ctx.destinationLabel.length > 0);
    assert.equal(ctx.effectivePortal, PORTALS.CITIZEN);
    assert.equal(ctx.parentSectionKey, SECTIONS.CITIZEN_TOOLS);
    assert.equal(ctx.activeDropdownKey, 'citizen-tools');
  }
});

test('Resources and Project destinations preserve parent dropdown context', () => {
  // Resources
  const awarenessCtx = getNavigationContext('awareness');
  assert.equal(awarenessCtx.parentSectionKey, SECTIONS.RESOURCES);
  assert.equal(awarenessCtx.activeDropdownKey, 'resources');

  const ruleLibCtx = getNavigationContext('rule-library');
  assert.equal(ruleLibCtx.parentSectionKey, SECTIONS.RESOURCES);
  assert.equal(ruleLibCtx.activeDropdownKey, 'resources');

  // Project
  const aboutCtx = getNavigationContext('about');
  assert.equal(aboutCtx.parentSectionKey, SECTIONS.PROJECT);
  assert.equal(aboutCtx.activeDropdownKey, 'project');

  const meetCtx = getNavigationContext('meet');
  assert.equal(meetCtx.parentSectionKey, SECTIONS.PROJECT);
  assert.equal(meetCtx.activeDropdownKey, 'project');

  const contribCtx = getNavigationContext('contributors');
  assert.equal(contribCtx.parentSectionKey, SECTIONS.PROJECT);
  assert.equal(contribCtx.activeDropdownKey, 'project');
});
