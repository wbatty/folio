export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: resume } = await supabase
    .from("resumes")
    .select("pdf_path")
    .eq("id", id)
    .single();

  if (!resume?.pdf_path) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  const { data: blob, error } = await supabase.storage
    .from("resumes")
    .download(resume.pdf_path);

  if (error || !blob) {
    return NextResponse.json({ error: "PDF download failed" }, { status: 500 });
  }

  const arrayBuffer = await blob.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
