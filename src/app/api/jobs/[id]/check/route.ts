import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkJobStillLive } from "@/lib/job-check";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, url, status")
    .eq("id", id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const result = await checkJobStillLive(job.url);

  if (result === "closed") {
    await supabase.from("jobs").update({ status: "DENIED" }).eq("id", id);
    await supabase.from("status_logs").insert({
      job_id: id,
      status: "DENIED",
      note: "Job posting no longer available — marked as denied by automated check",
    });
    return NextResponse.json({ result: "denied" });
  }

  return NextResponse.json({ result });
}
