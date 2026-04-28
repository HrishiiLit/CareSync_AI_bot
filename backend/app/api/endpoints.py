from __future__ import annotations
"""
FastAPI route endpoints for MedTrigger.
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

import app.services.supabase_service as db
from app.services.pdf_service import parse_pdf_document
from app.services.workflow_engine import execute_workflow

logger = logging.getLogger(__name__)

router = APIRouter()


async def _run_db_call(func, *args, **kwargs):
    return await run_in_threadpool(lambda: func(*args, **kwargs))


async def _resolve_doctor_or_404_async(doctor_identifier: str) -> dict:
    doctor = await _run_db_call(db.resolve_doctor, doctor_identifier)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


def _resolve_doctor_or_404(doctor_identifier: str) -> dict:
    doctor = db.resolve_doctor(doctor_identifier)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class WorkflowCreate(BaseModel):
    doctor_id: str
    name: str
    description: str | None = None
    category: str = "Ungrouped"
    status: str = "DRAFT"
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    status: str | None = None
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None


class PatientCreate(BaseModel):
    name: str
    phone: str
    doctor_id: str
    dob: str | None = None
    mrn: str | None = None
    insurance: str | None = None
    primary_physician: str | None = None
    last_visit: str | None = None
    risk_level: str = "low"
    notes: str | None = None


class PatientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    dob: str | None = None
    mrn: str | None = None
    insurance: str | None = None
    primary_physician: str | None = None
    last_visit: str | None = None
    risk_level: str | None = None
    notes: str | None = None


class ConditionCreate(BaseModel):
    icd10_code: str
    description: str
    hcc_category: str | None = None
    raf_impact: float = 0
    status: str = "documented"


class ConditionUpdate(BaseModel):
    icd10_code: str | None = None
    description: str | None = None
    hcc_category: str | None = None
    raf_impact: float | None = None
    status: str | None = None


class MedicationCreate(BaseModel):
    name: str
    dosage: str | None = None
    frequency: str | None = None
    route: str | None = None
    prescriber: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str = "active"
    notes: str | None = None


class MedicationUpdate(BaseModel):
    name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    route: str | None = None
    prescriber: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None
    notes: str | None = None


class ExecuteRequest(BaseModel):
    patient_id: str
    trigger_node_type: str | None = None


class AuthRegisterRequest(BaseModel):
    role: str = Field(pattern="^(doctor|patient)$")
    email: str
    password: str = Field(min_length=6)
    username: str
    mobile: str


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthSyncRequest(BaseModel):
    role: str | None = None
    auth_user_id: str
    token: str


class AuthOnboardRequest(BaseModel):
    auth_user_id: str
    role: str = Field(pattern="^(doctor|patient)$")
    email: str
    name: str
    phone: str
    specialty: str | None = None
    fee: float | None = None
    dob: str | None = None

class AuthProfileUpdateRequest(BaseModel):
    auth_user_id: str
    role: str
    name: str
    phone: str
    specialty: str | None = None



class LabEventRequest(BaseModel):
    trigger_type: str           # e.g. "lab_results_received"
    patient_id: str
    doctor_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Local auth APIs (doctor/patient email-password)
# ---------------------------------------------------------------------------

@router.post("/auth/register")
async def auth_register(body: AuthRegisterRequest):
    try:
        return db.register_user_account(
            role=body.role,
            email=body.email,
            password=body.password,
            username=body.username,
            mobile=body.mobile,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Registration failed role=%s email=%s", body.role, body.email)
        raise HTTPException(status_code=500, detail=f"Registration failed: {exc}") from exc


@router.post("/auth/login")
async def auth_login(body: AuthLoginRequest):
    try:
        return db.login_user_account(
            email=body.email,
            password=body.password,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Login failed role=%s email=%s", body.role, body.email)
        raise HTTPException(status_code=500, detail=f"Login failed: {exc}") from exc




@router.post("/auth/sync")
async def auth_sync(req: AuthSyncRequest):
    """Sync Supabase Auth session with backend user profiles."""
    sb = db.get_supabase()
    
    # 1. Check if user exists in user_accounts
    user_acc_data = await _run_db_call(
        lambda: sb.table("user_accounts").select("*").eq("id", req.auth_user_id).execute()
    )
    
    is_new = False
    actual_role = None

    if not user_acc_data.data:
        is_new = True
        actual_role = "pending"
        # We DO NOT insert the pending role into user_accounts here
        # to avoid violating the CHECK (role IN ('doctor', 'patient')) constraint.
        # It will be inserted during the /auth/onboard step.
    else:
        user_record = user_acc_data.data[0]
        actual_role = user_record.get("role")
        if actual_role == "pending":
            is_new = True
        else:
            # 2. Check if role-specific profile exists
            if actual_role == "doctor":
                profile = await _run_db_call(
                    lambda: sb.table("doctors").select("*").eq("auth_user_id", req.auth_user_id).execute()
                )
            else:
                # Check patient_accounts first
                profile = await _run_db_call(
                    lambda: sb.table("patient_accounts").select("*").eq("auth_user_id", req.auth_user_id).execute()
                )
            if not profile.data:
                is_new = True
        
    return {
        "status": "synced",
        "is_new": is_new,
        "role": actual_role,
        "user_id": req.auth_user_id
    }


@router.post("/auth/onboard")
async def auth_onboard(req: AuthOnboardRequest):
    sb = db.get_supabase()
    
    # 1. Upsert user_accounts
    # We use upsert in case they already exist but somehow need onboarding
    await _run_db_call(
        lambda: sb.table("user_accounts").upsert({
            "id": req.auth_user_id,
            "role": req.role,
            "email": req.email,
            "username": req.name,
            "mobile": req.phone,
            "password": "OAUTH"
        }).execute()
    )
    
    # 2. Create specific profile
    if req.role == "doctor":
        await _run_db_call(
            lambda: sb.table("doctors").insert({
                "auth_user_id": req.auth_user_id,
                "name": req.name,
                "specialty": req.specialty or "General",
                "language": "English",
                "consultation_type": "video",
                "fee": req.fee or 0,
                "active": True
            }).execute()
        )
    else:
        # Find a default doctor
        doctors = await _run_db_call(
            lambda: sb.table("doctors").select("id").eq("active", True).limit(1).execute()
        )
        doctor_id = doctors.data[0]["id"] if doctors.data else None
        
        # Create Patient
        patient_res = await _run_db_call(
            lambda: sb.table("patients").insert({
                "doctor_id": doctor_id or "00000000-0000-0000-0000-000000000000",
                "name": req.name,
                "phone": req.phone,
                "dob": req.dob
            }).execute()
        )
        patient_id = patient_res.data[0]["id"]
        
        # Create Patient Account
        await _run_db_call(
            lambda: sb.table("patient_accounts").insert({
                "auth_user_id": req.auth_user_id,
                "patient_id": patient_id,
                "email": req.email
            }).execute()
        )
        
    return {"status": "success", "role": req.role}

@router.put("/auth/profile")
async def update_profile(req: AuthProfileUpdateRequest):
    sb = db.get_supabase()
    
    # 1. Update user_accounts
    await _run_db_call(
        lambda: sb.table("user_accounts").update({
            "username": req.name,
            "mobile": req.phone
        }).eq("id", req.auth_user_id).execute()
    )
    
    # 2. Update specific profile
    if req.role == "doctor":
        await _run_db_call(
            lambda: sb.table("doctors").update({
                "name": req.name,
                "specialty": req.specialty or "General"
            }).eq("auth_user_id", req.auth_user_id).execute()
        )
    else:
        # For patient, update patient record
        # Find patient id through patient_accounts
        acc = await _run_db_call(
            lambda: sb.table("patient_accounts").select("patient_id").eq("auth_user_id", req.auth_user_id).execute()
        )
        if acc.data:
            patient_id = acc.data[0]["patient_id"]
            await _run_db_call(
                lambda: sb.table("patients").update({
                    "name": req.name,
                    "phone": req.phone
                }).eq("id", patient_id).execute()
            )
            
    return {"status": "success"}


# ---------------------------------------------------------------------------
# Core app APIs used by the frontend
# ---------------------------------------------------------------------------

class DoctorFeedbackCreate(BaseModel):
    rating: int
    comment: str | None = None
    patient_id: str | None = None


class DoctorSlotCreate(BaseModel):
    slot_start: str
    slot_end: str
    status: str = "available"


class DoctorSlotUpdate(BaseModel):
    slot_start: str | None = None
    slot_end: str | None = None
    status: str | None = None


class SlotReserveRequest(BaseModel):
    patient_id: str
    hold_minutes: int = 10


class PatientPortalRegisterRequest(BaseModel):
    auth_user_id: str
    email: str
    name: str
    phone: str
    doctor_id: str


class PatientPortalBookRequest(BaseModel):
    auth_user_id: str
    consultation_type: str = "video"
    notes: str | None = None


class AppointmentUpdateRequest(BaseModel):
    doctor_id: str
    status: str | None = None
    consultation_type: str | None = None
    notes: str | None = None


class ConsultationRoomRequest(BaseModel):
    actor_role: str
    actor_id: str
    provider: str = "daily"


class ConsultationMessageRequest(BaseModel):
    actor_role: str
    actor_id: str
    message: str


class AppointmentCancelRequest(BaseModel):
    auth_user_id: str
    reason: str | None = None


class AppointmentRescheduleRequest(BaseModel):
    auth_user_id: str
    new_slot_id: str
    consultation_type: str | None = None
    notes: str | None = None


class PdfExtractAndExecuteRequest(BaseModel):
    patient_id: str
    workflow_id: str


@router.get("/doctors")
async def list_doctors_endpoint(
    specialty: str | None = None,
    language: str | None = None,
    consultation_type: str | None = None,
    available_now: bool | None = None,
):
    return await _run_db_call(
        db.list_doctors,
        specialty,
        language,
        consultation_type,
        available_now,
    )


@router.get("/doctors/{doctor_id}/availability")
async def list_doctor_availability_endpoint(doctor_id: str):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return await _run_db_call(db.list_doctor_availability, doctor_id)


@router.get("/doctors/{doctor_id}/feedback")
async def list_doctor_feedback_endpoint(doctor_id: str, limit: int = 20):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return await _run_db_call(db.list_doctor_feedback, doctor_id, limit)


@router.post("/doctors/{doctor_id}/feedback")
async def create_doctor_feedback_endpoint(
    doctor_id: str,
    body: DoctorFeedbackCreate,
    patient_id: str | None = None,
):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return await _run_db_call(
        db.create_doctor_feedback,
        doctor_id,
        body.rating,
        body.comment,
        patient_id or body.patient_id,
    )


@router.get("/doctors/{doctor_id}/slots")
async def list_doctor_slots_endpoint(
    doctor_id: str,
    include_past: bool = False,
    status: str | None = None,
):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return await _run_db_call(db.list_doctor_slots, doctor_id, include_past, status)


@router.post("/doctors/{doctor_id}/slots")
async def create_doctor_slot_endpoint(doctor_id: str, body: DoctorSlotCreate):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return await _run_db_call(db.create_doctor_slot, doctor_id, body.slot_start, body.slot_end, body.status)


@router.put("/doctors/{doctor_id}/slots/{slot_id}")
async def update_doctor_slot_endpoint(doctor_id: str, slot_id: str, body: DoctorSlotUpdate):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    payload = body.model_dump(exclude_unset=True)
    return await _run_db_call(db.update_doctor_slot, doctor_id, slot_id, payload)


@router.delete("/doctors/{doctor_id}/slots/{slot_id}")
async def delete_doctor_slot_endpoint(doctor_id: str, slot_id: str):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    await _run_db_call(db.delete_doctor_slot, doctor_id, slot_id)
    return Response(status_code=204)


@router.post("/slots/{slot_id}/reserve")
async def reserve_slot_endpoint(slot_id: str, body: SlotReserveRequest):
    slot = await _run_db_call(db.get_availability_slot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    reserved = await _run_db_call(db.reserve_slot, slot_id, body.patient_id, body.hold_minutes)
    if not reserved:
        raise HTTPException(status_code=409, detail="Slot is not available")
    return reserved


@router.post("/patient-portal/register")
async def register_patient_portal_endpoint(body: PatientPortalRegisterRequest):
    return await _run_db_call(
        db.register_patient_portal_user,
        body.auth_user_id,
        body.email,
        body.name,
        body.phone,
        body.doctor_id,
    )


@router.get("/patient-portal/me")
async def get_patient_portal_me_endpoint(auth_user_id: str):
    profile = await _run_db_call(db.get_patient_by_auth_user_id, auth_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return profile


@router.get("/patient-portal/appointments")
async def list_patient_portal_appointments_endpoint(auth_user_id: str):
    patient = await _run_db_call(db.get_patient_by_auth_user_id, auth_user_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return await _run_db_call(db.list_patient_appointments, patient["id"])


@router.post("/patient-portal/slots/{slot_id}/book")
async def book_patient_portal_slot_endpoint(slot_id: str, body: PatientPortalBookRequest):
    booked = await _run_db_call(
        db.book_slot_for_patient_portal,
        body.auth_user_id,
        slot_id,
        body.consultation_type,
        body.notes,
    )
    if not booked:
        raise HTTPException(status_code=409, detail="Slot could not be booked")
    return booked


@router.post("/patient-portal/appointments/{appointment_id}/cancel")
async def cancel_patient_portal_appointment_endpoint(appointment_id: str, body: AppointmentCancelRequest):
    try:
        return await _run_db_call(
            db.cancel_appointment_for_patient_portal,
            body.auth_user_id,
            appointment_id,
            body.reason,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/patient-portal/appointments/{appointment_id}/reschedule")
async def reschedule_patient_portal_appointment_endpoint(
    appointment_id: str,
    body: AppointmentRescheduleRequest,
):
    try:
        return await _run_db_call(
            db.reschedule_appointment_for_patient_portal,
            body.auth_user_id,
            appointment_id,
            body.new_slot_id,
            body.consultation_type,
            body.notes,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/appointments")
async def list_doctor_appointments_endpoint(doctor_id: str):
    doctor = await _run_db_call(db.get_doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return await _run_db_call(db.list_doctor_appointments, doctor_id)


@router.put("/appointments/{appointment_id}")
async def update_doctor_appointment_endpoint(appointment_id: str, body: AppointmentUpdateRequest):
    appointment = await _run_db_call(db.get_appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    payload = body.model_dump(exclude_unset=True)
    payload.pop("doctor_id", None)
    return await _run_db_call(db.update_appointment, appointment_id, payload)


@router.post("/appointments/{appointment_id}/consultation-room")
async def get_or_create_consultation_room_endpoint(appointment_id: str, body: ConsultationRoomRequest):
    appointment = await _run_db_call(db.get_appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    room = await _run_db_call(db.get_consultation_room_by_appointment, appointment_id)
    if room:
        return room
    return await _run_db_call(db.create_consultation_room, appointment_id, body.provider)


@router.get("/appointments/{appointment_id}/messages")
async def list_consultation_messages_endpoint(appointment_id: str, actor_role: str | None = None, actor_id: str | None = None):
    appointment = await _run_db_call(db.get_appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return await _run_db_call(db.list_consultation_messages, appointment_id)


@router.post("/appointments/{appointment_id}/messages")
async def create_consultation_message_endpoint(appointment_id: str, body: ConsultationMessageRequest):
    appointment = await _run_db_call(db.get_appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    room = await _run_db_call(db.get_consultation_room_by_appointment, appointment_id)
    if not room:
        room = await _run_db_call(db.create_consultation_room, appointment_id)
    payload = {
        "appointment_id": appointment_id,
        "room_id": room.get("id") if room else None,
        "sender_type": body.actor_role,
        "sender_id": body.actor_id,
        "message": body.message,
    }
    return await _run_db_call(db.create_consultation_message, payload)


@router.get("/workflows")
async def list_workflows_endpoint(doctor_id: str | None = None, status: str | None = None):
    return await _run_db_call(db.list_workflows, doctor_id, status)


@router.get("/workflows/{workflow_id}")
async def get_workflow_endpoint(workflow_id: str):
    workflow = await _run_db_call(db.get_workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.post("/workflows")
async def create_workflow_endpoint(body: WorkflowCreate):
    return await _run_db_call(db.create_workflow, body.model_dump())


@router.put("/workflows/{workflow_id}")
async def update_workflow_endpoint(workflow_id: str, body: WorkflowUpdate):
    workflow = await _run_db_call(db.get_workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    payload = body.model_dump(exclude_unset=True)
    return await _run_db_call(db.update_workflow, workflow_id, payload)


@router.delete("/workflows/{workflow_id}")
async def delete_workflow_endpoint(workflow_id: str):
    workflow = await _run_db_call(db.get_workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await _run_db_call(db.delete_workflow, workflow_id)
    return Response(status_code=204)


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow_endpoint(workflow_id: str, body: ExecuteRequest):
    workflow = await _run_db_call(db.get_workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    patient = await _run_db_call(db.get_patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    call_log = await _run_db_call(
        db.create_call_log,
        {
            "workflow_id": workflow_id,
            "doctor_id": workflow.get("doctor_id"),
            "patient_id": body.patient_id,
            "status": "running",
            "execution_log": [],
        },
    )

    execution_log = await execute_workflow(
        workflow,
        patient,
        trigger_node_type=body.trigger_node_type,
        call_log_id=call_log.get("id"),
        doctor_id=workflow.get("doctor_id"),
    )

    await _run_db_call(
        db.update_call_log,
        call_log.get("id"),
        {
            "status": "completed" if not any(step.get("status") == "error" for step in execution_log) else "failed",
            "execution_log": execution_log,
        },
    )

    return {
        "call_log_id": call_log.get("id"),
        "workflow_id": workflow_id,
        "patient_id": body.patient_id,
        "execution_log": execution_log,
    }


@router.post("/lab-event")
async def simulate_lab_event_endpoint(body: LabEventRequest):
    patient = await _run_db_call(db.get_patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor_id = body.doctor_id or patient.get("doctor_id")
    workflows = await _run_db_call(db.list_workflows, doctor_id, None)
    matching_workflows = []
    for workflow in workflows:
        nodes = workflow.get("nodes") or []
        if any((node.get("data", {}).get("nodeType") or node.get("type")) == body.trigger_type for node in nodes):
            matching_workflows.append(workflow)

    if not matching_workflows:
        return {
            "status": "no_matching_workflows",
            "trigger_type": body.trigger_type,
            "patient_id": body.patient_id,
            "doctor_id": doctor_id,
            "executions": [],
        }

    executions = []
    for workflow in matching_workflows:
        call_log = await _run_db_call(
            db.create_call_log,
            {
                "workflow_id": workflow.get("id"),
                "doctor_id": workflow.get("doctor_id"),
                "patient_id": body.patient_id,
                "status": "running",
                "execution_log": [],
            },
        )
        execution_log = await execute_workflow(
            workflow,
            patient,
            trigger_node_type=body.trigger_type,
            call_log_id=call_log.get("id"),
            doctor_id=workflow.get("doctor_id"),
            metadata=body.metadata,
        )
        await _run_db_call(
            db.update_call_log,
            call_log.get("id"),
            {
                "status": "completed" if not any(step.get("status") == "error" for step in execution_log) else "failed",
                "execution_log": execution_log,
            },
        )
        executions.append({
            "workflow_id": workflow.get("id"),
            "call_log_id": call_log.get("id"),
            "execution_log": execution_log,
        })

    return {
        "status": "triggered",
        "trigger_type": body.trigger_type,
        "patient_id": body.patient_id,
        "doctor_id": doctor_id,
        "executions": executions,
    }


@router.get("/patients")
async def list_patients_endpoint(doctor_id: str | None = None):
    return await _run_db_call(db.list_patients, doctor_id)


@router.get("/patients/{patient_id}")
async def get_patient_endpoint(patient_id: str):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/patients")
async def create_patient_endpoint(body: PatientCreate):
    sb = db.get_supabase()
    payload = body.model_dump()
    try:
        result = await _run_db_call(lambda: sb.table("patients").insert(payload).execute())
        return result.data[0]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/patients/{patient_id}")
async def update_patient_endpoint(patient_id: str, body: PatientUpdate):
    payload = body.model_dump(exclude_unset=True)
    try:
        return await _run_db_call(db.update_patient, patient_id, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/patients/{patient_id}")
async def delete_patient_endpoint(patient_id: str):
    sb = db.get_supabase()
    await _run_db_call(lambda: sb.table("patients").delete().eq("id", patient_id).execute())
    return Response(status_code=204)


@router.get("/patients/{patient_id}/conditions")
async def list_conditions_endpoint(patient_id: str):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return await _run_db_call(db.list_conditions, patient_id)


@router.post("/patients/{patient_id}/conditions")
async def create_condition_endpoint(patient_id: str, body: ConditionCreate):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    payload = body.model_dump()
    payload["patient_id"] = patient_id
    return await _run_db_call(db.create_condition, payload)


@router.put("/patients/{patient_id}/conditions/{condition_id}")
async def update_condition_endpoint(patient_id: str, condition_id: str, body: ConditionUpdate):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    payload = body.model_dump(exclude_unset=True)
    return await _run_db_call(db.update_condition, condition_id, payload)


@router.delete("/patients/{patient_id}/conditions/{condition_id}")
async def delete_condition_endpoint(patient_id: str, condition_id: str):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    await _run_db_call(db.delete_condition, condition_id)
    return Response(status_code=204)


@router.get("/patients/{patient_id}/medications")
async def list_medications_endpoint(patient_id: str):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return await _run_db_call(db.list_medications, patient_id)


@router.post("/patients/{patient_id}/medications")
async def create_medication_endpoint(patient_id: str, body: MedicationCreate):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    payload = body.model_dump()
    payload["patient_id"] = patient_id
    return await _run_db_call(db.create_medication, payload)


@router.put("/patients/{patient_id}/medications/{medication_id}")
async def update_medication_endpoint(patient_id: str, medication_id: str, body: MedicationUpdate):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    payload = body.model_dump(exclude_unset=True)
    return await _run_db_call(db.update_medication, medication_id, payload)


@router.delete("/patients/{patient_id}/medications/{medication_id}")
async def delete_medication_endpoint(patient_id: str, medication_id: str):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    await _run_db_call(db.delete_medication, medication_id)
    return Response(status_code=204)


@router.get("/call-logs")
async def list_call_logs_endpoint(workflow_id: str | None = None, doctor_id: str | None = None):
    return await _run_db_call(db.list_call_logs, workflow_id, doctor_id)


@router.post("/call-logs/{call_log_id}/check")
async def check_call_status_endpoint(call_log_id: str):
    call_log = await _run_db_call(db.get_call_log, call_log_id)
    if not call_log:
        raise HTTPException(status_code=404, detail="Call log not found")
    return call_log


@router.get("/reports")
async def list_reports_endpoint(patient_id: str | None = None, workflow_id: str | None = None):
    return await _run_db_call(db.list_reports, patient_id, workflow_id)


@router.get("/reports/{report_id}")
async def get_report_endpoint(report_id: str):
    report = await _run_db_call(db.get_report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/pdf/documents")
async def list_pdf_documents_endpoint(patient_id: str | None = None):
    return await _run_db_call(db.list_pdf_documents, patient_id)


@router.get("/pdf/documents/{doc_id}")
async def get_pdf_document_endpoint(doc_id: str):
    doc = await _run_db_call(db.get_pdf_document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="PDF document not found")
    return doc


@router.delete("/pdf/documents/{doc_id}")
async def delete_pdf_document_endpoint(doc_id: str):
    doc = await _run_db_call(db.get_pdf_document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="PDF document not found")
    await _run_db_call(db.delete_pdf_document, doc_id)
    return Response(status_code=204)


async def _store_parsed_pdf(
    *,
    file: UploadFile,
    patient_id: str | None = None,
    uploaded_by: str | None = None,
):
    file_bytes = await file.read()
    parsed = parse_pdf_document(file_bytes)
    payload = {
        "patient_id": patient_id,
        "filename": file.filename,
        "page_count": parsed.get("page_count"),
        "patient_info": parsed.get("patient_info"),
        "lab_results": parsed.get("lab_results"),
        "tables_data": parsed.get("tables"),
        "uploaded_by": uploaded_by,
    }
    record = await _run_db_call(db.create_pdf_document, payload)
    return {"document": record, "parsed": parsed}


@router.post("/pdf/upload")
async def upload_pdf_endpoint(
    file: UploadFile = File(...),
    patient_id: str | None = Form(default=None),
    uploaded_by: str | None = Form(default=None),
):
    return await _store_parsed_pdf(file=file, patient_id=patient_id, uploaded_by=uploaded_by)


@router.post("/pdf/intake")
async def pdf_intake_endpoint(
    file: UploadFile = File(...),
    doctor_id: str | None = Form(default=None),
):
    return await _store_parsed_pdf(file=file, uploaded_by=doctor_id)


@router.post("/patients/{patient_id}/import-pdf")
async def import_pdf_to_patient_endpoint(patient_id: str, file: UploadFile = File(...)):
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return await _store_parsed_pdf(file=file, patient_id=patient_id)


@router.post("/pdf/extract-and-execute")
async def extract_pdf_and_execute_endpoint(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    workflow_id: str = Form(...),
):
    stored = await _store_parsed_pdf(file=file, patient_id=patient_id)
    workflow = await _run_db_call(db.get_workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    patient = await _run_db_call(db.get_patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    call_log = await _run_db_call(
        db.create_call_log,
        {
            "workflow_id": workflow_id,
            "doctor_id": workflow.get("doctor_id"),
            "patient_id": patient_id,
            "status": "running",
            "execution_log": [],
        },
    )

    execution_log = await execute_workflow(
        workflow,
        patient,
        trigger_node_type="lab_results_received",
        call_log_id=call_log.get("id"),
        doctor_id=workflow.get("doctor_id"),
        lab_results=stored["parsed"].get("lab_results", []),
        metadata=stored["parsed"],
    )

    await _run_db_call(
        db.update_call_log,
        call_log.get("id"),
        {
            "status": "completed" if not any(step.get("status") == "error" for step in execution_log) else "failed",
            "execution_log": execution_log,
        },
    )

    return {
        **stored,
        "call_log_id": call_log.get("id"),
        "workflow_id": workflow_id,
        "execution_log": execution_log,
    }
