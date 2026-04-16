import { z } from "zod";
import { chromium } from "playwright";
import { JobExtractionSchema } from "@/lib/schemas";
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import Anthropic from "@anthropic-ai/sdk";

const jobExtractionJsonSchema = z.toJSONSchema(JobExtractionSchema, { target: "draft-07" });

const fetchRenderedPage = tool(
  "FetchRenderedPage",
  "Fetches a JS-rendered page using a real browser and returns the full HTML content after JavaScript has executed.",
  {
    url: z.string().describe("The URL to fetch"),
    waitForSelector: z
      .string()
      .optional()
      .describe("CSS selector to wait for before capturing HTML"),
    timeoutMs: z
      .number()
      .optional()
      .default(15000)
      .describe("Max wait time in ms"),
  },
  async ({ url, waitForSelector, timeoutMs }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", (route) =>
        route.abort()
      );
      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: timeoutMs });
      }
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ html, text, url: page.url() }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              url,
            }),
          },
        ],
        isError: true,
      };
    } finally {
      await browser.close();
    }
  },
  {
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

function makePlaywrightServer() {
  return createSdkMcpServer({
    name: "playwright-fetcher",
    version: "1.0.0",
    tools: [fetchRenderedPage],
  });
}

const EXTRACTION_FIELDS = `
- company: string
- companyWebsite: string
- companySummary: string (from the company's main website)
- title: string (exact job title)
- description: string (one sentence summary of the role)
- workStyle: "remote" | "hybrid" | "on-site"
- requiredSkills: string[]
- preferredSkills: string[]
- primaryLanguages: string[]
- frameworks: string[]
- roleClassification: "Frontend Only" | "Frontend-Leaning Fullstack" | "True Fullstack" | "Backend-Leaning Fullstack" | "Backend Only"
- positionSummary: string (2-3 paragraphs)
- compensation: object
- benefits: string[]
- flags: { green: string[], yellow: string[], red: string[] }
- fullJobPostingHtml: string`.trim();

export async function parseJob(
  input: { url: string } | { html: string }
): Promise<{ data: z.infer<typeof JobExtractionSchema>; sessionId: string | null; costUsd: number }> {
  const isUrl = "url" in input;

  const prompt = isUrl
    ? `Research this job posting URL and return a single JSON object with these fields:
${EXTRACTION_FIELDS}

Strategy:
1. Use FetchRenderedPage to load the job posting — it runs a real browser so JS-rendered content will be fully hydrated
2. Use FetchRenderedPage on the company's main website for the company summary
3. Use WebSearch + WebFetch for funding, team size, and recent news
4. Synthesize into the JSON object above
5. Return ONLY the JSON, no markdown fences or preamble

Job posting URL: ${input.url}`
    : `Analyze this cached job posting HTML and return a single JSON object with these fields:
${EXTRACTION_FIELDS}

Instructions:
- Extract all available fields from the HTML below
- Use WebSearch + WebFetch for company summary, funding, and team size
- Return ONLY the JSON, no markdown fences or preamble

Job posting HTML:
${input.html.slice(0, 30000)}`;

  let structuredOutput: unknown;
  let sessionId: string | null = null;
  let costUsd = 0;

  for await (const message of query({
    prompt,
    options: {
      maxTurns: 12,
      outputFormat: {
        type: "json_schema",
        schema: jobExtractionJsonSchema,
      },
      allowedTools: ["WebFetch", "WebSearch"],
      ...(isUrl ? { mcpServers: { playwright: makePlaywrightServer() } } : {}),
      permissionMode: "acceptEdits",
    },
  })) {
    if (message.type === "system" && message.subtype === "api_retry") {
      throw new Error(`Agent error: ${message.error}`);
    }
    if (message.type === "result" && message.subtype === "success") {
      structuredOutput = message.structured_output;
      sessionId = message.session_id;
      costUsd = message.total_cost_usd ?? 0;
    } else if (message.type === "result") {
      throw new Error(`Agent extraction failed: ${message.subtype}`);
    }
  }

  if (structuredOutput === undefined) {
    throw new Error("No structured output returned from extraction");
  }

  return { data: JobExtractionSchema.parse(structuredOutput), sessionId, costUsd };
}

export async function* generateWithSession(
  sessionId: string,
  prompt: string
): AsyncGenerator<string> {
  for await (const message of query({
    prompt,
    options: {
      resume: sessionId,
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
      yield message.event.delta.text;
    }
  }
}

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
