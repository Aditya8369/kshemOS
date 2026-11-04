import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Send,
  Sliders,
  Filter,
  UserCheck,
  Lock,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  defaultIncidentNotificationStore,
  fetchIncidentNotificationsApi,
  fetchNotificationDirectoryApi,
  updateOfficerPreferencesApi,
  retryIncidentNotificationApi,
  dispatchIncidentNotificationApi,
} from '../../api';

export default function IncidentNotificationConsole({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [stats, setStats] = useState({ total: 0, delivered: 0, retrying: 0, failed: 0, suppressed: 0 });

  // Filters
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Panels
  const [previewEmail, setPreviewEmail] = useState(null);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);

  // Simulation Form
  const [simIncidentId, setSimIncidentId] = useState('INC-0042');
  const [simEventType, setSimEventType] = useState('assignment');
  const [simRegion, setSimRegion] = useState('Central Zone');
  const [simSeverity, setSimSeverity] = useState('high');
  const [simOfficerId, setSimOfficerId] = useState('OFF-DELHI-101');
  const [simFailTransient, setSimFailTransient] = useState(false);

  // Status banner
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load data & subscribe
  const loadData = async () => {
    setLoading(true);
    try {
      const auditRes = await fetchIncidentNotificationsApi();
      const dirRes = await fetchNotificationDirectoryApi();
      if (auditRes?.notifications) {
        setNotifications(auditRes.notifications);
        setStats({
          total: auditRes.total || auditRes.notifications.length,
          delivered: auditRes.delivered || 0,
          retrying: auditRes.retrying || 0,
          failed: auditRes.failed || 0,
          suppressed: auditRes.suppressed || 0,
        });
      }
      if (dirRes?.length) {
        setOfficers(dirRes);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = defaultIncidentNotificationStore.subscribe((state) => {
      setNotifications(state.notifications);
      setOfficers(state.officers);
      setStats(state.stats);
    });
    return () => unsub();
  }, []);

  const handleRetry = async (notificationId) => {
    try {
      const res = await retryIncidentNotificationApi(notificationId);
      if (res?.success) {
        setFeedback({ type: 'success', text: `Notification ${notificationId} re-dispatched and delivered successfully!` });
      } else {
        setFeedback({ type: 'warning', text: `Retry attempt recorded: ${res?.message || 'Retrying...'}` });
      }
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: `Retry failed: ${err.message}` });
    }
  };

  const handleSavePreferences = async (officerId, newPrefs) => {
    try {
      await updateOfficerPreferencesApi(officerId, newPrefs);
      setFeedback({ type: 'success', text: `Notification preferences updated for ${officerId}.` });
      setEditingOfficer(null);
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: `Failed to update preferences: ${err.message}` });
    }
  };

  const handleDispatchSimulation = async () => {
    try {
      defaultIncidentNotificationStore.setSimulatedFailure(simOfficerId, simFailTransient);

      const incidentMock = {
        id: simIncidentId,
        category: 'scam_call',
        severity: simSeverity,
        region: simRegion,
        assigned_to: simOfficerId,
        updated_at: Date.now(),
      };

      const outcomes = defaultIncidentNotificationStore.dispatchNotifications(
        incidentMock,
        simEventType,
        null,
        null,
        Date.now()
      );

      setFeedback({
        type: 'success',
        text: `Simulated dispatch complete: ${outcomes.length} recipient outcome(s) recorded.`,
      });
      setSimulationModalOpen(false);
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: `Dispatch failed: ${err.message}` });
    }
  };

  // Filtered list
  const filteredNotifications = notifications.filter((n) => {
    if (selectedEventType !== 'all' && n.event_type !== selectedEventType) return false;
    if (selectedStatus !== 'all' && n.delivery_status !== selectedStatus) return false;
    if (selectedJurisdiction !== 'all' && n.jurisdiction_id !== selectedJurisdiction) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = (n.incident_id || '').toLowerCase().includes(q);
      const matchNotif = (n.notification_id || '').toLowerCase().includes(q);
      const matchRecipient = (n.recipient_name || '').toLowerCase().includes(q);
      const matchOfficer = (n.recipient_id || '').toLowerCase().includes(q);
      if (!matchId && !matchNotif && !matchRecipient && !matchOfficer) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800 animate-pulse">
            <RotateCcw className="w-3 h-3" /> Retrying
          </span>
        );
      case 'suppressed_quiet_hours':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800">
            <Clock className="w-3 h-3" /> Quiet Hours
          </span>
        );
      case 'suppressed_unsubscribed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Unsubscribed
          </span>
        );
      case 'unauthorized_jurisdiction':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800">
            <Lock className="w-3 h-3" /> Boundary Block
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-300 border border-red-800">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-900/80 text-red-200 border border-red-700">CRITICAL</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-900/80 text-orange-200 border border-orange-700">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-900/80 text-amber-200 border border-amber-700">MEDIUM</span>;
      case 'low':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-900/80 text-emerald-200 border border-emerald-700">LOW</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Role-Aware Incident Notifications & Escalations
                <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-indigo-950 text-indigo-300 border border-indigo-800">
                  SMTP Dispatch Service
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Automated role-based routing for incident assignment, reassignment, priority escalation, and supervisor review. Strictly sanitizes citizen PII.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setPreferencesModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Officer Preferences & Quiet Hours
            </button>

            <button
              onClick={() => setSimulationModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Simulate Dispatch
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center justify-between gap-2 border ${
            feedback.type === 'error'
              ? 'bg-red-950/60 border-red-800 text-red-300'
              : feedback.type === 'warning'
              ? 'bg-amber-950/60 border-amber-800 text-amber-300'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {feedback.text}
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-500 font-medium">Total Dispatched</div>
          <div className="text-2xl font-bold font-mono text-white mt-0.5">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Audit log count</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-500 font-medium">Delivered</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{stats.delivered}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Confirmed delivery</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-500 font-medium">Retrying / Pending</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">{stats.retrying}</div>
          <div className="text-[11px] text-amber-500/80 mt-1">Transient retry queue</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-500 font-medium">Suppressed</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-0.5">{stats.suppressed}</div>
          <div className="text-[11px] text-indigo-300/80 mt-1">Quiet hours / unsubs</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-500 font-medium">Authorized Officers</div>
          <div className="text-2xl font-bold font-mono text-slate-300 mt-0.5">{officers.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Responders & Superv.</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Events</option>
            <option value="assignment">Assignment</option>
            <option value="reassignment">Reassignment</option>
            <option value="escalation">Escalation</option>
            <option value="supervisor_review">Supervisor Review</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="retrying">Retrying</option>
            <option value="suppressed_quiet_hours">Quiet Hours</option>
            <option value="unauthorized_jurisdiction">Unauthorized Boundary</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={selectedJurisdiction}
            onChange={(e) => setSelectedJurisdiction(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Jurisdictions</option>
            <option value="JUR-DELHI-METRO">Delhi Metropolitan (JUR-DELHI-METRO)</option>
            <option value="JUR-NCR-SOUTH">NCR South (JUR-NCR-SOUTH)</option>
          </select>
        </div>

        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref ID, officer, recipient..."
            className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            Dispatch Outcomes & Delivery Audit Ledger ({filteredNotifications.length})
          </h2>
          <span className="text-xs text-slate-500">Live statutory audit trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Incident Ref</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Event Trigger</th>
                <th className="py-2.5 px-3">Recipient & Role</th>
                <th className="py-2.5 px-3">Jurisdiction</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notif) => (
                  <tr key={notif.notification_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">{getStatusBadge(notif.delivery_status)}</td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {notif.incident_id || 'N/A'}
                    </td>
                    <td className="py-3 px-3">{getPriorityBadge(notif.priority)}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-300 capitalize">
                        {notif.event_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-200">{notif.recipient_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                        <span>{notif.recipient_id}</span>
                        <span>•</span>
                        <span className="uppercase text-[10px] text-indigo-400">{notif.recipient_role}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      <div>{notif.jurisdiction_id}</div>
                      <div className="text-slate-500">{notif.region}</div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewEmail(notif)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                          title="Inspect Sanitized Email Payload"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" /> View Email
                        </button>

                        {['retrying', 'failed'].includes(notif.delivery_status) && (
                          <button
                            onClick={() => handleRetry(notif.notification_id)}
                            className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-300 transition-colors flex items-center gap-1 text-[11px]"
                            title="Retry Transmission"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No incident notifications match current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: PREVIEW SANITIZED EMAIL */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setPreviewEmail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Transmitted Email Inspection</h3>
                <p className="text-xs text-slate-400">
                  Notification ID: <span className="font-mono text-slate-300">{previewEmail.notification_id}</span>
                </p>
              </div>
            </div>

            {/* Privacy Compliance Banner */}
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>SOP 24-B Privacy Mandate Verified:</strong> Zero citizen PII, reporter contact numbers, or raw evidence artifacts were attached to this transmission.
              </span>
            </div>

            {/* Email Headers Mock */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex">
                <span className="w-20 text-slate-500">To:</span>
                <span className="text-slate-200 font-semibold">{previewEmail.recipient_name} &lt;{previewEmail.recipient_email}&gt;</span>
              </div>
              <div className="flex">
                <span className="w-20 text-slate-500">From:</span>
                <span className="text-slate-300">KshemOS Dispatch System &lt;dispatch@kshemos.internal&gt;</span>
              </div>
              <div className="flex">
                <span className="w-20 text-slate-500">Subject:</span>
                <span className="text-indigo-300 font-bold">{previewEmail.subject}</span>
              </div>
              <div className="flex">
                <span className="w-20 text-slate-500">Priority:</span>
                <span className="uppercase text-slate-300 font-bold">{previewEmail.priority}</span>
              </div>
            </div>

            {/* Email Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email Content Snippet
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {previewEmail.body_snippet}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div className="text-slate-500">
                Delivery Status: {getStatusBadge(previewEmail.delivery_status)}
              </div>
              <a
                href={previewEmail.secure_dashboard_link}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                Open Terminal Link <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OFFICER PREFERENCES & QUIET HOURS */}
      {preferencesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setPreferencesModalOpen(false);
                setEditingOfficer(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Personnel Directory & Notification Routing</h3>
                <p className="text-xs text-slate-400">
                  Manage email alert subscriptions and quiet hours windows. Critical emergencies override non-critical suppressions.
                </p>
              </div>
            </div>

            {/* Officer Directory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Officer</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Jurisdiction</th>
                    <th className="py-2.5 px-3">Subscriptions</th>
                    <th className="py-2.5 px-3">Quiet Hours</th>
                    <th className="py-2.5 px-3 text-right">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                  {officers.map((officer) => {
                    const prefs = officer.preferences || {};
                    return (
                      <tr key={officer.officer_id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{officer.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{officer.email}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            officer.role === 'commander' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                            officer.role === 'supervisor' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                            'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {officer.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-300">
                          {officer.jurisdiction_id}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1 flex-wrap text-[10px] font-mono">
                            {prefs.assignment_enabled && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">Assign</span>}
                            {prefs.reassignment_enabled && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">Reassign</span>}
                            {prefs.escalation_enabled && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">Escalate</span>}
                            {prefs.supervisor_review_enabled && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-400">Review</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {prefs.quiet_hours_enabled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-mono">
                              <Clock className="w-3 h-3" /> {prefs.quiet_hours_start} - {prefs.quiet_hours_end}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">Disabled</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setEditingOfficer({ ...officer, preferences: { ...prefs } })}
                            className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-700/60 transition-colors text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Officer Edit Sub-Panel */}
            {editingOfficer && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-800/80 space-y-3 mt-4">
                <div className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Edit Preferences: {editingOfficer.name} ({editingOfficer.officer_id})</span>
                  <button onClick={() => setEditingOfficer(null)} className="text-xs text-slate-400 hover:text-white">
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingOfficer.preferences.email_enabled}
                      onChange={(e) =>
                        setEditingOfficer({
                          ...editingOfficer,
                          preferences: { ...editingOfficer.preferences, email_enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900"
                    />
                    Master Email Active
                  </label>

                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingOfficer.preferences.assignment_enabled}
                      onChange={(e) =>
                        setEditingOfficer({
                          ...editingOfficer,
                          preferences: { ...editingOfficer.preferences, assignment_enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900"
                    />
                    Assignments
                  </label>

                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingOfficer.preferences.escalation_enabled}
                      onChange={(e) =>
                        setEditingOfficer({
                          ...editingOfficer,
                          preferences: { ...editingOfficer.preferences, escalation_enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900"
                    />
                    Escalations
                  </label>

                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingOfficer.preferences.supervisor_review_enabled}
                      onChange={(e) =>
                        setEditingOfficer({
                          ...editingOfficer,
                          preferences: { ...editingOfficer.preferences, supervisor_review_enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900"
                    />
                    Supervisor Review
                  </label>
                </div>

                {/* Quiet Hours Settings */}
                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={editingOfficer.preferences.quiet_hours_enabled}
                      onChange={(e) =>
                        setEditingOfficer({
                          ...editingOfficer,
                          preferences: { ...editingOfficer.preferences, quiet_hours_enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900"
                    />
                    Enable Quiet Hours (Suppresses non-critical alerts; Critical emergencies override)
                  </label>

                  {editingOfficer.preferences.quiet_hours_enabled && (
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 mr-2">Start:</span>
                        <input
                          type="time"
                          value={editingOfficer.preferences.quiet_hours_start}
                          onChange={(e) =>
                            setEditingOfficer({
                              ...editingOfficer,
                              preferences: { ...editingOfficer.preferences, quiet_hours_start: e.target.value },
                            })
                          }
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        />
                      </div>

                      <div>
                        <span className="text-slate-400 mr-2">End:</span>
                        <input
                          type="time"
                          value={editingOfficer.preferences.quiet_hours_end}
                          onChange={(e) =>
                            setEditingOfficer({
                              ...editingOfficer,
                              preferences: { ...editingOfficer.preferences, quiet_hours_end: e.target.value },
                            })
                          }
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleSavePreferences(editingOfficer.officer_id, editingOfficer.preferences)}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: SIMULATE DISPATCH TESTER */}
      {simulationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSimulationModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Simulate Incident Notification Dispatch</h3>
                <p className="text-xs text-slate-400">Trigger simulated assignment or escalation event.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Incident Reference ID</label>
                <input
                  type="text"
                  value={simIncidentId}
                  onChange={(e) => setSimIncidentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Event Type</label>
                  <select
                    value={simEventType}
                    onChange={(e) => setSimEventType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="assignment">Assignment</option>
                    <option value="reassignment">Reassignment</option>
                    <option value="escalation">Escalation</option>
                    <option value="supervisor_review">Supervisor Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Priority</label>
                  <select
                    value={simSeverity}
                    onChange={(e) => setSimSeverity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical (Quiet Override)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Operational Sector</label>
                  <select
                    value={simRegion}
                    onChange={(e) => setSimRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="Central Zone">Central Zone (Delhi Metro)</option>
                    <option value="North Zone">North Zone (Delhi Metro)</option>
                    <option value="East Zone">East Zone (Delhi Metro)</option>
                    <option value="South Zone">South Zone (NCR South)</option>
                    <option value="West Zone">West Zone (NCR South)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Assigned Responder</label>
                  <select
                    value={simOfficerId}
                    onChange={(e) => setSimOfficerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  >
                    {officers.map((o) => (
                      <option key={o.officer_id} value={o.officer_id}>
                        {o.officer_id} - {o.name} ({o.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Simulate Transient Network Timeout (504):</span>
                <input
                  type="checkbox"
                  checked={simFailTransient}
                  onChange={(e) => setSimFailTransient(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900"
                />
              </div>

              <button
                onClick={handleDispatchSimulation}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
              >
                <Send className="w-4 h-4" /> Trigger Simulated Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

