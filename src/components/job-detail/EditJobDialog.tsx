"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
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
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues = {
    title: job.title ?? "",
    description: job.description ?? "",
    descriptionFull: job.descriptionFull ?? "",
    dateApplied: job.dateApplied ? job.dateApplied.slice(0, 10) : "",
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const dateApplied = value.dateApplied
        ? new Date(value.dateApplied + "T00:00:00.000Z").toISOString()
        : null;
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.title || null,
          description: value.description || null,
          descriptionFull: value.descriptionFull || null,
          dateApplied,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      onSave({
        title: value.title || null,
        description: value.description || null,
        descriptionFull: value.descriptionFull || null,
        dateApplied,
      });
      setOpen(false);
    },
  });

  function handleOpenChange(value: boolean) {
    if (value) {
      form.reset(defaultValues);
      setServerError(null);
    }
    setOpen(value);
  }

  async function handleSave() {
    setServerError(null);
    try {
      await form.handleSubmit();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save");
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
          <form.Field name="title">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Software Engineer"
                />
                {field.state.meta.errors[0] && (
                  <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Short summary of the role..."
                  rows={4}
                />
                {field.state.meta.errors[0] && (
                  <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="descriptionFull">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="edit-description-full">Full Description</Label>
                <Textarea
                  id="edit-description-full"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Full job description (markdown supported)..."
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="dateApplied">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="edit-date-applied">Date Applied</Label>
                <Input
                  id="edit-date-applied"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors[0] && (
                  <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          {serverError && <p className="text-sm text-red-500">{serverError}</p>}
        </div>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          )}
        </form.Subscribe>
      </DialogContent>
    </Dialog>
  );
}
