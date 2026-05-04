/**
 * Scrape worker — BullMQ consumer of the `scrape` queue. Sole execution path
 * for actually running Playwright + Claude extraction. The HTTP scrape route
 * just enqueues here; this worker calls `runScrape()` and notifies Telegram
 * on completion (when a chat_id was attached).
 */

import { startScrapeWorker, type ScrapeJobData } from "../src/lib/queue";
import { runScrape } from "../src/lib/scrape";
import { supabase } from "../src/lib/supabase";

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

export function bootScrapeWorker() {
  const worker = startScrapeWorker(async (job) => {
    const { jobId, chatId } = job.data as ScrapeJobData;
    console.log(`[scrape:${jobId}] starting (attempt ${job.attemptsMade + 1})`);
    await runScrape(jobId);

    if (chatId) {
      const { data: row } = await supabase
        .from("jobs")
        .select("title, companies(name)")
        .eq("id", jobId)
        .maybeSingle();
      const company = (row?.companies as { name: string } | null)?.name;
      const label = [row?.title, company].filter(Boolean).join(" at ");
      await notifyTelegram(
        chatId,
        label ? `Research complete: ${label}` : `Research complete for job ${jobId}.`
      );
    }
    console.log(`[scrape:${jobId}] done`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[scrape:${job?.id}] failed:`, err.message);
  });

  return worker;
}

if (process.argv[1] && process.argv[1].endsWith("scrape-worker.ts")) {
  bootScrapeWorker();
  console.log("Scrape worker started.");
}
