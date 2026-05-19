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

  const { data: appliedLogs } = await supabase
    .from("status_logs")
    .select("job_id, created_at")
    .eq("status", "APPLIED")
    .gte("created_at", startISO)
    .lte("created_at", endISO);

  const appliedAtByJob = new Map<string, string>();
  for (const r of appliedLogs ?? []) {
    if (r.job_id && !appliedAtByJob.has(r.job_id)) {
      appliedAtByJob.set(r.job_id, r.created_at);
    }
  }

  const jobIds = [...appliedAtByJob.keys()];

  if (jobIds.length === 0) {
    return NextResponse.json({ start, end, jobs: [], totalStatusLogs: 0, totalNotes: 0 });
  }

  const [{ data: statusLogs }, { data: notes }] = await Promise.all([
    supabase
      .from("status_logs")
      .select("id, status, note, created_at, job_id, jobs(id, url, title, status, company_id, companies(name))")
      .in("job_id", jobIds)
      .order("created_at", { ascending: true }),

    supabase
      .from("notes")
      .select("id, content, created_at, job_id, jobs(id, url, title, status, company_id, companies(name))")
      .in("job_id", jobIds)
      .order("created_at", { ascending: true }),
  ]);

  type JobRow = { id: string; url: string; title: string | null; status: string; company_id: string | null; companies: { name: string } | null };

  const jobMap = new Map<string, {
    id: string;
    url: string;
    title: string | null;
    status: string;
    company: string | null;
    appliedAt: string;
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
        appliedAt: appliedAtByJob.get(job.id) ?? "",
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

  const jobs = Array.from(jobMap.values()).sort(
    (a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime(),
  );

  const totalDays = new Set([...appliedAtByJob.values()].map((ts) => ts.slice(0, 10))).size;

  return NextResponse.json({
    start,
    end,
    jobs,
    totalJobs: jobs.length,
    totalDays,
    totalStatusLogs: (statusLogs ?? []).length,
    totalNotes: (notes ?? []).length,
  });
}
