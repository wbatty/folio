import { assertPublicUrl } from "@/lib/scrape";

export type ATSRoute =
  | { ats: "greenhouse"; boardToken: string; jobId: string }
  | { ats: "lever"; company: string; jobId: string }
  | { ats: "ashby"; boardHandle: string; jobId: string }
  | { ats: "workday"; baseUrl: string }
  | { ats: "unknown" };

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => ATSRoute]> = [
  [
    /boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i,
    (m) => ({ ats: "greenhouse", boardToken: m[1], jobId: m[2] }),
  ],
  [
    /jobs\.lever\.co\/([^/]+)\/([a-f0-9-]{36})/i,
    (m) => ({ ats: "lever", company: m[1], jobId: m[2] }),
  ],
  [
    /jobs\.ashbyhq\.com\/([^/]+)\/([a-f0-9-]{36})/i,
    (m) => ({ ats: "ashby", boardHandle: m[1], jobId: m[2] }),
  ],
  [
    /([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com|myworkday\.com/i,
    (m) => ({ ats: "workday", baseUrl: m[1] ?? new URL(m.input ?? "").hostname }),
  ],
];

async function probeForGreenhouseCustomDomain(url: string): Promise<ATSRoute | null> {
  try {
    assertPublicUrl(url);
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    if (res.headers.get("x-greenhouse-application")) {
      const finalUrl = res.url;
      const jobMatch = finalUrl.match(/\/jobs\/(\d+)/);
      const tokenMatch = finalUrl.match(/\/([^/]+)\/jobs\/\d+/);
      if (jobMatch && tokenMatch) {
        return { ats: "greenhouse", boardToken: tokenMatch[1], jobId: jobMatch[1] };
      }
    }
  } catch {
    // probe failed — treat as unknown
  }
  return null;
}

export async function detectATS(url: string): Promise<ATSRoute> {
  for (const [pattern, builder] of PATTERNS) {
    const m = url.match(pattern);
    if (m) return builder(m);
  }
  const probed = await probeForGreenhouseCustomDomain(url);
  if (probed) return probed;
  return { ats: "unknown" };
}
