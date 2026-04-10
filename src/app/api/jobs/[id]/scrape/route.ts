import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/claude";
import { JobExtractionSchema } from "@/lib/schemas";

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Kick off async without blocking the response
  (async () => {
    try {
      // 1. Fetch fully-rendered HTML via Playwright
      const browser = await chromium.launch({ headless: true });
      let html: string;
      try {
        const page = await browser.newPage();
        await page.goto(job.url, { waitUntil: "networkidle", timeout: 30000 });
        html = await page.content();
      } finally {
        await browser.close();
      }

      // 2. Run through decant to get clean markdown
      let markdown = html;
      try {
        markdown = await runDecant(html);
      } catch {
        // decant not available, fall back to raw HTML (Claude handles it)
        markdown = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
      }

      // Truncate to avoid token limits
      const truncated = markdown.slice(0, 15000);

      // 3. Extract structured data with Claude
      const extraction = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Extract the company name, job title, and a concise job description from the following content. Return ONLY valid JSON with exactly these keys: {"company": "...", "title": "...", "description": "..."}. No markdown, no explanation.\n\n${truncated}`,
          },
        ],
      });

      const rawText = extraction.content[0].type === "text" ? extraction.content[0].text.trim() : "{}";
      // Strip potential markdown code fences
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const extracted = JobExtractionSchema.parse(JSON.parse(jsonText));

      // 4. Update job record
      await prisma.job.update({
        where: { id },
        data: {
          company: extracted.company,
          title: extracted.title,
          description: extracted.description,
          status: "PENDING_APPLICATION",
        },
      });

      // 5. Log status transition
      await prisma.statusLog.create({
        data: {
          jobId: id,
          status: "PENDING_APPLICATION",
          note: "Research complete",
        },
      });
    } catch (err) {
      console.error("Scrape failed for job", id, err);
      // Leave job in RESEARCHING so the user can retry
    }
  })();

  return NextResponse.json({ message: "Scraping started" });
}
