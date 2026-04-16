import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/telegram";

function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  // Validate Telegram webhook secret token
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = (update as Record<string, unknown>)?.message as
    | Record<string, unknown>
    | undefined;

  if (!message?.text || !message?.chat) {
    // Ignore non-message updates (edits, inline queries, etc.)
    return NextResponse.json({ ok: true });
  }

  const chatId = (message.chat as Record<string, unknown>).id as number;
  const text = (message.text as string).trim();

  // Validate URL
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
    return NextResponse.json({ ok: true });
  }

  // Enqueue the URL to pgmq via the public wrapper function
  const supabase = serviceRoleClient();
  const { error } = await supabase.rpc("send_job_ingest", {
    msg: { url: jobUrl, chat_id: chatId },
  });

  if (error) {
    console.error("Failed to enqueue job:", error);
    await sendMessage(
      chatId,
      "Sorry, something went wrong queuing that job. Please try again."
    );
    return NextResponse.json({ ok: true });
  }

  await sendMessage(
    chatId,
    `Got it! I've queued this job for processing:\n${jobUrl}\n\nI'll let you know once it's been added and research has started.`
  );

  // Telegram requires a 200 response
  return NextResponse.json({ ok: true });
}
