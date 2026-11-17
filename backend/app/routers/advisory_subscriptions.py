"""
API Router for Public Incident Advisory Subscriptions & Location/Topic Preferences.
Implements Issue #43:
- Citizen subscription with explicit consent.
- Unsubscribe & preference management via secure token.
- In-app feed with location & topic filtering.
- Restricted subscriber directory for DPDP privacy compliance.
- Idempotent notification dispatch for published advisories.
"""
from fastapi import APIRouter, HTTPException, Header, Query, Request
from typing import List, Optional, Dict, Any

from app.models import (
    AdvisorySubscriptionCreate,
    AdvisoryPreferenceUpdate,
    AdvisorySubscriptionResponse,
    PublicSubscriberSummary,
    AdvisoryDispatchSummary,
    InAppAdvisoryFeedItem,
)
from app.services import advisory_subscriptions as sub_service
from app.services.emergency_broadcast import default_broadcast_engine

router = APIRouter(prefix="/api/advisory-subscriptions", tags=["Advisory Subscriptions"])


@router.post("/subscribe", response_model=AdvisorySubscriptionResponse, status_code=201)
def create_subscription(payload: AdvisorySubscriptionCreate):
    """
    Allows citizens to opt into verified public advisories by district/area, topic, and delivery channel.
    Requires explicit consent. Returns a private management token for self-service updates.
    """
    try:
        sub = sub_service.create_subscription(payload)
        return AdvisorySubscriptionResponse(**sub)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/preferences/{token}", response_model=AdvisorySubscriptionResponse)
def get_preferences(token: str):
    """Retrieves subscription preferences and status using the private management token."""
    try:
        sub = sub_service.get_subscription_by_token(token)
        return AdvisorySubscriptionResponse(**sub)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.put("/preferences/{token}", response_model=AdvisorySubscriptionResponse)
def update_preferences(token: str, payload: AdvisoryPreferenceUpdate):
    """Updates subscribed areas, alert topics, channels, or withdraws consent (is_active=False)."""
    try:
        sub = sub_service.update_subscription_preferences(token, payload)
        return AdvisorySubscriptionResponse(**sub)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/unsubscribe", response_model=Dict[str, Any])
@router.get("/unsubscribe", response_model=Dict[str, Any])
def unsubscribe(token: str = Query(..., description="Private subscription management token")):
    """
    One-click unsubscribe endpoint enabling citizens to withdraw consent immediately.
    Included in every advisory email.
    """
    try:
        sub = sub_service.unsubscribe_by_token(token)
        return {
            "success": True,
            "message": "You have been successfully unsubscribed from KshemOS Public Incident Advisories.",
            "unsubscribed_at": sub.get("unsubscribed_at"),
            "email": sub_service.mask_email(sub.get("email", "")),
        }
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.get("/feed", response_model=List[InAppAdvisoryFeedItem])
def get_in_app_feed(
    area: Optional[str] = Query(None, description="Filter by area, district, or region"),
    topic: Optional[str] = Query(None, description="Filter by topic / category (e.g. digital_arrest)"),
    include_expired: bool = Query(False, description="Whether to include expired advisories in historical feed"),
):
    """
    In-app feed of published, approved public advisories for citizens who prefer not to receive email.
    Draft advisories are strictly omitted, and expired advisories are excluded by default.
    """
    items = sub_service.get_advisory_feed(
        area=area,
        topic=topic,
        include_expired=include_expired,
        engine_advisories=default_broadcast_engine.advisories,
    )
    return [InAppAdvisoryFeedItem(**i) for i in items]


@router.get("/summary", response_model=PublicSubscriberSummary)
def get_subscriber_summary():
    """Returns aggregated non-PII subscriber metrics (counts by channel, area, and topic)."""
    summary = sub_service.get_subscriber_summary()
    return PublicSubscriberSummary(**summary)


@router.get("/subscribers", response_model=List[AdvisorySubscriptionResponse])
def list_subscribers(
    x_officer_badge: Optional[str] = Header(None, alias="X-Officer-Badge"),
    authorization: Optional[str] = Header(None),
):
    """
    Restricted directory of citizen subscribers.
    Access is strictly limited to authorized officers and commanders to prevent PII harvesting.
    """
    officer_badge = x_officer_badge or (authorization if authorization and "Bearer" not in authorization else None)
    if not officer_badge and authorization and "Bearer " in authorization:
        officer_badge = "OFF-AUTH-BEARER"

    try:
        subscribers = sub_service.list_subscribers(officer_badge=officer_badge)
        return [AdvisorySubscriptionResponse(**s) for s in subscribers]
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err))


@router.post("/dispatch/{advisory_id}", response_model=AdvisoryDispatchSummary)
def dispatch_advisory_to_subscribers(
    advisory_id: str,
    force_retry: bool = Query(False, description="Force retry failed or prior deliveries"),
):
    """
    Dispatches a verified published advisory to matching email subscribers.
    Enforces acceptance criteria:
    - Draft advisories are never dispatched.
    - Expired advisories are excluded.
    - Retries do not create duplicate notifications.
    """
    if advisory_id not in default_broadcast_engine.advisories:
        raise HTTPException(status_code=404, detail=f"Advisory {advisory_id} not found.")

    adv = default_broadcast_engine.advisories[advisory_id]

    try:
        summary = sub_service.dispatch_advisory_to_subscribers(adv, force_retry=force_retry)
        return AdvisoryDispatchSummary(**summary)
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

