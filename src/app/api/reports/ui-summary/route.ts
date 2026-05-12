import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const startISO = new Date(start + "T00:00:00").toISOString();
  const endISO = new Date(end + "T23:59:59.999").toISOString();

  const [{ data: statusLogs }, { data: notes }] = await Promise.all([
    supabase
      .from("status_logs")
      .select("id, status, note, created_at, job_id, jobs(id, url, title, status, company_id, companies(name))")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .not("status", "in", '("RESEARCHING","PENDING_APPLICATION","RESEARCH_ERROR")')
      .order("created_at", { ascending: true }),

    supabase
      .from("notes")
      .select("id, content, created_at, job_id, jobs(id, url, title, status, company_id, companies(name))")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: true }),
  ]);

  type JobRow = { id: string; url: string; title: string | null; status: string; company_id: string | null; companies: { name: string } | null };

  const jobMap = new Map<string, {
    id: string;
    url: string;
    title: string | null;
    status: string;
    company: string | null;
    statusLogs: { id: string; status: string; note: string | null; createdAt: string }[];
    notes: { id: string; content: string; createdAt: string }[];
  }>();

  function getOrCreate(job: JobRow) {
    if (!jobMap.has(job.id)) {
      jobMap.set(job.id, {
        id: job.id,
        url: job.url,
        title: job.title ?? null,
        status: job.status,
        company: (job.companies as { name: string } | null)?.name ?? null,
        statusLogs: [],
        notes: [],
      });
    }
    return jobMap.get(job.id)!;
  }

  for (const log of statusLogs ?? []) {
    const job = log.jobs as JobRow | null;
    if (!job) continue;
    const entry = getOrCreate(job);
    entry.statusLogs.push({ id: log.id, status: log.status, note: log.note ?? null, createdAt: log.created_at });
  }

  for (const note of notes ?? []) {
    const job = note.jobs as JobRow | null;
    if (!job) continue;
    const entry = getOrCreate(job);
    entry.notes.push({ id: note.id, content: note.content, createdAt: note.created_at });
  }

  const jobs = Array.from(jobMap.values()).sort((a, b) => {
    const aLatest = Math.max(
      ...a.statusLogs.map((l) => new Date(l.createdAt).getTime()),
      ...a.notes.map((n) => new Date(n.createdAt).getTime()),
    );
    const bLatest = Math.max(
      ...b.statusLogs.map((l) => new Date(l.createdAt).getTime()),
      ...b.notes.map((n) => new Date(n.createdAt).getTime()),
    );
    return bLatest - aLatest;
  });

  return NextResponse.json({
    start,
    end,
    jobs,
    totalStatusLogs: (statusLogs ?? []).length,
    totalNotes: (notes ?? []).length,
  });
}
