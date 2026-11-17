"""Authentication, role permissions, tenant scopes, and field-level controls."""

from __future__ import annotations

import json
import os
import secrets
from dataclasses import dataclass, field
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services import audit, incident_notifications

bearer_scheme = HTTPBearer(auto_error=False)

ROLE_LEVELS = {
    "responder": 1,
    "supervisor": 2,
    "commander": 3,
}

PERMISSION_MATRIX = {
    "citizen": {
        "citizen_reports": {"create"},
    },
    "officer": {
        "incidents": {"read", "create", "update", "sync"},
        "dpdp": {"sanitize", "pseudonymize", "request_unmask", "reveal"},
    },
    "supervisor": {
        "incidents": {"read", "create", "update", "sync", "manage_staffing"},
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

_LEGACY_PERMISSIONS = {
    "responder": {"read", "create", "update", "sync"},
    "supervisor": {"read", "create", "update", "sync", "manage_staffing"},
    "commander": {"read", "create", "update", "sync", "manage_staffing"},
}


@dataclass(frozen=True)
class Principal:
    role: str
    subject: str = ""
    jurisdictions: frozenset[str] = field(default_factory=frozenset)
    case_ids: frozenset[str] = field(default_factory=frozenset)
    officer_id: str | None = None
    jurisdiction_id: str | None = None
    regions: tuple[str, ...] = ()


def _deny(
    detail: str,
    status_code: int,
    *,
    actor_id: str = "anonymous",
    action: str = "authentication_denied",
) -> None:
    audit.record_event(
        actor_id=actor_id,
        actor_role="unknown",
        action=action,
        resource_type="api",
        outcome="denied",
        source="authorization",
        metadata={"reason": detail, "status_code": status_code},
    )
    headers = {"WWW-Authenticate": "Bearer"} if status_code == 401 else None
    raise HTTPException(
        status_code=status_code,
        detail=detail,
        headers=headers,
    )


def _access_principal(
    credentials: HTTPAuthorizationCredentials | None,
) -> Principal:
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
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Access-control configuration is invalid",
        ) from exc

    if not isinstance(token_map, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Access-control configuration must be a JSON object",
        )

    supplied = credentials.credentials.encode("utf-8")
    matched = None
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


def resolve_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    """Resolve an upstream access token to its configured identity and scopes."""

    return _access_principal(credentials)


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    """Resolve either an upstream scoped token or a registered-officer token."""

    if credentials is None:
        _deny("Authentication is required", status.HTTP_401_UNAUTHORIZED)

    if os.getenv("KSHEMOS_ACCESS_TOKENS", ""):
        try:
            return _access_principal(credentials)
        except HTTPException as exc:
            if (
                exc.status_code != status.HTTP_401_UNAUTHORIZED
                or not os.getenv("KSHEMOS_API_TOKENS", "")
            ):
                raise

    configured = os.getenv("KSHEMOS_API_TOKENS", "")
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API authentication is not configured",
        )

    try:
        token_map = json.loads(configured)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API authentication configuration is invalid",
        ) from exc

    if not isinstance(token_map, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API authentication configuration must be an object",
        )

    valid_entries = [
        (token, officer_id.strip())
        for token, officer_id in token_map.items()
        if isinstance(token, str)
        and len(token) >= 32
        and isinstance(officer_id, str)
        and officer_id.strip()
    ]
    if not valid_entries:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No valid API credentials are configured",
        )

    supplied = credentials.credentials.encode("utf-8")
    officer_id = None
    for token, configured_officer in valid_entries:
        if secrets.compare_digest(supplied, token.encode("utf-8")):
            officer_id = configured_officer

    if officer_id is None:
        _deny("Invalid bearer credentials", status.HTTP_401_UNAUTHORIZED)

    officer = incident_notifications.get_registered_officer(officer_id)
    if officer is None:
        _deny(
            "Credential is not linked to a registered officer",
            status.HTTP_401_UNAUTHORIZED,
        )

    role = officer.get("role")
    jurisdiction_id = officer.get("jurisdiction_id")
    regions = officer.get("regions")
    if (
        role not in ROLE_LEVELS
        or not isinstance(jurisdiction_id, str)
        or not jurisdiction_id
        or not isinstance(regions, list)
        or not all(isinstance(region, str) for region in regions)
    ):
        _deny(
            "Registered officer has an invalid authorization profile",
            status.HTTP_403_FORBIDDEN,
            actor_id=officer_id,
        )

    return Principal(
        subject=officer_id,
        role=role,
        jurisdictions=frozenset(regions),
        officer_id=officer_id,
        jurisdiction_id=jurisdiction_id,
        regions=tuple(regions),
    )


def has_permission(principal: Principal, resource: str, action: str) -> bool:
    """Return whether the principal's role grants a resource action."""

    if resource == "incidents" and principal.role in _LEGACY_PERMISSIONS:
        return action in _LEGACY_PERMISSIONS[principal.role]
    return action in PERMISSION_MATRIX.get(principal.role, {}).get(
        resource, set()
    )


def require_permission(resource: str, action: str) -> Callable:
    """Build a FastAPI dependency enforcing a role permission."""

    def dependency(principal: Principal = Depends(resolve_principal)) -> Principal:
        if not has_permission(principal, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden",
            )
        return principal

    return dependency


def require_roles(*allowed_roles: str):
    if not allowed_roles or any(
        role not in ROLE_LEVELS for role in allowed_roles
    ):
        raise ValueError("A valid allowed role is required")

    def dependency(
        principal: Principal = Depends(get_current_principal),
    ) -> Principal:
        if principal.role not in allowed_roles:
            _deny(
                "Insufficient role permissions",
                status.HTTP_403_FORBIDDEN,
                actor_id=principal.officer_id or principal.subject,
                action="authorization_role_denied",
            )
        return principal

    return dependency


def require_region_access(region: str, principal: Principal) -> None:
    if principal.role == "admin":
        return

    if principal.jurisdiction_id is not None:
        jurisdiction_id = incident_notifications.resolve_jurisdiction(region)
        if (
            principal.jurisdiction_id != jurisdiction_id
            or ("*" not in principal.regions and region not in principal.regions)
        ):
            _deny(
                "Access to this jurisdiction or region is forbidden",
                status.HTTP_403_FORBIDDEN,
                actor_id=principal.officer_id or principal.subject,
                action="authorization_scope_denied",
            )
        return

    if region not in principal.jurisdictions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Region not found",
        )


def require_incident_scope(principal: Principal, incident: dict) -> None:
    """Hide incidents outside the caller's authorised tenant or case scope."""

    if principal.role == "admin":
        return

    if principal.jurisdiction_id is not None:
        require_region_access(
            incident.get("region", ""),
            principal,
        )
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


def require_create_scope(principal: Principal, region: str | None) -> None:
    """Restrict incident creation to the caller's configured jurisdictions."""

    if principal.jurisdiction_id is not None:
        require_region_access(region or "", principal)
        return

    if principal.role == "admin":
        return

    if principal.jurisdictions and region in principal.jurisdictions:
        return

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Region not found",
    )


def redact_incident(incident: dict, principal: Principal) -> dict:
    """Return a copy with sensitive fields removed according to role."""

    result = dict(incident)

    if principal.role in {"bank", "telecom", "citizen"}:
        result.pop("description", None)
        result.pop("linked_account", None)
        result.pop("assigned_to", None)
    elif principal.role in {"officer", "supervisor"}:
        account = result.get("linked_account")
        if isinstance(account, str) and len(account) > 4:
            result["linked_account"] = "*" * (len(account) - 4) + account[-4:]

    return result
