"use client";

import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Loader2 } from "lucide-react";

interface Resume {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
  hasPdf: boolean;
}

interface ResumeSectionProps {
  resume: Resume | null;
  onUpload: (resume: Resume) => void;
}

type Stage =
  | { name: "idle" }
  | { name: "parsing"; file: File }
  | { name: "editing"; file: File; content: string; blobUrl: string }
  | { name: "saving" };

export function ResumeSection({ resume, onUpload }: ResumeSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [error, setError] = useState("");
  const [editedContent, setEditedContent] = useState("");

  // Clean up blob URL when editing stage is exited
  useEffect(() => {
    return () => {
      if (stage.name === "editing") {
        URL.revokeObjectURL(stage.blobUrl);
      }
    };
  }, [stage]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    setError("");
    setStage({ name: "parsing", file });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume/parse", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Parse failed");

      const { content } = await res.json();
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      const blobUrl = isPdf ? URL.createObjectURL(file) : "";

      setEditedContent(content);
      setStage({ name: "editing", file, content, blobUrl });
    } catch {
      setError("Failed to parse file. Please try again.");
      setStage({ name: "idle" });
    }
  }

  function handleCancel() {
    if (stage.name === "editing") {
      URL.revokeObjectURL(stage.blobUrl);
    }
    setStage({ name: "idle" });
    setError("");
  }

  async function handleSave() {
    if (stage.name !== "editing") return;

    const { file, blobUrl } = stage;
    setStage({ name: "saving" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("content", editedContent);

      const res = await fetch("/api/resume", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const data: Resume = await res.json();
      URL.revokeObjectURL(blobUrl);
      onUpload(data);
      setStage({ name: "idle" });
    } catch {
      setError("Failed to save resume. Please try again.");
      setStage({ name: "editing", file, content: editedContent, blobUrl });
    }
  }

  const isParsing = stage.name === "parsing";
  const isSaving = stage.name === "saving";
  const isEditing = stage.name === "editing";
  const editingFile = isEditing ? (stage as { name: "editing"; file: File; content: string; blobUrl: string }) : null;
  const isPdf = editingFile
    ? editingFile.file.type === "application/pdf" || editingFile.file.name.endsWith(".pdf")
    : false;

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resume
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || isSaving}
              className="text-xs"
            >
              {isParsing ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Parsing...</>
              ) : (
                <><Upload className="h-3 w-3" /> {resume ? "Replace" : "Upload"}</>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          {resume ? (
            <div
              className="cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              title="Click to replace resume"
            >
              <p className="text-xs text-muted-foreground mb-2 font-medium group-hover:text-foreground transition-colors">
                {resume.filename}
                <span className="ml-2 text-muted-foreground/50">·</span>
                <span className="ml-2 text-muted-foreground/70">
                  {new Date(resume.createdAt).toLocaleDateString()}
                </span>
              </p>
              <div className="h-64 overflow-hidden rounded border border-border bg-muted group-hover:border-ring/50 transition-colors">
                {resume.hasPdf ? (
                  <iframe
                    src={`/api/resume/${resume.id}/pdf`}
                    className="w-full h-full"
                    title={resume.filename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono p-3">
                    {resume.content.slice(0, 800)}
                    {resume.content.length > 800 && (
                      <span className="text-muted-foreground/50">…</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-ring/50 hover:bg-muted transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Upload your resume</p>
              <p className="text-xs text-muted-foreground/70 mt-1">PDF or plain text</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditing} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-10xl h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-base">
              Review Resume — {editingFile?.file.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Verify the extracted text below. Edit the markdown to correct any parsing errors before saving.
            </p>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 divide-x divide-border">
            {/* PDF preview panel */}
            <div className="w-1/2 flex flex-col min-h-0">
              <p className="text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border shrink-0">
                Original PDF
              </p>
              <div className="flex-1 min-h-0">
                {isPdf && editingFile?.blobUrl ? (
                  <iframe
                    src={editingFile.blobUrl}
                    className="w-full h-full"
                    title="PDF preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No PDF preview available
                  </div>
                )}
              </div>
            </div>

            {/* Markdown editor panel */}
            <div className="w-1/2 flex flex-col min-h-0">
              <p className="text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border shrink-0">
                Extracted text (markdown)
              </p>
              <textarea
                className="flex-1 min-h-0 resize-none p-4 text-xs font-mono text-foreground bg-background focus:outline-none"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                spellCheck={false}
                placeholder="Extracted resume text will appear here…"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !editedContent.trim()}>
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</>
              ) : (
                "Save Resume"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
