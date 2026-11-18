import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getSyncStateMeta, SYNC_STATES } from '../../syncStatusMeta';

/**
 * Accessible status badge for field teams showing live, offline, pending, and conflict states.
 * Uses text tags, icons, and distinct borders so state is never conveyed by color alone.
 */
export default function SyncStateBadge({
  meta = null,
  syncStatus = null,
  isOnline = true,
  isSimulated = false,
  version = null,
  size = 'sm',
  showTag = true,
  onClick = null,
  className = '',
}) {
  const resolvedMeta =
    meta ||
    getSyncStateMeta({
      isOnline,
      isSimulated,
      syncStatus,
      version,
    });

  const iconSize = size === 'lg' ? 15 : size === 'md' ? 13 : 11;

  function renderIcon() {
    switch (resolvedMeta.state) {
      case SYNC_STATES.CONFLICT:
        return <AlertTriangle size={iconSize} className="text-rose-400 shrink-0 animate-pulse" aria-hidden="true" />;
      case SYNC_STATES.FAILED:
        return <AlertTriangle size={iconSize} className="text-rose-400 shrink-0" aria-hidden="true" />;
      case SYNC_STATES.PENDING:
        if (syncStatus === 'syncing') {
          return <RefreshCw size={iconSize} className="text-amber-400 shrink-0 animate-spin" aria-hidden="true" />;
        }
        return <Clock size={iconSize} className="text-amber-400 shrink-0" aria-hidden="true" />;
      case SYNC_STATES.OFFLINE:
        return <WifiOff size={iconSize} className="text-amber-400 shrink-0" aria-hidden="true" />;
      case SYNC_STATES.LIVE:
      default:
        return <CheckCircle2 size={iconSize} className="text-emerald-400 shrink-0" aria-hidden="true" />;
    }
  }

  const basePadding =
    size === 'lg' ? 'px-3 py-1.5 text-xs' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';

  const badgeContent = (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-full border transition-all ${basePadding} ${resolvedMeta.badgeClassName} ${className}`}
      title={resolvedMeta.explanation}
      aria-label={resolvedMeta.ariaLabel}
    >
      {renderIcon()}
      {showTag && (
        <span className="opacity-75 text-[9px] uppercase tracking-wider" aria-hidden="true">
          {resolvedMeta.tag}
        </span>
      )}
      <span className="truncate">{resolvedMeta.label}</span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={resolvedMeta.ariaLabel}
        className="cursor-pointer hover:brightness-110 active:scale-95 transition-transform inline-flex focus:outline-none focus:ring-2 focus:ring-[var(--saffron)] rounded-full"
      >
        {badgeContent}
      </button>
    );
  }

  return badgeContent;
}
