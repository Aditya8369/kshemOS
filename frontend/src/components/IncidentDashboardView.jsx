import { useMemo, useRef, useState } from 'react';
import { Clock, Inbox, Radio, WifiOff } from 'lucide-react';
import { setRegionStaffing, updateIncident } from '../api';
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

const NO_FILTERS = { region: null, severity: null, escalatingOnly: false, unassignedOnly: false };

function FeedStatus({ source, now, error }) {
  const live = source === 'backend';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mist)]">
      <span className="inline-flex items-center gap-1">
        <Clock size={12} aria-hidden="true" />
        Updated {formatClock(now)} · refreshes every {POLL_MS / 1000}s
      </span>
      {error ? (
        <span className="text-[var(--alert)]">Could not refresh: {error}</span>
      ) : (
        <span
          className={`inline-flex items-center gap-1 font-mono uppercase tracking-wide border rounded-full px-2 py-0.5 ${
            live ? 'border-[var(--safe)] text-[var(--safe)]' : 'border-[var(--caution)] text-[var(--caution)]'
          }`}
          title={
            live
              ? 'Incidents come from the KshemOS backend and are shared with every officer.'
              : 'The backend is not reachable. Incidents are stored in this browser and shared only across its tabs.'
          }
        >
          {live ? <Radio size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}
          {live ? 'Live · shared feed' : 'Offline · this browser only'}
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
  const casesRef = useRef(null);

  const incidents = useMemo(() => feed?.incidents ?? [], [feed]);
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

  async function handleUpdate(id, changes) {
    await updateIncident(id, changes, feed.source);
    await refresh();
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
    setFilters((f) => ({ ...f, [key]: typeof f[key] === 'boolean' ? !f[key] : null }));
  }

  return (
    <div className="space-y-5">
      <FeedStatus source={feed.source} now={now} error={error} />

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
          <Panel eyebrow="Drill-down" title={`Active cases (${visible.length})`}>
            <FilterChips filters={filters} onClear={() => setFilters(NO_FILTERS)} onToggle={toggleFilter} />
            <div className={`grid gap-5 ${selected ? 'lg:grid-cols-2' : ''}`}>
              <IncidentList incidents={visible} now={now} selectedId={selectedId} onSelect={setSelectedId} />
              {selected && (
                <div className="lg:border-l lg:border-[var(--navy-line)] lg:pl-5">
                  <IncidentDetail
                    key={selected.id}
                    incident={selected}
                    now={now}
                    onClose={() => setSelectedId(null)}
                    onUpdate={handleUpdate}
                  />
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
