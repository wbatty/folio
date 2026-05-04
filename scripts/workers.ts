/**
 * Boots both ingest workers (dedupe + scrape) in one process. Use:
 *
 *   npm run workers
 *
 * For separate scaling, run scripts/dedupe-worker.ts and scripts/scrape-worker.ts
 * in separate processes instead.
 */

import { startDedupeWorker, stopDedupeWorker } from "./dedupe-worker";
import { bootScrapeWorker } from "./scrape-worker";

async function main() {
  const scrapeWorker = bootScrapeWorker();
  console.log("Scrape worker started.");

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down…`);
    stopDedupeWorker();
    await scrapeWorker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await startDedupeWorker();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
