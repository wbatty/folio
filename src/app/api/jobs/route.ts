import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CreateJobSchema } from "@/lib/schemas";
import { enqueueRaw } from "@/lib/ingest";

export async function GET(req: NextRequest) {
  const showDeleted = req.nextUrl.searchParams.get("showDeleted") === "true";
  const showDenied = req.nextUrl.searchParams.get("showDenied") === "true";
  const showWithdrawn = req.nextUrl.searchParams.get("showWithdrawn") === "true";
  const showExpired = req.nextUrl.searchParams.get("showExpired") === "true";

  let query = supabase
    .from("jobs")
    .select("*, companies(name), status_logs(status, note, created_at), questions(count), notes(count)")
    .order("created_at", { ascending: false });

  if (!showDeleted) {
    query = query.is("deleted_at", null);
  }
  if (!showDenied) {
    query = query.neq("status", "DENIED");
  }
  if (!showWithdrawn) {
    query = query.neq("status", "WITHDRAWN");
  }
  if (!showExpired) {
    query = query.neq("status", "EXPIRED");
  }

  const { data: jobs } = await query;

  const shaped = (jobs ?? []).map((job) => {
    const sortedLogs = [...(job.status_logs ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const companyJoin = job.companies as { name: string } | null;
    return {
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
      deletedAt: job.deleted_at,
      statusLogs: sortedLogs.slice(0, 1).map((l) => ({
        status: l.status,
        note: l.note,
        createdAt: l.created_at,
      })),
      _count: {
        questions: (job.questions as unknown as { count: number }[])[0]?.count ?? 0,
        notes: (job.notes as unknown as { count: number }[])[0]?.count ?? 0,
      },
    };
  });

  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, company, title } = parsed.data;

  try {
    await enqueueRaw({
      url,
      source: "api",
      ...(company?.trim() ? { company: company.trim() } : {}),
      ...(title?.trim() ? { title: title.trim() } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enqueue failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ enqueued: true }, { status: 202 });
}
