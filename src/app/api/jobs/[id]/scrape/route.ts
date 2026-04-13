import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";
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
  // Clean HTML to markdown
  let markdown = html;
  try {
    markdown = await runDecant(html);
  } catch {
    // decant not available, strip tags and fall back to plain text
    markdown = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
  }

  await prisma.$transaction([
    prisma.job.update({
      where: { id },
      data: {
        descriptionFull: markdown,
      },
    }),
    prisma.statusLog.create({
      data: { jobId: id, status: "RESEARCHING", note: "Full description scraped" },
    }),
  ]);

  const extracted = await parseJob(markdown.slice(0, 15000));

  await prisma.$transaction([
    prisma.job.update({
      where: { id },
      data: {
        company: extracted.company,
        title: extracted.title,
        description: extracted.description,
        status: "PENDING_APPLICATION",
      },
    }),
    prisma.statusLog.create({
      data: { jobId: id, status: "PENDING_APPLICATION", note: "Research complete" },
    }),
  ]);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if(job.descriptionFull) {
    // If we already have the full description, just re-run extraction
    try {
      return NextResponse.json({ message: "Extraction started with existing description" });
    } catch (err) {
      console.error("Extraction failed for job", id, err);
      await prisma.$transaction([
        prisma.job.update({ where: { id }, data: { status: "RESEARCH_ERROR" } }),
        prisma.statusLog.create({
          data: {
            jobId: id,
            status: "RESEARCH_ERROR",
            note: err instanceof Error ? err.message : "Unknown error during extraction",
          },
        }),
      ]);
      return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
    }
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

  // Reset to RESEARCHING immediately so polling picks it up
  await prisma.$transaction([
    prisma.job.update({ where: { id }, data: { status: "RESEARCHING" } }),
    prisma.statusLog.create({
      data: {
        jobId: id,
        status: "RESEARCHING",
        note: manualHtml ? "Retrying with manual HTML" : "Retrying scrape",
      },
    }),
  ]);

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
      await prisma.$transaction([
        prisma.job.update({ where: { id }, data: { status: "RESEARCH_ERROR" } }),
        prisma.statusLog.create({
          data: {
            jobId: id,
            status: "RESEARCH_ERROR",
            note: err instanceof Error ? err.message : "Unknown error",
          },
        }),
      ]);
    }
  })();

  return NextResponse.json({ message: "Scraping started" });
}
