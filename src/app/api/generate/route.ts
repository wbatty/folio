import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic, buildSystemPrompt, generateWithSession } from "@/lib/claude";
import { GenerateRequestSchema } from "@/lib/schemas";
import { enqueueForJob } from "@/lib/job-queue";

function buildResumePrompt(messages: Array<{ role: string; content: string }>): string {
  if (messages.length === 1) return messages[0].content;
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return `Prior conversation:\n${history}\n\nNew request: ${messages[messages.length - 1].content}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, messages } = parsed.data;

  // Load job and resume
  const { data: rawJob } = await supabase
    .from("jobs")
    .select("*, resume:resumes(*)")
    .eq("id", jobId)
    .single();
  const job = rawJob as unknown as Record<string, unknown> | null;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const sessionId = job.session_id as string | null;

  // Session-resume path: use the Agent SDK to continue the research session
  if (sessionId) {
    const prompt = buildResumePrompt(messages);
    const encoder = new TextEncoder();

    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
      // Note: abort not implemented for the session-resume path — the generator
      // runs to completion even if the client disconnects, but chunks are discarded.
    });

    enqueueForJob(jobId, async () => {
      try {
        for await (const chunk of generateWithSession(sessionId, prompt)) {
          streamController.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("generateWithSession error", err);
      } finally {
        streamController.close();
      }
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Fallback path: no session_id, use the direct Anthropic messages API with system prompt

  // Fall back to latest resume if job doesn't have one linked
  let resume = job.resume as Record<string, unknown> | null;
  if (!resume) {
    const { data: latest } = await supabase
      .from("resumes")
      .select("content")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    resume = latest;
  }

  if (!resume) {
    return NextResponse.json(
      { error: "No resume found. Please upload a resume first." },
      { status: 400 }
    );
  }

  const systemPrompt = buildSystemPrompt(
    resume.content as string,
    job.company as string,
    job.title as string,
    job.description_full as string | null
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
