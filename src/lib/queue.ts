import IORedis, { type RedisOptions } from "ioredis";
import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import { rawQueueLength } from "@/lib/ingest";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
};

const globalForRedis = globalThis as unknown as {
  bullmqConnection?: IORedis;
};

export function getRedis(): IORedis {
  if (!globalForRedis.bullmqConnection) {
    globalForRedis.bullmqConnection = new IORedis(REDIS_URL, REDIS_OPTIONS);
  }
  return globalForRedis.bullmqConnection;
}

export type ScrapeJobData = { jobId: string; chatId?: number };

const globalForQueues = globalThis as unknown as {
  scrapeQueue?: Queue<ScrapeJobData>;
};

export function getScrapeQueue(): Queue<ScrapeJobData> {
  if (!globalForQueues.scrapeQueue) {
    globalForQueues.scrapeQueue = new Queue<ScrapeJobData>("scrape", {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      },
    });
  }
  return globalForQueues.scrapeQueue;
}

export const QUEUE_STATS_CHANNEL = "queue:stats";

export interface QueueStats {
  raw: number;
  scrape: { waiting: number; active: number; delayed: number; failed: number };
  recentFailures: Array<{
    id: string;
    failedReason: string | null;
    finishedOn: number | null;
    data: { jobId?: string };
  }>;
  publishedAt: number;
}

export async function publishQueueStats(): Promise<void> {
  const [raw, counts, failedJobs] = await Promise.all([
    rawQueueLength().catch(() => 0),
    getScrapeQueue()
      .getJobCounts("waiting", "active", "delayed", "failed")
      .catch(() => ({ waiting: 0, active: 0, delayed: 0, failed: 0 })),
    getScrapeQueue().getFailed(0, 4).catch(() => []),
  ]);

  const stats: QueueStats = {
    raw,
    scrape: {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
    },
    recentFailures: failedJobs.map((j) => ({
      id: j.id ?? "",
      failedReason: j.failedReason ?? null,
      finishedOn: j.finishedOn ?? null,
      data: { jobId: (j.data as ScrapeJobData).jobId },
    })),
    publishedAt: Date.now(),
  };

  await getRedis().publish(QUEUE_STATS_CHANNEL, JSON.stringify(stats));
}

export function startScrapeWorker(
  processor: Processor<ScrapeJobData>,
  options?: Partial<WorkerOptions>
): Worker<ScrapeJobData> {
  return new Worker<ScrapeJobData>("scrape", processor, {
    connection: getRedis(),
    concurrency: Number(process.env.SCRAPE_CONCURRENCY ?? 2),
    ...options,
  });
}
