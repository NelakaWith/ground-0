# Workflow

## Phase 1 — Discovery Queue (The RSS Poller)

**Queue 1: discovery**

- Use `@nestjs/schedule` for cron jobs and `rss-parser` to normalize feeds.
- For each feed item:
  1. **Check DB:** See if the article URL exists in Postgres (Drizzle ORM). _(DB update: read)_
  2. **If new:** Save minimal metadata (URL, title, pubDate, provider) to Postgres. _(DB update: insert)_
  3. **Enqueue:** Push a job to the Scraper Queue (BullMQ) for each new article.

Example:

```ts
for (const item of feed.items) {
  const exists = await db.articles.findFirst({ where: { url: item.link } });
  if (!exists) {
    await db.articles.create({
      data: {
        url: item.link,
        title: item.title,
        pubDate: item.pubDate,
        provider,
      },
    });
    await scraperQueue.add("scrape-article", { url: item.link });
  }
}
```

## Phase 2 — Scraper Queue (The Playwright Scraper)

**Queue 2: scraper**

- Worker consumes jobs from the Scraper Queue.
- For each job:
  1. **Fetch:** Use Playwright to render and extract the article HTML.
  2. **Extract:** Use `@mozilla/readability` to get the clean article body.
  3. **Save:** Store the full article text in Postgres, update the article record. _(DB update: update)_
  4. **Enqueue:** Push a job to the Analysis Queue for the new article.

Example:

```ts
const html = await fetchAndExtract(articleUrl);
await db.articles.update({
  where: { url: articleUrl },
  data: { html, extracted: true },
});
await analysisQueue.add("analyze-article", { url: articleUrl });
```

bias_score: (-1.0 to 1.0, where -1 is anti-government, 1 is pro-government).
sentiment: (hostile, neutral, or celebratory).

## Phase 3 — Analysis Queue (The LLM "Bias" Brain)

**Queue 3: analysis**

- Worker consumes jobs from the Analysis Queue.
- For each job:
  1. **Analyze:** Call LLM (Groq, Gemini, etc.) with the article text and prompt for structured JSON.
  2. **Save:** Store the LLM JSON result in Postgres, update the article record. _(DB update: update)_
  3. **Sync:** Optionally, sync summary/metrics to DuckDB for fast dashboard queries. _(DB update: insert/update in DuckDB)_

Prompt example:

```
Act as a senior political linguist. Analyze the following news article from a Sri Lankan source for media bias. Return ONLY a JSON object with the following keys:

bias_score: (-1.0 to 1.0, where -1 is anti-government, 1 is pro-government).
framing: (A 1-sentence description of the narrative frame used).
loaded_terms: (List of 3-5 words used to trigger emotional response).
omission_check: (Does this article ignore a key counter-perspective? Yes/No).
sentiment: (hostile, neutral, or celebratory).
```

## Phase 4 — Storage & The "DuckDB" Flex

- **Postgres:** Source of record for all articles, metadata, and LLM results. _(DB update: insert/update for every phase)_
- **DuckDB:** Mirrors aggregated metrics for fast dashboard queries. _(DB update: insert/update in analysis phase)_

Why? When a user asks, "Show me the bias trend of Ada Derana vs. Daily Mirror over the last 30 days," a vectorized DuckDB query can return the result in <10ms, making the demo feel instantaneous.
