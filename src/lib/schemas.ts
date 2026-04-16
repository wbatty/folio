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
  companyWebsite: z.string().optional(),
  companySummary: z.string().optional(),
  title: z.string(),
  description: z.string(),
  workStyle: z.enum(["remote", "hybrid", "on-site"]).optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  primaryLanguages: z.array(z.string()).optional(),
  frameworks: z.array(z.string()).optional(),
  roleClassification: z.enum([
    "Frontend Only",
    "Frontend-Leaning Fullstack",
    "True Fullstack",
    "Backend-Leaning Fullstack",
    "Backend Only",
  ]).optional(),
  positionSummary: z.string().optional(),
  compensation: z.record(z.unknown()).optional(),
  benefits: z.array(z.string()).optional(),
  flags: z.object({
    green: z.array(z.string()),
    yellow: z.array(z.string()),
    red: z.array(z.string()),
  }).optional(),
  fullJobPostingHtml: z.string().optional(),
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

// ─── CSV Import ───────────────────────────────────────────────────────────────

export const ImportJobRowSchema = z.object({
  url: z.string().url(),
  company: z.string().optional(),
  title: z.string().optional(),
  status: JobStatusEnum.default("APPLIED"),
  dateApplied: z.string().optional(), // ISO date string e.g. "2026-02-02"
  noteContent: z.string().optional(), // pre-combined contact + notes
});
export type ImportJobRow = z.infer<typeof ImportJobRowSchema>;

export const CsvImportSchema = z.object({
  rows: z.array(ImportJobRowSchema).min(1).max(500),
});
export type CsvImportInput = z.infer<typeof CsvImportSchema>;

// ─── Companies ────────────────────────────────────────────────────────────────

export const CreateCompanySchema = z.object({
  name: z.string().min(1, "Name is required"),
  site: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  job_listing_index: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  site: z.string().url().optional().nullable(),
  job_listing_index: z.string().url().optional().nullable(),
  last_checked_at: z.string().datetime().optional().nullable(),
});
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

export const MergeCompanySchema = z.object({
  targetId: z.string().uuid("Must be a valid company ID"),
});
export type MergeCompanyInput = z.infer<typeof MergeCompanySchema>;

// ─── AI: Generate ─────────────────────────────────────────────────────────────

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
