import { z } from "zod";

// ─── Job Status ───────────────────────────────────────────────────────────────

export const JobStatusEnum = z.enum([
  "RESEARCHING",
  "RESEARCH_ERROR",
  "PENDING_APPLICATION",
  "APPLIED",
  "INTERVIEWING",
  "OFFERED",
  "DENIED",
  "WITHDRAWN",
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

// ─── AI: Job Extraction from scraped content ──────────────────────────────────

export const JobExtractionSchema = z.object({
  company: z.string(),
  title: z.string(),
  description: z.string(),
});
export type JobExtraction = z.infer<typeof JobExtractionSchema>;

// ─── API Request Bodies ───────────────────────────────────────────────────────

export const CreateJobSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const UpdateStatusSchema = z.object({
  status: JobStatusEnum,
  note: z.string().optional(),
});
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

export const CreateQuestionSchema = z.object({
  question: z.string().min(1, "Question is required"),
  context: z.string().optional(),
});
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export const UpdateQuestionSchema = z.object({
  response: z.string().optional(),
  question: z.string().optional(),
  context: z.string().optional(),
});
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

export const CreateNoteSchema = z.object({
  content: z.string().min(1, "Note cannot be empty"),
});
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const GenerateRequestSchema = z.object({
  jobId: z.string(),
  questionId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
