ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS application_questions jsonb;
