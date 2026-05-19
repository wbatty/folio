import * as cheerio from "cheerio";
import { detectATS } from "@/lib/ats-detect";
import {
  fetchGreenhouse,
  JobNotFoundError,
  CHROME_HEADERS,
} from "@/lib/ats-fetch";

export type JobCheckResult = "live" | "closed" | "unknown";

// Common phrases job boards and ATS platforms show when a listing is no longer active
const CLOSED_PATTERNS = [
  /this (position|posting|job|role) (has been filled|is no longer available|has been removed|is closed)/i,
  /no longer (accepting applications|available)/i,
  /position (has been|is) (filled|closed)/i,
  /this job is no longer/i,
  /job (has been|is) (closed|removed|filled)/i,
  /sorry,?\s+this (job|position|posting)/i,
  /this (job|posting) has expired/i,
  /the (job|position|role) you.{0,20}(looking for|applied to) (is|has been)/i,
];

function looksLikeClosed(text: string): boolean {
  return CLOSED_PATTERNS.some((p) => p.test(text));
}

// ─── ATS-specific checks ──────────────────────────────────────────────────────

async function checkGreenhouse(boardToken: string, jobId: string): Promise<JobCheckResult> {
  try {
    await fetchGreenhouse(boardToken, jobId);
    return "live";
  } catch (err) {
    if (err instanceof JobNotFoundError) return "closed";
    return "unknown";
  }
}

async function checkAshby(boardHandle: string, jobId: string): Promise<JobCheckResult> {
  // Ashby returns 200 + null jobPosting for removed roles — a minimal query is sufficient
  const QUERY = `
    query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
      jobPosting(
        organizationHostedJobsPageName: $organizationHostedJobsPageName
        jobPostingId: $jobPostingId
      ) { id }
    }
  `;
  try {
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
        query: QUERY,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return "closed";
    if (!res.ok) return "unknown";
    const { data } = await res.json();
    console.log("Ashby job check response", { data });
    return data?.jobPosting ? "live" : "closed";
  } catch {
    return "unknown";
  }
}

async function checkLever(company: string, jobId: string): Promise<JobCheckResult> {
  try {
    const res = await fetch(`https://jobs.lever.co/${company}/${jobId}`, {
      headers: CHROME_HEADERS,
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (res.status === 404) return "closed";
    if (!res.ok) return "unknown";
    const html = await res.text();
    const $ = cheerio.load(html);
    // If the job headline is present the posting is active
    if ($(".posting-headline h2").length > 0) return "live";
    // Otherwise look for closed-state copy in the page body
    if (looksLikeClosed($("body").text())) return "closed";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function checkUnknown(url: string): Promise<JobCheckResult> {
  try {
    const res = await fetch(url, {
      headers: CHROME_HEADERS,
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (res.status === 404) return "closed";
    if (!res.ok) return "unknown";
    const html = await res.text();
    const $ = cheerio.load(html);
    if (looksLikeClosed($("body").text())) return "closed";
    return "live";
  } catch {
    return "unknown";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkJobStillLive(url: string): Promise<JobCheckResult> {
  const route = await detectATS(url);

  switch (route.ats) {
    case "greenhouse":
      return checkGreenhouse(route.boardToken, route.jobId);
    case "ashby":
      return checkAshby(route.boardHandle, route.jobId);
    case "lever":
      return checkLever(route.company, route.jobId);
    case "workday":
      // Workday requires Playwright + XHR intercept — too heavy for a liveness check
      return "unknown";
    default:
      return checkUnknown(url);
  }
}
