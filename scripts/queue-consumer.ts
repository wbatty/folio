/**
 * Telegram Bot Queue Consumer
 *
 * Polls the Supabase pgmq 'job_ingest' queue and triggers the existing ingest
 * pipeline for each dequeued job URL. Notifies the submitting Telegram user
 * when the job has been created and research has started.
 *
 * Required env vars:
 *   DATABASE_URL           — Direct postgres connection string
 *   APP_URL                — Base URL of the running Next.js app (e.g. http://localhost:3000)
 *   TELEGRAM_BOT_TOKEN     — Bot token from @BotFather
 */

import pg from "pg";

const QUEUE_NAME = "job_ingest";
const VISIBILITY_TIMEOUT_SECONDS = 60;
const MAX_MESSAGES_PER_POLL = 5;
const POLL_INTERVAL_MS = 5000;

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface QueueMessage {
  msg_id: string;
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

async function processMessage(msg: QueueMessage): Promise<void> {
  const { url, chat_id } = msg.message;
  console.log(`Processing job URL: ${url} (chat_id: ${chat_id})`);

  // Step 1: Create the job record
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

  // Step 2: Trigger async scrape + extraction (fire-and-forget on the server side)
  const scrapeRes = await fetch(`${APP_URL}/api/jobs/${job.id}/scrape`, {
    method: "POST",
  });

  if (!scrapeRes.ok) {
    console.warn(`POST /api/jobs/${job.id}/scrape failed (${scrapeRes.status}) — job created but scrape not triggered`);
  }

  // Step 3: Notify the user that things are underway
  await sendTelegram(
    chat_id,
    `Job added! Research is underway:\n${url}\n\nHead to the app to track progress.`
  );

  console.log(`Job ${job.id} created and scrape triggered for: ${url}`);
}

async function poll(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<QueueMessage>(
      "SELECT * FROM pgmq.read($1, $2, $3)",
      [QUEUE_NAME, VISIBILITY_TIMEOUT_SECONDS, MAX_MESSAGES_PER_POLL]
    );

    for (const msg of rows) {
      try {
        await processMessage(msg);
        await client.query("SELECT pgmq.archive($1, $2)", [QUEUE_NAME, msg.msg_id]);
      } catch (err) {
        console.error(`Failed to process message ${msg.msg_id}:`, err);
        // Leave the message in the queue; it will become visible again after
        // the visibility timeout expires and will be retried automatically.
        // Notify the user so they aren't left waiting.
        const chatId = msg.message?.chat_id;
        if (chatId) {
          await sendTelegram(
            chatId,
            `Sorry, I couldn't process this job URL:\n${msg.message?.url}\n\nPlease try sending it again.`
          );
        }
        // Archive to avoid infinite retries on permanently broken messages
        await client.query("SELECT pgmq.archive($1, $2)", [QUEUE_NAME, msg.msg_id]);
      }
    }
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  console.log(`Queue consumer started. Polling '${QUEUE_NAME}' every ${POLL_INTERVAL_MS}ms…`);
  console.log(`App URL: ${APP_URL}`);

  // Run once immediately, then on interval
  await poll();
  setInterval(() => {
    poll().catch((err) => console.error("Poll error:", err));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
