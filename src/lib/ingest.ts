import pg from "pg";
import { supabase } from "@/lib/supabase";
import type { JobStatus } from "@/lib/schemas";

export type RawIngestSource = "telegram" | "api" | "csv";

export interface RawIngestMessage {
  url: string;
  source: RawIngestSource;
  chat_id?: number;
  title?: string;
  company?: string;
  status?: JobStatus;
  date_applied?: string;
  note?: string;
}

export interface RawQueueRow {
  msg_id: string;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: RawIngestMessage;
}

const QUEUE_NAME = "job_ingest";
const DEFAULT_VISIBILITY_TIMEOUT = 60;
const DEFAULT_BATCH = 5;

export async function enqueueRaw(msg: RawIngestMessage): Promise<void> {
  // send_job_ingest is a SQL function defined in migration 004 — not present
  // in the generated Database types, so we cast through `unknown` to access
  // the rpc helper without losing rest of supabase typing.
  const client = supabase as unknown as { rpc: (fn: string, args: unknown) => Promise<{ error: { message: string } | null }> };
  const { error } = await client.rpc("send_job_ingest", { msg });
  if (error) throw new Error(`Failed to enqueue raw ingest: ${error.message}`);
}

const globalForPgPool = globalThis as unknown as { ingestPgPool?: pg.Pool };

function getPool(): pg.Pool {
  if (!globalForPgPool.ingestPgPool) {
    globalForPgPool.ingestPgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return globalForPgPool.ingestPgPool;
}

export async function readRaw(
  batch: number = DEFAULT_BATCH,
  visibilityTimeoutSec: number = DEFAULT_VISIBILITY_TIMEOUT
): Promise<RawQueueRow[]> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<RawQueueRow>(
      "SELECT * FROM pgmq.read($1, $2, $3)",
      [QUEUE_NAME, visibilityTimeoutSec, batch]
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function archiveRaw(msgId: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pgmq.archive($1::text, $2::bigint)", [QUEUE_NAME, msgId]);
  } finally {
    client.release();
  }
}

export async function rawQueueLength(): Promise<number> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{ queue_length: string }>(
      "SELECT queue_length FROM pgmq.metrics($1)",
      [QUEUE_NAME]
    );
    return Number(rows[0]?.queue_length ?? 0);
  } finally {
    client.release();
  }
}
