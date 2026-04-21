"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, Pencil } from "lucide-react";

const DEFAULT_START_DATE = "2026-01-29";

const STATUS_LABELS: Record<string, string> = {
  RESEARCHING: "Researching",
  RESEARCH_ERROR: "Research Error",
  PENDING_APPLICATION: "Pending Application",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

interface Metrics {
  totalApplied: number;
  uniqueCompanies: number;
  avgTimePerState: Record<string, number | null>;
  totalAppliedCount: number;
  activeInterviews: number;
  denied: number;
  jobsAppliedToday: number;
  totalNeedAction: number;
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cur <= endDay) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
}

function formatDays(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  return `${days.toFixed(1)}d`;
}

export function MetricsSection() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [editingDate, setEditingDate] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("jobSearchStartDate");
    if (saved) setStartDate(saved);
  }, []);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setStartDate(val);
    localStorage.setItem("jobSearchStartDate", val);
  }

  const today = new Date();
  const start = new Date(startDate + "T00:00:00");
  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekdays = countWeekdays(start, today);
  const avgPerDay = metrics ? (metrics.totalApplied / weekdays).toFixed(2) : null;

  const stateEntries = metrics
    ? Object.entries(metrics.avgTimePerState).filter(([, v]) => v !== null) as [string, number][]
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!metrics ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Total need action</span>
              <span className="font-medium text-right">{metrics.totalNeedAction}</span>
              <span className="text-muted-foreground">Active Interviews</span>
              <span className="font-medium text-right">{metrics.activeInterviews}</span>
              <span className="text-muted-foreground">Jobs applied today</span>
              <span className="font-medium text-right">{metrics.jobsAppliedToday}</span>
              <span className="text-muted-foreground">Positions applied</span>
              <span className="font-medium text-right">{metrics.totalApplied}</span>
              <span className="text-muted-foreground">Denied</span>
              <span className="font-medium text-right">{metrics.denied}</span>
              <span className="text-muted-foreground">Unique companies</span>
              <span className="font-medium text-right">{metrics.uniqueCompanies}</span>

              <span className="text-muted-foreground">Days since start</span>
              <span className="font-medium text-right">{daysSinceStart}</span>

              <span className="text-muted-foreground">Avg applied/day</span>
              <span className="font-medium text-right">{avgPerDay ?? "—"}</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">Search start</span>
              {editingDate ? (
                <input
                  type="date"
                  value={startDate}
                  onChange={handleDateChange}
                  onBlur={() => setEditingDate(false)}
                  autoFocus
                  className="text-sm font-medium bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <button
                  onClick={() => setEditingDate(true)}
                  className="flex items-center gap-1 font-medium text-foreground hover:text-muted-foreground transition-colors group"
                >
                  {new Date(startDate + "T00:00:00").toLocaleDateString()}
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>

            {/* {stateEntries.length > 0 && (
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Avg time per state</p>
                <div className="space-y-1">
                  {stateEntries.map(([status, days]) => (
                    <div key={status} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
                      <span className="font-medium tabular-nums">{formatDays(days)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )} */}
          </>
        )}
      </CardContent>
    </Card>
  );
}
