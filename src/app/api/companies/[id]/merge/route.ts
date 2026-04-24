import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { MergeCompanySchema } from "@/lib/schemas";
import { CacheTag } from "@/lib/cache-tags";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = MergeCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { targetId } = parsed.data;

  if (id === targetId) {
    return NextResponse.json({ error: "Cannot merge a company into itself" }, { status: 400 });
  }

  // Verify both companies exist
  const { data: source, error: sourceError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Source company not found" }, { status: 404 });
  }

  const { data: target, error: targetError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", targetId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: "Target company not found" }, { status: 404 });
  }

  // Reassign all jobs from source to target
  const { error: jobsError } = await supabase
    .from("jobs")
    .update({ company_id: targetId })
    .eq("company_id", id);

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  // Delete the source company
  const { error: deleteError } = await supabase
    .from("companies")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  revalidateTag(CacheTag.companies);
  revalidateTag(CacheTag.jobsList);
  revalidateTag(CacheTag.metrics);

  return NextResponse.json({ success: true, targetId });
}
