import { StatusBadge } from "@/components/jobs/StatusBadge";
import type { JobStatus } from "@/lib/schemas";

interface StatusLogEntry {
  id: string;
  status: JobStatus;
  note: string | null;
  createdAt: string;
}

export function StatusLog({ logs }: { logs: StatusLogEntry[] }) {
  return (
    <div className="space-y-3">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
            {i < logs.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
          </div>
          <div className="pb-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={log.status} />
              <span className="text-xs text-slate-400">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            {log.note && (
              <p className="text-xs text-slate-500 mt-1">{log.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
