import { createHash } from "node:crypto";

const STRIP_EXACT = new Set(["ref", "source", "gh_src", "lever-origin"]);

export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }

  for (const key of [...u.searchParams.keys()]) {
    if (STRIP_EXACT.has(key) || /^utm_/i.test(key)) {
      u.searchParams.delete(key);
    }
  }

  const sorted = [...u.searchParams.entries()].sort(([ak, av], [bk, bv]) =>
    ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1
  );
  u.search = "";
  for (const [k, v] of sorted) u.searchParams.append(k, v);

  u.hash = "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase();

  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}

export function hashUrl(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}
