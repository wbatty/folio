"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface JobFields {
  id: string;
  title: string | null;
  description: string | null;
  descriptionFull: string | null;
  dateApplied: string | null;
}

interface EditJobDialogProps {
  job: JobFields;
  onSave: (updated: Partial<Omit<JobFields, "id">>) => void;
}

export function EditJobDialog({ job, onSave }: EditJobDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(job.title ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [descriptionFull, setDescriptionFull] = useState(job.descriptionFull ?? "");
  const [dateApplied, setDateApplied] = useState(
    job.dateApplied ? job.dateApplied.slice(0, 10) : ""
  );

  function handleOpenChange(value: boolean) {
    if (value) {
      // Reset to current job values when opening
      setTitle(job.title ?? "");
      setDescription(job.description ?? "");
      setDescriptionFull(job.descriptionFull ?? "");
      setDateApplied(job.dateApplied ? job.dateApplied.slice(0, 10) : "");
      setError(null);
    }
    setOpen(value);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          descriptionFull: descriptionFull || null,
          dateApplied: dateApplied || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      onSave({
        title: title || null,
        description: description || null,
        descriptionFull: descriptionFull || null,
        dateApplied: dateApplied ? new Date(dateApplied).toISOString() : null,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          title="Edit job details"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit job details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Software Engineer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of the role..."
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description-full">Full Description</Label>
            <Textarea
              id="edit-description-full"
              value={descriptionFull}
              onChange={(e) => setDescriptionFull(e.target.value)}
              placeholder="Full job description (markdown supported)..."
              rows={8}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-date-applied">Date Applied</Label>
            <Input
              id="edit-date-applied"
              type="date"
              value={dateApplied}
              onChange={(e) => setDateApplied(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
