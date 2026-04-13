import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { chromium } from "playwright";
import { supabase } from "@/lib/supabase";
import { parseJob } from "@/lib/claude";

async function runDecant(html: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("decant", ["clean"], { env: { ...process.env, PATH: process.env.PATH + ":/usr/local/bin:/home/root/.local/bin" } });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`decant exited ${code}: ${err}`));
    });
    proc.on("error", reject);
    proc.stdin.write(html);
    proc.stdin.end();
  });
}

async function extractAndUpdate(id: string, html: string) {
  // 1. Clean HTML to markdown
  let markdown = html;
  try {
    markdown = await runDecant(html);
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

  // 3. Extract structured data via Claude Agent SDK
  const extracted = await parseJob(markdown.slice(0, 15000));

  // 4. Update job with structured fields and advance status
  await supabase
    .from("jobs")
    .update({
      company: extracted.company,
      title: extracted.title,
      description: extracted.description,
      status: "PENDING_APPLICATION",
    })
    .eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "PENDING_APPLICATION",
    note: "Research complete",
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, url, description_full")
    .eq("id", id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // If we already have the full description, re-run extraction without re-scraping
  if (job.description_full) {
    (async () => {
      try {
        const extracted = await parseJob((job.description_full as string).slice(0, 15000));
        await supabase
          .from("jobs")
          .update({
            company: extracted.company,
            title: extracted.title,
            description: extracted.description,
            status: "PENDING_APPLICATION",
          })
          .eq("id", id);
        await supabase.from("status_logs").insert({
          job_id: id,
          status: "PENDING_APPLICATION",
          note: "Research complete",
        });
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
    // No body / not JSON — proceed with scrape
  }

  // Reset to RESEARCHING so the UI knows work is in progress
  await supabase.from("jobs").update({ status: "RESEARCHING" }).eq("id", id);
  await supabase.from("status_logs").insert({
    job_id: id,
    status: "RESEARCHING",
    note: manualHtml ? "Retrying with manual HTML" : "Retrying scrape",
  });

  // Kick off async without blocking the response
  (async () => {
    try {
      let html: string;

      if (manualHtml) {
        html = manualHtml;
      } else {
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          await page.goto(job.url, { waitUntil: "networkidle", timeout: 30000 });
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
    }
  })();

  return NextResponse.json({ message: "Scraping started" });
}
