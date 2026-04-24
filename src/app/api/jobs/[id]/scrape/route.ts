import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { chromium } from "playwright";
import { clean } from "decant";
import { supabase } from "@/lib/supabase";
import { parseJob } from "@/lib/claude";
import { matchOrCreateCompanyByName } from "@/lib/company-matching";
import { CacheTag } from "@/lib/cache-tags";

/**
 * Reject URLs that resolve to loopback or RFC-1918 private addresses to
 * prevent server-side request forgery (SSRF) via the headless-browser scraper.
 */
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
    /^169\.254\./, // link-local
    /^fd[0-9a-f]{2}:/i, // IPv6 ULA
  ];
  if (privatePatterns.some((re) => re.test(host))) {
    throw new Error("Scraping private/internal addresses is not allowed");
  }
}

async function resolveCompanyId(jobId: string, extractedName: string | null | undefined): Promise<string | null> {
  // If job already has a company_id (from URL matching at creation), preserve it
  const { data: currentJob } = await supabase
    .from("jobs")
    .select("company_id")
    .eq("id", jobId)
    .single();

  if (currentJob?.company_id) return currentJob.company_id;

  // Otherwise match or create by extracted name
  return matchOrCreateCompanyByName(extractedName);
}

async function extractAndUpdate(id: string, html: string) {
  // 1. Clean HTML to markdown
  let markdown = html;
  try {
    markdown = (await clean(html)).markdown;
  } catch {
    // decant not available, strip tags and fall back to plain text
    markdown = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
  }

  // 2. Save full description so we can re-run extraction without re-scraping
  await supabase.from("jobs").update({ description_full: markdown }).eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "RESEARCHING",
    note: "Full description scraped",
  });
  revalidateTag(CacheTag.jobDetail(id));

  // 3. Extract structured data via Claude Agent SDK
  const { data: extracted, sessionId } = await parseJob(markdown.slice(0, 15000));

  // 4. Resolve company_id (preserve existing URL match, or match/create by name)
  const companyId = await resolveCompanyId(id, extracted.company);

  // 5. Update job with structured fields, session_id, and advance status
  await supabase
    .from("jobs")
    .update({
      company_id: companyId,
      title: extracted.title,
      description: extracted.description,
      session_id: sessionId,
      status: "PENDING_APPLICATION",
    })
    .eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "PENDING_APPLICATION",
    note: "Research complete",
  });

  revalidateTag(CacheTag.jobDetail(id));
  revalidateTag(CacheTag.jobsList);
  revalidateTag(CacheTag.companies);
  revalidateTag(CacheTag.metrics);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, url, description_full, company_id")
    .eq("id", id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // If we already have the full description, re-run extraction without re-scraping
  if (job.description_full) {
    (async () => {
      try {
        const { data: extracted, sessionId } = await parseJob((job.description_full as string).slice(0, 15000));

        // Preserve existing company_id or match/create by extracted name
        const companyId = job.company_id ?? await matchOrCreateCompanyByName(extracted.company);

        await supabase
          .from("jobs")
          .update({
            company_id: companyId,
            title: extracted.title,
            description: extracted.description,
            session_id: sessionId,
            status: "PENDING_APPLICATION",
          })
          .eq("id", id);
        await supabase.from("status_logs").insert({
          job_id: id,
          status: "PENDING_APPLICATION",
          note: "Research complete",
        });

        revalidateTag(CacheTag.jobDetail(id));
        revalidateTag(CacheTag.jobsList);
        revalidateTag(CacheTag.companies);
        revalidateTag(CacheTag.metrics);
      } catch (err) {
        console.error("Extraction failed for job", id, err);
        await supabase.from("jobs").update({ status: "RESEARCH_ERROR" }).eq("id", id);
        await supabase.from("status_logs").insert({
          job_id: id,
          status: "RESEARCH_ERROR",
          note: err instanceof Error ? err.message : "Unknown error during extraction",
        });

        revalidateTag(CacheTag.jobDetail(id));
        revalidateTag(CacheTag.jobsList);
      }
    })();
    return NextResponse.json({ message: "Extraction started with existing description" });
  }

  // Check for manually-provided HTML in the request body
  let manualHtml: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.html === "string" && body.html.trim()) {
      manualHtml = body.html;
    }
  } catch {
    // No body / not JSON — proceed with scrape
  }

  // Reset to RESEARCHING so the UI knows work is in progress
  await supabase.from("jobs").update({ status: "RESEARCHING" }).eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "RESEARCHING",
    note: manualHtml ? "Retrying with manual HTML" : "Retrying scrape",
  });

  revalidateTag(CacheTag.jobDetail(id));
  revalidateTag(CacheTag.jobsList);

  // Kick off async without blocking the response
  (async () => {
    try {
      let html: string;

      if (manualHtml) {
        html = manualHtml;
      } else {
        assertPublicUrl(job.url);
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60000 });
          // Give JS-rendered content a moment to settle without waiting for all network activity
          await page.waitForTimeout(2000);
          html = await page.content();
        } finally {
          await browser.close();
        }
      }

      await extractAndUpdate(id, html);
    } catch (err) {
      console.error("Scrape failed for job", id, err);
      await supabase.from("jobs").update({ status: "RESEARCH_ERROR" }).eq("id", id);
      await supabase.from("status_logs").insert({
        job_id: id,
        status: "RESEARCH_ERROR",
        note: err instanceof Error ? err.message : "Unknown error",
      });

      revalidateTag(CacheTag.jobDetail(id));
      revalidateTag(CacheTag.jobsList);
    }
  })();

  return NextResponse.json({ message: "Scraping started" });
}
