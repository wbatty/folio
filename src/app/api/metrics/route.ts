import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
const INTERVIEWING_STATUSES = new Set(["INTERVIEWING", "OFFERED"]);

const APPLIED_STATUSES = new Set([
  "APPLIED",
  "INTERVIEWING",
  "OFFERED",
  "DENIED",
  "WITHDRAWN",
]);

const ALL_STATUSES = [
  "RESEARCHING",
  "RESEARCH_ERROR",
  "PENDING_APPLICATION",
  "APPLIED",
  "INTERVIEWING",
  "OFFERED",
  "DENIED",
  "WITHDRAWN",
] as const;

type JobStatus = (typeof ALL_STATUSES)[number];

export async function GET() {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("status, company, status_logs(status, created_at)")
    .is("deleted_at", null);

  if (!jobs) {
    return NextResponse.json({ totalApplied: 0, uniqueCompanies: 0, avgTimePerState: {}, totalAppliedCount: 0 });
  }

  const appliedJobs = jobs.filter((j) => APPLIED_STATUSES.has(j.status));

  const totalApplied = appliedJobs.length;
  
  const activeInterviews = appliedJobs.filter((j) => INTERVIEWING_STATUSES.has(j.status)).length;

  const uniqueCompanies = new Set(
    appliedJobs.map((j) => j.company).filter(Boolean)
  ).size;

  // Compute avg time per state using status_logs
  const stateDurations: Record<string, number[]> = {};
  const now = Date.now();

  for (const job of jobs) {
    const logs = [...(job.status_logs ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const start = new Date(log.created_at).getTime();
      const end = i + 1 < logs.length ? new Date(logs[i + 1].created_at).getTime() : now;
      const days = (end - start) / (1000 * 60 * 60 * 24);

      if (!stateDurations[log.status]) stateDurations[log.status] = [];
      stateDurations[log.status].push(days);
    }
  }

  const avgTimePerState: Partial<Record<JobStatus, number | null>> = {};
  for (const status of ALL_STATUSES) {
    const durations = stateDurations[status];
    if (durations && durations.length > 0) {
      avgTimePerState[status] = durations.reduce((a, b) => a + b, 0) / durations.length;
    } else {
      avgTimePerState[status] = null;
    }
  }

  return NextResponse.json({ totalApplied, uniqueCompanies, avgTimePerState, totalAppliedCount: totalApplied, activeInterviews});
}
