import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  Network,
  Clock,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  X,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  fetchMutualAidDataApi,
  declareMutualAidApi,
  deescalateDeclarationApi,
  delegateGuestUnitApi,
  revokeGuestUnitApi,
  createJointTaskforceApi,
  getJointTaskforceWorkspaceApi,
  logGuestActionApi,
  getSunsetAuditLogApi,
} from '../../api.js';

export default function MutualAidRebalanceView({ serviceAreas = [], incidents = [] }) {
  const [data, setData] = useState({
    declarations: [],
    guestDelegations: [],
    jointTaskforces: [],
    rebalanceEval: null,
    source: 'loading',
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview'); // overview, declarations, delegations, taskforces, audit
  const [sunsetLogs, setSunsetLogs] = useState([]);

  // Modals
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [showTaskforceModal, setShowTaskforceModal] = useState(false);
  const [activeTaskforceId, setActiveTaskforceId] = useState(null);
  const [taskforceWorkspace, setTaskforceWorkspace] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  // Form states
  const [declareForm, setDeclareForm] = useState({
    serviceAreaId: serviceAreas[0]?.id || 'SA-CENTRAL-01',
    requestedUnitsCount: 2,
    declaredBy: 'OFF-DIR-01',
    notes: '',
  });

  const [delegateForm, setDelegateForm] = useState({
    guestOfficerId: 'OFF-S2',
    homeJurisdictionId: 'JUR-NCR-SOUTH',
    borrowingJurisdictionId: 'JUR-DELHI-METRO',
    targetServiceAreaId: 'SA-CENTRAL-01',
    authorizedBy: 'OFF-DIR-01',
    durationHours: 8,
    declarationId: '',
    notes: 'Reinforcement for digital arrest surge in borrowed sector',
  });

  const [taskforceForm, setTaskforceForm] = useState({
    name: 'Delhi-Gurugram Interstate Cyber Strike Group',
    leadJurisdictionId: 'JUR-DELHI-METRO',
    participatingJurisdictionIds: ['JUR-DELHI-METRO', 'JUR-NCR-SOUTH'],
    monitoredRegions: ['Central Zone', 'South Zone'],
    activeTaskforceOfficers: ['OFF-DIR-01', 'OFF-S1', 'OFF-C1'],
    targetSyndicateTags: ['digital_arrest', 'mule_network'],
    notes: 'Joint inter-jurisdictional syndicate takedown operation',
  });

  const [actionMessage, setActionMessage] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetchMutualAidDataApi(incidents, serviceAreas);
      setData(res);
      const sunsets = await getSunsetAuditLogApi();
      setSunsetLogs(sunsets || []);
    } catch (e) {
      console.error('Failed to load mutual aid data:', e);
    } finally {
      setLoading(false);
    }
  }, [incidents, serviceAreas]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle drill down into a taskforce workspace
  async function openTaskforceWorkspace(taskforceId) {
    setActiveTaskforceId(taskforceId);
    setLoadingWorkspace(true);
    try {
      const ws = await getJointTaskforceWorkspaceApi(taskforceId, incidents);
      setTaskforceWorkspace(ws);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWorkspace(false);
    }
  }

  // Handle Declaration Submit
  async function handleDeclareMutualAid(e) {
    e.preventDefault();
    try {
      const sa = serviceAreas.find((s) => s.id === declareForm.serviceAreaId);
      await declareMutualAidApi({
        serviceAreaId: declareForm.serviceAreaId,
        serviceAreaName: sa?.name || declareForm.serviceAreaId,
        region: sa?.region || 'Central Zone',
        jurisdictionId: sa?.jurisdiction_id || 'JUR-DELHI-METRO',
        declaredBy: declareForm.declaredBy,
        requestedUnitsCount: Number(declareForm.requestedUnitsCount),
        notes: declareForm.notes,
      });
      setShowDeclareModal(false);
      setActionMessage('Mutual Aid Declaration officially broadcast to adjacent commands.');
      await loadData();
    } catch (err) {
      alert(`Declaration failed: ${err.message}`);
    }
  }

  // Handle De-escalate
  async function handleDeescalate(decId) {
    if (!window.confirm('De-escalate this mutual aid declaration and sunset linked guest delegations?')) return;
    try {
      await deescalateDeclarationApi(decId, 'Workload stabilized by commander order');
      setActionMessage(`Declaration ${decId} successfully de-escalated and guest delegations sunset.`);
      await loadData();
    } catch (err) {
      alert(`De-escalation failed: ${err.message}`);
    }
  }

  // Handle Delegate Guest Officer
  async function handleDelegateGuest(e) {
    e.preventDefault();
    try {
      const sa = serviceAreas.find((s) => s.id === delegateForm.targetServiceAreaId);
      await delegateGuestUnitApi({
        guestOfficerId: delegateForm.guestOfficerId,
        homeJurisdictionId: delegateForm.homeJurisdictionId,
        borrowingJurisdictionId: delegateForm.borrowingJurisdictionId,
        targetServiceAreaId: delegateForm.targetServiceAreaId,
        targetRegion: sa?.region || 'Central Zone',
        authorizedBy: delegateForm.authorizedBy,
        durationHours: Number(delegateForm.durationHours),
        declarationId: delegateForm.declarationId || null,
        notes: delegateForm.notes,
      });
      setShowDelegateModal(false);
      setActionMessage(`Officer ${delegateForm.guestOfficerId} deployed on temporary guest duty. Permanent roster preserved.`);
      await loadData();
    } catch (err) {
      alert(`Delegation failed: ${err.message}`);
    }
  }

  // Handle Revoke Guest Officer
  async function handleRevokeDelegation(delId, officerId) {
    if (!window.confirm(`Revoke guest assignment for ${officerId} and return to home command?`)) return;
    try {
      await revokeGuestUnitApi(delId, {
        revokedBy: 'COMMANDING_OFFICER',
        reason: 'Workload re-stabilized; returning officer to home jurisdiction precinct',
      });
      setActionMessage(`Delegation ${delId} revoked. Officer ${officerId} returned to home roster.`);
      await loadData();
    } catch (err) {
      alert(`Revocation failed: ${err.message}`);
    }
  }

  // Handle Create Taskforce
  async function handleCreateTaskforce(e) {
    e.preventDefault();
    try {
      await createJointTaskforceApi(taskforceForm);
      setShowTaskforceModal(false);
      setActionMessage(`Joint Taskforce "${taskforceForm.name}" activated.`);
      await loadData();
    } catch (err) {
      alert(`Failed to activate taskforce: ${err.message}`);
    }
  }

  const sectors = data.rebalanceEval?.sectors || [];
  const recommendations = data.rebalanceEval?.recommendations || [];
  const activeDeclarations = data.declarations?.filter((d) => d.status === 'active' || d.status === 'partially_fulfilled') || [];
  const activeGuests = data.guestDelegations?.filter((g) => g.status === 'active') || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[var(--cream)]">
              Cross-Jurisdiction Mutual Aid & Resource Rebalancing
            </h2>
            <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-full border border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
              Interstate Command Link
            </span>
          </div>
          <p className="text-xs text-[var(--mist)] mt-1">
            Automated 150% capacity surge triggers, temporary guest unit dispatch delegations, and joint syndicate taskforces across adjacent jurisdictions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeclareModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--alert)]/20 text-[var(--alert)] border border-[var(--alert)]/30 hover:bg-[var(--alert)]/30 transition-colors"
          >
            <ShieldAlert size={14} />
            Declare Mutual Aid
          </button>

          <button
            onClick={() => setShowDelegateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--saffron)]/20 text-[var(--saffron)] border border-[var(--saffron)]/30 hover:bg-[var(--saffron)]/30 transition-colors"
          >
            <Users size={14} />
            Deploy Guest Officer
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400/60 hover:text-emerald-400">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)]">
          <div className="text-xs text-[var(--mist)] font-medium">Overloaded Sectors (&gt;150%)</div>
          <div className="text-2xl font-bold font-mono mt-1 text-[var(--alert)]">
            {sectors.filter((s) => s.is_overloaded_150).length}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-1">Requiring adjacent aid</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)]">
          <div className="text-xs text-[var(--mist)] font-medium">Active Mutual Aid Declarations</div>
          <div className="text-2xl font-bold font-mono mt-1 text-[var(--saffron)]">
            {activeDeclarations.length}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-1">Cross-jurisdiction reinforcement</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)]">
          <div className="text-xs text-[var(--mist)] font-medium">Borrowed Guest Officers on Duty</div>
          <div className="text-2xl font-bold font-mono mt-1 text-indigo-400">
            {activeGuests.length}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-1">Permanent rosters preserved</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)]">
          <div className="text-xs text-[var(--mist)] font-medium">Joint Syndicate Taskforces</div>
          <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">
            {data.jointTaskforces?.length || 0}
          </div>
          <div className="text-[11px] text-[var(--mist)] mt-1">Multi-zone strike desks</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[var(--navy-line)] gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveSection('overview')}
          className={`pb-2 px-3 font-semibold transition-colors border-b-2 ${
            activeSection === 'overview'
              ? 'border-[var(--saffron)] text-[var(--cream)]'
              : 'border-transparent text-[var(--mist)] hover:text-[var(--cream)]'
          }`}
        >
          Sector Workload &amp; Dynamic Rebalancing ({recommendations.length})
        </button>

        <button
          onClick={() => setActiveSection('declarations')}
          className={`pb-2 px-3 font-semibold transition-colors border-b-2 ${
            activeSection === 'declarations'
              ? 'border-[var(--saffron)] text-[var(--cream)]'
              : 'border-transparent text-[var(--mist)] hover:text-[var(--cream)]'
          }`}
        >
          Mutual Aid Declarations ({data.declarations?.length || 0})
        </button>

        <button
          onClick={() => setActiveSection('delegations')}
          className={`pb-2 px-3 font-semibold transition-colors border-b-2 ${
            activeSection === 'delegations'
              ? 'border-[var(--saffron)] text-[var(--cream)]'
              : 'border-transparent text-[var(--mist)] hover:text-[var(--cream)]'
          }`}
        >
          Guest Officer Delegations ({activeGuests.length})
        </button>

        <button
          onClick={() => setActiveSection('taskforces')}
          className={`pb-2 px-3 font-semibold transition-colors border-b-2 ${
            activeSection === 'taskforces'
              ? 'border-[var(--saffron)] text-[var(--cream)]'
              : 'border-transparent text-[var(--mist)] hover:text-[var(--cream)]'
          }`}
        >
          Joint Taskforce Workspaces ({data.jointTaskforces?.length || 0})
        </button>

        <button
          onClick={() => setActiveSection('audit')}
          className={`pb-2 px-3 font-semibold transition-colors border-b-2 ${
            activeSection === 'audit'
              ? 'border-[var(--saffron)] text-[var(--cream)]'
              : 'border-transparent text-[var(--mist)] hover:text-[var(--cream)]'
          }`}
        >
          Sunset &amp; Action Audit Trail ({sunsetLogs.length})
        </button>
      </div>

      {/* SECTION 1: OVERVIEW & SECTOR WORKLOAD MATRIX */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Overload Alert Notification */}
          {sectors.some((s) => s.is_overloaded_150) && (
            <div className="p-4 rounded-lg bg-[var(--alert)]/10 border border-[var(--alert)]/30 flex items-start gap-3">
              <ShieldAlert className="text-[var(--alert)] shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-sm font-bold text-[var(--alert)]">
                  AUTOMATED SURGE TRIGGER ACTIVE: Operational Workload Exceeds 150% Capacity
                </h4>
                <p className="text-xs text-[var(--mist)] mt-1">
                  KshemOS capacity monitors detected critical workload surge. Reinforcement recommendations have been automatically generated matching donor sectors in adjacent partner jurisdictions (JUR-NCR-SOUTH &harr; JUR-DELHI-METRO).
                </p>
              </div>
            </div>
          )}

          {/* Sectors Matrix Table */}
          <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)]">
            <h3 className="text-sm font-bold text-[var(--cream)] mb-3">Sector Capacity &amp; Pressure Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--navy-line)] text-[var(--mist)] font-mono uppercase">
                    <th className="py-2 px-3">Service Area</th>
                    <th className="py-2 px-3">Jurisdiction</th>
                    <th className="py-2 px-3">Workload / Cap</th>
                    <th className="py-2 px-3">Load Ratio</th>
                    <th className="py-2 px-3">Active Guests</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--navy-line)]/50">
                  {sectors.map((s) => {
                    const ratioPercent = Math.round(s.workload_ratio * 100);
                    const isOver = s.is_overloaded_150;
                    const isSurplus = s.has_surplus_capacity;

                    return (
                      <tr key={s.service_area_id} className="hover:bg-[var(--navy-line)]/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[var(--cream)]">{s.service_area_name}</div>
                          <div className="text-[11px] text-[var(--mist)]">{s.region} ({s.service_area_id})</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-300">
                          {s.jurisdiction_id}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className={isOver ? 'text-[var(--alert)] font-bold' : 'text-[var(--cream)]'}>
                            {s.workload_points} pts
                          </span>
                          <span className="text-[var(--mist)]"> / {s.capacity_limit_points} cap</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isOver ? 'bg-[var(--alert)]' : isSurplus ? 'bg-emerald-500' : 'bg-[var(--saffron)]'
                                }`}
                                style={{ width: `${Math.min(100, ratioPercent)}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs ${isOver ? 'text-[var(--alert)] font-bold' : 'text-[var(--cream)]'}`}>
                              {ratioPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {s.guest_units_count > 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
                              <Users size={11} /> +{s.guest_units_count} Guest Unit(s)
                            </span>
                          ) : (
                            <span className="text-[var(--mist)] text-[11px]">Roster standard</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isOver ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-[var(--alert)] bg-[var(--alert)]/10 px-2 py-0.5 rounded border border-[var(--alert)]/30">
                              <AlertTriangle size={11} /> Surge (150%+)
                            </span>
                          ) : isSurplus ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                              <CheckCircle2 size={11} /> Surplus Donor
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] uppercase text-[var(--mist)] bg-gray-800/50 px-2 py-0.5 rounded">
                              Nominal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Rebalancing Recommendations */}
          <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[var(--saffron)]" />
                <h3 className="text-sm font-bold text-[var(--cream)]">
                  Dynamic Resource Rebalancing Recommendations
                </h3>
              </div>
              <span className="text-xs text-[var(--mist)] font-mono">
                AI Capacity Rebalancer v2.4
              </span>
            </div>

            {recommendations.length === 0 ? (
              <p className="text-xs text-[var(--mist)] py-4 text-center">
                All sectors are balanced within operational thresholds. No dynamic reinforcements currently required.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.recommendation_id}
                    className="p-3.5 rounded border border-indigo-500/30 bg-indigo-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--saffron)]">
                          {rec.recommendation_id}
                        </span>
                        <span className="text-xs text-[var(--cream)] font-medium">
                          Deploy {rec.recommended_units} unit(s) from <span className="font-mono text-indigo-300">{rec.donor_jurisdiction_id}</span> to <span className="font-mono text-indigo-300">{rec.overloaded_region}</span>
                        </span>
                      </div>
                      <ul className="text-xs text-[var(--mist)] space-y-0.5 list-disc list-inside">
                        {rec.rationales.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        setDelegateForm((prev) => ({
                          ...prev,
                          borrowingJurisdictionId: 'JUR-DELHI-METRO',
                          homeJurisdictionId: rec.donor_jurisdiction_id,
                          targetServiceAreaId: rec.overloaded_service_area_id,
                          notes: `Rebalancing deployment per recommendation ${rec.recommendation_id}`,
                        }));
                        setShowDelegateModal(true);
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--saffron)] text-black font-semibold text-xs hover:bg-[var(--saffron)]/90 transition-colors"
                    >
                      <ArrowRightLeft size={13} />
                      Authorize &amp; Deploy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: MUTUAL AID DECLARATIONS */}
      {activeSection === 'declarations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--cream)]">
              Formal Mutual Aid Reinforcement Declarations
            </h3>
            <button
              onClick={() => setShowDeclareModal(true)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-[var(--saffron)] text-black hover:bg-[var(--saffron)]/90 transition-colors"
            >
              <Plus size={13} />
              Declare Mutual Aid
            </button>
          </div>

          <div className="grid gap-3">
            {data.declarations?.map((dec) => {
              const isActive = dec.status === 'active' || dec.status === 'partially_fulfilled';
              return (
                <div
                  key={dec.id}
                  className={`p-4 rounded-lg border ${
                    isActive
                      ? 'border-[var(--alert)]/40 bg-[var(--alert)]/5'
                      : 'border-[var(--navy-line)] bg-[var(--navy-subtle)] opacity-75'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--navy-line)]/40 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--cream)]">{dec.id}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          dec.trigger_type === 'automatic_threshold'
                            ? 'border-[var(--alert)]/40 text-[var(--alert)] bg-[var(--alert)]/10'
                            : 'border-[var(--saffron)]/40 text-[var(--saffron)] bg-[var(--saffron)]/10'
                        }`}
                      >
                        {dec.trigger_type === 'automatic_threshold' ? '🤖 150% Auto Surge' : '👮 Commander Manual'}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                          isActive
                            ? 'text-[var(--alert)] bg-[var(--alert)]/20 font-bold'
                            : 'text-[var(--safe)] bg-[var(--safe)]/20'
                        }`}
                      >
                        {dec.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-[var(--mist)] flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(dec.declared_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-[var(--mist)]">Requesting Command:</span>
                      <div className="font-mono text-indigo-300 font-semibold">{dec.requesting_jurisdiction_id}</div>
                    </div>
                    <div>
                      <span className="text-[var(--mist)]">Overloaded Zone:</span>
                      <div className="text-[var(--cream)] font-semibold">{dec.region}</div>
                    </div>
                    <div>
                      <span className="text-[var(--mist)]">Workload Pressure:</span>
                      <div className="font-mono text-[var(--alert)] font-semibold">
                        {dec.workload_points} pts ({Math.round(dec.workload_ratio * 100)}%)
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--mist)]">Units Requested:</span>
                      <div className="font-mono text-[var(--cream)] font-semibold">{dec.requested_units_count} units</div>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--mist)] bg-black/20 p-2 rounded mb-3">
                    {dec.notes}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="text-[var(--mist)]">
                      Target Adjacent Commands:{' '}
                      <span className="font-mono text-indigo-300">
                        {dec.target_neighbor_jurisdictions?.join(', ')}
                      </span>
                    </div>

                    {isActive && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setDelegateForm((prev) => ({
                              ...prev,
                              declarationId: dec.id,
                              borrowingJurisdictionId: dec.requesting_jurisdiction_id,
                              targetServiceAreaId: dec.service_area_id,
                            }));
                            setShowDelegateModal(true);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30"
                        >
                          Provide Reinforcement
                        </button>
                        <button
                          onClick={() => handleDeescalate(dec.id)}
                          className="px-2.5 py-1 text-xs rounded bg-gray-800 text-[var(--mist)] hover:text-white"
                        >
                          De-escalate &amp; Sunset
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: TEMPORARY GUEST UNIT DELEGATIONS */}
      {activeSection === 'delegations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--cream)]">
                Temporary Guest Unit Access Roster
              </h3>
              <p className="text-xs text-[var(--mist)]">
                Officers dispatched into adjacent zones with time-bounded permissions. Permanent rosters and base command assignments remain untouched.
              </p>
            </div>
            <button
              onClick={() => setShowDelegateModal(true)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-[var(--saffron)] text-black hover:bg-[var(--saffron)]/90 transition-colors"
            >
              <Plus size={13} />
              Deploy Guest Officer
            </button>
          </div>

          <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--navy-line)] text-[var(--mist)] font-mono uppercase">
                  <th className="py-2 px-3">Officer Code</th>
                  <th className="py-2 px-3">Home Command (Preserved)</th>
                  <th className="py-2 px-3">Borrowing Zone</th>
                  <th className="py-2 px-3">Authorized By</th>
                  <th className="py-2 px-3">Window Remaining</th>
                  <th className="py-2 px-3">Permissions</th>
                  <th className="py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--navy-line)]/50">
                {data.guestDelegations?.map((deleg) => {
                  const now = Date.now();
                  const remainingMs = Math.max(0, deleg.valid_until - now);
                  const remainingHours = (remainingMs / (1000 * 3600)).toFixed(1);
                  const isExpired = remainingMs === 0;

                  return (
                    <tr key={deleg.delegation_id} className="hover:bg-[var(--navy-line)]/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-[var(--cream)]">{deleg.guest_officer_id}</div>
                        <div className="text-[10px] text-[var(--mist)]">{deleg.delegation_id}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-indigo-300 font-semibold">{deleg.home_jurisdiction_id}</span>
                        <div className="text-[10px] text-[var(--mist)]">Station: {deleg.home_service_area_id}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[var(--cream)]">{deleg.target_region}</span>
                        <div className="text-[10px] text-[var(--mist)] font-mono">{deleg.borrowing_jurisdiction_id}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[var(--mist)]">
                        {deleg.authorized_by}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {deleg.status === 'active' && !isExpired ? (
                          <span className="text-emerald-400 font-bold">{remainingHours} hrs left</span>
                        ) : (
                          <span className="text-[var(--mist)]">{deleg.status}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {deleg.permissions?.map((p) => (
                            <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-[var(--mist)]">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {deleg.status === 'active' ? (
                          <button
                            onClick={() => handleRevokeDelegation(deleg.delegation_id, deleg.guest_officer_id)}
                            className="px-2 py-0.5 text-[11px] rounded bg-[var(--alert)]/20 text-[var(--alert)] border border-[var(--alert)]/30 hover:bg-[var(--alert)]/30"
                          >
                            Revoke / Sunset
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--mist)] italic">Decommissioned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: JOINT TASKFORCE WORKSPACES */}
      {activeSection === 'taskforces' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--cream)]">
                Joint Taskforce Workspaces (Multi-Jurisdiction Syndicate Operations)
              </h3>
              <p className="text-xs text-[var(--mist)]">
                Aggregated signals across participating precincts for interstate fraud syndicates and mule ring takedowns.
              </p>
            </div>
            <button
              onClick={() => setShowTaskforceModal(true)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-[var(--saffron)] text-black hover:bg-[var(--saffron)]/90 transition-colors"
            >
              <Plus size={13} />
              New Joint Taskforce
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {data.jointTaskforces?.map((jtf) => (
              <div
                key={jtf.id}
                className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)] space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-400">{jtf.id}</span>
                    <h4 className="text-sm font-bold text-[var(--cream)] mt-0.5">{jtf.name}</h4>
                  </div>
                  <span className="font-mono text-[10px] uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    {jtf.status}
                  </span>
                </div>

                <p className="text-xs text-[var(--mist)]">{jtf.notes}</p>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-[var(--navy-line)]/50 py-2">
                  <div>
                    <span className="text-[var(--mist)]">Lead Command:</span>
                    <div className="font-mono text-indigo-300 font-semibold">{jtf.lead_jurisdiction_id}</div>
                  </div>
                  <div>
                    <span className="text-[var(--mist)]">Participating:</span>
                    <div className="font-mono text-[var(--cream)]">{jtf.participating_jurisdiction_ids?.join(', ')}</div>
                  </div>
                  <div>
                    <span className="text-[var(--mist)]">Monitored Zones:</span>
                    <div className="text-[var(--cream)] font-medium">{jtf.monitored_regions?.join(', ')}</div>
                  </div>
                  <div>
                    <span className="text-[var(--mist)]">Tactical Roster:</span>
                    <div className="font-mono text-[var(--mist)]">{jtf.active_taskforce_officers?.join(', ')}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1 flex-wrap">
                    {jtf.target_syndicate_tags?.map((t) => (
                      <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => openTaskforceWorkspace(jtf.id)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                  >
                    <Network size={13} />
                    Open Workspace
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Drill-down Taskforce Workspace Details Modal/Drawer */}
          {activeTaskforceId && taskforceWorkspace && (
            <div className="p-5 rounded-lg border-2 border-indigo-500/40 bg-[var(--navy-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
                <div className="flex items-center gap-2">
                  <Network className="text-indigo-400" size={20} />
                  <div>
                    <h3 className="text-base font-bold text-[var(--cream)]">
                      {taskforceWorkspace.taskforce?.name} &middot; Syndicate Intelligence Feed
                    </h3>
                    <p className="text-xs text-[var(--mist)]">
                      Aggregating signals across {taskforceWorkspace.aggregated_metrics?.monitored_regions_count} zones
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTaskforceId(null);
                    setTaskforceWorkspace(null);
                  }}
                  className="text-[var(--mist)] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Aggregated KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded bg-black/20 border border-[var(--navy-line)]">
                  <div className="text-[11px] text-[var(--mist)]">Combined Active Incidents</div>
                  <div className="text-lg font-bold font-mono text-[var(--cream)]">
                    {taskforceWorkspace.aggregated_metrics?.active_incidents}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20 border border-[var(--navy-line)]">
                  <div className="text-[11px] text-[var(--mist)]">Critical Urgency Cases</div>
                  <div className="text-lg font-bold font-mono text-[var(--alert)]">
                    {taskforceWorkspace.aggregated_metrics?.critical_incidents}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20 border border-[var(--navy-line)]">
                  <div className="text-[11px] text-[var(--mist)]">Interstate Mule Links</div>
                  <div className="text-lg font-bold font-mono text-[var(--saffron)]">
                    {taskforceWorkspace.aggregated_metrics?.cross_zone_syndicates_detected}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20 border border-[var(--navy-line)]">
                  <div className="text-[11px] text-[var(--mist)]">Guest Units Active in Grid</div>
                  <div className="text-lg font-bold font-mono text-indigo-400">
                    {taskforceWorkspace.aggregated_metrics?.active_guest_units_in_regions}
                  </div>
                </div>
              </div>

              {/* Cross-Zone Syndicate Accounts */}
              {taskforceWorkspace.cross_zone_syndicate_accounts?.length > 0 && (
                <div className="p-3.5 rounded bg-[var(--alert)]/5 border border-[var(--alert)]/30 space-y-2">
                  <h4 className="text-xs font-bold text-[var(--alert)] flex items-center gap-1.5">
                    <ShieldAlert size={14} />
                    Cross-Jurisdiction Syndicate Mule Accounts Flagged
                  </h4>
                  <div className="space-y-1">
                    {taskforceWorkspace.cross_zone_syndicate_accounts.map((mule) => (
                      <div key={mule.account_id} className="text-xs flex items-center justify-between">
                        <span className="font-mono text-[var(--cream)] font-bold">{mule.account_id}</span>
                        <span className="text-[var(--mist)]">
                          Active in: <span className="text-[var(--saffron)]">{mule.regions.join(' & ')}</span> ({mule.incident_count} reports)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: SUNSET & ACTION AUDIT TRAIL */}
      {activeSection === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--cream)]">
              Master Cross-Zone Audit Ledger &amp; Automatic Sunset Log
            </h3>
            <span className="text-xs text-[var(--mist)] font-mono">
              Immutable officer action trail
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[var(--navy-subtle)] border border-[var(--navy-line)] space-y-2">
            {sunsetLogs.length === 0 ? (
              <p className="text-xs text-[var(--mist)] py-4 text-center">No sunset events recorded yet.</p>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {sunsetLogs.map((log) => (
                  <div
                    key={log.audit_id}
                    className="p-2.5 rounded bg-black/20 border border-[var(--navy-line)]/50 flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--saffron)] font-bold">{log.audit_id}</span>
                        <span className="text-[var(--cream)] font-semibold">
                          Officer {log.guest_officer_id} ({log.home_jurisdiction_id} &rarr; {log.borrowing_jurisdiction_id || log.target_region})
                        </span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-800 text-[var(--mist)]">
                          {log.sunset_reason}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--mist)] mt-0.5 font-sans">
                        {log.details}
                      </p>
                    </div>
                    <div className="text-[11px] text-[var(--mist)] shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: DECLARE MUTUAL AID */}
      {showDeclareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[var(--navy-surface)] border border-[var(--navy-line)] rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="text-base font-bold text-[var(--cream)] flex items-center gap-2">
                <ShieldAlert className="text-[var(--alert)]" size={18} />
                Declare Mutual Aid Reinforcement
              </h3>
              <button onClick={() => setShowDeclareModal(false)} className="text-[var(--mist)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeclareMutualAid} className="space-y-3 text-xs">
              <div>
                <label className="text-[var(--mist)] block mb-1">Target Service Area (Surge Sector):</label>
                <select
                  value={declareForm.serviceAreaId}
                  onChange={(e) => setDeclareForm({ ...declareForm, serviceAreaId: e.target.value })}
                  className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                >
                  {serviceAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name} ({sa.region} - {sa.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--mist)] block mb-1">Reinforcement Units Needed:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={declareForm.requestedUnitsCount}
                    onChange={(e) => setDeclareForm({ ...declareForm, requestedUnitsCount: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                  />
                </div>
                <div>
                  <label className="text-[var(--mist)] block mb-1">Commanding Officer Code:</label>
                  <input
                    type="text"
                    value={declareForm.declaredBy}
                    onChange={(e) => setDeclareForm({ ...declareForm, declaredBy: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[var(--mist)] block mb-1">Operational Justification &amp; Notes:</label>
                <textarea
                  rows="3"
                  value={declareForm.notes}
                  onChange={(e) => setDeclareForm({ ...declareForm, notes: e.target.value })}
                  placeholder="Detail cause of workload surge (e.g. multi-caller digital arrest ring, ATM jackpotting)"
                  className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeclareModal(false)}
                  className="px-4 py-2 rounded bg-gray-800 text-[var(--mist)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[var(--alert)] text-white font-semibold hover:bg-[var(--alert)]/90"
                >
                  Broadcast Declaration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DEPLOY GUEST OFFICER */}
      {showDelegateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[var(--navy-surface)] border border-[var(--navy-line)] rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="text-base font-bold text-[var(--cream)] flex items-center gap-2">
                <Users className="text-indigo-400" size={18} />
                Deploy Temporary Guest Unit
              </h3>
              <button onClick={() => setShowDelegateModal(false)} className="text-[var(--mist)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDelegateGuest} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--mist)] block mb-1">Guest Officer Badge ID:</label>
                  <input
                    type="text"
                    value={delegateForm.guestOfficerId}
                    onChange={(e) => setDelegateForm({ ...delegateForm, guestOfficerId: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[var(--mist)] block mb-1">Time Window (Hours):</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={delegateForm.durationHours}
                    onChange={(e) => setDelegateForm({ ...delegateForm, durationHours: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--mist)] block mb-1">Home Command (Preserved):</label>
                  <select
                    value={delegateForm.homeJurisdictionId}
                    onChange={(e) => setDelegateForm({ ...delegateForm, homeJurisdictionId: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                  >
                    <option value="JUR-NCR-SOUTH">JUR-NCR-SOUTH (Gurugram/South)</option>
                    <option value="JUR-DELHI-METRO">JUR-DELHI-METRO (Delhi Central)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[var(--mist)] block mb-1">Borrowing Command:</label>
                  <select
                    value={delegateForm.borrowingJurisdictionId}
                    onChange={(e) => setDelegateForm({ ...delegateForm, borrowingJurisdictionId: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                  >
                    <option value="JUR-DELHI-METRO">JUR-DELHI-METRO</option>
                    <option value="JUR-NCR-SOUTH">JUR-NCR-SOUTH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[var(--mist)] block mb-1">Deploy to Service Area:</label>
                <select
                  value={delegateForm.targetServiceAreaId}
                  onChange={(e) => setDelegateForm({ ...delegateForm, targetServiceAreaId: e.target.value })}
                  className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                >
                  {serviceAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name} ({sa.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[var(--mist)] block mb-1">Dispatch Notes:</label>
                <input
                  type="text"
                  value={delegateForm.notes}
                  onChange={(e) => setDelegateForm({ ...delegateForm, notes: e.target.value })}
                  className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelegateModal(false)}
                  className="px-4 py-2 rounded bg-gray-800 text-[var(--mist)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-500"
                >
                  Authorize Delegation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE JOINT TASKFORCE */}
      {showTaskforceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[var(--navy-surface)] border border-[var(--navy-line)] rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h3 className="text-base font-bold text-[var(--cream)] flex items-center gap-2">
                <Network className="text-emerald-400" size={18} />
                Activate Joint Strike Taskforce
              </h3>
              <button onClick={() => setShowTaskforceModal(false)} className="text-[var(--mist)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTaskforce} className="space-y-3 text-xs">
              <div>
                <label className="text-[var(--mist)] block mb-1">Taskforce Name:</label>
                <input
                  type="text"
                  value={taskforceForm.name}
                  onChange={(e) => setTaskforceForm({ ...taskforceForm, name: e.target.value })}
                  className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--mist)] block mb-1">Lead Command:</label>
                  <select
                    value={taskforceForm.leadJurisdictionId}
                    onChange={(e) => setTaskforceForm({ ...taskforceForm, leadJurisdictionId: e.target.value })}
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                  >
                    <option value="JUR-DELHI-METRO">JUR-DELHI-METRO</option>
                    <option value="JUR-NCR-SOUTH">JUR-NCR-SOUTH</option>
                  </select>
                </div>
                <div>
                  <label className="text-[var(--mist)] block mb-1">Monitored Zones:</label>
                  <input
                    type="text"
                    value={taskforceForm.monitoredRegions.join(', ')}
                    onChange={(e) =>
                      setTaskforceForm({
                        ...taskforceForm,
                        monitoredRegions: e.target.value.split(',').map((r) => r.trim()),
                      })
                    }
                    className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[var(--mist)] block mb-1">Assigned Tactical Officers:</label>
                <input
                  type="text"
                  value={taskforceForm.activeTaskforceOfficers.join(', ')}
                  onChange={(e) =>
                    setTaskforceForm({
                      ...taskforceForm,
                      activeTaskforceOfficers: e.target.value.split(',').map((o) => o.trim()),
                    })
                  }
                  className="w-full bg-[var(--navy-subtle)] border border-[var(--navy-line)] rounded px-3 py-2 text-[var(--cream)] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskforceModal(false)}
                  className="px-4 py-2 rounded bg-gray-800 text-[var(--mist)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                >
                  Activate Taskforce
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

