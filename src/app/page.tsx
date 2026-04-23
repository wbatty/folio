"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ResumeSection } from "@/components/resume/ResumeSection";
import { MetricsSection } from "@/components/jobs/MetricsSection";
import { CompaniesSection } from "@/components/companies/CompaniesSection";
import { JobCard } from "@/components/jobs/JobCard";
import { CsvImportButton } from "@/components/jobs/CsvImportButton";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Briefcase, ChevronRight, Inbox, Loader2, MoreHorizontal, Upload, Eye, EyeOff, X } from "lucide-react";
import type { JobStatus } from "@/lib/schemas";
import { usePrivacy } from "@/lib/privacy-context";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Resume {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
  hasPdf: boolean;
}

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

export default function HomePage() {
  const { privacyMode, togglePrivacy } = usePrivacy();
  const [resume, setResume] = useState<Resume | null>(null);
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
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [runningConsumer, setRunningConsumer] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/resume")
      .then((r) => r.json())
      .then(setResume)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/queue")
      .then((r) => r.json())
      .then((d) => setQueueCount(d.count))
      .catch(console.error);
  }, []);

  async function handleRunConsumer() {
    setRunningConsumer(true);
    try {
      await fetch("/api/queue", { method: "POST" });
      const d = await fetch("/api/queue").then((r) => r.json());
      setQueueCount(d.count);
      refreshJobs();
    } finally {
      setRunningConsumer(false);
    }
  }

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

  // Poll researching jobs every 3s
  useEffect(() => {
    const researchingIds = jobs.filter((j) => j.status === "RESEARCHING").map((j) => j.id);
    if (researchingIds.length === 0) return;

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        researchingIds.map((id) =>
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
  }, [jobs]);

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
    if (!res.ok) throw new Error("Failed to create job");
    const job: Job = await res.json();
    setJobs((prev) => [job, ...prev]);
    setJobUrl("");
    // Fire-and-forget scrape
    fetch(`/api/jobs/${job.id}/scrape`, { method: "POST" }).catch(console.error);
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

  const filteredJobs = companySearch.trim()
    ? jobs.filter((j) => j.company?.toLowerCase().includes(companySearch.toLowerCase()))
    : jobs;

  const activeJobs = sortJobs(filteredJobs.filter((j) => !isArchived(j)));
  const archivedJobs = sortJobs(filteredJobs.filter(isArchived));
  const visibleJobs = [...activeJobs, ...archivedJobs];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-foreground" />
            <h1 className="text-lg font-semibold text-foreground">Folio</h1>
          </div>
          <div className="flex items-center gap-2">
          
          <form onSubmit={handleAddJob} className="flex items-center gap-2">
            <Input
              type="url"
              placeholder="Paste job posting URL..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              className="w-72"
            />
            <Button type="submit" disabled={!jobUrl}>
              <Plus className="h-4 w-4" />
              Add Job
            </Button>
          </form><CsvImportButton onImportComplete={refreshJobs} triggerRef={csvFileRef} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
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
              <DropdownMenuItem onClick={handleRunConsumer} disabled={runningConsumer}>
                {runningConsumer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
                Queue{queueCount !== null ? ` (${queueCount})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {queueCount !== null && <Badge variant="outline">{queueCount}</Badge>}
          <AddJobDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            initialUrl={jobUrl}
            onAdd={handleDialogAdd}
          />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside className="space-y-6">
            {!privacyMode && <MetricsSection />}
            <ResumeSection resume={resume} onUpload={setResume} />
          </aside>

          <Tabs defaultValue="applications">
            <TabsList variant="line">
              <TabsTrigger variant="line" value="applications">
                Applications ({visibleJobs.length})
              </TabsTrigger>
              <TabsTrigger variant="line" value="companies">
                Companies
              </TabsTrigger>
            </TabsList>

            <TabsContent value="applications">
              <div className="flex items-center justify-between mb-4 gap-4">
                <div className="relative w-full max-w-sm">
                <Input
                  type="text"
                  placeholder="Filter by company…"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-40 h-7 text-sm"
                />
                {companySearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCompanySearch("")}
                    style={{
                      position: 'relative',
                      top:'4px',
                      marginLeft: '4px',
                    }}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {(["denied", "withdrawn", "expired", "deleted"] as const).map((key) => {
                    const checked = key === "denied" ? showDenied : key === "withdrawn" ? showWithdrawn : key === "expired" ? showExpired : showDeleted;
                    const setter = key === "denied" ? setShowDenied : key === "withdrawn" ? setShowWithdrawn : key === "expired" ? setShowExpired : setShowDeleted;
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setter(e.target.checked)}
                          className="accent-foreground"
                        />
                        Show {key}
                      </label>
                    );
                  })}
                </div>
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
                </div>
              )}
            </TabsContent>

            <TabsContent value="companies">
              <CompaniesSection />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
