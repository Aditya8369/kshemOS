import { useState, useEffect } from 'react';
import { AlertTriangle, Siren, X, ChevronRight, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { fetchActiveBannerApi, BROADCAST_CHANGED_EVENT } from '../api.js';

export default function EmergencyPortalBanner({ onOpenAdvisory = () => {} }) {
  const [banner, setBanner] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadBanner() {
      try {
        const res = await fetchActiveBannerApi();
        if (mounted) setBanner(res);
      } catch (err) {
        console.error('Failed to load active emergency banner:', err);
      }
    }
    loadBanner();
    window.addEventListener(BROADCAST_CHANGED_EVENT, loadBanner);
    return () => {
      mounted = false;
      window.removeEventListener(BROADCAST_CHANGED_EVENT, loadBanner);
    };
  }, []);

  if (!banner || dismissed) return null;

  const isCritical = banner.severity === 'critical';

  return (
    <div
      role="alert"
      className={`relative z-50 border-b shadow-lg transition-all ${
        isCritical
          ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-red-600 text-white'
          : 'bg-gradient-to-r from-amber-950 via-yellow-900 to-amber-950 border-amber-600 text-amber-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase text-[10px] ${
              isCritical
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-amber-500 text-black font-semibold'
            }`}
          >
            <Siren size={12} className="animate-spin" />
            <span>{banner.severity} Siren</span>
          </span>

          <span className="font-semibold truncate text-[13px] tracking-wide">
            {banner.marquee_text}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMuted(!muted)}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
            title={muted ? 'Unmute siren' : 'Mute siren'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} className="animate-pulse" />}
          </button>

          <button
            onClick={() => onOpenAdvisory(banner.advisory_id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition shadow-sm ${
              isCritical
                ? 'bg-white text-red-950 hover:bg-red-100'
                : 'bg-amber-400 text-amber-950 hover:bg-amber-300'
            }`}
          >
            <span>{banner.action_text || 'View Directives'}</span>
            <ChevronRight size={13} />
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition ml-1"
            title="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
