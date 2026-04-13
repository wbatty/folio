-- Job status enum (includes RESEARCH_ERROR for failed scrape attempts)
CREATE TYPE job_status AS ENUM (
  'RESEARCHING',
  'RESEARCH_ERROR',
  'PENDING_APPLICATION',
  'APPLIED',
  'INTERVIEWING',
  'OFFERED',
  'DENIED',
  'WITHDRAWN'
);

-- Resumes table
-- PDF files are stored in Supabase Storage bucket "resumes"; pdf_path holds the storage object path
CREATE TABLE resumes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename   text NOT NULL,
  content    text NOT NULL,
  pdf_path   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Jobs table
CREATE TABLE jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url              text NOT NULL,
  company          text,
  title            text,
  description      text,       -- short extracted description shown in UI
  description_full text,       -- full scraped markdown; cached to allow re-extraction without re-scraping
  status           job_status NOT NULL DEFAULT 'RESEARCHING',
  date_applied     timestamptz,
  resume_id        uuid REFERENCES resumes(id),
  deleted_at       timestamptz,  -- soft delete; null = active
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Status logs (immutable audit trail)
CREATE TABLE status_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status     job_status NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  question   text NOT NULL,
  context    text,
  response   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notes
CREATE TABLE notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
