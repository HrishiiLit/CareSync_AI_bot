from __future__ import annotations

"""
Supabase service — thin wrapper around the supabase-py client.
Provides typed helpers for workflows, patients, and call_logs tables.
"""

import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from supabase import Client, create_client

from app.core.config import settings

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

def _make_client() -> Client:
    url = settings.supabase_url
    key = settings.supabase_service_role_key
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
        )
    return create_client(url, key)


_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = _make_client()
    return _client


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _slot_is_open(slot: dict, now_dt: datetime) -> bool:
    status = slot.get("status")
    if status == "available":
        return True
    if status == "reserved":
        reserved_until = _parse_iso_datetime(slot.get("reserved_until"))
        return reserved_until is not None and reserved_until < now_dt
    return False


def _first_row(data: Any) -> dict | None:
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


def _first_active_doctor_id() -> str | None:
    sb = get_supabase()
    rows = (
        sb.table("doctors")
        .select("id")
        .eq("active", True)
        .order("created_at")
        .limit(1)
        .execute()
        .data
    )
    return rows[0]["id"] if rows else None


def _build_login_payload(account: dict, token: str | None = None) -> dict:
    role = account.get("role", "pending")

    if role == "pending":
        return {
            "token": token or secrets.token_urlsafe(24),
            "user": {
                "sub": account["id"],
                "name": account.get("username") or account.get("email"),
                "email": account["email"],
                "username": account.get("username"),
                "mobile": account.get("mobile"),
                "role": "pending",
                "account_id": account["id"],
            },
        }

    if role == "doctor":
        doctor = get_doctor_by_auth_user_id(account["id"])
        if not doctor:
            doctor = (
                get_supabase()
                .table("doctors")
                .insert(
                    {
                        "auth_user_id": account["id"],
                        "name": account.get("username") or account["email"],
                        "specialty": "General Physician",
                        "language": "English",
                        "consultation_type": "video",
                        "fee": 500,
                        "rating_avg": 0,
                        "rating_count": 0,
                        "active": True,
                    }
                )
                .execute()
                .data[0]
            )

        return {
            "token": token or secrets.token_urlsafe(24),
            "user": {
                "sub": doctor["id"],
                "name": doctor.get("name") or account.get("username") or "Doctor",
                "email": account["email"],
                "username": account.get("username"),
                "mobile": account.get("mobile"),
                "role": "doctor",
                "account_id": account["id"],
                "doctor_id": doctor["id"],
            },
        }

    patient = get_patient_by_auth_user_id(account["id"])
    if not patient:
        doctor_id = _first_active_doctor_id()
        if not doctor_id:
            raise RuntimeError("No doctor available to link patient account")

        sb = get_supabase()
        created_patient = (
            sb.table("patients")
            .insert(
                {
                    "doctor_id": doctor_id,
                    "name": account.get("username") or account["email"],
                    "phone": account.get("mobile") or "",
                    "notes": "Created from local auth",
                }
            )
            .execute()
            .data[0]
        )

        sb.table("patient_accounts").insert(
            {
                "auth_user_id": account["id"],
                "patient_id": created_patient["id"],
                "email": account["email"],
            }
        ).execute()

        patient = {
            **created_patient,
            "auth_user_id": account["id"],
            "email": account["email"],
        }

    return {
        "token": token or secrets.token_urlsafe(24),
        "user": {
            "sub": account["id"],
            "name": patient.get("name") or account.get("username") or "Patient",
            "email": account["email"],
            "username": account.get("username"),
            "mobile": account.get("mobile"),
            "role": "patient",
            "account_id": account["id"],
            "patient_id": patient["id"],
            "doctor_id": patient.get("doctor_id"),
        },
    }


def register_user_account(
    role: str,
    email: str,
    password: str,
    username: str,
    mobile: str,
) -> dict:
    if role not in {"doctor", "patient"}:
        raise RuntimeError("Role must be either doctor or patient")

    normalized_email = email.strip().lower()
    sb = get_supabase()

    # 1. Create user in Supabase Auth
    try:
        auth_res = sb.auth.admin.create_user({
            "email": normalized_email,
            "password": password,
            "user_metadata": {
                "role": role,
                "username": username.strip(),
                "mobile": mobile.strip()
            },
            "email_confirm": True
        })
        auth_user = auth_res.user
        if not auth_user:
            raise RuntimeError("Failed to create auth user record")
    except Exception as exc:
        # Check if already exists in Auth
        if "already registered" in str(exc).lower() or "already exists" in str(exc).lower():
            raise RuntimeError("An account already exists for this email") from exc
        raise RuntimeError(f"Auth registration failed: {exc}") from exc

    # 2. Mirror into public.user_accounts for profile logic compatibility
    try:
        account = (
            sb.table("user_accounts")
            .insert(
                {
                    "id": auth_user.id,
                    "role": role,
                    "email": normalized_email,
                    "username": username.strip(),
                    "mobile": mobile.strip(),
                    "password": "SUPABASE_AUTH",  # Password is now managed by Supabase Auth
                    "is_active": True,
                }
            )
            .execute()
            .data[0]
        )
    except Exception as exc:
        # If DB insert fails, we should ideally cleanup auth user, but for now we report error
        raise RuntimeError(f"Profile creation failed: {exc}") from exc

    return _build_login_payload(account)


def login_user_account(email: str, password: str) -> dict:
    normalized_email = email.strip().lower()
    sb = get_supabase()

    # 1. Authenticate with Supabase Auth
    try:
        res = sb.auth.sign_in_with_password({"email": normalized_email, "password": password})
        if not res.user or not res.session:
            raise RuntimeError("Invalid email or password")
    except Exception as exc:
        raise RuntimeError("Invalid email or password") from exc

    # 2. Get profile from public.user_accounts
    rows = (
        sb.table("user_accounts")
        .select("*")
        .eq("id", res.user.id)
        .eq("is_active", True)
        .limit(1)
        .execute()
        .data
    )

    if not rows:
        # If profile missing but auth succeeded, create a minimal profile on the fly
        account = {
            "id": res.user.id,
            "role": res.user.user_metadata.get("role", "pending"),
            "email": normalized_email,
            "username": res.user.user_metadata.get("username", "User"),
            "mobile": res.user.user_metadata.get("mobile", ""),
        }
    else:
        account = rows[0]

    return _build_login_payload(account, token=res.session.access_token)


def get_session_by_auth_id(auth_user_id: str, role: str) -> dict:
    """
    Used for OAuth (Google) login to fetch the app-specific session (doctor_id, etc.)
    once the user is already authenticated via Supabase.
    """
    sb = get_supabase()

    # 1. Get profile from public.user_accounts
    rows = (
        sb.table("user_accounts")
        .select("*")
        .eq("id", auth_user_id)
        .eq("role", role)
        .limit(1)
        .execute()
        .data
    )

    if not rows:
        # First time OAuth user? Create a mirror record in user_accounts
        # We fetch email from Auth admin to be sure
        auth_user = sb.auth.admin.get_user_by_id(auth_user_id).user
        if not auth_user:
            raise RuntimeError("Auth user not found")

        account = (
            sb.table("user_accounts")
            .insert(
                {
                    "id": auth_user.id,
                    "role": role,
                    "email": auth_user.email,
                    "username": auth_user.user_metadata.get("full_name") or auth_user.user_metadata.get("username") or "User",
                    "mobile": auth_user.user_metadata.get("mobile") or "",
                    "password": "OAUTH_LOGIN",
                    "is_active": True,
                }
            )
            .execute()
            .data[0]
        )
    else:
        account = rows[0]

    return _build_login_payload(account)


# ---------------------------------------------------------------------------
# Workflow helpers
# ---------------------------------------------------------------------------

def list_workflows(doctor_id: str | None = None, status: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("workflows").select("*")
    if doctor_id:
        q = q.eq("doctor_id", doctor_id)
    if status:
        q = q.eq("status", status)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# Doctor directory + availability helpers (Phase 1)
# ---------------------------------------------------------------------------

def get_doctor(doctor_id: str) -> dict | None:
    try:
        UUID(str(doctor_id))
    except Exception:
        return None

    sb = get_supabase()
    rows = sb.table("doctors").select("*").eq("id", doctor_id).limit(1).execute().data
    return rows[0] if rows else None


def get_doctor_by_auth_user_id(auth_user_id: str) -> dict | None:
    sb = get_supabase()
    rows = (
        sb.table("doctors")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def resolve_doctor(doctor_identifier: str) -> dict | None:
    doctor = get_doctor(doctor_identifier)
    if doctor:
        return doctor
    return get_doctor_by_auth_user_id(doctor_identifier)


def list_doctors(
    specialty: str | None = None,
    language: str | None = None,
    consultation_type: str | None = None,
    available_now: bool | None = None,
) -> list[dict]:
    sb = get_supabase()

    q = sb.table("doctors").select("*").eq("active", True)
    if specialty:
        q = q.ilike("specialty", f"%{specialty}%")
    if language:
        q = q.ilike("language", f"%{language}%")
    if consultation_type:
        q = q.eq("consultation_type", consultation_type)

    doctors = q.order("name").execute().data
    if not doctors:
        return []

    now_iso = _utc_now_iso()
    now_dt = datetime.now(timezone.utc)
    doctor_ids = [d["id"] for d in doctors]

    slot_rows = (
        sb.table("availability_slots")
        .select("doctor_id,slot_start,slot_end,status,reserved_until")
        .in_("doctor_id", doctor_ids)
        .gte("slot_end", now_iso)
        .order("slot_start")
        .execute()
        .data
    )

    per_doctor: dict[str, list[dict]] = {}
    for row in slot_rows:
        if _slot_is_open(row, now_dt):
            per_doctor.setdefault(row["doctor_id"], []).append(row)

    result: list[dict] = []
    for doctor in doctors:
        slots = per_doctor.get(doctor["id"], [])
        is_available_now = any(s["slot_start"] <= now_iso <= s["slot_end"] for s in slots)
        next_slot_start = slots[0]["slot_start"] if slots else None

        if available_now is not None and is_available_now != available_now:
            continue

        result.append(
            {
                **doctor,
                "available_now": is_available_now,
                "next_slot_start": next_slot_start,
            }
        )

    return result


def list_doctor_availability(doctor_id: str) -> list[dict]:
    sb = get_supabase()
    now_iso = _utc_now_iso()
    now_dt = datetime.now(timezone.utc)
    rows = (
        sb.table("availability_slots")
        .select("id,doctor_id,slot_start,slot_end,status,reserved_until")
        .eq("doctor_id", doctor_id)
        .gte("slot_end", now_iso)
        .order("slot_start")
        .execute()
        .data
    )
    return [row for row in rows if _slot_is_open(row, now_dt)]


def reserve_slot(slot_id: str, patient_id: str, hold_minutes: int = 10) -> dict | None:
    sb = get_supabase()
    res = sb.rpc(
        "reserve_availability_slot",
        {
            "p_slot_id": slot_id,
            "p_patient_id": patient_id,
            "p_hold_minutes": hold_minutes,
        },
    ).execute()
    return _first_row(res.data)


def get_availability_slot(slot_id: str) -> dict | None:
    sb = get_supabase()
    rows = sb.table("availability_slots").select("*").eq("id", slot_id).limit(1).execute().data
    return rows[0] if rows else None


def list_doctor_slots(
    doctor_id: str,
    include_past: bool = False,
    status: str | None = None,
) -> list[dict]:
    sb = get_supabase()
    q = (
        sb.table("availability_slots")
        .select("id,doctor_id,slot_start,slot_end,status,reserved_until,reserved_by,created_at,updated_at")
        .eq("doctor_id", doctor_id)
    )

    if not include_past:
        q = q.gte("slot_end", _utc_now_iso())
    if status:
        q = q.eq("status", status)

    return q.order("slot_start").execute().data


def create_doctor_slot(
    doctor_id: str,
    slot_start: str,
    slot_end: str,
    status: str = "available",
) -> dict:
    sb = get_supabase()
    return (
        sb.table("availability_slots")
        .insert(
            {
                "doctor_id": doctor_id,
                "slot_start": slot_start,
                "slot_end": slot_end,
                "status": status,
            }
        )
        .execute()
        .data[0]
    )


def update_doctor_slot(doctor_id: str, slot_id: str, payload: dict) -> dict:
    sb = get_supabase()
    updates = {
        **payload,
        "updated_at": _utc_now_iso(),
    }
    return (
        sb.table("availability_slots")
        .update(updates)
        .eq("id", slot_id)
        .eq("doctor_id", doctor_id)
        .execute()
        .data[0]
    )


def delete_doctor_slot(doctor_id: str, slot_id: str) -> None:
    sb = get_supabase()
    sb.table("availability_slots").delete().eq("id", slot_id).eq("doctor_id", doctor_id).execute()


# ---------------------------------------------------------------------------
# Doctor Feedback helpers
# ---------------------------------------------------------------------------

def create_doctor_feedback(
    doctor_id: str,
    rating: int,
    comment: str | None = None,
    patient_id: str | None = None,
) -> dict:
    sb = get_supabase()
    feedback = (
        sb.table("doctor_feedback")
        .insert(
            {
                "doctor_id": doctor_id,
                "patient_id": patient_id,
                "rating": rating,
                "comment": comment,
            }
        )
        .execute()
        .data[0]
    )

    feedbacks = (
        sb.table("doctor_feedback")
        .select("rating")
        .eq("doctor_id", doctor_id)
        .execute()
        .data
    )
    ratings = [f["rating"] for f in feedbacks if f.get("rating") is not None]
    if ratings:
        avg = sum(ratings) / len(ratings)
        count = len(ratings)
        sb.table("doctors").update({"rating_avg": avg, "rating_count": count}).eq("id", doctor_id).execute()

    return feedback


def list_doctor_feedback(doctor_id: str, limit: int = 20) -> list[dict]:
    sb = get_supabase()
    return (
        sb.table("doctor_feedback")
        .select("id,doctor_id,patient_id,rating,comment,created_at")
        .eq("doctor_id", doctor_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


# ---------------------------------------------------------------------------
# Patient portal helpers (registration/login/dashboard)
# ---------------------------------------------------------------------------

def get_patient_account_by_auth_user_id(auth_user_id: str) -> dict | None:
    sb = get_supabase()
    rows = (
        sb.table("patient_accounts")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def get_patient_by_auth_user_id(auth_user_id: str) -> dict | None:
    account = get_patient_account_by_auth_user_id(auth_user_id)
    if not account:
        return None
    patient = get_patient(account["patient_id"])
    if not patient:
        return None
    return {
        **patient,
        "auth_user_id": account["auth_user_id"],
        "email": account.get("email"),
    }


def register_patient_portal_user(
    auth_user_id: str,
    email: str,
    name: str,
    phone: str,
    doctor_id: str,
) -> dict:
    existing = get_patient_by_auth_user_id(auth_user_id)
    if existing:
        return existing

    sb = get_supabase()
    patient = (
        sb.table("patients")
        .insert(
            {
                "doctor_id": doctor_id,
                "name": name,
                "phone": phone,
                "notes": "Created from patient portal",
            }
        )
        .execute()
        .data[0]
    )

    sb.table("patient_accounts").insert(
        {
            "auth_user_id": auth_user_id,
            "patient_id": patient["id"],
            "email": email,
        }
    ).execute()

    return {
        **patient,
        "auth_user_id": auth_user_id,
        "email": email,
    }


def list_patient_appointments(patient_id: str) -> list[dict]:
    sb = get_supabase()
    appointments = (
        sb.table("appointments")
        .select("id,doctor_id,patient_id,slot_id,status,consultation_type,notes,created_at")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    if not appointments:
        return []

    doctor_ids = list({row["doctor_id"] for row in appointments})
    slot_ids = list({row["slot_id"] for row in appointments})

    doctors = (
        sb.table("doctors")
        .select("id,name,specialty")
        .in_("id", doctor_ids)
        .execute()
        .data
    )
    slots = (
        sb.table("availability_slots")
        .select("id,slot_start,slot_end")
        .in_("id", slot_ids)
        .execute()
        .data
    )

    doctor_map = {d["id"]: d for d in doctors}
    slot_map = {s["id"]: s for s in slots}

    result: list[dict] = []
    for appt in appointments:
        doctor = doctor_map.get(appt["doctor_id"], {})
        slot = slot_map.get(appt["slot_id"], {})
        result.append(
            {
                **appt,
                "doctor_name": doctor.get("name"),
                "doctor_specialty": doctor.get("specialty"),
                "slot_start": slot.get("slot_start"),
                "slot_end": slot.get("slot_end"),
            }
        )
    return result


def list_doctor_appointments(doctor_id: str) -> list[dict]:
    sb = get_supabase()
    appointments = (
        sb.table("appointments")
        .select("id,doctor_id,patient_id,slot_id,status,consultation_type,notes,created_at")
        .eq("doctor_id", doctor_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    if not appointments:
        return []

    patient_ids = list({row["patient_id"] for row in appointments})
    slot_ids = list({row["slot_id"] for row in appointments})

    patients = (
        sb.table("patients")
        .select("id,name,phone")
        .in_("id", patient_ids)
        .execute()
        .data
    )
    slots = (
        sb.table("availability_slots")
        .select("id,slot_start,slot_end")
        .in_("id", slot_ids)
        .execute()
        .data
    )

    patient_map = {p["id"]: p for p in patients}
    slot_map = {s["id"]: s for s in slots}

    result: list[dict] = []
    for appt in appointments:
        patient = patient_map.get(appt["patient_id"], {})
        slot = slot_map.get(appt["slot_id"], {})
        result.append(
            {
                **appt,
                "patient_name": patient.get("name"),
                "patient_phone": patient.get("phone"),
                "slot_start": slot.get("slot_start"),
                "slot_end": slot.get("slot_end"),
            }
        )
    return result


def get_appointment(appointment_id: str) -> dict | None:
    sb = get_supabase()
    rows = (
        sb.table("appointments")
        .select("id,doctor_id,patient_id,slot_id,status,consultation_type,notes,created_at,updated_at")
        .eq("id", appointment_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def update_appointment(appointment_id: str, payload: dict) -> dict:
    sb = get_supabase()
    updates = {**payload, "updated_at": _utc_now_iso()}
    return (
        sb.table("appointments")
        .update(updates)
        .eq("id", appointment_id)
        .execute()
        .data[0]
    )


def cancel_appointment(appointment_id: str, cancel_note: str | None = None) -> dict:
    appointment = get_appointment(appointment_id)
    if not appointment:
        raise RuntimeError("Appointment not found")

    if appointment["status"] == "cancelled":
        return appointment

    merged_note = appointment.get("notes") or ""
    if cancel_note:
        merged_note = f"{merged_note}\n{cancel_note}".strip()

    updated = update_appointment(
        appointment_id,
        {
            "status": "cancelled",
            "notes": merged_note if merged_note else appointment.get("notes"),
        },
    )

    sb = get_supabase()
    sb.table("availability_slots").update(
        {
            "status": "available",
            "reserved_by": None,
            "reserved_until": None,
            "updated_at": _utc_now_iso(),
        }
    ).eq("id", appointment["slot_id"]).execute()

    return updated


def cancel_appointment_for_patient_portal(
    auth_user_id: str,
    appointment_id: str,
    reason: str | None = None,
) -> dict:
    patient = get_patient_by_auth_user_id(auth_user_id)
    if not patient:
        raise RuntimeError("Patient profile not found for this auth user")

    appointment = get_appointment(appointment_id)
    if not appointment or appointment["patient_id"] != patient["id"]:
        raise RuntimeError("Appointment not found for this patient")

    cancel_note = "Cancelled by patient via portal"
    if reason:
        cancel_note = f"{cancel_note}: {reason.strip()}"

    return cancel_appointment(appointment_id, cancel_note=cancel_note)


def reschedule_appointment_for_patient_portal(
    auth_user_id: str,
    appointment_id: str,
    new_slot_id: str,
    consultation_type: str | None = None,
    notes: str | None = None,
) -> dict:
    patient = get_patient_by_auth_user_id(auth_user_id)
    if not patient:
        raise RuntimeError("Patient profile not found for this auth user")

    current = get_appointment(appointment_id)
    if not current or current["patient_id"] != patient["id"]:
        raise RuntimeError("Appointment not found for this patient")

    if current["status"] in {"cancelled", "completed", "no_show"}:
        raise RuntimeError("Only active appointments can be rescheduled")

    reserved = reserve_slot(slot_id=new_slot_id, patient_id=patient["id"], hold_minutes=10)
    if not reserved:
        raise RuntimeError("New slot is not available")

    sb = get_supabase()
    booked = sb.rpc(
        "book_reserved_slot",
        {
            "p_slot_id": new_slot_id,
            "p_patient_id": patient["id"],
            "p_consultation_type": consultation_type or current["consultation_type"],
            "p_notes": notes or current.get("notes"),
        },
    ).execute()

    new_appointment = _first_row(booked.data)
    if not new_appointment:
        raise RuntimeError("Could not book the selected slot")

    cancel_appointment(current["id"], cancel_note=f"Rescheduled to slot {new_slot_id}")
    doctor = get_doctor(str(new_appointment["doctor_id"]))
    slot_rows = (
        sb.table("availability_slots")
        .select("id,slot_start,slot_end")
        .eq("id", new_appointment["slot_id"])
        .limit(1)
        .execute()
        .data
    )
    slot = slot_rows[0] if slot_rows else {}

    return {
        **new_appointment,
        "doctor_name": doctor.get("name") if doctor else "Doctor",
        "doctor_specialty": doctor.get("specialty") if doctor else None,
        "slot_start": slot.get("slot_start"),
        "slot_end": slot.get("slot_end"),
        "rescheduled_from_appointment_id": appointment_id,
    }


def book_slot_for_patient_portal(
    auth_user_id: str,
    slot_id: str,
    consultation_type: str = "video",
    notes: str | None = None,
) -> dict | None:
    patient = get_patient_by_auth_user_id(auth_user_id)
    if not patient:
        raise RuntimeError("Patient profile not found for this auth user")

    patient_id = patient["id"]
    sb = get_supabase()

    slot_rows = (
        sb.table("availability_slots")
        .select("id,status,reserved_by,reserved_until")
        .eq("id", slot_id)
        .limit(1)
        .execute()
        .data
    )
    slot_row = slot_rows[0] if slot_rows else None
    now_dt = datetime.now(timezone.utc)

    can_book_existing_reservation = False
    if slot_row and slot_row.get("status") == "reserved":
        reserved_until_dt = _parse_iso_datetime(slot_row.get("reserved_until"))
        can_book_existing_reservation = (
            slot_row.get("reserved_by") == patient_id
            and reserved_until_dt is not None
            and reserved_until_dt >= now_dt
        )

    if not can_book_existing_reservation:
        reserved = reserve_slot(slot_id=slot_id, patient_id=patient_id, hold_minutes=10)
        if not reserved:
            return None

    try:
        booked = sb.rpc(
            "book_reserved_slot",
            {
                "p_slot_id": slot_id,
                "p_patient_id": patient_id,
                "p_consultation_type": consultation_type,
                "p_notes": notes,
            },
        ).execute()
    except Exception as exc:
        # Race condition: another request may have already booked this slot.
        msg = str(exc)
        if "uq_appointments_slot_id" in msg or "duplicate key value" in msg or "23505" in msg:
            return None
        raise

    appointment = _first_row(booked.data)
    if not appointment:
        return None
    doctor = get_doctor(str(appointment["doctor_id"]))
    slot_rows = (
        sb.table("availability_slots")
        .select("id,slot_start,slot_end")
        .eq("id", appointment["slot_id"])
        .limit(1)
        .execute()
        .data
    )
    slot = slot_rows[0] if slot_rows else {}

    slot_start = slot.get("slot_start")
    doctor_name = doctor.get("name") if doctor else "Doctor"
    patient_display = patient.get("name") or patient.get("email") or "Patient"

    # Phase 2: create a booking confirmation notification immediately.
    create_notification(
        {
            "patient_id": patient_id,
            "recipient": patient_display,
            "message": (
                f"Appointment confirmed with {doctor_name} on {slot_start}. "
                f"Type: {consultation_type}."
            ),
            "priority": "normal",
            "status": "unread",
        }
    )

    return {
        **appointment,
        "doctor_name": doctor_name,
        "doctor_specialty": doctor.get("specialty") if doctor else None,
        "slot_start": slot_start,
        "slot_end": slot.get("slot_end"),
    }


def get_workflow(workflow_id: str) -> dict | None:
    sb = get_supabase()
    rows = sb.table("workflows").select("*").eq("id", workflow_id).execute().data
    return rows[0] if rows else None


def create_workflow(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("workflows").insert(payload).execute().data[0]


def update_workflow(workflow_id: str, payload: dict) -> dict:
    sb = get_supabase()
    return (
        sb.table("workflows")
        .update(payload)
        .eq("id", workflow_id)
        .execute()
        .data[0]
    )


def delete_workflow(workflow_id: str) -> None:
    sb = get_supabase()
    sb.table("workflows").delete().eq("id", workflow_id).execute()


# ---------------------------------------------------------------------------
# Patient helpers
# ---------------------------------------------------------------------------

def get_patient(patient_id: str) -> dict | None:
    sb = get_supabase()
    rows = sb.table("patients").select("*").eq("id", patient_id).execute().data
    return rows[0] if rows else None


def list_patients(doctor_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("patients").select("*")
    if doctor_id:
        q = q.eq("doctor_id", doctor_id)
    return q.execute().data


def update_patient(patient_id: str, payload: dict) -> dict:
    sb = get_supabase()
    return (
        sb.table("patients")
        .update(payload)
        .eq("id", patient_id)
        .execute()
        .data[0]
    )


# ---------------------------------------------------------------------------
# Patient-condition helpers
# ---------------------------------------------------------------------------

def list_conditions(patient_id: str) -> list[dict]:
    sb = get_supabase()
    return (
        sb.table("patient_conditions")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def create_condition(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("patient_conditions").insert(payload).execute().data[0]


def update_condition(condition_id: str, payload: dict) -> dict:
    sb = get_supabase()
    return (
        sb.table("patient_conditions")
        .update(payload)
        .eq("id", condition_id)
        .execute()
        .data[0]
    )


def delete_condition(condition_id: str) -> None:
    sb = get_supabase()
    sb.table("patient_conditions").delete().eq("id", condition_id).execute()


# ---------------------------------------------------------------------------
# Call-log helpers
# ---------------------------------------------------------------------------

def create_call_log(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("call_logs").insert(payload).execute().data[0]


def get_call_log(log_id: str) -> dict | None:
    sb = get_supabase()
    rows = sb.table("call_logs").select("*").eq("id", log_id).execute().data
    return rows[0] if rows else None


def update_call_log(log_id: str, payload: dict) -> dict:
    sb = get_supabase()
    return (
        sb.table("call_logs")
        .update(payload)
        .eq("id", log_id)
        .execute()
        .data[0]
    )


def list_call_logs(
    workflow_id: str | None = None,
    doctor_id: str | None = None,
    patient_id: str | None = None,
) -> list[dict]:
    sb = get_supabase()
    q = sb.table("call_logs").select("*")
    if workflow_id:
        q = q.eq("workflow_id", workflow_id)
    if patient_id:
        q = q.eq("patient_id", patient_id)
    if doctor_id:
        patient_ids = [
            p["id"]
            for p in sb.table("patients")
            .select("id")
            .eq("doctor_id", doctor_id)
            .execute()
            .data
        ]
        if not patient_ids:
            return []
        q = q.in_("patient_id", patient_ids)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# Patient-medication helpers
# ---------------------------------------------------------------------------

def list_medications(patient_id: str) -> list[dict]:
    sb = get_supabase()
    return (
        sb.table("patient_medications")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def create_medication(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("patient_medications").insert(payload).execute().data[0]


def update_medication(medication_id: str, payload: dict) -> dict:
    sb = get_supabase()
    return (
        sb.table("patient_medications")
        .update(payload)
        .eq("id", medication_id)
        .execute()
        .data[0]
    )


def delete_medication(medication_id: str) -> None:
    sb = get_supabase()
    sb.table("patient_medications").delete().eq("id", medication_id).execute()


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

def create_notification(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("notifications").insert(payload).execute().data[0]


def list_notifications(patient_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("notifications").select("*")
    if patient_id:
        q = q.eq("patient_id", patient_id)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# Lab order helpers
# ---------------------------------------------------------------------------

def create_lab_order(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("lab_orders").insert(payload).execute().data[0]


def list_lab_orders(patient_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("lab_orders").select("*")
    if patient_id:
        q = q.eq("patient_id", patient_id)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# Referral helpers
# ---------------------------------------------------------------------------

def create_referral(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("referrals").insert(payload).execute().data[0]


def list_referrals(patient_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("referrals").select("*")
    if patient_id:
        q = q.eq("patient_id", patient_id)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# Staff assignment helpers
# ---------------------------------------------------------------------------

def create_staff_assignment(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("staff_assignments").insert(payload).execute().data[0]


def list_staff_assignments(patient_id: str | None = None, staff_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("staff_assignments").select("*")
    if patient_id:
        q = q.eq("patient_id", patient_id)
    if staff_id:
        q = q.eq("staff_id", staff_id)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# Report helpers
# ---------------------------------------------------------------------------

def create_report(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("reports").insert(payload).execute().data[0]


def get_report(report_id: str) -> dict | None:
    sb = get_supabase()
    rows = sb.table("reports").select("*").eq("id", report_id).execute().data
    return rows[0] if rows else None


def list_reports(patient_id: str | None = None, workflow_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("reports").select("*")
    if patient_id:
        q = q.eq("patient_id", patient_id)
    if workflow_id:
        q = q.eq("workflow_id", workflow_id)
    return q.order("created_at", desc=True).execute().data


# ---------------------------------------------------------------------------
# PDF document helpers
# ---------------------------------------------------------------------------

def create_pdf_document(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("pdf_documents").insert(payload).execute().data[0]


def get_pdf_document(doc_id: str) -> dict | None:
    sb = get_supabase()
    rows = sb.table("pdf_documents").select("*").eq("id", doc_id).execute().data
    return rows[0] if rows else None


def list_pdf_documents(patient_id: str | None = None) -> list[dict]:
    sb = get_supabase()
    q = sb.table("pdf_documents").select(
        "id,patient_id,filename,page_count,patient_info,lab_results,tables_data,uploaded_by,created_at"
    )
    if patient_id:
        q = q.eq("patient_id", patient_id)
    return q.order("created_at", desc=True).execute().data


def delete_pdf_document(doc_id: str) -> None:
    sb = get_supabase()
    sb.table("pdf_documents").delete().eq("id", doc_id).execute()


# ---------------------------------------------------------------------------
# Consultation room + chat helpers (Phase 3 chat)
# ---------------------------------------------------------------------------

def get_consultation_room_by_appointment(appointment_id: str) -> dict | None:
    sb = get_supabase()
    rows = (
        sb.table("consultation_rooms")
        .select("id,appointment_id,provider,room_name,room_url,created_at,updated_at")
        .eq("appointment_id", appointment_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def create_consultation_room(
    appointment_id: str,
    provider: str = "daily",
    room_name: str | None = None,
) -> dict:
    sb = get_supabase()

    existing = get_consultation_room_by_appointment(appointment_id)
    if existing:
        return existing

    safe_room_name = room_name or f"consult-{appointment_id[:8]}"
    row = (
        sb.table("consultation_rooms")
        .insert(
            {
                "appointment_id": appointment_id,
                "provider": provider,
                "room_name": safe_room_name,
            }
        )
        .execute()
        .data[0]
    )
    return row


def list_consultation_messages(appointment_id: str, limit: int = 200) -> list[dict]:
    sb = get_supabase()
    return (
        sb.table("consultation_messages")
        .select("id,appointment_id,room_id,sender_type,sender_id,message,created_at")
        .eq("appointment_id", appointment_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
        .data
    )


def create_consultation_message(payload: dict) -> dict:
    sb = get_supabase()
    return sb.table("consultation_messages").insert(payload).execute().data[0]