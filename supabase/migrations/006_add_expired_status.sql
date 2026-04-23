-- Add EXPIRED to the job_status enum
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Migrate WITHDRAWN jobs where a status_log note mentions "expired"
UPDATE jobs
SET status = 'EXPIRED', updated_at = now()
WHERE status = 'WITHDRAWN'
  AND id IN (
    SELECT DISTINCT job_id FROM status_logs
    WHERE lower(note) LIKE '%expired%'
  );

-- Also migrate WITHDRAWN jobs where a free-form note mentions "expired"
UPDATE jobs
SET status = 'EXPIRED', updated_at = now()
WHERE status = 'WITHDRAWN'
  AND id IN (
    SELECT DISTINCT job_id FROM notes
    WHERE lower(content) LIKE '%expired%'
  );

-- Insert a status_log entry for every migrated job (audit trail)
INSERT INTO status_logs (job_id, status, note)
SELECT id, 'EXPIRED', 'Migrated from WITHDRAWN: job posting expired'
FROM jobs
WHERE status = 'EXPIRED';
