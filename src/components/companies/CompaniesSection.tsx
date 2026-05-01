"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Clock, ChevronRight, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { AddCompanyDialog } from "./AddCompanyDialog";
import { CompanyEditDialog } from "./CompanyEditDialog";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import type { JobStatus } from "@/lib/schemas";

const ACTIVE_STATUSES = new Set<JobStatus>([
  "RESEARCHING",
  "RESEARCH_ERROR",
  "PENDING_APPLICATION",
  "APPLIED",
  "INTERVIEWING",
  "OFFERED",
]);

const STATUS_PRIORITY: Record<JobStatus, number> = {
  OFFERED: 6,
  RESEARCH_ERROR: 5,
  PENDING_APPLICATION: 4,
  RESEARCHING: 3,
  INTERVIEWING: 2,
  APPLIED: 1,
  DENIED: 0,
  WITHDRAWN: 0,
  EXPIRED: 0,
};

const ALL_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "RESEARCHING", label: "Researching" },
  { value: "PENDING_APPLICATION", label: "Pending Application" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFERED", label: "Offered" },
  { value: "DENIED", label: "Denied" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "EXPIRED", label: "Expired" },
];

interface Job {
  id: string;
  url: string;
  companyId: string | null;
  title: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface Company {
  id: string;
  name: string;
  site: string | null;
  jobListingIndex: string | null;
  lastCheckedAt: string | null;
  lastAppliedAt: string | null;
  appliedCount: number;
  deniedCount: number;
  createdAt: string;
  updatedAt: string;
}

function sortJobs(list: Job[]): Job[] {
  return [...list].sort((a, b) => {
    const pd = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
    if (pd !== 0) return pd;
    const da = a.dateApplied ?? a.createdAt;
    const db = b.dateApplied ?? b.createdAt;
    return new Date(db).getTime() - new Date(da).getTime();
  });
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|company|group|technologies|tech|solutions|systems|services|international|global)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function tokensSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return false;
  return levenshtein(a, b) <= Math.floor(maxLen / 6) + 1;
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function findPossibleDuplicates(company: Company, allCompanies: Company[]): Company[] {
  const normalized = normalizeName(company.name);
  const tokens = normalized.split(" ").filter((t) => t.length > 2);
  const siteHost = normalizeUrl(company.site);
  const listingHost = normalizeUrl(company.jobListingIndex);

  return allCompanies.filter((other) => {
    if (other.id === company.id) return false;
    const otherSiteHost = normalizeUrl(other.site);
    const otherListingHost = normalizeUrl(other.jobListingIndex);
    if (siteHost && (siteHost === otherSiteHost || siteHost === otherListingHost)) return true;
    if (listingHost && (listingHost === otherSiteHost || listingHost === otherListingHost)) return true;
    const otherNormalized = normalizeName(other.name);
    if (normalized === otherNormalized) return true;
    if (normalized.includes(otherNormalized) || otherNormalized.includes(normalized)) return true;
    const otherTokens = otherNormalized.split(" ").filter((t) => t.length > 2);
    if (tokens.length > 0 && otherTokens.length > 0) {
      const matched = new Set<number>();
      let fuzzyShared = 0;
      for (const t of tokens) {
        for (let i = 0; i < otherTokens.length; i++) {
          if (!matched.has(i) && tokensSimilar(t, otherTokens[i])) {
            fuzzyShared++;
            matched.add(i);
            break;
          }
        }
      }
      const unionSize = tokens.length + otherTokens.length - fuzzyShared;
      if (fuzzyShared / unionSize >= 0.4) return true;
    }
    return false;
  });
}

function JobRow({
  job,
  onStatusChange,
}: {
  job: Job;
  onStatusChange: (id: string, status: JobStatus) => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      onStatusChange(job.id, newStatus as JobStatus);
    } finally {
      setUpdating(false);
    }
  }

  const date = job.dateApplied ?? job.createdAt;
  const dateLabel = new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className={`flex items-center gap-3 py-2.5${job.deletedAt ? " opacity-50" : ""}`}>
      <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0 group/row">
        <PrivacyBlur>
          {job.status === "RESEARCHING" ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              Researching...
            </span>
          ) : (
            <span className="text-sm text-foreground group-hover/row:text-foreground/75 transition-colors truncate block">
              {job.title ?? new URL(job.url).hostname}
            </span>
          )}
        </PrivacyBlur>
      </Link>

      <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {updating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
        ) : (
          <Select value={job.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 w-auto border-0 shadow-none p-0 focus:ring-0">
              <StatusBadge status={job.status} />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground/50 w-14 text-right tabular-nums">{dateLabel}</span>
      </div>
    </div>
  );
}

export function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const [companiesData, jobsData]: [Company[], Job[]] = await Promise.all([
      fetch("/api/companies").then((r) => r.json()),
      fetch("/api/jobs?showDenied=true&showWithdrawn=true&showExpired=true").then((r) => r.json()),
    ]);
    setCompanies(companiesData);
    setJobs(jobsData);
    // Auto-expand companies that have active jobs
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev;
      const active = new Set(
        jobsData
          .filter((j) => ACTIVE_STATUSES.has(j.status) && j.companyId)
          .map((j) => j.companyId!)
      );
      return active;
    });
  }, []);

  useEffect(() => {
    fetchData()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchData]);

  // Poll researching jobs
  useEffect(() => {
    const researchingIds = jobs.filter((j) => j.status === "RESEARCHING").map((j) => j.id);
    if (researchingIds.length === 0) return;
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        researchingIds.map((id) => fetch(`/api/jobs/${id}`).then((r) => r.json()).catch(() => null))
      );
      setJobs((prev) =>
        prev.map((job) => {
          const u = updated.find((j) => j?.id === job.id);
          return u ? { ...job, status: u.status, title: u.title } : job;
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs]);

  const handleStatusChange = useCallback((jobId: string, status: JobStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
  }, []);

  async function handleMarkChecked(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/companies/${id}/check`, { method: "POST" });
    if (res.ok) {
      const { lastCheckedAt } = await res.json();
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, lastCheckedAt } : c)));
    }
  }

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Group jobs by companyId
  const jobsByCompany = new Map<string | null, Job[]>();
  for (const job of jobs) {
    const key = job.companyId;
    if (!jobsByCompany.has(key)) jobsByCompany.set(key, []);
    jobsByCompany.get(key)!.push(job);
  }

  // Sort: companies with active jobs first (stalest first within that group), then no-job companies
  const sortedCompanies = [...companies].sort((a, b) => {
    const aJobs = jobsByCompany.get(a.id) ?? [];
    const bJobs = jobsByCompany.get(b.id) ?? [];
    const aActive = aJobs.some((j) => ACTIVE_STATUSES.has(j.status));
    const bActive = bJobs.some((j) => ACTIVE_STATUSES.has(j.status));
    if (aActive !== bActive) return aActive ? -1 : 1;
    const da = a.lastCheckedAt ?? a.lastAppliedAt;
    const db = b.lastCheckedAt ?? b.lastAppliedAt;
    if (!da && !db) return a.name.localeCompare(b.name);
    if (!da) return -1;
    if (!db) return 1;
    return new Date(da).getTime() - new Date(db).getTime();
  });

  const ungroupedJobs = sortJobs(jobsByCompany.get(null) ?? []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <AddCompanyDialog onCreated={() => fetchData().catch(() => {})} />
      </div>

      {companies.length === 0 && ungroupedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground font-medium">No companies yet</p>
          <p className="text-muted-foreground text-sm mt-1">Add a company above to track it</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedCompanies.map((company) => {
            const companyJobs = sortJobs(jobsByCompany.get(company.id) ?? []);
            const hasJobs = companyJobs.length > 0;
            const isExpanded = expandedIds.has(company.id);
            const possibleDuplicates = findPossibleDuplicates(company, companies);
            const otherCompanies = companies
              .filter((c) => c.id !== company.id)
              .map((c) => ({ id: c.id, name: c.name }));

            return (
              <div key={company.id}>
                <div className="group rounded-xl ring-1 ring-foreground/10 bg-card hover:shadow-[0px_4px_8px_-1px_hsl(0_0%_0%/0.05)] transition-shadow">
                  {/* Header */}
                  <div
                    className={`flex items-center gap-2 px-4 py-3${hasJobs ? " cursor-pointer select-none" : ""}`}
                    onClick={hasJobs ? () => toggle(company.id) : undefined}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${
                        isExpanded ? "rotate-90" : ""
                      } ${!hasJobs ? "invisible" : ""}`}
                    />

                    <span className="font-medium text-sm text-foreground truncate">
                      <PrivacyBlur>{company.name}</PrivacyBlur>
                    </span>

                    {(company.jobListingIndex || company.site) && (
                      <a
                        href={(company.jobListingIndex ?? company.site)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                        title={company.jobListingIndex ? "Open job listings" : "Open company website"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    <div className="flex-1" />

                    {company.appliedCount > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {company.appliedCount} applied
                      </span>
                    )}
                    {company.deniedCount > 0 && (
                      <span className="text-xs text-destructive/60 tabular-nums">
                        {company.deniedCount} denied
                      </span>
                    )}

                    {company.lastCheckedAt ? (
                      <span className="text-xs text-muted-foreground">
                        checked {new Date(company.lastCheckedAt).toLocaleDateString()}
                      </span>
                    ) : company.lastAppliedAt ? (
                      <span className="text-xs text-muted-foreground/50">
                        applied {new Date(company.lastAppliedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">never checked</span>
                    )}

                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Mark checked today"
                        onClick={(e) => handleMarkChecked(company.id, e)}
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit company"
                        onClick={() => setEditingId(company.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Collapsible job rows */}
                  {isExpanded && hasJobs && (
                    <div className="border-t border-border/50 px-4 pb-1">
                      <div className="divide-y divide-border/40">
                        {companyJobs.map((job) => (
                          <JobRow key={job.id} job={job} onStatusChange={handleStatusChange} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <CompanyEditDialog
                  open={editingId === company.id}
                  onOpenChange={(v) => setEditingId(v ? company.id : null)}
                  company={company}
                  otherCompanies={otherCompanies}
                  possibleDuplicates={possibleDuplicates}
                  onSaved={() => fetchData().catch(() => {})}
                />
              </div>
            );
          })}

          {ungroupedJobs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground/50 px-1 mb-2">
                Unlinked ({ungroupedJobs.length})
              </p>
              <div className="rounded-xl ring-1 ring-foreground/10 bg-card px-4 pb-1">
                <div className="divide-y divide-border/40">
                  {ungroupedJobs.map((job) => (
                    <JobRow key={job.id} job={job} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
