import { NextRequest, NextResponse } from "next/server";
import { CsvImportSchema } from "@/lib/schemas";
import { enqueueRaw } from "@/lib/ingest";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CsvImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rows } = parsed.data;
  let enqueued = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await enqueueRaw({
        url: row.url,
        source: "csv",
        ...(row.company?.trim() ? { company: row.company.trim() } : {}),
        ...(row.title?.trim() ? { title: row.title.trim() } : {}),
        status: row.status,
        ...(row.dateApplied ? { date_applied: row.dateApplied } : {}),
        ...(row.noteContent?.trim() ? { note: row.noteContent.trim() } : {}),
      });
      enqueued++;
    } catch (err) {
      errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Enqueue failed" });
    }
  }

  return NextResponse.json({ enqueued, errors }, { status: 202 });
}
