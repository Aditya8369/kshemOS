import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Edit2,
  Plus,
  Shield,
  Sliders,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { deleteRule, saveRule } from '../../geofenceEngine';

const TEAMS = ['*', 'TEAM-ALPHA', 'CYBER-PATROL', 'TEAM-BRAVO', 'VIP-ESCORT', 'COMMAND-HQ'];

export default function GeofenceRulesManager({
  rules = [],
  boundaries = [],
  onRefresh = () => {},
}) {
  const [editingRule, setEditingRule] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [geofenceId, setGeofenceId] = useState('*');
  const [team, setTeam] = useState('*');
  const [eventTypes, setEventTypes] = useState(['entry', 'dwell']);
  const [dwellThreshold, setDwellThreshold] = useState(30);
  const [alertSeverity, setAlertSeverity] = useState('warning');
  const [enabled, setEnabled] = useState(true);

  function openCreate() {
    setEditingRule(null);
    setName('');
    setGeofenceId('*');
    setTeam('*');
    setEventTypes(['entry', 'dwell']);
    setDwellThreshold(30);
    setAlertSeverity('warning');
    setEnabled(true);
    setIsModalOpen(true);
  }

  function openEdit(rule) {
    setEditingRule(rule);
    setName(rule.name);
    setGeofenceId(rule.geofenceId);
    setTeam(rule.team);
    setEventTypes(rule.eventTypes || ['entry']);
    setDwellThreshold(rule.dwellThresholdSeconds || 30);
    setAlertSeverity(rule.alertSeverity || 'warning');
    setEnabled(rule.enabled !== false);
    setIsModalOpen(true);
  }

  function handleToggleEventType(type) {
    if (eventTypes.includes(type)) {
      if (eventTypes.length === 1) return; // Keep at least one
      setEventTypes(eventTypes.filter((t) => t !== type));
    } else {
      setEventTypes([...eventTypes, type]);
    }
  }

  function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;

    saveRule({
      id: editingRule?.id,
      name: name.trim(),
      geofenceId,
      team,
      eventTypes,
      dwellThresholdSeconds: Number(dwellThreshold),
      alertSeverity,
      enabled,
    });

    setIsModalOpen(false);
    onRefresh();
  }

  function handleDelete(id) {
    deleteRule(id);
    onRefresh();
  }

  function handleToggleRule(rule) {
    saveRule({
      ...rule,
      enabled: !rule.enabled,
    });
    onRefresh();
  }

  return (
    <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-3">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-[var(--saffron)]" />
          <div>
            <h3 className="font-display font-semibold text-white text-base">
              Configurable Geofence Rules
            </h3>
            <p className="text-xs text-[var(--mist)]">
              Automated trigger policies customized by team assignment or operational zone
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--saffron)] text-[var(--ink)] hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>New Rule</span>
        </button>
      </div>

      {/* Rules Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rules.map((rule) => {
          const targetBoundary =
            rule.geofenceId === '*'
              ? 'All Boundaries'
              : boundaries.find((b) => b.id === rule.geofenceId)?.name || rule.geofenceId;

          return (
            <div
              key={rule.id}
              className={`border rounded-xl p-3.5 space-y-3 transition-colors ${
                rule.enabled
                  ? 'bg-[var(--ink)]/80 border-[var(--navy-line)] hover:border-[var(--saffron)]/50'
                  : 'bg-[var(--ink)]/30 border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm text-white">{rule.name}</div>
                  <div className="text-[10px] font-mono text-[var(--mist)]">{rule.id}</div>
                </div>

                <button
                  onClick={() => handleToggleRule(rule)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    rule.enabled
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-[var(--mist)]'
                  }`}
                >
                  {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                </button>
              </div>

              {/* Scope details */}
              <div className="text-xs space-y-1 bg-[var(--navy)]/50 p-2 rounded-lg text-[var(--mist)] font-mono">
                <div>
                  Zone: <span className="text-white">{targetBoundary}</span>
                </div>
                <div>
                  Team: <span className="text-white">{rule.team === '*' ? 'All Teams' : rule.team}</span>
                </div>
                <div>
                  Events:{' '}
                  <span className="text-white uppercase">{rule.eventTypes?.join(', ') || 'entry'}</span>
                  {rule.eventTypes?.includes('dwell') && (
                    <span className="text-[var(--saffron)]"> ({rule.dwellThresholdSeconds}s)</span>
                  )}
                </div>
                <div>
                  Severity:{' '}
                  <span
                    className={`uppercase font-bold ${
                      rule.alertSeverity === 'critical'
                        ? 'text-rose-400'
                        : rule.alertSeverity === 'warning'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {rule.alertSeverity}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--navy-line)] text-xs">
                <button
                  onClick={() => openEdit(rule)}
                  className="p-1 text-[var(--mist)] hover:text-white transition-colors"
                  title="Edit Rule"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1 text-[var(--mist)] hover:text-rose-400 transition-colors"
                  title="Delete Rule"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl max-w-lg w-full p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3">
              <h4 className="font-display font-semibold text-lg">
                {editingRule ? 'Edit Geofence Rule' : 'Create New Geofence Rule'}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-[var(--mist)] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <label className="block space-y-1">
                <span className="text-[var(--mist)]">Rule Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Critical Alert on High-Risk Financial Dwell"
                  required
                  className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2.5 text-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[var(--mist)]">Target Geofenced Zone</span>
                  <select
                    value={geofenceId}
                    onChange={(e) => setGeofenceId(e.target.value)}
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2.5 text-white"
                  >
                    <option value="*">All Zones (*)</option>
                    {boundaries.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.id})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[var(--mist)]">Target Team Assignment</span>
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2.5 text-white"
                  >
                    {TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t === '*' ? 'All Teams (*)' : t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Event Triggers Checkboxes */}
              <div className="space-y-1.5">
                <span className="text-[var(--mist)]">Trigger Events</span>
                <div className="flex gap-2">
                  {['entry', 'exit', 'dwell'].map((type) => {
                    const active = eventTypes.includes(type);
                    return (
                      <button
                        type="button"
                        key={type}
                        onClick={() => handleToggleEventType(type)}
                        className={`flex-1 py-2 rounded-xl border text-center font-mono uppercase font-semibold transition-all ${
                          active
                            ? 'bg-[var(--saffron)] text-[var(--ink)] border-[var(--saffron)] font-bold'
                            : 'bg-[var(--ink)] border-[var(--navy-line)] text-[var(--mist)] hover:text-white'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dwell Threshold Slider (if dwell is enabled) */}
              {eventTypes.includes('dwell') && (
                <label className="block space-y-1 bg-[var(--ink)]/60 p-3 rounded-xl border border-[var(--navy-line)]">
                  <div className="flex justify-between text-[var(--mist)]">
                    <span>Dwell Time Threshold</span>
                    <span className="font-mono text-white font-bold">{dwellThreshold} seconds</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="180"
                    step="5"
                    value={dwellThreshold}
                    onChange={(e) => setDwellThreshold(e.target.value)}
                    className="w-full accent-[var(--saffron)]"
                  />
                </label>
              )}

              {/* Severity & Enablement */}
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[var(--mist)]">Alert Severity</span>
                  <select
                    value={alertSeverity}
                    onChange={(e) => setAlertSeverity(e.target.value)}
                    className="w-full bg-[var(--ink)] border border-[var(--navy-line)] rounded-xl p-2.5 text-white capitalize"
                  >
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </label>

                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="accent-[var(--saffron)] w-4 h-4"
                    />
                    <span className="text-white">Rule Active</span>
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--navy-line)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[var(--navy-line)] text-[var(--mist)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[var(--saffron)] text-[var(--ink)] font-bold hover:brightness-110 transition-all"
                >
                  {editingRule ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

