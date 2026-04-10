import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateQuestionSchema } from "@/lib/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const questions = await prisma.question.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(questions);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const parsed = CreateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const question = await prisma.question.create({
    data: { jobId: id, ...parsed.data },
  });

  return NextResponse.json(question, { status: 201 });
}
