import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CreateQuestionSchema } from "@/lib/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json(
    (questions ?? []).map((q) => ({
      id: q.id,
      jobId: q.job_id,
      question: q.question,
      context: q.context,
      response: q.response,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const parsed = CreateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: question, error } = await supabase
    .from("questions")
    .insert({ job_id: id, question: parsed.data.question, context: parsed.data.context })
    .select()
    .single();

  if (error || !question) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: question.id,
      jobId: question.job_id,
      question: question.question,
      context: question.context,
      response: question.response,
      createdAt: question.created_at,
      updatedAt: question.updated_at,
    },
    { status: 201 }
  );
}
