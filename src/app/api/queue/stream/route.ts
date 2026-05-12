import IORedis from "ioredis";
import { QUEUE_STATS_CHANNEL, publishQueueStats } from "@/lib/queue";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sub = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // client disconnected
        }
      };

      sub.on("message", (_, message) => send(message));
      await sub.subscribe(QUEUE_STATS_CHANNEL);

      // Push current stats immediately so the client isn't blank on connect
      publishQueueStats().catch(() => {});

      return () => {
        sub.unsubscribe(QUEUE_STATS_CHANNEL);
        sub.quit();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
