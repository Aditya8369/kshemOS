import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  generateTakedownNoticeLocally,
  resolveDnsLocally,
  updateTakedownStatusLocally,
  probeDomainStatusLocally,
  listLocalTakedownNotices,
  fetchTakedownStatsApi,
  resetLocalTakedownStore,
  CERT_IN_INCIDENT_EMAIL,
  TAKEDOWN_PRESETS,
} from './takedownStore.js';

describe('Automated Registrar & Hosting Abuse Takedown Notice Generator Store', () => {
  beforeEach(() => {
    resetLocalTakedownStore();
  });

  it('generates certified takedown notice package for Cloudflare & Namecheap phishing domain', () => {
    const preset = TAKEDOWN_PRESETS.find((p) => p.id === 'preset-sbi-phish');
    assert.ok(preset, 'Preset should exist');

    const result = generateTakedownNoticeLocally({
      target_url: preset.url,
      brand_impersonated: preset.brand,
      urgency_level: preset.urgency,
      officer_name: 'Inspector Rajesh Sharma',
      officer_badge_id: 'OFF-DELHI-104',
      officer_email: 'cybercell.delhi@gov.in',
      save_to_evidence_vault: true,
    });

    assert.ok(result.notice_id.startsWith('ABUSE-2026-'));
    assert.ok(result.cert_in_reference_id.startsWith('CERT-IN-2026-PHISH-'));
    assert.strictEqual(result.status, 'DISPATCHED');
    assert.strictEqual(result.domain_offline, false);

    // Verify DNS & Hosting Provider resolution
    const dns = result.dns_records;
    assert.strictEqual(dns.hosting_provider, 'Cloudflare');
    assert.strictEqual(dns.hosting_abuse_email, 'abuse@cloudflare.com');
    assert.strictEqual(dns.registrar_name, 'Namecheap, Inc.');
    assert.strictEqual(dns.registrar_abuse_email, 'abuse@namecheap.com');
    assert.ok(dns.a_records.length >= 1);

    // Verify Evidence Package
    const pkg = result.evidence_package;
    assert.strictEqual(pkg.target_brand_impersonated, 'State Bank of India (SBI)');
    assert.strictEqual(pkg.sha256_dom_hash.length, 64);
    assert.ok(pkg.malicious_indicators.length >= 3);

    // Verify Statutory Notice & RFC Email
    assert.ok(result.rfc_email_subject.includes('[URGENT] Formal Abuse Takedown Notice'));
    assert.ok(result.rfc_email_body.includes('Section 79(3)(b)'));
    assert.ok(result.rfc_email_body.includes(CERT_IN_INCIDENT_EMAIL));
    assert.ok(result.cc_recipients.includes(CERT_IN_INCIDENT_EMAIL));

    // Verify Evidence Vault preservation
    assert.ok(result.vaulted_evidence_id, 'Should generate evidence vault ID');
  });

  it('resolves Hostinger and AWS hosting infrastructure correctly', () => {
    const dnsHostinger = resolveDnsLocally('delhi-police-digital-arrest-portal.site');
    assert.strictEqual(dnsHostinger.hosting_provider, 'Hostinger');
    assert.strictEqual(dnsHostinger.hosting_abuse_email, 'abuse@hostinger.com');

    const dnsAws = resolveDnsLocally('fedex-customs-clearance-india.online');
    assert.strictEqual(dnsAws.hosting_provider, 'Amazon Web Services (AWS)');
    assert.strictEqual(dnsAws.hosting_abuse_email, 'abuse@amazonaws.com');
  });

  it('tracks takedown lifecycle status updates and records events', () => {
    const record = generateTakedownNoticeLocally({
      target_url: 'https://test-scam-portal.top/login',
      brand_impersonated: 'Axis Bank',
    });

    // Update to UNDER_REVIEW
    const updatedReview = updateTakedownStatusLocally(
      record.notice_id,
      'UNDER_REVIEW',
      'OFF-DELHI-104',
      'Cloudflare ticket acknowledged'
    );
    assert.strictEqual(updatedReview.status, 'UNDER_REVIEW');

    // Update to DOMAIN_SUSPENDED
    const updatedSuspended = updateTakedownStatusLocally(
      record.notice_id,
      'DOMAIN_SUSPENDED',
      'OFF-DELHI-104',
      'Domain suspended by registrar'
    );
    assert.strictEqual(updatedSuspended.status, 'DOMAIN_SUSPENDED');
    assert.strictEqual(updatedSuspended.domain_offline, true);
  });

  it('probes domain status for offline confirmation and nameserver churn alert', () => {
    const policeNotice = generateTakedownNoticeLocally({
      target_url: 'https://delhi-police-digital-arrest-portal.site/warrant.html',
    });
    const fedexNotice = generateTakedownNoticeLocally({
      target_url: 'https://fedex-customs-clearance-india.online/pay.php',
    });

    // Probe offline domain
    const probeOffline = probeDomainStatusLocally(policeNotice.notice_id);
    assert.strictEqual(probeOffline.is_offline, true);
    assert.ok(probeOffline.officer_alert.includes('OFFLINE'));

    // Probe nameserver churn
    const probeChurn = probeDomainStatusLocally(fedexNotice.notice_id);
    assert.strictEqual(probeChurn.nameservers_churned, true);
    assert.ok(probeChurn.officer_alert.includes('EVASION WARNING'));
  });

  it('fetches aggregated takedown statistics', async () => {
    listLocalTakedownNotices();
    const stats = await fetchTakedownStatsApi();

    assert.ok(stats.total_notices_dispatched >= 3);
    assert.ok(typeof stats.active_under_review === 'number');
    assert.ok(typeof stats.domains_suspended === 'number');
    assert.ok(typeof stats.average_takedown_time_hours === 'number');
  });
});

