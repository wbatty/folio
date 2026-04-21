"use client";

import { useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(company.name);
  const [site, setSite] = useState(company.site ?? "");
  const [jobListingIndex, setJobListingIndex] = useState(company.jobListingIndex ?? "");
  const [lastCheckedAt, setLastCheckedAt] = useState(
    company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : ""
  );
  const [mergingId, setMergingId] = useState<string | null>(null);

  function handleOpenChange(value: boolean) {
    if (value) {
      setName(company.name);
      setSite(company.site ?? "");
      setJobListingIndex(company.jobListingIndex ?? "");
      setLastCheckedAt(company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : "");
      setMergingId(null);
      setError(null);
    }
    onOpenChange(value);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          site: site || null,
          job_listing_index: jobListingIndex || null,
          last_checked_at: lastCheckedAt
            ? new Date(lastCheckedAt).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // sourceId gets deleted; its jobs move to targetId
  async function handleMerge(sourceId: string, targetId: string) {
    setMergingId(sourceId);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to merge");
    } finally {
      setMergingId(null);
    }
  }

  const isBusy = saving || mergingId !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-site">Website</Label>
            <Input
              id="company-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="https://acme.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-listings">Job listings base URL</Label>
            <Input
              id="company-listings"
              value={jobListingIndex}
              onChange={(e) => setJobListingIndex(e.target.value)}
              placeholder="https://acme.com/careers"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-checked">Last checked</Label>
            <Input
              id="company-checked"
              type="date"
              value={lastCheckedAt}
              onChange={(e) => setLastCheckedAt(e.target.value)}
            />
          </div>

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

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isBusy || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
