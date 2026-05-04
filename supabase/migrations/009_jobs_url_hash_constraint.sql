-- Run AFTER scripts/backfill-url-hash.ts has populated url_hash for every active row.

ALTER TABLE jobs ALTER COLUMN url_hash SET NOT NULL;

CREATE UNIQUE INDEX jobs_url_hash_active_uniq
  ON jobs (url_hash)
  WHERE deleted_at IS NULL;
