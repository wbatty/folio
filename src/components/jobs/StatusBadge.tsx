import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/schemas";

const STATUS_CONFIG: Record<JobStatus, { label: string; className: string }> = {
  RESEARCHING: { label: "Researching", className: "bg-slate-100 text-slate-700 border-slate-200" },
  PENDING_APPLICATION: { label: "Pending", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPLIED: { label: "Applied", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  INTERVIEWING: { label: "Interviewing", className: "bg-purple-100 text-purple-700 border-purple-200" },
  OFFERED: { label: "Offered", className: "bg-green-100 text-green-700 border-green-200" },
  DENIED: { label: "Denied", className: "bg-red-100 text-red-700 border-red-200" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}

export { STATUS_CONFIG };
