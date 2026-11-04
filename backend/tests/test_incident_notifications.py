"""
Unit and integration tests for Role-Aware Incident Assignment and Escalation Notifications.
"""
from __future__ import annotations

import unittest

from app.services import incident_notifications, incidents


class TestIncidentNotifications(unittest.TestCase):
    def setUp(self):
        incident_notifications.reset()
        incidents.reset()

    def test_authorized_responders_and_supervisors_receive_assignment(self):
        """Assignment in Central Zone notifies authorized responder and jurisdiction supervisor."""
        inc = incidents.create_incident(
            category="scam_call",
            description="Suspected digital arrest impersonation call",
            region="Central Zone",
        )
        outcomes = incident_notifications.dispatch_incident_notifications(inc, "assignment")
        # No one assigned yet -> candidates empty or only supervisor
        self.assertLessEqual(len(outcomes), 1)

        # Now assign to authorized Central Zone responder OFF-DELHI-101
        updated = incidents.update_incident(inc["id"], {"assigned_to": "OFF-DELHI-101"})
        audit = incident_notifications.list_delivery_audit(incident_id=inc["id"])

        # Should include OFF-DELHI-101 and OFF-SUP-DELHI
        recipient_ids = [a["recipient_id"] for a in audit]
        self.assertIn("OFF-DELHI-101", recipient_ids)
        self.assertIn("OFF-SUP-DELHI", recipient_ids)
        # Out-of-jurisdiction officers must NOT be notified
        self.assertNotIn("OFF-NCR-201", recipient_ids)
        self.assertNotIn("OFF-SUP-NCR", recipient_ids)

        for a in audit:
            self.assertEqual(a["delivery_status"], "delivered")
            self.assertEqual(a["jurisdiction_id"], "JUR-DELHI-METRO")

    def test_unauthorized_officer_assignment_blocked(self):
        """Assigning an out-of-jurisdiction officer generates unauthorized_jurisdiction outcome."""
        inc = {
            "id": "INC-0999",
            "category": "counterfeit",
            "severity": "medium",
            "region": "Central Zone",  # Under JUR-DELHI-METRO
            "assigned_to": "OFF-NCR-201",  # Strictly JUR-NCR-SOUTH
            "updated_at": 1730000000000,
        }
        outcomes = incident_notifications.dispatch_incident_notifications(inc, "assignment")
        ncr_outcomes = [o for o in outcomes if o["recipient_id"] == "OFF-NCR-201"]
        self.assertEqual(len(ncr_outcomes), 1)
        self.assertEqual(ncr_outcomes[0]["delivery_status"], "unauthorized_jurisdiction")
        self.assertIn("boundary violation", ncr_outcomes[0]["error_message"])

    def test_reassignment_notifies_both_officers_and_supervisor(self):
        """Reassigning an incident notifies both previous and newly assigned responders + supervisor."""
        inc = incidents.create_incident(
            category="fraud_tx",
            description="Mule account drain reported in Connaught Place",
            region="Central Zone",
        )
        incidents.update_incident(inc["id"], {"assigned_to": "OFF-DELHI-101"})

        # Reassign to OFF-DELHI-102
        incidents.update_incident(inc["id"], {"assigned_to": "OFF-DELHI-102"})

        reassign_audits = incident_notifications.list_delivery_audit(
            incident_id=inc["id"], event_type="reassignment"
        )
        reassign_recipients = [a["recipient_id"] for a in reassign_audits]
        self.assertIn("OFF-DELHI-102", reassign_recipients)  # New responder
        self.assertIn("OFF-DELHI-101", reassign_recipients)  # Previous responder
        self.assertIn("OFF-SUP-DELHI", reassign_recipients)  # Supervisor

    def test_escalation_and_supervisor_review_routing(self):
        """Escalation notifies assigned responder, supervisors, and commanders with critical priority."""
        inc = incidents.create_incident(
            category="scam_call",
            description="High value digital arrest warrant extortion",
            region="Central Zone",
        )
        incidents.update_incident(inc["id"], {"assigned_to": "OFF-DELHI-101"})

        # Escalate status to escalated
        incidents.update_incident(inc["id"], {"status": "escalated"})

        esc_audits = incident_notifications.list_delivery_audit(
            incident_id=inc["id"], event_type="escalation"
        )
        esc_recipients = [a["recipient_id"] for a in esc_audits]
        self.assertIn("OFF-DELHI-101", esc_recipients)
        self.assertIn("OFF-SUP-DELHI", esc_recipients)
        self.assertIn("OFF-CMD-METRO", esc_recipients)  # Commander notified of escalation

    def test_sanitized_email_payload_excludes_sensitive_evidence_and_citizen_pii(self):
        """Emails must strictly contain minimal reference, priority, time, and link — never PII."""
        inc = {
            "id": "INC-0077",
            "category": "digital_arrest",
            "severity": "critical",
            "region": "Central Zone",
            "reporter_name": "Deepak Citizen",
            "reporter_phone": "+91 98765 43210",
            "linked_account": "ACC-MULE-9988",
            "description": "Scammer claimed to be CBI Officer threatening narcotics FIR. Bank transfer requested.",
            "updated_at": 1730000000000,
        }
        recipient = incident_notifications.get_officer("OFF-DELHI-101")
        subject, body, link = incident_notifications.build_sanitized_notification_content(
            inc, "assignment", recipient, "TOKEN-123"
        )

        # Positive assertions: minimal reference, priority, time, secure link
        self.assertIn("INC-0077", subject)
        self.assertIn("CRITICAL", subject)
        self.assertIn("Central Zone", subject)
        self.assertIn("https://kshemos.internal/dashboard/incidents/INC-0077", link)
        self.assertIn("TOKEN-123", link)

        # STRICT negative privacy assertions: No citizen PII or raw evidence in email!
        self.assertNotIn("Deepak Citizen", body)
        self.assertNotIn("+91 98765 43210", body)
        self.assertNotIn("ACC-MULE-9988", body)
        self.assertNotIn("narcotics FIR", body)
        self.assertNotIn("Bank transfer requested", body)
        self.assertIn("SECURITY NOTICE: Pursuant to SOP 24-B", body)

    def test_quiet_hours_suppression_for_non_critical(self):
        """Non-critical events during configured quiet hours are suppressed."""
        officer_id = "OFF-DELHI-101"
        incident_notifications.update_officer_preferences(
            officer_id,
            {
                "quiet_hours_enabled": True,
                "quiet_hours_start": "22:00",
                "quiet_hours_end": "07:00",
            },
        )
        inc = {
            "id": "INC-0010",
            "category": "counterfeit",
            "severity": "medium",  # Non-critical!
            "region": "Central Zone",
            "assigned_to": officer_id,
            "updated_at": 1730000000000,
        }
        # Simulate time at 23:30 (inside quiet hours)
        outcomes = incident_notifications.dispatch_incident_notifications(
            inc, "assignment", override_quiet_hours_now_str="23:30"
        )
        officer_outcome = next(o for o in outcomes if o["recipient_id"] == officer_id)
        self.assertEqual(officer_outcome["delivery_status"], "suppressed_quiet_hours")
        self.assertIn("quiet hours", officer_outcome["error_message"])

    def test_quiet_hours_critical_override(self):
        """Critical priority events override and bypass quiet hours."""
        officer_id = "OFF-DELHI-101"
        incident_notifications.update_officer_preferences(
            officer_id,
            {
                "quiet_hours_enabled": True,
                "quiet_hours_start": "22:00",
                "quiet_hours_end": "07:00",
            },
        )
        inc = {
            "id": "INC-0011",
            "category": "digital_arrest",
            "severity": "critical",  # CRITICAL overrides quiet hours!
            "region": "Central Zone",
            "assigned_to": officer_id,
            "updated_at": 1730000000000,
        }
        outcomes = incident_notifications.dispatch_incident_notifications(
            inc, "escalation", override_quiet_hours_now_str="23:30"
        )
        officer_outcome = next(o for o in outcomes if o["recipient_id"] == officer_id)
        self.assertEqual(officer_outcome["delivery_status"], "delivered")

    def test_transient_failure_retry_and_recording(self):
        """Transient network failure records retrying state, and manual retry delivers successfully."""
        officer_id = "OFF-DELHI-101"
        incident_notifications.set_simulated_failure(officer_id, enable=True)

        inc = {
            "id": "INC-0012",
            "category": "scam_call",
            "severity": "high",
            "region": "Central Zone",
            "assigned_to": officer_id,
            "updated_at": 1730000000000,
        }
        outcomes = incident_notifications.dispatch_incident_notifications(inc, "assignment")
        officer_outcome = next(o for o in outcomes if o["recipient_id"] == officer_id)
        self.assertEqual(officer_outcome["delivery_status"], "retrying")
        self.assertEqual(officer_outcome["attempts"], 1)
        self.assertIn("timeout", officer_outcome["error_message"])
        self.assertEqual(len(officer_outcome["retry_history"]), 1)

        # Clear simulated failure and trigger retry
        incident_notifications.set_simulated_failure(officer_id, enable=False)
        retried = incident_notifications.retry_notification(officer_outcome["notification_id"])
        self.assertEqual(retried["delivery_status"], "delivered")
        self.assertEqual(retried["attempts"], 2)
        self.assertIsNone(retried["error_message"])
        self.assertEqual(len(retried["retry_history"]), 2)

    def test_incident_service_integration(self):
        """Incidents lifecycle actions automatically generate delivery audit entries."""
        inc = incidents.create_incident(
            category="scam_call",
            description="Routine suspicious call",
            region="Central Zone",
        )
        # Update assignment
        incidents.update_incident(inc["id"], {"assigned_to": "OFF-DELHI-101"})
        stats = incident_notifications.get_delivery_stats()
        self.assertGreaterEqual(stats["delivered"], 1)


def run_all_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestIncidentNotifications)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        import sys
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
