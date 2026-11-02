import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftFromLine,
  ArrowRightToLine,
  CheckCircle2,
  Clock,
  Crosshair,
  Filter,
  Radio,
  Siren,
  Trash2,
} from 'lucide-react';
import { acknowledgeAlert, clearAlerts } from '../../geofenceEngine';

const EVENT_ICONS = {
  entry: ArrowRightToLine,
  exit: ArrowLeftFromLine,
  dwell: Clock,
};

const SEVERITY_STYLES = {
  critical: 'bg-rose-950/50 border-rose-500/80 text-rose-300',
  warning: 'bg-amber-950/50 border-amber-500/80 text-amber-300',
  info: 'bg-blue-950/50 border-blue-500/80 text-blue-300',
};

export default function GeofenceAlertsPanel({
  alerts = [],
  onSelectEntity = () => {},
  onRefresh = () => {},
}) {
  const [filterType, setFilterType] = useState('all');

  const unacked = alerts.filter((a) => !a.acknowledged);

  const filteredAlerts = alerts.filter((alert) => {
    if (filterType === 'all') return true;
    if (filterType === 'unacked') return !alert.acknowledged;
    if (filterType === 'critical') return alert.severity === 'critical';
    if (filterType === 'entry') return alert.eventType === 'entry';
    if (filterType === 'exit') return alert.eventType === 'exit';
    if (filterType === 'dwell') return alert.eventType === 'dwell';
    return true;
  });

  function handleAck(alertId) {
    acknowledgeAlert(alertId);
    onRefresh();
  }

  function handleClear() {
    clearAlerts();
    onRefresh();
  }

  return (
    <div className="bg-[var(--navy)] border border-[var(--navy-line)] rounded-2xl p-4 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--navy-line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Siren size={18} className="text-[var(--saffron)] animate-pulse" />
          <h3 className="font-display font-semibold text-white text-sm">
            Live Geofence Alerts
          </h3>
          {unacked.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
              {unacked.length} ACTIVE
            </span>
          )}
        </div>

        {alerts.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[11px] text-[var(--mist)] hover:text-rose-400 flex items-center gap-1 transition-colors"
            title="Clear all alerts"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-1 mb-3">
        {['all', 'unacked', 'critical', 'entry', 'exit', 'dwell'].map((ft) => (
          <button
            key={ft}
            onClick={() => setFilterType(ft)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-semibold transition-colors ${
              filterType === ft
                ? 'bg-[var(--saffron)] text-[var(--ink)] font-bold'
                : 'bg-[var(--ink)] border border-[var(--navy-line)] text-[var(--mist)] hover:text-white'
            }`}
          >
            {ft === 'unacked' ? `Unread (${unacked.length})` : ft}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[500px]">
        {filteredAlerts.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--mist)] space-y-1">
            <CheckCircle2 size={24} className="mx-auto text-emerald-400 opacity-60 mb-2" />
            <div>No matching geofence alerts.</div>
            <div className="text-[10px] text-[var(--mist)]/70">
              Operational perimeters secure. Unit movements within boundaries.
            </div>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const EventIcon = EVENT_ICONS[alert.eventType] || Radio;
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;

            return (
              <div
                key={alert.id}
                className={`border rounded-xl p-3 space-y-2 transition-all ${
                  alert.acknowledged ? 'opacity-60 bg-[var(--ink)] border-[var(--navy-line)]' : style
                }`}
              >
                {/* Alert Title Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                    <EventIcon size={14} className="shrink-0" />
                    <span className="uppercase">{alert.eventType}</span>
                    <span>·</span>
                    <span className="truncate">{alert.geofenceName}</span>
                  </div>

                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-white/20 uppercase">
                    {alert.severity}
                  </span>
                </div>

                {/* Message Body */}
                <p className="text-xs text-white/90 leading-relaxed font-sans">
                  {alert.message}
                </p>

                {/* Footer Meta & Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] font-mono">
                  <div className="flex items-center gap-2 text-[var(--mist)]">
                    <span className="text-white font-semibold">{alert.entityId}</span>
                    <span>({alert.team})</span>
                    <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectEntity({ type: 'location', data: { lat: alert.lat, lng: alert.lng, id: alert.entityId } })}
                      className="hover:text-white text-[var(--mist)] flex items-center gap-0.5"
                      title="Focus on tactical map"
                    >
                      <Crosshair size={11} />
                      <span>Map</span>
                    </button>

                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAck(alert.id)}
                        className="px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded text-white font-semibold transition-colors"
                      >
                        Ack
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

