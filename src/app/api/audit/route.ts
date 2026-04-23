import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(`
      id, url, title, created_at, updated_at,
      companies(name),
      status_logs(status, note, created_at),
      notes(content, created_at)
    `)
    .eq("status", "EXPIRED")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shaped = (jobs ?? []).map((job) => {
    const companyJoin = job.companies as { name: string } | null;
    const sortedLogs = [...(job.status_logs ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const sortedNotes = [...(job.notes ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return {
      id: job.id,
      url: job.url,
      title: job.title,
      company: companyJoin?.name ?? null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      statusLogs: sortedLogs.map((l) => ({
        status: l.status,
        note: l.note,
        createdAt: l.created_at,
      })),
      notes: sortedNotes.map((n) => ({
        content: n.content,
        createdAt: n.created_at,
      })),
    };
  });

  return NextResponse.json({ jobs: shaped });
}
