# RoadMap

This phased roadmap expands your existing blueprint into a YC-caliber execution strategy. It shifts the focus from "building a tool" to "validating a data moat," prioritizing the **90/10 solution** (achieving 90% of the value with 10% of the effort) to ensure you have a "quantum of utility" for the demo.

### **Phase 1: The Robust Ingestion Engine (The "Hustle")**

- [x] **Goal:** Establish a 100% reliable, de-duplicated data stream from Sri Lankan media using a stepped queue pipeline.

- [x] **Infrastructure:** \* `undici` (HTTP client) with Chrome/120 headers; fallback to `playwright` (Chromium) for JS-heavy pages and challenge solving.

- [x] **Orchestrator / API:** `NestJS` (apps/api) using `@nestjs/schedule` for cron-driven discovery and **multi-stage BullMQ queues**:
  - **Queue 1 (discovery):** Finds new links, saves to Postgres, enqueues scraper jobs.
  - **Queue 2 (scraper):** Runs Playwright, saves text to Postgres, enqueues analysis jobs.
  - [x] **Queue 3 (analysis):** Calls LLM, saves final data to Postgres (including embeddings with `pgvector`).
  - [x] `rss-parser`: Standardize RSS/Atom feeds.
  - [x] **Logic:** Implement **"Near-Duplicate Detection"** using fuzzy string libraries (`string-similarity` / `fast-fuzzy`) or embedding similarity (85% threshold) with `pgvector` to flag the same "Event Cluster" immediately.
  - [x] **Throttling:** Limit RSS discovery to 3 stories per outlet during development to ensure high-quality debugging and avoid rate-limiting.
- [x] **DB Update Points:**
  - [x] Setting up Drizzle ORM and Article Schema.
  - [x] Discovery: Insert new article metadata (checks for existing URLs).
  - [x] Scraper: Update article with full text and quality flags (`is_snippet`, `is_paywalled`).
  - [x] Analysis: Update article with LLM results; sync embeddings with `pgvector` (Next step).
- [x] **YC Angle:** This shows "resourcefulness.” You aren't just using a standard library; you're actively overcoming local technical hurdles (WAFs/Cloudflare).

### **Phase 2: The Intelligence Hybrid (The "Brain")**

- [x] **Goal:** Move from general sentiment to "target-dependent” bias.

- [x] **Strategy: English-First Focus**
  - Temporarily exclude Sinhala/Tamil and TV sources to focus on high-fidelity English text extraction. This ensures the LLM (Groq) has the cleanest possible context for the "Quantum of Utility" demo.

- [x] **The "Double-Pass" Analysis:**
  - [x] **Pass 1 (Entity Detection):** Use `groq` to identify the "Target" of the news (e.g., "The President," "The JVP," "The Central Bank").
  - [x] **Pass 2 (Sentiment Score):** Pipe that specific target into an LLM-first pipeline (Groq or an optional specialized inference model) to produce target-specific sentiment scores and charged-adjective lists.
- [x] **Framing Extraction:** Use `groq` to extract **"Charged Adjectives."**
  - [x] _State Media:_ "The necessary economic adjustment..."
  - [x] _Private Media:_ "The crippling tax hike..."
- [x] **YC Angle:** This demonstrates "technical depth.” You aren't just "wrapping an API"; you're building a multi-stage pipeline that combines LLM reasoning with deterministic NLP where needed.

- [x] **Scraper details:** Use a Playwright `ScraperService` (worker) that consumes jobs from `bullmq`, renders pages with `route.abort()` for non-HTML assets, extracts HTML, runs `@mozilla/readability` for the article body, then forwards content to the Analysis service.
- [x] **Technical Dredging & AI Browsing (Stagehand):** For snippet-only, paywalled, or highly-protected sources (e.g., EconomyNext, Daily Mirror):
  - **AI-Driven Fallback:** Integrate **Crawl4AI** as a secondary ingestion layer for WAF/bot-guarded sources.
  - **Agentic Interaction:** Use **Stagehand** `agent()` to handle multi-step navigation ("Today's Paper" archives, "Read More" hydration).
  - **Print-Edition Discovery:** Use **Stagehand** `agent()` to navigate E-Paper archives and extract article links/content.
  - **Auto-Scroll & Hydration:** Use **Stagehand** scroll + wait loop to trigger lazy-loaded content before extraction.

### **Phase 3: The "Delta" Dashboard (The "Showcase")**

- [x] **Goal:** Visualize the "Secret" that others are missing.

- [x] **The "Information Delta" View:** A Nuxt module that groups the same event from multiple sources.
  - [x] **Visual 1:** A "Sentiment Spectrum" showing where each outlet sits for that specific event.
  - [x] **Visual 2:** The "Omission Alert"—highlighting facts mentioned in most sources but missing in others.
- [x] **The "Bias Ticker":** A live feed showing the most "sensationalized” headlines based on adjective density.
- [x] **YC Angle:** This is the "Product Insight." It shows you understand what users (analysts/journalists) actually want: to see the _gap_ between versions of the truth.

### **Phase 4: Scaling & Moat (The "Company")**

- [ ] **Goal:** Prepare for high volume and defensibility.

- [ ] **Narrative Lead Time Metric:** Track which outlet is the first to "label" a protest or policy. This is a high-value metric for hedge funds or political analysts.
- [ ] **Historical Back-testing:** Use your growing database to show the following: "On this date, this outlet was 4 days behind on reporting the crisis."

### **Libraries & Tools Master List**

| **Layer**            | **Tools**                                        | **Purpose**                                                   |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| **Ingestion**        | `undici`, `rss-parser`, `playwright`, `crawl4ai` | Bypassing WAFs/Bot-guards like EconomyNext.                   |
| **Text Extraction**  | `jsdom`, `@mozilla/readability`, `firecrawl`     | Extracting clean Markdown or JSON from messy HTML.            |
| **Core AI**          | `groq`                                           | Groq for structured JSON extraction, embeddings, and framing. |
| **Specialized NLP**  | LLM-first (Groq) / **Stagehand** (Semantic)      | Target-dependent sentiment and semantic element selection.    |
| **Validation**       | `zod`                                            | Ensuring AI outputs conform to schemas at runtime.            |
| **Analytics/Search** | `pgvector` (Postgres)                            | High-speed similarity search and vector analytics.            |
| **UI**               | `Nuxt 4`, `Nuxt UI`                             | Building the "Information Delta" dashboard.                   |
| **Orchestration**    | `NestJS`, `@nestjs/schedule`, `bullmq`, `redis`  | Scheduler, API, and durable job queues.                       |
| **DB / ORM**         | `pg`, `pgvector`, `drizzle-orm`                  | Postgres with vector extension and lightweight ORM.           |
| **Scraping**         | `playwright`, `undici`, `rss-parser`             | Rendering fallback, fast HTTP fetches, and feed parsing.      |

### **Immediate 48-Hour Sprint**

- [x] Run the TypeScript `bias_checker_core` script (integrated into apps/api pipeline).
- [x] Gather data from state and private sources for political headlines.
- [x] Manually trigger the adjective extraction prompt via `groq` to see if the "Delta" is visible. (Confirmed: Quantum of Utility achieved).

- [x] Start the Nest API (apps/api) in dev mode and verify `GET /providers` returns the canonical list.
- [x] Enqueue a single scrape job or call `/fetch?source=<id>` to validate the ScraperService and Readability extraction.

### **Phase 5: Agentic Deep Digging (The "Knowledge Moat")**

- [ ] **Goal:** Transform the platform into an autonomous investigative engine that "hunts" for hidden data and omissions.

- [ ] **Agentic Cross-Referencing:** Trigger a dedicated **Stagehand** `agent()` only when an "Event Cluster" (multiple sources on one target) is identified.
  - **Fact Extraction:** If Source A mentions a "15% tax" but Source B only says "new taxes," the agent investigates Source B's archives or linked documents specifically to find the missing statistic.
  - **The "Omission Alert" Logic:** Cross-verify key entities and figures across the cluster to programmatically highlight what each source is "choosing" not to report.
- [ ] **Historical Narrative Auditing:** Dispatch agents to navigate complex media archives (E-Papers) to find 2-year historical baselines for current political figures.
  - **The "Narrative Flip-Flop":** Identify when an outlet's framing of the same person/policy has shifted 180 degrees over time (e.g., from "Visionary Leader" to "Fringe Politician").
- [ ] **YC Angle:** This is your **Proprietary Data Moat.** You are building a system that doesn't just read the news; it _audits_ it against history and competing versions of the truth, creating an "investigative as a service" layer.

### **Phase 6: Multi-Strategy Discovery & Coverage Depth (The "Pulse")**

- [ ] **Goal:** Eliminate the "News Delay" and capture "Hot Topics" from sources that don't offer standard RSS (e.g., NewsFirst, Newswire).

- [ ] **The "Hybrid" Discovery Engine:**
  - **RSS Strategy:** Maintain traditional polling for reliable state and established private feeds.
  - **Direct Discovery (Scrape-Based):** Visit high-frequency homepages (NewsFirst, Newswire) directly using `Crawl4AI`.
  - **Logic:** Implement a link-filtering heuristic to distinguish between "Article Links" and "Navigation/Social Links" on homepages.
- [ ] **Real-Time Responsiveness:**
  - Update discovery frequency from every 6 hours to **every 30 minutes**.
  - Implement "Active Cache" for headlines to ensure de-duplication persists across frequent polls.
- [ ] **Link Normalization:** Automatically resolve relative paths found on homepages into absolute URLs for the scraper.
- [ ] **YC Angle:** This demonstrates "Execution Speed" and "System Robustness." You aren't just waiting for the news to come to you; you are actively hunting for it as it breaks, proving the platform can handle the live pulse of the media.

### **Phase 7: Autonomous Discovery (The "Prober")**

- [ ] **Goal:** Eliminate manual provider configuration by implementing an auto-discovery pipeline.
- [ ] **Prober Service:**
  - Build a `DiscoveryAutofillService` that seeds from a list of known media domains.
  - Use `Crawl4AI` to probe domains for RSS feeds.
  - Implement heuristic classification: if no RSS is found, classify as `homepage` and auto-generate scrape-link selectors.
- [ ] **Adaptive Registration:** Automatically "promote" probed domains into the `providers` table once extraction capability is confirmed.
- [ ] **YC Angle:** This demonstrates "System Scalability." You aren't just onboarding sources; you're building an engine that learns how to ingest the entire media landscape without manual intervention.
