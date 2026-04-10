export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const resume = await prisma.resume.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, content: true, createdAt: true, pdfData: true },
  });

  if (!resume) return NextResponse.json(null);

  return NextResponse.json({
    id: resume.id,
    filename: resume.filename,
    content: resume.content,
    createdAt: resume.createdAt,
    hasPdf: resume.pdfData !== null,
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

  const resume = await prisma.resume.create({
    data: {
      filename: file.name,
      content,
      pdfData: isPdf ? buffer : null,
    },
  });

  return NextResponse.json(
    {
      id: resume.id,
      filename: resume.filename,
      content: resume.content,
      createdAt: resume.createdAt,
      hasPdf: resume.pdfData !== null,
    },
    { status: 201 }
  );
}
