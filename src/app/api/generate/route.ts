import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic, buildSystemPrompt } from "@/lib/claude";
import { GenerateRequestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, messages } = parsed.data;

  // Load job and resume
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { resume: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Fall back to latest resume if job doesn't have one linked
  const resume =
    job.resume ??
    (await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } }));

  if (!resume) {
    return NextResponse.json({ error: "No resume found. Please upload a resume first." }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(
    resume.content,
    job.company,
    job.title,
    job.descriptionFull
  );

  // Stream the response
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
