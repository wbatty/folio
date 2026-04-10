"use client";

import { useEffect, useState, useCallback } from "react";
import { ResumeSection } from "@/components/resume/ResumeSection";
import { JobCard } from "@/components/jobs/JobCard";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase } from "lucide-react";
import type { JobStatus } from "@/lib/schemas";

interface Resume {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
}

interface Job {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
}

export default function HomePage() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetch("/api/resume")
      .then((r) => r.json())
      .then(setResume)
      .catch(console.error);

    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => { setJobs(data); setLoadingJobs(false); })
      .catch(() => setLoadingJobs(false));
  }, []);

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

  async function handleAddJob(url: string) {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error("Failed to create job");
    const job: Job = await res.json();
    setJobs((prev) => [job, ...prev]);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-slate-700" />
            <h1 className="text-lg font-semibold text-slate-900">DuckReports</h1>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Job
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside>
            <ResumeSection resume={resume} onUpload={setResume} />
          </aside>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Applications ({jobs.length})
              </h2>
            </div>

            {loadingJobs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-slate-200 animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Briefcase className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No applications yet</p>
                <p className="text-slate-400 text-sm mt-1">Click &quot;Add Job&quot; to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onStatusChange={handleStatusChange} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <AddJobDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddJob}
      />
    </div>
  );
}
