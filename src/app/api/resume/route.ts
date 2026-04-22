export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, filename, content, created_at, pdf_path, is_default")
    .eq("is_default", true)
    .limit(1)
    .single();

  if (!resume) return NextResponse.json(null);

  return NextResponse.json({
    id: resume.id,
    filename: resume.filename,
    content: resume.content,
    createdAt: resume.created_at,
    hasPdf: resume.pdf_path !== null,
    isDefault: resume.is_default,
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const content = formData.get("content") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "No content provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

  let pdfPath: string | null = null;

  if (isPdf) {
    const storagePath = `resume-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (uploadError) {
      return NextResponse.json(
        { error: `PDF upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }
    pdfPath = storagePath;
  }

  // Clear existing default before inserting new resume
  await supabase.from("resumes").update({ is_default: false }).eq("is_default", true);

  const { data: resume, error } = await supabase
    .from("resumes")
    .insert({ filename: file.name, content, pdf_path: pdfPath, is_default: true })
    .select()
    .single();

  if (error || !resume) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: resume.id,
      filename: resume.filename,
      content: resume.content,
      createdAt: resume.created_at,
      hasPdf: resume.pdf_path !== null,
      isDefault: resume.is_default,
    },
    { status: 201 }
  );
}
