import { NextResponse } from "next/server";
import { cacheTag, cacheLife } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CacheTag } from "@/lib/cache-tags";

const INTERVIEWING_STATUSES = new Set(["INTERVIEWING", "OFFERED"]);

const ACTION_NEEDED_STATUSES = new Set(["PENDING_APPLICATION", "RESEARCH_ERROR"]);

const APPLIED_STATUSES = new Set([
  "APPLIED",
  "INTERVIEWING",
  "OFFERED",
  "DENIED",
  "WITHDRAWN",
  "EXPIRED",
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
  "EXPIRED",
] as const;

type JobStatus = (typeof ALL_STATUSES)[number];

async function fetchMetrics() {
  "use cache";
  cacheTag(CacheTag.metrics);
  cacheLife({ revalidate: 60 });

  const { data: jobs } = await supabase
    .from("jobs")
    .select("status, company_id, status_logs(status, created_at)")
    .is("deleted_at", null);

  if (!jobs) {
    return { totalApplied: 0, uniqueCompanies: 0, avgTimePerState: {}, totalAppliedCount: 0 };
  }

  const totalNeedAction = jobs.filter((j) => ACTION_NEEDED_STATUSES.has(j.status)).length;

  const appliedJobs = jobs.filter((j) => APPLIED_STATUSES.has(j.status));

  const totalApplied = appliedJobs.length;

  const activeInterviews = appliedJobs.filter((j) => INTERVIEWING_STATUSES.has(j.status)).length;

  const denied = appliedJobs.filter((j) => j.status === "DENIED").length;

  const uniqueCompanies = new Set(
    appliedJobs.map((j) => j.company_id).filter(Boolean)
  ).size;

  // Compute avg time per state using status_logs
  const stateDurations: Record<string, number[]> = {};
  const now = Date.now();
  const jobsAppliedToday = appliedJobs.filter((j) => {
    const appliedLog = j.status_logs?.find((log) => log.status === "APPLIED");
    if (!appliedLog) return false;
    const appliedDate = new Date(appliedLog.created_at);
    const today = new Date();
    return (
      appliedDate.getDate() === today.getDate() &&
      appliedDate.getMonth() === today.getMonth() &&
      appliedDate.getFullYear() === today.getFullYear()
    );
  }).length;

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

  return { totalApplied, uniqueCompanies, avgTimePerState, totalAppliedCount: totalApplied, activeInterviews, denied, jobsAppliedToday, totalNeedAction };
}

export async function GET() {
  const metrics = await fetchMetrics();
  return NextResponse.json(metrics);
}
