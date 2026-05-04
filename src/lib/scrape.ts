import { chromium } from "playwright";
import { clean } from "decant";
import { supabase } from "@/lib/supabase";
import { parseJob } from "@/lib/claude";
import { matchOrCreateCompanyByName } from "@/lib/company-matching";

function assertPublicUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  const host = url.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^fd[0-9a-f]{2}:/i,
  ];
  if (privatePatterns.some((re) => re.test(host))) {
    throw new Error("Scraping private/internal addresses is not allowed");
  }
}

async function resolveCompanyId(jobId: string, extractedName: string | null | undefined): Promise<string | null> {
  const { data: currentJob } = await supabase
    .from("jobs")
    .select("company_id")
    .eq("id", jobId)
    .single();
  if (currentJob?.company_id) return currentJob.company_id;
  return matchOrCreateCompanyByName(extractedName);
}

async function htmlToMarkdown(html: string): Promise<string> {
  try {
    return (await clean(html)).markdown;
  } catch {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
  }
}

async function fetchHtml(url: string): Promise<string> {
  assertPublicUrl(url);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function extractAndUpdate(jobId: string, markdown: string): Promise<void> {
  await supabase.from("jobs").update({ description_full: markdown }).eq("id", jobId);
  await supabase.from("status_logs").insert({
    job_id: jobId,
    status: "RESEARCHING",
    note: "Full description scraped",
  });

  const { data: extracted, sessionId } = await parseJob(markdown.slice(0, 15000));
  const companyId = await resolveCompanyId(jobId, extracted.company);

  await supabase
    .from("jobs")
    .update({
      company_id: companyId,
      title: extracted.title,
      description: extracted.description,
      session_id: sessionId,
      status: "PENDING_APPLICATION",
    })
    .eq("id", jobId);

  await supabase.from("status_logs").insert({
    job_id: jobId,
    status: "PENDING_APPLICATION",
    note: "Research complete",
  });
}

export interface ScrapeOptions {
  /** Pre-supplied page HTML — bypasses Playwright. Used by the manual recovery flow. */
  manualHtml?: string;
}

export async function runScrape(jobId: string, options: ScrapeOptions = {}): Promise<void> {
  const { data: job } = await supabase
    .from("jobs")
    .select("id, url, description_full, company_id")
    .eq("id", jobId)
    .single();

  if (!job) throw new Error(`Job ${jobId} not found`);

  try {
    if (job.description_full && !options.manualHtml) {
      const { data: extracted, sessionId } = await parseJob((job.description_full as string).slice(0, 15000));
      const companyId = job.company_id ?? (await matchOrCreateCompanyByName(extracted.company));
      await supabase
        .from("jobs")
        .update({
          company_id: companyId,
          title: extracted.title,
          description: extracted.description,
          session_id: sessionId,
          status: "PENDING_APPLICATION",
        })
        .eq("id", jobId);
      await supabase.from("status_logs").insert({
        job_id: jobId,
        status: "PENDING_APPLICATION",
        note: "Research complete",
      });
      return;
    }

    const html = options.manualHtml ?? (await fetchHtml(job.url));
    const markdown = await htmlToMarkdown(html);
    await extractAndUpdate(jobId, markdown);
  } catch (err) {
    console.error(`Scrape failed for job ${jobId}:`, err);
    await supabase.from("jobs").update({ status: "RESEARCH_ERROR" }).eq("id", jobId);
    await supabase.from("status_logs").insert({
      job_id: jobId,
      status: "RESEARCH_ERROR",
      note: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  }
}
