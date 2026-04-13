"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, StickyNote } from "lucide-react";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface NotesSectionProps {
  jobId: string;
  notes: Note[];
  onNoteAdded: (note: Note) => void;
}

export function NotesSection({ jobId, notes, onNoteAdded }: NotesSectionProps) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const note = await res.json();
      onNoteAdded(note);
      setContent("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Add a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving || !content.trim()}>
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save Note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <StickyNote className="h-4 w-4" />
          No notes yet
        </div>
      ) : (
        <div className="space-y-3">
          {[...notes].reverse().map((note) => (
            <div key={note.id} className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground/70 mb-1">
                {new Date(note.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
