import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      resume: { select: { id: true, filename: true } },
      statusLogs: { orderBy: { createdAt: "asc" } },
      questions: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const job = await prisma.job.update({
    where: { id },
    data: {
      company: body.company,
      title: body.title,
      description: body.description,
      dateApplied: body.dateApplied ? new Date(body.dateApplied) : undefined,
    },
  });

  return NextResponse.json(job);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.job.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
