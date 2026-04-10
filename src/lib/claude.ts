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
