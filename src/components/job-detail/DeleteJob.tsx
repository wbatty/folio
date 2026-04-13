
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";


export default function DeleteJob({job, onDelete}: {job: {id: string, company: string | null, title: string | null}, onDelete: () => void}) {

      const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
      const [deleting, setDeleting] = useState(false);


  async function handleDelete() {
    if (!job) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
<>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete job"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
      </Dialog></>);
}