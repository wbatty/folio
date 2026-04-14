"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GenerateResponseDialog } from "./GenerateResponseDialog";
import { Plus, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import { PrivacyBlur } from "@/components/ui/privacy-blur";

interface Question {
  id: string;
  question: string;
  context: string | null;
  response: string | null;
}

interface QuestionsSectionProps {
  jobId: string;
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
}

export function QuestionsSection({ jobId, questions, onQuestionsChange }: QuestionsSectionProps) {
  const [newQuestion, setNewQuestion] = useState("");
  const [newContext, setNewContext] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generateFor, setGenerateFor] = useState<Question | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAddQuestion() {
    if (!newQuestion.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQuestion, context: newContext || undefined }),
      });
      if (!res.ok) throw new Error("Failed to add question");
      const q = await res.json();
      onQuestionsChange([...questions, q]);
      setNewQuestion("");
      setNewContext("");
      setShowAddForm(false);
      setExpandedId(q.id);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(qid: string) {
    setDeletingId(qid);
    try {
      await fetch(`/api/jobs/${jobId}/questions/${qid}`, { method: "DELETE" });
      onQuestionsChange(questions.filter((q) => q.id !== qid));
    } finally {
      setDeletingId(null);
    }
  }

  function handleApproved(questionId: string, response: string) {
    onQuestionsChange(
      questions.map((q) => (q.id === questionId ? { ...q, response } : q))
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => {
        const isExpanded = expandedId === q.id;
        return (
          <Card key={q.id} className="overflow-hidden">
            <CardContent className="p-0">
              <button
                className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-muted transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {q.response ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-border mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-foreground leading-snug"><PrivacyBlur>{q.question}</PrivacyBlur></span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <Separator />

                  {q.context && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Context</p>
                      <p className="text-sm text-muted-foreground bg-muted rounded p-2"><PrivacyBlur>{q.context}</PrivacyBlur></p>
                    </div>
                  )}

                  {q.response ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> Approved Response
                      </p>
                      <p className="text-sm text-foreground bg-green-950/20 border border-green-900/30 dark:bg-green-950/30 dark:border-green-900/50 rounded p-3 whitespace-pre-wrap leading-relaxed">
                        <PrivacyBlur>{q.response}</PrivacyBlur>
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs text-muted-foreground"
                        onClick={() => setGenerateFor(q)}
                      >
                        <Sparkles className="h-3 w-3" />
                        Regenerate
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setGenerateFor(q)}
                      className="w-full"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Response
                    </Button>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                    >
                      {deletingId === q.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {showAddForm ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Question</Label>
              <Input
                placeholder="Enter the application question..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional context (optional)</Label>
              <Textarea
                placeholder="Any extra context that might help generate a better response..."
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddQuestion} disabled={adding || !newQuestion.trim()}>
                {adding && <Loader2 className="h-3 w-3 animate-spin" />}
                Add Question
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />
          Add Question
        </Button>
      )}

      {generateFor && (
        <GenerateResponseDialog
          open={!!generateFor}
          onOpenChange={(open) => { if (!open) setGenerateFor(null); }}
          jobId={jobId}
          questionId={generateFor.id}
          question={generateFor.question}
          context={generateFor.context ?? ""}
          onApproved={(response) => { handleApproved(generateFor.id, response); setGenerateFor(null); }}
        />
      )}
    </div>
  );
}
