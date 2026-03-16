# Project Plan: Ground-0 (V1 MVP)

## 1. Project Goal

Build an automated pipeline that monitors Sri Lankan news via RSS feeds and uses Gemini 1.5 Flash to analyze the political framing and bias of news snippets (Headlines + Summaries).

## 2. Technical Stack

- **Language:** Python 3.10+
- **Networking:** `curl_cffi` (to bypass Cloudflare/WAF)
- **Parsing:** `feedparser` (to process XML)
- **AI Engine:** `google-generativeai` (Gemini 1.5 Flash API - Free Tier)
- **Storage:** SQLite (local database)
- **Frontend:** Streamlit (for the data dashboard)

## 3. Phased Implementation Roadmap

### Phase 1: Database & Ingestion (The Foundation)

- **Goal:** Fetch news and store it locally.
- **Tasks:**
  - Set up a SQLite database with a `news_items` table.
  - Write a `fetcher.py` script that loops through the verified RSS provider list.
  - Implement "De-duplication": Use a hash of the article link as the Primary Key so the same news isn't saved twice.

### Phase 2: AI Analysis (The Intelligence)

- **Goal:** Extract structured bias metrics from snippets.
- **Tasks:**
  - Create a `system_prompt` defining journalistic bias (loaded language, sensationalism, framing).
  - Implement "Micro-Batching": Send batches of 5 snippets per API call to stay under rate limits and ensure complete JSON responses.
  - Configure Gemini for `response_mime_type: "application/json"`.

### Phase 3: The Dashboard (The Interface)

- **Goal:** Visualize the bias.
- **Tasks:**
  - Build a Streamlit app that connects to the SQLite DB.
  - Add filters for Source (e.g., Ada Derana vs. Daily News) and Bias Category.
  - Create a "Side-by-Side" view to compare how different outlets covered the same event.

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

- **Rate Limiting:** The analyzer will include a `time.sleep(4)` between batches to respect the Gemini Free Tier (15 RPM).
- **Firewall Bypass:** All requests will use `curl_cffi` with `impersonate="chrome120"` to ensure continuous access to Lake House (Daily News/Dinamina) and EconomyNext feeds.
- **Legal Compliance:** The app will only process data syndicated via public RSS feeds, avoiding unauthorized scraping of paywalled full-text content.

## 6. Success Metrics for MVP

1. **Zero-Maintenance Ingestion:** Feeds refresh automatically via a simple cron job.
2. **Structural Integrity:** Every analyzed article has a valid JSON bias report.
3. **Discovery:** The dashboard successfully highlights cases where state vs. private media use different "Ledes" for the same story.
