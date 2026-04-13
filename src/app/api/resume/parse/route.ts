export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
// pdf-parse is CJS-only; use require to avoid ESM default-export issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse-new") as (buf: Buffer) => Promise<{ text: string }>;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let content: string;

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    content = parsed.text;
  } else {
    content = buffer.toString("utf-8");
  }

  return NextResponse.json({ content });
}
