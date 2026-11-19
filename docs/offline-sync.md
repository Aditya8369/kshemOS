# Offline Incident Drafting and Conflict-Aware Sync

Field responders may lose connectivity while documenting an incident. KshemOS
keeps a protected local draft queue and reconciles it with the server when the
device reconnects. The server never silently overwrites a conflicting change.

## Guarantees

| Guarantee | Implementation |
|---|---|
| Offline create and edit | `frontend/src/syncQueue.js` queues creates and updates |
| Stable operation ID + local timestamp | `createOperationId()` and monotonic `clientTimestamp` per queued item |
| Server-change detection | `expected_version` checked server-side; `409` includes the current server incident |
| Manual conflict review | `ConflictResolutionModal` offers keep-mine, keep-server, and field merge |
| Visible states | `pending`, `syncing`, `synced`, `failed`, `conflict` in the outbox drawer and banner |
| Idempotent retries | Server ledger keyed by `(subject, operation_id)` in `sync_operations` |
| Encrypted local drafts | AES-GCM via Web Crypto, ciphertext in IndexedDB, non-extractable key |
| Local-data cleanup | `clearOfflineData()` on logout, revocation, or manual wipe |

## Queue record

Each queued change carries:

```json
{
  "queueId": "Q-...",
  "operationId": "op-...",
  "action": "update",
  "incidentId": "INC-0007",
  "changes": { "status": "in_progress" },
  "baseVersion": 2,
  "baseSnapshot": { "version": 2 },
  "status": "pending",
  "queuedAt": 1763000000000,
  "clientTimestamp": 1763000000000,
  "retryCount": 0,
  "error": null,
  "serverConflictData": null,
  "force": false
}
```

Creates additionally carry `localIncidentId` (`INC-PENDING-...`), which lets an
update queued against an unsynced draft resolve to the server ID created by the
same or an earlier batch.

Operation IDs are generated once at enqueue time and are **never regenerated on
retry**. Conflict resolutions (`keep_mine`, `merge`) deliberately issue a new
operation ID because they are new logical operations.

## Sync protocol

1. The client selects non-conflicting items and sorts them by
   `clientTimestamp` (monotonic, so same-millisecond edits keep authoring order).
2. Expected versions are chained per incident: the first item uses its
   `baseVersion`, later items expect the next version. Consecutive offline edits
   therefore do not conflict with each other.
3. Items are posted to `POST /api/incidents/sync` with `operation_id`,
   `client_timestamp`, `expected_version`, and `force`.
4. The server orders the batch by `client_timestamp`, applies creates before
   dependent updates (via `local_incident_id`), and consults the idempotency
   ledger before every mutation.
5. Results are applied by `queue_id`:
   - `applied` → remove from the queue, append to the capped sync history.
   - `conflict` → mark the item `conflict`, store `server_incident` and
     `conflicting_fields`, keep it until the user resolves it.
   - `failed` → mark `failed` with the server error; retry is explicit.

### Idempotency ledger

`sync_operations` stores the original result for `(subject, operation_id)`:

- `POST /api/incidents`
- `PATCH /api/incidents/{id}`
- `POST /api/incidents/sync`

Replaying an operation returns the stored result with `"replayed": true`. It
does not bump the version, append notes twice, or create a second incident.
Non-existent incidents are not cached, so a retry can succeed once an earlier
create has synced. The ledger is scoped by authenticated subject, and a
per-operation lock serialises concurrent duplicate requests inside a worker so
they cannot both apply the mutation.

## Conflict handling

A `409` (or a `conflict` batch result) means the server version differs from the
field unit's `expected_version`. The field user chooses:

- **Keep server** — discard the local change.
- **Keep mine** — re-submit with `force: true` and a new operation ID.
- **Merge** — edit the conflicting fields and re-submit with `force: true` and a
  new operation ID.

The server records forced overwrites as normal updates (version increments, and
the outbox history records the resolution).

## Local storage and encryption

- Draft queue, sync history, and the incident cache are encrypted with
  **AES-GCM** through Web Crypto.
- The device key is a non-extractable `CryptoKey` stored in IndexedDB.
- Ciphertext lives in IndexedDB (`kshemos-secure-drafts`) under the
  `kshemos.sync_queue.v1`, `kshemos.sync_history.v1`, `kshemos.incidents.v1`,
  `kshemos.staffing.v1`, and `kshemos.cache.incidents.v2` records.
- Legacy plaintext records for any of those keys found in `localStorage` are
  migrated into the encrypted store and then deleted.
- If IndexedDB or Web Crypto is unavailable, drafts remain in memory for the
  session and are not written to plaintext storage.

**Threat model limitation:** a browser app cannot bind keys to a hardware
keystore. The encryption protects against casual device/filesystem inspection
and other-origin scripts. Script running in this origin can access decrypted
drafts while the page is open. A native wrapper could add OS keystore binding.

## Cleanup policy

`clearOfflineData(reason)` purges the encrypted queue, sync history, device
key, cached incidents, staffing cache, and the offline simulator flag.

| Trigger | Reason | Behaviour |
|---|---|---|
| "Sign out & wipe device data" | `logout` | Full local purge; queued drafts are discarded |
| API returns `401` | `session_revoked` | Full local purge, because device/session access was revoked |
| Manual purge API call | `manual` | Full local purge |
| Normal operation | — | Synced history expires after **7 days** and is capped at **30 entries** |

Unsynced drafts are retained until they sync or the user discards them. They are
never silently dropped because of age; the device UI surfaces them as pending or
failed.

Multi-user devices: the secure cache is per browser profile, so a shared device
must run the wipe action (or logout) between users. Logout does this
automatically.

## Permissions

| Role | Incident permissions relevant here |
|---|---|
| Officer | read, create, update, sync (scoped to configured jurisdictions/cases) |
| Supervisor | read, create, update, sync, manage staffing |
| Admin | read, create, update, sync, manage staffing |

Creates are rejected for regions outside the caller's configured jurisdictions.
Updates and sync results are filtered by incident scope, and sync results pass
through the same field-level redaction as the feed.

## Tests

Backend:

```bash
cd backend
python3 -m pytest tests/test_offline_sync.py tests/test_offline_sync_hardening.py -q
```

Frontend:

```bash
cd frontend
node --test src/syncQueue.test.js src/syncQueueHardening.test.js src/secureDraftStore.test.js
```

Covered cases: duplicate retries, concurrent duplicate retries, duplicate
creates, note de-duplication, out-of-order timestamps, chained edits,
create-then-update in one batch, conflict replay, forced resolution, merge,
encryption at rest (queue and local draft store), and cleanup.
