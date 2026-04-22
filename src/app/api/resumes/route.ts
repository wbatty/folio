export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TERMINAL_STATUSES = new Set(["APPLIED", "INTERVIEWING", "OFFERED", "DENIED", "WITHDRAWN"]);
const INTERVIEW_STATUSES = new Set(["INTERVIEWING", "OFFERED"]);

export async function GET() {
  const [resumesResult, jobsResult] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, filename, content, created_at, pdf_path, is_default")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("resume_id, status")
      .not("resume_id", "is", null)
      .is("deleted_at", null),
  ]);

  const resumes = resumesResult.data ?? [];
  const jobs = jobsResult.data ?? [];

  const perfMap = new Map<string, { totalJobs: number; applied: number; interviews: number; offers: number }>();
  for (const job of jobs) {
    if (!job.resume_id) continue;
    const p = perfMap.get(job.resume_id) ?? { totalJobs: 0, applied: 0, interviews: 0, offers: 0 };
    p.totalJobs++;
    if (TERMINAL_STATUSES.has(job.status)) p.applied++;
    if (INTERVIEW_STATUSES.has(job.status)) p.interviews++;
    if (job.status === "OFFERED") p.offers++;
    perfMap.set(job.resume_id, p);
  }

  const result = resumes.map((r) => ({
    id: r.id,
    filename: r.filename,
    content: r.content,
    createdAt: r.created_at,
    hasPdf: r.pdf_path !== null,
    isDefault: r.is_default,
    performance: perfMap.get(r.id) ?? { totalJobs: 0, applied: 0, interviews: 0, offers: 0 },
  }));

  return NextResponse.json(result);
}
