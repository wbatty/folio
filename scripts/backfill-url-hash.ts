/**
 * One-shot backfill of jobs.url_hash. Run between migrations 008 and 009:
 *
 *   1. Apply 008 (adds nullable url_hash column)
 *   2. npm run backfill-url-hash
 *   3. Apply 009 (NOT NULL + unique partial index)
 *
 * Required env: DATABASE_URL (direct postgres connection — same as queue consumer).
 *
 * Behavior on collision: a row whose normalized URL matches the hash already
 * present on another active row is left with NULL url_hash, logged, and counted
 * under skippedCollision. The operator must soft-delete or merge the duplicates
 * before re-running. We do NOT auto-merge.
 */

import pg from "pg";
import { normalizeUrl, hashUrl } from "../src/lib/url-normalize";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface JobRow {
  id: string;
  url: string;
  deleted_at: string | null;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<JobRow>(
      "SELECT id, url, deleted_at FROM jobs WHERE url_hash IS NULL"
    );
    console.log(`Found ${rows.length} job rows missing url_hash.`);

    let updated = 0;
    let skippedCollision = 0;
    let errors = 0;
    const seenActiveHashes = new Map<string, string>(); // hash -> first id seen

    // Pre-load existing active hashes so we don't collide with rows that
    // already had a hash (e.g. partial reruns).
    const { rows: existing } = await client.query<{ id: string; url_hash: string }>(
      "SELECT id, url_hash FROM jobs WHERE url_hash IS NOT NULL AND deleted_at IS NULL"
    );
    for (const r of existing) seenActiveHashes.set(r.url_hash, r.id);

    for (const row of rows) {
      let normalized: string;
      let hash: string;
      try {
        normalized = normalizeUrl(row.url);
        hash = hashUrl(normalized);
      } catch (err) {
        console.error(`  [error] job ${row.id} url=${row.url} → ${(err as Error).message}`);
        errors++;
        continue;
      }

      const isActive = row.deleted_at === null;

      if (isActive) {
        const prior = seenActiveHashes.get(hash);
        if (prior) {
          const { rows: priorRows } = await client.query<{ url: string }>(
            "SELECT url FROM jobs WHERE id = $1",
            [prior]
          );
          console.warn(
            `  [collision] job ${row.id} url=${row.url}\n` +
              `              hashes same as job ${prior} url=${priorRows[0]?.url}\n` +
              `              normalized: ${normalized}`
          );
          skippedCollision++;
          continue;
        }
        seenActiveHashes.set(hash, row.id);
      }

      await client.query("UPDATE jobs SET url_hash = $1 WHERE id = $2", [hash, row.id]);
      updated++;
    }

    console.log(
      `\nDone. updated=${updated} skippedCollision=${skippedCollision} errors=${errors}`
    );
    if (skippedCollision > 0) {
      console.log(
        "Resolve collisions (soft-delete the duplicate or merge), then re-run before applying migration 009."
      );
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
