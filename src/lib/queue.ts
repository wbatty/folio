import IORedis, { type RedisOptions } from "ioredis";
import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";

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
