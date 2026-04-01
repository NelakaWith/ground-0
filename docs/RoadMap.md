# RoadMap

This phased roadmap expands your existing blueprint into a YC-caliber execution strategy. It shifts the focus from "building a tool" to "validating a data moat," prioritizing the **90/10 solution** (achieving 90% of the value with 10% of the effort) to ensure you have a "quantum of utility" for the demo.

### **Phase 1: The Robust Ingestion Engine (The "Hustle")**

- [ ] **Goal:** Establish a 100% reliable, de-duplicated data stream from Sri Lankan media using a stepped queue pipeline.

- [x] **Infrastructure:** \* `undici` (HTTP client) with Chrome/120 headers; fallback to `playwright` (Chromium) for JS-heavy pages and challenge solving.

- [x] **Orchestrator / API:** `NestJS` (apps/api) using `@nestjs/schedule` for cron-driven discovery and **multi-stage BullMQ queues**:
  - **Queue 1 (discovery):** Finds new links, saves to Postgres, enqueues scraper jobs.
  - **Queue 2 (scraper):** Runs Playwright, saves text to Postgres, enqueues analysis jobs.
  - **Queue 3 (analysis):** Calls LLM, saves final data to Postgres (including embeddings with `pgvector`).
  - [x] `rss-parser`: Standardize RSS/Atom feeds.
  - [x] **Logic:** Implement **"Near-Duplicate Detection"** using fuzzy string libraries (`string-similarity` / `fast-fuzzy`) or embedding similarity (85% threshold) with `pgvector` to flag the same "Event Cluster" immediately.
- [x] **DB Update Points:**
  - [x] Setting up Drizzle ORM and Article Schema.
  - [x] Discovery: Insert new article metadata (checks for existing URLs).
  - [x] Scraper: Update article with full text.
  - Analysis: Update article with LLM results; sync embeddings to `pgvector`.
- [ ] **YC Angle:** This shows "resourcefulness.” You aren't just using a standard library; you're actively overcoming local technical hurdles (WAFs/Cloudflare).

### **Phase 2: The Intelligence Hybrid (The "Brain")**

- [ ] **Goal:** Move from general sentiment to "target-dependent” bias.

- [ ] **The "Double-Pass" Analysis:**
  - [ ] **Pass 1 (Entity Detection):** Use `groq` to identify the "Target" of the news (e.g., "The President," "The JVP," "The Central Bank").
  - [ ] **Pass 2 (Sentiment Score):** Pipe that specific target into an LLM-first pipeline (Groq or an optional specialized inference model) to produce target-specific sentiment scores and charged-adjective lists.
- [ ] **Framing Extraction:** Use `groq` to extract **"Charged Adjectives."**
  - [ ] _State Media:_ "The necessary economic adjustment..."
  - [ ] _Private Media:_ "The crippling tax hike..."
- [ ] **YC Angle:** This demonstrates "technical depth.” You aren't just "wrapping an API"; you're building a multi-stage pipeline that combines LLM reasoning with deterministic NLP where needed.

- [x] **Scraper details:** Use a Playwright `ScraperService` (worker) that consumes jobs from `bullmq`, renders pages with `route.abort()` for non-HTML assets, extracts HTML, runs `@mozilla/readability` for the article body, then forwards content to the Analysis service.
- [ ] **Technical Dredging:** For snippet-only or paywalled sources (e.g., electronic media, paywalled papers), implement fallback logic:
  - Use article titles to find AMP versions or Social Media metadata (OpenGraph).
  - **Print-Edition Discovery:** Automatically navigate to "Today's Paper" or "E-Paper" archive links to extract a considerable substance of the news (often bypassing web-snippet/paywall limitations), even if not always the full 100% text.

### **Phase 3: The "Delta" Dashboard (The "Showcase")**

- [ ] **Goal:** Visualize the "Secret" that others are missing.

- [ ] **The "Information Delta" View:** A `Next.js`/React module that groups the same event from 5 sources.
  - [ ] **Visual 1:** A "Sentiment Spectrum" showing where each outlet sits for that specific event.
  - [ ] **Visual 2:** The "Omission Alert"—highlighting facts mentioned in 4 sources but missing in 1 (usually state media).
- [ ] **The "Bias Ticker":** A live feed showing the most "sensationalized” headline of the hour based on adjective density (SSE/WebSockets).
- [ ] **YC Angle:** This is the "Product Insight." It shows you understand what users (analysts/journalists) actually want: to see the _gap_ between versions of the truth.

### **Phase 4: Scaling & Moat (The "Company")**

- [ ] **Goal:** Prepare for high volume and defensibility.

- [ ] **Narrative Lead Time Metric:** Track which outlet is the first to "label" a protest or policy. This is a high-value metric for hedge funds or political analysts.
- [ ] **Historical Back-testing:** Use your growing database to show the following: "On this date, this outlet was 4 days behind on reporting the crisis."

### **Libraries & Tools Master List**

| **Layer**            | **Tools**                                       | **Purpose**                                                   |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| **Ingestion**        | `undici`, `rss-parser`, `playwright`            | Bypassing WAFs and parsing RSS/Atom feeds.                    |
| **Text Extraction**  | `jsdom`, `@mozilla/readability`, `unfluff`      | Extracting full article text for better LLM context.          |
| **Core AI**          | `groq`                                          | Groq for structured JSON extraction, embeddings, and framing. |
| **Specialized NLP**  | LLM-first pipeline (Groq) / Hugging Face        | Target-dependent sentiment and framing extraction.            |
| **Validation**       | `zod`                                           | Ensuring AI outputs conform to schemas at runtime.            |
| **Analytics/Search** | `pgvector` (Postgres)                           | High-speed similarity search and vector analytics.            |
| **UI**               | `Next.js`, `react-plotly.js`                    | Building the "Heatmap of Bias" dashboard.                     |
| **Orchestration**    | `NestJS`, `@nestjs/schedule`, `bullmq`, `redis` | Scheduler, API, and durable job queues.                       |
| **DB / ORM**         | `pg`, `pgvector`, `drizzle-orm`                 | Postgres with vector extension and lightweight ORM.           |
| **Scraping**         | `playwright`, `undici`, `rss-parser`            | Rendering fallback, fast HTTP fetches, and feed parsing.      |

### **Immediate 48-Hour Sprint**

- [ ] Run the TypeScript `bias_checker_core` script (e.g., `pnpm run start` or `ts-node src/bias_checker_core.ts`) — or run the existing `bias_checker_core.py` if not yet ported.
- [ ] Gather data from 3 "state” and 3 "private” sources for the same major political headline.
- [ ] Manually trigger the adjective extraction prompt via `groq` to see if the "Delta" is visible. If it is, you have your **"Quantum of Utility"** for the application.

- [x] Start the Nest API (apps/api) in dev mode and verify `GET /providers` returns the canonical list.
- [x] Enqueue a single scrape job or call `/fetch?source=<id>` to validate the ScraperService and Readability extraction.
