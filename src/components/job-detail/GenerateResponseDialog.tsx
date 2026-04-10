"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, RefreshCw, Edit2 } from "lucide-react";

type Phase = "idle" | "generating" | "review" | "refining" | "editing" | "saving";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GenerateResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  questionId: string;
  question: string;
  context: string;
  onApproved: (response: string) => void;
}

export function GenerateResponseDialog({
  open,
  onOpenChange,
  jobId,
  questionId,
  question,
  context,
  onApproved,
}: GenerateResponseDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [refinementInput, setRefinementInput] = useState("");
  const [editedText, setEditedText] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setMessages([]);
      setStreamedText("");
      setRefinementInput("");
      setEditedText("");
      setError("");
    }
  }, [open]);

  async function generate(msgs: Message[]) {
    setError("");
    setStreamedText("");
    setPhase("generating");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, questionId, messages: msgs }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Generation failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamedText(fullText);
      }

      const newMessages: Message[] = [
        ...msgs,
        { role: "assistant", content: fullText },
      ];
      setMessages(newMessages);
      setPhase("review");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  function handleGenerate() {
    const userMessage = `Application question: ${question}${
      context.trim() ? `\n\nAdditional context: ${context}` : ""
    }\n\nPlease write a strong response.`;
    generate([{ role: "user", content: userMessage }]);
  }

  function handleRefine() {
    if (!refinementInput.trim()) return;
    const refinedMessages: Message[] = [
      ...messages,
      { role: "user", content: `Please refine the response: ${refinementInput}` },
    ];
    setRefinementInput("");
    setPhase("refining");
    generate(refinedMessages);
  }

  async function handleApprove(text: string) {
    setPhase("saving");
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: text }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onApproved(text);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save response");
      setPhase("review");
    }
  }

  const currentResponse = messages[messages.length - 1]?.content ?? streamedText;
  const isGenerating = phase === "generating" || phase === "refining";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Generate Response</DialogTitle>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{question}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {(phase === "idle") && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">Click "Generate" to create an AI-assisted response</p>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{phase === "refining" ? "Refining response..." : "Generating response..."}</span>
              </div>
              {streamedText && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {streamedText}
                  <span className="animate-pulse">▊</span>
                </div>
              )}
            </div>
          )}

          {(phase === "review" || phase === "saving") && currentResponse && (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {currentResponse}
              </div>
              <div className="rounded-md border border-slate-100 bg-blue-50 p-3">
                <Label className="text-xs text-slate-600 font-medium">Request refinement</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="e.g. Make it more concise, focus on leadership experience..."
                    value={refinementInput}
                    onChange={(e) => setRefinementInput(e.target.value)}
                    className="text-sm h-8"
                    onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                  />
                  <Button size="sm" variant="secondary" onClick={handleRefine} disabled={!refinementInput.trim()}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === "editing" && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Edit response directly</Label>
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {phase === "idle" && (
            <Button onClick={handleGenerate}>
              Generate Response
            </Button>
          )}

          {(phase === "review" || phase === "saving") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditedText(currentResponse); setPhase("editing"); }}
              >
                <Edit2 className="h-3 w-3" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(currentResponse)}
                disabled={phase === "saving"}
              >
                {phase === "saving" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                Approve & Save
              </Button>
            </>
          )}

          {phase === "editing" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPhase("review")}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleApprove(editedText)} disabled={!editedText.trim()}>
                <CheckCircle className="h-3 w-3" />
                Save Edit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
