"use client";

import { useEffect, useState, useCallback } from "react";
import { ResumeSection } from "@/components/resume/ResumeSection";
import { JobCard } from "@/components/jobs/JobCard";
import { CsvImportButton } from "@/components/jobs/CsvImportButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Briefcase, Loader2 } from "lucide-react";
import type { JobStatus } from "@/lib/schemas";

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
  title: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export default function HomePage() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobUrl, setJobUrl] = useState("");
  const [addingJob, setAddingJob] = useState(false);
  const [addJobError, setAddJobError] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    fetch("/api/resume")
      .then((r) => r.json())
      .then(setResume)
      .catch(console.error);
  }, []);

  function refreshJobs() {
    setLoadingJobs(true);
    const url = showDeleted ? "/api/jobs?showDeleted=true" : "/api/jobs";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setJobs(data); setLoadingJobs(false); })
      .catch(() => setLoadingJobs(false));
  }

  useEffect(() => {
    refreshJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

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

  async function handleAddJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddJobError("");

    try {
      new URL(jobUrl);
    } catch {
      setAddJobError("Please enter a valid URL");
      return;
    }

    setAddingJob(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl }),
      });
      if (!res.ok) throw new Error("Failed to create job");
      const job: Job = await res.json();
      setJobs((prev) => [job, ...prev]);
      setJobUrl("");
      // Fire-and-forget scrape
      fetch(`/api/jobs/${job.id}/scrape`, { method: "POST" }).catch(console.error);
    } catch (err) {
      setAddJobError(err instanceof Error ? err.message : "Failed to add job");
    } finally {
      setAddingJob(false);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-foreground" />
            <h1 className="text-lg font-semibold text-foreground">DuckReports</h1>
          </div>
          <div className="flex items-center gap-2">
          <CsvImportButton onImportComplete={refreshJobs} />
          <form onSubmit={handleAddJob} className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <Input
                type="url"
                placeholder="Paste job posting URL..."
                value={jobUrl}
                onChange={(e) => { setJobUrl(e.target.value); setAddJobError(""); }}
                className="w-72"
                disabled={addingJob}
              />
              {addJobError && <p className="text-xs text-red-500 mt-1">{addJobError}</p>}
            </div>
            <Button type="submit" disabled={addingJob || !jobUrl}>
              {addingJob ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Job
            </Button>
          </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside>
            <ResumeSection resume={resume} onUpload={setResume} />
          </aside>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Applications ({jobs.length})
              </h2>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="accent-foreground"
                />
                Show deleted
              </label>
            </div>

            {loadingJobs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No applications yet</p>
                <p className="text-muted-foreground text-sm mt-1">Paste a job URL above to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onStatusChange={handleStatusChange}
                    deleted={!!job.deletedAt}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
