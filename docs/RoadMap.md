# RoadMap

This phased roadmap expands your existing blueprint into a YC-caliber execution strategy. It shifts the focus from "building a tool" to "validating a data moat," prioritizing the **90/10 solution** (achieving 90% of the value with 10% of the effort) to ensure you have a "quantum of utility" for the demo.

### **Phase 1: The Robust Ingestion Engine (The "Hustle")**

- [ ] **Goal:** Establish a 100% reliable, de-duplicated data stream from Sri Lankan media.

- [ ] **Infrastructure:** \* `curl_cffi`: Mimic `chrome120` headers to bypass WAFs on state media and private news sites.
  - [ ] `feedparser`: Standardize RSS feeds.
  - [ ] **Logic:** Implement **"Near-Duplicate Detection"** using `RapidFuzz`. If two headlines are 85% similar, flag them as the same "Event Cluster" immediately.
- [ ] **YC Angle:** This shows "resourcefulness.” You aren't just using a standard library; you're actively overcoming local technical hurdles (WAFs/Cloudflare).

### **Phase 2: The Intelligence Hybrid (The "Brain")**

- [ ] **Goal:** Move from general sentiment to "target-dependent” bias.

- [ ] **The "Double-Pass" Analysis:**
  - [ ] **Pass 1 (Entity Detection):** Use Gemini 1.5 Flash to identify the "Target" of the news (e.g., "The President," "The JVP," "The Central Bank").
  - [ ] **Pass 2 (Sentiment Score):** Pipe that specific target into `NewsSentiment`.
- [ ] **Framing Extraction:** Use Gemini 1.5 Flash to extract **"Charged Adjectives."**
  - [ ] _State Media:_ "The necessary economic adjustment..."
  - [ ] _Private Media:_ "The crippling tax hike..."
- [ ] **YC Angle:** This demonstrates "technical depth.” You aren't just "wrapping an API"; you're building a multi-stage pipeline that combines LLM reasoning with academic-grade NLP models.

### **Phase 3: The "Delta" Dashboard (The "Showcase")**

- [ ] **Goal:** Visualize the "Secret" that others are missing.

- [ ] **The "Information Delta" View:** A Streamlit module that groups the same event from 5 sources.
  - [ ] **Visual 1:** A "Sentiment Spectrum" showing where each outlet sits for that specific event.
  - [ ] **Visual 2:** The "Omission Alert"—highlighting facts mentioned in 4 sources but missing in 1 (usually state media).
- [ ] **The "Bias Ticker":** A live feed showing the most "sensationalized” headline of the hour based on adjective density.
- [ ] **YC Angle:** This is the "Product Insight." It shows you understand what users (analysts/journalists) actually want: to see the _gap_ between versions of the truth.

### **Phase 4: Scaling & Moat (The "Company")**

- [ ] **Goal:** Prepare for high volume and defensibility.

- [ ] **Narrative Lead Time Metric:** Track which outlet is the first to "label" a protest or policy. This is a high-value metric for hedge funds or political analysts.
- [ ] **Historical Back-testing:** Use your growing database to show the following: "On this date, this outlet was 4 days behind on reporting the crisis."

### **Libraries & Tools Master List**

| **Layer**           | **Tools**                 | **Purpose**                                          |
| ------------------- | ------------------------- | ---------------------------------------------------- |
| **Ingestion**       | `curl_cffi`, `feedparser` | Bypassing WAFs and parsing RSS.                      |
| **Text Extraction** | `newspaper3k`             | Extracting full article text for better LLM context. |
| **Core AI**         | `google-generativeai`     | Gemini 1.5 Flash for framing & JSON extraction.      |
| **Specialized NLP** | `NewsSentiment`           | GRU-TSC model for entity-specific sentiment.         |
| **Validation**      | `Pydantic`                | Ensuring AI outputs don't break the database.        |
| **Clustering**      | `RapidFuzz`               | Grouping headlines into "Event Clusters."            |
| **Analytics**       | `DuckDB`, `Pandas`        | High-speed data manipulation.                        |
| **UI**              | `Streamlit`, `Plotly`     | Building the "Heatmap of Bias" dashboard.            |

### **Immediate 48-Hour Sprint**

- [ ] Run the `bias_checker_core.py` script.
- [ ] Gather data from 3 "state” and 3 "private” sources for the same major political headline.
- [ ] Manually trigger the a**djective extraction** prompt to see if the "Delta" is visible. If it is, you have your **"Quantum of Utility"** for the application.
