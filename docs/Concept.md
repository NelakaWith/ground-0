# RSS News Bias Checker (V1 MVP)

## 1. Project Goal

[YC showcase approach](./YC%20showcase%20approach.md)

Build an automated pipeline that monitors Sri Lankan news via RSS feeds and uses Groq to analyze the political framing and bias of news snippets (Headlines + Summaries).

## 2. Technical Stack

- **Language:** TypeScript (5.x+) running on Node.js (18+ recommended).

- **Networking & Browser automation:** `undici` (HTTP client) as the primary fetch layer and `playwright` (Chromium) as a browser fallback for JS-heavy pages and WAF/Cloudflare challenges; use `tough-cookie` for cookie handling when necessary.

- **Parsing:** `rss-parser` to canonicalize RSS/Atom feeds.

- **Text Extraction:** `jsdom` + `@mozilla/readability` for robust article extraction; `unfluff` as a pragmatic fallback for messy HTML.

- **AI Engine / LLM:** `groq` (primary AI provider via Node SDK / HTTP API) for multi-stage prompting, structured JSON extraction, and embedding generation; orchestrate multi-step prompts with LangChainJS (`langchain`) where helpful. Optionally fall back to `google-generativeai` or Hugging Face when appropriate.

- **Target-dependent NLP / Sentiment:** Replace `NewsSentiment` with an LLM-first pipeline: use Groq to perform entity/target detection and then produce target-specific sentiment scores and framing (charged adjectives). Optionally augment with Hugging Face Inference (`@huggingface/inference`) or `onnxruntime-node` for deterministic model options.

- **Validation / Typing:** `zod` for runtime schema validation and TypeScript types (generated via `quicktype` or `openapi-typescript`) for compile-time safety.

- **Clustering / Near-duplicate detection:** Use `string-similarity` or `fast-fuzzy` for headline similarity (85% threshold) and `fuse.js` for fuzzy grouping. For scale, compute embeddings (groq/HF) and use `pgvector` + `pg` or `hnswlib-node` for vector NN search.

- **Storage:** PostgreSQL accessed via `pg` with the `pgvector` extension for embedding storage and nearest-neighbor queries.

- **Analytics / Dataframes:** `duckdb` Node bindings for OLAP/back-testing and `danfojs-node` or `arquero` for DataFrame-style transforms.

- **Rate limiting / Task queueing:** `bottleneck` or `p-queue` to throttle external API calls; `bullmq` / `bee-queue` for durable background jobs if required.

- **Frontend / Dashboard:** `Next.js` (React + TypeScript) for the dashboard; charts via `react-plotly.js` or `visx`; TailwindCSS for styling.

- **Dev tooling:** `pnpm`/`npm`, `ts-node`, `tsup`/`esbuild`, `eslint`, `prettier`, and `openapi-typescript` or `quicktype` to generate types from JSON outputs.

### A. Ingestion & Extraction (The "Hustle")

- **`undici`**: Fast, standards-compliant HTTP client used for regular RSS requests; configure headers to mimic Chrome/120 and use connection pooling.

- **`playwright`**: Browser fallback when site-level JS or Cloudflare blocks `undici` requests — run a controlled Chromium instance with realistic device emulation and cookie management to solve challenges.

- **`rss-parser`**: Normalize feed formats (RSS/Atom) into consistent JSON records.

- **`jsdom` + `@mozilla/readability`**: Extract readable article bodies for LLM context. Use `unfluff` as a pragmatic fallback for pages where readability fails.

### B. The Intelligence Layer (The "Brain")

- **`groq` (Node SDK / HTTP API)**: Groq is the primary AI provider for the multi-stage analysis (entity detection, target-specific sentiment, framing extraction, and embeddings).

- **The "Double-Pass" Analysis (TypeScript implementation):**
  1.  **Pass 1 (Entity Detection):** Prompt Groq to return a compact JSON schema listing detected `Target`(s) and entities per article (e.g., "The President", "The JVP", "The Central Bank"). Validate with `zod` and map to TypeScript types.

  2.  **Pass 2 (Targeted Sentiment Score):** For each detected target, call Groq to return a target-specific sentiment score, charged-adjectives list, and a one-line rationale. Persist structured JSON.

- **Framing Extraction:** Use structured JSON prompts to capture charged adjectives and short frames (e.g., _State Media:_ "The necessary economic adjustment..." vs _Private Media:_ "The crippling tax hike...").

- **Optional specialized models:** If deterministic ML models are preferred, call the Hugging Face Inference API (`@huggingface/inference`) or run optimized models locally via `onnxruntime-node`.

### C. Storage & Data Engineering

- **`pg` + `pgvector`**: PostgreSQL as the primary store with `pgvector` for embeddings and semantic search.

- **`duckdb` (Node bindings)**: High-performance local OLAP for historical back-testing and large-blob analytics.

- **`danfojs-node` / `arquero`**: DataFrame-like transformations and aggregations for ETL and demo exports.

### D. Visualization & UI (The "Showcase")

- **`Next.js` + React (TypeScript)**: Production-ready dashboard, server-side rendering where appropriate, and API routes for ingestion/metrics.

- **`react-plotly.js`**: Interactive Sentiment Spectrum, Omission Alert overlays, and the Bias Ticker.

- **Real-time / Ticker:** SSE or WebSockets via Next.js API routes or a lightweight socket server for live Bias Ticker updates.

## 3. Phased Implementation Roadmap

[RoadMap](./RoadMap.md)

## 4. Verified RSS Sources (Working)

| Source                      | ID               | Language | Reach               | Tone Expectation           |
| --------------------------- | ---------------- | -------- | ------------------- | -------------------------- |
| **Daily Mirror (Breaking)** | `dm-breaking-en` | English  | High (Private)      | Independent / Progressive  |
| **Daily Mirror (Top)**      | `dm-top-en`      | English  | High (Private)      | Independent / Progressive  |
| **Daily News**              | `dn-en`          | English  | High (State)        | Pro-Government             |
| **The Island**              | `isl-en`         | English  | High (Private)      | Critical / SLFP Leaning    |
| **Ada Derana**              | `ad-en`          | English  | High (TV/Web)       | Breaking / Sensationalized |
| **EconomyNext**             | `en-en`          | English  | High (Business)     | Financial / Neoliberal     |
| **News.lk**                 | `news-lk-en`     | English  | High (State)        | Official Govt Portal       |
| **Lankadeepa (News)**       | `ld-news-si`     | Sinhala  | Very High (Private) | Centrist / Popular         |
| **Lankadeepa (Foreign)**    | `ld-foreign-si`  | Sinhala  | Very High (Private) | Centrist / Popular         |
| **Dinamina**                | `din-si`         | Sinhala  | High (State)        | Pro-Government             |
| **Divaina**                 | `div-si`         | Sinhala  | High (Private)      | Nationalist                |

## 5. Risk Mitigation & Logic

- **Rate Limiting:** Use `bottleneck` or `p-queue` to throttle API calls to Groq (respect your Groq plan rate limits; e.g., 15 requests/min). For simple scripts, `await new Promise(r => setTimeout(r, 4000))` between batches is acceptable.
- **Firewall Bypass:** Primary requests use `undici` with Chrome/120 headers and robust header/cookie management; fall back to `playwright` (Chromium) for browser-level rendering and challenge solving when required.
- **Legal Compliance:** The app will only process data syndicated via public RSS feeds, avoiding unauthorized scraping of paywalled full-text content.

## 6. Success Metrics for MVP

1. **Zero-Maintenance Ingestion:** Feeds refresh automatically via a simple cron job.
2. **Structural Integrity:** Every analyzed article has a valid JSON bias report.
3. **Discovery:** The dashboard successfully highlights cases where state vs. private media use different "leads” for the same story.
