/**
 * Supabase Edge Function: telegram-webhook
 *
 * Receives incoming Telegram Bot API webhook updates, validates the secret
 * token, and enqueues the raw URL into the Supabase pgmq 'job_ingest' queue.
 * Dedupe / hashing / company resolution happens in scripts/dedupe-worker.ts —
 * this function does no DB lookups beyond the RPC call.
 *
 * Deploy:  supabase functions deploy telegram-webhook
 * Register webhook URL with Telegram (one-time, after deploy):
 *   npm run setup-webhook   (set APP_URL to your Supabase functions URL)
 *
 * Secrets required (set via `supabase secrets set KEY=value`):
 *   TELEGRAM_BOT_TOKEN       — from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET  — random string you chose for request validation
 *
 * Automatically available in all Edge Functions:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const TELEGRAM_API = `https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}`;

async function sendMessage(chatId: number, text: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error("Telegram sendMessage failed:", await res.text());
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== Deno.env.get("TELEGRAM_WEBHOOK_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = (update as Record<string, unknown>)?.message as
    | Record<string, unknown>
    | undefined;

  if (!message?.text || !message?.chat) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const chatId = (message.chat as Record<string, unknown>).id as number;
  const text = (message.text as string).trim();

  let jobUrl: string;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Bad protocol");
    }
    jobUrl = parsed.toString();
  } catch {
    await sendMessage(
      chatId,
      "Please send a valid job URL starting with http:// or https://"
    );
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.rpc("send_job_ingest", {
    msg: { url: jobUrl, source: "telegram", chat_id: chatId },
  });

  if (error) {
    console.error("Failed to enqueue job:", error);
    await sendMessage(
      chatId,
      "Sorry, something went wrong queuing that job. Please try again."
    );
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await sendMessage(chatId, `Got it, processing:\n${jobUrl}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
