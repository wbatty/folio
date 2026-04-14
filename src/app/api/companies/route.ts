import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CreateCompanySchema } from "@/lib/schemas";

export async function GET() {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      site: c.site,
      jobListingIndex: c.job_listing_index,
      lastCheckedAt: c.last_checked_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))
  );
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
