import { z } from "zod";

// ─── Form validation helper ───────────────────────────────────────────────────

export function zodField(schema: z.ZodType) {
  const validate = ({ value }: { value: unknown }) => {
    const r = schema.safeParse(value);
    return r.success ? undefined : r.error.issues[0]?.message;
  };
  return { onChange: validate, onSubmit: validate } as const;
}

// ─── Reusable field-level schemas ─────────────────────────────────────────────

export const UrlField = z.url({ error: "Must be a valid URL" });
export const OptionalUrlField = z.url({ error: "Must be a valid URL" }).or(z.literal(""));
export const RequiredNameField = z.string().min(1, "Name is required").max(200);
export const RequiredQuestionField = z.string().min(1, "Question is required").max(1000);
export const RequiredContentField = z.string().min(1, "Cannot be empty").max(5000);

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
  "EXPIRED",
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
  url: UrlField,
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const UpdateStatusSchema = z.object({
  status: JobStatusEnum,
  note: z.string().optional(),
});
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

export const CreateQuestionSchema = z.object({
  question: RequiredQuestionField,
  context: z.string().max(2000, "Context is too long").optional(),
});
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export const UpdateQuestionSchema = z.object({
  response: z.string().optional(),
  question: z.string().min(1).max(1000).optional(),
  context: z.string().max(2000).optional(),
});
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

export const CreateNoteSchema = z.object({
  content: RequiredContentField,
});
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

// ─── CSV Import ───────────────────────────────────────────────────────────────

export const ImportJobRowSchema = z.object({
  url: UrlField,
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
  name: RequiredNameField,
  site: OptionalUrlField.optional(),
  job_listing_index: OptionalUrlField.optional(),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

// Server-side: accepts null to clear values
export const UpdateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  site: z.url().optional().nullable(),
  job_listing_index: z.url().optional().nullable(),
  last_checked_at: z.iso.datetime().optional().nullable(),
});
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

// Client-side form: empty string means clear, date inputs give YYYY-MM-DD
export const UpdateCompanyFormSchema = z.object({
  name: RequiredNameField,
  site: OptionalUrlField.optional(),
  job_listing_index: OptionalUrlField.optional(),
  last_checked_at: z.string().optional(),
});
export type UpdateCompanyFormInput = z.infer<typeof UpdateCompanyFormSchema>;

export const MergeCompanySchema = z.object({
  targetId: z.uuid({ error: "Must be a valid company ID" }),
});
export type MergeCompanyInput = z.infer<typeof MergeCompanySchema>;

// Server-side: accepts datetime strings
export const UpdateJobSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  descriptionFull: z.string().optional(),
  dateApplied: z.iso.datetime().optional().nullable(),
});
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;

// Client-side form: date inputs give YYYY-MM-DD
export const UpdateJobFormSchema = z.object({
  title: z.string().max(300, "Title is too long").optional(),
  description: z.string().max(2000, "Description is too long").optional(),
  descriptionFull: z.string().optional(),
  dateApplied: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .or(z.literal(""))
    .optional(),
});
export type UpdateJobFormInput = z.infer<typeof UpdateJobFormSchema>;

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
