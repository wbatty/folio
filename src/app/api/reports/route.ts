import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const APPLIED_STATUSES = new Set(["APPLIED", "INTERVIEWING", "OFFERED", "DENIED", "WITHDRAWN", "EXPIRED"]);
const INTERVIEW_STATUSES = new Set(["INTERVIEWING", "OFFERED"]);
const TIMELINE_WEEKS = 12;

function weekStart(d: Date): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("status, date_applied, created_at, resume_id, status_logs(status, created_at)")
    .is("deleted_at", null);

  if (!jobs) return NextResponse.json({});

  // Build timeline buckets for last N weeks
  const buckets: Record<string, number> = {};
  const now = new Date();
  for (let i = TIMELINE_WEEKS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    buckets[weekStart(d)] = 0;
  }

  for (const job of jobs) {
    if (!APPLIED_STATUSES.has(job.status)) continue;
    const appliedLog = job.status_logs?.find((l: { status: string }) => l.status === "APPLIED");
    const dateStr = (appliedLog as { created_at: string } | undefined)?.created_at ?? job.date_applied ?? job.created_at;
    const key = weekStart(new Date(dateStr));
    if (key in buckets) buckets[key]++;
  }

  const timeline = Object.entries(buckets).map(([week, count]) => ({ week, count }));

  // Funnel
  const applied = jobs.filter((j) => APPLIED_STATUSES.has(j.status));
  const funnel = {
    applied: applied.length,
    interviewed: applied.filter((j) => INTERVIEW_STATUSES.has(j.status)).length,
    offered: applied.filter((j) => j.status === "OFFERED").length,
    denied: applied.filter((j) => j.status === "DENIED").length,
  };

  // Status distribution
  const statusDistribution: Record<string, number> = {};
  for (const job of jobs) {
    statusDistribution[job.status] = (statusDistribution[job.status] ?? 0) + 1;
  }

  // Avg time per state from status_logs
  const stateDurations: Record<string, number[]> = {};
  const nowMs = Date.now();
  for (const job of jobs) {
    const logs = [...((job.status_logs as { status: string; created_at: string }[]) ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (let i = 0; i < logs.length; i++) {
      const start = new Date(logs[i].created_at).getTime();
      const end = i + 1 < logs.length ? new Date(logs[i + 1].created_at).getTime() : nowMs;
      const days = (end - start) / (1000 * 60 * 60 * 24);
      if (!stateDurations[logs[i].status]) stateDurations[logs[i].status] = [];
      stateDurations[logs[i].status].push(days);
    }
  }

  const avgTimePerState: Record<string, number> = {};
  for (const [status, durations] of Object.entries(stateDurations)) {
    avgTimePerState[status] = durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  return NextResponse.json({ timeline, funnel, statusDistribution, avgTimePerState });
}
