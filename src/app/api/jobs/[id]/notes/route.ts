import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateNoteSchema } from "@/lib/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await prisma.note.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: { jobId: id, content: parsed.data.content },
  });

  return NextResponse.json(note, { status: 201 });
}
