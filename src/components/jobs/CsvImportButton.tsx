"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import type { ImportJobRow } from "@/lib/schemas";
import type { JobStatus } from "@/lib/schemas";

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
      } else if (ch === "\n" || ch === "\r") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const STATUS_MAP: Record<string, JobStatus> = {
  applied: "APPLIED",
  denied: "DENIED",
  "expired post": "WITHDRAWN",
  withdrawn: "WITHDRAWN",
  interviewing: "INTERVIEWING",
  "waiting on interview feedback": "INTERVIEWING",
  offered: "OFFERED",
};

function mapStatus(raw: string): JobStatus {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? "APPLIED";
}

function parseDate(raw: string): string | undefined {
  // Input: "2/2/2026" or "2/2/2026 13:10" etc.
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return undefined;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function csvToRows(text: string): ImportJobRow[] {
  const parsed = parseCSV(text);
  if (parsed.length < 2) return [];

  // Header: Timestamp,Company Name,Job Title,Job ID,Link to Job Posting,Date Applied,Current Status,...,Contact,...,Notes
  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const idx = {
    company: header.findIndex((h) => h.includes("company")),
    title: header.findIndex((h) => h.includes("job title")),
    url: header.findIndex((h) => h.includes("link") || h.includes("url")),
    dateApplied: header.findIndex((h) => h.includes("date applied")),
    status: header.findIndex((h) => h.includes("current status")),
    contact: header.findIndex((h) => h.includes("contact")),
    notes: header.findIndex((h) => h.includes("notes") || h.includes("important")),
  };

  const rows: ImportJobRow[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const cols = parsed[i];
    if (cols.every((c) => !c.trim())) continue; // skip blank rows

    const url = idx.url >= 0 ? cols[idx.url]?.trim() : "";
    if (!url) continue;

    const contact = idx.contact >= 0 ? cols[idx.contact]?.trim() : "";
    const notesText = idx.notes >= 0 ? cols[idx.notes]?.trim() : "";
    const parts: string[] = [];
    if (contact) parts.push(`Contact: ${contact}`);
    if (notesText) parts.push(notesText);
    const noteContent = parts.join("\n\n") || undefined;

    rows.push({
      url,
      company: idx.company >= 0 ? cols[idx.company]?.trim() || undefined : undefined,
      title: idx.title >= 0 ? cols[idx.title]?.trim() || undefined : undefined,
      status: idx.status >= 0 ? mapStatus(cols[idx.status] ?? "") : "APPLIED",
      dateApplied: idx.dateApplied >= 0 ? parseDate(cols[idx.dateApplied] ?? "") : undefined,
      noteContent,
    });
  }
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onImportComplete: () => void;
}

export function CsvImportButton({ onImportComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportJobRow[]>([]);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = csvToRows(text);
      setRows(parsed);
      setResult(null);
      setImportError("");
      setOpen(true);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  async function handleImport() {
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data?.error ?? "Import failed");
        return;
      }
      setResult({ imported: data.imported, skipped: data.skipped });
      onImportComplete();
    } catch {
      setImportError("Network error — import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setRows([]);
    setResult(null);
    setImportError("");
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {result ? "Import complete" : `Import ${rows.length} job${rows.length !== 1 ? "s" : ""}?`}
            </DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="py-4 space-y-1 text-sm">
              <p className="text-foreground font-medium">{result.imported} job{result.imported !== 1 ? "s" : ""} imported successfully.</p>
              {result.skipped > 0 && (
                <p className="text-muted-foreground">{result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped due to errors.</p>
              )}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border border-border text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Company</th>
                    <th className="text-left px-3 py-2 font-medium">Title</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Date Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5 truncate max-w-[140px]">{row.company ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="px-3 py-1.5 truncate max-w-[200px]">{row.title ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="px-3 py-1.5">{row.status}</td>
                      <td className="px-3 py-1.5">{row.dateApplied ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importError && <p className="text-sm text-destructive">{importError}</p>}

          <DialogFooter>
            {result ? (
              <Button onClick={handleClose}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={importing}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing || rows.length === 0}>
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import {rows.length} job{rows.length !== 1 ? "s" : ""}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
