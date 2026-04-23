export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Clear existing default, then set the new one
  await supabase.from("resumes").update({ is_default: false }).eq("is_default", true);
  const { error } = await supabase.from("resumes").update({ is_default: true }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
