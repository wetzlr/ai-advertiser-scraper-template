# Ai-Advertiser · Lead Scraper (Day 2 Starter)

The starter template for **Day 2 of the Ai-Advertiser 3-Day Workshop** — a working Base44 lead scraper that pulls real local businesses from Google Maps via Apify, complete with phone numbers, websites, and ratings.

Use this template instead of prompting Base44 to build the scraper from scratch. Building it yourself works in theory; in practice the backend functions and entity schema are fiddly enough that most students stall out. This template ships the working code so you can skip straight to your first scrape.

## What you get

- **Lead Scraper page** — niche + city + max-results form, paginated results table, CSV export, Qualified checkbox
- **Two backend functions**:
  - `startScrape` — kicks off an Apify scrape and tracks it
  - `checkAndImportRun` — polls Apify and imports finished leads into the Prospect table
- **Two entities**:
  - `Prospect` — one row per scraped business (place_id, name, phone, email, website, address, rating, niche, city)
  - `ScrapeRun` — one row per scrape job (run_id, status, inserted/skipped counts)
- **All shadcn UI components** + Tailwind + React Router + TanStack Query pre-wired

## What you do

1. Use this template to create a new Base44 app (see the workshop SOP for the exact click path).
2. Sign up for Apify ([affiliate link in the SOP](https://www.apify.com?fpr=aeo45a)) and grab your API token.
3. Add the token as a secret named `APIFY_TOKEN` in your new Base44 app's Dashboard → Secrets.
4. Hit the Scrape button. You should have 10 real leads within 30-90 seconds.

That's the whole workshop module. The SOP at https://base44-sops.vercel.app/6lq4r walks you through every click.

## Day 3

Day 3 of the workshop adds the pipeline CRM on top of these leads. That happens in your same Base44 app — you'll prompt Base44 to add the Stage entity, Pipeline page, and drag-and-drop. The Day 3 SOP at https://base44-sops.vercel.app/wfbln has the prompts.

## Local development (optional)

If you want to edit the code locally as well as in the Base44 Builder:

```
npm install
cp .env.example .env.local   # then fill in VITE_BASE44_APP_ID + VITE_BASE44_APP_BASE_URL
npm run dev
```

Anything you push to your fork of this repo will sync back into your Base44 app.

## Docs + support

- Base44 GitHub sync: https://docs.base44.com/Integrations/Using-GitHub
- Base44 support: https://app.base44.com/support
- Workshop support: drop a message in the Ai-Advertiser Discord
