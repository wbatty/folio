import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateQuestionSchema } from "@/lib/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const { qid } = await params;
  const body = await req.json();

  const parsed = UpdateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const question = await prisma.question.update({
    where: { id: qid },
    data: parsed.data,
  });

  return NextResponse.json(question);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const { qid } = await params;
  await prisma.question.delete({ where: { id: qid } });
  return NextResponse.json({ success: true });
}
