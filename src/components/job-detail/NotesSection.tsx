"use client";

import { useForm } from "@tanstack/react-form";
import { zodField, RequiredContentField } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, StickyNote } from "lucide-react";
import { PrivacyBlur } from "@/components/ui/privacy-blur";

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
  const form = useForm({
    defaultValues: { content: "" },
    onSubmit: async ({ value }) => {
      const res = await fetch(`/api/jobs/${jobId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value.content }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const note = await res.json();
      onNoteAdded(note);
      form.reset();
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <form.Field
          name="content"
          validators={zodField(RequiredContentField)}
        >
          {(field) => (
            <Textarea
              placeholder="Add a note..."
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              rows={3}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.isSubmitting, s.values.content] as const}>
          {([isSubmitting, content]) => (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => form.handleSubmit()}
                disabled={isSubmitting || !content.trim()}
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Save Note
              </Button>
            </div>
          )}
        </form.Subscribe>
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
              <p className="text-sm text-foreground whitespace-pre-wrap"><PrivacyBlur>{note.content}</PrivacyBlur></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
