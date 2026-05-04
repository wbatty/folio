-- Adds the url_hash column for canonical-URL based dedupe.
-- Nullable on purpose: existing rows are populated by scripts/backfill-url-hash.ts
-- before migration 009 enforces NOT NULL + the unique index.

ALTER TABLE jobs ADD COLUMN url_hash text;
