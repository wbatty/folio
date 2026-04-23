import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  zodField,
  UrlField,
  OptionalUrlField,
  RequiredNameField,
  RequiredQuestionField,
  RequiredContentField,
  JobStatusEnum,
  JobExtractionSchema,
  CreateJobSchema,
  UpdateStatusSchema,
  CreateQuestionSchema,
  UpdateQuestionSchema,
  CreateNoteSchema,
  ImportJobRowSchema,
  CsvImportSchema,
  CreateCompanySchema,
  UpdateCompanySchema,
  MergeCompanySchema,
  UpdateJobSchema,
  UpdateJobFormSchema,
  GenerateRequestSchema,
} from "./schemas";

// ─── zodField ─────────────────────────────────────────────────────────────────

describe("zodField", () => {
  it("returns onChange and onSubmit validators", () => {
    const field = zodField(z.string().min(1));
    expect(field).toHaveProperty("onChange");
    expect(field).toHaveProperty("onSubmit");
  });

  it("returns undefined for a valid value", () => {
    const field = zodField(z.string().min(1));
    expect(field.onChange({ value: "hello" })).toBeUndefined();
  });

  it("returns the first error message for an invalid value", () => {
    const field = zodField(z.string().min(1, "Required"));
    expect(field.onChange({ value: "" })).toBe("Required");
  });

  it("onSubmit behaves the same as onChange", () => {
    const field = zodField(z.string().min(1, "Required"));
    expect(field.onSubmit({ value: "" })).toBe("Required");
    expect(field.onSubmit({ value: "ok" })).toBeUndefined();
  });
});

// ─── UrlField ─────────────────────────────────────────────────────────────────

describe("UrlField", () => {
  it("accepts valid https URLs", () => {
    expect(UrlField.safeParse("https://example.com").success).toBe(true);
    expect(UrlField.safeParse("https://jobs.example.com/path?q=1").success).toBe(true);
  });

  it("accepts valid http URLs", () => {
    expect(UrlField.safeParse("http://example.com").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(UrlField.safeParse("").success).toBe(false);
  });

  it("rejects plain strings without protocol", () => {
    expect(UrlField.safeParse("example.com").success).toBe(false);
    expect(UrlField.safeParse("not-a-url").success).toBe(false);
  });

  it("returns the custom error message", () => {
    const result = UrlField.safeParse("bad");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Must be a valid URL");
    }
  });
});

// ─── OptionalUrlField ─────────────────────────────────────────────────────────

describe("OptionalUrlField", () => {
  it("accepts a valid URL", () => {
    expect(OptionalUrlField.safeParse("https://example.com").success).toBe(true);
  });

  it("accepts an empty string", () => {
    expect(OptionalUrlField.safeParse("").success).toBe(true);
  });

  it("rejects a non-URL non-empty string", () => {
    expect(OptionalUrlField.safeParse("not-a-url").success).toBe(false);
  });
});

// ─── RequiredNameField ────────────────────────────────────────────────────────

describe("RequiredNameField", () => {
  it("accepts a normal name", () => {
    expect(RequiredNameField.safeParse("Acme Corp").success).toBe(true);
  });

  it("accepts a single character", () => {
    expect(RequiredNameField.safeParse("A").success).toBe(true);
  });

  it("accepts a name at max length", () => {
    expect(RequiredNameField.safeParse("a".repeat(200)).success).toBe(true);
  });

  it("rejects an empty string", () => {
    const r = RequiredNameField.safeParse("");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Name is required");
  });

  it("rejects a name exceeding 200 characters", () => {
    expect(RequiredNameField.safeParse("a".repeat(201)).success).toBe(false);
  });
});

// ─── RequiredQuestionField ────────────────────────────────────────────────────

describe("RequiredQuestionField", () => {
  it("accepts a valid question", () => {
    expect(RequiredQuestionField.safeParse("Why do you want this job?").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(RequiredQuestionField.safeParse("").success).toBe(false);
  });

  it("rejects strings over 1000 characters", () => {
    expect(RequiredQuestionField.safeParse("q".repeat(1001)).success).toBe(false);
  });
});

// ─── RequiredContentField ─────────────────────────────────────────────────────

describe("RequiredContentField", () => {
  it("accepts valid content", () => {
    expect(RequiredContentField.safeParse("Some note content").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(RequiredContentField.safeParse("").success).toBe(false);
  });

  it("rejects content over 5000 characters", () => {
    expect(RequiredContentField.safeParse("x".repeat(5001)).success).toBe(false);
  });
});

// ─── JobStatusEnum ────────────────────────────────────────────────────────────

describe("JobStatusEnum", () => {
  const validStatuses = [
    "RESEARCHING",
    "RESEARCH_ERROR",
    "PENDING_APPLICATION",
    "APPLIED",
    "INTERVIEWING",
    "OFFERED",
    "DENIED",
    "WITHDRAWN",
  ] as const;

  for (const status of validStatuses) {
    it(`accepts "${status}"`, () => {
      expect(JobStatusEnum.safeParse(status).success).toBe(true);
    });
  }

  it("rejects lowercase values", () => {
    expect(JobStatusEnum.safeParse("applied").success).toBe(false);
  });

  it("rejects unknown values", () => {
    expect(JobStatusEnum.safeParse("PENDING").success).toBe(false);
    expect(JobStatusEnum.safeParse("").success).toBe(false);
  });
});

// ─── JobExtractionSchema ──────────────────────────────────────────────────────

describe("JobExtractionSchema", () => {
  it("accepts a valid extraction object", () => {
    expect(
      JobExtractionSchema.safeParse({
        company: "Acme",
        title: "Engineer",
        description: "Build things",
      }).success
    ).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(JobExtractionSchema.safeParse({ company: "Acme", title: "Engineer" }).success).toBe(false);
  });
});

// ─── CreateJobSchema ──────────────────────────────────────────────────────────

describe("CreateJobSchema", () => {
  it("accepts a URL-only payload", () => {
    expect(CreateJobSchema.safeParse({ url: "https://jobs.example.com/123" }).success).toBe(true);
  });

  it("accepts optional company and title", () => {
    expect(
      CreateJobSchema.safeParse({
        url: "https://jobs.example.com/123",
        company: "Acme",
        title: "Engineer",
      }).success
    ).toBe(true);
  });

  it("rejects an invalid URL", () => {
    expect(CreateJobSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });

  it("rejects missing url", () => {
    expect(CreateJobSchema.safeParse({}).success).toBe(false);
  });

  it("rejects company over 200 characters", () => {
    expect(
      CreateJobSchema.safeParse({
        url: "https://example.com",
        company: "a".repeat(201),
      }).success
    ).toBe(false);
  });
});

// ─── UpdateStatusSchema ───────────────────────────────────────────────────────

describe("UpdateStatusSchema", () => {
  it("accepts a valid status", () => {
    expect(UpdateStatusSchema.safeParse({ status: "APPLIED" }).success).toBe(true);
  });

  it("accepts a status with an optional note", () => {
    expect(UpdateStatusSchema.safeParse({ status: "INTERVIEWING", note: "Phone screen" }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(UpdateStatusSchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });
});

// ─── CreateQuestionSchema ─────────────────────────────────────────────────────

describe("CreateQuestionSchema", () => {
  it("accepts a valid question", () => {
    expect(CreateQuestionSchema.safeParse({ question: "Tell me about yourself?" }).success).toBe(true);
  });

  it("accepts optional context", () => {
    expect(
      CreateQuestionSchema.safeParse({ question: "Tell me about yourself?", context: "Interview round 1" }).success
    ).toBe(true);
  });

  it("rejects empty question", () => {
    expect(CreateQuestionSchema.safeParse({ question: "" }).success).toBe(false);
  });

  it("rejects context over 2000 characters", () => {
    expect(
      CreateQuestionSchema.safeParse({ question: "Q?", context: "x".repeat(2001) }).success
    ).toBe(false);
  });
});

// ─── UpdateQuestionSchema ─────────────────────────────────────────────────────

describe("UpdateQuestionSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(UpdateQuestionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a response update", () => {
    expect(UpdateQuestionSchema.safeParse({ response: "My answer here" }).success).toBe(true);
  });

  it("rejects a question that is empty string (min 1)", () => {
    expect(UpdateQuestionSchema.safeParse({ question: "" }).success).toBe(false);
  });
});

// ─── CreateNoteSchema ─────────────────────────────────────────────────────────

describe("CreateNoteSchema", () => {
  it("accepts valid content", () => {
    expect(CreateNoteSchema.safeParse({ content: "Interview notes" }).success).toBe(true);
  });

  it("rejects empty content", () => {
    expect(CreateNoteSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects content over 5000 characters", () => {
    expect(CreateNoteSchema.safeParse({ content: "x".repeat(5001) }).success).toBe(false);
  });
});

// ─── ImportJobRowSchema ───────────────────────────────────────────────────────

describe("ImportJobRowSchema", () => {
  it("accepts a minimal valid row", () => {
    expect(ImportJobRowSchema.safeParse({ url: "https://example.com/job" }).success).toBe(true);
  });

  it("defaults status to APPLIED when omitted", () => {
    const r = ImportJobRowSchema.safeParse({ url: "https://example.com/job" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("APPLIED");
  });

  it("accepts all optional fields", () => {
    expect(
      ImportJobRowSchema.safeParse({
        url: "https://example.com/job",
        company: "Acme",
        title: "Engineer",
        status: "INTERVIEWING",
        dateApplied: "2026-02-02",
        noteContent: "Some notes",
      }).success
    ).toBe(true);
  });

  it("rejects an invalid URL", () => {
    expect(ImportJobRowSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(ImportJobRowSchema.safeParse({ url: "https://example.com", status: "UNKNOWN" }).success).toBe(false);
  });
});

// ─── CsvImportSchema ──────────────────────────────────────────────────────────

describe("CsvImportSchema", () => {
  const validRow = { url: "https://example.com/job" };

  it("accepts one or more valid rows", () => {
    expect(CsvImportSchema.safeParse({ rows: [validRow] }).success).toBe(true);
    expect(CsvImportSchema.safeParse({ rows: [validRow, validRow] }).success).toBe(true);
  });

  it("rejects an empty rows array", () => {
    expect(CsvImportSchema.safeParse({ rows: [] }).success).toBe(false);
  });

  it("rejects more than 500 rows", () => {
    expect(CsvImportSchema.safeParse({ rows: Array(501).fill(validRow) }).success).toBe(false);
  });
});

// ─── CreateCompanySchema ──────────────────────────────────────────────────────

describe("CreateCompanySchema", () => {
  it("accepts a name-only payload", () => {
    expect(CreateCompanySchema.safeParse({ name: "Acme Corp" }).success).toBe(true);
  });

  it("accepts optional site and job_listing_index URLs", () => {
    expect(
      CreateCompanySchema.safeParse({
        name: "Acme",
        site: "https://acme.com",
        job_listing_index: "https://acme.com/jobs",
      }).success
    ).toBe(true);
  });

  it("accepts empty string for optional URL fields", () => {
    expect(CreateCompanySchema.safeParse({ name: "Acme", site: "" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(CreateCompanySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects an invalid URL for site", () => {
    expect(CreateCompanySchema.safeParse({ name: "Acme", site: "not-a-url" }).success).toBe(false);
  });
});

// ─── UpdateCompanySchema ──────────────────────────────────────────────────────

describe("UpdateCompanySchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(UpdateCompanySchema.safeParse({}).success).toBe(true);
  });

  it("accepts null to clear nullable fields", () => {
    expect(UpdateCompanySchema.safeParse({ site: null, job_listing_index: null }).success).toBe(true);
  });

  it("accepts a valid ISO datetime for last_checked_at", () => {
    expect(
      UpdateCompanySchema.safeParse({ last_checked_at: "2026-04-23T10:00:00Z" }).success
    ).toBe(true);
  });

  it("rejects an invalid datetime", () => {
    expect(UpdateCompanySchema.safeParse({ last_checked_at: "2026-04-23" }).success).toBe(false);
  });

  it("rejects a name shorter than 1 character", () => {
    expect(UpdateCompanySchema.safeParse({ name: "" }).success).toBe(false);
  });
});

// ─── MergeCompanySchema ───────────────────────────────────────────────────────

describe("MergeCompanySchema", () => {
  it("accepts a valid UUID", () => {
    expect(
      MergeCompanySchema.safeParse({ targetId: "550e8400-e29b-41d4-a716-446655440000" }).success
    ).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    const r = MergeCompanySchema.safeParse({ targetId: "not-a-uuid" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Must be a valid company ID");
  });

  it("rejects missing targetId", () => {
    expect(MergeCompanySchema.safeParse({}).success).toBe(false);
  });
});

// ─── UpdateJobSchema ──────────────────────────────────────────────────────────

describe("UpdateJobSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(UpdateJobSchema.safeParse({}).success).toBe(true);
  });

  it("accepts null to clear dateApplied", () => {
    expect(UpdateJobSchema.safeParse({ dateApplied: null }).success).toBe(true);
  });

  it("accepts a valid ISO datetime for dateApplied", () => {
    expect(UpdateJobSchema.safeParse({ dateApplied: "2026-04-23T00:00:00Z" }).success).toBe(true);
  });

  it("rejects a date-only string for dateApplied", () => {
    expect(UpdateJobSchema.safeParse({ dateApplied: "2026-04-23" }).success).toBe(false);
  });
});

// ─── UpdateJobFormSchema ──────────────────────────────────────────────────────

describe("UpdateJobFormSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(UpdateJobFormSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid YYYY-MM-DD date", () => {
    expect(UpdateJobFormSchema.safeParse({ dateApplied: "2026-04-23" }).success).toBe(true);
  });

  it("accepts empty string for dateApplied (clear)", () => {
    expect(UpdateJobFormSchema.safeParse({ dateApplied: "" }).success).toBe(true);
  });

  it("rejects dates that don't match YYYY-MM-DD format", () => {
    expect(UpdateJobFormSchema.safeParse({ dateApplied: "04-23-2026" }).success).toBe(false);
    expect(UpdateJobFormSchema.safeParse({ dateApplied: "2026-4-23" }).success).toBe(false);
    expect(UpdateJobFormSchema.safeParse({ dateApplied: "2026-04-23T00:00:00Z" }).success).toBe(false);
  });

  it("rejects title over 300 characters", () => {
    expect(UpdateJobFormSchema.safeParse({ title: "t".repeat(301) }).success).toBe(false);
  });

  it("rejects description over 2000 characters", () => {
    expect(UpdateJobFormSchema.safeParse({ description: "d".repeat(2001) }).success).toBe(false);
  });
});

// ─── GenerateRequestSchema ────────────────────────────────────────────────────

describe("GenerateRequestSchema", () => {
  it("accepts a valid generate request", () => {
    expect(
      GenerateRequestSchema.safeParse({
        jobId: "job-123",
        questionId: "q-456",
        messages: [{ role: "user", content: "Help me write a cover letter" }],
      }).success
    ).toBe(true);
  });

  it("accepts an empty messages array", () => {
    expect(
      GenerateRequestSchema.safeParse({ jobId: "j", questionId: "q", messages: [] }).success
    ).toBe(true);
  });

  it("rejects an invalid role in messages", () => {
    expect(
      GenerateRequestSchema.safeParse({
        jobId: "j",
        questionId: "q",
        messages: [{ role: "system", content: "hello" }],
      }).success
    ).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(GenerateRequestSchema.safeParse({ jobId: "j" }).success).toBe(false);
  });
});
