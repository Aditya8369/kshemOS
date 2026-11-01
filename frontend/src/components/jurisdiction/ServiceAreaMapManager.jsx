import { useState, useMemo } from 'react';
import { validateBoundaryLocally } from '../../jurisdictionStore.js';

const RISK_BADGES = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  moderate: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

export default function ServiceAreaMapManager({
  serviceAreas = [],
  jurisdictions = [],
  onSaveServiceArea,
}) {
  const [selectedAreaId, setSelectedAreaId] = useState(serviceAreas[0]?.id || 'SA-CENTRAL-01');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const selectedArea = serviceAreas.find((sa) => sa.id === selectedAreaId) || serviceAreas[0];

  function startEdit(sa) {
    setSelectedAreaId(sa.id);
    setFormData({
      ...sa,
      radius_km: sa.radius_km || 5.0,
      capacity_limit_points: sa.capacity_limit_points || 24,
      primary_station: sa.primary_station || '',
      risk_level: sa.risk_level || 'moderate',
      status: sa.status || 'active',
    });
    setIsEditing(true);
    setNotice(null);
    setError(null);
  }

  // Live client-side boundary validation feedback while sliding or editing
  const liveValidation = useMemo(() => {
    if (!formData || !selectedArea) return null;
    return validateBoundaryLocally(selectedArea, formData, 2);
  }, [formData, selectedArea]);

  async function handleSave() {
    if (!formData) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await onSaveServiceArea(formData);
      if (res.requires_review) {
        setNotice({
          type: 'proposal',
          text: `High-impact change staged! Proposal ${res.proposal_id} created for commanding officer approval.`,
        });
      } else {
        setNotice({
          type: 'success',
          text: `Service area "${formData.name}" updated successfully (v${res.service_area?.version || ''}).`,
        });
      }
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save service area');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start justify-between ${
            notice.type === 'proposal'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notice.type === 'proposal' ? '⏳' : '✓'}</span>
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-white/60 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border bg-red-950/40 border-red-500/40 text-red-200 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white/60 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Operational Regions Interactive Map / Sector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {serviceAreas.map((sa) => {
          const isSelected = sa.id === selectedAreaId;
          const parentJur = jurisdictions.find((j) => j.id === sa.jurisdiction_id);

          return (
            <div
              key={sa.id}
              onClick={() => {
                setSelectedAreaId(sa.id);
                if (isEditing) startEdit(sa);
              }}
              className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[var(--navy)] border-[var(--saffron)] shadow-lg ring-1 ring-[var(--saffron)]'
                  : 'bg-[var(--ink)] border-[var(--navy-line)] hover:border-white/30'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono text-[10px] uppercase text-[var(--saffron)] tracking-wider">
                    {sa.region}
                  </div>
                  <h3 className="font-semibold text-white text-sm mt-0.5">{sa.name}</h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase ${
                    RISK_BADGES[sa.risk_level] || RISK_BADGES.moderate
                  }`}
                >
                  {sa.risk_level}
                </span>
              </div>

              <div className="text-xs text-[var(--mist)] space-y-1 mb-3">
                <div className="truncate">
                  Station: <span className="text-white">{sa.primary_station}</span>
                </div>
                <div>
                  Authority: <span className="text-white/90">{parentJur?.name || sa.jurisdiction_id}</span>
                </div>
              </div>

              {/* Radius Radar Representation */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--navy-line)] text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-[var(--saffron)] flex items-center justify-center text-[10px] text-[var(--saffron)] font-mono">
                    ◎
                  </div>
                  <span className="font-mono text-white font-bold">{sa.radius_km} km</span>
                  <span className="text-[10px] text-[var(--mist)]">radius</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-white">{sa.capacity_limit_points}</span>
                  <span className="text-[10px] text-[var(--mist)] ml-1">pts cap</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Sector Details & Boundary Editor */}
      {selectedArea && (
        <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--saffron)]">
                  {selectedArea.region} Operational Boundary
                </span>
                <span className="font-mono text-xs text-[var(--mist)]">v{selectedArea.version || 1}</span>
              </div>
              <h2 className="font-display text-2xl font-semibold mt-1">{selectedArea.name}</h2>
              <p className="text-xs text-[var(--mist)] mt-0.5">
                ID: <code className="font-mono text-white">{selectedArea.id}</code> | Station:{' '}
                <span className="text-white">{selectedArea.primary_station}</span>
              </p>
            </div>

            {!isEditing ? (
              <button
                onClick={() => startEdit(selectedArea)}
                className="self-start px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--saffron)] text-white hover:brightness-110 transition shadow-md"
              >
                Configure Boundaries & Thresholds
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="self-start px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--navy-line)] text-[var(--mist)] hover:text-white transition"
              >
                Cancel Editing
              </button>
            )}
          </div>

          {!isEditing ? (
            /* Read-only sector overview */
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)]">
                <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Coverage Radius</div>
                <div className="font-mono text-2xl font-bold text-white mt-1">{selectedArea.radius_km} km</div>
                <div className="text-[11px] text-[var(--mist)] mt-0.5">
                  Center: {selectedArea.center_lat?.toFixed(3)}, {selectedArea.center_lng?.toFixed(3)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)]">
                <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Max Workload Capacity</div>
                <div className="font-mono text-2xl font-bold text-white mt-1">
                  {selectedArea.capacity_limit_points} <span className="text-sm font-normal text-[var(--mist)]">pts</span>
                </div>
                <div className="text-[11px] text-[var(--mist)] mt-0.5">Auto-overflow routing when exceeded</div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)]">
                <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Assigned Units</div>
                <div className="font-mono text-base font-semibold text-white mt-1">
                  {selectedArea.authorized_units?.length || 0} Officers
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(selectedArea.authorized_units || []).map((u) => (
                    <span
                      key={u}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/90 border border-white/15"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)]">
                <div className="text-[10px] font-mono uppercase text-[var(--mist)]">Risk Level & State</div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono border uppercase ${
                      RISK_BADGES[selectedArea.risk_level] || RISK_BADGES.moderate
                    }`}
                  >
                    {selectedArea.risk_level}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 capitalize">● {selectedArea.status}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Interactive Boundary & Rule Editor */
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
                    Primary Station / Dispatch Desk
                  </label>
                  <input
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm text-white"
                    value={formData.primary_station}
                    onChange={(e) => setFormData({ ...formData, primary_station: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--mist)] mb-1">
                    Operational Risk Rating
                  </label>
                  <select
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-lg px-3 py-2 text-sm text-white"
                    value={formData.risk_level}
                    onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
                  >
                    <option value="critical">Critical (Priority Surveillance)</option>
                    <option value="high">High (Active Extortion Corridor)</option>
                    <option value="moderate">Moderate</option>
                    <option value="low">Low (Standard Patrol)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono uppercase text-[var(--mist)] mb-1">
                    <span>Boundary Radius (km)</span>
                    <span className="text-white font-bold">{formData.radius_km} km</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="15.0"
                    step="0.5"
                    className="w-full accent-[var(--saffron)] cursor-pointer"
                    value={formData.radius_km}
                    onChange={(e) => setFormData({ ...formData, radius_km: parseFloat(e.target.value) })}
                  />
                  <div className="flex justify-between text-[10px] text-[var(--mist)] font-mono mt-1">
                    <span>1.0 km</span>
                    <span>Baseline: {selectedArea.radius_km} km</span>
                    <span>15.0 km</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono uppercase text-[var(--mist)] mb-1">
                    <span>Capacity Limit (Workload Points)</span>
                    <span className="text-white font-bold">{formData.capacity_limit_points} pts</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="2"
                    className="w-full accent-[var(--saffron)] cursor-pointer"
                    value={formData.capacity_limit_points}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity_limit_points: parseInt(e.target.value, 10) })
                    }
                  />
                  <div className="flex justify-between text-[10px] text-[var(--mist)] font-mono mt-1">
                    <span>10 pts (Light)</span>
                    <span>60 pts (Reinforced)</span>
                  </div>
                </div>
              </div>

              {/* Real-time guardrail preview */}
              {liveValidation && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    liveValidation.requiresReview
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="font-semibold flex items-center gap-2">
                    <span>{liveValidation.requiresReview ? '🛡️ Guardrail Alert:' : '✓ Safety Check:'}</span>
                    <span>
                      {liveValidation.requiresReview
                        ? 'High-Impact Boundary Modification Detected'
                        : 'Standard Revision (Will Apply Directly)'}
                    </span>
                  </div>

                  {liveValidation.warnings?.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-amber-300">
                      {liveValidation.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  )}

                  <p className="text-[11px] opacity-80">
                    {liveValidation.requiresReview
                      ? 'Saving will create a formal ChangeProposal requiring multi-officer sign-off before boundaries update.'
                      : 'Boundary coordinates and capacities are within safety thresholds and will apply immediately.'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--navy-line)] text-[var(--mist)] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--saffron)] text-white hover:brightness-110 shadow-md transition disabled:opacity-40"
                >
                  {saving ? 'Validating…' : 'Save Sector Configuration'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
