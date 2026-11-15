"""
Unit tests for Automated Registrar & Hosting Abuse Takedown Notice Generator.
Validates DNS/WHOIS resolution, RFC-compliant takedown emails with CERT-In formatting,
lifecycle tracking (Dispatched, Under Review, Domain Suspended, SLA Breached),
offline domain probing, and nameserver churn detection.
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException

from app.models import (
    TakedownNoticeRequest,
    TakedownNoticeStatusUpdateRequest,
)
from app.routers import takedown as router_endpoints
from app.services import evidence, takedown_service


@pytest.fixture(autouse=True)
def reset_service():
    takedown_service.reset_store()
    takedown_service.seed_default_notices()
    yield


def test_generate_takedown_notice_cloudflare_namecheap():
    req = TakedownNoticeRequest(
        target_url="https://sbi-netbanking-kyc-alert.top/login.php",
        incident_id="INC-2026-DELHI-4421",
        brand_impersonated="State Bank of India (SBI)",
        officer_badge_id="OFF-DELHI-104",
        officer_name="Inspector Rajesh Sharma",
        officer_email="cybercell.delhi@gov.in",
        include_cert_in_cc=True,
        urgency_level="CRITICAL_IMMINENT_FRAUD",
        custom_notes="Live credential harvesting portal targeting YONO banking customers.",
        save_to_evidence_vault=True,
    )

    result = takedown_service.generate_takedown_notice(req)

    assert result.notice_id.startswith("ABUSE-2026-")
    assert result.cert_in_reference_id.startswith("CERT-IN-2026-PHISH-")
    assert "sbi" in result.target_domain
    assert result.status == "DISPATCHED"
    assert result.sla_breached is False
    assert result.domain_offline is False

    # Verify DNS & Provider Resolution
    dns = result.dns_records
    assert dns.hosting_provider == "Cloudflare"
    assert dns.hosting_abuse_email == "abuse@cloudflare.com"
    assert dns.registrar_name == "Namecheap, Inc."
    assert dns.registrar_abuse_email == "abuse@namecheap.com"
    assert len(dns.a_records) >= 1
    assert any("cloudflare.com" in ns for ns in dns.ns_records)

    # Verify Evidence Package
    pkg = result.evidence_package
    assert len(pkg.sha256_dom_hash) == 64
    assert "form" in pkg.html_dom_snippet.lower()
    assert pkg.target_brand_impersonated == "State Bank of India (SBI)"
    assert len(pkg.malicious_indicators) >= 3

    # Verify RFC Email Composition
    assert "[URGENT] Formal Abuse Takedown Notice" in result.rfc_email_subject
    assert "Section 79(3)(b)" in result.rfc_email_body
    assert "Section 70B" in result.rfc_email_body
    assert "Bharatiya Nyaya Sanhita" in result.rfc_email_body
    assert "incident@cert-in.org.in" in result.cc_recipients
    assert "cybercell.delhi@gov.in" in result.cc_recipients

    # Verify Evidence Vaulting
    assert result.vaulted_evidence_id is not None
    vault_item = evidence.get_evidence(result.vaulted_evidence_id)
    assert vault_item is not None
    assert vault_item["legal_hold"] is True
    assert vault_item["evidence_type"] == "takedown_notice"


def test_generate_takedown_notice_hostinger():
    req = TakedownNoticeRequest(
        target_url="https://delhi-police-digital-arrest-portal.site/warrant_9921.html",
        brand_impersonated="Delhi Police Cyber Branch",
        officer_badge_id="OFF-DELHI-101",
    )

    result = takedown_service.generate_takedown_notice(req)

    dns = result.dns_records
    assert dns.hosting_provider == "Hostinger"
    assert dns.hosting_abuse_email == "abuse@hostinger.com"
    assert "delhi police" in result.evidence_package.target_brand_impersonated.lower()
    assert any("arrest warrant" in ind.lower() for ind in result.evidence_package.malicious_indicators)


def test_generate_takedown_notice_aws():
    req = TakedownNoticeRequest(
        target_url="https://fedex-customs-clearance-india.online/tracking.php",
        brand_impersonated="FedEx India & Indian Customs",
        urgency_level="HIGH_CREDENTIAL_PHISH",
    )

    result = takedown_service.generate_takedown_notice(req)

    dns = result.dns_records
    assert "Amazon" in dns.hosting_provider
    assert dns.hosting_abuse_email == "abuse@amazonaws.com"
    assert result.primary_recipient == "abuse@amazonaws.com"


def test_takedown_lifecycle_status_update():
    notices = takedown_service.list_takedown_notices()
    assert len(notices) >= 1
    notice_id = notices[0].notice_id

    # Update to UNDER_REVIEW
    update1 = takedown_service.update_takedown_status(
        notice_id,
        TakedownNoticeStatusUpdateRequest(
            new_status="UNDER_REVIEW",
            officer_badge_id="OFF-DELHI-104",
            notes="Cloudflare Trust & Safety ticket #98210 acknowledged.",
        ),
    )
    assert update1.status == "UNDER_REVIEW"
    assert any(e["action"] == "STATUS_UPDATED_TO_UNDER_REVIEW" for e in update1.lifecycle_events)

    # Update to DOMAIN_SUSPENDED
    update2 = takedown_service.update_takedown_status(
        notice_id,
        TakedownNoticeStatusUpdateRequest(
            new_status="DOMAIN_SUSPENDED",
            officer_badge_id="OFF-DELHI-104",
            notes="Registrar applied clientHold and nameservers removed.",
        ),
    )
    assert update2.status == "DOMAIN_SUSPENDED"
    assert update2.domain_offline is True


def test_probe_domain_status_offline_and_nameserver_churn():
    notices = takedown_service.list_takedown_notices()
    police_notice = next(n for n in notices if "police" in n.target_domain)
    fedex_notice = next(n for n in notices if "fedex" in n.target_domain)

    # Probe domain with offline status
    probe_police = takedown_service.probe_domain_status(police_notice.notice_id)
    assert probe_police is not None
    assert probe_police["is_offline"] is True
    assert "OFFLINE" in probe_police["officer_alert"]

    # Probe domain with nameserver churn
    probe_fedex = takedown_service.probe_domain_status(fedex_notice.notice_id)
    assert probe_fedex is not None
    assert probe_fedex["nameservers_churned"] is True
    assert "EVASION WARNING" in probe_fedex["officer_alert"]
    assert any("bulletproof" in ns for ns in probe_fedex["current_nameservers"])


def test_router_endpoints_and_stats():
    # Test generate endpoint
    req = TakedownNoticeRequest(
        target_url="https://sbi-fake-portal.top/index.html",
        brand_impersonated="State Bank of India (SBI)",
    )
    created = router_endpoints.generate_takedown_notice_endpoint(req)
    assert created.notice_id.startswith("ABUSE-2026-")

    # Test get notice by ID
    fetched = router_endpoints.get_takedown_notice_endpoint(created.notice_id)
    assert fetched.notice_id == created.notice_id

    # Test update status endpoint
    updated = router_endpoints.update_takedown_status_endpoint(
        created.notice_id,
        TakedownNoticeStatusUpdateRequest(new_status="UNDER_REVIEW", notes="Ticket created"),
    )
    assert updated.status == "UNDER_REVIEW"

    # Test check-dns endpoint
    dns_probe = router_endpoints.check_domain_dns_endpoint(created.notice_id)
    assert dns_probe["notice_id"] == created.notice_id

    # Test list endpoint
    items = router_endpoints.list_takedown_notices_endpoint()
    assert len(items) >= 4

    # Test stats endpoint
    stats = router_endpoints.get_takedown_stats_endpoint()
    assert stats.total_notices_dispatched >= 4
    assert stats.active_under_review >= 1
    assert stats.domains_suspended >= 1

    # Test 404 for invalid notice ID
    with pytest.raises(HTTPException) as excinfo:
        router_endpoints.get_takedown_notice_endpoint("ABUSE-NONEXISTENT")
    assert excinfo.value.status_code == 404

