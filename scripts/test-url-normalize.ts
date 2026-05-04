import { normalizeUrl, hashUrl } from "../src/lib/url-normalize";

let failures = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`        expected: ${expected}`);
    console.log(`        actual:   ${actual}`);
    failures++;
  }
}

function throws(label: string, fn: () => void) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  console.log(`${threw ? "PASS" : "FAIL"}  ${label}`);
  if (!threw) failures++;
}

// utm_* glob and listed exact params stripped
eq(
  "strips utm_* glob",
  normalizeUrl("https://x.com/jobs/1?utm_source=a&utm_foo=b&keep=z"),
  "https://x.com/jobs/1?keep=z"
);
eq(
  "strips ref/source/gh_src/lever-origin",
  normalizeUrl("https://x.com/jobs/1?ref=a&source=b&gh_src=c&lever-origin=d&keep=z"),
  "https://x.com/jobs/1?keep=z"
);

// Trailing slash stripped from non-root paths
eq(
  "strips trailing slash on path",
  normalizeUrl("https://x.com/jobs/1/"),
  "https://x.com/jobs/1"
);
eq(
  "preserves root slash",
  normalizeUrl("https://x.com/"),
  "https://x.com/"
);
eq(
  "strips trailing slash before query",
  normalizeUrl("https://x.com/jobs/1/?a=1"),
  "https://x.com/jobs/1?a=1"
);

// Host lowercased, path case preserved
eq(
  "lowercases host, preserves path case",
  normalizeUrl("HTTPS://Boards.Greenhouse.IO/Acme/Jobs/AbC123"),
  "https://boards.greenhouse.io/Acme/Jobs/AbC123"
);

// Query params sorted
eq(
  "sorts query params alphabetically",
  normalizeUrl("https://x.com/?b=2&a=1&c=3"),
  "https://x.com/?a=1&b=2&c=3"
);
eq(
  "two URLs with same params different order hash equal",
  hashUrl(normalizeUrl("https://x.com/jobs/1?b=2&a=1")),
  hashUrl(normalizeUrl("https://x.com/jobs/1?a=1&b=2"))
);

// Fragment stripped
eq(
  "strips fragment",
  normalizeUrl("https://x.com/jobs/1#apply"),
  "https://x.com/jobs/1"
);

// Cross-poster scenario: same posting, different tracking → same hash
eq(
  "cross-posted URLs hash equal",
  hashUrl(normalizeUrl("https://boards.greenhouse.io/acme/jobs/123?utm_source=indeed&gh_src=xyz")),
  hashUrl(normalizeUrl("https://boards.greenhouse.io/acme/jobs/123?utm_source=linkedin&ref=feed#apply"))
);

// Hash format
const h = hashUrl("anything");
eq("hash is 64 hex chars", /^[0-9a-f]{64}$/.test(h), true);

// Malformed URL throws
throws("rejects malformed URL", () => normalizeUrl("not a url"));
throws("rejects ftp", () => normalizeUrl("ftp://example.com/"));

// Hash-only check: identical normalized → identical hash
eq(
  "deterministic hash",
  hashUrl("https://x.com/jobs/1"),
  hashUrl("https://x.com/jobs/1")
);

console.log(`\n${failures === 0 ? "All tests passed." : `${failures} failure(s).`}`);
process.exit(failures === 0 ? 0 : 1);
