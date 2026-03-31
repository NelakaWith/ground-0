# RSS News Bias Checker (V1 MVP)

## 1. Project Goal

[YC showcase approach](./YC%20showcase%20approach.md)

Build an automated pipeline that monitors Sri Lankan news via RSS feeds and uses Gemini 1.5 Flash to analyze the political framing and bias of news snippets (Headlines + Summaries).

## 2. Technical Stack

- **Language:** Python 3.10+
- **Networking:** `curl_cffi` (to bypass Cloudflare/WAF)
- **Parsing:** `feedparser` (to process XML)
- **AI Engine:** `google-generativeai` (Gemini 1.5 Flash API - Free Tier)
- **Storage:** PostgreSQL (local database)
- **Frontend:** Streamlit (for the data dashboard)

### A. Ingestion & Extraction (The "Hustle")

- **`curl_cffi`**: To bypass WAFs and Cloudflare by mimicking Chrome browser fingerprints.
- **`feedparser`**: Standardizing RSS formats.
- **`newspaper3k`**: Full-text extraction for deeper framing analysis.

### B. The Intelligence Layer (The "Brain")

- **`google-generativeai`**: Gemini 1.5 Flash for high-speed analysis of "adjective deltas."
- **`NewsSentiment`**: Target-Dependent Sentiment Classification for Specific Entities.
- **`pgvector` (NEW)**: A PostgreSQL extension to store article embeddings, allowing for s**emantic search** (finding stories with the same _meaning_ even if they use different keywords).

### C. Storage & Data Engineering

- **`PostgreSQL` (UPGRADED)**: Replacing SQLite. Provides robust concurrency for multi-user dashboards and better data integrity.
- **`DuckDB`**: Still used for local OLAP (analytical) processing of large historical dumps during the demo.

### D. Visualization & UI (The "Showcase")

- **`Streamlit`**: Frontend dashboard.
- **`Plotly`**: Interactive sentiment heatmaps and divergence charts.

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

- **Rate Limiting:** The analyzer will include a `time. sleep(4)` between batches to respect the Gemini Free Tier (15 RPM).
- **Firewall Bypass:** All requests will use `curl_cffi` with `impersonate="chrome120"` to ensure continuous access to Lake House (Daily News/Dinamina) and EconomyNext feeds.
- **Legal Compliance:** The app will only process data syndicated via public RSS feeds, avoiding unauthorized scraping of paywalled full-text content.

## 6. Success Metrics for MVP

1. **Zero-Maintenance Ingestion:** Feeds refresh automatically via a simple cron job.
2. **Structural Integrity:** Every analyzed article has a valid JSON bias report.
3. **Discovery:** The dashboard successfully highlights cases where state vs. private media use different "leads” for the same story.
