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

interface Company {
  id: string;
  name: string;
  site: string | null;
  jobListingIndex: string | null;
  lastCheckedAt: string | null;
}

interface CompanyEditDialogProps {
  company: Company;
  onSaved: () => void;
}

export function CompanyEditDialog({ company, onSaved }: CompanyEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(company.name);
  const [site, setSite] = useState(company.site ?? "");
  const [jobListingIndex, setJobListingIndex] = useState(company.jobListingIndex ?? "");
  const [lastCheckedAt, setLastCheckedAt] = useState(
    company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : ""
  );

  function handleOpenChange(value: boolean) {
    if (value) {
      setName(company.name);
      setSite(company.site ?? "");
      setJobListingIndex(company.jobListingIndex ?? "");
      setLastCheckedAt(company.lastCheckedAt ? company.lastCheckedAt.slice(0, 10) : "");
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
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
