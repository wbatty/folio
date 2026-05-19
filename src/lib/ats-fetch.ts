import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { htmlToMarkdown } from "@/lib/scrape";

// ─── Errors ──────────────────────────────────────────────────────────────────

export class WAFBlockedError extends Error {
  constructor(public url: string) {
    super(`WAF/bot check detected at ${url}`);
    this.name = "WAFBlockedError";
  }
}

export class JobNotFoundError extends Error {
  constructor(public url: string) {
    super(`Job posting not found (404) at ${url}`);
    this.name = "JobNotFoundError";
  }
}

export class ATSFetchError extends Error {
  constructor(public platform: string, public status: number) {
    super(`${platform} API returned ${status}`);
    this.name = "ATSFetchError";
  }
}

export class ParseError extends Error {
  constructor(public platform: string, message: string) {
    super(`${platform} parse error: ${message}`);
    this.name = "ParseError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = "short_text" | "long_text" | "select" | "boolean" | "file";

export interface ApplicationQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

export interface JobData {
  title: string;
  company: string;
  location: string | null;
  description_markdown: string;
  application_questions: ApplicationQuestion[];
  raw_json: unknown;
}

// ─── WAF-aware fetch ──────────────────────────────────────────────────────────

export const CHROME_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
} as const;

interface FetchedPage {
  html: string;
  $: cheerio.CheerioAPI;
}

async function fetchHtml(url: string): Promise<FetchedPage> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: CHROME_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new WAFBlockedError(url);
  }

  if (res.status === 404) throw new JobNotFoundError(url);
  if (!res.ok) throw new WAFBlockedError(url);

  const html = await res.text();
  const $ = cheerio.load(html);

  if ($("body").text().trim().length < 200) throw new WAFBlockedError(url);

  const title = $("title").text();
  if (
    title.includes("Just a moment") ||
    title.includes("Access Denied") ||
    title.includes("Robot Check") ||
    $("#challenge-form").length > 0 ||
    html.includes("window._cf_chl_opt")
  ) {
    throw new WAFBlockedError(url);
  }

  return { html, $ };
}

export async function checkJobUrl(url: string): Promise<"ok" | "not_found" | "blocked"> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: CHROME_HEADERS,
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (res.status === 404) return "not_found";
    if (res.ok) return "ok";
    return "blocked";
  } catch {
    return "blocked";
  }
}

// ─── Greenhouse ───────────────────────────────────────────────────────────────

interface GreenhouseQuestion {
  label: string;
  required: boolean;
  fields: Array<{
    name: string;
    type: string;
    values: Array<{ value: number | string; label: string }>;
  }>;
}

function normalizeGreenhouseQuestion(q: GreenhouseQuestion): ApplicationQuestion {
  const field = q.fields[0];
  let type: QuestionType = "short_text";
  if (field?.type === "textarea") type = "long_text";
  else if (field?.type === "multi_value_single_select" || field?.type === "multi_value_multi_select") type = "select";
  else if (field?.type === "attachment") type = "file";

  return {
    id: field?.name ?? q.label,
    label: q.label,
    type,
    required: q.required,
    options: field?.values?.map((v) => String(v.label)) ?? undefined,
  };
}

export async function fetchGreenhouse(boardToken: string, jobId: string): Promise<JobData> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`
  );
  if (res.status === 404) throw new JobNotFoundError(`greenhouse:${boardToken}/${jobId}`);
  if (!res.ok) throw new ATSFetchError("greenhouse", res.status);
  const data = await res.json();
  return {
    title: data.title ?? "",
    company: boardToken,
    location: data.location?.name ?? null,
    description_markdown: htmlToMarkdown(data.content ?? ""),
    application_questions: (data.questions as GreenhouseQuestion[] ?? []).map(normalizeGreenhouseQuestion),
    raw_json: data,
  };
}

// ─── Lever ────────────────────────────────────────────────────────────────────

interface LeverFormField {
  id?: string;
  text?: string;
  required?: boolean;
  type?: string;
  options?: Array<{ text: string }>;
}

function normalizeLeverFields(fields: LeverFormField[]): ApplicationQuestion[] {
  return fields.map((f, i) => {
    let type: QuestionType = "short_text";
    if (f.type === "textarea") type = "long_text";
    else if (f.type === "dropdown") type = "select";
    else if (f.type === "boolean" || f.type === "checkbox") type = "boolean";
    else if (f.type === "file") type = "file";
    return {
      id: f.id ?? String(i),
      label: f.text ?? "",
      type,
      required: f.required ?? false,
      options: f.options?.map((o) => o.text) ?? undefined,
    };
  });
}

async function extractLeverPosting(company: string, jobId: string) {
  const { $ } = await fetchHtml(`https://jobs.lever.co/${company}/${jobId}`);
  const title = $(".posting-headline h2").text().trim();
  const location = $(".posting-categories .sort-by-location").text().trim() || null;

  let descriptionHtml = $(".posting-description, .section-wrapper")
    .map((_, el) => $.html(el))
    .get()
    .join("\n");

  if (!descriptionHtml.trim()) {
    descriptionHtml = $("body").html() ?? "";
  }

  return { title, location, descriptionHtml };
}

async function extractLeverFormSchema(company: string, jobId: string): Promise<LeverFormField[]> {
  const { html, $ } = await fetchHtml(`https://jobs.lever.co/${company}/${jobId}/apply`);
  let stateJson: string | null = null;
  $("script").each((_, el) => {
    const src = $(el).html() ?? "";
    if (src.includes("window.__preloadedState")) {
      const match = src.match(/window\.__preloadedState\s*=\s*(\{[\s\S]+?\});\s*(?:<\/script>|$)/m);
      if (match) stateJson = match[1];
    }
  });
  if (!stateJson) {
    // __preloadedState missing — return empty form schema rather than failing
    void html;
    return [];
  }
  const state = JSON.parse(stateJson);
  return state?.posting?.forms?.[0]?.fields ?? [];
}

export async function fetchLever(company: string, jobId: string): Promise<JobData> {
  const [posting, formFields] = await Promise.all([
    extractLeverPosting(company, jobId),
    extractLeverFormSchema(company, jobId),
  ]);
  return {
    title: posting.title,
    company,
    location: posting.location,
    description_markdown: htmlToMarkdown(posting.descriptionHtml),
    application_questions: normalizeLeverFields(formFields),
    raw_json: null,
  };
}

// ─── Ashby ────────────────────────────────────────────────────────────────────

const ASHBY_GQL_QUERY = `
  query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
    jobPosting(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      jobPostingId: $jobPostingId
    ) {
      id
      title
      locationName
      workplaceType
      descriptionHtml
      applicationForm {
        ...FormRenderParts
      }
    }
  }

  fragment FormRenderParts on FormRender {
    formControls { identifier title }
    sections {
      title
      fieldEntries {
        id
        field
        isRequired
        descriptionHtml
        isHidden
      }
    }
  }
`;

interface AshbyFormControl { identifier: string; title: string }
interface AshbyFieldEntry { id: string; field: string; isRequired: boolean; descriptionHtml: string | null; isHidden: boolean }
interface AshbySection { title: string; fieldEntries: AshbyFieldEntry[] }
interface AshbyFormRender { formControls: AshbyFormControl[]; sections: AshbySection[] }

function inferAshbyFieldType(fieldIdentifier: unknown): QuestionType {
  const id = typeof fieldIdentifier === "string" ? fieldIdentifier : "";
  if (id.includes("resume") || id.includes("file")) return "file";
  if (id.includes("coverLetter")) return "file";
  if (id.includes("textarea") || id.includes("longText")) return "long_text";
  if (id.includes("select") || id.includes("dropdown")) return "select";
  if (id.includes("checkbox") || id.includes("boolean")) return "boolean";
  return "short_text";
}

function normalizeAshbyForm(form: AshbyFormRender): ApplicationQuestion[] {
  const controlMap = new Map(form.formControls.map((c) => [c.identifier, c.title]));
  return form.sections
    .flatMap((s) => s.fieldEntries)
    .filter((e) => !e.isHidden)
    .map((e) => {
      const fieldKey = typeof e.field === "string" ? e.field : "";
      return {
        id: e.id,
        label: controlMap.get(fieldKey) ?? htmlToMarkdown(e.descriptionHtml ?? ""),
        type: inferAshbyFieldType(fieldKey),
        required: e.isRequired,
      };
    });
}

export async function fetchAshby(boardHandle: string, jobId: string): Promise<JobData> {
  const res = await fetch("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apollographql-client-name": "frontend_non_user",
      "apollographql-client-version": "0.1.0",
    },
    body: JSON.stringify({
      operationName: "ApiJobPosting",
      variables: { organizationHostedJobsPageName: boardHandle, jobPostingId: jobId },
      query: ASHBY_GQL_QUERY,
    }),
  });
  if (res.status === 404) throw new JobNotFoundError(`ashby:${boardHandle}/${jobId}`);
  if (!res.ok) throw new ATSFetchError("ashby", res.status);
  const { data, errors } = await res.json();
  if (errors?.length) throw new ParseError("ashby", errors[0].message);

  const posting = data.jobPosting;
  if (!posting) throw new JobNotFoundError(`ashby:${boardHandle}/${jobId}`);
  return {
    title: posting.title ?? "",
    company: boardHandle,
    location: posting.locationName ?? null,
    description_markdown: htmlToMarkdown(posting.descriptionHtml ?? ""),
    application_questions: posting.applicationForm
      ? normalizeAshbyForm(posting.applicationForm as AshbyFormRender)
      : [],
    raw_json: posting,
  };
}

// ─── Workday ──────────────────────────────────────────────────────────────────

export async function fetchWorkday(url: string): Promise<JobData> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    return {
      title: "",
      company: "",
      location: null,
      description_markdown: htmlToMarkdown(html),
      application_questions: [],
      raw_json: null,
    };
  } finally {
    await browser.close();
  }
}

// ─── Unknown / Cheerio triage ─────────────────────────────────────────────────

export async function fetchUnknown(url: string): Promise<JobData> {
  const { html } = await fetchHtml(url); // throws WAFBlockedError on failure
  return {
    title: "",
    company: "",
    location: null,
    description_markdown: htmlToMarkdown(html),
    application_questions: [],
    raw_json: null,
  };
}
