import Link from "next/link";
import type { JobStatus } from "@/lib/schemas";
import { StatusBadge } from "../jobs/StatusBadge";
import { Building2 } from "lucide-react";

interface SameCompanyJob {
  id: string;
  title: string | null;
  status: JobStatus;
  dateApplied: string | null;
  createdAt: string;
}

export function SameCompanyJobs({ jobs }: { jobs: SameCompanyJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}`}
          className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors group"
        >
          <span className="text-sm text-foreground group-hover:text-foreground truncate">
            {job.title ?? "Unknown Position"}
          </span>
          <StatusBadge status={job.status} />
        </Link>
      ))}
    </div>
  );
}
