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
  appliedCount: number;
  deniedCount: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|company|group|technologies|tech|solutions|systems|services|international|global)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Two tokens are similar if edit distance ≤ 1 per 6 chars (min 1 edit allowed for long words)
function tokensSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return false;
  return levenshtein(a, b) <= Math.floor(maxLen / 6) + 1;
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function findPossibleDuplicates(company: Company, allCompanies: Company[]): Company[] {
  const normalized = normalizeName(company.name);
  const tokens = normalized.split(" ").filter((t) => t.length > 2);
  const siteHost = normalizeUrl(company.site);
  const listingHost = normalizeUrl(company.jobListingIndex);

  return allCompanies.filter((other) => {
    if (other.id === company.id) return false;

    // URL match: same hostname on site or job listing
    const otherSiteHost = normalizeUrl(other.site);
    const otherListingHost = normalizeUrl(other.jobListingIndex);
    if (siteHost && (siteHost === otherSiteHost || siteHost === otherListingHost)) return true;
    if (listingHost && (listingHost === otherSiteHost || listingHost === otherListingHost)) return true;

    // Name match: exact normalized
    const otherNormalized = normalizeName(other.name);
    if (normalized === otherNormalized) return true;

    // Substring containment
    if (normalized.includes(otherNormalized) || otherNormalized.includes(normalized)) return true;

    // Fuzzy token Jaccard: count pairs of similar tokens
    const otherTokens = otherNormalized.split(" ").filter((t) => t.length > 2);
    if (tokens.length > 0 && otherTokens.length > 0) {
      const matched = new Set<number>();
      let fuzzyShared = 0;
      for (const t of tokens) {
        for (let i = 0; i < otherTokens.length; i++) {
          if (!matched.has(i) && tokensSimilar(t, otherTokens[i])) {
            fuzzyShared++;
            matched.add(i);
            break;
          }
        }
      }
      const unionSize = tokens.length + otherTokens.length - fuzzyShared;
      if (fuzzyShared / unionSize >= 0.4) return true;
    }

    return false;
  });
}

export function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchCompanies = useCallback(() => {
    return fetch("/api/companies")
      .then((r) => r.json())
      .then((data: Company[]) => setCompanies(data));
  }, []);

  const refresh = useCallback(() => {
    fetchCompanies().catch(() => {});
  }, [fetchCompanies]);

  useEffect(() => {
    fetchCompanies()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchCompanies]);

  async function handleMarkChecked(id: string, e: React.MouseEvent) {
    e.stopPropagation();
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
            const possibleDuplicates = findPossibleDuplicates(company, companies);
            const otherCompanies = companies
              .filter((c) => c.id !== company.id)
              .map((c) => ({ id: c.id, name: c.name }));

            return (
              <div key={company.id}>
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 group cursor-pointer"
                  onClick={() => setEditingId(company.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate max-w-xs">
                      {company.name}
                    </span>
                    {company.jobListingIndex && (
                      <a
                        href={company.jobListingIndex}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Open job listings"
                        onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {company.appliedCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {company.appliedCount} applied
                      </span>
                    )}
                    {company.deniedCount > 0 && (
                      <span className="text-xs text-red-500/70">
                        {company.deniedCount} denied
                      </span>
                    )}
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
                      onClick={(e) => handleMarkChecked(company.id, e)}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CompanyEditDialog
                  open={editingId === company.id}
                  onOpenChange={(v) => setEditingId(v ? company.id : null)}
                  company={company}
                  otherCompanies={otherCompanies}
                  possibleDuplicates={possibleDuplicates}
                  onSaved={refresh}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
