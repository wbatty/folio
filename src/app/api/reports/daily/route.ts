import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET() {
  const { start, end } = todayRange();

  const [{ data: newJobs }, { data: statusLogs }, { data: allJobs }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, url, title, status, company_id, companies(name)")
      .gte("created_at", start)
      .lte("created_at", end)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),

    supabase
      .from("status_logs")
      .select("id, status, note, created_at, job_id, jobs(id, url, title, company_id, companies(name))")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true }),

    supabase
      .from("jobs")
      .select("status")
      .is("deleted_at", null),
  ]);

  const pipeline: Record<string, number> = {};
  for (const job of allJobs ?? []) {
    pipeline[job.status] = (pipeline[job.status] ?? 0) + 1;
  }

  const shapedNewJobs = (newJobs ?? []).map((j) => ({
    id: j.id,
    url: j.url,
    title: j.title ?? null,
    status: j.status,
    company: (j.companies as { name: string } | null)?.name ?? null,
  }));

  const shapedLogs = (statusLogs ?? []).map((l) => {
    const job = l.jobs as { id: string; url: string; title: string | null; company_id: string | null; companies: { name: string } | null } | null;
    return {
      id: l.id,
      status: l.status,
      note: l.note ?? null,
      createdAt: l.created_at,
      job: job
        ? {
            id: job.id,
            url: job.url,
            title: job.title ?? null,
            company: (job.companies as { name: string } | null)?.name ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    newJobs: shapedNewJobs,
    statusLogs: shapedLogs,
    pipeline,
  });
}
