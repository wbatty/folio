"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface Funnel {
  pending: number;
  applied: number;
  deniedDirect: number;
  interviewed: number;
  postInterviewDenied: number;
  offered: number;
  postInterviewWithdrawn: number;
}

interface ReportData {
  timeline: { week: string; count: number }[];
  funnel: Funnel;
  statusDistribution: Record<string, number>;
  avgTimePerState: Record<string, number>;
}

interface ResumeItem {
  id: string;
  filename: string;
  isDefault: boolean;
  performance: { totalJobs: number; applied: number; interviews: number; offers: number };
}

const STATUS_ORDER = [
  "OFFERED",
  "INTERVIEWING",
  "APPLIED",
  "PENDING_APPLICATION",
  "RESEARCHING",
  "DENIED",
  "WITHDRAWN",
  "EXPIRED",
  "RESEARCH_ERROR",
];

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

const STATUS_LABELS_FULL: Record<string, string> = {
  OFFERED: "Offered",
  INTERVIEWING: "Interviewing",
  APPLIED: "Applied",
  PENDING_APPLICATION: "Pending Application",
  RESEARCHING: "Researching",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
  RESEARCH_ERROR: "Research Error",
};

const STATUS_BAR_COLOR: Record<string, string> = {
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

const DEFAULT_START_DATE = "2026-01-29";

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function formatWeek(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDays(days: number) {
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
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

function FunnelRow({
  label, count, of: total, colorClass, dim,
}: {
  label: string; count: number; of: number; colorClass: string; dim?: boolean;
}) {
  const width = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs w-20 shrink-0 ${dim ? "text-muted-foreground" : "text-foreground font-medium"}`}>{label}</span>
      <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
        <div
          className={`h-full rounded transition-all ${colorClass} ${dim ? "opacity-50" : ""}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-16 text-right shrink-0 text-muted-foreground">
        {count}{total > 0 ? <span className="opacity-50"> ({pct(count, total)}%)</span> : null}
      </span>
    </div>
  );
}

function HBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

async function downloadDailySummary() {
  const res = await fetch("/api/reports/daily");
  const data = await res.json();

  const date = new Date(data.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const lines: string[] = [`# Job Search Activity — ${date}`, ""];

  if (data.newJobs?.length > 0) {
    lines.push("## New Jobs Added", "");
    for (const job of data.newJobs) {
      const label = job.company ?? job.title ?? job.url;
      const title = job.title && job.company ? ` — ${job.title}` : "";
      lines.push(`- [${label}${title}](${job.url}) *(${STATUS_LABELS_FULL[job.status] ?? job.status})*`);
    }
    lines.push("");
  }

  if (data.statusLogs?.length > 0) {
    lines.push("## Status Updates", "");
    for (const log of data.statusLogs) {
      const job = log.job;
      if (!job) continue;
      const label = job.company ?? job.title ?? job.url;
      const title = job.title && job.company ? ` — ${job.title}` : "";
      const note = log.note ? ` *(${log.note})*` : "";
      lines.push(`- [${label}${title}](${job.url}): **${STATUS_LABELS_FULL[log.status] ?? log.status}**${note}`);
    }
    lines.push("");
  }

  if (data.newJobs?.length === 0 && data.statusLogs?.length === 0) {
    lines.push("*No activity recorded today.*", "");
  }

  const pipeline = data.pipeline as Record<string, number>;
  const pipelineEntries = ["OFFERED", "INTERVIEWING", "APPLIED", "PENDING_APPLICATION", "RESEARCHING"]
    .filter((s) => pipeline[s] > 0)
    .map((s) => `${STATUS_LABELS_FULL[s]}: ${pipeline[s]}`);

  if (pipelineEntries.length > 0) {
    lines.push("## Current Pipeline", "");
    for (const entry of pipelineEntries) lines.push(`- ${entry}`);
    lines.push("");
  }

  const markdown = lines.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job-search-${data.date}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [editingDate, setEditingDate] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("jobSearchStartDate");
    if (saved) setStartDate(saved);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/reports").then((r) => r.json()),
      fetch("/api/resumes").then((r) => r.json()),
      fetch("/api/metrics").then((r) => r.json()),
    ])
      .then(([reportData, resumeData, metricsData]) => {
        setReport(reportData);
        setResumes(resumeData);
        setMetrics(metricsData);
      })
      .finally(() => setLoading(false));
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

  const timelineMax = report ? Math.max(...report.timeline.map((t) => t.count), 1) : 1;
  const totalJobs = report ? Object.values(report.statusDistribution).reduce((a, b) => a + b, 0) : 0;
  const AVG_TIME_EXCLUDE = new Set(["DENIED", "EXPIRED"]);
  const avgTimeEntries = report
    ? Object.entries(report.avgTimePerState)
        .filter(([status, v]) => v > 0.05 && !AVG_TIME_EXCLUDE.has(status))
        .sort((a, b) => b[1] - a[1])
    : [];
  const avgTimeMax = avgTimeEntries.length > 0 ? avgTimeEntries[0][1] : 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold text-foreground">Reports</span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try { await downloadDailySummary(); } finally { setDownloading(false); }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Today&apos;s summary
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !report ? null : (
          <div className="space-y-6">
            {/* Overview stats — quick read, daily context */}
            {metrics && (
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
                  {[
                    { label: "Need action", value: metrics.totalNeedAction },
                    { label: "Interviewing", value: metrics.activeInterviews },
                    { label: "Applied today", value: metrics.jobsAppliedToday },
                    { label: "Companies", value: metrics.uniqueCompanies },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card px-5 py-4">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 px-1">
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium tabular-nums">{metrics.totalApplied}</span> positions applied
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium tabular-nums">{avgPerDay}</span> per day
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium tabular-nums">{daysSinceStart}</span> days
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    since{" "}
                    {editingDate ? (
                      <input
                        type="date"
                        value={startDate}
                        onChange={handleDateChange}
                        onBlur={() => setEditingDate(false)}
                        autoFocus
                        className="text-xs font-medium bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingDate(true)}
                        className="inline-flex items-center gap-0.5 font-medium text-foreground hover:text-muted-foreground transition-colors group"
                      >
                        {new Date(startDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                  </span>
                </div>
              </section>
            )}

            {/* Funnel */}
            <section className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-5">Application funnel</h2>
              <div className="space-y-1">
                <FunnelRow label="Pending" count={report.funnel.pending} of={report.funnel.pending} colorClass="bg-blue-500" />
                <FunnelRow label="Applied" count={report.funnel.applied} of={report.funnel.pending} colorClass="bg-yellow-500" />
                <div className="ml-5 space-y-1 pt-0.5">
                  <FunnelRow label="Denied" count={report.funnel.deniedDirect} of={report.funnel.applied} colorClass="bg-red-500" dim />
                  <FunnelRow label="Interviewing" count={report.funnel.interviewed} of={report.funnel.applied} colorClass="bg-purple-500" />
                  <div className="ml-5 space-y-1 pt-0.5">
                    <FunnelRow label="Denied" count={report.funnel.postInterviewDenied} of={report.funnel.interviewed} colorClass="bg-red-500" dim />
                    <FunnelRow label="Offered" count={report.funnel.offered} of={report.funnel.interviewed} colorClass="bg-green-500" />
                    <FunnelRow label="Withdrawn" count={report.funnel.postInterviewWithdrawn} of={report.funnel.interviewed} colorClass="bg-slate-400" dim />
                  </div>
                </div>
              </div>
            </section>

            {/* Timeline + Status side by side on wide, stacked on narrow */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
              <section className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-5">Applications per week</h2>
                <div className="flex items-end gap-1 h-28">
                  {report.timeline.map(({ week, count }) => (
                    <div key={week} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
                      <span className="text-[10px] text-muted-foreground tabular-nums leading-none">{count > 0 ? count : ""}</span>
                      <div
                        className="w-full bg-foreground/70 rounded-t-sm transition-all"
                        style={{ height: `${(count / timelineMax) * 100}%`, minHeight: count > 0 ? "3px" : "0" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-1 mt-2">
                  {report.timeline.map(({ week }) => (
                    <div key={week} className="flex-1 text-center min-w-0">
                      <span className="text-[9px] text-muted-foreground/70 truncate block">{formatWeek(week)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Status breakdown</h2>
                <div className="space-y-2">
                  {STATUS_ORDER.filter((s) => report.statusDistribution[s]).map((status) => {
                    const count = report.statusDistribution[status] ?? 0;
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0 truncate">{STATUS_LABELS[status]}</span>
                        <HBar value={count} max={totalJobs} colorClass={STATUS_BAR_COLOR[status] ?? "bg-muted-foreground"} />
                        <span className="text-xs tabular-nums w-5 text-right shrink-0 text-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Resume Performance */}
            {resumes.length > 0 && (
              <section className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Resume performance</h2>
                {resumes.every((r) => r.performance.totalJobs === 0) ? (
                  <p className="text-sm text-muted-foreground">No data yet — jobs need a linked resume to appear here.</p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-2 text-left text-xs text-muted-foreground font-medium">Resume</th>
                          <th className="pb-2 text-right text-xs text-muted-foreground font-medium">Jobs</th>
                          <th className="pb-2 text-right text-xs text-muted-foreground font-medium">Applied</th>
                          <th className="pb-2 text-right text-xs text-muted-foreground font-medium">Interview</th>
                          <th className="pb-2 text-right text-xs text-muted-foreground font-medium">Offer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resumes.map((r) => {
                          const { totalJobs: total, applied, interviews, offers } = r.performance;
                          return (
                            <tr key={r.id}>
                              <td className="py-2.5 pr-4 max-w-[180px]">
                                <span className="truncate block font-medium text-foreground text-xs" title={r.filename}>
                                  {r.filename}
                                </span>
                                {r.isDefault && (
                                  <span className="text-[10px] text-muted-foreground">default</span>
                                )}
                              </td>
                              <td className="py-2.5 text-right tabular-nums text-xs">{total}</td>
                              <td className="py-2.5 text-right tabular-nums text-xs">{applied}</td>
                              <td className="py-2.5 text-right text-xs">
                                <span className={`tabular-nums ${interviews > 0 ? "text-purple-600 dark:text-purple-400 font-medium" : "text-muted-foreground"}`}>
                                  {total > 0 ? `${pct(interviews, applied)}%` : "—"}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-xs">
                                <span className={`tabular-nums ${offers > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                                  {total > 0 ? `${pct(offers, applied)}%` : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Avg Time Per State */}
            {avgTimeEntries.length > 0 && (
              <section className="bg-card border border-border rounded-xl pb-12 p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Avg time per state</h2>
                <div className="space-y-2.5">
                  {avgTimeEntries.map(([status, days]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{STATUS_LABELS[status] ?? status}</span>
                      <HBar value={days} max={avgTimeMax} colorClass={STATUS_BAR_COLOR[status] ?? "bg-muted-foreground"} />
                      <span className="text-xs tabular-nums w-10 text-right shrink-0 text-foreground">{formatDays(days)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
