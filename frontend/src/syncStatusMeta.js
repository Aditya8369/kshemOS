/**
 * Truth-in-state synchronization metadata for field responder teams.
 *
 * Ground rules for field units:
 * 1. An action saved offline or queued in local storage has NOT reached HQ yet.
 * 2. Only server-acknowledged responses (with confirmed server version) are 'live/synced'.
 * 3. Statuses must be distinguishable by clear text tags and icons, not color alone.
 * 4. Responders must be offered immediate paths to review queued or conflicting records.
 */

export const SYNC_STATES = {
  LIVE: 'live',
  OFFLINE: 'offline',
  PENDING: 'pending',
  CONFLICT: 'conflict',
  FAILED: 'failed',
};

export const TRUTH_IN_STATE_NOTICE =
  'CRITICAL FIELD DISPATCH NOTICE: An offline or queued update is stored locally on this device only and has NOT reached Headquarters or central command until confirmed by server acknowledgment.';

/**
 * Determine the unified sync state and descriptive metadata.
 *
 * @param {object} params
 * @param {boolean} [params.isOnline=true] - Current network connectivity.
 * @param {boolean} [params.isSimulated=false] - Whether simulated offline mode is active.
 * @param {'synced' | 'pending' | 'conflict' | 'failed' | 'syncing' | null} [params.syncStatus=null] - Specific record sync status.
 * @param {number} [params.queueCount=0] - Number of items currently queued in outbox.
 * @param {number} [params.conflictCount=0] - Number of unresolved conflicts.
 * @param {number} [params.failedCount=0] - Number of failed transmissions.
 * @param {number|string|null} [params.version=null] - Confirmed server version if synced.
 */
export function getSyncStateMeta({
  isOnline = true,
  isSimulated = false,
  syncStatus = null,
  queueCount = 0,
  conflictCount = 0,
  failedCount = 0,
  version = null,
} = {}) {
  // 1. Conflict takes top priority (requires manual human resolution)
  if (syncStatus === 'conflict' || conflictCount > 0) {
    return {
      state: SYNC_STATES.CONFLICT,
      label: 'Sync Conflict',
      tag: '[CONFLICT]',
      ariaLabel: 'Sync Conflict: Local field update diverges from Headquarters record and requires manual resolution',
      isLocalOnly: true,
      isServerConfirmed: false,
      badgeVariant: 'conflict',
      badgeClassName: 'bg-rose-500/20 text-rose-300 border-rose-500 ring-1 ring-rose-500/50',
      icon: 'alert-triangle',
      explanation:
        'HQ Version Conflict: Headquarters record was modified while this unit was offline. Local changes have NOT been applied to HQ yet. Human review required.',
      actionRecommendation: 'Review and resolve conflicting fields before dispatching.',
    };
  }

  // 2. Failed push
  if (syncStatus === 'failed' || (failedCount > 0 && queueCount === 0)) {
    return {
      state: SYNC_STATES.FAILED,
      label: 'Push Failed',
      tag: '[FAILED]',
      ariaLabel: 'Push Failed: Local field update could not be delivered to Headquarters',
      isLocalOnly: true,
      isServerConfirmed: false,
      badgeVariant: 'failed',
      badgeClassName: 'bg-rose-950/40 text-rose-300 border-rose-500/40',
      icon: 'alert-triangle',
      explanation:
        'Transmission Failed: The queued change failed to reach Headquarters. Stored safely in local encrypted storage. Ready for retry.',
      actionRecommendation: 'Check network uplink and retry from the Outbox.',
    };
  }

  // 3. Pending sync (in local outbox queue)
  if (syncStatus === 'pending' || syncStatus === 'syncing' || queueCount > 0) {
    const isCurrentlySyncing = syncStatus === 'syncing';
    return {
      state: SYNC_STATES.PENDING,
      label: isCurrentlySyncing ? 'Syncing to HQ…' : 'Local Pending',
      tag: isCurrentlySyncing ? '[SYNCING]' : '[LOCAL ONLY]',
      ariaLabel: isCurrentlySyncing
        ? 'Syncing: Transmitting local field updates to Headquarters'
        : 'Pending Sync: Saved locally on this device only; has not reached Headquarters yet',
      isLocalOnly: true,
      isServerConfirmed: false,
      badgeVariant: 'pending',
      badgeClassName: 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30',
      icon: isCurrentlySyncing ? 'refresh-cw' : 'clock',
      explanation:
        'Saved locally on this device only — has NOT reached Headquarters yet. Update is queued in encrypted device storage and will synchronize once connectivity is confirmed.',
      actionRecommendation: 'Review Outbox to monitor queue or trigger manual sync.',
    };
  }

  // 4. Device offline / simulated offline (with clean queue)
  if (!isOnline || isSimulated) {
    return {
      state: SYNC_STATES.OFFLINE,
      label: isSimulated ? 'Simulated Offline' : 'Field Offline',
      tag: '[OFFLINE]',
      ariaLabel: isSimulated
        ? 'Simulated Offline: Network testing mode active; local storage engaged'
        : 'Field Offline: Cellular connection unavailable; local storage engaged',
      isLocalOnly: true,
      isServerConfirmed: false,
      badgeVariant: 'offline',
      badgeClassName: 'bg-amber-950/40 text-amber-300 border-amber-500/60',
      icon: 'wifi-off',
      explanation:
        'Field Offline: Network connection unreachable. All actions and incident records are preserved in local encrypted storage and will NOT reach Headquarters until reconnected.',
      actionRecommendation: 'Proceed with local on-scene entries; updates will queue automatically.',
    };
  }

  // 5. Live / Server Confirmed
  const versionText = version ? ` (v${version})` : '';
  return {
    state: SYNC_STATES.LIVE,
    label: `HQ Confirmed${versionText}`,
    tag: '[HQ CONFIRMED]',
    ariaLabel: `HQ Confirmed: Synchronized and acknowledged by Headquarters server${versionText}`,
    isLocalOnly: false,
    isServerConfirmed: true,
    badgeVariant: 'live',
    badgeClassName: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/60 ring-1 ring-emerald-500/30',
    icon: 'check-circle',
    explanation: `Confirmed by Headquarters server${versionText}. Real-time operational sync is active.`,
    actionRecommendation: 'Operational data is fully synchronized with Command Center.',
  };
}

/**
 * Returns user-facing outcome copy for a completed action,
 * explicitly telling the officer whether it is saved locally or confirmed by HQ.
 */
export function explainActionOutcome({ actionName = 'Update', syncStatus, isOnline = true, version = null }) {
  if (syncStatus === 'synced' || (isOnline && syncStatus !== 'pending' && syncStatus !== 'conflict')) {
    return {
      savedLocally: true,
      confirmedByServer: true,
      badge: 'HQ Confirmed',
      message: `${actionName} confirmed by Headquarters server${version ? ` (v${version})` : ''}.`,
      severity: 'success',
    };
  }

  if (syncStatus === 'conflict') {
    return {
      savedLocally: true,
      confirmedByServer: false,
      conflict: true,
      badge: 'Conflict Detected',
      message: `${actionName} caused a version conflict with Headquarters. Review and resolve before updates apply to HQ.`,
      severity: 'error',
    };
  }

  return {
    savedLocally: true,
    confirmedByServer: false,
    badge: 'Saved Locally Only',
    message: `${actionName} saved locally to this device only. It has NOT reached Headquarters yet (queued for sync).`,
    severity: 'warning',
  };
}
