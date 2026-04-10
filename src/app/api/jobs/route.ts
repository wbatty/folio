import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateJobSchema } from "@/lib/schemas";

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { questions: true, notes: true } },
    },
  });
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url } = parsed.data;

  // Get the currently active resume
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });

  const job = await prisma.job.create({
    data: {
      url,
      resumeId: resume?.id ?? null,
      status: "RESEARCHING",
      statusLogs: {
        create: { status: "RESEARCHING", note: "Job added for research" },
      },
    },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json(job, { status: 201 });
}
