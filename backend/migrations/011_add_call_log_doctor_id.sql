-- =========================================================================
-- Add doctor_id to call_logs so doctor-specific call history can be stored
-- Run this after the existing schema migrations
-- =========================================================================

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_call_logs_doctor_id ON call_logs(doctor_id);

-- Backfill existing rows from the workflow's doctor_id when available.
UPDATE call_logs cl
SET doctor_id = w.doctor_id
FROM workflows w
WHERE cl.workflow_id = w.id
  AND cl.doctor_id IS NULL;