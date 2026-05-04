import { NextResponse } from "next/server";
import { rawQueueLength } from "@/lib/ingest";
import { getScrapeQueue } from "@/lib/queue";

export async function GET() {
  try {
    const [raw, scrapeCounts] = await Promise.all([
      rawQueueLength().catch((err) => {
        console.error("pgmq metrics error:", err);
        return 0;
      }),
      getScrapeQueue()
        .getJobCounts("waiting", "active", "delayed")
        .catch((err) => {
          console.error("BullMQ counts error:", err);
          return { waiting: 0, active: 0, delayed: 0 };
        }),
    ]);

    const scrape = (scrapeCounts.waiting ?? 0) + (scrapeCounts.active ?? 0) + (scrapeCounts.delayed ?? 0);
    return NextResponse.json({ count: raw + scrape, raw, scrape });
  } catch (err) {
    console.error("Queue count error:", err);
    return NextResponse.json({ count: 0, raw: 0, scrape: 0 });
  }
}
