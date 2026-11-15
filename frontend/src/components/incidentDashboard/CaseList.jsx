import {
  AlertTriangle,
  Filter,
  FilterX,
  MapPin,
  RotateCcw,
  Search,
  UserX,
  X,
} from 'lucide-react';
import { REGIONS, SEVERITIES, formatDuration } from '../../incidentDashboard';
import { SEVERITY_COLOR, STATUS_LABEL, minutesSince } from './display';
import { SeverityBadge } from './ui';

/**
 * Build a structured array of active filters with descriptive labels and categories.
 */
function getActiveFilterChips(filters = {}) {
  const chips = [];
  if (filters.query && filters.query.trim()) {
    chips.push({
      key: 'query',
      category: 'Search',
      label: `"${filters.query.trim()}"`,
      fullLabel: `Search: "${filters.query.trim()}"`,
      type: 'query',
    });
  }
  if (filters.region) {
    chips.push({
      key: 'region',
      category: 'Region',
      label: filters.region,
      fullLabel: `Region: ${filters.region}`,
      type: 'region',
    });
  }
  if (filters.severity) {
    chips.push({
      key: 'severity',
      category: 'Severity',
      label: `${filters.severity}`,
      fullLabel: `Severity: ${filters.severity}`,
      type: 'severity',
      severity: filters.severity,
    });
  }
  if (filters.escalatingOnly) {
    chips.push({
      key: 'escalatingOnly',
      category: 'Status',
      label: 'Escalating only',
      fullLabel: 'Escalating only',
      type: 'escalating',
    });
  }
  if (filters.unassignedOnly) {
    chips.push({
      key: 'unassignedOnly',
      category: 'Assignment',
      label: 'Unassigned only',
      fullLabel: 'Unassigned only',
      type: 'unassigned',
    });
  }
  return chips;
}

/**
 * Filter bar component displaying interactive controls, removable chips, matching counts,
 * and a one-action reset button.
 */
export function FilterChips({
  filters = {},
  onClear,
  onToggle,
  onFilterChange,
  totalCount = 0,
  matchingCount = 0,
}) {
  const chips = getActiveFilterChips(filters);
  const hasActiveFilters = chips.length > 0;

  return (
    <div className="space-y-3 mb-4" role="region" aria-label="Incident feed filters">
      {/* Interactive Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[var(--navy-surface)]/70 border border-[var(--navy-line)]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mist)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={filters.query || ''}
            onChange={(e) => onFilterChange && onFilterChange('query', e.target.value)}
            placeholder="Search title, ID, or officer…"
            className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-[var(--mist)]/60 focus:outline-none focus:border-[var(--saffron)] transition-colors"
            aria-label="Filter incidents by keyword or ID"
          />
          {filters.query && (
            <button
              onClick={() => onToggle('query')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mist)] hover:text-white p-0.5"
              aria-label="Clear search input"
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Region Dropdown Selector */}
        <div className="shrink-0">
          <select
            value={filters.region || ''}
            onChange={(e) => onFilterChange && onFilterChange('region', e.target.value || null)}
            className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-[var(--saffron)] transition-colors cursor-pointer"
            aria-label="Filter by region"
          >
            <option value="">All Regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Dropdown Selector */}
        <div className="shrink-0">
          <select
            value={filters.severity || ''}
            onChange={(e) => onFilterChange && onFilterChange('severity', e.target.value || null)}
            className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-[var(--saffron)] transition-colors capitalize cursor-pointer"
            aria-label="Filter by severity"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Escalating Quick Toggle */}
        <button
          onClick={() => onToggle('escalatingOnly')}
          aria-pressed={Boolean(filters.escalatingOnly)}
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            filters.escalatingOnly
              ? 'bg-[var(--caution)]/20 border-[var(--caution)] text-amber-200 font-semibold'
              : 'border-[var(--navy-line)] bg-[var(--ink)] text-[var(--mist)] hover:text-white hover:border-[var(--saffron)]'
          }`}
          aria-label="Toggle escalating incidents only"
        >
          <AlertTriangle size={13} aria-hidden="true" />
          Escalating
        </button>

        {/* Unassigned Quick Toggle */}
        <button
          onClick={() => onToggle('unassignedOnly')}
          aria-pressed={Boolean(filters.unassignedOnly)}
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            filters.unassignedOnly
              ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
              : 'border-[var(--navy-line)] bg-[var(--ink)] text-[var(--mist)] hover:text-white hover:border-[var(--saffron)]'
          }`}
          aria-label="Toggle unassigned incidents only"
        >
          <UserX size={13} aria-hidden="true" />
          Unassigned
        </button>
      </div>

      {/* Active Filter Chips & Matching Feedback Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--mist)] flex items-center gap-1">
              <Filter size={12} aria-hidden="true" />
              Active filters:
            </span>
          )}

          {!hasActiveFilters && (
            <span className="text-xs text-[var(--mist)]">
              Showing all active incidents. Use the filters or matrix above to narrow down.
            </span>
          )}

          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onToggle(chip.key)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-[var(--saffron)] bg-[var(--ink)] text-white hover:bg-[var(--saffron)]/15 transition-colors group shadow-sm"
              aria-label={`Remove filter ${chip.fullLabel}`}
              title={`Remove filter ${chip.fullLabel}`}
            >
              {chip.type === 'region' && <MapPin size={11} className="text-[var(--saffron)]" aria-hidden="true" />}
              {chip.type === 'severity' && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: SEVERITY_COLOR[chip.severity] }}
                  aria-hidden="true"
                />
              )}
              {chip.type === 'escalating' && (
                <AlertTriangle size={11} className="text-[var(--caution)]" aria-hidden="true" />
              )}
              {chip.type === 'unassigned' && <UserX size={11} className="text-sky-400" aria-hidden="true" />}
              {chip.type === 'query' && <Search size={11} className="text-[var(--saffron)]" aria-hidden="true" />}

              <span>{chip.fullLabel}</span>
              <X
                size={12}
                className="text-[var(--mist)] group-hover:text-white transition-colors ml-0.5 shrink-0"
                aria-hidden="true"
              />
            </button>
          ))}

          {/* One-action reset button */}
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-[var(--navy-line)] bg-white/5 hover:bg-white/10 text-[var(--cream)] hover:text-white transition-colors"
              aria-label="Reset all filters to unfiltered feed"
            >
              <RotateCcw size={11} aria-hidden="true" />
              Reset all filters
            </button>
          )}
        </div>

        {/* Quantitative Match Counter */}
        <div className="text-xs font-mono">
          {hasActiveFilters ? (
            <span className="text-[var(--saffron)] font-medium">
              Showing {matchingCount} of {totalCount} active cases
              {totalCount > matchingCount && (
                <span className="text-[var(--mist)] ml-1 font-normal">
                  ({totalCount - matchingCount} hidden)
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--mist)]">
              {totalCount} active {totalCount === 1 ? 'case' : 'cases'} in feed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Rich, actionable no-results empty state explaining active filters and offering
 * immediate recovery actions.
 */
export function IncidentEmptyState({
  filters = {},
  totalCount = 0,
  onResetFilters,
  onToggleFilter,
}) {
  const chips = getActiveFilterChips(filters);
  const hasActiveFilters = chips.length > 0;

  if (!hasActiveFilters) {
    return (
      <div className="rounded-2xl border border-[var(--navy-line)] bg-[var(--navy-surface)]/50 p-8 text-center space-y-3">
        <p className="text-sm text-[var(--mist)]">No active incidents reported in the precinct feed.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-[var(--navy-line)] bg-[var(--navy-surface)]/80 p-8 text-center space-y-4"
      role="region"
      aria-label="No matching incidents feedback"
    >
      <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[var(--saffron)] shadow-sm">
        <FilterX size={24} aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-white">
          No matching incidents found
        </h3>
        <p className="text-xs text-[var(--mist)] max-w-md mx-auto">
          No active incidents match all applied filters (0 matching out of {totalCount} total active cases).
        </p>
      </div>

      {/* List active filter chips with individual removal */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--mist)]">
          Active filter criteria:
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onToggleFilter && onToggleFilter(chip.key)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-200 hover:bg-rose-500/25 transition-colors group cursor-pointer"
              aria-label={`Remove filter ${chip.fullLabel}`}
              title={`Remove ${chip.fullLabel}`}
            >
              <span>{chip.fullLabel}</span>
              <X size={12} className="text-rose-300 group-hover:text-white transition-colors" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--mist)] max-w-md mx-auto">
        Adjust or remove specific filters above, or reset to view the entire unfiltered incident feed.
      </p>

      {/* Primary One-Action Reset Button */}
      <div className="pt-2">
        <button
          onClick={onResetFilters}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--saffron)] text-black font-semibold hover:bg-[var(--saffron)]/90 transition-colors shadow-md text-xs cursor-pointer"
          aria-label={`Clear all filters and view all ${totalCount} active cases`}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reset all filters ({totalCount} active cases)
        </button>
      </div>
    </div>
  );
}

/**
 * List of incidents with active status badges, conflict sync indicators,
 * and empty state handling.
 */
export function IncidentList({
  incidents = [],
  now = Date.now(),
  selectedId,
  onSelect,
  totalCount = 0,
  filters = {},
  onResetFilters,
  onToggleFilter,
}) {
  if (incidents.length === 0) {
    return (
      <IncidentEmptyState
        filters={filters}
        totalCount={totalCount || incidents.length}
        onResetFilters={onResetFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  }

  return (
    <ul className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1" aria-label="Incident cases list">
      {incidents.map((incident) => (
        <li key={incident.id}>
          <button
            onClick={() => onSelect(incident.id)}
            aria-current={selectedId === incident.id}
            className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
              selectedId === incident.id
                ? 'border-[var(--saffron)] bg-[var(--ink)]'
                : 'border-[var(--navy-line)] hover:border-[var(--saffron)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={incident.severity} />
                {incident._syncStatus === 'pending' && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Queued
                  </span>
                )}
                {incident._syncStatus === 'conflict' && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500 animate-pulse font-bold">
                    Conflict
                  </span>
                )}
                {incident._syncStatus === 'failed' && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Push Failed
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-[var(--mist)]">{incident.id}</span>
            </div>
            <div className="text-sm text-white mt-0.5">{incident.title}</div>
            <div className="text-[11px] text-[var(--mist)] mt-0.5">
              {incident.region} · {STATUS_LABEL[incident.status]} · {incident.assigned_to || 'Unassigned'} ·{' '}
              {formatDuration(minutesSince(incident.opened_at, now))} open
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
