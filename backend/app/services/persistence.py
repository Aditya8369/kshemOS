"""Database configuration and SQLAlchemy persistence models."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy import BigInteger, DateTime, Integer, JSON, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class ReportRecord(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class IncidentRecord(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    report_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    opened_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False)


class IDCounter(Base):
    __tablename__ = "id_counters"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class StaffingRecord(Base):
    __tablename__ = "staffing"

    region: Mapped[str] = mapped_column(String(100), primary_key=True)
    officers_on_duty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


def persistence_backend() -> str:
    return os.getenv("PERSISTENCE_BACKEND", "memory").strip().lower()


def database_url() -> str | None:
    url = os.getenv("DATABASE_URL")
    if not url:
        return None

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    return url


@lru_cache(maxsize=1)
def get_engine():
    url = database_url()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is required when PERSISTENCE_BACKEND=postgres"
        )

    return create_engine(url, pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_session_factory():
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        expire_on_commit=False,
    )


def get_session():
    return get_session_factory()()


def init_db() -> None:
    """Initialize database tables for local development and tests."""
    Base.metadata.create_all(bind=get_engine())


def next_id(name: str, prefix: str) -> str:
    """Allocate sequential IDs atomically in PostgreSQL."""
    from sqlalchemy.dialects.postgresql import insert

    statement = (
        insert(IDCounter)
        .values(name=name, value=1)
        .on_conflict_do_update(
            index_elements=[IDCounter.name],
            set_={"value": IDCounter.value + 1},
        )
        .returning(IDCounter.value)
    )

    with get_session() as session:
        value = session.execute(statement).scalar_one()
        session.commit()

    return f"{prefix}-{value:04d}"