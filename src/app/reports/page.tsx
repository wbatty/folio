"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ArrowLeft } from "lucide-react";

interface ReportData {
  timeline: { week: string; count: number }[];
  funnel: { applied: number; interviewed: number; offered: number; denied: number };
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

function HBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden flex-1">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/reports").then((r) => r.json()),
      fetch("/api/resumes").then((r) => r.json()),
    ])
      .then(([reportData, resumeData]) => {
        setReport(reportData);
        setResumes(resumeData);
      })
      .finally(() => setLoading(false));
  }, []);

  const timelineMax = report ? Math.max(...report.timeline.map((t) => t.count), 1) : 1;
  const totalJobs = report ? Object.values(report.statusDistribution).reduce((a, b) => a + b, 0) : 0;
  const avgTimeEntries = report
    ? Object.entries(report.avgTimePerState)
        .filter(([, v]) => v > 0.05)
        .sort((a, b) => b[1] - a[1])
    : [];
  const avgTimeMax = avgTimeEntries.length > 0 ? avgTimeEntries[0][1] : 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-foreground" />
            <h1 className="text-lg font-semibold text-foreground">Folio</h1>
          </div>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Reports</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !report ? null : (
          <>
            {/* Funnel */}
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Application Funnel</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Applied", value: report.funnel.applied, sub: null, color: "text-yellow-600 dark:text-yellow-400" },
                  {
                    label: "Interviewed",
                    value: report.funnel.interviewed,
                    sub: `${pct(report.funnel.interviewed, report.funnel.applied)}% of applied`,
                    color: "text-purple-600 dark:text-purple-400",
                  },
                  {
                    label: "Offered",
                    value: report.funnel.offered,
                    sub: `${pct(report.funnel.offered, report.funnel.applied)}% of applied`,
                    color: "text-green-600 dark:text-green-400",
                  },
                  {
                    label: "Denied",
                    value: report.funnel.denied,
                    sub: `${pct(report.funnel.denied, report.funnel.applied)}% of applied`,
                    color: "text-red-600 dark:text-red-400",
                  },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-card border border-border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
                    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
                  </div>
                ))}
              </div>
            </section>

            {/* Timeline + Status Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
              {/* Timeline */}
              <section className="bg-card border border-border rounded-lg p-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-5">Applications Per Week</h2>
                <div className="flex items-end gap-1.5 h-36">
                  {report.timeline.map(({ week, count }) => (
                    <div key={week} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
                      <span className="text-xs text-muted-foreground tabular-nums">{count > 0 ? count : ""}</span>
                      <div
                        className="w-full bg-foreground/80 rounded-t-sm transition-all"
                        style={{ height: `${(count / timelineMax) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-1.5 mt-1">
                  {report.timeline.map(({ week }) => (
                    <div key={week} className="flex-1 text-center min-w-0">
                      <span className="text-[10px] text-muted-foreground truncate block">{formatWeek(week)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Status Distribution */}
              <section className="bg-card border border-border rounded-lg p-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Status Breakdown</h2>
                <div className="space-y-2.5">
                  {STATUS_ORDER.filter((s) => report.statusDistribution[s]).map((status) => {
                    const count = report.statusDistribution[status] ?? 0;
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{STATUS_LABELS[status]}</span>
                        <HBar value={count} max={totalJobs} colorClass={STATUS_BAR_COLOR[status] ?? "bg-muted-foreground"} />
                        <span className="text-xs tabular-nums w-6 text-right shrink-0">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Resume Performance */}
            {resumes.length > 0 && (
              <section className="bg-card border border-border rounded-lg p-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Resume Performance</h2>
                {resumes.every((r) => r.performance.totalJobs === 0) ? (
                  <p className="text-sm text-muted-foreground">No resume data yet — jobs need a linked resume to appear here.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="pb-2 font-medium">Resume</th>
                          <th className="pb-2 font-medium text-right">Jobs</th>
                          <th className="pb-2 font-medium text-right">Applied</th>
                          <th className="pb-2 font-medium text-right">Interview rate</th>
                          <th className="pb-2 font-medium text-right">Offer rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resumes.map((r) => {
                          const { totalJobs: total, applied, interviews, offers } = r.performance;
                          return (
                            <tr key={r.id} className="group">
                              <td className="py-2.5 pr-4 max-w-[200px]">
                                <span className="truncate block font-medium text-foreground" title={r.filename}>
                                  {r.filename}
                                </span>
                                {r.isDefault && (
                                  <span className="text-xs text-muted-foreground">default</span>
                                )}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{total}</td>
                              <td className="py-2.5 text-right tabular-nums">{applied}</td>
                              <td className="py-2.5 text-right">
                                <span className={`tabular-nums ${interviews > 0 ? "text-purple-600 dark:text-purple-400 font-medium" : "text-muted-foreground"}`}>
                                  {total > 0 ? `${pct(interviews, applied)}%` : "—"}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
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
              <section className="bg-card border border-border rounded-lg p-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Avg Time Per State</h2>
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
          </>
        )}
      </main>
    </div>
  );
}
