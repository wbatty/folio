export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const resume = await prisma.resume.findUnique({
    where: { id },
    select: { pdfData: true },
  });

  if (!resume?.pdfData) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  return new NextResponse(resume.pdfData, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
