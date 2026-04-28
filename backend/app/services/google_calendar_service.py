"""
Google Calendar Service
------------------------
Creates calendar events in the doctor's Google Calendar.

Google OAuth tokens are stored in Supabase. This service:

1. Retrieves the doctor's Google token from Supabase.
2. Uses that token to call the Google Calendar REST API directly (via httpx).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase Token Helpers
# ---------------------------------------------------------------------------

async def _get_google_token_for_user(doctor_id: str) -> str:
    """
    Fetch the doctor's Google access_token from Supabase.
    """
    # TODO: Implement fetching Google Calendar OAuth token from Supabase
    # For now, returning a placeholder or raising an error if needed.
    raise NotImplementedError("Fetching Google tokens from Supabase is not yet implemented.")


# ---------------------------------------------------------------------------
# Google Calendar API
# ---------------------------------------------------------------------------

GCAL_BASE = "https://www.googleapis.com/calendar/v3"


async def create_calendar_event(
    doctor_id: str,
    summary: str,
    start_iso: str,
    end_iso: str | None = None,
    description: str | None = None,
    timezone: str = "America/New_York",
    attendee_email: str | None = None,
) -> dict[str, Any]:
    """
    Create an event on the doctor's primary Google Calendar.

    Args:
        doctor_id: The doctor's Supabase ID.
        summary: Event title (e.g. "Follow-up: John Doe").
        start_iso: ISO-8601 datetime for the event start.
        end_iso: ISO-8601 datetime for event end (defaults to start + 30 min).
        description: Optional event body text.
        timezone: IANA timezone string.
        attendee_email: Optional patient email to invite.

    Returns:
        The Google Calendar event resource (includes ``id``, ``htmlLink``).
    """
    google_token = await _get_google_token_for_user(doctor_id)

    # Default to 30-minute appointment if no end time
    if not end_iso:
        start_dt = datetime.fromisoformat(start_iso)
        end_dt = start_dt + timedelta(minutes=30)
        end_iso = end_dt.isoformat()

    event_body: dict[str, Any] = {
        "summary": summary,
        "start": {"dateTime": start_iso, "timeZone": timezone},
        "end": {"dateTime": end_iso, "timeZone": timezone},
    }
    if description:
        event_body["description"] = description
    if attendee_email:
        event_body["attendees"] = [{"email": attendee_email}]

    url = f"{GCAL_BASE}/calendars/primary/events"
    headers = {
        "Authorization": f"Bearer {google_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=event_body, headers=headers)

    if resp.status_code >= 400:
        logger.error("Google Calendar error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"Google Calendar API error {resp.status_code}: {resp.text}")

    event = resp.json()
    logger.info(
        "Google Calendar event created — id=%s link=%s",
        event.get("id"),
        event.get("htmlLink"),
    )
    return event
