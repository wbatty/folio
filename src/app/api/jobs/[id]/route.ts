import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { UpdateJobSchema } from "@/lib/schemas";

function mapJob(job: Record<string, unknown>) {
  const companyJoin = job.companies as { name: string } | null;
  return {
    id: job.id,
    url: job.url,
    company: companyJoin?.name ?? null,
    companyId: job.company_id ?? null,
    title: job.title,
    description: job.description,
    descriptionFull: job.description_full,
    status: job.status,
    dateApplied: job.date_applied,
    deletedAt: job.deleted_at,
    resumeId: job.resume_id,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    resume: job.resume,
    sessionId: job.session_id,
    statusLogs: ((job.status_logs as unknown[]) ?? []).map((l: unknown) => {
      const log = l as Record<string, unknown>;
      return { id: log.id, status: log.status, note: log.note, createdAt: log.created_at };
    }),
    questions: ((job.questions as unknown[]) ?? []).map((q: unknown) => {
      const question = q as Record<string, unknown>;
      return {
        id: question.id,
        question: question.question,
        context: question.context,
        response: question.response,
        createdAt: question.created_at,
        updatedAt: question.updated_at,
      };
    }),
    notes: ((job.notes as unknown[]) ?? []).map((n: unknown) => {
      const note = n as Record<string, unknown>;
      return { id: note.id, content: note.content, createdAt: note.created_at };
    }),
    duplicates: ((job.duplicates as unknown[]) ?? []).map((d: unknown) => {
      const dup = d as Record<string, unknown>;
      const dupCompany = dup.companies as { name: string } | null;
      return { id: dup.id, company: dupCompany?.name ?? null, title: dup.title, status: dup.status };
    }),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("*, companies(name), resume:resumes(id, filename), status_logs(*), questions(*), notes(*)")
    .eq("id", id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const duplicateJobs = await supabase
    .from("jobs")
    .select("id, companies(name), title, status")
    .eq("url", job.url)
    .neq("id", id)
    .is("deleted_at", null);

  // Sort sub-arrays
  const result = {
    ...job,
    status_logs: [...(job.status_logs ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    questions: [...(job.questions ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    notes: [...(job.notes ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    duplicates: duplicateJobs.data ?? [],
  };

  return NextResponse.json(mapJob(result as unknown as Record<string, unknown>));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = UpdateJobSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const { data: job, error } = await supabase
    .from("jobs")
    .update({
      title: body.title,
      description: body.description,
      description_full: body.descriptionFull,
      date_applied: body.dateApplied ? new Date(body.dateApplied).toISOString() : undefined,
    })
    .eq("id", id)
    .select("*, companies(name)")
    .single();

  if (error || !job) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Soft delete — preserves history, can be restored or permanently purged later
  await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return NextResponse.json({ success: true });
}
