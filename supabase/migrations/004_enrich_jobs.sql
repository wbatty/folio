ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS company_website     text,
  ADD COLUMN IF NOT EXISTS company_summary     text,
  ADD COLUMN IF NOT EXISTS work_style          text,
  ADD COLUMN IF NOT EXISTS required_skills     text[],
  ADD COLUMN IF NOT EXISTS preferred_skills    text[],
  ADD COLUMN IF NOT EXISTS primary_languages   text[],
  ADD COLUMN IF NOT EXISTS frameworks          text[],
  ADD COLUMN IF NOT EXISTS role_classification text,
  ADD COLUMN IF NOT EXISTS position_summary    text,
  ADD COLUMN IF NOT EXISTS compensation        jsonb,
  ADD COLUMN IF NOT EXISTS benefits            text[],
  ADD COLUMN IF NOT EXISTS flags               jsonb,
  ADD COLUMN IF NOT EXISTS claude_cost_usd     numeric NOT NULL DEFAULT 0;
