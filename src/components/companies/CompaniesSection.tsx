"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCompanyDialog } from "./AddCompanyDialog";
import { CompanyEditDialog } from "./CompanyEditDialog";

interface Company {
  id: string;
  name: string;
  site: string | null;
  jobListingIndex: string | null;
  lastCheckedAt: string | null;
  lastAppliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleMarkChecked(id: string) {
    const res = await fetch(`/api/companies/${id}/check`, { method: "POST" });
    if (res.ok) {
      const { lastCheckedAt } = await res.json();
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, lastCheckedAt } : c))
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <AddCompanyDialog onCreated={refresh} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground font-medium">No companies yet</p>
          <p className="text-muted-foreground text-sm mt-1">Add a company above to track it</p>
        </div>
      ) : (
        <div className="space-y-1">
          {companies.map((company) => {
            const otherCompanies = companies
              .filter((c) => c.id !== company.id)
              .map((c) => ({ id: c.id, name: c.name }));

            return (
              <div
                key={company.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CompanyEditDialog
                    company={company}
                    otherCompanies={otherCompanies}
                    onSaved={refresh}
                  />
                  {company.jobListingIndex && (
                    <a
                      href={company.jobListingIndex}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      title="Open job listings"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {company.site && !company.jobListingIndex && (
                    <a
                      href={company.site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      title="Open company website"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {company.lastCheckedAt ? (
                    <span className="text-xs text-muted-foreground">
                      checked {new Date(company.lastCheckedAt).toLocaleDateString()}
                    </span>
                  ) : company.lastAppliedAt ? (
                    <span className="text-xs text-muted-foreground/60">
                      applied {new Date(company.lastAppliedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">never checked</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Mark checked today"
                    onClick={() => handleMarkChecked(company.id)}
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
