import { useEffect, useState } from 'react';

const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '');

const API_URL = `${API_BASE}/api/officer/response-teams`;

const statusStyles = {
  Available: 'bg-green-500/15 text-green-400',
  Limited: 'bg-yellow-500/15 text-yellow-400',
  Overstretched: 'bg-red-500/15 text-red-400',
};

function getStatus(team) {
  if (team.assigned > team.capacity) return 'Overstretched';
  if (team.assigned === team.capacity) return 'Limited';
  return 'Available';
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const error = await response.json();

      if (typeof error.detail === 'string') {
        message = error.detail;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
}

export default function ResponseTeamMatrix() {
  const [teams, setTeams] = useState([]);
  const [history, setHistory] = useState([]);

  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [jurisdiction, setJurisdiction] = useState('All');

  const [loading, setLoading] = useState(true);
  const [savingTeamId, setSavingTeamId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [teamsData, historyData] = await Promise.all([
          apiRequest(API_URL),
          apiRequest(`${API_URL}/history`),
        ]);

        if (!active) return;

        setTeams(teamsData);
        setHistory(historyData);
      } catch (err) {
        if (active) {
          setError(
            `Unable to load response teams: ${err.message}. Check that FastAPI is running.`
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const filteredTeams = teams.filter((team) => {
    return (
      team.name.toLowerCase().includes(search.toLowerCase()) &&
      (specialty === 'All' || team.specialty === specialty) &&
      (jurisdiction === 'All' || team.jurisdiction === jurisdiction)
    );
  });

  async function reassignTeam(team) {
    const newIncident = window.prompt(
      `Enter new incident ID for ${team.name}`,
      team.incident
    );

    if (newIncident === null) return;

    const incident = newIncident.trim();

    if (!incident) {
      setError('Incident ID cannot be empty.');
      return;
    }

    if (incident === team.incident) {
      return;
    }

    const reasonInput = window.prompt(
      `Enter a reason for reassigning ${team.name}`
    );

    if (reasonInput === null) return;

    const reason = reasonInput.trim();

    if (!reason) {
      setError('A reassignment reason is required.');
      return;
    }

    setSavingTeamId(team.id);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`${API_URL}/${team.id}/reassign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident,
          reason,
        }),
      });

      const [updatedTeams, updatedHistory] = await Promise.all([
        apiRequest(API_URL),
        apiRequest(`${API_URL}/history`),
      ]);

      setTeams(updatedTeams);
      setHistory(updatedHistory);
      setSuccess(`${team.name} reassigned successfully.`);
    } catch (err) {
      setError(`Reassignment failed: ${err.message}`);
    } finally {
      setSavingTeamId(null);
    }
  }

  return (
    <section className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6">
      <p className="text-xs font-mono uppercase tracking-widest text-[var(--saffron)] mb-1">
        Response Operations
      </p>

      <h2 className="font-display text-xl font-semibold text-white mb-2">
        Response Team Assignment Matrix
      </h2>

      <p className="text-sm text-[var(--mist)] mb-5">
        Monitor team assignments, staffing coverage and operational demand.
      </p>

      <p className="text-xs text-[var(--saffron)] mb-5">
        Demo data — connected to the FastAPI backend. Changes reset when the
        backend restarts.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300"
        >
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--mist)] py-8">
          Loading response teams...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              ['Total Teams', teams.length],
              [
                'Available',
                teams.filter((t) => getStatus(t) === 'Available').length,
              ],
              [
                'Limited',
                teams.filter((t) => getStatus(t) === 'Limited').length,
              ],
              [
                'Overstretched',
                teams.filter((t) => getStatus(t) === 'Overstretched').length,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-3"
              >
                <p className="text-xs text-[var(--mist)]">{label}</p>
                <p className="text-2xl font-semibold text-white mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3 mb-5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams..."
              aria-label="Search teams"
              className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-sm text-white"
            />

            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              aria-label="Filter by specialty"
              className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-sm text-white"
            >
              <option value="All">All Specialties</option>
              {[...new Set(teams.map((t) => t.specialty))].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              aria-label="Filter by jurisdiction"
              className="bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg p-2 text-sm text-white"
            >
              <option value="All">All Jurisdictions</option>
              {[...new Set(teams.map((t) => t.jurisdiction))].map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead className="bg-[var(--ink)] text-[var(--mist)]">
                <tr>
                  {[
                    'Team',
                    'Specialty',
                    'Jurisdiction',
                    'Incident',
                    'Workload',
                    'Coverage',
                    'Action',
                  ].map((heading) => (
                    <th key={heading} className="p-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredTeams.map((team) => (
                  <tr
                    key={team.id}
                    className="border-t border-[var(--navy-line)]"
                  >
                    <td className="p-3 text-white font-medium">
                      {team.name}
                    </td>

                    <td className="p-3 text-[var(--mist)]">
                      {team.specialty}
                    </td>

                    <td className="p-3 text-[var(--mist)]">
                      {team.jurisdiction}
                    </td>

                    <td className="p-3 text-white font-mono">
                      {team.incident}
                    </td>

                    <td className="p-3 text-white">
                      {team.assigned}/{team.capacity}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs ${
                          statusStyles[getStatus(team)]
                        }`}
                      >
                        {getStatus(team)}
                      </span>
                    </td>

                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => reassignTeam(team)}
                        disabled={savingTeamId !== null}
                        className="bg-[var(--saffron)] text-white rounded-full px-3 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingTeamId === team.id
                          ? 'Saving...'
                          : 'Reassign'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTeams.length === 0 && (
              <p className="text-center text-[var(--mist)] py-6">
                No teams found.
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--navy-line)] pt-5">
            <h3 className="font-display text-lg font-semibold text-white mb-3">
              Assignment History
            </h3>

            {history.length === 0 ? (
              <p className="text-sm text-[var(--mist)]">
                No reassignments recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-[var(--ink)] rounded-lg p-3"
                  >
                    <p className="text-sm text-white font-medium">
                      {entry.team}
                    </p>

                    <p className="text-xs text-[var(--mist)] mt-1">
                      {entry.from} → {entry.to}
                    </p>

                    <p className="text-xs text-[var(--mist)] mt-1">
                      Reason: {entry.reason}
                    </p>

                    <p className="text-xs text-[var(--mist)] mt-1">
                      {new Date(entry.time).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}