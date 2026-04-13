import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CreateNoteSchema } from "@/lib/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json(
    (notes ?? []).map((n) => ({
      id: n.id,
      jobId: n.job_id,
      content: n.content,
      createdAt: n.created_at,
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: note, error } = await supabase
    .from("notes")
    .insert({ job_id: id, content: parsed.data.content })
    .select()
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: note.id,
      jobId: note.job_id,
      content: note.content,
      createdAt: note.created_at,
    },
    { status: 201 }
  );
}
