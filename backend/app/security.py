from __future__ import annotations
"""Central role, resource-scope, and field-level access controls."""

import json
import os
import secrets
from dataclasses import dataclass, field
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    subject: str
    role: str
    jurisdictions: frozenset[str] = field(default_factory=frozenset)
    case_ids: frozenset[str] = field(default_factory=frozenset)


# Explicit permissions: role -> resource -> permitted actions.
PERMISSION_MATRIX = {
    "citizen": {
        "citizen_reports": {"create"},
    },
    "officer": {
        "incidents": {"read", "update"},
        "dpdp": {"sanitize", "pseudonymize", "request_unmask", "reveal"},
    },
    "supervisor": {
        "incidents": {"read", "update", "manage_staffing"},
        "dpdp": {
            "sanitize", "pseudonymize", "list_unmask",
            "review_unmask", "read_audit",
        },
    },
    "bank": {
        "dpdp": {"sanitize", "pseudonymize"},
    },
    "telecom": {
        "dpdp": {"sanitize", "pseudonymize"},
    },
    "admin": {
        "incidents": {"read", "create", "update", "sync", "manage_staffing"},
        "dpdp": {
            "sanitize", "pseudonymize", "list_unmask",
            "request_unmask", "review_unmask", "reveal", "read_audit",
        },
    },
}


def resolve_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    """Resolve a bearer token to server-configured identity and permissions."""

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_config = os.getenv("KSHEMOS_ACCESS_TOKENS", "")
    if not raw_config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Access-control authentication is not configured",
        )

    try:
        token_map = json.loads(raw_config)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Access-control configuration is invalid",
        ) from exc

    if not isinstance(token_map, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Access-control configuration must be a JSON object",
        )

    matched = None
    supplied = credentials.credentials.encode("utf-8")

    for token, claims in token_map.items():
        if (
            isinstance(token, str)
            and len(token) >= 32
            and isinstance(claims, dict)
            and secrets.compare_digest(supplied, token.encode("utf-8"))
        ):
            matched = claims

    if matched is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = matched.get("subject")
    role = matched.get("role")

    if (
        not isinstance(subject, str)
        or not subject.strip()
        or not isinstance(role, str)
        or role not in PERMISSION_MATRIX
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configured access identity is invalid",
        )

    jurisdictions = matched.get("jurisdictions", [])
    case_ids = matched.get("case_ids", [])

    if (
        not isinstance(jurisdictions, list)
        or not all(isinstance(value, str) for value in jurisdictions)
        or not isinstance(case_ids, list)
        or not all(isinstance(value, str) for value in case_ids)
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configured access scopes are invalid",
        )

    return Principal(
        subject=subject.strip(),
        role=role,
        jurisdictions=frozenset(jurisdictions),
        case_ids=frozenset(case_ids),
    )


def require_permission(resource: str, action: str) -> Callable:
    """Build a FastAPI dependency enforcing a role permission."""

    def dependency(principal: Principal = Depends(resolve_principal)) -> Principal:
        permissions = PERMISSION_MATRIX.get(principal.role, {}).get(resource, set())

        if action not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden",
            )

        return principal

    return dependency


def require_incident_scope(principal: Principal, incident: dict) -> None:
    """Hide incidents outside the caller's authorised scope."""

    if principal.role == "admin":
        return

    region = incident.get("region")
    report_id = incident.get("report_id")
    incident_id = incident.get("id")
    assigned_to = incident.get("assigned_to")

    has_scope = False

    if principal.jurisdictions:
        has_scope = True
        if region not in principal.jurisdictions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Incident not found",
            )

    if principal.case_ids:
        has_scope = True
        case_allowed = (
            incident_id in principal.case_ids
            or report_id in principal.case_ids
            or assigned_to == principal.subject
        )
        if not case_allowed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Incident not found",
            )

    if not has_scope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )


def redact_incident(incident: dict, principal: Principal) -> dict:
    """Return a copy with sensitive fields removed according to role."""

    result = dict(incident)

    if principal.role in {"bank", "telecom", "citizen"}:
        result.pop("description", None)
        result.pop("linked_account", None)
        result.pop("assigned_to", None)

    elif principal.role == "officer":
        account = result.get("linked_account")
        if isinstance(account, str) and len(account) > 4:
            result["linked_account"] = "*" * (len(account) - 4) + account[-4:]

    elif principal.role == "supervisor":
        account = result.get("linked_account")
        if isinstance(account, str) and len(account) > 4:
            result["linked_account"] = "*" * (len(account) - 4) + account[-4:]

    return result
