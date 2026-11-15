"""Idempotency ledger for offline incident operations.

Field clients may retry a queued operation after a timeout even though the
server already applied it. Operations carry a client-generated ``operation_id``;
the first application stores its result, and every later attempt returns that
stored result without mutating incident state again.

The ledger is scoped by authenticated subject so one principal can never replay
(or probe) another principal's operation IDs.
"""

from __future__ import annotations

import contextlib
import threading
import time
from typing import Any

from app.services.persistence import (
    SyncOperationRecord,
    get_session,
    persistence_backend,
)

_ledger_lock = threading.Lock()
_applied: dict[tuple[str, str], dict[str, Any]] = {}

# Serialise attempts for the same operation. FastAPI runs synchronous endpoints
# in a thread pool, so two duplicate retries can otherwise both observe an empty
# ledger and apply the mutation twice.
_operation_locks: dict[tuple[str, str], threading.Lock] = {}
_operation_locks_guard = threading.Lock()


def _is_postgres() -> bool:
    return persistence_backend() == "postgres"


def _now_ms() -> int:
    return int(time.time() * 1000)


@contextlib.contextmanager
def operation_lock(subject: str | None, operation_id: str | None):
    """Hold an exclusive lock for one subject/operation pair.

    No-op when the client did not supply an operation ID (idempotency off).
    """

    if not operation_id:
        yield
        return

    key = (subject or "anonymous", operation_id)

    with _operation_locks_guard:
        lock = _operation_locks.setdefault(key, threading.Lock())

    with lock:
        yield


def get_result(
    subject: str | None, operation_id: str | None
) -> dict[str, Any] | None:
    """Return a previously stored result for this subject/operation."""

    if not operation_id:
        return None

    scope = subject or "anonymous"

    if _is_postgres():
        with get_session() as session:
            record = session.get(SyncOperationRecord, (scope, operation_id))
            return dict(record.payload) if record else None

    with _ledger_lock:
        stored = _applied.get((scope, operation_id))
        return dict(stored) if stored is not None else None


def record_result(
    subject: str | None,
    operation_id: str | None,
    result: dict[str, Any],
) -> None:
    """Persist the result of an applied operation."""

    if not operation_id:
        return

    scope = subject or "anonymous"

    if _is_postgres():
        with get_session() as session:
            record = session.get(SyncOperationRecord, (scope, operation_id))
            if record is None:
                session.add(
                    SyncOperationRecord(
                        subject=scope,
                        operation_id=operation_id,
                        payload=result,
                        applied_at=_now_ms(),
                    )
                )
                session.commit()
        return

    with _ledger_lock:
        _applied[(scope, operation_id)] = result


def reset() -> None:
    """Clear the in-memory ledger (used by tests and store resets)."""

    with _ledger_lock:
        _applied.clear()

    with _operation_locks_guard:
        _operation_locks.clear()
