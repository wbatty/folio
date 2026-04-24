import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CacheTag } from "@/lib/cache-tags";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("companies")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  revalidateTag(CacheTag.companies);

  return NextResponse.json({ lastCheckedAt: data.last_checked_at });
}
