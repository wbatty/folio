export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// pdf-parse is CJS-only; use require to avoid ESM default-export issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export async function GET() {
  const resume = await prisma.resume.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, content: true, createdAt: true },
  });
  return NextResponse.json(resume ?? null);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let content: string;

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    content = parsed.text;
  } else {
    content = buffer.toString("utf-8");
  }

  const resume = await prisma.resume.create({
    data: { filename: file.name, content },
  });

  return NextResponse.json(resume, { status: 201 });
}
