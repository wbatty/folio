import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic, buildSystemPrompt, generateWithSession } from "@/lib/claude";
import { GenerateRequestSchema } from "@/lib/schemas";
import { enqueueForJob } from "@/lib/job-queue";

function buildResumePrompt(job: Record<string, unknown>, messages: Array<{ role: string; content: string }>): string {
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  
  const question = (messages.length === 1) ? messages[0].content : `Prior conversation:\n${history}\n\nNew request: ${messages[messages.length - 1].content}`;

  return ` You are a helpful assistant that provides job application advice based on a user's resume and a job description. Use the following information to answer the user's question. Provide your answer in a concise and helpful manner without preamble and without following up so the user can save and paste into a text editor, drawing on specific details from the resume and job description.
Job details:
Company: ${job.company as string | null}
Title: ${job.title as string | null}
Description: ${job.description_full as string | null}

Resume:
${job.resume ? (job.resume as Record<string, unknown>).content : "No resume found"}

${question}`;
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
    .select("*, companies(name), resume:resumes(*)")
    .eq("id", jobId)
    .single();
  const job = rawJob as unknown as Record<string, unknown> | null;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const sessionId = job.session_id as string | null;

  // Session-resume path: use the Agent SDK to continue the research session
  if (sessionId) {
    const prompt = buildResumePrompt(job, messages);
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

  const companyJoin = job.companies as { name: string } | null;
  const systemPrompt = buildSystemPrompt(
    resume.content as string,
    (companyJoin?.name ?? null) as string,
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
