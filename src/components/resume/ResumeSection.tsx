"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";

interface Resume {
  id: string;
  filename: string;
  content: string;
  createdAt: string;
}

interface ResumeSectionProps {
  resume: Resume | null;
  onUpload: (resume: Resume) => void;
}

export function ResumeSection({ resume, onUpload }: ResumeSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume", { method: "POST", body: formData });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const data = await res.json();
      onUpload(data);
    } catch {
      setError("Failed to upload resume. Please try again.");
    } finally {
      setUploading(false);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
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
            disabled={uploading}
            className="text-xs"
          >
            {uploading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</>
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
            <p className="text-xs text-slate-500 mb-2 font-medium group-hover:text-slate-700 transition-colors">
              {resume.filename}
              <span className="ml-2 text-slate-300">·</span>
              <span className="ml-2 text-slate-400">
                {new Date(resume.createdAt).toLocaleDateString()}
              </span>
            </p>
            <div className="h-48 overflow-hidden rounded border border-slate-100 bg-slate-50 p-3 group-hover:border-slate-300 transition-colors">
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">
                {resume.content.slice(0, 800)}
                {resume.content.length > 800 && (
                  <span className="text-slate-400">…</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Upload your resume</p>
            <p className="text-xs text-slate-400 mt-1">PDF or plain text</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
