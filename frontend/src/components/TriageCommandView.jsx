import React, { useState } from 'react';

const SEVERITY_STYLES = {
  critical: 'bg-red-600 text-white border-red-700',
  high: 'bg-orange-500 text-white border-orange-600',
  medium: 'bg-amber-400 text-gray-900 border-amber-500',
  low: 'bg-emerald-500 text-white border-emerald-600'
};

export default function TriageCommandView({ userRole = 'supervisor' }) {
  const [incidentId] = useState('INC-8492');
  const [triageData, setTriageData] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [targetSeverity, setTargetSeverity] = useState('critical');

  const handleRunTriage = () => {
    const now = new Date().toISOString();
    setTriageData({
      incident_id: incidentId,
      current_severity: 'high',
      auto_calculated_severity: 'high',
      is_overridden: false,
      history: [
        {
          timestamp: now,
          previous_severity: null,
          new_severity: 'high',
          updated_by: 'SYSTEM_TRIAGE_ENGINE',
          action_type: 'AUTOMATED_TRIAGE',
          reason: 'Initial score: Urgent call impersonating law enforcement.'
        }
      ]
    });
  };

  const handleApplyOverride = (e) => {
    e.preventDefault();
    if (!triageData || !overrideReason) return;
    
    const now = new Date().toISOString();
    const prevSev = triageData.current_severity;

    setTriageData({
      ...triageData,
      current_severity: targetSeverity,
      is_overridden: true,
      history: [
        ...triageData.history,
        {
          timestamp: now,
          previous_severity: prevSev,
          new_severity: targetSeverity,
          updated_by: `Supervisor (${userRole})`,
          action_type: 'SUPERVISOR_OVERRIDE',
          reason: overrideReason
        }
      ]
    });
    setOverrideReason('');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Incident Triage & Command Status</h1>
          <p className="text-xs text-gray-500">Automated severity scoring engine with supervisor override capability.</p>
        </div>
        <button 
          onClick={handleRunTriage}
          className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
        >
          Evaluate Incident ({incidentId})
        </button>
      </div>

      {triageData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Priority Status</h2>
            <div className={`p-4 rounded-xl border text-center font-bold text-lg uppercase tracking-wider ${SEVERITY_STYLES[triageData.current_severity]}`}>
              {triageData.current_severity} PRIORITY
            </div>
            {triageData.is_overridden && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center">
                ⚠️ Supervisor Override Active (Auto Score: {triageData.auto_calculated_severity})
              </p>
            )}
          </div>

          <div className="md:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Supervisor Severity Override</h2>
            <form onSubmit={handleApplyOverride} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">New Severity</label>
                  <select 
                    value={targetSeverity}
                    onChange={(e) => setTargetSeverity(e.target.value)}
                    className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Override Reason</label>
                  <input 
                    type="text"
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Escalated per officer on scene"
                    className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <button type="submit" className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
                Apply Override
              </button>
            </form>
          </div>

          <div className="md:col-span-3 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Triage & Severity History</h2>
            <div className="space-y-2 text-xs">
              {triageData.history.map((h, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">[{h.action_type}]</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-300">Updated to <strong className="uppercase">{h.new_severity}</strong> by {h.updated_by}</span>
                    {h.reason && <p className="text-gray-500 text-[11px] mt-0.5">{h.reason}</p>}
                  </div>
                  <span className="font-mono text-gray-400 text-[10px]">{new Date(h.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}