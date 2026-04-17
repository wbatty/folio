import { z } from "zod";
import { JobExtractionSchema } from "@/lib/schemas";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Token bucket rate limiter — stays within 30k input tokens/minute.
// Shared across all calls in the same process (queue consumer or Next.js server).
class TokenRateLimiter {
  private available: number;
  private lastRefill: number;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {
    this.available = limit;
    this.lastRefill = Date.now();
  }

  async acquire(cost: number): Promise<void> {
    for (;;) {
      const now = Date.now();
      const refill = ((now - this.lastRefill) / this.windowMs) * this.limit;
      this.available = Math.min(this.limit, this.available + refill);
      this.lastRefill = now;

      if (this.available >= cost) {
        this.available -= cost;
        return;
      }

      const deficit = cost - this.available;
      const waitMs = Math.ceil((deficit / this.limit) * this.windowMs);
      console.log(`[rate-limiter] waiting ${waitMs}ms for ${cost} tokens (${Math.round(this.available)} available)`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

const rateLimiter = new TokenRateLimiter(30_000, 60_000);

// Rough estimate: 1 token ≈ 4 chars, plus ~500 tokens for system prompt + JSON schema overhead.
function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 4) + 500;
}

const jobExtractionJsonSchema = z.toJSONSchema(JobExtractionSchema, { target: "draft-07" });

export async function parseJob(jobDescription: string): Promise<{ data: z.infer<typeof JobExtractionSchema>; sessionId: string | null }> {
  await rateLimiter.acquire(estimateInputTokens(jobDescription));
  let structuredOutput: unknown;
  let sessionId: string | null = null;
  for await (const message of query({
    prompt: `Extract the company name, job title, and a concise job description from the following job posting content. Return only what is asked — do not add commentary.\n\n${jobDescription}`,
    options: {
      maxTurns: 3,
      outputFormat: {
        type: "json_schema",
        schema: jobExtractionJsonSchema,
      },
    },
  })) {
    if (message.type === "system" && message.subtype === "api_retry") {
      throw new Error(`Agent error: ${message.error}`);
    }
    if (message.type === "result" && message.subtype === "success") {
      structuredOutput = message.structured_output;
      sessionId = message.session_id;
    } else if (message.type === "result") {
      throw new Error(`Agent extraction failed: ${message.subtype}`);
    }
  }

  if (structuredOutput === undefined) {
    throw new Error("No structured output returned from extraction");
  }

  return { data: JobExtractionSchema.parse(structuredOutput), sessionId };
}

export async function* generateWithSession(
  _sessionId: string,
  prompt: string
): AsyncGenerator<string> {
  let yieldedText = false;
  let resultText: string | null = null;

  for await (const message of query({
    prompt,
    options: {
      // resume: sessionId,
      maxTurns: 3,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      allowedTools: [],
    },
  })) {
    if (
      message.type === "stream_event" &&
      message.event.type === "content_block_delta" &&
      message.event.delta.type === "text_delta"
    ) {
      yieldedText = true;
      yield message.event.delta.text;
    } else if (message.type === "result" && message.subtype === "success") {
      resultText = message.result;
    }
  }

  if (!yieldedText && resultText) {
    yield resultText;
  }
}


import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function buildSystemPrompt(resumeContent: string, company: string | null, title: string | null, description: string | null): string {
  return `You are a job application assistant. Help the applicant write strong, authentic, and concise responses to job application questions.

APPLICANT RESUME:
${resumeContent}

JOB DETAILS:
Company: ${company ?? "Unknown"}
Position: ${title ?? "Unknown"}
${description ? `\nJob Description:\n${description}` : ""}

Instructions:
- Draw on specific experiences and skills from the resume
- Tailor the response to the company and role
- Be authentic, concrete, and avoid generic filler
- Keep responses appropriately concise unless length is requested`;
}

export function buildUserPrompt(question: string, context?: string | null): string {
  let prompt = `Application question: ${question}`;
  if (context?.trim()) {
    prompt += `\n\nAdditional context from the applicant:\n${context}`;
  }
  prompt += "\n\nPlease write a strong response.";
  return prompt;
}
