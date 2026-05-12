/**
 * Dedupe worker — pulls raw URLs from pgmq:job_ingest, normalizes + hashes,
 * looks up the canonical hash in jobs.url_hash, and either:
 *   - drops the message and (if Telegram) tells the user it's already in their list
 *   - inserts a new jobs row + status_log + optional note, then enqueues a BullMQ scrape job
 *
 * Single point of dedupe for every ingest path (telegram, api, csv).
 */

import { supabase } from "../src/lib/supabase";
import { normalizeUrl, hashUrl } from "../src/lib/url-normalize";
import { readRaw, archiveRaw, type RawIngestMessage } from "../src/lib/ingest";
import { getScrapeQueue, publishQueueStats } from "../src/lib/queue";
import { matchCompanyByUrl, matchOrCreateCompanyByName } from "../src/lib/company-matching";

const POLL_INTERVAL_MS = 3000;
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function notifyTelegram(chatId: number, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
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

async function findExistingByHash(urlHash: string) {
  return await supabase
    .from("jobs")
    .select("id, url, title, status, companies(name)")
    .eq("url_hash", urlHash)
    .is("deleted_at", null)
    .maybeSingle();
}

async function insertJob(msg: RawIngestMessage, urlHash: string): Promise<string> {
  const companyId = msg.company?.trim()
    ? await matchOrCreateCompanyByName(msg.company.trim())
    : await matchCompanyByUrl(msg.url);

  const { data: defaultResume } = await supabase
    .from("resumes")
    .select("id")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  const status = msg.status ?? "RESEARCHING";

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      url: msg.url,
      url_hash: urlHash,
      resume_id: defaultResume?.id ?? null,
      status,
      company_id: companyId,
      ...(msg.title?.trim() ? { title: msg.title.trim() } : {}),
      ...(msg.date_applied ? { date_applied: msg.date_applied } : {}),
    })
    .select("id")
    .single();

  if (error || !job) {
    throw new Error(error?.message ?? "Insert returned no row");
  }

  await supabase.from("status_logs").insert({
    job_id: job.id,
    status,
    note:
      msg.source === "telegram"
        ? "Job added for research"
        : msg.source === "csv"
        ? "Imported from CSV"
        : "Job added",
  });

  if (msg.note?.trim()) {
    await supabase.from("notes").insert({ job_id: job.id, content: msg.note.trim() });
  }

  return job.id;
}

async function processOne(row: { msg_id: string; message: RawIngestMessage }): Promise<void> {
  const msg = row.message;
  const chatId = msg.chat_id;

  let normalized: string;
  let urlHash: string;
  try {
    normalized = normalizeUrl(msg.url);
    urlHash = hashUrl(normalized);
  } catch (err) {
    console.error(`[${row.msg_id}] bad URL ${msg.url}: ${(err as Error).message}`);
    if (chatId) {
      await notifyTelegram(
        chatId,
        `Sorry, I couldn't parse that URL:\n${msg.url}\n\nMake sure it starts with http:// or https://`
      );
    }
    await archiveRaw(row.msg_id);
    return;
  }

  const { data: existing } = await findExistingByHash(urlHash);
  if (existing) {
    console.log(`[${row.msg_id}] duplicate of job ${existing.id}`);
    if (chatId) {
      const company = (existing.companies as { name: string } | null)?.name;
      const label = [existing.title, company].filter(Boolean).join(" at ") || existing.url;
      await notifyTelegram(
        chatId,
        `This job is already in your list!\n\n${label}\nStatus: ${existing.status}\n\nNo duplicate was added.`
      );
    }
    await archiveRaw(row.msg_id);
    return;
  }

  let jobId: string;
  try {
    jobId = await insertJob(msg, urlHash);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate key|jobs_url/i.test(message)) {
      const { data: again } = await findExistingByHash(urlHash);
      console.log(`[${row.msg_id}] race-duplicate of job ${again?.id ?? "?"}`);
      if (chatId && again) {
        await notifyTelegram(chatId, `This job is already in your list (status: ${again.status}).`);
      }
      await archiveRaw(row.msg_id);
      return;
    }
    throw err;
  }

  await getScrapeQueue().add("scrape", { jobId, chatId }, { jobId: `scrape_${jobId}` });
  console.log(`[${row.msg_id}] enqueued scrape for job ${jobId}`);

  if (chatId) {
    await notifyTelegram(
      chatId,
      `Job added! Research is underway:\n${msg.url}\n\nHead to the app to track progress.`
    );
  }

  await archiveRaw(row.msg_id);
}

let stopping = false;

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      const batch = await readRaw();
      if (batch.length === 0) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
      for (const row of batch) {
        if (stopping) break;
        try {
          await processOne(row);
        } catch (err) {
          console.error(`[${row.msg_id}] processing failed; will retry after vt expires:`, err);
        }
      }
      publishQueueStats().catch((err) => console.error("stats publish error:", err));
    } catch (err) {
      console.error("Poll loop error:", err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

export async function startDedupeWorker(): Promise<void> {
  console.log("Dedupe worker started.");
  await loop();
}

export function stopDedupeWorker(): void {
  stopping = true;
}

if (process.argv[1] && process.argv[1].endsWith("dedupe-worker.ts")) {
  startDedupeWorker().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
