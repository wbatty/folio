"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { zodField, RequiredNameField, OptionalUrlField } from "@/lib/schemas";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Company {
  id: string;
  name: string;
  site: string | null;
  jobListingIndex: string | null;
  lastCheckedAt: string | null;
}

interface CompanyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  possibleDuplicates: { id: string; name: string }[];
  otherCompanies: { id: string; name: string }[];
  onSaved: () => void;
}

export function CompanyEditDialog({
  open,
  onOpenChange,
  company,
  possibleDuplicates,
  onSaved,
}: CompanyEditDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);

  const defaultValues = {
    name: company.name,
    site: company.site ?? "",
    job_listing_index: company.jobListingIndex ?? "",
    last_checked_at: company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : "",
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: value.name.trim(),
          site: value.site || null,
          job_listing_index: value.job_listing_index || null,
          last_checked_at: value.last_checked_at
            ? new Date(value.last_checked_at).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      onSaved();
      onOpenChange(false);
    },
  });

  function handleOpenChange(value: boolean) {
    if (value) {
      form.reset(defaultValues);
      setMergingId(null);
      setServerError(null);
    }
    onOpenChange(value);
  }

  async function handleSave() {
    setServerError(null);
    try {
      await form.handleSubmit();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  // sourceId gets deleted; its jobs move to targetId
  async function handleMerge(sourceId: string, targetId: string) {
    setMergingId(sourceId);
    setServerError(null);
    try {
      const res = await fetch(`/api/companies/${sourceId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to merge");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to merge");
    } finally {
      setMergingId(null);
    }
  }


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
        </DialogHeader>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => {
            const isBusy = isSubmitting || mergingId !== null;
            return (
              <div className="space-y-4 py-2">
                <form.Field name="name" validators={zodField(RequiredNameField)}>
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="company-name">Name</Label>
                      <Input
                        id="company-name"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Acme Corp"
                      />
                      {field.state.meta.isTouched && field.state.meta.errors[0] && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="site" validators={zodField(OptionalUrlField)}>
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="company-site">Website</Label>
                      <Input
                        id="company-site"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="https://acme.com"
                      />
                      {field.state.meta.isTouched && field.state.meta.errors[0] && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="job_listing_index" validators={zodField(OptionalUrlField)}>
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="company-listings">Job listings base URL</Label>
                      <Input
                        id="company-listings"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="https://acme.com/careers"
                      />
                      {field.state.meta.isTouched && field.state.meta.errors[0] && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="last_checked_at">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="company-checked">Last checked</Label>
                      <Input
                        id="company-checked"
                        type="date"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>

                {possibleDuplicates.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Possible duplicates</Label>
                      <div className="space-y-1.5">
                        {possibleDuplicates.map((dupe) => (
                          <div
                            key={dupe.id}
                            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                          >
                            <span className="text-sm truncate">{dupe.name}</span>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                title={`Move ${dupe.name}'s jobs here and delete it`}
                                onClick={() => handleMerge(dupe.id, company.id)}
                              >
                                {mergingId === dupe.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ArrowLeft className="h-3 w-3" />
                                )}
                                Absorb
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                title={`Move this company's jobs to ${dupe.name} and delete this`}
                                onClick={() => handleMerge(company.id, dupe.id)}
                              >
                                {mergingId === company.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ArrowRight className="h-3 w-3" />
                                )}
                                Move to
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {serverError && <p className="text-sm text-red-500">{serverError}</p>}

                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isBusy}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save
                  </Button>
                </DialogFooter>
              </div>
            );
          }}
        </form.Subscribe>
      </DialogContent>
    </Dialog>
  );
}
