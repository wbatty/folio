import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emails, error } = await (supabase as any)
    .from("job_emails")
    .select("*")
    .eq("job_id", id)
    .order("received_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json(
    (emails ?? []).map((e: any) => ({
      id: e.id,
      jobId: e.job_id,
      gmailMessageId: e.gmail_message_id,
      gmailThreadId: e.gmail_thread_id,
      subject: e.subject,
      fromAddress: e.from_address,
      snippet: e.snippet,
      classification: e.classification,
      receivedAt: e.received_at,
      createdAt: e.created_at,
    }))
  );
}
