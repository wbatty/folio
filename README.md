# Folio

An AI-powered job application tracker. Paste a job URL and Folio scrapes the posting, extracts structured details via Claude, and helps you manage every stage of your search — from research through offer.

## Features

- **AI job parsing** — paste a job URL; Playwright scrapes it and Claude extracts the company, title, and description automatically
- **Application pipeline** — track status from `Researching` → `Pending` → `Applied` → `Interviewing` → `Offered` / `Denied`
- **AI assistant** — chat with Claude about each job to draft cover letters, answer application questions, and prep for interviews
- **Company tracker** — maintain a list of target companies with their job listing pages and your application history
- **Resume management** — upload a PDF resume; it's attached to Claude's context for every AI interaction
- **Metrics dashboard** — applied count, active interviews, average time per stage
- **Telegram bot** *(optional)* — send job URLs from your phone; they're queued and processed automatically
- **CSV import** — bulk-import an existing spreadsheet of applications

## Architecture

```
Browser (Next.js)  ←→  API Routes  ←→  Supabase (Postgres + Storage)
                                   ←→  Anthropic (Claude Agent SDK)
                                   ←→  Playwright (headless scraping)

Telegram → Supabase Edge Function → pgmq queue → Queue Consumer → API Routes
```

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [Anthropic API key](https://console.anthropic.com)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/folio.git
cd folio
npm install
npx playwright install chromium
```

### 2. Set up the database

In your Supabase project, run each migration in order via the SQL editor or the Supabase CLI:

```bash
# Using the CLI (recommended)
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file in `supabase/migrations/` into the Supabase SQL editor manually.

You also need a **Storage bucket** named `resumes` (set to private) for PDF uploads. Create it in the Supabase dashboard under Storage.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values. See [`.env.example`](.env.example) for descriptions.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Upload your resume, then paste a job URL to get started.

## Telegram Bot (optional)

The Telegram integration lets you forward job URLs from your phone directly into Folio.

### How it works

1. You send a job URL to your Telegram bot
2. The bot's webhook (a Supabase Edge Function) enqueues the URL in a pgmq queue
3. A long-running queue consumer process picks it up and calls the API to create and scrape the job
4. The bot notifies you once research is complete

### Setup

**a. Create a Telegram bot**

Message [@BotFather](https://t.me/BotFather) on Telegram, use `/newbot`, and save the token.

**b. Deploy the Edge Function**

```bash
supabase functions deploy telegram-webhook
supabase secrets set TELEGRAM_BOT_TOKEN=<your-token>
supabase secrets set TELEGRAM_WEBHOOK_SECRET=<any-random-string>
```

**c. Register the webhook**

```bash
npm run setup-webhook
```

**d. Start the queue consumer**

Run this as a separate process alongside the Next.js server:

```bash
APP_URL=http://localhost:3000 npm run consumer
```

In production, run it as a background service (systemd, PM2, Docker, etc.).

## Deployment

Folio is a standard Next.js app. Any platform that runs Node.js works.

**Vercel** (easiest):
1. Push to GitHub and import the repo on Vercel
2. Set all environment variables in the Vercel project settings
3. Note: the queue consumer cannot run on Vercel — use a separate server or a free-tier VM

**Self-hosted**:
```bash
npm run build
npm start
```

## Security

**This app has no built-in authentication.** It is designed for personal, single-user, local or private deployment. Do not expose it to the public internet without adding authentication (e.g. Supabase Auth + a Next.js middleware guard).

Data notes:
- All application data is stored in your own Supabase project
- Job descriptions and resume content are sent to **Anthropic's API** for AI features
- If using the Telegram bot, job URLs are routed through Telegram's servers

Before open-sourcing or sharing your deployment, rotate all credentials in `.env.local` — never commit that file.

## License

MIT
