import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CreateCompanySchema } from "@/lib/schemas";

export async function GET() {
  const [{ data, error }, { data: jobRows }] = await Promise.all([
    supabase.from("companies").select("*"),
    supabase
      .from("jobs")
      .select("company_id, date_applied, status")
      .is("deleted_at", null)
      .not("company_id", "is", null),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build per-company maps from job rows
  const lastAppliedMap: Record<string, string> = {};
  const appliedCountMap: Record<string, number> = {};
  const deniedCountMap: Record<string, number> = {};

  for (const row of jobRows ?? []) {
    const cid = row.company_id!;
    if (row.date_applied) {
      appliedCountMap[cid] = (appliedCountMap[cid] ?? 0) + 1;
      if (!lastAppliedMap[cid] || row.date_applied > lastAppliedMap[cid]) {
        lastAppliedMap[cid] = row.date_applied;
      }
    }
    if (row.status === "DENIED") {
      deniedCountMap[cid] = (deniedCountMap[cid] ?? 0) + 1;
    }
  }

  type CompanyRow = {
    id: string;
    name: string;
    site: string | null;
    job_listing_index: string | null;
    last_checked_at: string | null;
    created_at: string;
    updated_at: string;
  };

  const companies = (data as CompanyRow[] ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    site: c.site,
    jobListingIndex: c.job_listing_index,
    lastCheckedAt: c.last_checked_at,
    lastAppliedAt: lastAppliedMap[c.id] ?? null,
    appliedCount: appliedCountMap[c.id] ?? 0,
    deniedCount: deniedCountMap[c.id] ?? 0,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  type MappedCompany = (typeof companies)[number];

  // Sort: no effective date first (oldest first otherwise)
  // Effective date = lastCheckedAt ?? lastAppliedAt
  companies.sort((a: MappedCompany, b: MappedCompany) => {
    const da = a.lastCheckedAt ?? a.lastAppliedAt;
    const db = b.lastCheckedAt ?? b.lastAppliedAt;
    if (!da && !db) return a.name.localeCompare(b.name);
    if (!da) return -1;
    if (!db) return 1;
    return new Date(da).getTime() - new Date(db).getTime();
  });

  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, site, job_listing_index } = parsed.data;

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      site: site || null,
      job_listing_index: job_listing_index || null,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      site: data.site,
      jobListingIndex: data.job_listing_index,
      lastCheckedAt: data.last_checked_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    { status: 201 }
  );
}
