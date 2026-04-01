# Ground-0: The Information Delta Platform

**Ground-0** is an AI-powered media surveillance and bias-detection platform designed to surface "The Truth in the Gap." By analyzing Sri Lankan media through a multi-stage ingestion and intelligence pipeline, it identifies how different outlets (State vs. Private) frame the same events, detect omissions, and quantify target-specific sentiment.

## 🚀 Mission

Sri Lanka's media landscape is a battleground of political framing. The most valuable insight isn't in what is reported, but in the **Information Delta**—the difference between Version A and Version B of the same event. Ground-0 automates the detection of this delta to provide a "Quantum of Utility" for analysts and informed citizens.

---

## 🏗 System Architecture

The platform is built as a high-performance **NestJS** monorepo using **Turborepo** and a distributed **BullMQ** worker architecture to process data through three primary stages:

### 1. The Ingestion Engine (Discovery & Dredging)

- **RSS Poller:** Standardizes feeds from national newspapers (Daily Mirror, Island, News.lk, etc.).
- **Near-Duplicate Detection:** Uses `pgvector` and fuzzy matching to group stories into "Event Clusters" across sources automatically.
- **Technical Dredging:** A Playwright-powered scraper that bypasses WAFs, handles 5-second JS delays, and implements fallback logic (AMP/Print Edition) to recover content for paywalled or summary-only news.

### 2. The Intelligence Hybrid (Analysis)

- **Double-Pass LLM Pipeline (Groq/LLM):**
  - **Pass 1 (Entity Detection):** Identifies the "Target" (e.g., Central Bank, IMF, JVP).
  - **Pass 2 (Framing Extraction):** Scores sentiment relative to the target and extracts "Charged Adjectives" (e.g., "necessary adjustment" vs. "crippling tax").
- **The Delta Metric:** Quantifies which facts are missing from state-sponsored versions of a story using vector search.

### 3. The Dashboard (Visualizing Bias)

- **Sentiment Spectrum:** Visualizes where each outlet sits on specific political events.
- **Omission Alerts:** Highlights facts present in the cluster but absent in specific reports.

---

## 🛠 Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (Distributed Worker Pattern)
- **Orchestration:** [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/)
- **Data Pipeline:** [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/)
- **Database:** [PostgreSQL (Neon)](https://neon.tech/) with [pgvector](https://github.com/pgvector/pgvector)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Extraction:** [Playwright](https://playwright.dev/) + [@mozilla/readability](https://github.com/mozilla/readability)
- **AI Layer:** [Groq](https://groq.com/) for high-speed LLM inference.

---

## 🚦 Getting Started

### Prerequisites

- Node.js >= 18
- pnpm
- Docker (for local Redis/Infra)

### Installation

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/NelakaWith/ground-0.git
    cd ground-0
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    ```
3.  **Local Infrastructure:**
    The project includes an `infra-up.cmd` to spin up local Redis/Postgres requirements.
    ```bash
    pnpm dev
    ```

---

## 📅 Roadmap & Progress

See the detailed [RoadMap.md](docs/RoadMap.md) for Phase 1 (Ingestion), Phase 2 (Intelligence), and Phase 3 (Showcase) progress.

---

## 🏛 License

Private / Proprietary Prototype.
