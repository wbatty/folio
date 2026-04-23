"use client";

import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Loader2, Star } from "lucide-react";

export interface ResumeListItem {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
  hasPdf: boolean;
  isDefault: boolean;
  performance: {
    totalJobs: number;
    applied: number;
    interviews: number;
    offers: number;
  };
}

interface ResumeSectionProps {
  resumes: ResumeListItem[];
  onResumesChange: (resumes: ResumeListItem[]) => void;
}

type UploadStage =
  | { name: "idle" }
  | { name: "parsing"; file: File }
  | { name: "editing"; file: File; content: string; blobUrl: string }
  | { name: "saving" };

function PerformanceSummary({ perf }: { perf: ResumeListItem["performance"] }) {
  if (perf.totalJobs === 0) {
    return <span className="text-muted-foreground/50">No jobs yet</span>;
  }
  const parts = [`${perf.totalJobs} job${perf.totalJobs !== 1 ? "s" : ""}`];
  if (perf.applied > 0) parts.push(`${perf.applied} applied`);
  if (perf.interviews > 0) parts.push(`${perf.interviews} interview${perf.interviews !== 1 ? "s" : ""}`);
  if (perf.offers > 0) parts.push(`${perf.offers} offer${perf.offers !== 1 ? "s" : ""}`);
  return <span>{parts.join(" · ")}</span>;
}

export function ResumeSection({ resumes, onResumesChange }: ResumeSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>({ name: "idle" });
  const [editedContent, setEditedContent] = useState("");
  const [error, setError] = useState("");
  const [previewResume, setPreviewResume] = useState<ResumeListItem | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (uploadStage.name === "editing") {
        URL.revokeObjectURL(uploadStage.blobUrl);
      }
    };
  }, [uploadStage]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setError("");
    setUploadStage({ name: "parsing", file });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resume/parse", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Parse failed");
      const { content } = await res.json();
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      const blobUrl = isPdf ? URL.createObjectURL(file) : "";
      setEditedContent(content);
      setUploadStage({ name: "editing", file, content, blobUrl });
    } catch {
      setError("Failed to parse file. Please try again.");
      setUploadStage({ name: "idle" });
    }
  }

  function handleCancel() {
    if (uploadStage.name === "editing") URL.revokeObjectURL(uploadStage.blobUrl);
    setUploadStage({ name: "idle" });
    setError("");
  }

  async function handleSave() {
    if (uploadStage.name !== "editing") return;
    const { file, blobUrl } = uploadStage;
    setUploadStage({ name: "saving" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("content", editedContent);
      const res = await fetch("/api/resume", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      URL.revokeObjectURL(blobUrl);
      // Refresh full list from server
      const listRes = await fetch("/api/resumes");
      const updated: ResumeListItem[] = await listRes.json();
      onResumesChange(updated);
      setUploadStage({ name: "idle" });
    } catch {
      setError("Failed to save resume. Please try again.");
      setUploadStage({ name: "editing", file, content: editedContent, blobUrl });
    }
  }

  async function handleSetDefault(resumeId: string) {
    setSettingDefaultId(resumeId);
    try {
      await fetch(`/api/resume/${resumeId}/default`, { method: "POST" });
      onResumesChange(resumes.map((r) => ({ ...r, isDefault: r.id === resumeId })));
    } finally {
      setSettingDefaultId(null);
    }
  }

  const isParsing = uploadStage.name === "parsing";
  const isSaving = uploadStage.name === "saving";
  const isEditing = uploadStage.name === "editing";
  const editingStage = isEditing
    ? (uploadStage as { name: "editing"; file: File; content: string; blobUrl: string })
    : null;
  const isPdf = editingStage
    ? editingStage.file.type === "application/pdf" || editingStage.file.name.endsWith(".pdf")
    : false;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resumes
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || isSaving}
              className="text-xs"
            >
              {isParsing ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Parsing…</>
              ) : (
                <><Upload className="h-3 w-3 mr-1" /> Upload</>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          {resumes.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-ring/50 hover:bg-muted transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Upload your resume</p>
              <p className="text-xs text-muted-foreground/70 mt-1">PDF or plain text</p>
            </div>
          ) : (
            <div className="space-y-2">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  className="group flex flex-col gap-1 rounded-md border border-border px-3 py-2 hover:border-ring/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      className="flex items-center gap-2 min-w-0 text-left"
                      onClick={() => setPreviewResume(resume)}
                      title="Preview resume"
                    >
                      <span className="text-xs font-medium truncate">{resume.filename}</span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {resume.isDefault ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          Default
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={settingDefaultId === resume.id}
                          onClick={() => handleSetDefault(resume.id)}
                          title="Set as default"
                        >
                          {settingDefaultId === resume.id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Star className="h-2.5 w-2.5" />
                          )}
                          Set default
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/60">
                      <PerformanceSummary perf={resume.performance} />
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      {new Date(resume.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload review/edit dialog */}
      <Dialog open={isEditing} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-10xl h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-base">
              Review Resume — {editingStage?.file.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Claude has structured the extracted text as markdown. Edit to correct any errors before saving.
            </p>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 divide-x divide-border">
            <div className="w-1/2 flex flex-col min-h-0">
              <p className="text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border shrink-0">
                Original PDF
              </p>
              <div className="flex-1 min-h-0">
                {isPdf && editingStage?.blobUrl ? (
                  <iframe
                    src={editingStage.blobUrl}
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

            <div className="w-1/2 flex flex-col min-h-0">
              <p className="text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border shrink-0">
                Structured markdown
              </p>
              <textarea
                className="flex-1 min-h-0 resize-none p-4 text-xs font-mono text-foreground bg-background focus:outline-none"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                spellCheck={false}
                placeholder="Structured resume markdown will appear here…"
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

      {/* Preview dialog */}
      <Dialog open={!!previewResume} onOpenChange={(open) => { if (!open) setPreviewResume(null); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              {previewResume?.filename}
              {previewResume?.isDefault && (
                <Badge variant="secondary" className="text-[10px]">Default</Badge>
              )}
            </DialogTitle>
            {previewResume && (
              <p className="text-xs text-muted-foreground mt-1">
                Uploaded {new Date(previewResume.createdAt).toLocaleDateString()} ·{" "}
                <PerformanceSummary perf={previewResume.performance} />
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto">
            {previewResume?.hasPdf ? (
              <iframe
                src={`/api/resume/${previewResume.id}/pdf`}
                className="w-full h-full"
                title={previewResume.filename}
              />
            ) : (
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed p-6">
                {previewResume?.content}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
