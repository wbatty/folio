"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  OFFERED: "Offered",
  INTERVIEWING: "Interviewing",
  APPLIED: "Applied",
  PENDING_APPLICATION: "Pending",
  RESEARCHING: "Researching",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
  RESEARCH_ERROR: "Error",
};

const STATUS_DOT: Record<string, string> = {
  OFFERED: "bg-green-500",
  INTERVIEWING: "bg-purple-500",
  APPLIED: "bg-yellow-500",
  PENDING_APPLICATION: "bg-blue-500",
  RESEARCHING: "bg-slate-400",
  DENIED: "bg-red-500",
  WITHDRAWN: "bg-slate-300",
  EXPIRED: "bg-orange-400",
  RESEARCH_ERROR: "bg-orange-500",
};

interface StatusLogEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface NoteEntry {
  id: string;
  content: string;
  createdAt: string;
}

interface JobActivity {
  id: string;
  url: string;
  title: string | null;
  status: string;
  company: string | null;
  appliedAt: string;
  statusLogs: StatusLogEntry[];
  notes: NoteEntry[];
}

interface SummaryData {
  start: string;
  end: string;
  jobs: JobActivity[];
  totalJobs: number;
  totalDays: number;
  totalStatusLogs: number;
  totalNotes: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateHeading(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function appliedDateKey(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function getDefaultRange() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 13);
  return { start: start.toISOString().slice(0, 10), end };
}

export default function UIBenefitsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = getDefaultRange();

  const [startDate, setStartDate] = useState(() => searchParams.get("start") ?? defaults.start);
  const [endDate, setEndDate] = useState(() => searchParams.get("end") ?? defaults.end);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (start: string, end: string) => {
    router.replace(`/ui-benefits?start=${start}&end=${end}`, { scroll: false });
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/ui-summary?start=${start}&end=${end}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load(startDate, endDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleApply() {
    load(startDate, endDate);
  }

  const jobCount = data?.jobs.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-3.5 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/reports" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold text-foreground">UI Benefits Summary</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Date range controls */}
        <section className="bg-card border border-border rounded-xl p-5 mb-6 print:hidden">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Date range</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button size="sm" onClick={handleApply} disabled={loading}>
              {loading ? "Loading…" : "Apply"}
            </Button>
            {/* Quick presets */}
            <div className="flex gap-2 ml-auto">
              {[
                { label: "This week", offset: 0 },
                { label: "Last week", offset: 1 },
              ].map(({ label, offset }) => (
                <button
                  key={label}
                  onClick={() => {
                    const today = new Date();
                    // Find Sunday of the current week, then shift back by offset weeks
                    const sunday = new Date(today);
                    sunday.setDate(today.getDate() - today.getDay() - offset * 7);
                    const saturday = new Date(sunday);
                    saturday.setDate(sunday.getDate() + 6);
                    const start = sunday.toISOString().slice(0, 10);
                    const end = saturday.toISOString().slice(0, 10);
                    setStartDate(start);
                    setEndDate(end);
                    load(start, end);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Print header — only shows on print */}
            <div className="hidden print:block mb-6">
              <h1 className="text-xl font-bold">Job Search Activity — UI Benefits</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(data.start + "T12:00:00")} – {formatDate(data.end + "T12:00:00")}
              </p>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-4 gap-px bg-border rounded-xl overflow-hidden mb-6">
              {[
                { label: "Positions applied", value: data.totalJobs ?? jobCount },
                { label: "Days applied", value: data.totalDays },
                { label: "Status changes", value: data.totalStatusLogs },
                { label: "Notes added", value: data.totalNotes },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* Period label */}
            <p className="text-xs text-muted-foreground mb-4 print:hidden">
              Showing activity from{" "}
              <span className="text-foreground font-medium">{formatDate(data.start + "T12:00:00")}</span>
              {" "}to{" "}
              <span className="text-foreground font-medium">{formatDate(data.end + "T12:00:00")}</span>
            </p>

            {jobCount === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No positions applied in this date range.</p>
              </div>
            ) : (() => {
              // Group jobs by applied date (most recent first)
              const dayGroups: { dateKey: string; jobs: JobActivity[] }[] = [];
              for (const job of data.jobs) {
                const key = appliedDateKey(job.appliedAt);
                const existing = dayGroups.find((g) => g.dateKey === key);
                if (existing) {
                  existing.jobs.push(job);
                } else {
                  dayGroups.push({ dateKey: key, jobs: [job] });
                }
              }

              type Event =
                | { kind: "status"; entry: StatusLogEntry }
                | { kind: "note"; entry: NoteEntry };

              return (
                <div className="space-y-8">
                  {dayGroups.map(({ dateKey, jobs: dayJobs }) => (
                    <section key={dateKey}>
                      <h2 className="text-lg font-bold text-foreground mb-3 pb-2 border-b border-border">
                        {formatDateHeading(dateKey + "T12:00:00")}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {dayJobs.length} {dayJobs.length === 1 ? "position" : "positions"}
                        </span>
                      </h2>
                      <div className="space-y-3">
                        {dayJobs.map((job) => {
                          const displayName = job.company ?? job.title ?? job.url;
                          const subtitle = job.company && job.title ? job.title : null;

                          const events: Event[] = [
                            ...job.statusLogs.map((l) => ({ kind: "status" as const, entry: l })),
                            ...job.notes.map((n) => ({ kind: "note" as const, entry: n })),
                          ].sort((a, b) => new Date(a.entry.createdAt).getTime() - new Date(b.entry.createdAt).getTime());

                          return (
                            <div key={job.id} className="bg-card border border-border rounded-xl p-5">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-base font-semibold text-foreground">{displayName}</span>
                                    {subtitle && (
                                      <span className="text-sm text-muted-foreground">{subtitle}</span>
                                    )}
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[job.status] ?? "bg-muted-foreground"}`} />
                                    <span className="text-xs text-muted-foreground">{STATUS_LABELS[job.status] ?? job.status}</span>
                                  </div>
                                  <a
                                    href={job.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 mt-0.5 print:text-foreground truncate max-w-xs"
                                  >
                                    {job.url}
                                    <ExternalLink className="h-2.5 w-2.5 shrink-0 print:hidden" />
                                  </a>
                                </div>
                                <Link
                                  href={`/jobs/${job.id}`}
                                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors shrink-0 print:hidden"
                                >
                                  View
                                </Link>
                              </div>

                              <div className="space-y-1.5 pl-3 border-l border-border">
                                {events.map((ev) => (
                                  <div key={ev.entry.id} className="flex gap-3 items-start">
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 pt-0.5 w-32">
                                      {formatDateTime(ev.entry.createdAt)}
                                    </span>
                                    {ev.kind === "status" ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[ev.entry.status] ?? "bg-muted-foreground"}`} />
                                        <span className="text-xs font-medium text-foreground">
                                          {STATUS_LABELS[ev.entry.status] ?? ev.entry.status}
                                        </span>
                                        {ev.entry.note && (
                                          <span className="text-xs text-muted-foreground">— {ev.entry.note}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic">{ev.entry.content}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
