# Workflow Feature Technical Summary (Frontend + Backend)

This document describes the complete workflow feature implementation in CareSync AI, including:

- Frontend workflow builder and management UX
- Frontend API contracts used by workflow screens
- Backend API endpoints directly related to workflows
- Workflow execution engine internals and node dispatch behavior
- Database schema objects used by workflow lifecycle
- End-to-end execution paths: manual run, lab-event auto-run, PDF-triggered run, and call completion handling

---

## 1. High-Level Architecture

The workflow system is a graph-based clinical automation engine:

1. Doctor designs a workflow graph in the frontend using React Flow nodes and edges.
2. Graph is persisted to backend as `workflows.nodes` and `workflows.edges` JSONB.
3. A workflow is executed either:
   - Manually (`POST /api/workflows/{workflow_id}/execute`)
   - Via lab event (`POST /api/lab-event`)
   - Via PDF extraction flow (`POST /api/pdf/extract-and-execute`)
4. Backend traverses the graph from trigger node and executes node handlers.
5. Every run writes a `call_logs` record with `execution_log` step history.
6. If a call is initiated, outcome is finalized by:
   - ElevenLabs webhook (`POST /api/elevenlabs/webhook`) and/or
   - Polling endpoint (`POST /api/call-logs/{log_id}/check`) and/or
   - Background auto-poller started by backend.

---

## 2. Frontend Implementation

### 2.1 Workflow Route + Entry

- Route: `frontend/app/(workflow)/workflow/page.tsx`
- Wraps `WorkflowBuilder` in `Suspense`.
- Main builder component: `frontend/components/workflow/WorkflowBuilder.tsx`

### 2.2 Core Builder Stack

`WorkflowBuilder` uses:

- `@xyflow/react` for graph editor
- `dagre` for auto-layout
- Custom node renderers:
  - `TriggerNode`
  - `ActionNode`
  - `ConditionalNode`
  - `EndpointNode`
- Left palette: `NodePalette`
- Right panel: `PropertiesPanel`

State management in builder includes:

- Graph state: `nodes`, `edges`
- Selection state: `selectedNode`
- Undo/redo snapshots using internal history refs
- Save state: `savedWorkflowId`, `workflowName`, `workflowDescription`, status flags
- Load modal state and workflow list
- Run modal state with patient picker/create-patient fallback
- Execution result state for run modal (`execution_log` rendering)

### 2.3 Node Data Contract (Critical)

Node data uses two different type systems:

1. React Flow render type (`node.type`):
   - `trigger`, `action`, `conditional`, `endpoint`
2. Backend dispatch type (`node.data.nodeType`):
   - Must match backend workflow engine constants and handlers.

This mapping is explicitly defined in `frontend/components/workflow/types.ts`.

### 2.4 Node Catalogue (Frontend -> Backend Contract)

Configured catalog categories in `NODE_CATALOGUE`:

- Triggers:
  - `lab_results_received`
  - `abnormal_result_detected`
  - `follow_up_due`
  - `appointment_missed`
  - `new_patient_registered`
  - `prescription_expiring`
- Actions:
  - `call_patient`
  - `send_sms`
  - `schedule_appointment`
  - `send_notification`
  - `create_lab_order`
  - `create_referral`
  - `update_patient_record`
  - `assign_to_staff`
- Conditionals:
  - `check_result_values`
  - `check_insurance`
  - `check_patient_age`
  - `check_appointment_history`
  - `check_medication_list`
- Output:
  - `log_completion`
  - `generate_transcript`
  - `create_report`
  - `send_summary_to_doctor`

### 2.5 Edge and Conditional Branching Semantics

Conditional nodes expose two source handles:

- `sourceHandle="true"` (green)
- `sourceHandle="false"` (red)

Builder supports cmd/ctrl-hover quick-connect behavior:

- Hovering left half sets `true` handle
- Hovering right half sets `false` handle

Backend engine consumes these `sourceHandle` values to choose branch paths.

### 2.6 Builder Behaviors

- Auto-load workflow by query param `?id=<workflowId>`
- Load/save/update workflow via API
- Export graph JSON (`{ nodes, edges }`)
- Example workflow seeding
- Canvas clear/reset
- Auto-layout with dagre
- Run workflow modal:
  - Lists doctor-scoped patients first
  - Falls back to all patients if scoped list is empty
  - Allows inline patient creation
  - Executes workflow and renders execution step statuses

### 2.7 Workflow Management Screen

`frontend/app/(app)/triggers/page.tsx` provides workflow registry UX:

- Fetch doctor-scoped workflows
- Search/filter by status (`all`, `ENABLED`, `DRAFT`)
- Toggle status (`ENABLED <-> DRAFT`) using update endpoint
- Delete workflow
- Deep-link edit: `/workflow?id=<id>`

### 2.8 Workflow Monitoring Screens

- `frontend/app/(app)/calls/page.tsx`
  - Lists workflow execution logs from `call_logs`
  - Filter/search by IDs/status/outcome
  - Expand row to inspect per-step `execution_log`

- `frontend/app/(app)/audit-log/page.tsx`
  - Flattens all step logs into event table
  - Uses `execution_log` as primary audit source

- `frontend/app/(app)/dashboard/page.tsx`
  - Shows workflow counts and active statuses
  - Uses workflows + call logs to compute summary metrics

---

## 3. Frontend API Layer (Workflow-Related)

File: `frontend/services/api.ts`

### 3.1 Workflow CRUD APIs

- `listWorkflows(doctorId?, status?)`
  - `GET /api/workflows?doctor_id=&status=`
- `getWorkflow(workflowId)`
  - `GET /api/workflows/{workflowId}`
- `createWorkflow(payload)`
  - `POST /api/workflows`
- `updateWorkflow(workflowId, payload)`
  - `PUT /api/workflows/{workflowId}`
- `deleteWorkflow(workflowId)`
  - `DELETE /api/workflows/{workflowId}`

### 3.2 Execution APIs

- `executeWorkflow(workflowId, patientId, triggerNodeType?)`
  - `POST /api/workflows/{workflowId}/execute`
  - Body: `{ patient_id, trigger_node_type }`

- `simulateLabEvent(triggerType, patientId, doctorId?, metadata?)`
  - `POST /api/lab-event`
  - Body: `{ trigger_type, patient_id, doctor_id, metadata }`

- `checkCallStatus(callLogId)`
  - `POST /api/call-logs/{log_id}/check`

### 3.3 Data APIs Supporting Workflow UX

- Patients for run modal and add-patient path
  - `GET /api/patients`
  - `POST /api/patients`

- Call log and reporting views
  - `GET /api/call-logs`
  - `GET /api/reports`

- PDF-driven workflow execution
  - `POST /api/pdf/extract-and-execute`

---

## 4. Backend API Endpoints Related to Workflows

All endpoints are mounted under `/api` (`backend/main.py`, router prefix).

### 4.1 Workflow CRUD

In `backend/app/api/endpoints.py`:

1. `GET /api/workflows`
   - Optional query params: `doctor_id`, `status`
   - Returns workflow list ordered by created timestamp desc

2. `POST /api/workflows`
   - Body schema: `WorkflowCreate`
   - Fields:
     - `doctor_id`, `name`
     - optional `description`
     - `category` default `Ungrouped`
     - `status` default `DRAFT`
     - `nodes`, `edges` default empty lists

3. `GET /api/workflows/{workflow_id}`
   - 404 if not found

4. `PUT /api/workflows/{workflow_id}`
   - Body schema: `WorkflowUpdate`
   - Partial update; ignores null fields
   - Returns current record unchanged if payload empty

5. `DELETE /api/workflows/{workflow_id}`
   - 404 if not found
   - Returns 204 on success

### 4.2 Manual Workflow Execution

`POST /api/workflows/{workflow_id}/execute`

Request schema `ExecuteRequest`:

- `patient_id` (required)
- `trigger_node_type` (optional)

Execution flow:

1. Validate workflow and patient existence.
2. Create `call_logs` row with:
   - `workflow_id`, `patient_id`
   - `trigger_node`
   - `status = running`
3. Call `execute_workflow(...)` engine.
4. Infer final status:
   - `failed` if any step has `status=error`
   - `running` if call was initiated (conversation pending)
   - `completed` otherwise
5. Update `call_logs.execution_log` and status.
6. If call initiated, start async background auto-poller task.
7. Return `{ call_log_id, status, execution_log, message }`.

### 4.3 Lab Event Triggered Auto-Execution

`POST /api/lab-event`

Request schema `LabEventRequest`:

- `trigger_type`
- `patient_id`
- optional `doctor_id`
- optional `metadata`

Flow:

1. Validate patient exists.
2. Fetch `ENABLED` workflows (optionally doctor-filtered).
3. For each workflow, detect matching trigger by scanning node types.
4. For each match:
   - Create running call_log
   - Execute engine with metadata and optional `lab_results`
   - Resolve final status (`failed`/`running`/`completed`)
   - Start auto-poller if call initiated
5. Return aggregate results and execution count.

### 4.4 Call Logs + Polling Endpoint

1. `GET /api/call-logs`
   - Optional query params: `workflow_id`, `doctor_id`
   - Returns `call_logs` ordered newest first

2. `POST /api/call-logs/{log_id}/check`
   - Polls ElevenLabs conversation by `conversation_id` in execution log
   - Extracts data-collection results:
     - `call_outcome`
     - `patient_confirmed`
     - `confirmed_date`
     - `confirmed_time`
     - `doctor_name`
     - `patient_availability_notes`
     - transcript
   - Appends a poll step to `execution_log`
   - Marks call_log completed
   - Optionally creates Google Calendar event if patient confirmed

### 4.5 ElevenLabs Webhook

`POST /api/elevenlabs/webhook`

Important behavior:

- Optional signature verification using `ElevenLabs-Signature` header and `ELEVENLABS_WEBHOOK_SECRET`
- Resolves matching `call_log` by searching execution_log for `conversation_id`
- Appends webhook completion step to execution log
- Marks call as completed and stores outcome details
- Creates Google Calendar event on confirmed appointment
- Logs calendar success/failure as execution steps

Companion debug endpoint:

- `GET /api/elevenlabs/debug/{conversation_id}`

### 4.6 PDF-Driven Execute Endpoint

`POST /api/pdf/extract-and-execute` (multipart form)

Fields:

- `file` (PDF only)
- `patient_id`
- `workflow_id`

Flow:

1. Parse PDF with `parse_pdf_document`.
2. Validate workflow and patient.
3. Persist `pdf_documents` record with extracted info.
4. Create running call_log with trigger node `pdf_upload`.
5. Execute workflow with:
   - `lab_results` from parsed PDF
   - metadata containing PDF doc id + extracted structures
6. Mark status as `failed` if any error step else `completed`.
7. Return parsed+execution payload including `execution_log`.

### 4.7 Workflow-Generated Artifact List Endpoints

These expose data generated by workflow action/output nodes:

- `GET /api/notifications`
- `GET /api/lab-orders`
- `GET /api/referrals`
- `GET /api/staff-assignments`
- `GET /api/reports`
- `GET /api/reports/{report_id}`

### 4.8 Supporting Endpoints Required by Workflow UX

- `GET /api/patients`
- `POST /api/patients`
- `GET /api/patients/{id}`
- `PUT /api/patients/{id}`
- `DELETE /api/patients/{id}`
- `GET/POST/PUT/DELETE` condition and medication subresources

These are used by run modal patient selection/creation and by conditional/action handlers.

---

## 5. Workflow Engine Internals

File: `backend/app/services/workflow_engine.py`

### 5.1 Recognized Node Type Sets

- `TRIGGER_TYPES`
- `CONDITION_TYPES`
- `ACTION_TYPES`
- `OUTPUT_TYPES`

Dispatch is based on `node.data.nodeType` (lowercased fallback to `node.type`).

### 5.2 Graph Traversal Strategy

Algorithm:

1. Build adjacency maps from edges.
2. Find first trigger node in graph.
3. BFS-style queue traversal from trigger.
4. Maintain `visited` set (node executed at most once per run).
5. For conditional nodes, branch selection uses edge `sourceHandle`:
   - `true` branch when condition passes
   - `false` branch when condition fails
   - fallback: no-handle edge may be treated as true/default path

### 5.3 Execution Context

Context dict includes:

- `patient`
- `call_log_id`
- `workflow_id`, `workflow_name`
- `doctor_id`, `doctor_name`
- `lab_results`
- `metadata`
- internal `_execution_log` reference
- runtime values such as `conversation_id`, `call_sid`, and appointment fields

### 5.4 Condition Handlers

1. `check_patient_age`
   - Evaluates DOB against operator + thresholds
2. `check_insurance`
   - Validates insurance presence or provider match
3. `check_result_values`
   - Uses `lab_results` from context/metadata, compares against thresholds
4. `check_appointment_history`
   - Uses completed call logs as visit proxy, checks overdue window
5. `check_medication_list`
   - Checks active patient medications against configured terms

Each returns `(passed_boolean, step_log)` with `status` typically `ok` or `skipped`, and `error` for invalid input/runtime issues.

### 5.5 Action Handlers

1. `call_patient`
   - Calls ElevenLabs outbound API (`initiate_outbound_call`)
   - Stores `conversation_id` / `call_sid` in context and step logs

2. `schedule_appointment`
   - If no confirmation data yet: logs deferred scheduling
   - If confirmed date/time exists: creates Google Calendar event

3. `send_sms`
   - Sends SMS via Twilio REST API

4. `send_notification`
   - Inserts `notifications` record

5. `create_lab_order`
   - Inserts `lab_orders` record

6. `create_referral`
   - Inserts `referrals` record

7. `update_patient_record`
   - Validates allowed fields then updates patient row

8. `assign_to_staff`
   - Inserts `staff_assignments` record

Unknown action types are handled by generic fallback and marked ok with informational message.

### 5.6 Output Handlers

1. `log_completion`
   - terminal success log
2. `generate_transcript`
   - fetches conversation transcript and appends transcript step data
3. `create_report`
   - compiles structured summary and inserts `reports` row
4. `send_summary_to_doctor`
   - composes summary and stores as notification for doctor recipient

### 5.7 Step Logging Format

Each step log includes:

- `node_id`
- `node_type`
- `label`
- `status` (`ok`, `skipped`, `error`, etc.)
- `message`
- `timestamp`
- optional extras (e.g., `conversation_id`, `calendar_event_id`, `report_id`, metrics)

This drives UI displays in run modal, call logs page, and audit log page.

---

## 6. Async Call Completion Flows

There are three completion mechanisms for outbound call workflows:

1. Auto-poller task (started immediately after run if call initiated)
2. Webhook completion from ElevenLabs
3. Manual/dev polling endpoint (`/call-logs/{id}/check`)

### 6.1 Auto-Poller Highlights

`_auto_poll_call_result` in endpoints module:

- Sleeps initially to allow call setup
- Resolves conversation id by call SID if needed
- Polls conversation status until terminal
- Uses transcript + summary fallbacks to infer confirmation if DCR data incomplete
- Resolves natural language date/time into ISO-friendly forms
- Updates call_log + execution steps
- Creates calendar event when confirmation data is sufficient

---

## 7. Database Model Used by Workflows

From `backend/migrations/000_create_base_tables.sql` and `001_create_new_tables.sql`.

### 7.1 Core Workflow Tables

1. `workflows`
   - `doctor_id`, `name`, `description`, `category`, `status`, `nodes` JSONB, `edges` JSONB
2. `patients`
   - doctor-scoped demographic and risk fields
3. `call_logs`
   - links workflow+patient, status/outcome, `execution_log` JSONB
4. `patient_conditions`
5. `patient_medications`

### 7.2 Workflow Artifact Tables

1. `notifications`
2. `lab_orders`
3. `referrals`
4. `staff_assignments`
5. `reports`
6. `pdf_documents`

### 7.3 Key Indexed Paths

- `workflows(doctor_id)`
- `call_logs(workflow_id)` and `call_logs(patient_id)`
- patient and report lookup indexes for workflow dashboards

---

## 8. Backend Service Dependencies in Workflow Flow

### 8.1 Supabase Service Layer

`backend/app/services/supabase_service.py` wraps all workflow-related DB operations:

- workflow CRUD
- patient CRUD/list
- call log create/update/list/get
- output artifact create/list functions

### 8.2 ElevenLabs Service

`backend/app/services/elevenlabs_service.py`:

- `initiate_outbound_call(...)`
  - hits ElevenLabs ConvAI Twilio endpoint
  - injects dynamic variables for agent prompt context
- `get_conversation(...)`
- `list_recent_conversations(...)`
- `get_conversation_by_call_sid(...)`

### 8.3 Google Calendar Service

`backend/app/services/google_calendar_service.py`:

- Retrieves Google OAuth token from Supabase
- Creates primary calendar event via Google Calendar API

### 8.4 PDF Service

`backend/app/services/pdf_service.py`:

- Extracts raw text + tables
- Parses patient info via regex
- Parses lab lines with numeric/reference-range logic
- Parses medications from sections and keyword fallback

---

## 9. Configuration Dependencies

From `backend/app/core/config.py`, workflow paths depend on:

- Supabase
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Twilio
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
- ElevenLabs
  - `ELEVENLABS_API_KEY`
  - `ELEVENLABS_AGENT_ID`
  - `ELEVENLABS_PHONE_NUMBER_ID`
  - `ELEVENLABS_WEBHOOK_SECRET`
- Google Calendar bridge
  - Tokens managed via Supabase

---

## 10. End-to-End Sequence Summaries

### 10.1 Manual Run from Builder

1. User saves graph -> workflow row persisted.
2. User selects patient and clicks Execute.
3. Backend creates `call_logs` running row.
4. Engine traverses graph and executes handlers.
5. If outbound call occurs, status remains running and auto-poller starts.
6. Completion data updates call log and may create calendar event.
7. Frontend monitoring screens reflect step-level details from execution_log.

### 10.2 Auto Run from Lab Event

1. External/Simulated event posts trigger type + patient.
2. Backend finds ENABLED workflows with matching trigger nodeType.
3. Each matching workflow executes independently and writes call logs.
4. Response returns per-workflow status and call_log ids.

### 10.3 PDF Extract + Execute

1. PDF uploaded with patient + workflow ids.
2. Parser extracts structured lab/patient data.
3. Parsed data stored in `pdf_documents`.
4. Workflow executes with extracted `lab_results` context.
5. Execution results logged and returned.

---

## 11. Important Implementation Notes / Constraints

1. Contract strictness:
   - `data.nodeType` values in frontend must match backend handler constants exactly.
2. Trigger resolution in engine:
   - engine picks first trigger node found as initial queue seed.
3. Node visit semantics:
   - visited set prevents same-node re-execution in one run.
4. Workflow status semantics:
   - `DRAFT` vs `ENABLED` determines whether lab-event auto-run considers a workflow.
5. Call finalization semantics:
   - `running` means async call outcome is still pending.
6. Execution observability:
   - `execution_log` JSONB is the source of truth for audit and run visualization.

---

## 12. Quick Endpoint Inventory (Workflow Scope)

- `GET /api/workflows`
- `POST /api/workflows`
- `GET /api/workflows/{workflow_id}`
- `PUT /api/workflows/{workflow_id}`
- `DELETE /api/workflows/{workflow_id}`
- `POST /api/workflows/{workflow_id}/execute`
- `POST /api/lab-event`
- `GET /api/call-logs`
- `POST /api/call-logs/{log_id}/check`
- `POST /api/elevenlabs/webhook`
- `GET /api/elevenlabs/debug/{conversation_id}`
- `POST /api/pdf/extract-and-execute`
- `GET /api/reports`
- `GET /api/reports/{report_id}`
- `GET /api/notifications`
- `GET /api/lab-orders`
- `GET /api/referrals`
- `GET /api/staff-assignments`
- Supporting UX/data endpoints used by workflow screens:
  - `GET /api/patients`
  - `POST /api/patients`
