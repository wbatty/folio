"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
  onAdd: (url: string, company: string, title: string) => Promise<void>;
}

const emptyForm = { url: "", company: "", title: "" };

export function AddJobDialog({ open, onOpenChange, initialUrl, onAdd }: AddJobDialogProps) {
  const [form, setForm] = useState({ ...emptyForm, url: initialUrl ?? "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, url: initialUrl ?? "" });
      setError("");
    }
  }, [open, initialUrl]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setError("");
    };
  }

  function validate(): boolean {
    try {
      new URL(form.url);
    } catch {
      setError("Please enter a valid URL");
      return false;
    }
    return true;
  }

  async function submit(andAnother: boolean) {
    if (!validate()) return;
    setLoading(true);
    try {
      await onAdd(form.url, form.company, form.title);
      if (andAnother) {
        setForm(emptyForm);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add job");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && !!form.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Job Application</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="add-url">Job Posting URL</Label>
            <Input
              id="add-url"
              type="url"
              placeholder="https://..."
              value={form.url}
              onChange={set("url")}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-company">Company</Label>
            <Input
              id="add-company"
              type="text"
              placeholder="Acme Corp"
              value={form.company}
              onChange={set("company")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-title">Position</Label>
            <Input
              id="add-title"
              type="text"
              placeholder="Software Engineer"
              value={form.title}
              onChange={set("title")}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => submit(true)} disabled={!canSubmit}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Another
            </Button>
            <Button type="button" onClick={() => submit(false)} disabled={!canSubmit}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
