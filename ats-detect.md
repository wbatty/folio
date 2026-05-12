
ATS detection (regex router)
type ATSRoute =
  | { ats: 'greenhouse'; boardToken: string; jobId: string }
  | { ats: 'lever';      company: string;    jobId: string }
  | { ats: 'ashby';      boardHandle: string; jobId: string }
  | { ats: 'workday';    baseUrl: string }
  | { ats: 'unknown' };

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => ATSRoute]> = [
  [
    /boards\.greenhouse\.io\/([^\/]+)\/jobs\/(\d+)/i,
    m => ({ ats: 'greenhouse', boardToken: m[1], jobId: m[2] }),
  ],
  [
    /jobs\.lever\.co\/([^\/]+)\/([a-f0-9-]{36})/i,
    m => ({ ats: 'lever', company: m[1], jobId: m[2] }),
  ],
  [
    /jobs\.ashbyhq\.com\/([^\/]+)\/([a-f0-9-]{36})/i,
    m => ({ ats: 'ashby', boardHandle: m[1], jobId: m[2] }),
  ],
  [
    /([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com|myworkday\.com/i,
    (_, url) => ({ ats: 'workday', baseUrl: url }),
  ],
];

function detectATS(url: string): ATSRoute {
  for (const [pattern, builder] of PATTERNS) {
    const m = url.match(pattern);
    if (m) return builder(m);
  }
  return { ats: 'unknown' };
}

Custom domain fallback — Greenhouse: Greenhouse also appears on custom domains (hire.company.com, grnh.se short links) that the regex won't catch. After all patterns fail, run a lightweight HTTP probe before returning unknown:
async function probeForGreenhouseCustomDomain(url: string): Promise<ATSRoute | null> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5_000),
      redirect: 'follow',
    });

    // Greenhouse sets this response header on all board pages
    if (res.headers.get('x-greenhouse-application')) {
      const finalUrl = res.url;
      const m = finalUrl.match(/\/jobs\/(\d+)/);
      // boardToken can be inferred from the path segment before /jobs/
      const tokenMatch = finalUrl.match(/\/([^/]+)\/jobs\/\d+/);
      if (m && tokenMatch) {
        return { ats: 'greenhouse', boardToken: tokenMatch[1], jobId: m[1] };
      }
    }
  } catch { /* probe failed, treat as unknown */ }
  return null;
}

async function detectATS(url: string): Promise<ATSRoute> {
  for (const [pattern, builder] of PATTERNS) {
    const m = url.match(pattern);
    if (m) return builder(m);
  }
  // Regex miss — probe for Greenhouse custom domains before giving up
  const probed = await probeForGreenhouseCustomDomain(url);
  if (probed) return probed;
  return { ats: 'unknown' };
}

detectATS becomes async because of the probe. Update all call sites accordingly. The HEAD request adds at most 5s to the unknown path — acceptable since those URLs were already heading to the slower Cheerio triage.
Workday also appears on workday.com subdomains with varying numeric suffixes (.wd1., .wd5. etc.) — the pattern above covers all of them.

Shared utility — WAF-aware fetch
All HTML extraction routes (Lever posting page, Lever /apply, Cheerio triage) go through a single fetchHtml utility before any parsing. It throws WAFBlockedError on any signal that indicates a firewall or bot challenge — callers catch this and re-enqueue to the Playwright queue.
class WAFBlockedError extends Error {
  constructor(public url: string) {
    super(`WAF/bot check detected at ${url}`);
  }
}

interface FetchedPage {
  html: string;
  $: cheerio.CheerioAPI;
}

// Mimic a Chrome 124 navigation request on macOS — improves pass rate against
// WAFs that fingerprint missing or bot-like headers before serving a challenge.
const CHROME_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language':    'en-US,en;q=0.9',
  'Accept-Encoding':    'gzip, deflate, br, zstd',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest':     'document',
  'Sec-Fetch-Mode':     'navigate',
  'Sec-Fetch-Site':     'none',
  'Sec-Fetch-User':     '?1',
  'Cache-Control':      'max-age=0',
} as const;

async function fetchHtml(url: string): Promise<FetchedPage> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: CHROME_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new WAFBlockedError(url);
  }

  if (!res.ok) throw new WAFBlockedError(url);

  const html = await res.text();
  const $ = cheerio.load(html);

  // SPA shell or near-empty bot response
  if ($('body').text().trim().length < 200) throw new WAFBlockedError(url);

  // WAF challenge page fingerprints
  const title = $('title').text();
  if (
    title.includes('Just a moment') ||   // Cloudflare
    title.includes('Access Denied') ||   // generic WAF
    title.includes('Robot Check') ||     // Amazon WAF
    $('#challenge-form').length > 0 ||
    html.includes('window._cf_chl_opt')
  ) throw new WAFBlockedError(url);

  return { html, $ };
}

Any caller that catches WAFBlockedError should re-enqueue the job to url-ingest-playwright rather than propagating the error as a failure.

3A. Greenhouse route
Public, unauthenticated. No API key required.
Endpoint:
GET https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs/{jobId}?questions=true

What you get:
title — job title string
location.name — location string
content — job description as HTML (pipe through htmlToMarkdown())
questions[] — full application form schema when ?questions=true
Question schema (per question object):
interface GreenhouseQuestion {
  label: string;
  required: boolean;
  fields: Array<{
    name: string;             // form field key
    type: 'input_text' | 'textarea' | 'multi_value_single_select' | 'multi_value_multi_select' | 'attachment';
    values: Array<{ value: number | string; label: string }>;  // only populated for select types
  }>;
}

Parse to JobData:
async function fetchGreenhouse(boardToken: string, jobId: string): Promise<JobData> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`
  );
  if (!res.ok) throw new ATSFetchError('greenhouse', res.status);
  const data = await res.json();
  return {
    title: data.title,
    company: boardToken,           // boardToken is usually company slug
    location: data.location?.name ?? null,
    description_html: data.content,
    description_markdown: htmlToMarkdown(data.content),
    application_questions: data.questions.map(normalizeGreenhouseQuestion),
    raw_json: data,
  };
}

Known quirk: Greenhouse content field can be empty for confidential roles, or may return null. Always null-guard before passing to htmlToMarkdown.

3B. Lever route
Two-request chain — both pages are server-rendered HTML fetched with plain fetch. The api.lever.co endpoint resolves to the same HTML posting and provides no structured benefit; use Cheerio directly on both pages.
Request 1 — job posting page:
GET https://jobs.lever.co/{company}/{jobId}

Cheerio extracts title, location, and the full description from the rendered HTML. fetchHtml handles the WAF check — if the page is behind a bot challenge the error propagates up:
async function extractLeverPosting(company: string, jobId: string) {
  const { $ } = await fetchHtml(`https://jobs.lever.co/${company}/${jobId}`);

  const title = $('.posting-headline h2').text().trim();
  const location = $('.posting-categories .sort-by-location').text().trim() || null;
  const team = $('.posting-categories .sort-by-team').text().trim() || null;

  // Each content section is a .section div with an h3 header and a div body
  const descriptionHtml = $('.posting-description, .section-wrapper')
    .map((_, el) => $.html(el))
    .get()
    .join('\n');

  return { title, location, team, descriptionHtml };
}

Request 2 — application form:
GET https://jobs.lever.co/{company}/{jobId}/apply

The /apply page is server-rendered with the complete form schema embedded in window.__preloadedState:
async function extractLeverFormSchema(company: string, jobId: string): Promise<LeverFormField[]> {
  const { html, $ } = await fetchHtml(`https://jobs.lever.co/${company}/${jobId}/apply`);

  let stateJson: string | null = null;
  $('script').each((_, el) => {
    const src = $(el).html() ?? '';
    if (src.includes('window.__preloadedState')) {
      const match = src.match(/window\.__preloadedState\s*=\s*(\{[\s\S]+?\});\s*(?:<\/script>|$)/m);
      if (match) stateJson = match[1];
    }
  });

  if (!stateJson) throw new ParseError('lever', 'window.__preloadedState not found');
  const state = JSON.parse(stateJson);
  return state?.posting?.forms?.[0]?.fields ?? [];
}

Run both requests in parallel — they don't depend on each other:
async function fetchLever(company: string, jobId: string, originalUrl: string): Promise<JobData> {
  try {
    const [posting, formFields] = await Promise.all([
      extractLeverPosting(company, jobId),
      extractLeverFormSchema(company, jobId),
    ]);

    return {
      title: posting.title,
      company,
      location: posting.location,
      description_html: posting.descriptionHtml,
      description_markdown: htmlToMarkdown(posting.descriptionHtml),
      application_questions: normalizeLeverFields(formFields),
      raw_json: null,
    };
  } catch (err) {
    if (err instanceof WAFBlockedError) {
      await playwrightQueue.add('scrape', { url: originalUrl });
      throw err; // let the worker mark this job as handled
    }
    throw err;
  }
}

Known quirk: Lever description sections use inconsistent class names across boards (.posting-description vs .section-wrapper vs bare .section). The selector above targets both; validate against a few real boards and add additional selectors if needed.

3C. Ashby route
Ashby is increasingly common (Linear, Vercel, many startups). Despite having a public-facing job board, Ashby does not expose a REST API — the board is a React SPA that fetches all data via a single unauthenticated GraphQL endpoint. No API key required.
Endpoint:
POST https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting

The URL segments map directly to GraphQL variables:
jobs.ashbyhq.com/{company}/{uuid} → organizationHostedJobsPageName: company, jobPostingId: uuid
const ASHBY_GQL_QUERY = `
  query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
    jobPosting(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      jobPostingId: $jobPostingId
    ) {
      id
      title
      locationName
      workplaceType
      employmentType
      descriptionHtml
      isConfidential
      compensationTierSummary
      applicationForm {
        ...FormRenderParts
      }
    }
  }

  fragment FormRenderParts on FormRender {
    formControls { identifier title }
    sections {
      title
      fieldEntries {
        id
        field
        isRequired
        descriptionHtml
        isHidden
      }
    }
  }
`;

async function fetchAshby(boardHandle: string, jobId: string): Promise<JobData> {
  const res = await fetch(
    'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apollographql-client-name': 'frontend_non_user',
        'apollographql-client-version': '0.1.0',
      },
      body: JSON.stringify({
        operationName: 'ApiJobPosting',
        variables: {
          organizationHostedJobsPageName: boardHandle,
          jobPostingId: jobId,
        },
        query: ASHBY_GQL_QUERY,
      }),
    }
  );

  if (!res.ok) throw new ATSFetchError('ashby', res.status);
  const { data, errors } = await res.json();
  if (errors?.length) throw new ParseError('ashby', errors[0].message);

  const posting = data.jobPosting;
  return {
    title: posting.title,
    company: boardHandle,
    location: posting.locationName ?? null,
    remote: posting.workplaceType === 'Remote',
    description_html: posting.descriptionHtml,
    description_markdown: htmlToMarkdown(posting.descriptionHtml),
    application_questions: normalizeAshbyForm(posting.applicationForm),
    raw_json: posting,
  };
}

Form schema normalization: The response separates field type/label info (formControls) from the field entries in each section. Join them on identifier === field to get the human-readable label:
function normalizeAshbyForm(form: AshbyFormRender): ApplicationQuestion[] {
  const controlMap = new Map(form.formControls.map(c => [c.identifier, c.title]));
  return form.sections
    .flatMap(s => s.fieldEntries)
    .filter(e => !e.isHidden)
    .map(e => ({
      id: e.id,
      label: controlMap.get(e.field) ?? htmlToMarkdown(e.descriptionHtml ?? ''),
      type: inferAshbyFieldType(e.field),
      required: e.isRequired,
    }));
}

function inferAshbyFieldType(fieldIdentifier: string): QuestionType {
  if (fieldIdentifier.includes('resume') || fieldIdentifier.includes('file')) return 'file';
  if (fieldIdentifier.includes('coverLetter')) return 'file';
  if (fieldIdentifier.includes('textarea') || fieldIdentifier.includes('longText')) return 'long_text';
  if (fieldIdentifier.includes('select') || fieldIdentifier.includes('dropdown')) return 'select';
  if (fieldIdentifier.includes('checkbox') || fieldIdentifier.includes('boolean')) return 'boolean';
  return 'short_text';
}

Note on surveyForms: The full query returns surveyForms alongside applicationForm — these are post-application EEOC/diversity surveys. Omit from applicationForm normalization; they're not part of the submission form.

3D. Workday route (Playwright + XHR intercept)
Workday's anti-bot stack (DataDome / Akamai) makes DOM parsing unreliable. The SPA loads its job data via an internal XHR to /wday/cxs/... — intercept that instead of parsing the rendered HTML.
async function fetchWorkday(url: string): Promise<JobData> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let captured: WorkdayJobResponse | null = null;

  page.on('response', async (response) => {
    const respUrl = response.url();
    if (
      respUrl.includes('/wday/cxs/') &&
      response.request().method() === 'GET' &&
      response.headers()['content-type']?.includes('application/json')
    ) {
      try {
        const json = await response.json();
        // Workday XHR responses have jobPostingInfo at this path
        if (json?.jobPostingInfo) captured = json;
      } catch { /* non-JSON response, ignore */ }
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await ctx.close();
  await browser.close();

  if (!captured) throw new ParseError('workday', 'XHR payload not captured');
  return normalizeWorkday(captured);
}

Important: Close the browser context immediately after capture — don't wait for full page render. This minimizes memory footprint and time.
Workday XHR response shape (field paths vary slightly by tenant):
jobPostingInfo.title
jobPostingInfo.externalUrl
jobPostingInfo.jobPostingDescription — HTML description
jobPostingInfo.additionalLocations[]

3E. Cheerio triage (non-ATS fallback)
For URLs that don't match any known ATS, attempt fetchHtml before committing to Playwright. WAF/bot detection is handled by the shared utility — triage only needs to do ATS-specific selector verification on top:
async function cheerioTriage(url: string): Promise<'pass' | 'playwright'> {
  let page: FetchedPage;
  try {
    page = await fetchHtml(url);
  } catch {
    // WAFBlockedError or network failure — hand to Playwright
    return 'playwright';
  }

  const { html, $ } = page;

  // ATS-specific selector sanity check (catches partial URL matches / iframes)
  if (url.includes('greenhouse.io') && $('#app-body').length === 0) return 'playwright';
  if (url.includes('lever.co') && $('.posting-headline').length === 0) return 'playwright';

  return 'pass';
}

On 'pass', the caller has html and $ ready — pipe html through htmlToMarkdown(). On 'playwright', enqueue to url-ingest-playwright.
