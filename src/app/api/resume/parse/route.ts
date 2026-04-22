export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";
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

  let rawText: string;

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    rawText = parsed.text;
  } else {
    rawText = buffer.toString("utf-8");
  }

  // Use Claude to convert raw extracted text into clean, structured markdown
  let content = rawText;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system:
        "Convert the following raw resume text into clean, well-structured markdown. Preserve all content faithfully. Use headers for sections (e.g. # Full Name, ## Summary, ## Experience, ## Education, ## Skills). Fix spacing and formatting issues common in PDF extraction. Output only the markdown — no commentary, no code fences.",
      messages: [{ role: "user", content: rawText.slice(0, 20000) }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = (response.content as any[]).find((b) => b.type === "text");
    if (block?.text) {
      content = block.text;
    }
  } catch {
    // Fall back to raw text if Claude call fails
  }

  return NextResponse.json({ content });
}
