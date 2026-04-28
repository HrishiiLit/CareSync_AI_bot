# CareSync AI Endpoint Catalog

This file lists all currently defined backend HTTP endpoints.

## Base Paths

- Health endpoint base: `/`
- API router prefix: `/api`

## Endpoints

| Method | Path | One-line summary |
|---|---|---|
| GET | `/health` | Basic service health check that returns API status. |
| POST | `/api/auth/register` | Registers a new doctor or patient local-auth user account. |
| POST | `/api/auth/login` | Authenticates a doctor or patient and returns login payload/token data. |
| POST | `/api/doctors/{doctor_id}/feedback` | Submits a patient feedback entry for a doctor. |
| GET | `/api/doctors/{doctor_id}/feedback` | Lists recent feedback records for a doctor. |
| GET | `/api/doctors` | Returns a filtered list of doctors with availability/metadata. |
| GET | `/api/doctors/{doctor_id}/availability` | Fetches availability slots for a doctor. |
| GET | `/api/doctors/{doctor_id}/slots` | Lists doctor slot records with optional query filters. |
| POST | `/api/doctors/{doctor_id}/slots` | Creates a new availability slot for a doctor. |
| PUT | `/api/doctors/{doctor_id}/slots/{slot_id}` | Updates an existing doctor availability slot. |
| DELETE | `/api/doctors/{doctor_id}/slots/{slot_id}` | Deletes a doctor availability slot. |
| POST | `/api/slots/{slot_id}/reserve` | Places a temporary hold/reservation on a slot for a patient. |
| POST | `/api/patient-portal/register` | Creates a patient-portal profile linked to an auth user. |
| GET | `/api/patient-portal/me` | Returns patient-portal profile details for the authenticated user ID. |
| GET | `/api/patient-portal/appointments` | Lists appointments for a patient-portal user. |
| GET | `/api/appointments` | Lists doctor-side appointments for a doctor ID. |
| PUT | `/api/appointments/{appointment_id}` | Updates doctor-managed appointment fields/status. |
| POST | `/api/appointments/{appointment_id}/consultation-room` | Creates or retrieves consultation room/session details for an appointment. |
| GET | `/api/appointments/{appointment_id}/messages` | Retrieves consultation chat/messages for an appointment room. |
| POST | `/api/appointments/{appointment_id}/messages` | Adds a new consultation message to an appointment thread. |
| POST | `/api/patient-portal/slots/{slot_id}/book` | Confirms booking of a slot from patient portal flow. |
| POST | `/api/patient-portal/appointments/{appointment_id}/cancel` | Cancels a patient appointment from portal workflow. |
| POST | `/api/patient-portal/appointments/{appointment_id}/reschedule` | Reschedules a patient appointment via portal flow. |
| GET | `/api/patients` | Lists patients, optionally filtered by doctor. |
| POST | `/api/patients` | Creates a new patient record. |
| GET | `/api/patients/{patient_id}` | Returns one patient record by ID. |
| PUT | `/api/patients/{patient_id}` | Updates patient demographic/clinical metadata. |
| DELETE | `/api/patients/{patient_id}` | Deletes a patient record. |
| GET | `/api/patients/{patient_id}/conditions` | Lists condition/problem entries for a patient. |
| POST | `/api/patients/{patient_id}/conditions` | Creates a new condition entry for a patient. |
| PUT | `/api/patients/{patient_id}/conditions/{condition_id}` | Updates an existing patient condition. |
| DELETE | `/api/patients/{patient_id}/conditions/{condition_id}` | Deletes a patient condition entry. |
| GET | `/api/patients/{patient_id}/medications` | Lists medication records for a patient. |
| POST | `/api/patients/{patient_id}/medications` | Creates a medication record for a patient. |
| PUT | `/api/patients/{patient_id}/medications/{medication_id}` | Updates a patient medication record. |
| DELETE | `/api/patients/{patient_id}/medications/{medication_id}` | Deletes a patient medication record. |
| GET | `/api/workflows` | Lists workflow definitions, optionally filtered by doctor/category/status. |
| POST | `/api/workflows` | Creates a new automation workflow definition. |
| GET | `/api/workflows/{workflow_id}` | Retrieves one workflow definition by ID. |
| PUT | `/api/workflows/{workflow_id}` | Updates workflow metadata/graph structure. |
| DELETE | `/api/workflows/{workflow_id}` | Deletes a workflow definition. |
| POST | `/api/workflows/{workflow_id}/execute` | Executes a workflow for a patient and trigger context. |
| POST | `/api/lab-event` | Ingests lab trigger events and runs associated workflow logic. |
| GET | `/api/elevenlabs/debug/{conversation_id}` | Returns debug details for an ElevenLabs conversation mapping. |
| POST | `/api/elevenlabs/webhook` | Receives ElevenLabs webhook events and processes call automation actions. |
| POST | `/api/twilio/voice` | Handles inbound Twilio voice webhook and returns call control instructions. |
| POST | `/api/twilio/gather` | Handles Twilio gather/DTMF follow-up webhook logic. |
| GET | `/api/call-logs` | Lists call logs with optional status/date/style filters. |
| POST | `/api/call-logs/{log_id}/check` | Checks and refreshes status/details of a specific call log. |
| POST | `/api/pdf/upload` | Uploads and stores a PDF document with extracted metadata. |
| POST | `/api/pdf/intake` | Runs structured intake extraction from uploaded PDF content. |
| POST | `/api/patients/{patient_id}/import-pdf` | Imports a PDF directly into a patient context and persists extracted data. |
| GET | `/api/pdf/documents` | Lists stored PDF documents, optionally filtered by patient. |
| GET | `/api/pdf/documents/{doc_id}` | Retrieves a single stored PDF document record. |
| DELETE | `/api/pdf/documents/{doc_id}` | Deletes a stored PDF document record. |
| POST | `/api/pdf/extract-and-execute` | Extracts PDF data then triggers configured workflow execution. |
| GET | `/api/notifications` | Lists generated patient/workflow notification records. |
| GET | `/api/lab-orders` | Lists patient lab order records. |
| GET | `/api/referrals` | Lists referral records associated with patients. |
| GET | `/api/staff-assignments` | Lists patient-to-staff assignment records. |
| GET | `/api/reports` | Lists generated reports with optional filtering. |
| GET | `/api/reports/{report_id}` | Retrieves a detailed report by ID. |

## Source of truth

- `backend/main.py`
- `backend/app/api/endpoints.py`
