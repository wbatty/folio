"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JobEmail {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string | null;
  fromAddress: string | null;
  snippet: string | null;
  classification: string | null;
  receivedAt: string;
}

const CLASSIFICATION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmation: "default",
  interview: "default",
  rejection: "destructive",
  recruiter: "secondary",
  other: "outline",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  confirmation: "Confirmation",
  interview: "Interview",
  rejection: "Rejection",
  recruiter: "Recruiter",
  other: "Other",
};

function gmailThreadUrl(threadId: string) {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`;
}

export function EmailsSection({ jobId }: { jobId: string }) {
  const [emails, setEmails] = useState<JobEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/emails`)
      .then((r) => r.json())
      .then(setEmails)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading emails…
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-1">No emails linked to this job yet.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {emails.map((email) => (
        <li key={email.id} className="flex items-start gap-3">
          <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={gmailThreadUrl(email.gmailThreadId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground hover:underline truncate flex items-center gap-1"
              >
                {email.subject ?? "(no subject)"}
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </a>
              {email.classification && (
                <Badge variant={CLASSIFICATION_VARIANTS[email.classification] ?? "outline"} className="text-xs h-4 px-1.5">
                  {CLASSIFICATION_LABELS[email.classification] ?? email.classification}
                </Badge>
              )}
            </div>
            {email.fromAddress && (
              <p className="text-xs text-muted-foreground truncate">{email.fromAddress}</p>
            )}
            {email.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-2">{email.snippet}</p>
            )}
            <p className="text-xs text-muted-foreground/60">
              {new Date(email.receivedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
