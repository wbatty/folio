"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { Loader2, ExternalLink } from "lucide-react";
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

interface Job {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
}

interface JobCardProps {
  job: Job;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<void>;
}

export function JobCard({ job, onStatusChange }: JobCardProps) {
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    try {
      await onStatusChange(job.id, newStatus as JobStatus);
    } finally {
      setUpdating(false);
    }
  }

  const isResearching = job.status === "RESEARCHING";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isResearching ? (
                <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Researching...
                </span>
              ) : (
                <h3 className="font-semibold text-slate-900 truncate">
                  {job.title ?? "Unknown Position"}
                </h3>
              )}
            </div>
            <p className="text-sm text-slate-600 truncate">
              {job.company ?? new URL(job.url).hostname}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {new URL(job.url).hostname}
            </p>
          </Link>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div onClick={(e) => e.stopPropagation()}>
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <Select value={job.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-7 w-auto text-xs border-0 shadow-none p-0 focus:ring-0">
                    <StatusBadge status={job.status} />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {job.dateApplied && (
              <span className="text-xs text-slate-400">
                Applied {new Date(job.dateApplied).toLocaleDateString()}
              </span>
            )}
            {!job.dateApplied && (
              <span className="text-xs text-slate-400">
                Added {new Date(job.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
