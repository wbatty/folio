import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseJob } from "@/lib/claude";
import { matchOrCreateCompanyByName } from "@/lib/company-matching";

async function resolveCompanyId(jobId: string, extractedName: string | null | undefined): Promise<string | null> {
  const { data: currentJob } = await supabase
    .from("jobs")
    .select("company_id")
    .eq("id", jobId)
    .single();

  if (currentJob?.company_id) return currentJob.company_id;

  return matchOrCreateCompanyByName(extractedName);
}

async function runExtraction(id: string, input: { url: string } | { html: string }) {
  const { data: extracted, sessionId, costUsd } = await parseJob(input);

  const companyId = await resolveCompanyId(id, extracted.company);

  // Fetch current cost to accumulate
  const { data: currentJob } = await supabase
    .from("jobs")
    .select("claude_cost_usd, company_id")
    .eq("id", id)
    .single();

  const accumulatedCost = (currentJob?.claude_cost_usd ?? 0) + costUsd;

  await supabase
    .from("jobs")
    .update({
      company_id: currentJob?.company_id ?? companyId,
      title: extracted.title,
      description: extracted.description,
      description_full: extracted.fullJobPostingHtml ?? ("html" in input ? input.html : null),
      session_id: sessionId,
      status: "PENDING_APPLICATION",
      company_website: extracted.companyWebsite ?? null,
      company_summary: extracted.companySummary ?? null,
      work_style: extracted.workStyle ?? null,
      required_skills: extracted.requiredSkills ?? null,
      preferred_skills: extracted.preferredSkills ?? null,
      primary_languages: extracted.primaryLanguages ?? null,
      frameworks: extracted.frameworks ?? null,
      role_classification: extracted.roleClassification ?? null,
      position_summary: extracted.positionSummary ?? null,
      compensation: extracted.compensation ?? null,
      benefits: extracted.benefits ?? null,
      flags: extracted.flags ?? null,
      claude_cost_usd: accumulatedCost,
    })
    .eq("id", id);

  await supabase.from("status_logs").insert({
    job_id: id,
    status: "PENDING_APPLICATION",
    note: `Research complete (cost: $${costUsd.toFixed(4)})`,
  });
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

  // If we already have the full description, re-run extraction without re-fetching
  if (job.description_full) {
    (async () => {
      try {
        await runExtraction(id, { html: job.description_full as string });
      } catch (err) {
        console.error("Extraction failed for job", id, err);
        await supabase.from("jobs").update({ status: "RESEARCH_ERROR" }).eq("id", id);
        await supabase.from("status_logs").insert({
          job_id: id,
          status: "RESEARCH_ERROR",
          note: err instanceof Error ? err.message : "Unknown error during extraction",
        });
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
    // No body / not JSON — proceed with URL-based extraction
  }

  // Reset to RESEARCHING so the UI knows work is in progress
  await supabase.from("jobs").update({ status: "RESEARCHING" }).eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "RESEARCHING",
    note: manualHtml ? "Retrying with manual HTML" : "Retrying scrape",
  });

  (async () => {
    try {
      const input = manualHtml ? { html: manualHtml } : { url: job.url as string };
      await runExtraction(id, input);
    } catch (err) {
      console.error("Scrape failed for job", id, err);
      await supabase.from("jobs").update({ status: "RESEARCH_ERROR" }).eq("id", id);
      await supabase.from("status_logs").insert({
        job_id: id,
        status: "RESEARCH_ERROR",
        note: err instanceof Error ? err.message : "Unknown error",
      });
    }
  })();

  return NextResponse.json({ message: "Scraping started" });
}
