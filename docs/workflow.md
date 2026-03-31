# Workflow

## Phase 1 — Discovery (The RSS Poller)

In NestJS, use `@nestjs/schedule` for cron jobs and `rss-parser` to normalize feeds. Since we're targeting Sri Lankan outlets, the likely endpoints include:

- Ada Derana: http://www.adaderana.lk/rss.php
- Daily Mirror: https://www.dailymirror.lk/rss
- NewsFirst: https://english.newsfirst.lk/rss

### The Ingestion Service

TypeScript example (NestJS):

```ts
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as Parser from "rss-parser";

@Injectable()
export class NewsDiscoveryService {
  private parser = new Parser();

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    const feeds = [
      /* URLs above */
    ];
    for (const url of feeds) {
      const feed = await this.parser.parseURL(url);
      for (const item of feed.items) {
        // 1. Check if URL already exists in Postgres (Drizzle)
        // 2. If new, push to Scraper Queue (BullMQ)
      }
    }
  }
}
```

## Phase 2 — Digging (The Playwright Scraper)

RSS feeds provide only snippets. To analyze bias reliably you need full-article text — use a Playwright-based scraper to render and capture the article body.

Tip: Many Sri Lankan sites are heavy on ads and tracking. Use `route.abort()` to skip images, fonts, and CSS to speed up scraping and reduce bandwidth.

TypeScript example:

```ts
// Inside your ScraperService
const page = await context.newPage();
await page.route("**/*.{png,jpg,jpeg,css,woff,woff2}", (route) =>
  route.abort(),
);

await page.goto(articleUrl, { waitUntil: "domcontentloaded" });
const html = await page.content();
// Use @mozilla/readability to extract the "clean" body from `html`
```

## Phase 3 — Analysis (The LLM "Bias" Brain)

This is the demo "magic" — don't ask a binary question like "is this biased?" Instead request a structured JSON report so you can build fast DuckDB queries and visualizations.

The "High-Velocity" prompt (send to your LLM provider — e.g., Groq, Gemini, or Llama):

```
Act as a senior political linguist. Analyze the following news article from a Sri Lankan source for media bias. Return ONLY a JSON object with the following keys:

bias_score: (-1.0 to 1.0, where -1 is anti-government, 1 is pro-government).

framing: (A 1-sentence description of the narrative frame used).

loaded_terms: (List of 3-5 words used to trigger emotional response).

omission_check: (Does this article ignore a key counter-perspective? Yes/No).

sentiment: (hostile, neutral, or celebratory).
```

## Phase 4 — Storage & The "DuckDB" Flex

Once you receive the structured JSON from the LLM:

- **Postgres:** Store the full article, metadata, and the LLM JSON report as the source of record.
- **DuckDB:** Maintain a local `.duckdb` file that mirrors aggregated `bias_score` time-series for sub-second dashboard queries.

Why? When a user asks, "Show me the bias trend of Ada Derana vs. Daily Mirror over the last 30 days," a vectorized DuckDB query can return the result in <10ms, making the demo feel instantaneous.
