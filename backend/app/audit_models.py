"""Pydantic response models for the audit logging API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


AuditOutcome = Literal["success", "failure", "denied"]
AuditRiskLevel = Literal["low", "medium", "high"]


class AuditEventResponse(BaseModel):
    """A single immutable audit event."""

    event_id: str
    actor_id: str
    actor_role: str
    action: str
    resource_type: str
    resource_id: str | None = None

    outcome: AuditOutcome
    occurred_at: int = Field(..., ge=0)

    source: str
    metadata: dict[str, Any] = Field(default_factory=dict)

    is_sensitive: bool
    is_unusual: bool
    risk_level: AuditRiskLevel

    previous_hash: str
    event_hash: str


class AuditEventListResponse(BaseModel):
    """Paginated collection of audit events."""

    items: list[AuditEventResponse]

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)
    pages: int = Field(..., ge=0)


class AuditIntegrityResponse(BaseModel):
    """Result of verifying the audit hash chain."""

    valid: bool
    event_count: int = Field(..., ge=0)

    invalid_event_id: str | None = None
    latest_hash: str
