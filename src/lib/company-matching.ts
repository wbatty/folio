import { supabase } from "@/lib/supabase";

/**
 * Stage 1: URL-based matching.
 * Checks if the given job URL starts with any company's job_listing_index.
 * Returns the matching company id, or null if no match.
 */
export async function matchCompanyByUrl(jobUrl: string): Promise<string | null> {
  const { data: companies } = await supabase
    .from("companies")
    .select("id, job_listing_index")
    .not("job_listing_index", "is", null);

  if (!companies) return null;

  for (const company of companies) {
    if (company.job_listing_index && jobUrl.startsWith(company.job_listing_index)) {
      return company.id;
    }
  }
  return null;
}

/**
 * Stage 2: Name-based matching or creation.
 * Case-insensitive exact match on companies.name.
 * If found: returns existing company id.
 * If not found: inserts a new company with just the name, returns new id.
 * Returns null if companyName is null/empty.
 */
export async function matchOrCreateCompanyByName(
  companyName: string | null | undefined
): Promise<string | null> {
  if (!companyName?.trim()) return null;

  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", companyName.trim())
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("companies")
    .insert({ name: companyName.trim() })
    .select("id")
    .single();

  if (error || !created) {
    console.error("Failed to create company for name:", companyName, error);
    return null;
  }

  return created.id;
}
