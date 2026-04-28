# CARE-SYNC AI (formerly CLARUS) — Complete Project Analysis

---

## 🎯 Executive Summary

**CareSync AI** (formerly Clarus) is an AI-powered **healthcare workflow automation platform** designed to solve critical administrative bottlenecks in clinics and medical practices. It automates patient outreach, appointment scheduling, and lab follow-ups using intelligent workflows and conversational AI, dramatically reducing manual administrative work.

---

## 🔴 Problem Statement

### The Crisis in Canadian Healthcare (& Global Context)

**Current State:**
- **6 million Canadians** don't have a family doctor
- **28.6 weeks average wait time** for treatment in Canada
- **1.4 million Canadians** currently waiting on procedures (many due to missed follow-up calls)
- Clinic staff spend hours manually:
  - Reviewing lab reports
  - Calling patients one-by-one
  - Scheduling appointments
  - Managing paperwork
  - Handling insurance verifications

**Root Causes:**
1. **Manual processes** — Lab results require manual review and phone calls (labor-intensive, prone to delays)
2. **Scheduling chaos** — Booking appointments is tedious; patients miss follow-ups
3. **Staff burnout** — Front desk & nurses spend >40% of time on administrative tasks instead of patient care
4. **Lost revenue** — Missed follow-ups = missed diagnoses, delayed treatments, compliance issues
5. **Scalability gap** — As patient volume grows, clinics can't hire enough staff to keep up

**Impact Metrics:**
- Clinics waste **~40-50% of staff time** on scheduling, calling, and paperwork
- Patients miss follow-ups because **no one called them** (or they missed the call)
- Clinics lose revenue from **incomplete treatment cycles** and compliance gaps

---

## 👥 Who It Helps (Target Sector)

### Primary Users:
1. **Clinics & Medical Practices** (any specialty)
   - Family medicine
   - Cardiology, oncology, endocrinology
   - Urgent care centers
   - Diagnostic clinics

2. **Healthcare Staff:**
   - Doctors/clinicians (need less admin time)
   - Front-desk staff (reduce call volume)
   - Lab coordinators (automate result follow-up)
   - Insurance/billing teams

3. **Patients** (indirect benefit)
   - Faster appointment access
   - Proactive follow-up communication
   - Reduced wait times
   - Better care continuity

### Geographic Focus:
- **Primary:** Canada 🇨🇦 (hackathon project, specific Canadian healthcare context)
- **Scalable to:** US, UK, Australia, EU (any regulated healthcare system)

### Clinic Size:
- **Mid-to-large practices** (20+ doctors, 100+ patients/day) get maximum ROI
- Also useful for **urgent care**, **diagnostic centers**, **specialist clinics**

---

## ✅ How Clarus Solves It

### 1. **Visual Workflow Builder** (No-code automation)
Doctors drag-and-drop nodes to create workflows:
- **Triggers:** Lab results received, appointment missed, prescription expiring, new patient registered
- **Conditions:** Check insurance, patient age, result values, medication list, appointment history
- **Actions:** Call patient, send SMS, schedule appointment, create lab order, send notification, assign to staff
- **Outputs:** Generate transcripts, create reports, send summaries

**Benefit:** Workflows are saved as JSON graphs (React Flow format), allowing reusable templates for common clinic scenarios.

---

### 2. **AI Voice Calls** (Conversational AI via ElevenLabs)
**How it works:**
- Lab results come in → Workflow triggers
- System calls patient using **ElevenLabs Conversational AI agent**
- Agent delivers **personalized message** (patient name, doctor name, lab results summary)
- Agent asks patient to confirm appointment or callback time
- Patient's responses recorded and processed
- Workflow continues based on patient's response

**Example:**
```
System (AI Agent): "Hi Sarah, this is Dr. Kumar's office with your lab results. Your cholesterol is slightly elevated at 245. 
Would you like to book a follow-up? We have slots on Monday at 10 AM, Wednesday at 2 PM, or Friday at 9 AM."

Patient: "Wednesday at 2 PM works."

System: "Great! I've scheduled you for Wednesday, March 20th at 2 PM. See you then!"
```

**Benefit:** Calls run **24/7 without staff**, handle 100+ patients simultaneously, can be run at scale.

---

### 3. **Google Calendar Integration** (Automatic appointment booking)
When patient confirms during the call → Clarus **automatically creates** the appointment in Google Calendar.
- No manual data entry
- Reduces double-booking errors
- Doctor sees calendar updated in real-time

---

### 4. **PDF Intake & Extraction** (Eliminate manual data entry)
Doctors can upload medical records/lab reports (PDF) → Clarus:
- Extracts patient info (name, DOB, MRN, insurance)
- Pulls lab results and values
- Auto-creates/updates patient records in the system
- Can trigger workflows based on extracted data

**Example:** Upload a lab report PDF → System extracts abnormal results → Automatically initiates "abnormal result detected" workflow.

---

### 5. **Patient & Condition Management**
Full CRUD for:
- **Patient records:** demographics, insurance, MRN, risk level
- **ICD-10 conditions:** with HCC categories and RAF scoring
- **Medications:** dosage, frequency, prescriber, status
- **Lab results & orders** (from PDF or manual entry)

**Benefit:** Single source of truth for all patient data; easily reviewable before call.

---

### 6. **Audit Trail & Call Transcripts**
Every workflow execution is logged:
- Call transcripts (word-for-word what AI said + patient response)
- Step-by-step execution logs (which nodes ran, what actions took)
- Timestamps and outcomes
- Reports can be generated for compliance/quality assurance

**Benefit:** Full HIPAA/PIPEDA compliance audit trail.

---

## 🎁 Unique Value Propositions

### **What makes Clarus different:**

| Feature | Clarus | Traditional Solutions |
|---------|--------|----------------------|
| **Workflow Builder** | Visual, no-code, fully customizable | Rigid, pre-built workflows only |
| **AI Quality** | ElevenLabs Conversational AI (natural, context-aware) | Basic IVR or pre-recorded messages |
| **Calendar Integration** | Automatic Google Calendar sync | Manual calendar updates |
| **PDF Parsing** | Intelligent extraction + auto-patient creation | No PDF support; manual data entry |
| **Call Transcripts** | Full recordings + AI transcription | No transcripts or very limited |
| **Speed** | Calls made within seconds of lab result | Manual review + manual calling (hours/days) |
| **Scale** | 1000s of concurrent calls; AI doesn't get tired | Limited by staff availability (10-20 calls/day) |
| **Cost** | Per-call pricing; linear to volume | High fixed staff costs |
| **Compliance** | Complete audit trail + HIPAA-ready | Limited logging |

---

## 📊 Business Impact (Expected)

### For Clinics:
- **50-70% reduction** in front-desk call volume
- **90% faster** appointment scheduling
- **100+ patient follow-ups** per day (vs. 10-20 manually)
- **$50k-100k+ annual savings** per clinic (staff time + reduced no-shows)
- **Better compliance** (all calls logged; no missed follow-ups)

### For Patients:
- Appointment access within **hours** (not weeks)
- Proactive follow-up calls (not missing health updates)
- Faster treatment cycles

### For Doctors:
- **20-30 hours/week recovered** from admin tasks
- More time with patients
- Reduced staff burnout
- Better data accuracy (AI fills out records)

---

## 🏗️ System Architecture

### **Frontend (Next.js + React)**
- **Dashboard:** Patient list, calls, appointments, audit logs
- **Workflow Builder:** React Flow-based canvas for designing workflows
- **Auth:** Supabase Auth for secure login (doctor_id scoped data)

### **Backend (FastAPI + Python)**
- **REST API:** 50+ endpoints for CRUD, workflow execution, webhooks
- **Workflow Engine:** Walks the graph, evaluates conditions, dispatches actions
- **Services:**
  - **ElevenLabs Service:** Initiates outbound calls
  - **Supabase Service:** Database operations
  - **Google Calendar Service:** Creates events
  - **PDF Service:** Extracts text, tables, patient info

### **Database (Supabase PostgreSQL)**
- **Tables:** patients, workflows, call_logs, pdf_documents, conditions, medications, notifications, lab_orders, referrals, staff_assignments, reports, audit logs
- **Auth:** Supabase Auth + RLS (Row-Level Security)

### **External Integrations**
- **ElevenLabs:** AI voice agent (conversational + dynamic variables)
- **Twilio:** Phone number + voice infrastructure
- **Google Calendar:** Appointment creation
- **Supabase:** User authentication and token management

---

## 📋 Key Data Entities & Workflows

### **Trigger Types (What starts a workflow):**
- Lab results received
- Bloodwork received
- Imaging results ready
- Appointment missed
- Patient due for labs
- Prescription expiring
- New patient registered
- Follow-up due
- Abnormal result detected

### **Condition Types (Decision gates):**
- Check insurance coverage
- Check patient age
- Check result values (e.g., cholesterol > 240)
- Check appointment history
- Check medication list

### **Action Types (What the workflow does):**
- Call patient (via ElevenLabs)
- Send SMS
- Schedule appointment (Google Calendar)
- Create lab order
- Send notification
- Create referral
- Update patient record
- Assign to staff

### **Output Types (Final steps):**
- Log completion
- Generate transcript
- Create report
- Send summary to doctor

---

## 🚀 Example Workflow in Action

### **"Lab Result Follow-Up" Workflow**

```
1. TRIGGER: Lab results for patient "John Smith" received in system

2. CONDITION CHECK:
   - Is patient age > 50? YES → continue
   - Is cholesterol > 240? YES → continue

3. ACTION: Call patient
   - ElevenLabs initiates call to John's phone
   - Agent says: "Hi John, this is Dr. Kumar's office with your lab results. 
     Your cholesterol is 265, which is elevated. We recommend a follow-up."
   - John says: "OK, when can I come in?"
   - Agent: "How about next Tuesday at 2 PM?"
   - John: "That works."

4. ACTION: Schedule appointment
   - Automatically creates event in Dr. Kumar's Google Calendar

5. ACTION: Send SMS
   - John gets confirmation text: "Appointment confirmed for Mar 25 at 2 PM"

6. ACTION: Create lab order
   - System creates a follow-up lipid panel order

7. OUTPUT: Generate report
   - Transcript saved: "Call duration 2 min, patient confirmed appointment"
   - Audit log updated

8. COMPLETE ✓
   - Doctor sees all this in dashboard; John gets appointment in his calendar
```

---

## 💡 Why This Matters

**Before Clarus:**
- Lab result arrives Monday 9 AM
- Front desk reviews Friday afternoon (4-day delay)
- Front desk calls John; gets voicemail (1st attempt fails)
- Calls again Tuesday; gets John
- Manually schedules appointment
- Sends email confirmation (patient misses it)
- John doesn't show up; lab result is lost

**Cost:** 1-2 hours of front desk time + missed follow-up = lost revenue + patient health impact

**After Clarus:**
- Lab result arrives Monday 9 AM
- Workflow auto-triggers
- AI calls John Monday 10 AM (during business hours)
- John confirms appointment
- Calendar synced, SMS confirmation sent
- John shows up
- Follow-up completed in 60 seconds
- No staff involvement

**Cost:** $0.50-2.00 per call (depends on volume) + full audit trail

---

## 📈 Market Opportunity

### **Total Addressable Market (TAM):**
- **Canada:** ~13,000 medical clinics
- **North America:** ~200,000 clinics
- **Global:** ~1+ million clinics

### **Use Cases Beyond Follow-Up:**
1. **Appointment reminders** (reduce no-shows by 30-40%)
2. **Insurance pre-auth calls** (verify coverage before procedures)
3. **Patient surveys** (collect feedback after visits)
4. **Medication reminders** (AI calls patient to confirm meds taken)
5. **Prescription refill automation** (patient confirms, system auto-refills)
6. **Pre-visit screening** (collect patient history before appointment)

---

## 🔐 Compliance & Security

- **HIPAA** (US) / **PIPEDA** (Canada) compliant architecture
- **Supabase Auth** for secure authentication
- **Supabase RLS** for row-level data isolation
- **Encrypted** patient data in transit and at rest
- **Audit logs** for every action (WHO, WHAT, WHEN, WHY)
- **Call transcripts** retained for compliance reviews

---

## 🎯 Next Steps (From Demo Script)

Clarus is positioning to:
1. Get into clinics across **Canada** (pilot program)
2. Expand to **US** (larger market, similar healthcare pain points)
3. Build marketplace for **workflow templates** (community-driven automations)
4. Add **SMS-only workflows** (for patients without smartphones)
5. Integrate **EHR systems** (Epic, Cerner) for seamless data sync
6. Expand **conditions checking** (more complex decision trees)

---

## 📊 Tech Stack at a Glance

| Tech Stack | FastAPI, Next.js, Supabase, ElevenLabs, Twilio |

---

## 👨‍💻 Developer Guide

### **Setup & Execution**

#### **Backend (FastAPI)**
1. **Directory**: `cd backend`
2. **Environment**: Ensure `.env` is populated with Supabase, Twilio, and ElevenLabs keys.
3. **Execution**: `..\venv\Scripts\python run.py` (Binds to `0.0.0.0:8000`).
4. **Docs**: Swagger UI available at `http://127.0.0.1:8000/docs`.

#### **Frontend (Next.js)**
1. **Directory**: `cd frontend`
2. **Environment**: Ensure `.env.local` has `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.
3. **Execution**: `npm run dev` (Runs on `http://localhost:3000`).

---

## 🗺️ Codebase Map

### **Backend (`/backend`)**
- `run.py`: Entry point, configures Uvicorn host/port.
- `main.py`: FastAPI app initialization, CORS middleware settings.
- `app/api/endpoints.py`: **Critical File.** Contains all REST endpoints and the `auth_sync` logic.
- `app/services/supabase_service.py`: **Critical File.** Handles all database interactions and user profile creation.
- `app/core/config.py`: Pydantic settings for environment variable management.

### **Frontend (`/frontend`)**
- `app/layout.tsx`: Root layout, includes `LocalAuthProviderWrapper` and handles global hydration warnings.
- `lib/local-auth.tsx`: **Critical File.** Manages authentication state and synchronization between Supabase and the backend.
- `lib/supabase.ts`: Supabase client initialization.
- `components/marketing/`: High-quality 3D components (`sphere.tsx`, `particle-edge.tsx`) using Three.js.
- `components/app/`: Core application UI (Sidebar, AuthenticatedLayout).

---

## 🛠️ Recent Critical Fixes (April 2026)

| Issue | Fix | Files Affected |
|-------|-----|----------------|
| **Auth Sync Failure** | Fixed incorrect column name (`auth_user_id` → `id`) and wrapped sync calls in `run_in_threadpool`. | `backend/app/api/endpoints.py` |
| **Hydration Mismatch** | Added `suppressHydrationWarning` to `<html>` to handle browser extension injections. | `frontend/app/layout.tsx` |
| **Three.js Deprecation** | Migrated `THREE.Clock` to `THREE.Timer` to resolve console warnings. | `sphere.tsx`, `particle-edge.tsx` |
| **Network Reachability** | Bind backend to `0.0.0.0` and updated frontend to use `127.0.0.1`. | `run.py`, `.env.local` |

---

## 🎬 Conclusion

**Clarus** is solving a **real, massive problem** in healthcare: **administrative overload that delays patient care**. By combining:
- **No-code workflow builder** (doctors can customize, not need IT)
- **AI voice calls** (scale without staff)
- **Smart integrations** (calendar, PDF, EHR-ready)
- **Complete audit trail** (compliance-ready)

It offers **healthcare providers** a way to:
- ✅ Automate 70%+ of follow-up communication
- ✅ Reduce staff workload by 20-30 hours/week
- ✅ Get patients through treatment faster
- ✅ Improve revenue through better compliance
- ✅ Meet regulatory requirements with full audit logs

**Unique angle:** Visual workflow builder + ElevenLabs natural AI + PDF intelligence = **no vendor lock-in** (workflows are portable, data is portable, integrations are standard APIs).

---

**Created:** March 16, 2026  
**Project:** Clarus Healthcare Automation Platform  
**Status:** Production-ready (demo/beta phase)
