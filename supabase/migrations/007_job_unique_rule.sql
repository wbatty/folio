
CREATE UNIQUE INDEX jobs_url_active_uniq
  ON jobs (url)
  WHERE deleted_at IS NULL;