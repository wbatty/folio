import { chromium } from "playwright";
import TurndownService from "turndown";
import { supabase } from "@/lib/supabase";
import { parseJob } from "@/lib/claude";
import { matchOrCreateCompanyByName } from "@/lib/company-matching";
import { detectATS } from "@/lib/ats-detect";
import { checkJobStillLive } from "@/lib/job-check";
import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkday,
  fetchUnknown,
  WAFBlockedError,
  JobNotFoundError,
  type JobData,
} from "@/lib/ats-fetch";
export function assertPublicUrl(urlString: string): void {
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

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.addRule("clean-nbs", {
  filter: ["li"],
  replacement: (content) => content.trim() ? `- ${content.trim()}\n` : "",
});

export function htmlToMarkdown(html: string): string {
  try {
    return turndown.turndown(html);
  } catch {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
  }
}

async function fetchHtmlPlaywright(url: string): Promise<string> {
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

async function extractAndUpdateFromJobData(jobId: string, data: JobData): Promise<void> {
  const markdown = data.description_markdown;
  await supabase.from("jobs").update({ description_full: markdown }).eq("id", jobId);
  if (data.application_questions.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("jobs") as any)
      .update({ application_questions: data.application_questions })
      .eq("id", jobId);
  }
  await supabase.from("status_logs").insert({
    job_id: jobId,
    status: "RESEARCHING",
    note: "Full description scraped",
  });

  const { data: extracted, sessionId } = await parseJob(markdown.slice(0, 15000));
  const companyId = await resolveCompanyId(jobId, extracted.company ?? data.company);

  await supabase
    .from("jobs")
    .update({
      company_id: companyId,
      title: extracted.title ?? data.title,
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

    if (options.manualHtml) {
      const markdown = htmlToMarkdown(options.manualHtml);
      await extractAndUpdate(jobId, markdown);
      return;
    }

    const route = await detectATS(job.url);
    console.log(`[${jobId}] detected ATS route:`, route);

    // For unknown ATS routes we can't rely on the fetch to detect closed listings,
    // so run a lightweight liveness check first. Known ATS routes have dedicated
    // fetch functions that throw JobNotFoundError when a listing is gone.
    if (route.ats === "unknown") {
      const liveness = await checkJobStillLive(job.url);
      console.log(`[${jobId}] job liveness check result: ${liveness}`);
      if (liveness === "closed") {
        console.log(`[${jobId}] job check returned closed for ${job.url}, marking EXPIRED`);
        await supabase.from("jobs").update({ status: "EXPIRED" }).eq("id", jobId);
        await supabase.from("status_logs").insert({
          job_id: jobId,
          status: "EXPIRED",
          note: "Job posting unreachable during initial ingest — marked expired to avoid re-processing",
        });
        return;
      }
    }

    if (route.ats === "greenhouse") {
      await extractAndUpdateFromJobData(jobId, await fetchGreenhouse(route.boardToken, route.jobId));
    } else if (route.ats === "ashby") {
      await extractAndUpdateFromJobData(jobId, await fetchAshby(route.boardHandle, route.jobId));
    } else if (route.ats === "workday") {
      await extractAndUpdateFromJobData(jobId, await fetchWorkday(job.url));
    } else if (route.ats === "lever") {
      try {
        await extractAndUpdateFromJobData(jobId, await fetchLever(route.company, route.jobId));
      } catch (err) {
        if (!(err instanceof WAFBlockedError)) throw err;
        console.warn(`[${jobId}] Lever WAF-blocked, falling back to Playwright`);
        await extractAndUpdate(jobId, htmlToMarkdown(await fetchHtmlPlaywright(job.url)));
      }
    } else {
      try {
        const data = await fetchUnknown(job.url);
        await extractAndUpdate(jobId, data.description_markdown);
      } catch (err) {
        if (!(err instanceof WAFBlockedError)) throw err;
        console.warn(`[${jobId}] WAF-blocked, falling back to Playwright`);
        await extractAndUpdate(jobId, htmlToMarkdown(await fetchHtmlPlaywright(job.url)));
      }
    }
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      console.log(`Scrape: job posting not found for ${jobId}, marking EXPIRED`);
      await supabase.from("jobs").update({ status: "EXPIRED" }).eq("id", jobId);
      await supabase.from("status_logs").insert({
        job_id: jobId,
        status: "EXPIRED",
        note: "Job posting returned 404 — listing no longer available",
      });
      return;
    }
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
