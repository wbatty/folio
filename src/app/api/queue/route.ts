import { NextResponse } from "next/server";
import pg from "pg";

const QUEUE_NAME = "job_ingest";
const VISIBILITY_TIMEOUT_SECONDS = 60;
const MAX_MESSAGES_PER_POLL = 10;

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.error("Telegram sendMessage failed:", await res.text());
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
  }
}

export async function GET() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT queue_length FROM pgmq.metrics($1)",
      [QUEUE_NAME]
    );
    const count = rows[0]?.queue_length ?? 0;
    return NextResponse.json({ count: Number(count) });
  } catch (err) {
    console.error("Queue count error:", err);
    return NextResponse.json({ count: 0 });
  } finally {
    client.release();
    await pool.end();
  }
}

export async function POST() {
  const pool = getPool();
  const client = await pool.connect();
  let processed = 0;

  try {
    const { rows } = await client.query<{
      msg_id: string;
      message: { url: string; chat_id: number };
    }>(
      "SELECT * FROM pgmq.read($1, $2, $3)",
      [QUEUE_NAME, VISIBILITY_TIMEOUT_SECONDS, MAX_MESSAGES_PER_POLL]
    );

    for (const msg of rows) {
      try {
        const createRes = await fetch(`${APP_URL}/api/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: msg.message.url }),
        });

        if (!createRes.ok) {
          throw new Error(`POST /api/jobs failed (${createRes.status}): ${await createRes.text()}`);
        }

        const job = (await createRes.json()) as { id: string };

        const scrapeRes = await fetch(`${APP_URL}/api/jobs/${job.id}/scrape`, {
          method: "POST",
        });
        if (!scrapeRes.ok) {
          console.warn(`Scrape trigger failed for job ${job.id}`);
        }

        if (msg.message.chat_id) {
          await sendTelegram(
            msg.message.chat_id,
            `Job added! Research is underway:\n${msg.message.url}\n\nHead to the app to track progress.`
          );
        }

        await client.query("SELECT pgmq.archive($1::text, $2::bigint)", [QUEUE_NAME, msg.msg_id]);
        processed++;
      } catch (err) {
        console.error(`Failed to process message ${msg.msg_id}:`, err);
        if (msg.message?.chat_id) {
          await sendTelegram(
            msg.message.chat_id,
            `Sorry, I couldn't process this job URL:\n${msg.message?.url}\n\nPlease try sending it again.`
          );
        }
        await client.query("SELECT pgmq.archive($1::text, $2::bigint)", [QUEUE_NAME, msg.msg_id]);
      }
    }

    return NextResponse.json({ processed });
  } finally {
    client.release();
    await pool.end();
  }
}
