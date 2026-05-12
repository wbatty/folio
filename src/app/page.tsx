"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ResumeSection, type ResumeListItem } from "@/components/resume/ResumeSection";
import { CompaniesSection } from "@/components/companies/CompaniesSection";
import { JobCard } from "@/components/jobs/JobCard";
import { CsvImportButton } from "@/components/jobs/CsvImportButton";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Briefcase, ChevronRight, Inbox, MoreHorizontal, Upload, Eye, EyeOff, X, SlidersHorizontal, Check } from "lucide-react";
import { QueueMonitor } from "@/components/ui/queue-monitor";
import Link from "next/link";
import type { JobStatus } from "@/lib/schemas";
import { usePrivacy } from "@/lib/privacy-context";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type MainTab = "companies" | "need-action" | "interviewing" | "applied-today" | "applications" | "resumes";
const APP_TABS = new Set<MainTab>(["need-action", "interviewing", "applied-today", "applications"]);

interface Job {
  id: string;
  url: string;
  company: string | null;
  companyId: string | null;
  title: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

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

function sortJobs(list: Job[]): Job[] {
  return [...list].sort((a, b) => {
    const pd = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
    if (pd !== 0) return pd;
    const da = a.dateApplied ?? a.createdAt;
    const db = b.dateApplied ?? b.createdAt;
    return new Date(db).getTime() - new Date(da).getTime();
  });
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function isArchived(job: Job): boolean {
  return job.status === "APPLIED" && Date.now() - new Date(job.dateApplied || job.updatedAt).getTime() > TWO_WEEKS_MS;
}

function applyTabFilter(jobs: Job[], tab: MainTab): Job[] {
  const today = new Date().toISOString().slice(0, 10);
  if (tab === "need-action") return jobs.filter((j) => j.status === "PENDING_APPLICATION" || j.status === "RESEARCH_ERROR");
  if (tab === "interviewing") return jobs.filter((j) => j.status === "INTERVIEWING");
  if (tab === "applied-today") return jobs.filter((j) => j.dateApplied?.startsWith(today));
  return jobs;
}

const VALID_TABS = new Set<string>(["companies", "need-action", "interviewing", "applied-today", "applications", "resumes"]);

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
const { privacyMode, togglePrivacy } = usePrivacy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobUrl, setJobUrl] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showDenied, setShowDenied] = useState(false);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [companyHiddenJobs, setCompanyHiddenJobs] = useState<Job[]>([]);
  const [showCompanyHidden, setShowCompanyHidden] = useState(false);
  const rawTab = searchParams.get("tab") ?? "companies";
  const activeTab: MainTab = VALID_TABS.has(rawTab) ? (rawTab as MainTab) : "companies";
  const csvFileRef = useRef<HTMLInputElement>(null);

  function setActiveTab(tab: MainTab) {
    router.replace(`/?tab=${tab}`, { scroll: false });
  }

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then(setResumes)
      .catch(console.error);
  }, []);

  function refreshJobs() {
    setLoadingJobs(true);
    const params = new URLSearchParams();
    if (showDeleted) params.set("showDeleted", "true");
    if (showDenied) params.set("showDenied", "true");
    if (showWithdrawn) params.set("showWithdrawn", "true");
    if (showExpired) params.set("showExpired", "true");
    const url = `/api/jobs${params.size ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setJobs(data); setLoadingJobs(false); })
      .catch(() => setLoadingJobs(false));
  }

  useEffect(() => {
    refreshJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted, showDenied, showWithdrawn, showExpired]);

  useEffect(() => {
    const company = companySearch.trim().toLowerCase();
    if (!company) {
      setCompanyHiddenJobs([]);
      setShowCompanyHidden(false);
      return;
    }
    const HIDDEN_STATUSES = new Set(["DENIED", "WITHDRAWN", "EXPIRED"]);
    fetch("/api/jobs?showDeleted=true&showDenied=true&showWithdrawn=true&showExpired=true")
      .then((r) => r.json())
      .then((allJobs: Job[]) => {
        setCompanyHiddenJobs(
          allJobs.filter(
            (j) =>
              j.company?.toLowerCase().includes(company) &&
              (HIDDEN_STATUSES.has(j.status) || !!j.deletedAt)
          )
        );
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySearch]);

  // Poll researching jobs every 3s — keyed on the sorted id list so the interval
  // only restarts when the set of RESEARCHING jobs actually changes, not on every setJobs call.
  const researchingKey = jobs
    .filter((j) => j.status === "RESEARCHING")
    .map((j) => j.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!researchingKey) return;
    const ids = researchingKey.split(",");
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        ids.map((id) =>
          fetch(`/api/jobs/${id}`).then((r) => r.json()).catch(() => null)
        )
      );
      setJobs((prev) =>
        prev.map((job) => {
          const u = updated.find((j) => j?.id === job.id);
          return u ?? job;
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchingKey]);

  function handleAddJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDialogOpen(true);
  }

  async function handleDialogAdd(url: string, company: string, title: string) {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, company: company || undefined, title: title || undefined }),
    });
    if (!res.ok) throw new Error("Failed to queue job");
    setJobUrl("");
    setTimeout(refreshJobs, 1500);
  }

  const handleStatusChange = useCallback(async (jobId: string, status: JobStatus) => {
    const res = await fetch(`/api/jobs/${jobId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update status");
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const needActionCount = jobs.filter((j) => j.status === "PENDING_APPLICATION" || j.status === "RESEARCH_ERROR").length;
  const interviewingCount = jobs.filter((j) => j.status === "INTERVIEWING").length;
  const appliedTodayCount = jobs.filter((j) => j.dateApplied?.startsWith(today)).length;

  const companyFiltered = companySearch.trim()
    ? jobs.filter((j) => j.company?.toLowerCase().includes(companySearch.toLowerCase()))
    : jobs;
  const filteredJobs = APP_TABS.has(activeTab) ? applyTabFilter(companyFiltered, activeTab) : companyFiltered;

  const isFiltered = activeTab !== "applications";
  const activeJobs = sortJobs(filteredJobs.filter((j) => !isArchived(j)));
  const archivedJobs = isFiltered ? [] : sortJobs(filteredJobs.filter(isArchived));
  const visibleJobs = [...activeJobs, ...archivedJobs];

  const filteredJobIds = new Set(filteredJobs.map((j) => j.id));
  const inactiveJobs = sortJobs(companyHiddenJobs.filter((j) => !filteredJobIds.has(j.id)));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-foreground" />
            <h1 className="text-sm font-semibold text-foreground">Folio</h1>
          </div>
          <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Reports
          </Link>
          <div className="flex-1" />
          <CsvImportButton onImportComplete={refreshJobs} triggerRef={csvFileRef} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={togglePrivacy}>
                {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => csvFileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="opacity-100">
                <Inbox className="h-4 w-4" />
                Queue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AddJobDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            initialUrl={jobUrl}
            onAdd={handleDialogAdd}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        {/* Queue / worker monitor */}
        <div className="pt-5">
          <QueueMonitor />
        </div>

        {/* Add job — given its own focused zone between header and tabs */}
        <div className="pb-5">
          <form onSubmit={handleAddJob} className="flex gap-2">
            <Input
              type="url"
              placeholder="Paste a job posting URL..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!jobUrl}>
              <Plus className="h-4 w-4" />
              Add Job
            </Button>
          </form>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MainTab)}>
          <TabsList variant="line">
            <TabsTrigger variant="line" value="companies">Companies</TabsTrigger>
            <TabsTrigger variant="line" value="need-action" className="gap-1.5">
              Need action
              {needActionCount > 0 && <span className="text-xs font-semibold tabular-nums text-amber-500">{needActionCount}</span>}
            </TabsTrigger>
            <TabsTrigger variant="line" value="interviewing" className="gap-1.5">
              Interviewing
              {interviewingCount > 0 && <span className="text-xs tabular-nums text-muted-foreground">{interviewingCount}</span>}
            </TabsTrigger>
            <TabsTrigger variant="line" value="applied-today" className="gap-1.5">
              Applied today
              {appliedTodayCount > 0 && <span className="text-xs tabular-nums text-muted-foreground">{appliedTodayCount}</span>}
            </TabsTrigger>
            <TabsTrigger variant="line" value="applications" className="gap-1.5">
              All
              <span className="text-xs tabular-nums text-muted-foreground">{jobs.length}</span>
            </TabsTrigger>
            <TabsTrigger variant="line" value="resumes">Resumes</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <div className="pt-4 pb-12">
              <CompaniesSection />
            </div>
          </TabsContent>

          {APP_TABS.has(activeTab) && (
            <div className="pt-4 pb-12">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    placeholder="Filter by company..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="h-7 w-44 text-sm"
                  />
                  {companySearch && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCompanySearch("")}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-sm">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filters
                      {[showDenied, showWithdrawn, showExpired, showDeleted].filter(Boolean).length > 0 && (
                        <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-xs leading-none">
                          {[showDenied, showWithdrawn, showExpired, showDeleted].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {([
                      ["Denied", showDenied, setShowDenied],
                      ["Withdrawn", showWithdrawn, setShowWithdrawn],
                      ["Expired", showExpired, setShowExpired],
                      ["Deleted", showDeleted, setShowDeleted],
                    ] as [string, boolean, (v: boolean) => void][]).map(([label, active, setter]) => (
                      <DropdownMenuItem
                        key={label}
                        onSelect={(e) => { e.preventDefault(); setter(!active); }}
                        className="gap-2"
                      >
                        <span className="flex h-4 w-4 items-center justify-center">
                          {active && <Check className="h-3.5 w-3.5" />}
                        </span>
                        Show {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {loadingJobs ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : visibleJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No applications yet</p>
                  <p className="text-muted-foreground text-sm mt-1">Paste a job URL above to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onStatusChange={handleStatusChange}
                      deleted={!!job.deletedAt}
                    />
                  ))}
                  {archivedJobs.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowArchived((v) => !v)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors select-none w-full py-1"
                      >
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showArchived ? "rotate-90" : ""}`} />
                        Archived ({archivedJobs.length})
                      </button>
                      {showArchived && (
                        <div className="space-y-3 mt-2">
                          {archivedJobs.map((job) => (
                            <JobCard
                              key={job.id}
                              job={job}
                              onStatusChange={handleStatusChange}
                              deleted={!!job.deletedAt}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {inactiveJobs.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowCompanyHidden((v) => !v)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors select-none w-full py-1"
                      >
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showCompanyHidden ? "rotate-90" : ""}`} />
                        Inactive ({inactiveJobs.length})
                      </button>
                      {showCompanyHidden && (
                        <div className="space-y-3 mt-2">
                          {inactiveJobs.map((job) => (
                            <JobCard
                              key={job.id}
                              job={job}
                              onStatusChange={handleStatusChange}
                              deleted={!!job.deletedAt}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <TabsContent value="resumes">
            <div className="pt-4 pb-12">
              <ResumeSection resumes={resumes} onResumesChange={setResumes} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
