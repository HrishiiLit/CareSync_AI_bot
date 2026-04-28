# Healthcare PS Add-ons: 4-Hour Implementation Checklist

## Problem Statement
Patients struggle to find available doctors quickly and access consultations remotely.

## Goal
Create a web platform where patients can check doctor availability and consult via chat/video.

## Objectives
- Improve doctor-patient accessibility
- Enable remote healthcare

## Must-Have Feature Scope
- Doctor listing and availability status
- Appointment booking
- Chat/video consultation (managed WebRTC)
- Notifications and reminders
- Patient feedback system

## 4-Hour Execution Plan (Phase-wise)

## Phase 0: Schema + API Contract Setup (15 min)
Timebox: 0:00 to 0:15

Checklist
- [x] Create migration for new entities:
	- [x] `doctors`
	- [x] `availability_slots`
	- [x] `appointments`
	- [x] `consultation_rooms`
	- [x] `consultation_messages`
	- [x] `consultation_feedback`
- [x] Add indexes on `doctor_id`, `slot_start`, `appointment_id`
- [x] Add unique/locking safety for slot booking (one slot cannot be booked twice)
- [x] Define response/request payload shapes for all new APIs before coding

Definition of Done
- [x] Migration SQL runs successfully in Supabase
- [x] Constraints prevent duplicate bookings

---

## Phase 1: Doctor Directory + Availability (55 min)
Timebox: 0:15 to 1:10

Checklist
- [x] Backend DB helpers in `backend/app/services/supabase_service.py`
	- [x] list doctors (with filters)
	- [x] list doctor availability
	- [x] reserve slot
- [x] Backend APIs in `backend/app/api/endpoints.py`
	- [x] `GET /api/doctors`
	- [x] `GET /api/doctors/{doctor_id}/availability`
	- [x] `POST /api/slots/{slot_id}/reserve`
- [x] Frontend API client functions in `frontend/services/api.ts`
- [x] Patient-facing doctor directory page (public route)
	- [x] Filter by specialty/language/consultation type
	- [x] Show `Available now` or `Next slot`

Definition of Done
- [x] Doctor list renders from backend
- [x] Availability endpoint returns slots correctly
- [x] Reserve slot endpoint updates slot status

---

## Phase 2: Self-service Appointment Booking (50 min)
Timebox: 1:10 to 2:00

Checklist
- [x] Create booking flow page with date-time picker
- [x] Implement atomic booking flow:
	- [x] Reserve slot
	- [x] Create appointment row
	- [x] Mark slot as booked
- [x] Add confirmation notification creation at booking time
- [x] Add success/failure states on UI

Definition of Done
- [x] User can book from available slot
- [x] Double-book attempt fails safely
- [x] Appointment and notification rows are created

---

## Phase 3: Video + Chat Consultation Room (45 min)
Timebox: 2:00 to 2:45

Checklist
- [ ] Add managed WebRTC SDK (recommended: Daily for speed)
- [x] Create consultation room per appointment
- [ ] Add consultation route/page:
	- [ ] Join video room
	- [x] Basic chat pane
- [x] Persist chat messages to `consultation_messages`

Definition of Done
- [x] Appointment opens consultation room
- [ ] Video join is working
- [x] Chat messages save and display

---

## Phase 4: Reminders (30 min)
Timebox: 2:45 to 3:15

Checklist
- [ ] At booking, schedule 2 reminder jobs:
	- [ ] T-24h
	- [ ] T-15m
- [ ] Implement fastest dispatch path (notification table first)
- [ ] Add placeholder transport path for SMS/email if configured

Definition of Done
- [ ] Reminder jobs are created automatically on booking
- [ ] Due reminders can be dispatched via a trigger/endpoint

---

## Phase 5: Feedback + Rating Aggregation (35 min)
Timebox: 3:15 to 3:50

Checklist
- [ ] Add feedback endpoint:
	- [ ] `POST /api/appointments/{id}/feedback`
- [ ] Save rating (1-5), comment, tags
- [ ] Add doctor rating aggregation (avg rating + count)
- [ ] Show aggregated rating in doctor profile/listing
- [ ] Add post-consult feedback UI form

Definition of Done
- [ ] Feedback submission works end-to-end
- [ ] Doctor aggregated rating updates correctly

---

## Phase 6: Final QA + Demo Readiness (10 min)
Timebox: 3:50 to 4:00

Checklist
- [ ] Happy-path smoke test:
	- [ ] Doctor search
	- [ ] Slot reserve
	- [ ] Booking confirm
	- [ ] Consultation room join
	- [ ] Feedback submit
- [ ] Fix only critical demo blockers

Definition of Done
- [ ] End-to-end demo flow works once without manual DB fixes

---

## File Touchpoint Checklist

Backend
- [ ] `backend/migrations/*.sql`
- [ ] `backend/app/services/supabase_service.py`
- [ ] `backend/app/api/endpoints.py`
- [ ] `backend/main.py` (only if scheduler/reminder hook is needed)

Frontend
- [ ] `frontend/services/api.ts`
- [ ] New/updated doctor directory page
- [ ] New/updated booking flow page
- [ ] New/updated consultation room page
- [ ] Post-consult feedback UI
- [ ] `frontend/package.json` (WebRTC SDK dependency)

---

## Risk Control Checklist (Do early)
- [ ] Validate slot locking in DB before UI polish
- [ ] Integrate only one video provider (no multi-provider abstraction now)
- [ ] Keep reminder transport simple (notification-first)
- [ ] Avoid adding non-essential features before must-haves are complete

---

## Stretch Goals (Only if time remains)
- [ ] SMS reminder delivery via Twilio
- [ ] Better doctor sorting (rating + next available)
- [ ] Consultation chat typing indicators
- [ ] Feedback tag analytics widget