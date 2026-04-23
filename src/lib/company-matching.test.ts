import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase";
import { matchCompanyByUrl, matchOrCreateCompanyByName } from "./company-matching";

const mockFrom = vi.mocked(supabase.from);

// Helper: builds a chainable query mock whose final method resolves with `result`.
function makeSelectChain(result: unknown, methods: string[] = ["select", "not"]) {
  const chain: Record<string, unknown> = {};
  const last = methods[methods.length - 1];
  for (const m of methods) {
    chain[m] = m === last ? vi.fn().mockResolvedValue(result) : vi.fn().mockReturnValue(chain);
  }
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── matchCompanyByUrl ────────────────────────────────────────────────────────

describe("matchCompanyByUrl", () => {
  it("returns null when supabase returns no companies", async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: [] }) as never);
    expect(await matchCompanyByUrl("https://jobs.example.com/123")).toBeNull();
  });

  it("returns null when supabase returns null data", async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: null }) as never);
    expect(await matchCompanyByUrl("https://jobs.example.com/123")).toBeNull();
  });

  it("returns the matching company id when the URL starts with job_listing_index", async () => {
    mockFrom.mockReturnValue(
      makeSelectChain({
        data: [{ id: "company-1", job_listing_index: "https://jobs.example.com" }],
      }) as never
    );
    expect(await matchCompanyByUrl("https://jobs.example.com/position/42")).toBe("company-1");
  });

  it("returns null when no company's index matches the URL", async () => {
    mockFrom.mockReturnValue(
      makeSelectChain({
        data: [{ id: "company-1", job_listing_index: "https://jobs.acme.com" }],
      }) as never
    );
    expect(await matchCompanyByUrl("https://jobs.example.com/position/42")).toBeNull();
  });

  it("returns the first matching company id when multiple could match", async () => {
    mockFrom.mockReturnValue(
      makeSelectChain({
        data: [
          { id: "company-1", job_listing_index: "https://jobs.example.com" },
          { id: "company-2", job_listing_index: "https://jobs.example.com/eng" },
        ],
      }) as never
    );
    expect(await matchCompanyByUrl("https://jobs.example.com/eng/123")).toBe("company-1");
  });

  it("requires the URL to start with the index (not just contain it)", async () => {
    mockFrom.mockReturnValue(
      makeSelectChain({
        data: [{ id: "company-1", job_listing_index: "https://jobs.example.com" }],
      }) as never
    );
    expect(await matchCompanyByUrl("https://other.com?redirect=https://jobs.example.com")).toBeNull();
  });
});

// ─── matchOrCreateCompanyByName ───────────────────────────────────────────────

describe("matchOrCreateCompanyByName", () => {
  it("returns null for null input", async () => {
    expect(await matchOrCreateCompanyByName(null)).toBeNull();
  });

  it("returns null for undefined input", async () => {
    expect(await matchOrCreateCompanyByName(undefined)).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await matchOrCreateCompanyByName("")).toBeNull();
  });

  it("returns null for a whitespace-only string", async () => {
    expect(await matchOrCreateCompanyByName("   ")).toBeNull();
  });

  it("returns the existing company id when found by name", async () => {
    const findChain = makeSelectChain(
      { data: { id: "existing-id" } },
      ["select", "ilike", "limit", "maybeSingle"]
    );
    mockFrom.mockReturnValue(findChain as never);

    expect(await matchOrCreateCompanyByName("Acme Corp")).toBe("existing-id");
  });

  it("creates and returns a new company id when no match is found", async () => {
    const findChain = makeSelectChain(
      { data: null },
      ["select", "ilike", "limit", "maybeSingle"]
    );
    const insertSelectChain = { single: vi.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }) };
    const insertChain = { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(insertSelectChain) }) };

    mockFrom
      .mockReturnValueOnce(findChain as never)
      .mockReturnValueOnce(insertChain as never);

    expect(await matchOrCreateCompanyByName("New Corp")).toBe("new-id");
  });

  it("returns null when the insert fails", async () => {
    const findChain = makeSelectChain(
      { data: null },
      ["select", "ilike", "limit", "maybeSingle"]
    );
    const insertSelectChain = {
      single: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    };
    const insertChain = { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(insertSelectChain) }) };

    mockFrom
      .mockReturnValueOnce(findChain as never)
      .mockReturnValueOnce(insertChain as never);

    expect(await matchOrCreateCompanyByName("Failing Corp")).toBeNull();
  });

  it("passes a trimmed name to the ilike query", async () => {
    const findChain = makeSelectChain(
      { data: { id: "trimmed-id" } },
      ["select", "ilike", "limit", "maybeSingle"]
    );
    mockFrom.mockReturnValue(findChain as never);

    await matchOrCreateCompanyByName("  Acme Corp  ");

    const ilikeMock = vi.mocked(findChain.ilike as ReturnType<typeof vi.fn>);
    expect(ilikeMock).toHaveBeenCalledWith("name", "Acme Corp");
  });
});
