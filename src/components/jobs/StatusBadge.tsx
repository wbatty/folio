import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/schemas";

const STATUS_CONFIG: Record<JobStatus, { label: string; className: string }> = {
  RESEARCHING: { label: "Researching", className: "bg-muted text-muted-foreground border-border" },
  RESEARCH_ERROR: { label: "Research Error", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900" },
  PENDING_APPLICATION: { label: "Pending", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900" },
  APPLIED: { label: "Applied", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-900" },
  INTERVIEWING: { label: "Interviewing", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900" },
  OFFERED: { label: "Offered", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900" },
  DENIED: { label: "Denied", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-muted text-muted-foreground border-border" },
  EXPIRED: { label: "Expired", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900" },
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
