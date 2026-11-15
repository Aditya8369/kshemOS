import { SEVERITIES } from '../../incidentDashboard';
import { SeverityBadge } from './ui';

export default function SeverityRegionTable({ breakdown, filters, onSelect }) {
  const regions = Object.keys(breakdown.rows);
  const cellClass = (selected) =>
    `w-full rounded-md py-1.5 font-mono text-sm transition-colors ${
      selected ? 'bg-[var(--saffron)] text-white' : 'hover:bg-[var(--ink)] text-white/90'
    }`;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-separate border-spacing-1 min-w-[420px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--mist)]">
            <th className="text-left font-normal px-1">Region</th>
            {SEVERITIES.map((s) => (
              <th key={s} className="font-normal">
                <SeverityBadge severity={s} />
              </th>
            ))}
            <th className="font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((region) => {
            const row = breakdown.rows[region];
            return (
              <tr key={region}>
                <th scope="row" className="text-left font-normal text-white/90 px-1 whitespace-nowrap">
                  {region}
                </th>
                {SEVERITIES.map((severity) => (
                  <td key={severity} className="text-center">
                    {row[severity] > 0 ? (
                      <button
                        className={cellClass(filters.region === region && filters.severity === severity)}
                        onClick={() => onSelect({ region, severity })}
                        aria-label={`${row[severity]} ${severity} incidents in ${region}`}
                      >
                        {row[severity]}
                      </button>
                    ) : (
                      <span className="font-mono text-sm text-[var(--mist)]/40">·</span>
                    )}
                  </td>
                ))}
                <td className="text-center">
                  <button
                    className={cellClass(filters.region === region && !filters.severity)}
                    onClick={() => onSelect({ region, severity: null })}
                    aria-label={`All ${row.total} active incidents in ${region}`}
                  >
                    <span className="font-semibold">{row.total}</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-[var(--mist)]">
            <th scope="row" className="text-left font-normal px-1 pt-1 border-t border-[var(--navy-line)]">
              All regions
            </th>
            {SEVERITIES.map((s) => (
              <td key={s} className="text-center pt-1 border-t border-[var(--navy-line)]">
                {breakdown.totals[s] > 0 ? (
                  <button
                    className={cellClass(!filters.region && filters.severity === s)}
                    onClick={() => onSelect({ region: null, severity: s })}
                    aria-label={`All ${breakdown.totals[s]} ${s} incidents across all regions`}
                  >
                    {breakdown.totals[s]}
                  </button>
                ) : (
                  <span className="font-mono text-sm text-[var(--mist)]/40">·</span>
                )}
              </td>
            ))}
            <td className="text-center pt-1 border-t border-[var(--navy-line)]">
              <button
                className={cellClass(!filters.region && !filters.severity)}
                onClick={() => onSelect({ region: null, severity: null })}
                aria-label={`All ${breakdown.totals.total} active incidents`}
              >
                <span className="font-semibold">{breakdown.totals.total}</span>
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
