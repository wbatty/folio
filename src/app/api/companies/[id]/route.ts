import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { UpdateCompanySchema } from "@/lib/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if ("site" in parsed.data) updates.site = parsed.data.site ?? null;
  if ("job_listing_index" in parsed.data) updates.job_listing_index = parsed.data.job_listing_index ?? null;
  if ("last_checked_at" in parsed.data) updates.last_checked_at = parsed.data.last_checked_at ?? null;

  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    site: data.site,
    jobListingIndex: data.job_listing_index,
    lastCheckedAt: data.last_checked_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
