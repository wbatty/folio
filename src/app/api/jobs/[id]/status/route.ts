import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { UpdateStatusSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status, note } = parsed.data;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .update({
      status,
      ...(status === "APPLIED" ? { date_applied: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .select("*, companies(name)")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Update failed" }, { status: 500 });
  }

  await supabase
    .from("status_logs")
    .insert({ job_id: id, status, note });

  const companyJoin = (job as unknown as Record<string, unknown>).companies as { name: string } | null;

  return NextResponse.json({
    id: job.id,
    url: job.url,
    company: companyJoin?.name ?? null,
    companyId: job.company_id ?? null,
    title: job.title,
    description: job.description,
    status: job.status,
    dateApplied: job.date_applied,
    resumeId: job.resume_id,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  });
}
