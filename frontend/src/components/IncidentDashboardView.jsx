import { useMemo, useRef, useState } from 'react';

import { Clock, Inbox, Radio, WifiOff, ShieldAlert, Users, Network, ArrowRightLeft, X, Filter, RotateCcw } from 'lucide-react';
import MutualAidRebalanceView from './jurisdiction/MutualAidRebalanceView';
import IncidentNotificationConsole from './incidentDashboard/IncidentNotificationConsole';
import { Mail } from 'lucide-react';

import {

  getSyncQueue,

  setRegionStaffing,

  updateIncident,

} from '../api';

import {

  CASE_CAPACITY_PER_OFFICER,

  SEVERITY_WEIGHT,

  filterIncidents,

  getDashboardSnapshot,

} from '../incidentDashboard';

import { formatClock } from './incidentDashboard/display';

import { Panel, StatTile } from './incidentDashboard/ui';

import SeverityRegionTable from './incidentDashboard/SeverityRegionTable';

import EscalationList from './incidentDashboard/EscalationList';

import CoverageTable from './incidentDashboard/CoverageTable';

import IncidentDetail from './incidentDashboard/IncidentDetail';

import useIncidentFeed, { POLL_MS } from './incidentDashboard/useIncidentFeed';

import { FilterChips, IncidentList } from './incidentDashboard/CaseList';

import SyncStatusBanner from './incidentDashboard/SyncStatusBanner';

import SyncQueueDrawer from './incidentDashboard/SyncQueueDrawer';

import ConflictResolutionModal from './incidentDashboard/ConflictResolutionModal';



const NO_FILTERS = { region: null, severity: null, escalatingOnly: false, unassignedOnly: false, query: '' };



function FeedStatus({ source, now, error }) {

  const live = source === 'backend';

  const _offline = source === 'offline' || source === 'cached_offline' || source === 'local';



  return (

    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mist)]">

      <span className="inline-flex items-center gap-1">

        <Clock size={12} aria-hidden="true" />

        Updated {formatClock(now)} · refreshes every {POLL_MS / 1000}s

      </span>

      {error ? (

        <span className="text-[var(--alert)]">Feed warning: {error}</span>

      ) : (

        <span

          className={`inline-flex items-center gap-1 font-mono uppercase tracking-wide border rounded-full px-2 py-0.5 ${

            live

              ? 'border-[var(--safe)] text-[var(--safe)]'

              : 'border-[var(--caution)] text-[var(--caution)]'

          }`}

          title={

            live

              ? 'Incidents come from the KshemOS backend and are synchronized with all field units.'

              : 'Field offline mode: Incidents are cached locally in this browser. Queued changes will sync once connection restores.'

          }

        >

          {live ? <Radio size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}

          {live ? 'Live · HQ Synced Feed' : 'Field Mode · Local Cache Active'}

        </span>

      )}

    </div>

  );

}



export default function IncidentDashboardView() {

  const { feed, error, now, refresh } = useIncidentFeed();

  const [filters, setFilters] = useState(NO_FILTERS);

  const [selectedId, setSelectedId] = useState(null);

  const [actionError, setActionError] = useState(null);

  const [outboxOpen, setOutboxOpen] = useState(false);

  const [activeConflict, setActiveConflict] = useState(null);
  const [mutualAidModalOpen, setMutualAidModalOpen] = useState(false);
  const [notificationConsoleOpen, setNotificationConsoleOpen] = useState(false);
  const [jointTaskforceMode, setJointTaskforceMode] = useState(false);

  const casesRef = useRef(null);



  const rawIncidents = useMemo(() => feed?.incidents ?? [], [feed]);
  const incidents = useMemo(() => {
    if (jointTaskforceMode) {
      return rawIncidents.filter((i) => i.region === 'Central Zone' || i.region === 'South Zone');
    }
    return rawIncidents;
  }, [rawIncidents, jointTaskforceMode]);

  const staffing = useMemo(() => feed?.staffing ?? [], [feed]);

  const snapshot = useMemo(() => getDashboardSnapshot(incidents, staffing, now), [incidents, staffing, now]);

  const visible = useMemo(() => filterIncidents(incidents, filters, now), [incidents, filters, now]);

  const selected = incidents.find((i) => i.id === selectedId) || null;

  const { headline } = snapshot;



  if (!feed) {

    return (

      <p className="text-sm text-[var(--mist)] py-10 text-center">

        {error ? `Could not load incidents: ${error}` : 'Connecting to the incident feed…'}

      </p>

    );

  }



  async function handleUpdate(id, changes, baseIncident = null) {

    try {

      const res = await updateIncident(id, changes, feed.source, baseIncident);

      if (res?._syncStatus === 'conflict') {

        const queue = getSyncQueue();

        const conflictItem = queue.find((q) => q.incidentId === id && q.status === 'conflict');

        if (conflictItem) {

          setActiveConflict(conflictItem);

        }

      }

    } finally {

      await refresh();

    }

  }



  async function handleStaffing(region, officersOnDuty) {

    setActionError(null);

    try {

      await setRegionStaffing(region, Math.max(0, officersOnDuty), feed.source);

      await refresh();

    } catch (e) {

      setActionError(e.message);

    }

  }



  function drillDown(next) {

    setFilters({ ...NO_FILTERS, ...next });

    setSelectedId(null);

    casesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  }



  function openCase(id) {

    setSelectedId(id);

    casesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  }



  function toggleFilter(key) {
    setFilters((f) => {
      if (typeof f[key] === 'boolean') {
        return { ...f, [key]: !f[key] };
      }
      if (key === 'query') {
        return { ...f, query: '' };
      }
      return { ...f, [key]: null };
    });
  }

  function handleFilterChange(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleResetFilters() {
    setFilters(NO_FILTERS);
    setSelectedId(null);
  }

  const hasActiveFilters = Boolean(
    filters.region ||
    filters.severity ||
    filters.escalatingOnly ||
    filters.unassignedOnly ||
    (filters.query && filters.query.trim())
  );



  function handleOpenConflict(incidentOrItem) {

    const queue = getSyncQueue();

    const item =

      queue.find((q) => q.queueId === incidentOrItem.queueId || q.incidentId === incidentOrItem.id) ||

      incidentOrItem;

    setActiveConflict(item);

  }



  return (

    <div className="space-y-5">

      <FeedStatus source={feed.source} now={now} error={error} />



      {/* Cross-Jurisdiction Mutual Aid & Taskforce Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--navy-line)] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setJointTaskforceMode(false)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              !jointTaskforceMode
                ? 'bg-[var(--saffron)] text-black'
                : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            Standard Precinct Feed
          </button>
          <button
            onClick={() => setJointTaskforceMode(true)}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              jointTaskforceMode
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--mist)] hover:text-white'
            }`}
          >
            <Network size={13} />
            Joint Taskforce: Interstate Syndicate (Delhi &harr; NCR South)
          </button>
        </div>

        <button
          onClick={() => setMutualAidModalOpen(true)}
          className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-500/30 bg-indigo-500/10"
        >
          <Users size={13} />
          Mutual Aid &amp; Guest Units
        </button>
        <button
          onClick={() => setNotificationConsoleOpen(true)}
          className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-500/30 bg-indigo-500/10"
        >
          <Mail size={13} />
          Notifications &amp; Escalations
        </button>
      </div>

      {/* Automated 150% Workload Surge Alert Banner */}
      {snapshot.coverage.some((c) => c.load_ratio >= 1.5) && (
        <div className="p-3.5 rounded-xl bg-[var(--alert)]/15 border border-[var(--alert)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="text-[var(--alert)] shrink-0" size={20} />
            <div>
              <span className="font-bold text-[var(--alert)] uppercase font-mono tracking-wider">
                Workload Surge Alert: Operational Capacity Exceeded (150%+)
              </span>
              <div className="text-[var(--cream)] mt-0.5">
                {snapshot.coverage
                  .filter((c) => c.load_ratio >= 1.5)
                  .map((c) => `${c.region} (${Math.round(c.load_ratio * 100)}% load, ${c.weighted_load} pts)`)
                  .join(' · ')} — Reinforcement from adjacent commands recommended.
              </div>
            </div>
          </div>
          <button
            onClick={() => setMutualAidModalOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--alert)] text-white font-semibold hover:bg-[var(--alert)]/90 flex items-center gap-1.5 transition-colors"
          >
            <ArrowRightLeft size={13} />
            Declare Aid &amp; Rebalance
          </button>
        </div>
      )}

      {jointTaskforceMode && (
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs flex items-center justify-between text-indigo-300">
          <span className="flex items-center gap-2">
            <Network size={14} />
            <strong>Joint Taskforce Workspace Active:</strong> Displaying aggregated cross-zone incidents for Central Zone (JUR-DELHI-METRO) &amp; South Zone (JUR-NCR-SOUTH).
          </span>
          <span className="font-mono text-[11px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-200">
            JTF-NCR-METRO-01
          </span>
        </div>
      )}

      {/* Field Units Offline Sync & Connectivity Banner */}

      <SyncStatusBanner

        onOpenOutbox={() => setOutboxOpen(true)}

        onOpenConflict={handleOpenConflict}

      />



      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

        <StatTile

          label="Active incidents"

          value={headline.active}

          hint={`${headline.officers_on_duty} officers on duty`}

          onClick={() => drillDown({})}

        />

        <StatTile

          label="Critical"

          value={headline.critical}

          onClick={() => drillDown({ severity: 'critical' })}

          active={filters.severity === 'critical' && !filters.region}

        />

        <StatTile

          label="Escalating"

          value={headline.escalating}

          onClick={() => drillDown({ escalatingOnly: true })}

          active={filters.escalatingOnly}

        />

        <StatTile

          label="Unassigned"

          value={headline.unassigned}

          onClick={() => drillDown({ unassignedOnly: true })}

          active={filters.unassignedOnly}

        />

        <StatTile

          label="Regions over capacity"

          value={`${headline.regions_over_capacity}/${staffing.length}`}

          hint={`${CASE_CAPACITY_PER_OFFICER} pts per officer`}

        />

      </div>

      {hasActiveFilters && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs"
          role="status"
          aria-label="Active filter status summary"
        >
          <div className="flex items-center gap-2 text-amber-200">
            <Filter size={14} className="text-[var(--saffron)] shrink-0" aria-hidden="true" />
            <span>
              Active filter view: Showing <strong>{visible.length}</strong> of <strong>{incidents.length}</strong> active cases.
            </span>
          </div>
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--saffron)] text-black font-semibold hover:bg-[var(--saffron)]/90 transition-colors text-xs cursor-pointer"
            aria-label="Reset all filters to unfiltered feed"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Reset to unfiltered feed
          </button>
        </div>
      )}

      {incidents.length === 0 ? (

        <Panel eyebrow="Operational picture" title="No incidents reported yet">

          <div className="flex items-start gap-3 text-sm text-[var(--mist)]">

            <Inbox size={20} className="shrink-0 text-[var(--saffron)]" aria-hidden="true" />

            <p>

              Reports filed through the Citizen Portal (Verify → File a report) appear here within{' '}

              {POLL_MS / 1000} seconds, grouped by severity and region. Set how many officers are on duty in each

              region below so coverage is measured against real staffing.

            </p>

          </div>

        </Panel>

      ) : (

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

          <Panel eyebrow="Operational picture" title="Active incidents by severity and region">

            <SeverityRegionTable breakdown={snapshot.breakdown} filters={filters} onSelect={drillDown} />

            <p className="text-xs text-[var(--mist)] mt-3">Select a count to open those cases below.</p>

          </Panel>

          <Panel eyebrow="Needs attention" title={`Escalating incidents (${snapshot.escalations.length})`}>

            <EscalationList escalations={snapshot.escalations} now={now} selectedId={selectedId} onSelect={openCase} />

          </Panel>

        </div>

      )}



      <Panel eyebrow="Staffing pressure" title="Coverage and workload by region">

        <p className="text-xs text-[var(--mist)] mb-2">

          Load = severity-weighted open cases (critical {SEVERITY_WEIGHT.critical}, high {SEVERITY_WEIGHT.high}, medium{' '}

          {SEVERITY_WEIGHT.medium}, low {SEVERITY_WEIGHT.low}) ÷ officers on duty × {CASE_CAPACITY_PER_OFFICER}. Trend

          lines show the last 12 hours at current staffing.

        </p>

        {actionError && <p className="text-sm text-[var(--alert)] mb-2">{actionError}</p>}

        <CoverageTable

          coverage={snapshot.coverage}

          demand={snapshot.demand}

          loadTrend={snapshot.loadTrend}

          now={now}

          filters={filters}

          onSelectRegion={(region) => drillDown({ region })}

          onStaffingChange={handleStaffing}

        />

      </Panel>



      {incidents.length > 0 && (

        <div ref={casesRef} className="scroll-mt-20">

          <Panel
            eyebrow="Drill-down"
            title={`Active cases (${visible.length}${visible.length !== incidents.length ? ` of ${incidents.length}` : ''})`}
          >

            <FilterChips
              filters={filters}
              totalCount={incidents.length}
              matchingCount={visible.length}
              onClear={handleResetFilters}
              onToggle={toggleFilter}
              onFilterChange={handleFilterChange}
            />

            <div className={`grid gap-5 ${selected ? 'lg:grid-cols-2' : ''}`}>

              <IncidentList
                incidents={visible}
                totalCount={incidents.length}
                filters={filters}
                onResetFilters={handleResetFilters}
                onToggleFilter={toggleFilter}
                now={now}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />

              {selected && (

                <div className="lg:border-l lg:border-[var(--navy-line)] lg:pl-5">

                  <IncidentDetail

                    key={selected.id}

                    incident={selected}

                    now={now}

                    onClose={() => setSelectedId(null)}

                    onUpdate={handleUpdate}

                    onOpenConflict={handleOpenConflict}

                  />

                </div>

              )}

            </div>

          </Panel>

        </div>

      )}



      {/* Sync Outbox Drawer */}

      <SyncQueueDrawer

        isOpen={outboxOpen}

        onClose={() => setOutboxOpen(false)}

        onResolveConflict={(item) => {

          setOutboxOpen(false);

          setActiveConflict(item);

        }}

      />



      {/* Mutual Aid & Dynamic Rebalancing Modal */}
      {mutualAidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="bg-[var(--navy-surface)] border border-[var(--navy-line)] rounded-2xl max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h2 className="text-lg font-bold text-[var(--cream)] flex items-center gap-2">
                <ArrowRightLeft className="text-[var(--saffron)]" size={20} />
                Cross-Jurisdiction Mutual Aid &amp; Dynamic Resource Rebalancing
              </h2>
              <button
                onClick={() => setMutualAidModalOpen(false)}
                className="text-[var(--mist)] hover:text-white p-1 rounded hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <MutualAidRebalanceView
              serviceAreas={[
                { id: 'SA-CENTRAL-01', name: 'Central Secretariat Cyber Command', region: 'Central Zone', jurisdiction_id: 'JUR-DELHI-METRO', capacity_limit_points: 30 },
                { id: 'SA-NORTH-01', name: 'North University & Transit Sector', region: 'North Zone', jurisdiction_id: 'JUR-DELHI-METRO', capacity_limit_points: 24 },
                { id: 'SA-SOUTH-01', name: 'South Financial Corridors', region: 'South Zone', jurisdiction_id: 'JUR-NCR-SOUTH', capacity_limit_points: 36 },
                { id: 'SA-EAST-01', name: 'East Trans-Yamuna Safety Sector', region: 'East Zone', jurisdiction_id: 'JUR-DELHI-METRO', capacity_limit_points: 20 },
                { id: 'SA-WEST-01', name: 'West Commercial & Industrial Division', region: 'West Zone', jurisdiction_id: 'JUR-NCR-SOUTH', capacity_limit_points: 24 },
              ]}
              incidents={rawIncidents}
            />
          </div>
        </div>
      )}

      {/* Incident Notifications Modal */}
      {notificationConsoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="bg-[var(--navy-surface)] border border-[var(--navy-line)] rounded-2xl max-w-6xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <IncidentNotificationConsole onClose={() => setNotificationConsoleOpen(false)} />
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}

      <ConflictResolutionModal

        conflictItem={activeConflict}

        onClose={() => setActiveConflict(null)}

      />

    </div>

  );

}

