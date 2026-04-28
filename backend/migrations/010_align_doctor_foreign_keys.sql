-- =========================================================================
-- Align doctor foreign keys and data types
-- Fixes schema mismatch between patients/workflows (TEXT) and doctors (UUID)
-- =========================================================================

-- 1. Alter patients table
-- Cast the existing TEXT to UUID. If the existing data is not a valid UUID, this will fail.
-- Assuming standard UUIDs have been used (or empty strings need cleanup first).
-- We'll handle '00000000-0000-0000-0000-000000000000' or similar UUID-like strings.

ALTER TABLE patients
ALTER COLUMN doctor_id TYPE UUID USING doctor_id::uuid;

ALTER TABLE patients
ADD CONSTRAINT fk_patients_doctor_id
FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;

-- 2. Alter workflows table
ALTER TABLE workflows
ALTER COLUMN doctor_id TYPE UUID USING doctor_id::uuid;

ALTER TABLE workflows
ADD CONSTRAINT fk_workflows_doctor_id
FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
