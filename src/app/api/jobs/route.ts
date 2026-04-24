import { NextRequest, NextResponse } from "next/server";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CreateJobSchema } from "@/lib/schemas";
import { matchCompanyByUrl, matchOrCreateCompanyByName } from "@/lib/company-matching";
import { CacheTag } from "@/lib/cache-tags";

async function fetchJobsList(
  showDeleted: boolean,
  showDenied: boolean,
  showWithdrawn: boolean,
  showExpired: boolean
) {
  "use cache";
  cacheTag(CacheTag.jobsList);
  cacheLife({ revalidate: 30 });

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

  return shaped;
}

export async function GET(req: NextRequest) {
  const showDeleted = req.nextUrl.searchParams.get("showDeleted") === "true";
  const showDenied = req.nextUrl.searchParams.get("showDenied") === "true";
  const showWithdrawn = req.nextUrl.searchParams.get("showWithdrawn") === "true";
  const showExpired = req.nextUrl.searchParams.get("showExpired") === "true";

  const shaped = await fetchJobsList(showDeleted, showDenied, showWithdrawn, showExpired);
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, company, title } = parsed.data;

  // Get the default resume
  const { data: resume } = await supabase
    .from("resumes")
    .select("id")
    .eq("is_default", true)
    .limit(1)
    .single();

  // If the user provided a company name, match/create by name; otherwise fall back to URL-based matching
  const companyId = company?.trim()
    ? await matchOrCreateCompanyByName(company.trim())
    : await matchCompanyByUrl(url);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      url,
      resume_id: resume?.id ?? null,
      status: "RESEARCHING",
      company_id: companyId,
      ...(title?.trim() ? { title: title.trim() } : {}),
    })
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  const { data: statusLog } = await supabase
    .from("status_logs")
    .insert({ job_id: job.id, status: "RESEARCHING", note: "Job added for research" })
    .select()
    .single();

  revalidateTag(CacheTag.jobsList);
  revalidateTag(CacheTag.companies);
  revalidateTag(CacheTag.metrics);

  return NextResponse.json(
    {
      id: job.id,
      url: job.url,
      company: null, // company name not yet known (comes from scrape)
      companyId: job.company_id ?? null,
      title: job.title,
      description: job.description,
      status: job.status,
      dateApplied: job.date_applied,
      resumeId: job.resume_id,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      statusLogs: statusLog
        ? [{ status: statusLog.status, note: statusLog.note, createdAt: statusLog.created_at }]
        : [],
    },
    { status: 201 }
  );
}
