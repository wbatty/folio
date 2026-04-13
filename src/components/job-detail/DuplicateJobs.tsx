
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item"
import Link from "next/link";
import type { JobStatus } from "@/lib/schemas";
import { StatusBadge } from "../jobs/StatusBadge";
import DeleteJob from "./DeleteJob";

export function DuplicateJobs({ duplicates, onDelete }: { duplicates: {id: string, company: string, title: string, status: JobStatus}[], onDelete: () => void }) {
  return (
    <div className="space-y-3">
      {duplicates.map(({ id, company, title, status }) => (
        <div key={id} className="flex gap-3">
          <Item variant="outline">
        <ItemContent>
          <ItemTitle><StatusBadge status={status} /> {company ?? "Unknown Company"} - {title ?? "Unknown Title"}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Link href={`/jobs/${id}`} target="_blank" className="text-sm text-blue-600 hover:underline">
            View
          </Link>
          <DeleteJob job={{id, company, title}} onDelete={onDelete} />
        </ItemActions>
      </Item>
        </div>
      ))}
    </div>
  );
}
