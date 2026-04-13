import { z } from "zod";
import { JobExtractionSchema } from "@/lib/schemas";
import { query } from "@anthropic-ai/claude-agent-sdk";

const jobExtractionJsonSchema = z.toJSONSchema(JobExtractionSchema, { target: "draft-07" });

export async function  parseJob(jobDescription: string): Promise<z.infer<typeof JobExtractionSchema>> {
  let structuredOutput: unknown;
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
      } else if (message.type === "result") {
        throw new Error(`Agent extraction failed: ${message.subtype}`);
      }
    }
  
    if (structuredOutput === undefined) {
      throw new Error("No structured output returned from extraction");
    }
  
    // Validate the output against our Zod schema
    return JobExtractionSchema.parse(structuredOutput);
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
