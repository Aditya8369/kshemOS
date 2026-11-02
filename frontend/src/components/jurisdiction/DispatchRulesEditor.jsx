import { useState } from 'react';

export default function DispatchRulesEditor({
  dispatchRules = [],
  serviceAreas = [],
  onSaveRule,
  onDeleteRule,
  store,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    id: '',
    name: '',
    jurisdiction_id: 'JUR-DELHI-METRO',
    service_area_id: serviceAreas[0]?.id || 'SA-CENTRAL-01',
    categories: ['scam_call'],
    min_severity: 'critical',
    target_desk: 'DESK-CYBER-CRIT',
    overflow_service_area_id: 'SA-SOUTH-01',
    priority: 1,
    enabled: true,
  });

  // Simulator State
  const [simCategory, setSimCategory] = useState('scam_call');
  const [simSeverity, setSimSeverity] = useState('critical');
  const [simRegion, setSimRegion] = useState('Central Zone');
  const [simResult, setSimResult] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function runSimulation() {
    if (!store?.matchDispatchRule) return;
    const matched = store.matchDispatchRule(simCategory, simSeverity, simRegion);
    setSimResult(matched);
  }

  async function handleAddRule(e) {
    e.preventDefault();
    if (!newRule.name.trim() || !newRule.target_desk.trim()) {
      setError('Rule name and target desk are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...newRule,
        id: newRule.id.trim() || `DISP-${Date.now().toString().slice(-6)}`,
      };
      await onSaveRule(payload);
      setShowAddForm(false);
      setNewRule({
        id: '',
        name: '',
        jurisdiction_id: 'JUR-DELHI-METRO',
        service_area_id: serviceAreas[0]?.id || 'SA-CENTRAL-01',
        categories: ['scam_call'],
        min_severity: 'critical',
        target_desk: '',
        overflow_service_area_id: '',
        priority: dispatchRules.length + 1,
        enabled: true,
      });
    } catch (err) {
      setError(err.message || 'Failed to add dispatch rule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Rules Table & Controls Header */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--navy-line)] pb-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-[var(--saffron)]">
              Automated Incident Routing
            </div>
            <h2 className="font-display text-xl font-semibold mt-1">Dispatch Rules & Boundary Routing</h2>
            <p className="text-xs text-[var(--mist)] mt-0.5">
              Routes verified citizen reports to target desks and activates overflow failover when capacity is exceeded.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="self-start px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--saffron)] text-white hover:brightness-110 transition shadow-md"
          >
            {showAddForm ? '✕ Close Form' : '+ Add Dispatch Rule'}
          </button>
        </div>

        {/* Add Rule Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddRule}
            className="p-4 rounded-xl bg-[var(--ink)] border border-[var(--navy-line)] space-y-3 text-xs animate-fade-in"
          >
            <div className="font-bold text-sm text-[var(--saffron)]">Create New Dispatch Rule</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Rule Name</label>
                <input
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. UPI Phishing Rapid Response"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Service Area</label>
                <select
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
                  value={newRule.service_area_id}
                  onChange={(e) => setNewRule({ ...newRule, service_area_id: e.target.value })}
                >
                  {serviceAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name} ({sa.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Target Desk</label>
                <input
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white font-mono"
                  value={newRule.target_desk}
                  onChange={(e) => setNewRule({ ...newRule, target_desk: e.target.value })}
                  placeholder="e.g. OFF-CYBER-TASKFORCE"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                  Incident Category
                </label>
                <select
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
                  value={newRule.categories[0] || '*'}
                  onChange={(e) => setNewRule({ ...newRule, categories: [e.target.value] })}
                >
                  <option value="*">All Categories (*)</option>
                  <option value="scam_call">Scam Calls / Digital Arrest</option>
                  <option value="fraud_tx">Financial Fraud & UPI</option>
                  <option value="fake_currency">Counterfeit Currency</option>
                  <option value="atm_skimming">ATM & POS Skimming</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                  Minimum Severity Threshold
                </label>
                <select
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
                  value={newRule.min_severity}
                  onChange={(e) => setNewRule({ ...newRule, min_severity: e.target.value })}
                >
                  <option value="low">Low (Intake & Audit)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">
                  Overflow Service Area (Failover)
                </label>
                <select
                  className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
                  value={newRule.overflow_service_area_id}
                  onChange={(e) => setNewRule({ ...newRule, overflow_service_area_id: e.target.value })}
                >
                  <option value="">None</option>
                  {serviceAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-[var(--alert)]">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded border border-[var(--navy-line)] text-[var(--mist)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded bg-[var(--saffron)] text-white font-semibold"
              >
                {saving ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Rules Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--navy-line)] text-[var(--mist)] font-mono uppercase text-[10px]">
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Rule Name & Scope</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Min Severity</th>
                <th className="py-2.5 px-3">Assigned Desk</th>
                <th className="py-2.5 px-3">Overflow Redirect</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--navy-line)]">
              {dispatchRules.map((rule) => {
                const targetSa = serviceAreas.find((sa) => sa.id === rule.service_area_id);
                const overflowSa = serviceAreas.find((sa) => sa.id === rule.overflow_service_area_id);

                return (
                  <tr key={rule.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3 font-mono font-bold text-[var(--saffron)]">#{rule.priority}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{rule.name}</div>
                      <div className="text-[11px] text-[var(--mist)] font-mono">
                        {targetSa ? `${targetSa.name} (${targetSa.region})` : rule.service_area_id}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono px-2 py-0.5 rounded bg-white/10 text-white">
                        {(rule.categories || []).join(', ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-mono px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          rule.min_severity === 'critical'
                            ? 'bg-red-500/20 text-red-300'
                            : rule.min_severity === 'high'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/10 text-white/80'
                        }`}
                      >
                        {rule.min_severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-white">{rule.target_desk}</td>
                    <td className="py-3 px-3 font-mono text-[var(--mist)]">
                      {overflowSa ? overflowSa.name : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/40 font-mono text-[11px]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Simulation & Routing Tester */}
      <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-6 text-white space-y-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--saffron)]">Interactive Verification</div>
          <h3 className="font-display text-lg font-semibold mt-0.5">Test Dispatch Routing Decision</h3>
          <p className="text-xs text-[var(--mist)] mt-0.5">
            Simulate incoming incident signals to verify how rules evaluate destination desks in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[var(--ink)] p-4 rounded-xl border border-[var(--navy-line)] text-xs">
          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Simulated Category</label>
            <select
              className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
              value={simCategory}
              onChange={(e) => setSimCategory(e.target.value)}
            >
              <option value="scam_call">scam_call</option>
              <option value="fraud_tx">fraud_tx</option>
              <option value="counterfeit_currency">counterfeit_currency</option>
              <option value="atm_skimming">atm_skimming</option>
              <option value="other">other</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Severity</label>
            <select
              className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
              value={simSeverity}
              onChange={(e) => setSimSeverity(e.target.value)}
            >
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--mist)] mb-1">Region</label>
            <select
              className="w-full bg-[var(--navy)] border border-[var(--navy-line)] rounded p-2 text-white"
              value={simRegion}
              onChange={(e) => setSimRegion(e.target.value)}
            >
              <option value="Central Zone">Central Zone</option>
              <option value="North Zone">North Zone</option>
              <option value="South Zone">South Zone</option>
              <option value="East Zone">East Zone</option>
              <option value="West Zone">West Zone</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={runSimulation}
              className="w-full py-2 rounded font-semibold bg-[var(--saffron)] text-white hover:brightness-110 transition shadow-sm"
            >
              Simulate Dispatch
            </button>
          </div>
        </div>

        {simResult && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1 text-emerald-200 animate-fade-in">
            <div className="font-bold flex items-center gap-2 text-emerald-300">
              <span>✓ Match Found:</span> {simResult.name} ({simResult.id})
            </div>
            <div>
              Target Assigned Officer/Desk: <span className="font-mono font-bold text-white">{simResult.target_desk}</span>
            </div>
            {simResult.overflow_service_area_id && (
              <div>
                Designated Overflow Failover:{' '}
                <span className="font-mono text-white">{simResult.overflow_service_area_id}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

