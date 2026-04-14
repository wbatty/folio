/**
 * Migrate data from local PostgreSQL (Prisma) to Supabase.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-from-postgres.mjs
 *
 * Required env vars:
 *   DATABASE_URL                — local PostgreSQL connection string
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (bypasses RLS)
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Pool } = pg;

// ── Env validation ────────────────────────────────────────────────────────────

const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────

const local = new Pool({ connectionString: process.env.DATABASE_URL });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const stats = {};
function count(table, action) {
  if (!stats[table]) stats[table] = { inserted: 0, skipped: 0 };
  stats[table][action]++;
}

async function supabaseInsert(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
}

// ── Migrate resumes ───────────────────────────────────────────────────────────

async function migrateResumes() {
  const { rows } = await local.query(
    `SELECT id, filename, content, "createdAt" FROM "Resume" ORDER BY "createdAt"`
  );

  // Fetch existing resumes from Supabase for dedup check
  const { data: existing } = await supabase
    .from("resumes")
    .select("filename, created_at");
  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.filename}::${new Date(r.created_at).toISOString()}`)
  );

  const idMap = new Map(); // oldCuid → newUUID
  const toInsert = [];

  for (const row of rows) {
    const newId = crypto.randomUUID();
    idMap.set(row.id, newId);

    const key = `${row.filename}::${new Date(row.createdAt).toISOString()}`;
    if (existingKeys.has(key)) {
      count("resumes", "skipped");
      continue;
    }

    toInsert.push({
      id: newId,
      filename: row.filename,
      content: row.content,
      pdf_path: null,
      created_at: row.createdAt,
    });
    count("resumes", "inserted");
  }

  await supabaseInsert("resumes", toInsert);
  return idMap;
}

// ── Migrate jobs ──────────────────────────────────────────────────────────────

async function migrateJobs(resumeIdMap) {
  const { rows } = await local.query(
    `SELECT id, url, company, title, description, "descriptionFull", status,
            "dateApplied", "resumeId", "deletedAt", "createdAt", "updatedAt"
     FROM "Job" ORDER BY "createdAt"`
  );

  const { data: existing } = await supabase
    .from("jobs")
    .select("url, created_at");
  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.url}::${new Date(r.created_at).toISOString()}`)
  );

  const idMap = new Map();
  const toInsert = [];

  for (const row of rows) {
    const newId = crypto.randomUUID();
    idMap.set(row.id, newId);

    const key = `${row.url}::${new Date(row.createdAt).toISOString()}`;
    if (existingKeys.has(key)) {
      count("jobs", "skipped");
      continue;
    }

    toInsert.push({
      id: newId,
      url: row.url,
      company: row.company ?? null,
      title: row.title ?? null,
      description: row.description ?? null,
      description_full: row.descriptionFull ?? null,
      status: row.status,
      date_applied: row.dateApplied ?? null,
      resume_id: row.resumeId ? (resumeIdMap.get(row.resumeId) ?? null) : null,
      deleted_at: row.deletedAt ?? null,
      session_id: null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
    count("jobs", "inserted");
  }

  await supabaseInsert("jobs", toInsert);
  return idMap;
}

// ── Migrate status_logs ───────────────────────────────────────────────────────

async function migrateStatusLogs(jobIdMap) {
  const { rows } = await local.query(
    `SELECT id, "jobId", status, note, "createdAt" FROM "StatusLog" ORDER BY "createdAt"`
  );

  // Get already-migrated job IDs so we don't reference orphaned jobs
  const { data: existingJobs } = await supabase.from("jobs").select("id");
  const validJobIds = new Set((existingJobs ?? []).map((j) => j.id));

  // Fetch existing logs to avoid duplicates (match by job_id + status + created_at)
  const { data: existingLogs } = await supabase
    .from("status_logs")
    .select("job_id, status, created_at");
  const existingKeys = new Set(
    (existingLogs ?? []).map(
      (l) => `${l.job_id}::${l.status}::${new Date(l.created_at).toISOString()}`
    )
  );

  const toInsert = [];

  for (const row of rows) {
    const newJobId = jobIdMap.get(row.jobId);
    if (!newJobId || !validJobIds.has(newJobId)) {
      count("status_logs", "skipped");
      continue;
    }

    const key = `${newJobId}::${row.status}::${new Date(row.createdAt).toISOString()}`;
    if (existingKeys.has(key)) {
      count("status_logs", "skipped");
      continue;
    }

    toInsert.push({
      id: crypto.randomUUID(),
      job_id: newJobId,
      status: row.status,
      note: row.note ?? null,
      created_at: row.createdAt,
    });
    count("status_logs", "inserted");
  }

  await supabaseInsert("status_logs", toInsert);
}

// ── Migrate questions ─────────────────────────────────────────────────────────

async function migrateQuestions(jobIdMap) {
  const { rows } = await local.query(
    `SELECT id, "jobId", question, context, response, "createdAt", "updatedAt"
     FROM "Question" ORDER BY "createdAt"`
  );

  const { data: existingJobs } = await supabase.from("jobs").select("id");
  const validJobIds = new Set((existingJobs ?? []).map((j) => j.id));

  const { data: existingQ } = await supabase
    .from("questions")
    .select("job_id, question");
  const existingKeys = new Set(
    (existingQ ?? []).map((q) => `${q.job_id}::${q.question}`)
  );

  const toInsert = [];

  for (const row of rows) {
    const newJobId = jobIdMap.get(row.jobId);
    if (!newJobId || !validJobIds.has(newJobId)) {
      count("questions", "skipped");
      continue;
    }

    const key = `${newJobId}::${row.question}`;
    if (existingKeys.has(key)) {
      count("questions", "skipped");
      continue;
    }

    toInsert.push({
      id: crypto.randomUUID(),
      job_id: newJobId,
      question: row.question,
      context: row.context ?? null,
      response: row.response ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
    count("questions", "inserted");
  }

  await supabaseInsert("questions", toInsert);
}

// ── Migrate notes ─────────────────────────────────────────────────────────────

async function migrateNotes(jobIdMap) {
  const { rows } = await local.query(
    `SELECT id, "jobId", content, "createdAt" FROM "Note" ORDER BY "createdAt"`
  );

  const { data: existingJobs } = await supabase.from("jobs").select("id");
  const validJobIds = new Set((existingJobs ?? []).map((j) => j.id));

  const { data: existingN } = await supabase
    .from("notes")
    .select("job_id, content, created_at");
  const existingKeys = new Set(
    (existingN ?? []).map(
      (n) => `${n.job_id}::${n.content}::${new Date(n.created_at).toISOString()}`
    )
  );

  const toInsert = [];

  for (const row of rows) {
    const newJobId = jobIdMap.get(row.jobId);
    if (!newJobId || !validJobIds.has(newJobId)) {
      count("notes", "skipped");
      continue;
    }

    const key = `${newJobId}::${row.content}::${new Date(row.createdAt).toISOString()}`;
    if (existingKeys.has(key)) {
      count("notes", "skipped");
      continue;
    }

    toInsert.push({
      id: crypto.randomUUID(),
      job_id: newJobId,
      content: row.content,
      created_at: row.createdAt,
    });
    count("notes", "inserted");
  }

  await supabaseInsert("notes", toInsert);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to local PostgreSQL...");
  await local.query("SELECT 1"); // smoke test
  console.log("Connected.\n");

  console.log("Migrating resumes...");
  const resumeIdMap = await migrateResumes();

  console.log("Migrating jobs...");
  const jobIdMap = await migrateJobs(resumeIdMap);

  console.log("Migrating status_logs...");
  await migrateStatusLogs(jobIdMap);

  console.log("Migrating questions...");
  await migrateQuestions(jobIdMap);

  console.log("Migrating notes...");
  await migrateNotes(jobIdMap);

  console.log("\n── Summary ──────────────────────────────");
  for (const [table, { inserted, skipped }] of Object.entries(stats)) {
    console.log(`  ${table.padEnd(16)} inserted: ${inserted}  skipped: ${skipped}`);
  }
  console.log("─────────────────────────────────────────\n");
  console.log("Done. Note: resume PDFs were not migrated (pdf_path set to null).");
}

main()
  .catch((err) => {
    console.error("\nMigration failed:", err.message);
    process.exit(1);
  })
  .finally(() => local.end());
