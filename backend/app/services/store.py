"""Report storage with in-memory and PostgreSQL backends."""

from __future__ import annotations

import itertools
from copy import deepcopy
from threading import Lock
from typing import Any

from app.services.persistence import (
    ReportRecord,
    get_session,
    next_id,
    persistence_backend,
)

_report_id_counter = itertools.count(1)
_reports: dict[str, dict[str, Any]] = {}
_lock = Lock()


def save_report(report: dict[str, Any]) -> str:
    if persistence_backend() == "postgres":
        report_id = next_id("report", "RPT")

        with get_session() as session:
            session.add(
                ReportRecord(
                    id=report_id,
                    payload=deepcopy(report),
                )
            )
            session.commit()

        return report_id

    with _lock:
        report_id = f"RPT-{next(_report_id_counter):04d}"
        _reports[report_id] = deepcopy(report)

    return report_id


def get_report(report_id: str) -> dict[str, Any] | None:
    if persistence_backend() == "postgres":
        with get_session() as session:
            record = session.get(ReportRecord, report_id)
            return deepcopy(record.payload) if record else None

    with _lock:
        report = _reports.get(report_id)
        return deepcopy(report) if report is not None else None


def all_reports() -> list[dict[str, Any]]:
    if persistence_backend() == "postgres":
        with get_session() as session:
            records = session.query(ReportRecord).order_by(
                ReportRecord.created_at
            ).all()
            return [deepcopy(record.payload) for record in records]

    with _lock:
        return [deepcopy(report) for report in _reports.values()]


def reset() -> None:
    """Clear the in-memory report store. Intended for tests."""
    global _report_id_counter

    with _lock:
        _reports.clear()
        _report_id_counter = itertools.count(1)