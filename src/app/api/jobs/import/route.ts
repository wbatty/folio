import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CsvImportSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CsvImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rows } = parsed.data;
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          url: row.url,
          company: row.company ?? null,
          title: row.title ?? null,
          status: row.status,
          date_applied: row.dateApplied ?? null,
        })
        .select()
        .single();

      if (jobError || !job) {
        errors.push({ row: i + 1, message: jobError?.message ?? "Insert failed" });
        skipped++;
        continue;
      }

      await supabase
        .from("status_logs")
        .insert({ job_id: job.id, status: row.status, note: "Imported from CSV" });

      if (row.noteContent?.trim()) {
        await supabase
          .from("notes")
          .insert({ job_id: job.id, content: row.noteContent.trim() });
      }

      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Unknown error" });
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, errors }, { status: 200 });
}
