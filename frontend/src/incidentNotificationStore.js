/**
 * Incident Assignment & Escalation Notification Store.
 *
 * Implements role-aware notification routing, jurisdiction boundary validation,
 * sanitized email payload construction (strictly omitting citizen PII and evidence),
 * quiet hours enforcement with critical event override, and transient failure retry tracking.
 */

export const JURISDICTION_REGION_MAP = {
  "Central Zone": "JUR-DELHI-METRO",
  "North Zone": "JUR-DELHI-METRO",
  "East Zone": "JUR-DELHI-METRO",
  "South Zone": "JUR-NCR-SOUTH",
  "West Zone": "JUR-NCR-SOUTH",
  "Unspecified": "JUR-DELHI-METRO",
};

export const INITIAL_OFFICER_DIRECTORY = [
  {
    officer_id: "OFF-DELHI-101",
    name: "Inspector Rajesh Sharma",
    email: "rajesh.sharma@delhipolice.gov.in",
    role: "responder",
    jurisdiction_id: "JUR-DELHI-METRO",
    regions: ["Central Zone", "North Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: true,
      reassignment_enabled: true,
      escalation_enabled: true,
      supervisor_review_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-DELHI-102",
    name: "Sub-Inspector Amit Patel",
    email: "amit.patel@delhipolice.gov.in",
    role: "responder",
    jurisdiction_id: "JUR-DELHI-METRO",
    regions: ["East Zone", "Central Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: true,
      reassignment_enabled: true,
      escalation_enabled: true,
      supervisor_review_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-SUP-DELHI",
    name: "ACP Vikram Malhotra",
    email: "vikram.malhotra@delhipolice.gov.in",
    role: "supervisor",
    jurisdiction_id: "JUR-DELHI-METRO",
    regions: ["Central Zone", "North Zone", "East Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: true,
      reassignment_enabled: true,
      escalation_enabled: true,
      supervisor_review_enabled: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "23:00",
      quiet_hours_end: "06:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-CMD-METRO",
    name: "Joint Commissioner Priya Verma",
    email: "priya.verma@delhipolice.gov.in",
    role: "commander",
    jurisdiction_id: "JUR-DELHI-METRO",
    regions: ["Central Zone", "North Zone", "East Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: false,
      reassignment_enabled: false,
      escalation_enabled: true,
      supervisor_review_enabled: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "23:00",
      quiet_hours_end: "06:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-NCR-201",
    name: "Inspector Sunita Rao",
    email: "sunita.rao@haryanapolice.gov.in",
    role: "responder",
    jurisdiction_id: "JUR-NCR-SOUTH",
    regions: ["South Zone", "West Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: true,
      reassignment_enabled: true,
      escalation_enabled: true,
      supervisor_review_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-NCR-202",
    name: "Sub-Inspector Deepak Nair",
    email: "deepak.nair@haryanapolice.gov.in",
    role: "responder",
    jurisdiction_id: "JUR-NCR-SOUTH",
    regions: ["South Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: true,
      reassignment_enabled: true,
      escalation_enabled: true,
      supervisor_review_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-SUP-NCR",
    name: "DCP Neha Kapoor",
    email: "neha.kapoor@haryanapolice.gov.in",
    role: "supervisor",
    jurisdiction_id: "JUR-NCR-SOUTH",
    regions: ["South Zone", "West Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: true,
      reassignment_enabled: true,
      escalation_enabled: true,
      supervisor_review_enabled: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "23:00",
      quiet_hours_end: "06:00",
      timezone: "Asia/Kolkata",
    },
  },
  {
    officer_id: "OFF-CMD-SOUTH",
    name: "Special Commissioner Arvind Swamy",
    email: "arvind.swamy@delhipolice.gov.in",
    role: "commander",
    jurisdiction_id: "JUR-NCR-SOUTH",
    regions: ["South Zone", "West Zone"],
    preferences: {
      email_enabled: true,
      assignment_enabled: false,
      reassignment_enabled: false,
      escalation_enabled: true,
      supervisor_review_enabled: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "23:00",
      quiet_hours_end: "06:00",
      timezone: "Asia/Kolkata",
    },
  },
];

export class IncidentNotificationStore {
  constructor() {
    this.officers = INITIAL_OFFICER_DIRECTORY.map((o) => ({
      ...o,
      preferences: { ...o.preferences },
      regions: [...o.regions],
    }));
    this.notifications = [];
    this.simulatedFailures = new Set();
    this.subscribers = new Set();
    this.counter = 1;
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
    return {
      officers: [...this.officers],
      notifications: [...this.notifications],
      stats: this.getDeliveryStats(),
    };
  }

  reset() {
    this.officers = INITIAL_OFFICER_DIRECTORY.map((o) => ({
      ...o,
      preferences: { ...o.preferences },
      regions: [...o.regions],
    }));
    this.notifications = [];
    this.simulatedFailures.clear();
    this.counter = 1;
    this.notify();
  }

  resolveJurisdiction(region) {
    return JURISDICTION_REGION_MAP[region] || "JUR-DELHI-METRO";
  }

  getOfficer(officerId) {
    let officer = this.officers.find((o) => o.officer_id === officerId);
    if (!officer) {
      // Auto-provision generic demo ID
      officer = {
        officer_id: officerId,
        name: `Officer ${officerId}`,
        email: `${officerId.toLowerCase()}@delhipolice.gov.in`,
        role: "responder",
        jurisdiction_id: "JUR-DELHI-METRO",
        regions: ["Central Zone", "North Zone", "East Zone", "South Zone", "West Zone", "Unspecified"],
        preferences: {
          email_enabled: true,
          assignment_enabled: true,
          reassignment_enabled: true,
          escalation_enabled: true,
          supervisor_review_enabled: false,
          quiet_hours_enabled: false,
          quiet_hours_start: "22:00",
          quiet_hours_end: "07:00",
          timezone: "Asia/Kolkata",
        },
      };
      this.officers.push(officer);
    }
    return { ...officer };
  }

  updateOfficerPreferences(officerId, newPreferences) {
    const idx = this.officers.findIndex((o) => o.officer_id === officerId);
    if (idx === -1) {
      this.getOfficer(officerId); // provision
    }
    const target = this.officers.find((o) => o.officer_id === officerId);
    if (target) {
      target.preferences = { ...target.preferences, ...newPreferences };
      this.notify();
      return { ...target };
    }
    throw new Error(`Officer ${officerId} not found`);
  }

  isAuthorized(officer, jurisdictionId, region) {
    if (officer.jurisdiction_id === "*") return true;
    if (officer.jurisdiction_id !== jurisdictionId) return false;
    if (officer.regions.includes("*") || officer.regions.includes(region)) return true;
    return false;
  }

  isInQuietHours(preferences, timeStr = null) {
    if (!preferences.quiet_hours_enabled) return false;

    let curH, curM;
    if (timeStr) {
      [curH, curM] = timeStr.split(":").map(Number);
    } else {
      const now = new Date();
      curH = now.getHours();
      curM = now.getMinutes();
    }

    const curMins = curH * 60 + curM;
    const [sH, sM] = (preferences.quiet_hours_start || "22:00").split(":").map(Number);
    const startMins = sH * 60 + sM;
    const [eH, eM] = (preferences.quiet_hours_end || "07:00").split(":").map(Number);
    const endMins = eH * 60 + eM;

    if (startMins > endMins) {
      return curMins >= startMins || curMins < endMins;
    }
    return curMins >= startMins && curMins < endMins;
  }

  buildSanitizedContent(incident, eventType, recipient, token) {
    const incId = incident.id || "INC-XXXX";
    const category = incident.category || "unspecified";
    const priority = (incident.severity || "low").toUpperCase();
    const region = incident.region || "Unspecified";
    const jurId = this.resolveJurisdiction(region);

    const eventLabels = {
      assignment: "Incident Assignment",
      reassignment: "Incident Reassignment",
      escalation: "PRIORITY ESCALATION",
      supervisor_review: "SUPERVISOR REVIEW REQUIRED",
    };
    const label = eventLabels[eventType] || "Incident Notification";

    const subject = `[KshemOS Alert] ${label} | Ref: ${incId} | Priority: ${priority} | ${region}`;
    const secureLink = `https://kshemos.internal/dashboard/incidents/${incId}?notif_auth=${token}&action=review`;

    const assignmentTimeIso = new Date(incident.updated_at || Date.now()).toISOString();

    const bodySnippet = [
      `OFFICIAL DISPATCH NOTICE — RESTRICTED TO AUTHORIZED PERSONNEL`,
      `Incident Reference ID: ${incId}`,
      `Jurisdiction Command: ${jurId}`,
      `Operational Sector: ${region}`,
      `Classification Category: ${category}`,
      `Operational Priority: ${priority}`,
      `Action Timestamp: ${assignmentTimeIso}`,
      `Event Trigger: ${label}`,
      `Designated Officer: ${recipient.name} (${recipient.role.toUpperCase()})`,
      ``,
      `Action Required:`,
      `You are receiving this official dispatch as an authorized ${recipient.role} for ${jurId}. Access the secure terminal below to review assigned tasks and initiate response protocols.`,
      ``,
      `Secure Terminal Link: ${secureLink}`,
      ``,
      `[SECURITY NOTICE: Pursuant to SOP 24-B & Digital Evidence Handling Mandates, all citizen personal identifying information (PII), caller numbers, transcripts, and evidentiary files are strictly withheld from automated email dispatches. Access complete case artifacts exclusively within the multi-factor authenticated KshemOS operations terminal.]`,
    ].join("\n");

    return { subject, bodySnippet, secureLink };
  }

  dispatchNotifications(
    incident,
    eventType,
    previousAssignedTo = null,
    actorId = null,
    nowMs = Date.now(),
    overrideQuietHoursTime = null
  ) {
    const region = incident.region || "Unspecified";
    const jurisdictionId = this.resolveJurisdiction(region);
    const priority = (incident.severity || "low").toLowerCase();
    const isCritical = priority === "critical";

    const candidates = [];

    // 1. Responders
    if (incident.assigned_to) {
      const resp = this.getOfficer(incident.assigned_to);
      if (resp) candidates.push(resp);
    }
    if (previousAssignedTo && eventType === "reassignment") {
      const prev = this.getOfficer(previousAssignedTo);
      if (prev && !candidates.some((c) => c.officer_id === prev.officer_id)) {
        candidates.push(prev);
      }
    }

    // 2. Supervisors / Commanders
    const supervisors = this.officers.filter(
      (o) =>
        ["supervisor", "commander"].includes(o.role) &&
        this.isAuthorized(o, jurisdictionId, region)
    );

    if (["escalation", "supervisor_review"].includes(eventType)) {
      for (const sup of supervisors) {
        if (!candidates.some((c) => c.officer_id === sup.officer_id)) {
          candidates.push(sup);
        }
      }
    } else if (["assignment", "reassignment"].includes(eventType)) {
      for (const sup of supervisors) {
        if (sup.role === "supervisor" && !candidates.some((c) => c.officer_id === sup.officer_id)) {
          candidates.push(sup);
        }
      }
    }

    const dispatched = [];

    for (const recipient of candidates) {
      const token = `TKN-${String(this.counter++).padStart(5, "0")}`;
      const notifId = `NOTIF-${String(this.counter++).padStart(5, "0")}`;
      const prefs = recipient.preferences || {};

      const { subject, bodySnippet, secureLink } = this.buildSanitizedContent(
        incident,
        eventType,
        recipient,
        token
      );

      // Authorization check
      if (!this.isAuthorized(recipient, jurisdictionId, region)) {
        const item = {
          notification_id: notifId,
          incident_id: incident.id,
          event_type: eventType,
          priority,
          jurisdiction_id: jurisdictionId,
          region,
          recipient_id: recipient.officer_id,
          recipient_email: recipient.email,
          recipient_role: recipient.role,
          recipient_name: recipient.name,
          subject,
          body_snippet: bodySnippet,
          secure_dashboard_link: secureLink,
          created_at: nowMs,
          delivery_status: "unauthorized_jurisdiction",
          attempts: 0,
          last_attempt_at: nowMs,
          error_message: `Security boundary violation: Officer ${recipient.officer_id} is not authorized for ${jurisdictionId} (${region}).`,
          retry_history: [],
        };
        this.notifications.unshift(item);
        dispatched.push(item);
        continue;
      }

      // Preference check
      const prefKey = `${eventType}_enabled`;
      if (!prefs.email_enabled || prefs[prefKey] === false) {
        const item = {
          notification_id: notifId,
          incident_id: incident.id,
          event_type: eventType,
          priority,
          jurisdiction_id: jurisdictionId,
          region,
          recipient_id: recipient.officer_id,
          recipient_email: recipient.email,
          recipient_role: recipient.role,
          recipient_name: recipient.name,
          subject,
          body_snippet: bodySnippet,
          secure_dashboard_link: secureLink,
          created_at: nowMs,
          delivery_status: "suppressed_unsubscribed",
          attempts: 0,
          last_attempt_at: nowMs,
          error_message: `Suppressed: Recipient has disabled ${eventType} email alerts.`,
          retry_history: [],
        };
        this.notifications.unshift(item);
        dispatched.push(item);
        continue;
      }

      // Quiet hours check (critical bypasses)
      const inQuiet = this.isInQuietHours(prefs, overrideQuietHoursTime);
      if (inQuiet && !isCritical) {
        const item = {
          notification_id: notifId,
          incident_id: incident.id,
          event_type: eventType,
          priority,
          jurisdiction_id: jurisdictionId,
          region,
          recipient_id: recipient.officer_id,
          recipient_email: recipient.email,
          recipient_role: recipient.role,
          recipient_name: recipient.name,
          subject,
          body_snippet: bodySnippet,
          secure_dashboard_link: secureLink,
          created_at: nowMs,
          delivery_status: "suppressed_quiet_hours",
          attempts: 0,
          last_attempt_at: nowMs,
          error_message: `Suppressed: Recipient is in active quiet hours (${prefs.quiet_hours_start}-${prefs.quiet_hours_end}) for non-critical event.`,
          retry_history: [],
        };
        this.notifications.unshift(item);
        dispatched.push(item);
        continue;
      }

      // Transient failure check
      const shouldFail =
        this.simulatedFailures.has(recipient.officer_id) ||
        this.simulatedFailures.has(recipient.email) ||
        this.simulatedFailures.has(notifId);

      let deliveryStatus = "delivered";
      let errMsg = null;
      let history = [{ attempt: 1, timestamp: nowMs, status: "delivered", error: null }];

      if (shouldFail) {
        deliveryStatus = "retrying";
        errMsg = "SMTP Gateway timeout (504): transient connection failure to upstream MTA.";
        history = [{ attempt: 1, timestamp: nowMs, status: "retrying", error: errMsg }];
      }

      const item = {
        notification_id: notifId,
        incident_id: incident.id,
        event_type: eventType,
        priority,
        jurisdiction_id: jurisdictionId,
        region,
        recipient_id: recipient.officer_id,
        recipient_email: recipient.email,
        recipient_role: recipient.role,
        recipient_name: recipient.name,
        subject,
        body_snippet: bodySnippet,
        secure_dashboard_link: secureLink,
        created_at: nowMs,
        delivery_status: deliveryStatus,
        attempts: 1,
        last_attempt_at: nowMs,
        error_message: errMsg,
        retry_history: history,
      };

      this.notifications.unshift(item);
      dispatched.push(item);
    }

    this.notify();
    return dispatched;
  }

  retryNotification(notificationId, forceSuccess = true) {
    const item = this.notifications.find((n) => n.notification_id === notificationId);
    if (!item) throw new Error(`Notification ${notificationId} not found`);

    const now = Date.now();
    item.attempts += 1;
    item.last_attempt_at = now;

    if (forceSuccess || item.attempts >= 3) {
      if (!forceSuccess && item.attempts >= 3) {
        item.delivery_status = "failed";
        item.error_message = "Exceeded maximum delivery retries (3 attempts).";
        item.retry_history.push({
          attempt: item.attempts,
          timestamp: now,
          status: "failed",
          error: item.error_message,
        });
      } else {
        item.delivery_status = "delivered";
        item.error_message = null;
        item.retry_history.push({
          attempt: item.attempts,
          timestamp: now,
          status: "delivered",
          error: null,
        });
      }
    } else {
      item.delivery_status = "retrying";
      item.retry_history.push({
        attempt: item.attempts,
        timestamp: now,
        status: "retrying",
        error: "Temporary transport refusal (retry pending).",
      });
    }

    this.notify();
    return { ...item };
  }

  getDeliveryStats() {
    const total = this.notifications.length;
    const delivered = this.notifications.filter((n) => n.delivery_status === "delivered").length;
    const retrying = this.notifications.filter((n) => n.delivery_status === "retrying").length;
    const failed = this.notifications.filter((n) => n.delivery_status === "failed").length;
    const suppressed = this.notifications.filter((n) => n.delivery_status.startsWith("suppressed")).length;
    const unauthorized = this.notifications.filter((n) => n.delivery_status === "unauthorized_jurisdiction").length;

    return { total, delivered, retrying, failed, suppressed, unauthorized };
  }

  setSimulatedFailure(target, enable = true) {
    if (enable) this.simulatedFailures.add(target);
    else this.simulatedFailures.delete(target);
  }
}

export const defaultIncidentNotificationStore = new IncidentNotificationStore();
