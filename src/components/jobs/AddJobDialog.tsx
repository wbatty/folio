"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { zodField, UrlField } from "@/lib/schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyCombobox } from "@/components/ui/company-combobox";
import { Loader2 } from "lucide-react";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
  onAdd: (url: string, company: string, title: string) => Promise<void>;
}

export function AddJobDialog({ open, onOpenChange, initialUrl, onAdd }: AddJobDialogProps) {
  const [serverError, setServerError] = useState("");
  const addAnotherRef = useRef(false);

  const form = useForm({
    defaultValues: { url: initialUrl ?? "", company: "", title: "" },
    onSubmit: async ({ value }) => {
      setServerError("");
      await onAdd(value.url, value.company ?? "", value.title ?? "");
      if (addAnotherRef.current) {
        form.reset({ url: "", company: "", title: "" });
      } else {
        onOpenChange(false);
      }
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ url: initialUrl ?? "", company: "", title: "" });
      setServerError("");
    }
  }, [open, initialUrl]);

  async function submit(andAnother: boolean) {
    addAnotherRef.current = andAnother;
    try {
      await form.handleSubmit();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to add job");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Job Application</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <form.Field name="url" validators={zodField(UrlField)}>
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="add-url">Job Posting URL</Label>
                <Input
                  id="add-url"
                  type="url"
                  placeholder="https://..."
                  value={field.state.value}
                  onChange={(e) => { field.handleChange(e.target.value); setServerError(""); }}
                  onBlur={field.handleBlur}
                  autoFocus
                />
                {field.state.meta.isTouched && field.state.meta.errors[0] && (
                  <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="company">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="add-company">Company</Label>
                <CompanyCombobox
                  id="add-company"
                  value={field.state.value}
                  onChange={(name) => field.handleChange(name)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="title">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="add-title">Position</Label>
                <Input
                  id="add-title"
                  type="text"
                  placeholder="Software Engineer"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          {serverError && <p className="text-sm text-red-500">{serverError}</p>}
        </div>

        <form.Subscribe selector={(s) => [s.isSubmitting, s.values.url] as const}>
          {([isSubmitting, url]) => (
            <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => submit(true)} disabled={isSubmitting || !url}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Another
                </Button>
                <Button type="button" onClick={() => submit(false)} disabled={isSubmitting || !url}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add
                </Button>
              </div>
            </DialogFooter>
          )}
        </form.Subscribe>
      </DialogContent>
    </Dialog>
  );
}
