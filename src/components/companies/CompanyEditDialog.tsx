"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Company {
  id: string;
  name: string;
  site: string | null;
  jobListingIndex: string | null;
  lastCheckedAt: string | null;
}

interface CompanyEditDialogProps {
  company: Company;
  otherCompanies: { id: string; name: string }[];
  onSaved: () => void;
}

export function CompanyEditDialog({ company, otherCompanies, onSaved }: CompanyEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(company.name);
  const [site, setSite] = useState(company.site ?? "");
  const [jobListingIndex, setJobListingIndex] = useState(company.jobListingIndex ?? "");
  const [lastCheckedAt, setLastCheckedAt] = useState(
    company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : ""
  );
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [merging, setMerging] = useState(false);

  function handleOpenChange(value: boolean) {
    if (value) {
      setName(company.name);
      setSite(company.site ?? "");
      setJobListingIndex(company.jobListingIndex ?? "");
      setLastCheckedAt(company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : "");
      setMergeTargetId("");
      setError(null);
    }
    setOpen(value);
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
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleMerge() {
    if (!mergeTargetId) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeTargetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to merge");
      }
      onSaved();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge");
    } finally {
      setMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="text-sm font-medium text-foreground hover:underline truncate text-left max-w-xs">
          {company.name}
        </button>
      </DialogTrigger>
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

          {otherCompanies.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="merge-target">Merge into another company</Label>
                <p className="text-xs text-muted-foreground">
                  All jobs from <span className="font-medium">{company.name}</span> will be moved to the selected company, then this entry will be deleted.
                </p>
                <div className="flex gap-2">
                  <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select company…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    onClick={handleMerge}
                    disabled={!mergeTargetId || merging}
                  >
                    {merging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Merge
                  </Button>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving || merging}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || merging || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
