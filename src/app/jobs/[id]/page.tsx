"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { StatusLog } from "@/components/job-detail/StatusLog";
import { NotesSection } from "@/components/job-detail/NotesSection";
import { QuestionsSection } from "@/components/job-detail/QuestionsSection";
import { DuplicateJobs } from "@/components/job-detail/DuplicateJobs";
import { ArrowLeft, ExternalLink, Loader2, Building2, MapPin, Trash2, AlertTriangle, RefreshCw, Copy } from "lucide-react";
import { PrivacyToggle } from "@/components/ui/privacy-toggle";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import type { JobStatus } from "@/lib/schemas";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Markdown from 'react-markdown'
import DeleteJob from "@/components/job-detail/DeleteJob";
import { EditJobDialog } from "@/components/job-detail/EditJobDialog";

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

interface ResumeOption {
  id: string;
  filename: string;
  createdAt: string;
  isDefault: boolean;
}

interface Job {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  description: string | null;
  descriptionFull: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
  resume: { id: string; filename: string } | null;
  sessionId: string | null;
  statusLogs: StatusLogEntry[];
  questions: Question[];
  notes: Note[];
  duplicates?: { id: string; company: string; title: string; status: JobStatus }[];
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [manualHtml, setManualHtml] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [resumeOptions, setResumeOptions] = useState<ResumeOption[]>([]);
  const [updatingResume, setUpdatingResume] = useState(false);

  const fetchJob = useCallback(() => {
    setLoading(true);
    fetch(`/api/jobs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setJob)
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((data: ResumeOption[]) => setResumeOptions(data))
      .catch(console.error);
  }, []);

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
      const updated = await fetch(`/api/jobs/${job.id}`).then((r) => r.json());
      setJob(updated);
    } finally {
      setUpdatingStatus(false);
    }
  }

  // async function handleDelete() {
  //   if (!job) return;
  //   setDeleting(true);
  //   try {
  //     const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
  //     if (!res.ok) throw new Error("Failed to delete job");
  //     router.push("/");
  //   } finally {
  //     setDeleting(false);
  //   }
  // }

  async function handleResumeChange(resumeId: string) {
    if (!job) return;
    setUpdatingResume(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      if (!res.ok) throw new Error("Failed to update resume");
      const updated = await res.json();
      setJob((prev) => prev ? { ...prev, resume: updated.resume } : prev);
    } finally {
      setUpdatingResume(false);
    }
  }

  async function handleRescrape(html?: string) {
    if (!job) return;
    setRetrying(true);
    try {
      const body = html ? JSON.stringify({ html }) : undefined;
      await fetch(`/api/jobs/${job.id}/scrape`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body,
      });
      // Optimistically mark as researching and reload
      setJob((prev) => prev ? { ...prev, status: "RESEARCHING" } : prev);
      setManualHtml("");
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) return null;

  const isError = job.status === "RESEARCH_ERROR";
  const lastErrorNote = isError
    ? [...job.statusLogs].reverse().find((l) => l.status === "RESEARCH_ERROR")?.note
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">
              {job.title ?? "Unknown Position"}
            </h1>
            {job.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <PrivacyBlur>{job.company}</PrivacyBlur>
              </p>
            )}
          </div>
          <PrivacyBlur>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Open job posting"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </PrivacyBlur>
          <PrivacyToggle />
          <EditJobDialog job={job} onSave={(updated) => setJob((prev) => prev ? { ...prev, ...updated } : prev)} />
          <DeleteJob job={job} onDelete={() => router.push("/")} />
          {/* <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete job"
          >
            <Trash2 className="h-4 w-4" />
          </Button> */}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Duplicate jobs with same URL */} 
        {job.duplicates && job.duplicates.length > 0 && (
            <DuplicateJobs duplicates={job.duplicates ?? []} onDelete={fetchJob} />
      )}
        {/* Status & Meta */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={job.status} />
                {job.dateApplied && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Applied {new Date(job.dateApplied).toLocaleDateString()}
                  </span>
                )}
                {resumeOptions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {updatingResume && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    <Select
                      value={job.resume?.id ?? "none"}
                      onValueChange={(v) => handleResumeChange(v)}
                      disabled={updatingResume}
                    >
                      <SelectTrigger className="h-6 text-xs w-44 text-muted-foreground border-0 bg-transparent px-1 shadow-none">
                        <SelectValue placeholder="No resume" />
                      </SelectTrigger>
                      <SelectContent>
                        {resumeOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">
                            {r.filename}
                            {r.isDefault && <span className="ml-1 text-muted-foreground">(default)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {job.sessionId && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground/70">Session:</span>
                    <code
                      className="text-xs font-mono text-foreground/70 bg-muted px-1.5 py-0.5 rounded truncate max-w-[160px]"
                      title={job.sessionId}
                    >
                      {job.sessionId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      title={`Resume with: claude --resume ${job.sessionId}`}
                      onClick={() => navigator.clipboard.writeText(job.sessionId!)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {updatingStatus && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Select value={job.status} onValueChange={handleStatusChange} disabled={updatingStatus || isError}>
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

        {/* Research Error recovery UI */}
        {isError && (
          <Card className="border-orange-200 dark:border-orange-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Scrape failed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastErrorNote && (
                <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded">
                  {lastErrorNote}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRescrape()}
                  disabled={retrying}
                >
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Retry scrape
                </Button>
                <span className="text-xs text-muted-foreground">or paste the page HTML below</span>
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Paste raw HTML from the job posting page..."
                  value={manualHtml}
                  onChange={(e) => setManualHtml(e.target.value)}
                  className="font-mono text-xs min-h-32 resize-y"
                  disabled={retrying}
                />
                <Button
                  size="sm"
                  onClick={() => handleRescrape(manualHtml)}
                  disabled={retrying || !manualHtml.trim()}
                >
                  {retrying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit HTML
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-6">
            {/* Job Description */}
            {job.description && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-foreground">Job Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </p>
                </CardContent>
              </Card>
            )}
            {job.descriptionFull && (
              <Collapsible>
              <Card>
                <CollapsibleTrigger>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-foreground">Job Description (Full)</CardTitle>
                </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    {/* <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"> */}
                      <Markdown>{job.descriptionFull}</Markdown>
                    {/* </p> */}
                  </CardContent>
                </CollapsibleContent>
              </Card>
              </Collapsible>
            )}

            {/* Questions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
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
                <CardTitle className="text-sm font-semibold text-foreground">Notes</CardTitle>
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
                <CardTitle className="text-sm font-semibold text-foreground">Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusLog logs={job.statusLogs} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {/* <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete job?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {job.title ?? "This job"}{job.company ? ` at ${job.company}` : ""} will be removed from your list. You can still view it by enabling &quot;Show deleted&quot; on the main page.
          </p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
