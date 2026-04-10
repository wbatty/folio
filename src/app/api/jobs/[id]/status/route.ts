import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateStatusSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status, note } = parsed.data;

  const [job] = await prisma.$transaction([
    prisma.job.update({
      where: { id },
      data: {
        status,
        ...(status === "APPLIED" ? { dateApplied: new Date() } : {}),
      },
    }),
    prisma.statusLog.create({
      data: { jobId: id, status, note },
    }),
  ]);

  return NextResponse.json(job);
}
