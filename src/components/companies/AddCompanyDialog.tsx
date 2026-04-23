"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { zodField, RequiredNameField } from "@/lib/schemas";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AddCompanyDialogProps {
  onCreated: () => void;
}

export function AddCompanyDialog({ onCreated }: AddCompanyDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create");
      }
      onCreated();
      setOpen(false);
    },
  });

  function handleOpenChange(value: boolean) {
    if (value) {
      form.reset({ name: "" });
      setServerError(null);
    }
    setOpen(value);
  }

  async function handleCreate() {
    setServerError(null);
    try {
      await form.handleSubmit();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to create");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add company</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <form.Field name="name" validators={zodField(RequiredNameField)}>
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="new-company-name">Name</Label>
                <Input
                  id="new-company-name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Acme Corp"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
                {field.state.meta.isTouched && field.state.meta.errors[0] && (
                  <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>
          {serverError && <p className="text-sm text-red-500">{serverError}</p>}
        </div>

        <form.Subscribe selector={(s) => [s.isSubmitting, s.values.name] as const}>
          {([isSubmitting, name]) => (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create
              </Button>
            </DialogFooter>
          )}
        </form.Subscribe>
      </DialogContent>
    </Dialog>
  );
}
