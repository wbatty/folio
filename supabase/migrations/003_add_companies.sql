-- Companies table
CREATE TABLE companies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  site              text,
  job_listing_index text,
  last_checked_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Reuse the existing set_updated_at trigger function from migration 001
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add company_id FK to jobs (nullable so existing rows are not broken)
ALTER TABLE jobs ADD COLUMN company_id uuid REFERENCES companies(id);

-- Seed companies from distinct existing job.company values, then back-fill FK
WITH inserted AS (
  INSERT INTO companies (name)
  SELECT DISTINCT company
  FROM jobs
  WHERE company IS NOT NULL
    AND company <> ''
  RETURNING id, name
)
UPDATE jobs
SET company_id = inserted.id
FROM inserted
WHERE jobs.company = inserted.name;

-- Drop the now-redundant text column
ALTER TABLE jobs DROP COLUMN company;
