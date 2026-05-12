import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getScrapeQueue } from "@/lib/queue";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Manual-HTML recovery flow: if the user pasted HTML, write it directly to
  // description_full so the next scrape (re-extract path) picks it up without
  // launching Playwright.
  let manualHtmlSeeded = false;
  try {
    const body = await req.json();
    if (typeof body?.html === "string" && body.html.trim()) {
      await supabase.from("jobs").update({ description_full: body.html }).eq("id", id);
      manualHtmlSeeded = true;
    }
  } catch {
    // No body / not JSON — proceed
  }

  await supabase.from("jobs").update({ status: "RESEARCHING" }).eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "RESEARCHING",
    note: manualHtmlSeeded ? "Retrying with manual HTML" : "Re-scrape queued",
  });

  await getScrapeQueue().add(
    "scrape",
    { jobId: id },
    { jobId: `scrape_${id}_${Date.now()}` }
  );

  return NextResponse.json({ enqueued: true }, { status: 202 });
}
