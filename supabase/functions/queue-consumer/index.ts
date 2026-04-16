/**
 * Supabase Edge Function: queue-consumer  (scheduled)
 *
 * Dequeues pending job URLs from the pgmq 'job_ingest' queue and drives the
 * existing Next.js ingest pipeline. Runs on a cron schedule (see config.toml).
 *
 * Because Playwright and the Claude Agent SDK cannot run inside a Deno Edge
 * Function, this function delegates the heavy lifting to the Next.js API:
 *   POST {APP_URL}/api/jobs        — creates the job record
 *   POST {APP_URL}/api/jobs/{id}/scrape  — triggers Playwright + Claude async
 *
 * The function uses Supabase RPC wrappers (read_job_ingest / archive_job_ingest)
 * defined in migration 005 to avoid needing a direct postgres connection.
 *
 * Deploy:  supabase functions deploy queue-consumer
 *
 * Secrets required (set via `supabase secrets set KEY=value`):
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   APP_URL             — base URL of your deployed Next.js app (no trailing slash)
 *
 * Automatically available in all Edge Functions:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_MESSAGES_PER_RUN = 5;
const VISIBILITY_TIMEOUT_SECONDS = 60;

const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const TELEGRAM_API = `https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}`;

interface QueueRow {
  msg_id: number;
  message: {
    url: string;
    chat_id: number;
  };
}

async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error("Telegram sendMessage failed:", await res.text());
    }
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
  }
}

async function processMessage(
  supabase: ReturnType<typeof createClient>,
  msg: QueueRow
): Promise<void> {
  const { url, chat_id } = msg.message;
  console.log(`Processing: ${url} (chat_id: ${chat_id})`);

  // Step 1: Create the job record via the Next.js API
  const createRes = await fetch(`${APP_URL}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`POST /api/jobs failed (${createRes.status}): ${body}`);
  }

  const job = (await createRes.json()) as { id: string };

  // Step 2: Trigger async scrape + Claude extraction (fire-and-forget on the server)
  const scrapeRes = await fetch(`${APP_URL}/api/jobs/${job.id}/scrape`, {
    method: "POST",
  });

  if (!scrapeRes.ok) {
    console.warn(
      `POST /api/jobs/${job.id}/scrape failed (${scrapeRes.status}) — job created but scrape not triggered`
    );
  }

  // Step 3: Archive the queue message (marks it as processed)
  const { error: archiveError } = await supabase.rpc("archive_job_ingest", {
    msg_id: msg.msg_id,
  });
  if (archiveError) {
    console.error("Failed to archive message:", archiveError);
  }

  // Step 4: Notify the user that research is underway
  await sendTelegram(
    chat_id,
    `Job added! Research is underway:\n${url}\n\nHead to the app to track progress.`
  );

  console.log(`Done: job ${job.id} created for ${url}`);
}

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Dequeue up to MAX_MESSAGES_PER_RUN messages
  const { data: messages, error: readError } = await supabase.rpc(
    "read_job_ingest",
    {
      vt: VISIBILITY_TIMEOUT_SECONDS,
      qty: MAX_MESSAGES_PER_RUN,
    }
  );

  if (readError) {
    console.error("Failed to read queue:", readError);
    return new Response(JSON.stringify({ error: readError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (messages ?? []) as QueueRow[];
  console.log(`Dequeued ${rows.length} message(s)`);

  const results = await Promise.allSettled(
    rows.map((msg) => processMessage(supabase, msg))
  );

  // Archive and notify on failures so messages don't block the queue indefinitely
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const msg = rows[i];
      console.error(`Failed to process message ${msg.msg_id}:`, result.reason);

      await supabase.rpc("archive_job_ingest", { msg_id: msg.msg_id });

      if (msg.message?.chat_id) {
        await sendTelegram(
          msg.message.chat_id,
          `Sorry, I couldn't process this job:\n${msg.message.url}\n\nPlease try sending it again.`
        );
      }
    }
  }

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return new Response(
    JSON.stringify({ processed: succeeded, failed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
