"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { StatusLog } from "@/components/job-detail/StatusLog";
import { NotesSection } from "@/components/job-detail/NotesSection";
import { QuestionsSection } from "@/components/job-detail/QuestionsSection";
import { ArrowLeft, ExternalLink, Loader2, Building2, MapPin } from "lucide-react";
import type { JobStatus } from "@/lib/schemas";

const ALL_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "RESEARCHING", label: "Researching" },
  { value: "PENDING_APPLICATION", label: "Pending Application" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFERED", label: "Offered" },
  { value: "DENIED", label: "Denied" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

interface StatusLogEntry {
  id: string;
  status: JobStatus;
  note: string | null;
  createdAt: string;
}

interface Question {
  id: string;
  question: string;
  context: string | null;
  response: string | null;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface Job {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  description: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
  resume: { id: string; filename: string } | null;
  statusLogs: StatusLogEntry[];
  questions: Question[];
  notes: Note[];
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setJob)
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleStatusChange(status: string) {
    if (!job) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      // Reload job to get new status log
      const updated = await fetch(`/api/jobs/${job.id}`).then((r) => r.json());
      setJob(updated);
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-slate-900 truncate">
              {job.title ?? "Unknown Position"}
            </h1>
            {job.company && (
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {job.company}
              </p>
            )}
          </div>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Open job posting"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Status & Meta */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={job.status} />
                {job.dateApplied && (
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Applied {new Date(job.dateApplied).toLocaleDateString()}
                  </span>
                )}
                {job.resume && (
                  <span className="text-xs text-slate-400">
                    Resume: {job.resume.filename}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {updatingStatus && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                <Select value={job.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                  <SelectTrigger className="w-48 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-6">
            {/* Job Description */}
            {job.description && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Job Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Questions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Application Questions ({job.questions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionsSection
                  jobId={job.id}
                  questions={job.questions}
                  onQuestionsChange={(qs) => setJob({ ...job, questions: qs })}
                />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <NotesSection
                  jobId={job.id}
                  notes={job.notes}
                  onNoteAdded={(note) => setJob({ ...job, notes: [...job.notes, note] })}
                />
              </CardContent>
            </Card>
          </div>

          {/* Status History */}
          <aside>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusLog logs={job.statusLogs} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
