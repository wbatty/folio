"use client";

import { useEffect, useState } from "react";
import type { QueueStats } from "@/lib/queue";

async function retryJob(jobId: string): Promise<void> {
  await fetch(`/api/jobs/${jobId}/scrape`, { method: "POST" });
}

function relativeTime(ms: number | null): string {
  if (!ms) return "";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function QueueMonitor() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/queue/stream");
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as QueueStats;
        setStats(data);
        setConnected(true);
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  if (!stats) {
    return (
      <div className="mb-5 h-7 rounded-md bg-muted animate-pulse" />
    );
  }

  const { raw, scrape, recentFailures } = stats;
  const totalPending = raw + scrape.waiting + scrape.active + scrape.delayed;

  let statusColor: string;
  let statusLabel: string;
  if (scrape.active > 0) {
    statusColor = "bg-green-500";
    statusLabel = "Processing";
  } else if (totalPending > 0) {
    statusColor = "bg-amber-400";
    statusLabel = "Backlogged";
  } else {
    statusColor = "bg-muted-foreground/30";
    statusLabel = "Idle";
  }

  return (
    <div className="mb-5 text-xs text-muted-foreground">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Worker status */}
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
          {statusLabel}
        </span>

        <span className="text-border">·</span>

        {/* Queue breakdown */}
        <span>Ingest <span className="text-foreground font-medium">{raw}</span></span>
        <span className="text-border">·</span>
        <span>Waiting <span className="text-foreground font-medium">{scrape.waiting}</span></span>
        <span className="text-border">·</span>
        <span>Active <span className="text-foreground font-medium">{scrape.active}</span></span>
        <span className="text-border">·</span>
        <span>Delayed <span className="text-foreground font-medium">{scrape.delayed}</span></span>

        {/* Failures toggle */}
        {scrape.failed > 0 && (
          <>
            <span className="text-border">·</span>
            <button
              onClick={() => setFailuresOpen((v) => !v)}
              className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors"
            >
              <span>⚠ {scrape.failed} failed</span>
              <span className="text-[10px]">{failuresOpen ? "▲" : "▾"}</span>
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Connection indicator */}
        <span className={`flex items-center gap-1 ${connected ? "text-muted-foreground/50" : "text-destructive"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-muted-foreground/40" : "bg-destructive"}`} />
          {connected ? "live" : "disconnected"}
        </span>
      </div>

      {/* Failure rows */}
      {failuresOpen && recentFailures.length > 0 && (
        <div className="mt-2 space-y-1 pl-3 border-l border-destructive/30">
          {recentFailures.map((f) => {
            const dbJobId = f.data.jobId;
            const isRetrying = dbJobId ? retrying.has(dbJobId) : false;
            return (
              <div key={f.id} className="flex items-start gap-2">
                <span className="text-destructive/70 shrink-0">{dbJobId ? dbJobId.slice(0, 8) : f.id.slice(0, 8)}</span>
                <span className="truncate text-muted-foreground flex-1">{f.failedReason ?? "Unknown error"}</span>
                <span className="shrink-0 text-muted-foreground/50">{relativeTime(f.finishedOn)}</span>
                {dbJobId && (
                  <button
                    disabled={isRetrying}
                    onClick={async () => {
                      setRetrying((prev) => new Set(prev).add(dbJobId));
                      try {
                        await retryJob(dbJobId);
                      } finally {
                        setRetrying((prev) => {
                          const next = new Set(prev);
                          next.delete(dbJobId);
                          return next;
                        });
                      }
                    }}
                    className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
                    title="Retry"
                  >
                    {isRetrying ? "↻" : "↺"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
