import React, { useState } from 'react';

export default function AlertDispatchView() {
  const [incidentId, setIncidentId] = useState('INC-8492');
  const [zone, setZone] = useState('zone_north');
  const [urgency, setUrgency] = useState('high');
  const [targetRoles, setTargetRoles] = useState(['operator', 'supervisor']);
  const [message, setMessage] = useState('High priority alert triggered for zone north dispatch.');
  const [dispatches, setDispatches] = useState([]);

  const handleDispatch = (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const isSuppressed = dispatches.some(
      (d) => d.zone === zone && d.urgency === urgency && new Date(now) - new Date(d.timestamp) < 300000
    );

    const newEntry = {
      alert_id: isSuppressed ? 'ALT-SUPPRESSED' : `ALT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      incident_id: incidentId,
      zone: zone,
      urgency: urgency,
      status: isSuppressed ? 'suppressed' : 'dispatched',
      roles: targetRoles,
      timestamp: now,
      message: message
    };

    setDispatches([newEntry, ...dispatches]);
  };

  const handleAck = (id) => {
    setDispatches(
      dispatches.map((d) => (d.alert_id === id ? { ...d, status: 'acknowledged' } : d))
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dynamic Alert Dispatch & Suppression</h1>
          <p className="text-xs text-gray-500">Hash-based deduplication window, targeted routing, and acknowledgment workflow.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trigger Notification</h2>
          <form onSubmit={handleDispatch} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Target Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
              >
                <option value="zone_north">Zone North</option>
                <option value="zone_south">Zone South</option>
                <option value="sector_4">Sector 4</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Urgency Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Alert Message</label>
              <textarea
                rows="2"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-transparent border-gray-300 dark:border-gray-600"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
            >
              Dispatch Alert
            </button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Routing & Suppression Log ({dispatches.length})</h2>
          {dispatches.map((d, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">{d.alert_id} ({d.zone})</span>
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                  d.status === 'dispatched' ? 'bg-emerald-100 text-emerald-700' :
                  d.status === 'suppressed' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {d.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">{d.message}</p>
              {d.status === 'dispatched' && (
                <button
                  onClick={() => handleAck(d.alert_id)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[11px] font-semibold"
                >
                  Acknowledge Alert
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}