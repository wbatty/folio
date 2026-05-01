CREATE TABLE job_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL UNIQUE,
  gmail_thread_id text NOT NULL,
  subject text,
  from_address text,
  snippet text,
  classification text CHECK (classification IN ('confirmation', 'rejection', 'interview', 'recruiter', 'other')),
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_emails_job_id_idx ON job_emails(job_id);
CREATE INDEX job_emails_thread_idx ON job_emails(gmail_thread_id);

ALTER TABLE job_emails ENABLE ROW LEVEL SECURITY;
