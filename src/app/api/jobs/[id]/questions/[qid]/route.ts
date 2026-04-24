import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { UpdateQuestionSchema } from "@/lib/schemas";
import { CacheTag } from "@/lib/cache-tags";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const { id, qid } = await params;
  const body = await req.json();

  const parsed = UpdateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: question, error } = await supabase
    .from("questions")
    .update(parsed.data)
    .eq("id", qid)
    .select()
    .single();

  if (error || !question) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  revalidateTag(CacheTag.jobDetail(id));

  return NextResponse.json({
    id: question.id,
    jobId: question.job_id,
    question: question.question,
    context: question.context,
    response: question.response,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const { id, qid } = await params;
  await supabase.from("questions").delete().eq("id", qid);
  revalidateTag(CacheTag.jobDetail(id));
  return NextResponse.json({ success: true });
}
